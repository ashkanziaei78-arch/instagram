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

/**
 * از کدام مسیر آمده. هر دو در نهایت همان کوکی‌ها را می‌دهند و از نظر موتور
 * فرقی ندارند — ولی جدا نگه‌داشتنشان یعنی کاربر می‌تواند *هر دو* را وصل کند و
 * اگر یکی باطل شد، موتور بی‌سروصدا سراغ دیگری برود.
 */
export type WebOrigin = 'window' | 'sessionid'

/** ترتیب ترجیح وقتی هر دو موجودند. پنجره تازه‌تر است، پس اول امتحان می‌شود. */
const ORIGIN_ORDER: WebOrigin[] = ['window', 'sessionid']

export interface WebSessionData {
  cookies: Record<string, string>
  userAgent: string
  /** نشست‌های ذخیره‌شده‌ی قدیمی این فیلد را ندارند، پس اختیاری است */
  origin?: WebOrigin
}

/** ذخیره‌گاه نشست وب (همان انبار رمزنگاری‌شده‌ی main) */
export interface WebSessionStore {
  load(accountId: number, origin: WebOrigin): string | null
  save(accountId: number, origin: WebOrigin, serialized: string): void
  /** بدون origin یعنی همه‌ی نشست‌های این حساب */
  clear(accountId: number, origin?: WebOrigin): void
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

  /** نشست‌های زنده: برای هر حساب، حداکثر یکی به ازای هر مسیر اتصال */
  private sessions = new Map<number, Map<WebOrigin, WebSessionData>>()
  /** مسیری که آخرین بار جواب داد — دفعه‌ی بعد از همان شروع می‌کنیم */
  private preferred = new Map<number, WebOrigin>()
  /** کش نام کاربری — برای اندپوینت‌هایی که با نام کار می‌کنند نه شناسه */
  private usernames = new Map<number, string>()

  constructor(private readonly store: WebSessionStore) {}

  can(cap: Capability): boolean {
    return this.capabilities.includes(cap)
  }

  isConnected(accountId: number): boolean {
    return this.connectedOrigins(accountId).length > 0
  }

  /**
   * کدام مسیرهای اتصال برای این حساب زنده‌اند — بدون پرت‌کردن خطا، چون UI این
   * را در هر رندر صدا می‌زند و نبودِ نشست حالت عادی است نه خطا.
   */
  connectedOrigins(accountId: number): WebOrigin[] {
    return ORIGIN_ORDER.filter((o) => this.tryLoad(accountId, o) !== null)
  }

  attach(accountId: number, data: WebSessionData): void {
    const origin = data.origin ?? 'window'
    const stored: WebSessionData = { ...data, origin }

    const slots = this.sessions.get(accountId) ?? new Map<WebOrigin, WebSessionData>()
    slots.set(origin, stored)
    this.sessions.set(accountId, slots)
    // تازه‌ترین اتصال، ترجیح بعدی است — کاربر همین الان آن را تأیید کرده
    this.preferred.set(accountId, origin)
    this.store.save(accountId, origin, JSON.stringify(stored))
  }

  /** بدون origin یعنی قطع کامل حساب؛ با origin فقط همان یک مسیر */
  detach(accountId: number, origin?: WebOrigin): void {
    if (!origin) {
      this.sessions.delete(accountId)
      this.preferred.delete(accountId)
      this.store.clear(accountId)
      return
    }
    this.sessions.get(accountId)?.delete(origin)
    if (this.preferred.get(accountId) === origin) this.preferred.delete(accountId)
    this.store.clear(accountId, origin)
  }

