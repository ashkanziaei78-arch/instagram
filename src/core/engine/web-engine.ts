import type { Capability, EngineKind } from '../../shared/types'
import { logRepo } from '../db/repos'
import {
  AuthError,
  RateLimitError,
  UnsupportedCapabilityError,
  type IEngine,
  type IgComment,
  type IgInsights,
  type IgMedia,
  type IgProfile,
  type IgUser,
  type SendDmOptions
} from './types'

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  موتور وب — مسیر «ورود ساده»
 * ═══════════════════════════════════════════════════════════════════════
 *
 * این موتور دقیقاً همان درخواست‌هایی را می‌زند که مرورگر شما هنگام استفاده از
 * instagram.com می‌زند، با همان کوکی‌هایی که خودتان در پنجره‌ی ورود ساختید.
 *
 * چرا این موتور لازم شد (و چرا فقط تزریق کوکی به instagram-private-api کافی نبود):
 * آن کتابخانه خودش را به‌جای اپ موبایل جا می‌زند و نسخه‌ی اپی را اعلام می‌کند که
 * سال‌هاست قدیمی شده. اینستاگرام حالا جواب می‌دهد:
 *     «Your version of Instagram is out of date»
 * و درخواست را رد می‌کند. API وب چنین چکی ندارد، چون مرورگرها نسخه‌ی اپ ندارند.
 *
 * صداقت درباره‌ی پایداری: این اندپوینت‌ها عمومی مستند نیستند. اینستاگرام
 * می‌تواند هر زمان تغییرشان دهد. هر متد این کلاس خطای خوانا می‌دهد تا وقتی
 * چیزی شکست، در صفحه‌ی «فعالیت و صف» دقیقاً معلوم باشد کدام قسمت.
 */

/** شناسه‌ی اپ وب اینستاگرام — ثابت و عمومی، در هر درخواست مرورگر هست */
const WEB_APP_ID = '936619743392459'
const BASE = 'https://www.instagram.com'

export interface WebSessionData {
  cookies: Record<string, string>
  userAgent: string
}

/** ذخیره‌گاه نشست وب (همان انبار رمزنگاری‌شده‌ی main) */
export interface WebSessionStore {
  load(accountId: number): string | null
  save(accountId: number, serialized: string): void
  clear(accountId: number): void
}

export class WebEngine implements IEngine {
  readonly kind: EngineKind = 'session'

  readonly capabilities: Capability[] = [
    'read_comments',
    'reply_comment_public',
    'send_dm_open_window',
    'send_dm_cold',
    'list_followers',
    'list_following',
    'detect_new_followers',
    'read_media'
  ]

  private sessions = new Map<number, WebSessionData>()

  constructor(private readonly store: WebSessionStore) {}

  can(cap: Capability): boolean {
    return this.capabilities.includes(cap)
  }

  isConnected(accountId: number): boolean {
    return this.sessions.has(accountId) || this.store.load(accountId) !== null
  }

  attach(accountId: number, data: WebSessionData): void {
    this.sessions.set(accountId, data)
    this.store.save(accountId, JSON.stringify(data))
  }

  detach(accountId: number): void {
    this.sessions.delete(accountId)
    this.store.clear(accountId)
  }

  private session(accountId: number): WebSessionData {
    const cached = this.sessions.get(accountId)
    if (cached) return cached

    const raw = this.store.load(accountId)
    if (!raw) throw new AuthError('نشستی برای این حساب ذخیره نشده — دوباره وارد شوید')

    try {
      const data = JSON.parse(raw) as WebSessionData
      if (!data.cookies?.sessionid) throw new Error('sessionid ندارد')
      this.sessions.set(accountId, data)
      return data
    } catch {
      throw new AuthError('نشست ذخیره‌شده خراب است — دوباره وارد شوید')
    }
  }

