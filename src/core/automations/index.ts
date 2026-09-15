import {
  broadcastsRepo,
  commentsRepo,
  contactsRepo,
  logRepo,
  mediaRepo,
  messagesRepo,
  rulesRepo,
  settingsRepo,
  jobsRepo
} from '../db/repos'
import { engines } from '../engine'
import { jobQueue } from '../queue/job-queue'
import { findMatchingRule } from '../rules/matcher'
import { enqueueRuleActions, type TriggerContext } from '../rules/runner'
import { buildMessage, humanDelayMs } from '../text'
import type { BroadcastTargetFilter } from '../../shared/types'

/* ══════════════════════════ ۱. کامنت به دایرکت ══════════════════════════ */

export interface IncomingComment {
  accountId: number
  commentId: string
  mediaId: string
  text: string
  fromUserId: string
  fromUsername?: string
}

/**
 * ورودی اصلی اتوماسیون «کامنت به دایرکت».
 * از دو جا صدا زده می‌شود: وبهوک متا (فوری) و نظرسنجی دوره‌ای (پشتیبان).
 *
 * ترتیب بررسی‌ها عمدی است و از گران‌ترین اشتباه جلوگیری می‌کند:
 *   ۱. تکراری نبودن کامنت — وبهوک متا واقعا رویدادها را تکرار می‌فرستد
 *   ۲. کامنت خودمان نباشد — وگرنه اپ به خودش دایرکت می‌دهد (حلقه‌ی بی‌پایان)
 *   ۳. تطبیق قانون
 *   ۴. شرط once_per_user
 */
export async function handleIncomingComment(c: IncomingComment): Promise<{ handled: boolean; reason: string }> {
  // ۲. کامنت خود حساب را نادیده بگیر
  const account = (await import('../db/repos')).accountsRepo.byId(c.accountId)
  if (account && account.ig_user_id === c.fromUserId) {
    return { handled: false, reason: 'کامنت خود حساب است' }
  }

  const rules = rulesRepo
    .active(c.accountId, 'comment_keyword')
    .concat(rulesRepo.active(c.accountId, 'comment_any'))
    .sort((a, b) => b.priority - a.priority)

  if (rules.length === 0) {
    commentsRepo.markSeen(c.accountId, {
      comment_id: c.commentId,
      media_id: c.mediaId,
      from_user_id: c.fromUserId,
      from_username: c.fromUsername,
      text: c.text
    })
    return { handled: false, reason: 'قانون فعالی برای کامنت وجود ندارد' }
  }

  const match = findMatchingRule(rules, c.text, c.mediaId)

  // ۱. ثبت کامنت. اگر false برگرداند یعنی قبلا پردازش شده.
  const isNew = commentsRepo.markSeen(c.accountId, {
    comment_id: c.commentId,
    media_id: c.mediaId,
    from_user_id: c.fromUserId,
    from_username: c.fromUsername,
    text: c.text,
    matched_rule_id: match?.rule.id ?? null
  })
  if (!isNew) return { handled: false, reason: 'این کامنت قبلا پردازش شده' }

  if (!match) return { handled: false, reason: 'هیچ قانونی تطبیق نیافت' }

  // ۴. شرط یک‌بار به ازای هر کاربر
  if (match.rule.once_per_user && commentsRepo.alreadyHandled(c.accountId, match.rule.id, c.fromUserId)) {
    return { handled: false, reason: 'این کاربر قبلا از این قانون پاسخ گرفته' }
  }

  // مخاطب را ثبت کن تا در لیست‌ها و برادکست‌ها قابل استفاده باشد
  contactsRepo.upsert(c.accountId, {
    ig_user_id: c.fromUserId,
    username: c.fromUsername
  })

  const media = mediaRepo.byMediaId(c.accountId, c.mediaId)
  const ctx: TriggerContext = {
    accountId: c.accountId,
    userIgId: c.fromUserId,
    username: c.fromUsername,
    commentId: c.commentId,
    mediaId: c.mediaId,
    postCaption: media?.caption ?? undefined,
    postLink: media?.permalink ?? undefined,
    rawText: c.text
  }

  const queued = enqueueRuleActions(match.rule, ctx)
  return {
    handled: queued > 0,
    reason: queued > 0
      ? 'قانون «' + match.rule.name + '» فعال شد (' + (match.reason ?? '') + ')'
      : 'قانون تطبیق یافت ولی اکشنی در صف نرفت (احتمالا تکراری بود)'
  }
}