  /** خواندن یک اسلات از کش یا انبار. نشست خراب = انگار وجود ندارد. */
  private tryLoad(accountId: number, origin: WebOrigin): WebSessionData | null {
    const cached = this.sessions.get(accountId)?.get(origin)
    if (cached) return cached

    const raw = this.store.load(accountId, origin)
    if (!raw) return null

    try {
      const data = JSON.parse(raw) as WebSessionData
      if (!data.cookies?.sessionid) return null
      const slots = this.sessions.get(accountId) ?? new Map<WebOrigin, WebSessionData>()
      slots.set(origin, { ...data, origin })
      this.sessions.set(accountId, slots)
      return slots.get(origin)!
    } catch {
      return null
    }
  }

  /**
   * مسیرهایی که باید امتحان شوند، به ترتیب: اول آنکه آخرین بار جواب داد.
   *
   * چرا ترتیب مهم است: هر درخواست اضافه به اینستاگرام هزینه‌ی سهمیه دارد. با
   * چسبیدن به مسیری که کار می‌کند، نشست باطل فقط *یک بار* امتحان می‌شود نه در
   * هر فراخوانی.
   */
  /** این مسیر جواب نداد — اگر مسیر دیگری هست، ترجیح را به آن بده */
  private demote(accountId: number, origin: WebOrigin): void {
    const other = this.connectedOrigins(accountId).find((o) => o !== origin)
    if (other) this.preferred.set(accountId, other)
  }

  private candidates(accountId: number): WebOrigin[] {
    const live = this.connectedOrigins(accountId)
    const pref = this.preferred.get(accountId)
    if (pref && live.includes(pref)) return [pref, ...live.filter((o) => o !== pref)]
    return live
  }

  private session(accountId: number, origin: WebOrigin): WebSessionData {
    const data = this.tryLoad(accountId, origin)
    if (!data) throw new AuthError('نشستی برای این حساب ذخیره نشده — دوباره وارد شوید')
    return data
  }

  /** نشست ترجیحی — برای جاهایی که فقط به محتوای کوکی نیاز است، نه به درخواست */
  private activeSession(accountId: number): WebSessionData {
    const [first] = this.candidates(accountId)
    if (!first) throw new AuthError('نشستی برای این حساب ذخیره نشده — دوباره وارد شوید')
    return this.session(accountId, first)
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
    const tries = this.candidates(accountId)
    if (tries.length === 0) {
      throw new AuthError('نشستی برای این حساب ذخیره نشده — دوباره وارد شوید')
    }

    let lastAuthError: AuthError | null = null
    for (const origin of tries) {
      try {
        const out = await this.requestWith<T>(accountId, origin, path, opts)
        this.preferred.set(accountId, origin)
        return out
      } catch (e) {
        // فقط روی «نشست باطل» به مسیر بعدی می‌رویم. محدودیت نرخ یا خطای شبکه
        // با عوض‌کردن کوکی درست نمی‌شود و تلاش دوباره فقط سهمیه را می‌سوزاند.
        if (!(e instanceof AuthError)) throw e
        lastAuthError = e
        // اعتبارنامه را *پاک نمی‌کنیم*: یک ۴۰۱ گذرا نباید کاری کند که کاربر
        // مجبور به اتصال دوباره شود. فقط ترجیح را به مسیر دیگر می‌دهیم، پس
        // درخواست بعدی مستقیم سراغ همانی می‌رود که جواب داد.
        this.demote(accountId, origin)
      }
    }

    throw new AuthError(
      (lastAuthError?.message ?? opts.context + ': نشست معتبر نیست') +
        ' — هیچ‌کدام از روش‌های اتصال این حساب دیگر معتبر نیست، دوباره وصل شوید'
    )
  }

