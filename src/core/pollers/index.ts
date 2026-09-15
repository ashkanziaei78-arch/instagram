import {
  accountsRepo,
  contactsRepo,
  followerPollRepo,
  logRepo,
  mediaRepo,
  settingsRepo
} from '../db/repos'
import { engines } from '../engine'
import { UnsupportedCapabilityError } from '../engine/types'
import { enqueueWelcomeForNewFollowers, handleIncomingComment, onNewPostDetected } from '../automations'

/* ══════════════════════════ نظرسنج فالوور ══════════════════════════ */

/**
 * تشخیص فالوور جدید با مقایسه‌ی لیست‌ها.
 *
 * چرا نظرسنجی و نه وبهوک؟ چون اینستاگرام رویداد «فالوور جدید» ندارد — نه در
 * API رسمی و نه در وبهوک‌ها. تنها راه، گرفتن دوره‌ای لیست و مقایسه با دفعه‌ی
 * قبل است. این یعنی به موتور Session نیاز است.
 *
 * ── محافظت خط‌مبنا (مهم‌ترین خط این فایل) ──
 * بار اولی که لیست را می‌گیریم، *همه‌ی* فالوورها «جدید» به نظر می‌رسند. اگر
 * همان‌جا پیام خوشامد بفرستیم، به هزاران نفر پیام می‌رود و حساب ظرف چند دقیقه
 * محدود می‌شود. پس اولین همگام‌سازی فقط خط‌مبنا می‌سازد و هیچ پیامی نمی‌دهد.
 */
export async function pollFollowers(
  accountId: number,
  opts: { sendWelcome?: boolean } = {}
): Promise<{ ok: boolean; total: number; newCount: number; welcomed: number; message: string }> {
  const account = accountsRepo.byId(accountId)
  if (!account) return { ok: false, total: 0, newCount: 0, welcomed: 0, message: 'حساب پیدا نشد' }

  let engine
  try {
    engine = engines().pick(accountId, 'list_followers')
  } catch (e) {
    return {
      ok: false,
      total: 0,
      newCount: 0,
      welcomed: 0,
      message: (e as UnsupportedCapabilityError).message
    }
  }

  const state = followerPollRepo.state(accountId)
  const isFirstRun = state.baseline_done === 0

  const followers = await engine.listFollowers(accountId, 20000)
  const newIds = contactsRepo.syncFollowers(
    accountId,
    followers.map((f) => ({
      ig_user_id: f.ig_user_id,
      username: f.username,
      full_name: f.full_name,
      profile_pic: f.profile_pic,
      is_private: f.is_private,
      is_verified: f.is_verified
    }))
  )

  followerPollRepo.update(accountId, {
    last_full_sync: Date.now(),
    last_known_count: followers.length,
    baseline_done: 1
  })

  if (isFirstRun) {
    logRepo.add({
      account_id: accountId,
      level: 'info',
      category: 'followers',
      message:
        'خط‌مبنای فالوورها ساخته شد: ' + followers.length + ' نفر. ' +
        'به این افراد پیام خوشامد ارسال *نمی‌شود* — فقط فالوورهای جدید از این لحظه به بعد.'
    })
    return {
      ok: true,
      total: followers.length,
      newCount: 0,
      welcomed: 0,
      message: 'خط‌مبنا با ' + followers.length + ' فالوور ثبت شد (بدون ارسال پیام)'
    }
  }

  let welcomed = 0
  if (newIds.length > 0 && opts.sendWelcome !== false) {
    welcomed = enqueueWelcomeForNewFollowers(accountId, newIds)
  }

  if (newIds.length > 0) {
    logRepo.add({
      account_id: accountId,
      level: 'info',
      category: 'followers',
      message: newIds.length + ' فالوور جدید کشف شد، ' + welcomed + ' پیام خوشامد در صف'
    })
  }

  return {
    ok: true,
    total: followers.length,
    newCount: newIds.length,
    welcomed,
    message: newIds.length + ' فالوور جدید'
  }
}