/* ══════════════════════════ ۲. پاسخ به کلیدواژه در دایرکت ══════════════════════════ */

export interface IncomingDm {
  accountId: number
  fromUserId: string
  fromUsername?: string
  text: string
  messageId?: string
}

export async function handleIncomingDm(d: IncomingDm): Promise<{ handled: boolean; reason: string }> {
  // ثبت پیام ورودی — همین کار پنجره‌ی ۲۴ ساعته را باز می‌کند
  contactsRepo.markInbound(d.accountId, d.fromUserId)
  if (d.fromUsername) {
    contactsRepo.upsert(d.accountId, { ig_user_id: d.fromUserId, username: d.fromUsername })
  }
  messagesRepo.log({
    account_id: d.accountId,
    contact_ig_id: d.fromUserId,
    direction: 'in',
    text: d.text
  })

  const rules = rulesRepo.active(d.accountId, 'dm_keyword')
  if (rules.length === 0) return { handled: false, reason: 'قانون فعالی برای دایرکت وجود ندارد' }

  const match = findMatchingRule(rules, d.text)
  if (!match) return { handled: false, reason: 'هیچ قانونی تطبیق نیافت' }

  const queued = enqueueRuleActions(match.rule, {
    accountId: d.accountId,
    userIgId: d.fromUserId,
    username: d.fromUsername,
    rawText: d.text
  })

  return { handled: queued > 0, reason: 'قانون «' + match.rule.name + '» فعال شد' }
}

/* ══════════════════════════ ۳. خوشامد به فالوور جدید ══════════════════════════ */

/**
 * برای فالوورهای جدید، پیام خوشامد در صف می‌گذارد.
 *
 * محافظت حیاتی: این تابع فقط با فالوورهای *تازه‌کشف‌شده* کار می‌کند. تصمیم
 * اینکه چه کسی تازه است، در followerPoller گرفته می‌شود که خط‌مبنای اولین
 * همگام‌سازی را نادیده می‌گیرد — وگرنه بار اول به تمام فالوورهای موجود پیام
 * می‌رفت و حساب فورا محدود می‌شد.
 */
export function enqueueWelcomeForNewFollowers(accountId: number, newFollowerIds: string[]): number {
  const rules = rulesRepo.active(accountId, 'new_follower')
  if (rules.length === 0 || newFollowerIds.length === 0) return 0

  const rule = rules[0] // بالاترین اولویت
  let queued = 0

  for (const igId of newFollowerIds) {
    const contact = contactsRepo.get(accountId, igId)
    // اگر قبلا خوشامد گرفته، دوباره نفرست (کسی که آنفالو و دوباره فالو کند)
    if (contact?.welcomed_at) continue

    const n = enqueueRuleActions(rule, {
      accountId,
      userIgId: igId,
      username: contact?.username ?? undefined,
      fullName: contact?.full_name ?? undefined
    })
    if (n > 0) {
      contactsRepo.markWelcomed(accountId, igId)
      queued++
    }
  }

  if (queued > 0) {
    logRepo.add({
      account_id: accountId,
      level: 'success',
      category: 'welcome',
      message: 'پیام خوشامد برای ' + queued + ' فالوور جدید در صف قرار گرفت'
    })
  }
  return queued
}

/* ══════════════════════════ ۴. برادکست پست جدید ══════════════════════════ */