  private async requestWith<T>(
    accountId: number,
    origin: WebOrigin,
    path: string,
    opts: {
      method?: 'GET' | 'POST'
      query?: Record<string, string>
      form?: Record<string, string>
      context: string
    }
  ): Promise<T> {
    const s = this.session(accountId, origin)
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

    // اول تلاش می‌کنیم JSON را پارس کنیم، *بعد* درباره‌ی خطا قضاوت می‌کنیم.
    //
    // چرا این ترتیب مهم است: قبلا دنبال کلمه‌ی «spam» در متن خام می‌گشتیم. صفحه‌ی
    // HTML اینستاگرام این کلمه را جایی در اسکریپت‌هایش دارد، پس هر پاسخ HTML
    // به‌اشتباه «اینستاگرام اکشن شما را اسپم علامت زد» گزارش می‌شد — پیامی که
    // کاربر را به دنبال مشکلی می‌فرستاد که اصلا وجود نداشت.
    let parsed: Record<string, unknown> | null = null
    const looksLikeHtml = /^\s*(<!DOCTYPE|<html)/i.test(text)
    if (!looksLikeHtml) {
      try {
        parsed = JSON.parse(text) as Record<string, unknown>
      } catch {
        parsed = null
      }
    }

    const message = typeof parsed?.message === 'string' ? parsed.message : ''
    const isSpamFlag = message === 'feedback_required' || parsed?.spam === true
    const isLoginRequired = message === 'login_required' || message === 'checkpoint_required'

    if (isSpamFlag) {
      throw new RateLimitError(
        opts.context + ': اینستاگرام این اکشن را اسپم علامت زد — سقف‌ها را پایین بیاورید',
        60 * 60 * 1000
      )
    }
    if (res.status === 429) {
      throw new RateLimitError(opts.context + ': اینستاگرام درخواست‌ها را محدود کرد (429)')
    }
    if (isLoginRequired || res.status === 401) {
      throw new AuthError(opts.context + ': نشست معتبر نیست — دوباره وارد شوید')
    }
    if (res.status === 403) {
      throw new AuthError(
        opts.context + ': دسترسی رد شد (۴۰۳)' + (message ? ' — ' + message : '')
      )
    }

    // پاسخ HTML دو معنی کاملا متفاوت دارد و نباید یکسان رفتار کرد:
    //
    //  الف) اینستاگرام ما را به صفحه‌ی لاگین ریدایرکت کرده → نشست باطل است و
    //       تلاش دوباره بی‌فایده؛ باید AuthError بدهیم تا صف بی‌خود retry نکند.
    //  ب)  اندپوینت پاسخ HTML داده بدون ریدایرکت → احتمالا آدرس عوض شده یا
    //       مشکل موقتی است؛ خطای معمولی که قابل تلاش دوباره باشد.
    //
    // تشخیص را از res.redirected و res.url می‌گیریم، نه از حدس‌زدن محتوای HTML.
    if (looksLikeHtml) {
      const landedOnLogin = /\/accounts\/login/i.test(res.url ?? '')
      if (landedOnLogin) {
        throw new AuthError(
          opts.context + ': اینستاگرام به صفحه‌ی ورود هدایت کرد — نشست باطل است، دوباره وارد شوید'
        )
      }
      throw new Error(
        opts.context + ': به‌جای داده، صفحه‌ی وب برگشت (وضعیت ' + res.status + ')'
      )
    }

    if (!res.ok) {
      throw new Error(opts.context + ': پاسخ ' + res.status + ' — ' + text.slice(0, 160))
    }
    if (parsed === null) {
      throw new Error(opts.context + ': پاسخ قابل خواندن نبود — ' + text.slice(0, 160))
    }

    return parsed as T
  }

  /* ─────────────────────────── پروفایل ─────────────────────────── */

