import {
  accountsRepo,
  contactsRepo,
  followerPollRepo,
  logRepo,
  mediaRepo,
  settingsRepo
} from '../db/repos'
import { engines } from '../engine'
import { UnsupportedCapabilityError, incomingFrom } from '../engine/types'
import {
  enqueueWelcomeForNewFollowers,
  handleIncomingComment,
  handleIncomingDm,
  onNewPostDetected
} from '../automations'

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

/* ══════════════════════════ نظرسنج دایرکت ══════════════════════════ */

/**
 * دایرکت‌های تازه را می‌خواند و به قوانین «کلیدواژه در دایرکت» می‌دهد.
 *
 * بدون این، آن قوانین فقط با وبهوک کار می‌کردند — یعنی برای اکثر کاربرها که
 * وبهوک (و تونل و داشبورد متا) را راه نینداخته‌اند، اصلا کار نمی‌کردند.
 *
 * موتور وب ترجیح دارد چون درخواست‌های پیام (Requests) را هم می‌بیند؛ مخاطب
 * «کلمه‌ی X را دایرکت کن» معمولا هنوز شما را فالو نمی‌کند و پیامش همان‌جاست.
 *
 * خط‌مبنا: بار اول فقط زمان را ثبت می‌کند. وگرنه با روشن‌شدن اپ به تمام
 * دایرکت‌های قدیمی که کلیدواژه داشتند یک‌جا جواب می‌رفت.
 */
export interface InboxPollResult {
  ok: boolean
  handled: number
  message: string
  /** از کدام راه خوانده شد — برای عیب‌یابی */
  source?: 'web' | 'graph'
  conversations?: number
}

interface InboxState {
  /** بزرگ‌ترین زمان پیامی که دیده‌ایم — به ساعت *سرور اینستاگرام*، نه ساعت این کامپیوتر */
  cursor: number
  /** شناسه‌ی پیام‌های پردازش‌شده‌ی اخیر، برای همپوشانی بی‌خطر */
  seen: string[]
}

/** پنجره‌ی همپوشانی: کمی عقب‌تر از آخرین پیام را دوباره می‌خوانیم تا چیزی جا نماند */
const INBOX_OVERLAP_MS = 2 * 60 * 1000
const INBOX_SEEN_MAX = 400
const INBOX_MAX_PER_TICK = 60

/**
 * خط‌مبنا و نشانگر از *زمان پیام‌ها* ساخته می‌شوند، نه از Date.now().
 *
 * نسخه‌ی قبل خط‌مبنا را با ساعت همین کامپیوتر می‌ساخت. اگر ساعت ویندوز حتی
 * چند دقیقه جلو باشد، هر دایرکت تازه «قدیمی‌تر از خط‌مبنا» دیده می‌شد و بی‌صدا
 * کنار می‌رفت — دقیقا علامت «دایرکت می‌دهم ولی اپ هیچ پیامی نمی‌بیند». حالا
 * فقط زمان‌های خود اینستاگرام مقایسه می‌شوند و تکرار با شناسه‌ی پیام مهار
 * می‌شود (الگوی chatmany).
 */