/** گیرندگان را بر اساس فیلتر انتخاب می‌کند */
export function resolveAudience(
  accountId: number,
  filter: BroadcastTargetFilter
): { ig_user_id: string; username: string | null }[] {
  if (filter.audience === 'custom' && filter.usernames) {
    return filter.usernames.map((u) => ({ ig_user_id: u, username: u }))
  }

  let rows = contactsRepo.list(accountId, {
    audience: filter.audience,
    limit: filter.limit ?? 100000
  })

  if (filter.tag) {
    rows = rows.filter((r) => (r.tags ?? '').split(',').includes(filter.tag!))
  }
  if (filter.skipPrivate) rows = rows.filter((r) => r.is_private === 0)
  if (filter.skipNoAvatar) rows = rows.filter((r) => !!r.profile_pic)
  if (filter.minFollowers !== undefined) {
    rows = rows.filter((r) => (r.followers_count ?? 0) >= filter.minFollowers!)
  }
  if (filter.maxFollowers !== undefined) {
    rows = rows.filter((r) => (r.followers_count ?? 0) <= filter.maxFollowers!)
  }

  const limited = filter.limit ? rows.slice(0, filter.limit) : rows
  return limited.map((r) => ({ ig_user_id: r.ig_user_id, username: r.username }))
}

export function startBroadcast(broadcastId: number): { ok: boolean; total: number; message: string } {
  const bc = broadcastsRepo.byId(broadcastId)
  if (!bc) return { ok: false, total: 0, message: 'برادکست پیدا نشد' }

  let filter: BroadcastTargetFilter = { audience: 'followers' }
  try {
    filter = JSON.parse(bc.filter_json) as BroadcastTargetFilter
  } catch {
    /* از پیش‌فرض استفاده کن */
  }

  const targets = resolveAudience(bc.account_id, filter)
  if (targets.length === 0) {
    return {
      ok: false,
      total: 0,
      message:
        'گیرنده‌ای پیدا نشد. اگر مخاطب «فالوورها» است، ابتدا لیست فالوورها را همگام کنید (نیازمند موتور Session).'
    }
  }

  const total = broadcastsRepo.addTargets(broadcastId, targets)
  broadcastsRepo.setStatus(broadcastId, 'running')

  // یک کارِ آغازگر در صف می‌گذاریم؛ خودش پس از هر ارسال، خودش را دوباره صف می‌کند
  jobsRepo.enqueue({
    account_id: bc.account_id,
    kind: 'broadcast.tick',
    payload: { broadcastId },
    run_at: Date.now() + 2000,
    dedupe_key: 'bc:' + broadcastId
  })

  logRepo.add({
    account_id: bc.account_id,
    level: 'info',
    category: 'broadcast',
    message: 'برادکست «' + bc.name + '» با ' + total + ' گیرنده شروع شد'
  })

  return { ok: true, total, message: total + ' گیرنده در صف قرار گرفت' }
}

export function pauseBroadcast(broadcastId: number): void {
  broadcastsRepo.setStatus(broadcastId, 'paused')
}

export function resumeBroadcast(broadcastId: number): void {
  const bc = broadcastsRepo.byId(broadcastId)
  if (!bc) return
  broadcastsRepo.setStatus(broadcastId, 'running')
  jobsRepo.enqueue({
    account_id: bc.account_id,
    kind: 'broadcast.tick',
    payload: { broadcastId },
    run_at: Date.now() + 2000,
    dedupe_key: 'bc:' + broadcastId + ':' + Date.now()
  })
}

/**
 * وقتی پست جدیدی کشف شد، اگر قانون «پست جدید» فعال باشد یک برادکست می‌سازد.
 */