  /**
   * تأیید نشست + گرفتن اطلاعات حساب.
   *
   * چرا زنجیره‌ی چند اندپوینتی و نه یکی؟ اینستاگرام چند آدرس «من کی هستم» دارد
   * و کدامشان جواب می‌دهد به منطقه، نوع حساب و آزمایش‌های A/B بستگی دارد. با یک
   * آدرس، اگر آن یکی جواب ندهد کاربر پیام مبهم «نشست نامعتبر» می‌گیرد در حالی
   * که نشستش کاملا سالم است.
   *
   * اگر همه شکست خوردند، خطا *دقیقا* می‌گوید هر کدام چه جوابی داد — تا مشکل
   * قابل پیگیری باشد، نه یک بن‌بست.
   */
  async verifyAndGetProfile(data: WebSessionData): Promise<IgProfile> {
    const pk = data.cookies.ds_user_id
    if (!pk) {
      throw new AuthError('کوکی ds_user_id موجود نیست — ورود کامل نشده است')
    }

    // شناسه‌ی منفی یعنی «حساب موقت» — هنوز در دیتابیس ردیفی ندارد چون داریم
    // همین الان تأییدش می‌کنیم. در finally پاک می‌شود.
    const tempId = -1
    const tempOrigin: WebOrigin = data.origin ?? 'window'
    this.sessions.set(tempId, new Map([[tempOrigin, { ...data, origin: tempOrigin }]]))
    this.preferred.set(tempId, tempOrigin)
    const failures: string[] = []

    type UserShape = {
      pk?: string | number
      id?: string | number
      username?: string
      full_name?: string
      profile_pic_url?: string
      follower_count?: number
      following_count?: number
      media_count?: number
      edge_followed_by?: { count?: number }
      edge_follow?: { count?: number }
      edge_owner_to_timeline_media?: { count?: number }
    }

    const toProfile = (u: UserShape): IgProfile => ({
      ig_user_id: String(u.pk ?? u.id ?? pk),
      username: u.username!,
      name: u.full_name,
      profile_picture_url: u.profile_pic_url,
      followers_count: u.follower_count ?? u.edge_followed_by?.count ?? 0,
      follows_count: u.following_count ?? u.edge_follow?.count ?? 0,
      media_count: u.media_count ?? u.edge_owner_to_timeline_media?.count ?? 0
    })

    /** هر تلاش: اگر کاربرِ نام‌دار برگرداند موفق است، وگرنه دلیل را ثبت می‌کند */
    const attempt = async (
      label: string,
      fn: () => Promise<UserShape | null>
    ): Promise<IgProfile | null> => {
      try {
        const u = await fn()
        if (u?.username) return toProfile(u)
        failures.push(label + ': کاربری برنگرداند')
      } catch (e) {
        failures.push(label + ': ' + (e as Error).message.slice(0, 110))
      }
      return null
    }

    try {
      // ۱) میزبان وب — همان که مرورگر در صفحه‌ی پروفایل صدا می‌زند
      let p = await attempt('users/info (web)', async () => {
        const d = await this.request<{ user?: UserShape }>(
          tempId,
          '/api/v1/users/' + pk + '/info/',
          { context: 'تأیید نشست' }
        )
        return d.user ?? null
      })
      if (p) return p

      // ۲) میزبان موبایل — همان کوکی، آدرس متفاوت. اغلب وقتی وب جواب نمی‌دهد این می‌دهد.
      p = await attempt('users/info (i.instagram)', async () => {
        const d = await this.request<{ user?: UserShape }>(
          tempId,
          'https://i.instagram.com/api/v1/users/' + pk + '/info/',
          { context: 'تأیید نشست' }
        )
        return d.user ?? null
      })
      if (p) return p

      // ۳) فرم ویرایش پروفایل — اندپوینت «من کی هستم» که فقط با ورود کار می‌کند.
      //    نام کاربری می‌دهد ولی آمار نه، پس با ۴ کاملش می‌کنیم.
      const formUser = await attempt('accounts/edit', async () => {
        const d = await this.request<{ form_data?: { username?: string; first_name?: string } }>(
          tempId,
          '/api/v1/accounts/edit/web_form_data/',
          { context: 'تأیید نشست' }
        )
        const f = d.form_data
        return f?.username ? { username: f.username, full_name: f.first_name } : null
      })

      if (formUser) {
        // ۴) حالا که نام کاربری را داریم، آمار کامل را بگیریم (اگر نشد، همان کافی است)
        try {
          const d = await this.request<{ data?: { user?: UserShape } }>(
            tempId,
            '/api/v1/users/web_profile_info/',
            { query: { username: formUser.username }, context: 'تأیید نشست' }
          )
          const u = d.data?.user
          if (u?.username) return toProfile(u)
        } catch {
          /* آمار اختیاری است */
        }
        return formUser
      }

      throw new AuthError(
        'نشست تأیید نشد. اینستاگرام به هیچ‌کدام از آدرس‌ها پاسخ معتبر نداد:\n• ' +
          failures.join('\n• ')
      )
    } finally {
      this.sessions.delete(tempId)
      this.preferred.delete(tempId)
    }
  }

