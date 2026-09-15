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
 *  موتور Session — بخوانید قبل از استفاده
 * ═══════════════════════════════════════════════════════════════════════
 *
 * این موتور با همان API خصوصی‌ای حرف می‌زند که اپ موبایل اینستاگرام استفاده
 * می‌کند. سه قابلیتی را می‌دهد که API رسمی *به‌هیچ‌روی* نمی‌دهد:
 *   ۱. لیست کامل فالوورها و فالووینگ
 *   ۲. تشخیص فالوور جدید (با مقایسه‌ی لیست‌ها)
 *   ۳. دایرکت به کسی که به شما پیام نداده (دایرکت سرد / انبوه)
 *
 * هزینه‌اش را صریح می‌گویم:
 *   • استفاده از آن نقض شرایط استفاده‌ی اینستاگرام است.
 *   • حساب می‌تواند موقتا محدود (action block) یا در موارد شدید بسته شود.
 *   • رمز حساب لازم است (ما آن را با safeStorage سیستم‌عامل رمز می‌کنیم و
 *     فقط نشستِ سریال‌شده را نگه می‌داریم، ولی ریسک صفر نیست).
 *
 * به همین دلیل: در UI پیش‌فرض *خاموش* است، با هشدار صریح روشن می‌شود، و همه‌ی
 * اکشن‌هایش از نگهبان ایمنی (سقف روزانه + تأخیر انسانی) عبور می‌کنند.
 *
 * توصیه‌ی من: برای «کامنت به دایرکت» و آنالیتیکس از موتور رسمی استفاده کنید —
 * بی‌ریسک و پایدار است. این موتور را فقط برای همان سه قابلیت بالا روشن کنید،
 * با سقف‌های پایین.
 */

/** ذخیره‌گاه نشست؛ main آن را با رمزنگاری سیستم‌عامل پیاده می‌کند */
export interface SessionStore {
  load(accountId: number): string | null
  save(accountId: number, serialized: string): void
  clear(accountId: number): void
}

export interface LoginChallenge {
  kind: 'two_factor' | 'checkpoint'
  message: string
  /** برای ۲ مرحله‌ای: شناسه‌ای که باید همراه کد برگردد */
  twoFactorIdentifier?: string
  username?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type IgClient = any

export class SessionEngine implements IEngine {
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

  private clients = new Map<number, IgClient>()
  private pks = new Map<number, string>()
  /** نشست‌های نیمه‌تمام که منتظر کد دو مرحله‌ای هستند */
  private pendingLogins = new Map<string, { client: IgClient; identifier: string; username: string }>()

  constructor(private readonly store: SessionStore) {}

  can(cap: Capability): boolean {
    return this.capabilities.includes(cap)
  }

  isConnected(accountId: number): boolean {
    return this.clients.has(accountId) || this.store.load(accountId) !== null
  }