export async function pollInbox(accountId: number): Promise<InboxPollResult> {
  const e = engines()
  const hasWeb = e.web.isConnected(accountId)
  const hasGraph = e.graph.isConnected(accountId)
  if (!hasWeb && !hasGraph) return { ok: false, handled: 0, message: 'هیچ اتصالی برای خواندن دایرکت نیست' }

  // اول وب (درخواست‌های پیام را هم می‌بیند)، اگر نشد API رسمی
  let source: 'web' | 'graph' = hasWeb ? 'web' : 'graph'
  let convs
  try {
    convs = hasWeb ? await e.web.listConversations(accountId) : await e.graph.listConversations(accountId)
  } catch (err) {
    if (!(hasWeb && hasGraph)) throw err
    logRepo.add({
      account_id: accountId,
      level: 'info',
      category: 'dm',
      message: 'خواندن دایرکت از راه وب نشد، از API رسمی خوانده شد',
      meta: { error: (err as Error).message }
    })
    source = 'graph'
    convs = await e.graph.listConversations(accountId)
  }

  const key = 'inbox:' + accountId
  const state = settingsRepo.get<InboxState | null>(key, null)
  const all = incomingFrom(convs, 0)

  if (!state) {
    settingsRepo.set(key, {
      cursor: all.reduce((m, d) => Math.max(m, d.timestamp), 0),
      seen: all.map((d) => d.message_id).slice(-INBOX_SEEN_MAX)
    } satisfies InboxState)
    return {
      ok: true,
      handled: 0,
      source,
      conversations: convs.length,
      message:
        'خط‌مبنا ثبت شد (' + convs.length + ' گفت‌وگو). از این لحظه دایرکت‌های تازه جواب می‌گیرند.' +
        (source === 'graph' && convs.length === 0 ? ' ' + EMPTY_GRAPH_HINT : '')
    }
  }

  const seen = new Set(state.seen)
  const fresh = all
    .filter((d) => d.timestamp >= state.cursor - INBOX_OVERLAP_MS && !seen.has(d.message_id))
    .slice(0, INBOX_MAX_PER_TICK)

  let handled = 0
  let cursor = state.cursor
  try {
    for (const dm of fresh) {
      cursor = Math.max(cursor, dm.timestamp)
      seen.add(dm.message_id)
      // یک پیام خراب نباید بقیه را متوقف کند
      let r: { handled: boolean; reason: string }
      try {
        r = await handleIncomingDm({
          accountId,
          fromUserId: dm.from_user_id,
          fromUsername: dm.from_username,
          text: dm.text,
          messageId: dm.message_id,
          idSource: source
        })
      } catch (err) {
        r = { handled: false, reason: 'خطا: ' + (err as Error).message }
      }
      if (r.handled) handled++
      logRepo.add({
        account_id: accountId,
        level: r.handled ? 'success' : 'info',
        category: 'dm',
        message:
          'دایرکت از @' + (dm.from_username ?? dm.from_user_id) + ': «' + dm.text.slice(0, 60) + '» → ' + r.reason
      })
    }
  } finally {
    // همیشه ذخیره، حتی اگر وسط کار چیزی بشکند — نشانگرِ گیرکرده یعنی قطعی دائمی
    settingsRepo.set(key, { cursor, seen: [...seen].slice(-INBOX_SEEN_MAX) } satisfies InboxState)
  }

  return {
    ok: true,
    handled,
    source,
    conversations: convs.length,
    message:
      (source === 'web' ? 'راه وب' : 'API رسمی') + ': ' + convs.length + ' گفت‌وگو، ' +
      fresh.length + ' دایرکت تازه، ' + handled + ' قانون فعال شد' +
      (source === 'graph' && convs.length === 0 ? ' — ' + EMPTY_GRAPH_HINT : '')
  }
}

const EMPTY_GRAPH_HINT =
  'API رسمی هیچ گفت‌وگویی برنگرداند. اگر اپ متا هنوز «Unpublished» است، متا لیست خالی می‌دهد — در داشبورد متا Publish را بزنید.'

/* ══════════════════════════ زمان‌بند ══════════════════════════ */

export interface PollerIntervals {
  inboxMs: number
  commentsMs: number
  mediaMs: number
  followersMs: number
}

const DEFAULT_INTERVALS: PollerIntervals = {
  inboxMs: 90 * 1000, // هر ۹۰ ثانیه — دایرکت باید سریع جواب بگیرد
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
        void forEachAccount('خواندن دایرکت‌ها', (id) => pollInbox(id))
      }, iv.inboxMs)
    )
    this.timers.push(
      setInterval(() => {
        void forEachAccount('نظرسنجی کامنت', (id) => pollComments(id))
      }, iv.commentsMs)
    )

    // دور اول را منتظر اولین تیک نمی‌مانیم: فالوورها هر ساعت تیک می‌خورند، پس
    // بدون این، تا یک ساعت بعد از باز کردن اپ لیست مخاطبان خالی بود و ارسال
    // گروهی «گیرنده‌ای پیدا نشد» می‌داد. با فاصله اجرا می‌شوند تا هم‌زمان نباشند.
    const kickoff: [number, string, (id: number) => Promise<unknown>][] = [
      [10_000, 'خواندن دایرکت‌ها', (id) => pollInbox(id)],
      [20_000, 'همگام‌سازی پست‌ها', (id) => pollMedia(id)],
      [40_000, 'همگام‌سازی فالوورها', (id) => pollFollowers(id)],
      [60_000, 'نظرسنجی کامنت', (id) => pollComments(id)]
    ]
    for (const [delay, label, fn] of kickoff) {
      this.timers.push(setTimeout(() => void forEachAccount(label, fn), delay))
    }
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
    for (const t of this.timers) {
      clearInterval(t)
      clearTimeout(t)
    }
    this.timers = []
    this.running = false
  }

  get isRunning(): boolean {
    return this.running
  }
}

export const pollerScheduler = new PollerScheduler()