export async function syncFollowing(accountId: number): Promise<{ ok: boolean; total: number; message: string }> {
  let engine
  try {
    engine = engines().pick(accountId, 'list_following')
  } catch (e) {
    return { ok: false, total: 0, message: (e as Error).message }
  }

  const following = await engine.listFollowing(accountId, 20000)
  for (const u of following) {
    const existing = contactsRepo.get(accountId, u.ig_user_id)
    contactsRepo.upsert(accountId, {
      ig_user_id: u.ig_user_id,
      username: u.username,
      full_name: u.full_name,
      profile_pic: u.profile_pic,
      is_private: u.is_private,
      is_verified: u.is_verified,
      is_follower: existing ? existing.is_follower === 1 : false,
      is_following: true
    })
  }
  return { ok: true, total: following.length, message: following.length + ' فالووینگ همگام شد' }
}

/* ══════════════════════════ نظرسنج مدیا و آمار ══════════════════════════ */

/**
 * پست‌ها را همگام می‌کند، آمارشان را می‌گیرد، و پست‌های جدید را اعلام می‌کند.
 * همچنین یک عکس روزانه از تعداد فالوور برای نمودار رشد ثبت می‌کند.
 */
export async function pollMedia(
  accountId: number,
  opts: { withInsights?: boolean; triggerNewPost?: boolean } = {}
): Promise<{ ok: boolean; total: number; newPosts: number; message: string }> {
  let engine
  try {
    engine = engines().pick(accountId, 'read_media')
  } catch (e) {
    return { ok: false, total: 0, newPosts: 0, message: (e as Error).message }
  }

  const before = new Set(mediaRepo.list(accountId, 200).map((m) => m.media_id))
  const items = await engine.listMedia(accountId, 50)

  const freshIds: string[] = []
  for (const m of items) {
    if (!before.has(m.media_id)) freshIds.push(m.media_id)

    let insights = {}
    if (opts.withInsights !== false) {
      insights = await engine.getMediaInsights(accountId, m.media_id, m.media_type)
    }

    mediaRepo.upsert(accountId, {
      media_id: m.media_id,
      media_type: m.media_type,
      caption: m.caption ?? null,
      permalink: m.permalink ?? null,
      thumbnail_url: m.thumbnail_url ?? null,
      timestamp: m.timestamp,
      like_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0,
      views: (insights as { views?: number }).views ?? 0,
      reach: (insights as { reach?: number }).reach ?? 0,
      saved: (insights as { saved?: number }).saved ?? 0,
      shares: (insights as { shares?: number }).shares ?? 0
    })
  }

  // عکس روزانه برای نمودار رشد
  try {
    const profile = await engine.getProfile(accountId)
    accountsRepo.upsert({
      ig_user_id: profile.ig_user_id,
      username: profile.username,
      name: profile.name ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      engine: engine.kind,
      followers_count: profile.followers_count ?? 0,
      follows_count: profile.follows_count ?? 0,
      media_count: profile.media_count ?? 0
    })
    accountsRepo.snapshot(
      accountId,
      profile.followers_count ?? 0,
      profile.follows_count ?? 0,
      profile.media_count ?? 0
    )
  } catch {
    /* اگر پروفایل نیامد، همگام‌سازی مدیا نباید شکست بخورد */
  }

  // پست‌های جدید را اعلام کن — ولی نه در اولین اجرا
  let triggered = 0
  if (opts.triggerNewPost !== false && before.size > 0) {
    for (const id of freshIds) {
      triggered += onNewPostDetected(accountId, id)
    }
  } else if (before.size === 0) {
    // اولین همگام‌سازی: همه‌ی پست‌ها را «اعلام‌شده» علامت بزن تا برادکست نگیرند
    for (const m of items) mediaRepo.markBroadcast(accountId, m.media_id)
  }

  return {
    ok: true,
    total: items.length,
    newPosts: freshIds.length,
    message: items.length + ' پست همگام شد، ' + freshIds.length + ' پست جدید، ' + triggered + ' برادکست'
  }
}

/* ══════════════════════════ نظرسنج کامنت (پشتیبانِ وبهوک) ══════════════════════════ */