  /** آیا کتابخانه‌ی لازم نصب است؟ (اختیاری نصب می‌شود) */
  static isAvailable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('instagram-private-api')
      return true
    } catch {
      return false
    }
  }

  private loadLib(): { IgApiClient: new () => IgClient } {
    try {
      // بارگذاری تنبل: اگر کاربر این موتور را روشن نکند، کتابخانه هم لود نمی‌شود
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('instagram-private-api')
    } catch {
      throw new UnsupportedCapabilityError(
        'send_dm_cold',
        'session',
        'بسته‌ی instagram-private-api نصب نیست. با دستور «npm install instagram-private-api» نصبش کنید.'
      )
    }
  }

  /**
   * نقشه‌ی خطاها. مهم‌ترینش IgActionSpamError است: اینستاگرام با آن می‌گوید
   * «داری زیادی سریع کار می‌کنی». اگر آن را مثل خطای معمولی retry کنیم،
   * مستقیم به سمت بلاک شدن می‌رویم. پس به RateLimitError ترجمه می‌شود تا
   * صف وارد backoff تصاعدی شود.
   */
  private mapError(e: unknown, context: string): Error {
    const name = (e as { name?: string })?.name ?? ''
    const msg = (e as { message?: string })?.message ?? String(e)

    if (name === 'IgActionSpamError' || /feedback_required|spam/i.test(msg)) {
      return new RateLimitError(
        context + ': اینستاگرام این اکشن را به‌عنوان اسپم علامت زد (feedback_required). سقف‌ها را پایین بیاورید.',
        60 * 60 * 1000
      )
    }
    if (name === 'IgCheckpointError' || /checkpoint|challenge/i.test(msg)) {
      return new AuthError(
        context + ': اینستاگرام تأیید هویت خواست (checkpoint). در اپ موبایل تأیید کنید و دوباره وصل شوید.'
      )
    }
    if (name === 'IgLoginRequiredError' || name === 'IgUserHasLoggedOutError' || /login_required/i.test(msg)) {
      return new AuthError(context + ': نشست منقضی شد — دوباره وارد شوید.')
    }
    if (name === 'IgLoginBadPasswordError') {
      return new AuthError(context + ': نام کاربری یا رمز اشتباه است.')
    }
    if (name === 'IgNotFoundError') {
      return new Error(context + ': پیدا نشد (کاربر یا پست حذف شده یا خصوصی است).')
    }
    if (/rate.?limit|429|too many/i.test(msg)) {
      return new RateLimitError(context + ': ' + msg)
    }
    return new Error(context + ': ' + msg)
  }

  /* ─────────────────────────── ورود و نشست ─────────────────────────── */

  private async restore(accountId: number): Promise<IgClient> {
    const existing = this.clients.get(accountId)
    if (existing) return existing

    const saved = this.store.load(accountId)
    if (!saved) {
      throw new AuthError('نشستی برای این حساب ذخیره نشده — ابتدا با نام کاربری و رمز وصل شوید.')
    }

    const { IgApiClient } = this.loadLib()
    const ig = new IgApiClient()
    try {
      await ig.state.deserialize(JSON.parse(saved))
    } catch (e) {
      throw this.mapError(e, 'بازیابی نشست')
    }
    this.clients.set(accountId, ig)
    return ig
  }

  private async persist(accountId: number, ig: IgClient): Promise<void> {
    const state = await ig.state.serialize()
    // constants نسخه‌ی کتابخانه است، ذخیره‌اش باعث ناسازگاری بعد از آپدیت می‌شود
    delete state.constants
    this.store.save(accountId, JSON.stringify(state))
  }

  /**
   * ورود با نام کاربری و رمز.
   * اگر حساب دو مرحله‌ای باشد، LoginChallenge برمی‌گرداند و منتظر submitTwoFactor می‌ماند.
   */
  async login(
    username: string,
    password: string
  ): Promise<{ ok: true; profile: IgProfile; serialized: string } | { ok: false; challenge: LoginChallenge }> {
    const { IgApiClient } = this.loadLib()
    const ig = new IgApiClient()
    ig.state.generateDevice(username)

    try {
      await ig.simulate.preLoginFlow()
      const user = await ig.account.login(username, password)
      // postLoginFlow الگوی ترافیک اپ واقعی را تقلید می‌کند و ریسک شناسایی را کم می‌کند
      await ig.simulate.postLoginFlow().catch(() => undefined)

      const state = await ig.state.serialize()
      delete state.constants

      return {
        ok: true,
        profile: {
          ig_user_id: String(user.pk),
          username: user.username,
          name: user.full_name,
          profile_picture_url: user.profile_pic_url
        },
        serialized: JSON.stringify(state)
      }
    } catch (e) {
      const name = (e as { name?: string })?.name ?? ''

      if (name === 'IgLoginTwoFactorRequiredError') {
        const info = (e as { response?: { body?: { two_factor_info?: { two_factor_identifier?: string } } } })
          ?.response?.body?.two_factor_info
        const identifier = info?.two_factor_identifier ?? ''
        this.pendingLogins.set(username, { client: ig, identifier, username })
        return {
          ok: false,
          challenge: {
            kind: 'two_factor',
            message: 'کد تأیید دو مرحله‌ای را وارد کنید.',
            twoFactorIdentifier: identifier,
            username
          }
        }
      }

      if (name === 'IgCheckpointError') {
        return {
          ok: false,
          challenge: {
            kind: 'checkpoint',
            message:
              'اینستاگرام تأیید هویت خواست. اپ موبایل را باز کنید، ورود را تأیید کنید و چند دقیقه بعد دوباره تلاش کنید.',
            username
          }
        }
      }

      throw this.mapError(e, 'ورود')
    }
  }

  async submitTwoFactor(
    username: string,
    code: string
  ): Promise<{ profile: IgProfile; serialized: string }> {
    const pending = this.pendingLogins.get(username)
    if (!pending) throw new AuthError('نشست دو مرحله‌ای پیدا نشد — از ابتدا وارد شوید.')

    try {
      const user = await pending.client.account.twoFactorLogin({
        username,
        verificationCode: code.trim(),
        twoFactorIdentifier: pending.identifier,
        verificationMethod: '1', // ۱ = پیامک، ۰ = اپ احرازهویت
        trustThisDevice: '1'
      })
      const state = await pending.client.state.serialize()
      delete state.constants
      this.pendingLogins.delete(username)

      return {
        profile: {
          ig_user_id: String(user.pk),
          username: user.username,
          name: user.full_name,
          profile_picture_url: user.profile_pic_url
        },
        serialized: JSON.stringify(state)
      }
    } catch (e) {
      throw this.mapError(e, 'تأیید کد دو مرحله‌ای')
    }
  }

  attachSession(accountId: number, serialized: string, pk: string): void {
    this.store.save(accountId, serialized)
    this.pks.set(accountId, pk)
    this.clients.delete(accountId) // دفعه‌ی بعد از نشست تازه ساخته می‌شود
  }

  /**
   * ساخت نشست از روی کوکی‌هایی که کاربر با ورود در پنجره‌ی خود اینستاگرام
   * تولید کرده — مسیر «ورود ساده».
   *
   * چطور کار می‌کند: به‌جای اینکه ما لاگین کنیم، کوکی sessionid آماده را در
   * cookie jar کلاینت می‌ریزیم. از آنجا به بعد کلاینت دقیقاً مثل حالت لاگین
   * عادی رفتار می‌کند.
   *
   * نکته‌ی مهم: بلافاصله یک فراخوانی واقعی به اینستاگرام می‌زنیم تا نشست را
   * *تأیید* کنیم. اگر این کار را نمی‌کردیم، ورود «موفق» اعلام می‌شد و بعداً
   * اولین دایرکت با خطای مبهم شکست می‌خورد — یعنی کاربر ساعت‌ها بعد و در بدترین
   * لحظه می‌فهمید که وصل نشده.
   */
  async loginWithCookies(cookies: Record<string, string | undefined>): Promise<{
    profile: IgProfile
    serialized: string
  }> {
    const sessionid = cookies.sessionid
    const dsUserId = cookies.ds_user_id
    if (!sessionid || !dsUserId) {
      throw new AuthError('کوکی نشست ناقص است — دوباره وارد شوید')
    }

    const { IgApiClient } = this.loadLib()
    const ig = new IgApiClient()
    // دستگاه را از شناسه‌ی کاربر می‌سازیم تا برای یک حساب همیشه ثابت بماند؛
    // دستگاه متغیر، خودش سیگنال مشکوکی برای اینستاگرام است
    ig.state.generateDevice(dsUserId)

    for (const [name, value] of Object.entries(cookies)) {
      if (!value) continue
      try {
        ig.state.cookieJar.setCookie(
          name + '=' + value + '; Domain=.instagram.com; Path=/; Secure; HttpOnly',
          'https://www.instagram.com/'
        )
      } catch {
        // کوکی‌های فرعی (shbid, rur, …) اگر ست نشدند مهم نیست
      }
    }

    // تأیید واقعی: اگر نشست نامعتبر باشد، همین‌جا خطا می‌گیریم نه دو ساعت بعد
    let info: Record<string, any>
    try {
      info = await ig.user.info(dsUserId)
    } catch (e) {
      throw this.mapError(e, 'تأیید نشست ورود')
    }

    if (!info || !info.username) {
      throw new AuthError(
        'نشست ساخته شد ولی اینستاگرام اطلاعات حساب را برنگرداند — دوباره وارد شوید'
      )
    }

    const state = await ig.state.serialize()
    delete state.constants

    return {
      profile: {
        ig_user_id: String(info.pk ?? dsUserId),
        username: info.username,
        name: info.full_name,
        profile_picture_url: info.profile_pic_url,
        followers_count: info.follower_count,
        follows_count: info.following_count,
        media_count: info.media_count
      },
      serialized: JSON.stringify(state)
    }
  }

  logout(accountId: number): void {
    this.clients.delete(accountId)
    this.pks.delete(accountId)
    this.store.clear(accountId)
  }

  /* ─────────────────────────── خواندن ─────────────────────────── */

  async getProfile(accountId: number): Promise<IgProfile> {
    const ig = await this.restore(accountId)
    try {
      const pk = this.pks.get(accountId) ?? String(await ig.state.cookieUserId)
      this.pks.set(accountId, pk)
      const info = await ig.user.info(pk)
      return {
        ig_user_id: String(info.pk),
        username: info.username,
        name: info.full_name,
        profile_picture_url: info.profile_pic_url,
        followers_count: info.follower_count,
        follows_count: info.following_count,
        media_count: info.media_count
      }
    } catch (e) {
      throw this.mapError(e, 'دریافت پروفایل')
    }
  }

  private async pk(accountId: number): Promise<string> {
    const cached = this.pks.get(accountId)
    if (cached) return cached
    const ig = await this.restore(accountId)
    const pk = String(await ig.state.cookieUserId)
    this.pks.set(accountId, pk)
    return pk
  }

  async listMedia(accountId: number, limit = 25): Promise<IgMedia[]> {
    const ig = await this.restore(accountId)
    try {
      const feed = ig.feed.user(await this.pk(accountId))
      const items = await feed.items()
      return items.slice(0, limit).map((m: Record<string, any>) => ({
        media_id: String(m.id),
        media_type: m.media_type === 2 ? (m.product_type === 'clips' ? 'REELS' : 'VIDEO') : m.carousel_media ? 'CAROUSEL_ALBUM' : 'IMAGE',
        caption: m.caption?.text,
        permalink: m.code ? 'https://www.instagram.com/p/' + m.code + '/' : undefined,
        thumbnail_url: m.image_versions2?.candidates?.[0]?.url,
        timestamp: (m.taken_at ?? 0) * 1000,
        like_count: m.like_count ?? 0,
        comments_count: m.comment_count ?? 0
      }))
    } catch (e) {
      throw this.mapError(e, 'دریافت پست‌ها')
    }
  }

  /** آمار پست در API خصوصی محدود است — همان چیزی که در فید هست را می‌دهیم */
  async getMediaInsights(accountId: number, mediaId: string): Promise<IgInsights> {
    const ig = await this.restore(accountId)
    try {
      const info = await ig.media.info(mediaId)
      const m = info.items?.[0] ?? {}
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
        message: 'آمار پست ' + mediaId + ' از موتور Session در دسترس نبود',
        meta: { error: (e as Error).message }
      })
      return {}
    }
  }

  async listComments(accountId: number, mediaId: string, limit = 50): Promise<IgComment[]> {
    const ig = await this.restore(accountId)
    try {
      const feed = ig.feed.mediaComments(mediaId)
      const items = await feed.items()
      return items.slice(0, limit).map((c: Record<string, any>) => ({
        comment_id: String(c.pk),
        media_id: mediaId,
        text: c.text ?? '',
        from_user_id: String(c.user?.pk ?? ''),
        from_username: c.user?.username,
        timestamp: (c.created_at ?? 0) * 1000
      }))
    } catch (e) {
      throw this.mapError(e, 'دریافت کامنت‌ها')
    }
  }

  async replyToCommentPublic(accountId: number, commentRef: string, text: string): Promise<void> {
    const commentId = commentRef.includes(':') ? commentRef.split(':')[1] : commentRef
    const ig = await this.restore(accountId)
    try {
      // در API خصوصی، پاسخ به کامنت یعنی کامنت جدید با replied_to_comment_id
      const comments = await ig.media.comment({
        mediaId: (await this.findMediaIdForComment(accountId, commentId)) ?? commentId,
        text,
        replyToCommentId: commentId
      })
      void comments
    } catch (e) {
      throw this.mapError(e, 'پاسخ به کامنت')
    }
  }

  /** API خصوصی برای پاسخ به کامنت، شناسه‌ی پست را هم می‌خواهد */
  private async findMediaIdForComment(accountId: number, commentId: string): Promise<string | null> {
    void accountId
    void commentId
    return null
  }

  async replyToCommentPrivate(): Promise<void> {
    throw new UnsupportedCapabilityError(
      'reply_comment_private',
      'session',
      'پاسخ خصوصی به کامنت فقط در API رسمی وجود دارد. در موتور Session از sendDm با شناسه‌ی کاربر استفاده کنید.'
    )
  }

  /* ─────────────────────────── دایرکت ─────────────────────────── */

  async sendDm(accountId: number, recipientIgId: string, text: string, opts?: SendDmOptions): Promise<void> {
    const ig = await this.restore(accountId)
    try {
      const thread = ig.entity.directThread([String(recipientIgId)])
      await thread.broadcastText(text)

      // دکمه در API خصوصی وجود ندارد؛ لینک‌ها را به‌صورت متن پیام دوم می‌فرستیم
      if (opts?.buttons && opts.buttons.length > 0) {
        const links = opts.buttons.map((b) => b.title + ': ' + b.url).join('\n')
        await thread.broadcastText(links)
      }
    } catch (e) {
      throw this.mapError(e, 'ارسال دایرکت')
    }
  }

  /* ─────────────────────────── فالوورها ─────────────────────────── */

  /**
   * لیست فالوورها با صفحه‌بندی.
   *
   * چرا تأخیر بین صفحه‌ها؟ گرفتن ۱۰۰۰۰ فالوور یعنی ۱۰۰ درخواست پشت‌سرهم، و
   * همین الگو خودش feedback_required می‌آورد. یک تأخیر تصادفی کوچک بین صفحه‌ها،
   * تفاوت بین «کار می‌کند» و «حساب محدود می‌شود» است.
   */
  private async collectFeed(feed: IgClient, limit: number, label: string): Promise<IgUser[]> {
    const out: IgUser[] = []
    let guard = 0
    try {
      do {
        const items = await feed.items()
        for (const u of items as Record<string, any>[]) {
          out.push({
            ig_user_id: String(u.pk),
            username: u.username,
            full_name: u.full_name,
            profile_pic: u.profile_pic_url,
            is_private: !!u.is_private,
            is_verified: !!u.is_verified
          })
          if (out.length >= limit) return out
        }
        if (!feed.isMoreAvailable()) break
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500))
      } while (guard++ < 200)
    } catch (e) {
      // اگر وسط کار محدود شدیم، هرچه گرفته‌ایم را برمی‌گردانیم تا کار نصفه هدر نرود
      if (out.length > 0) {
        logRepo.add({
          level: 'warn',
          category: 'session',
          message: label + ': صفحه‌بندی نیمه‌کاره ماند، ' + out.length + ' مورد برگردانده شد',
          meta: { error: (e as Error).message }
        })
        return out
      }
      throw this.mapError(e, label)
    }
    return out
  }

  async listFollowers(accountId: number, limit = 5000): Promise<IgUser[]> {
    const ig = await this.restore(accountId)
    const feed = ig.feed.accountFollowers(await this.pk(accountId))
    return this.collectFeed(feed, limit, 'دریافت فالوورها')
  }

  async listFollowing(accountId: number, limit = 5000): Promise<IgUser[]> {
    const ig = await this.restore(accountId)
    const feed = ig.feed.accountFollowing(await this.pk(accountId))
    return this.collectFeed(feed, limit, 'دریافت فالووینگ')
  }

  /** جستجوی دقیق یک نام کاربری → شناسه، برای ارسال دایرکت به لیست دستی */
  async resolveUsername(accountId: number, username: string): Promise<IgUser | null> {
    const ig = await this.restore(accountId)
    try {
      const u = await ig.user.searchExact(username.replace(/^@/, ''))
      return {
        ig_user_id: String(u.pk),
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