  private cookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .filter(([, v]) => typeof v === 'string' && v.length > 0)
      .map(([k, v]) => k + '=' + v)
      .join('; ')
  }

  /**
   * درخواست به API وب با هدرهای یک مرورگر واقعی.
   *
   * هدرهایی که نبودشان باعث ۴۰۱/۴۰۳ می‌شود و اشتباه به «نشست منقضی» تعبیر
   * می‌شود: X-IG-App-ID (بدون آن API اصلاً جواب نمی‌دهد) و برای نوشتن،
   * X-CSRFToken که باید دقیقاً با کوکی csrftoken یکی باشد.
   */
  private async request<T>(
    accountId: number,
    path: string,
    opts: {
      method?: 'GET' | 'POST'
      query?: Record<string, string>
      form?: Record<string, string>
      context: string
    }
  ): Promise<T> {
    const s = this.session(accountId)
    const url = new URL(path.startsWith('http') ? path : BASE + path)
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)

    const headers: Record<string, string> = {
      'User-Agent': s.userAgent,
      'X-IG-App-ID': WEB_APP_ID,
      'X-Requested-With': 'XMLHttpRequest',
      'X-ASBD-ID': '129477',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: BASE + '/',
      Origin: BASE,
      Cookie: this.cookieHeader(s.cookies)
    }
    if (s.cookies.csrftoken) headers['X-CSRFToken'] = s.cookies.csrftoken

    let body: string | undefined
    if (opts.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(opts.form).toString()
    }

    let res: Response
    try {
      res = await fetch(url.toString(), { method: opts.method ?? 'GET', headers, body })
    } catch (e) {
      throw new Error(opts.context + ': خطای شبکه (' + (e as Error).message + ')')
    }

    const text = await res.text()

    if (res.status === 401 || res.status === 403) {
      // اینستاگرام گاهی برای نشست منقضی و گاهی برای اکشن مسدودشده ۴۰۳ می‌دهد
      if (/login_required|checkpoint_required/i.test(text)) {
        throw new AuthError(
          opts.context + ': نشست منقضی شده یا اینستاگرام تأیید هویت می‌خواهد — دوباره وارد شوید'
        )
      }
      throw new AuthError(opts.context + ': دسترسی رد شد (' + res.status + ')')
    }
    if (res.status === 429) {
      throw new RateLimitError(opts.context + ': اینستاگرام درخواست‌ها را محدود کرد (429)')
    }
    if (/feedback_required|spam/i.test(text)) {
      throw new RateLimitError(
        opts.context + ': اینستاگرام این اکشن را اسپم علامت زد — سقف‌ها را پایین بیاورید',
        60 * 60 * 1000
      )
    }
    if (!res.ok) {
      throw new Error(opts.context + ': پاسخ ' + res.status + ' — ' + text.slice(0, 200))
    }

    try {
      return JSON.parse(text) as T
    } catch {
      // وقتی نشست باطل است، اینستاگرام به‌جای JSON صفحه‌ی HTML لاگین می‌دهد
      if (/<!DOCTYPE html|<html/i.test(text)) {
        throw new AuthError(
          opts.context + ': اینستاگرام صفحه‌ی ورود را برگرداند — نشست معتبر نیست، دوباره وارد شوید'
        )
      }
      throw new Error(opts.context + ': پاسخ نامعتبر بود')
    }
  }

  /* ─────────────────────────── پروفایل ─────────────────────────── */

  /** تأیید نشست + گرفتن اطلاعات حساب. اولین کاری که بعد از ورود انجام می‌شود. */
  async verifyAndGetProfile(data: WebSessionData): Promise<IgProfile> {
    const pk = data.cookies.ds_user_id
    if (!pk) throw new AuthError('کوکی ds_user_id موجود نیست')

    // موقتاً روی یک شناسه‌ی ساختگی سوار می‌کنیم تا request بتواند نشست را بخواند
    const tempId = -1
    this.sessions.set(tempId, data)
    try {
      const d = await this.request<{
        user?: {
          pk?: string | number
          username?: string
          full_name?: string
          profile_pic_url?: string
          follower_count?: number
          following_count?: number
          media_count?: number
        }
      }>(tempId, '/api/v1/users/' + pk + '/info/', { context: 'تأیید نشست' })

      const u = d.user
      if (!u?.username) {
        throw new AuthError('اینستاگرام اطلاعات حساب را برنگرداند — نشست معتبر نیست')
      }

      return {
        ig_user_id: String(u.pk ?? pk),
        username: u.username,
        name: u.full_name,
        profile_picture_url: u.profile_pic_url,
        followers_count: u.follower_count ?? 0,
        follows_count: u.following_count ?? 0,
        media_count: u.media_count ?? 0
      }
    } finally {
      this.sessions.delete(tempId)
    }
  }

  async getProfile(accountId: number): Promise<IgProfile> {
    const s = this.session(accountId)
    return this.verifyAndGetProfile(s)
  }

  private pk(accountId: number): string {
    const pk = this.session(accountId).cookies.ds_user_id
    if (!pk) throw new AuthError('شناسه‌ی کاربر در نشست موجود نیست')
    return pk
  }

  /* ─────────────────────────── مدیا ─────────────────────────── */

  async listMedia(accountId: number, limit = 25): Promise<IgMedia[]> {
    const d = await this.request<{ items?: Record<string, any>[] }>(
      accountId,
      '/api/v1/feed/user/' + this.pk(accountId) + '/',
      { query: { count: String(Math.min(limit, 50)) }, context: 'دریافت پست‌ها' }
    )

    return (d.items ?? []).slice(0, limit).map((m) => ({
      media_id: String(m.pk ?? m.id),
      media_type:
        m.media_type === 2
          ? m.product_type === 'clips'
            ? 'REELS'
            : 'VIDEO'
          : m.carousel_media
            ? 'CAROUSEL_ALBUM'
            : 'IMAGE',
      caption: m.caption?.text,
      permalink: m.code ? 'https://www.instagram.com/p/' + m.code + '/' : undefined,
      thumbnail_url: m.image_versions2?.candidates?.[0]?.url,
      timestamp: (m.taken_at ?? 0) * 1000,
      like_count: m.like_count ?? 0,
      comments_count: m.comment_count ?? 0
    }))
  }

  /**
   * آمار از API وب محدود است: لایک، کامنت و پلی‌کانت هست، ریچ و سیو نیست.
   * ریچ و سیو فقط از Insights رسمی می‌آید — که به همین دلیل در README گفته شده
   * برای آنالیتیکس دقیق، حساب را با API رسمی هم وصل کنید.
   */
  async getMediaInsights(accountId: number, mediaId: string): Promise<IgInsights> {
    try {
      const d = await this.request<{ items?: Record<string, any>[] }>(
        accountId,
        '/api/v1/media/' + mediaId + '/info/',
        { context: 'دریافت آمار پست' }
      )
      const m = d.items?.[0] ?? {}
      return {
        likes: m.like_count ?? 0,
        comments: m.comment_count ?? 0,
        views: m.play_count ?? m.view_count ?? 0,
        reach: 0,
        saved: 0
      }
    } catch (e) {
      logRepo.add({
        account_id: accountId,
        level: 'warn',
        category: 'insights',
        message: 'آمار پست ' + mediaId + ' در دسترس نبود',
        meta: { error: (e as Error).message }
      })
      return {}
    }
  }

  /* ─────────────────────────── کامنت‌ها ─────────────────────────── */

  async listComments(accountId: number, mediaId: string, limit = 50): Promise<IgComment[]> {
    const d = await this.request<{ comments?: Record<string, any>[] }>(
      accountId,
      '/api/v1/media/' + mediaId + '/comments/',
      { query: { can_support_threading: 'true', permalink_enabled: 'false' }, context: 'دریافت کامنت‌ها' }
    )

    return (d.comments ?? []).slice(0, limit).map((c) => ({
      comment_id: String(c.pk),
      media_id: mediaId,
      text: c.text ?? '',
      from_user_id: String(c.user?.pk ?? ''),
      from_username: c.user?.username,
      timestamp: (c.created_at ?? 0) * 1000
    }))
  }

  /**
   * پاسخ عمومی به کامنت.
   * API وب برای این کار شناسه‌ی پست را لازم دارد، نه فقط شناسه‌ی کامنت — پس
   * فراخوان باید mediaId را در قالب «mediaId:commentId» بدهد. این را
   * EngineManager هنگام ساخت کار در صف مدیریت می‌کند.
   */
  async replyToCommentPublic(accountId: number, commentRef: string, text: string): Promise<void> {
    const [mediaId, commentId] = commentRef.includes(':')
      ? commentRef.split(':')
      : [null, commentRef]

    if (!mediaId) {
      throw new UnsupportedCapabilityError(
        'reply_comment_public',
        'session',
        'برای پاسخ به کامنت در موتور وب، شناسه‌ی پست هم لازم است. پست‌ها را یک بار همگام کنید تا این اطلاعات ذخیره شود.'
      )
    }

    await this.request(accountId, '/api/v1/web/comments/' + mediaId + '/add/', {
      method: 'POST',
      form: { comment_text: text, replied_to_comment_id: commentId },
      context: 'پاسخ به کامنت'
    })
  }

  async replyToCommentPrivate(): Promise<void> {
    throw new UnsupportedCapabilityError(
      'reply_comment_private',
      'session',
      'پاسخ خصوصی به کامنت فقط در API رسمی وجود دارد. موتور وب به‌جایش دایرکت مستقیم می‌فرستد.'
    )
  }

  /* ─────────────────────────── دایرکت ─────────────────────────── */

  async sendDm(accountId: number, recipientIgId: string, text: string, opts?: SendDmOptions): Promise<void> {
    const send = async (message: string): Promise<void> => {
      await this.request(accountId, '/api/v1/direct_v2/threads/broadcast/text/', {
        method: 'POST',
        form: {
          recipient_users: '[[' + recipientIgId + ']]',
          action: 'send_item',
          client_context: crypto.randomUUID(),
          text: message
        },
        context: 'ارسال دایرکت'
      })
    }

    await send(text)

    // دکمه در دایرکت اینستاگرام وجود ندارد؛ لینک‌ها را به‌صورت پیام دوم می‌فرستیم
    if (opts?.buttons && opts.buttons.length > 0) {
      const links = opts.buttons.map((b) => b.title + ': ' + b.url).join('\n')
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000))
      await send(links)
    }
  }

  /* ─────────────────────────── فالوورها ─────────────────────────── */

  /**
   * صفحه‌بندی فالوورها.
   *
   * تأخیر بین صفحه‌ها عمدی است: گرفتن ۵۰۰۰ فالوور یعنی ۱۰۰ درخواست پشت‌سرهم و
   * همین الگو خودش feedback_required می‌آورد. اگر وسط کار محدود شدیم، هرچه
   * گرفته‌ایم را برمی‌گردانیم تا کار نصفه هدر نرود.
   */
  private async collect(
    accountId: number,
    kind: 'followers' | 'following',
    limit: number
  ): Promise<IgUser[]> {
    const out: IgUser[] = []
    let maxId: string | undefined
    const label = kind === 'followers' ? 'دریافت فالوورها' : 'دریافت فالووینگ'

    for (let page = 0; page < 200 && out.length < limit; page++) {
      const query: Record<string, string> = { count: '50' }
      if (maxId) query.max_id = maxId

      let d: { users?: Record<string, any>[]; next_max_id?: string | number }
      try {
        d = await this.request(accountId, '/api/v1/friendships/' + this.pk(accountId) + '/' + kind + '/', {
          query,
          context: label
        })
      } catch (e) {
        if (out.length > 0) {
          logRepo.add({
            account_id: accountId,
            level: 'warn',
            category: 'web-engine',
            message: label + ': صفحه‌بندی نیمه‌کاره ماند، ' + out.length + ' مورد برگردانده شد',
            meta: { error: (e as Error).message }
          })
          return out
        }
        throw e
      }

      for (const u of d.users ?? []) {
        out.push({
          ig_user_id: String(u.pk ?? u.pk_id),
          username: u.username,
          full_name: u.full_name,
          profile_pic: u.profile_pic_url,
          is_private: !!u.is_private,
          is_verified: !!u.is_verified
        })
        if (out.length >= limit) return out
      }

      if (!d.next_max_id) break
      maxId = String(d.next_max_id)
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500))
    }

    return out
  }

  async listFollowers(accountId: number, limit = 5000): Promise<IgUser[]> {
    return this.collect(accountId, 'followers', limit)
  }

  async listFollowing(accountId: number, limit = 5000): Promise<IgUser[]> {
    return this.collect(accountId, 'following', limit)
  }

  /** جستجوی نام کاربری → شناسه */
  async resolveUsername(accountId: number, username: string): Promise<IgUser | null> {
    try {
      const d = await this.request<{ data?: { user?: Record<string, any> } }>(
        accountId,
        '/api/v1/users/web_profile_info/',
        { query: { username: username.replace(/^@/, '') }, context: 'جستجوی کاربر' }
      )
      const u = d.data?.user
      if (!u) return null
      return {
        ig_user_id: String(u.id ?? u.pk),
        username: u.username,
        full_name: u.full_name,
        profile_pic: u.profile_pic_url,
        is_private: !!u.is_private,
        is_verified: !!u.is_verified
      }
    } catch {
      return null
    }
  }
}