export function onNewPostDetected(accountId: number, mediaId: string): number {
  const rules = rulesRepo.active(accountId, 'new_post')
  if (rules.length === 0) return 0

  const media = mediaRepo.byMediaId(accountId, mediaId)
  let created = 0

  for (const rule of rules) {
    const dmAction = rule.actions.find((a) => a.type === 'send_dm')
    if (!dmAction?.text) continue

    // مخاطب هدف در keywords قانون نگه داشته می‌شود: followers | following | mutual | engaged_24h
    const audience = (rule.keywords.trim() || 'followers') as BroadcastTargetFilter['audience']
    const message = buildMessage(dmAction.text, {
      post_caption: (media?.caption ?? '').slice(0, 200),
      post_link: media?.permalink ?? ''
    })

    const bc = broadcastsRepo.create({
      account_id: accountId,
      name: 'پست جدید — ' + new Date().toLocaleDateString('fa-IR'),
      message,
      media_id: mediaId,
      filter_json: JSON.stringify({ audience, skipPrivate: false } satisfies BroadcastTargetFilter)
    })

    const res = startBroadcast(bc.id)
    if (res.ok) created++
    else {
      logRepo.add({
        account_id: accountId,
        level: 'warn',
        category: 'broadcast',
        message: 'برادکست پست جدید شروع نشد: ' + res.message
      })
    }
  }

  mediaRepo.markBroadcast(accountId, mediaId)
  return created
}

/* ══════════════════════════ ثبت هندلرهای صف ══════════════════════════ */