  async getProfile(accountId: number): Promise<IgProfile> {
    return this.verifyAndGetProfile(this.activeSession(accountId))
  }

  private pk(accountId: number): string {
    const pk = this.activeSession(accountId).cookies.ds_user_id
    if (!pk) throw new AuthError('شناسه‌ی کاربر در نشست موجود نیست')
    return pk
  }

  /* ─────────────────────────── مدیا ─────────────────────────── */

  /** تبدیل آیتم فید موبایل به شکل مشترک */
  private mapFeedItem(m: Record<string, any>): IgMedia {
    return {
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
    }
  }

  /** تبدیل نود گراف‌کیوال (شکل web_profile_info) به شکل مشترک */
  private mapGraphNode(n: Record<string, any>): IgMedia {
    const isVideo = !!n.is_video
    return {
      media_id: String(n.id ?? n.pk),
      media_type:
        n.__typename === 'GraphSidecar' || n.edge_sidecar_to_children
          ? 'CAROUSEL_ALBUM'
          : isVideo
            ? n.product_type === 'clips'
              ? 'REELS'
              : 'VIDEO'
            : 'IMAGE',
      caption: n.edge_media_to_caption?.edges?.[0]?.node?.text,
      permalink: n.shortcode ? 'https://www.instagram.com/p/' + n.shortcode + '/' : undefined,
      thumbnail_url: n.thumbnail_src ?? n.display_url,
      timestamp: (n.taken_at_timestamp ?? 0) * 1000,
      like_count: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? 0,
      comments_count: n.edge_media_to_comment?.count ?? 0
    }
  }