/**
 * وبهوک مسیر اصلی کامنت‌هاست، اما نیازمند یک آدرس عمومی HTTPS است که همه
 * راه‌اندازی نمی‌کنند. این نظرسنج همان کار را با تأخیر انجام می‌دهد تا اپ
 * بدون وبهوک هم کار کند.
 *
 * فقط پست‌های اخیر را می‌بیند، چون کامنت روی پست ماه پیش کم‌اهمیت‌تر است و
 * بررسی همه‌ی پست‌ها سهمیه‌ی API را می‌سوزاند.
 */
export async function pollComments(
  accountId: number,
  opts: { recentPosts?: number; maxAgeHours?: number } = {}
): Promise<{ ok: boolean; checked: number; processed: number; message: string }> {
  let engine
  try {
    engine = engines().pick(accountId, 'read_comments')
  } catch (e) {
    return { ok: false, checked: 0, processed: 0, message: (e as Error).message }
  }

  const recent = mediaRepo.list(accountId, opts.recentPosts ?? 8)
  const maxAge = (opts.maxAgeHours ?? 72) * 3600 * 1000
  let checked = 0
  let processed = 0

  for (const m of recent) {
    if (Date.now() - m.timestamp > maxAge) continue
    try {
      const comments = await engine.listComments(accountId, m.media_id, 50)
      for (const c of comments) {
        checked++
        const res = await handleIncomingComment({
          accountId,
          commentId: c.comment_id,
          mediaId: m.media_id,
          text: c.text,
          fromUserId: c.from_user_id,
          fromUsername: c.from_username
        })
        if (res.handled) processed++
      }
    } catch (e) {
      logRepo.add({
        account_id: accountId,
        level: 'warn',
        category: 'comments',
        message: 'خواندن کامنت‌های پست ' + m.media_id + ' ناموفق بود',
        meta: { error: (e as Error).message }
      })
    }
  }

  return {
    ok: true,
    checked,
    processed,
    message: checked + ' کامنت بررسی شد، ' + processed + ' پاسخ در صف'
  }
}

/* ══════════════════════════ زمان‌بند ══════════════════════════ */

export interface PollerIntervals {
  commentsMs: number
  mediaMs: number
  followersMs: number
}

const DEFAULT_INTERVALS: PollerIntervals = {
  commentsMs: 3 * 60 * 1000, // هر ۳ دقیقه
  mediaMs: 15 * 60 * 1000, // هر ۱۵ دقیقه
  followersMs: 60 * 60 * 1000 // هر ساعت — گران‌ترین عملیات است
}

export class PollerScheduler {
  private timers: NodeJS.Timeout[] = []
  private running = false

  start(intervals: Partial<PollerIntervals> = {}): void {
    if (this.running) return
    this.running = true
    const iv = { ...DEFAULT_INTERVALS, ...intervals }

    const forEachAccount = async (
      label: string,
      fn: (accountId: number) => Promise<unknown>
    ): Promise<void> => {
      if (settingsRepo.getSafety().killSwitch) return
      for (const acc of accountsRepo.all()) {
        if (acc.status !== 'active') continue
        try {
          await fn(acc.id)
        } catch (e) {
          logRepo.add({
            account_id: acc.id,
            level: 'warn',
            category: 'poller',
            message: label + ' برای @' + acc.username + ' ناموفق بود',
            meta: { error: (e as Error).message }
          })
        }
      }
    }

    this.timers.push(
      setInterval(() => {
        void forEachAccount('نظرسنجی کامنت', (id) => pollComments(id))
      }, iv.commentsMs)
    )
    this.timers.push(
      setInterval(() => {
        void forEachAccount('همگام‌سازی پست‌ها', (id) => pollMedia(id))
      }, iv.mediaMs)
    )
    this.timers.push(
      setInterval(() => {
        void forEachAccount('همگام‌سازی فالوورها', (id) => pollFollowers(id))
      }, iv.followersMs)
    )

    logRepo.add({ level: 'info', category: 'poller', message: 'زمان‌بند نظرسنجی راه افتاد' })
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t)
    this.timers = []
    this.running = false
  }

  get isRunning(): boolean {
    return this.running
  }
}

export const pollerScheduler = new PollerScheduler()