export function registerJobHandlers(): void {
  /* ── ارسال دایرکت ── */
  jobQueue.register('dm.send', {
    action: 'dm',
    async run({ job, payload }) {
      const recipientIgId = String(payload.recipientIgId ?? '')
      const text = String(payload.text ?? '')
      const commentId = payload.commentId ? String(payload.commentId) : undefined
      const buttons = payload.buttons as { title: string; url: string }[] | undefined
      const ruleId = payload.ruleId ? Number(payload.ruleId) : null
      const broadcastId = payload.broadcastId ? Number(payload.broadcastId) : null
      const targetRowId = payload.targetRowId ? Number(payload.targetRowId) : null

      if (!recipientIgId || !text) throw new Error('گیرنده یا متن پیام خالی است')

      try {
        const res = await engines().sendDmSmart(job.account_id, recipientIgId, text, {
          commentId,
          buttons
        })

        contactsRepo.markOutbound(job.account_id, recipientIgId)
        messagesRepo.log({
          account_id: job.account_id,
          contact_ig_id: recipientIgId,
          direction: 'out',
          text,
          rule_id: ruleId,
          broadcast_id: broadcastId,
          status: 'sent'
        })
        if (targetRowId) {
          broadcastsRepo.markTarget(targetRowId, 'sent')
          if (broadcastId) broadcastsRepo.bumpCounters(broadcastId)
        }
        logRepo.add({
          account_id: job.account_id,
          level: 'success',
          category: 'dm',
          message:
            'دایرکت به @' + (payload.username ?? recipientIgId) + ' ارسال شد (' +
            (res.method === 'private_reply' ? 'پاسخ خصوصی کامنت' : 'دایرکت') + ' / موتور ' + res.via + ')'
        })
      } catch (e) {
        messagesRepo.log({
          account_id: job.account_id,
          contact_ig_id: recipientIgId,
          direction: 'out',
          text,
          rule_id: ruleId,
          broadcast_id: broadcastId,
          status: 'failed',
          error: (e as Error).message
        })
        if (targetRowId) {
          broadcastsRepo.markTarget(targetRowId, 'failed', (e as Error).message)
          if (broadcastId) broadcastsRepo.bumpCounters(broadcastId)
        }
        throw e
      }
    }
  })

  /* ── پاسخ عمومی به کامنت ── */
  jobQueue.register('comment.reply', {
    action: 'comment_reply',
    async run({ job, payload }) {
      const commentId = String(payload.commentId ?? '')
      const text = String(payload.text ?? '')
      if (!commentId || !text) throw new Error('شناسه کامنت یا متن خالی است')

      const engine = engines().pick(job.account_id, 'reply_comment_public')
      await engine.replyToCommentPublic(job.account_id, commentId, text)

      logRepo.add({
        account_id: job.account_id,
        level: 'success',
        category: 'comment',
        message: 'پاسخ عمومی به کامنت ثبت شد'
      })
    }
  })

  /* ── برچسب‌گذاری مخاطب (بدون تماس با شبکه) ── */
  jobQueue.register('contact.tag', {
    async run({ job, payload }) {
      const userIgId = String(payload.userIgId ?? '')
      const tag = String(payload.tag ?? '').trim()
      if (!userIgId || !tag) return

      const contact = contactsRepo.get(job.account_id, userIgId)
      const tags = new Set((contact?.tags ?? '').split(',').filter(Boolean))
      tags.add(tag)
      const { getDb } = await import('../db/index')
      getDb()
        .prepare('UPDATE contacts SET tags=? WHERE account_id=? AND ig_user_id=?')
        .run(Array.from(tags).join(','), job.account_id, userIgId)
    }
  })

  /* ── حرکت برادکست: هر بار یک گیرنده ── */
  jobQueue.register('broadcast.tick', {
    async run({ job, payload }) {
      const broadcastId = Number(payload.broadcastId)
      const bc = broadcastsRepo.byId(broadcastId)
      if (!bc) return

      if (bc.status === 'paused') {
        logRepo.add({
          account_id: job.account_id,
          level: 'info',
          category: 'broadcast',
          message: 'برادکست «' + bc.name + '» متوقف است'
        })
        return
      }

      const target = broadcastsRepo.nextTarget(broadcastId)
      if (!target) {
        broadcastsRepo.bumpCounters(broadcastId)
        broadcastsRepo.setStatus(broadcastId, 'done')
        const done = broadcastsRepo.byId(broadcastId)!
        logRepo.add({
          account_id: job.account_id,
          level: 'success',
          category: 'broadcast',
          message:
            'برادکست «' + bc.name + '» تمام شد — ' + done.sent + ' ارسال، ' + done.failed + ' ناموفق'
        })
        return
      }

      // گیرنده‌ی فعلی را به صورت یک کار مستقل dm.send می‌فرستیم تا محدودیت‌ها
      // و تلاش‌های دوباره‌ی آن مثل بقیه‌ی دایرکت‌ها مدیریت شود
      jobsRepo.enqueue({
        account_id: job.account_id,
        kind: 'dm.send',
        run_at: Date.now() + 500,
        dedupe_key: 'bc' + broadcastId + ':t' + target.id,
        payload: {
          recipientIgId: target.ig_user_id,
          username: target.username,
          text: bc.message,
          broadcastId,
          targetRowId: target.id
        }
      })

      // خودت را برای گیرنده‌ی بعدی دوباره صف کن، با فاصله‌ی انسانی
      const s = settingsRepo.getSafety()
      jobsRepo.enqueue({
        account_id: job.account_id,
        kind: 'broadcast.tick',
        payload: { broadcastId },
        run_at: Date.now() + humanDelayMs(s.minActionDelaySec, s.maxActionDelaySec),
        dedupe_key: 'bc:' + broadcastId + ':' + target.id
      })
    }
  })

  /* ── فالو کردن کاربر (فقط موتور Session) ── */
  jobQueue.register('user.follow', {
    action: 'follow',
    async run({ job, payload }) {
      void payload
      throw new Error(
        'فالو کردن خودکار در این نسخه پیاده نشده است — ریسکش بالاست و نسبت به بازدهی توصیه نمی‌شود. ' +
          'اگر لازم دارید در تنظیمات درخواست کنید تا اضافه شود. (حساب ' + job.account_id + ')'
      )
    }
  })

  /* ── لایک کامنت ── */
  jobQueue.register('comment.like', {
    action: 'like',
    async run({ payload }) {
      void payload
      throw new Error('لایک کامنت در API رسمی وجود ندارد و در این نسخه پیاده نشده است')
    }
  })
}