  /**
   * فهرست پست‌ها.
   *
   * چرا زنجیره‌ای: آدرس «/api/v1/feed/user/{id}/» روی میزبان وب وجود ندارد و
   * اینستاگرام به‌جای داده، صفحه‌ی HTML برمی‌گرداند — دقیقا خطایی که کاربر دید
   * («به‌جای داده، صفحه‌ی وب برگشت») در حالی که همگام‌سازی فالوورها سالم بود.
   * مسیر مطمئن برای وب، web_profile_info است که پست‌ها را داخل
   * edge_owner_to_timeline_media می‌دهد.
   */
  async listMedia(accountId: number, limit = 25): Promise<IgMedia[]> {
    const pk = this.pk(accountId)
    const failures: string[] = []

    const attempt = async (label: string, fn: () => Promise<IgMedia[]>): Promise<IgMedia[] | null> => {
      try {
        const items = await fn()
        if (items.length > 0) return items
        // پاسخ درست ولی خالی: حساب واقعا پستی ندارد — این شکست نیست
        failures.push(label + ': پستی برنگرداند')
        return items
      } catch (e) {
        // نشست باطل یا محدودیت نرخ ربطی به *آدرس* ندارد — امتحان آدرس بعدی
        // نه کمکی می‌کند و نه بی‌هزینه است. مهم‌تر: اگر این‌ها را ببلعیم، کاربر
        // به‌جای «دوباره وارد شوید» یک خطای مبهم درباره‌ی آدرس‌ها می‌بیند و صف
        // هم بی‌خود دوباره تلاش می‌کند.
        if (e instanceof AuthError || e instanceof RateLimitError) throw e
        failures.push(label + ': ' + (e as Error).message.slice(0, 110))
        return null
      }
    }

    // ۱) web_profile_info — مسیر اصلی وب. نام کاربری لازم دارد.
    const username = await this.username(accountId).catch(() => null)
    if (username) {
      const r = await attempt('web_profile_info', async () => {
        const d = await this.request<{
          data?: { user?: { edge_owner_to_timeline_media?: { edges?: { node: Record<string, any> }[] } } }
        }>(accountId, '/api/v1/users/web_profile_info/', {
          query: { username },
          context: 'دریافت پست‌ها'
        })
        const edges = d.data?.user?.edge_owner_to_timeline_media?.edges ?? []
        return edges.slice(0, limit).map((e) => this.mapGraphNode(e.node))
      })
      if (r && r.length > 0) return r
    }

    // ۲) میزبان موبایل — همان کوکی، آدرسی که آنجا واقعا وجود دارد
    const r2 = await attempt('feed/user (i.instagram)', async () => {
      const d = await this.request<{ items?: Record<string, any>[] }>(
        accountId,
        'https://i.instagram.com/api/v1/feed/user/' + pk + '/',
        { query: { count: String(Math.min(limit, 50)) }, context: 'دریافت پست‌ها' }
      )
      return (d.items ?? []).slice(0, limit).map((m) => this.mapFeedItem(m))
    })
    if (r2 && r2.length > 0) return r2

    // ۳) میزبان وب — برای کامل‌بودن؛ معمولا HTML می‌دهد ولی رایگان است
    const r3 = await attempt('feed/user (web)', async () => {
      const d = await this.request<{ items?: Record<string, any>[] }>(
        accountId,
        '/api/v1/feed/user/' + pk + '/',
        { query: { count: String(Math.min(limit, 50)) }, context: 'دریافت پست‌ها' }
      )
      return (d.items ?? []).slice(0, limit).map((m) => this.mapFeedItem(m))
    })
    if (r3) return r3

    throw new Error(
      'دریافت پست‌ها با هیچ‌کدام از آدرس‌ها ممکن نشد:\n• ' + failures.join('\n• ')
    )
  }

  /** نام کاربری حساب (برای اندپوینت‌هایی که با نام کار می‌کنند) */
  private async username(accountId: number): Promise<string> {
    const cached = this.usernames.get(accountId)
    if (cached) return cached
    const p = await this.getProfile(accountId)
    this.usernames.set(accountId, p.username)
    return p.username
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
    const toComment = (c: Record<string, any>): IgComment => ({
      comment_id: String(c.pk),
      media_id: mediaId,
      text: c.text ?? '',
      from_user_id: String(c.user?.pk ?? ''),
      from_username: c.user?.username,
      timestamp: (c.created_at ?? 0) * 1000
    })

    const query = { can_support_threading: 'true', permalink_enabled: 'false' }

    // همان مشکل فهرست پست‌ها: بعضی آدرس‌ها فقط روی میزبان موبایل وجود دارند
    try {
      const d = await this.request<{ comments?: Record<string, any>[] }>(
        accountId,
        '/api/v1/media/' + mediaId + '/comments/',
        { query, context: 'دریافت کامنت‌ها' }
      )
      if (Array.isArray(d.comments)) return d.comments.slice(0, limit).map(toComment)
    } catch (e) {
      // اگر نشست باطل است، امتحان میزبان دوم بی‌فایده است
      if (e instanceof AuthError) throw e
    }

    const d2 = await this.request<{ comments?: Record<string, any>[] }>(
      accountId,
      'https://i.instagram.com/api/v1/media/' + mediaId + '/comments/',
      { query, context: 'دریافت کامنت‌ها' }
    )
    return (d2.comments ?? []).slice(0, limit).map(toComment)
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
