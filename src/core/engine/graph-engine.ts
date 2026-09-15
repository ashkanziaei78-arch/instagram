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

const API_VERSION = 'v21.0'
const BASE = 'https://graph.instagram.com/' + API_VERSION

/** تابعی که توکن دسترسیِ یک حساب را می‌دهد (از انبار رمزنگاری‌شده در main) */
export type TokenProvider = (accountId: number) => string | null

interface GraphError {
  message: string
  type?: string
  code?: number
  error_subcode?: number
}

/**
 * موتور رسمی: «Instagram API with Instagram Login».
 *
 * چرا این مسیر و نه Facebook Login؟ چون نیازی به صفحه‌ی فیسبوک ندارد و
 * جریان اتصال برای کاربر یک مرحله است. محدودیت‌هایش همان است، ولی راه‌اندازی
 * برای کسی که فقط اینستاگرام بیزنسی دارد بسیار ساده‌تر است.
 *
 * چه چیزی *نمی‌تواند* بکند (طبق مستندات متا):
 *  - لیست فالوورها را بدهد (هیچ اندپوینتی وجود ندارد)
 *  - وبهوک «فالوور جدید» بفرستد (چنین رویدادی نیست)
 *  - به کسی که در ۲۴ ساعت گذشته پیام نداده دایرکت بفرستد
 * برای این سه مورد، EngineManager به موتور Session سوئیچ می‌کند.
 */
export class GraphEngine implements IEngine {
  readonly kind: EngineKind = 'graph'

  readonly capabilities: Capability[] = [
    'read_comments',
    'reply_comment_public',
    'reply_comment_private',
    'send_dm_open_window',
    'read_insights',
    'read_media'
  ]

  /** ig_user_id هر حساب، برای ساختن مسیر /{ig-user-id}/messages */
  private igUserIds = new Map<number, string>()

  constructor(private readonly getToken: TokenProvider) {}

  can(cap: Capability): boolean {
    return this.capabilities.includes(cap)
  }

  isConnected(accountId: number): boolean {
    return !!this.getToken(accountId)
  }

  registerIgUserId(accountId: number, igUserId: string): void {
    this.igUserIds.set(accountId, igUserId)
  }

  private token(accountId: number): string {
    const t = this.getToken(accountId)
    if (!t) throw new AuthError('توکن دسترسی برای این حساب موجود نیست — دوباره وصل شوید')
    return t
  }

  /**
   * تبدیل خطای متا به خطای معنادار برنامه.
   * این نقشه مهم است چون رفتار صف را تعیین می‌کند: خطای توکن نباید retry شود،
   * خطای نرخ باید با backoff صبر کند، و بقیه چند بار تلاش شوند.
   */
  private mapError(status: number, err: GraphError | undefined, context: string): Error {
    const code = err?.code
    const sub = err?.error_subcode
    const msg = err?.message ?? 'خطای ناشناخته'

    // 190 = توکن نامعتبر/منقضی، 102 = نشست منقضی
    if (code === 190 || code === 102 || status === 401) {
      return new AuthError(context + ': توکن منقضی یا نامعتبر است (' + msg + ')')
    }
    // 4 = سقف نرخ اپ، 17 = سقف نرخ کاربر، 32 = سقف نرخ صفحه، 613 = سقف فراخوانی
    if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
      return new RateLimitError(context + ': سقف نرخ متا (' + msg + ')')
    }
    // 10 یا 200 = نبود مجوز لازم
    if (code === 10 || code === 200) {
      return new AuthError(context + ': مجوز لازم داده نشده است (' + msg + ')')
    }
    // خطاهای پیام‌رسانی که یعنی پنجره‌ی ۲۴ ساعته بسته است
    if (sub === 2534022 || sub === 2018278 || /outside.*allowed window|24 hours/i.test(msg)) {
      return new UnsupportedCapabilityError(
        'send_dm_cold',
        'graph',
        'این کاربر در ۲۴ ساعت گذشته پیام نداده، پس API رسمی اجازه‌ی ارسال نمی‌دهد. برای این کار موتور Session لازم است.'
      )
    }
    return new Error(context + ': ' + msg + (code ? ' [code ' + code + ']' : ''))
  }

  private async request<T>(
    accountId: number,
    path: string,
    opts: { method?: 'GET' | 'POST' | 'DELETE'; query?: Record<string, string>; body?: unknown; context: string }
  ): Promise<T> {
    const token = this.token(accountId)
    const url = new URL(BASE + path)
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
    url.searchParams.set('access_token', token)

    let res: Response
    try {
      res = await fetch(url.toString(), {
        method: opts.method ?? 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      })
    } catch (e) {
      // خطای شبکه — قابل تلاش دوباره است، پس Error معمولی
      throw new Error(opts.context + ': خطای شبکه (' + (e as Error).message + ')')
    }

    const raw = await res.text()
    let parsed: unknown = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    if (!res.ok) {
      const err = (parsed as { error?: GraphError } | null)?.error
      throw this.mapError(res.status, err, opts.context)
    }
    return parsed as T
  }

  /* ─────────────────────────── پروفایل و مدیا ─────────────────────────── */

  async getProfile(accountId: number): Promise<IgProfile> {
    const d = await this.request<{
      user_id?: string
      id?: string
      username: string
      name?: string
      profile_picture_url?: string
      followers_count?: number
      follows_count?: number
      media_count?: number
    }>(accountId, '/me', {
      query: {
        fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count'
      },
      context: 'دریافت پروفایل'
    })

    const igId = d.user_id ?? d.id ?? ''
    if (igId) this.registerIgUserId(accountId, igId)

    return {
      ig_user_id: igId,
      username: d.username,
      name: d.name,
      profile_picture_url: d.profile_picture_url,
      followers_count: d.followers_count ?? 0,
      follows_count: d.follows_count ?? 0,
      media_count: d.media_count ?? 0
    }
  }

  async listMedia(accountId: number, limit = 25): Promise<IgMedia[]> {
    const d = await this.request<{
      data: {
        id: string
        media_type: string
        caption?: string
        permalink?: string
        thumbnail_url?: string
        media_url?: string
        timestamp: string
        like_count?: number
        comments_count?: number
      }[]
    }>(accountId, '/me/media', {
      query: {
        fields:
          'id,media_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
        limit: String(limit)
      },
      context: 'دریافت پست‌ها'
    })

    return (d.data ?? []).map((m) => ({
      media_id: m.id,
      media_type: m.media_type,
      caption: m.caption,
      permalink: m.permalink,
      // ریلز thumbnail_url دارد، عکس‌ها media_url
      thumbnail_url: m.thumbnail_url ?? m.media_url,
      timestamp: new Date(m.timestamp).getTime(),
      like_count: m.like_count ?? 0,
      comments_count: m.comments_count ?? 0
    }))
  }

  /**
   * متریک‌های Insights بسته به نوع مدیا فرق می‌کنند و درخواستِ متریکِ نامربوط
   * کل فراخوانی را با خطا برمی‌گرداند. پس برای هر نوع، لیست درست را می‌فرستیم.
   */
  private metricsFor(mediaType: string): string[] {
    const t = mediaType.toUpperCase()
    if (t === 'VIDEO' || t === 'REELS') {
      return ['reach', 'saved', 'shares', 'views', 'likes', 'comments', 'total_interactions']
    }
    if (t === 'CAROUSEL_ALBUM') {
      return ['reach', 'saved', 'shares', 'views', 'likes', 'comments', 'total_interactions']
    }
    return ['reach', 'saved', 'shares', 'views', 'likes', 'comments', 'total_interactions']
  }

  async getMediaInsights(accountId: number, mediaId: string, mediaType = 'IMAGE'): Promise<IgInsights> {
    const metrics = this.metricsFor(mediaType)
    try {
      const d = await this.request<{
        data: { name: string; values: { value: number }[] }[]
      }>(accountId, '/' + mediaId + '/insights', {
        query: { metric: metrics.join(',') },
        context: 'دریافت آمار پست'
      })

      const out: IgInsights = {}
      for (const row of d.data ?? []) {
        const v = row.values?.[0]?.value ?? 0
        switch (row.name) {
          case 'views': out.views = v; break
          case 'reach': out.reach = v; break
          case 'saved': out.saved = v; break
          case 'shares': out.shares = v; break
          case 'likes': out.likes = v; break
          case 'comments': out.comments = v; break
          case 'total_interactions': out.total_interactions = v; break
        }
      }
      return out
    } catch (e) {
      // آمار برای پست‌های قدیمی یا انواع خاص در دسترس نیست — این نباید
      // کل همگام‌سازی را بخواباند، پس خالی برمی‌گردانیم و لاگ می‌کنیم.
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
    const d = await this.request<{
      data: {
        id: string
        text: string
        timestamp: string
        username?: string
        from?: { id: string; username?: string }
      }[]
    }>(accountId, '/' + mediaId + '/comments', {
      query: { fields: 'id,text,timestamp,username,from', limit: String(limit) },
      context: 'دریافت کامنت‌ها'
    })

    return (d.data ?? []).map((c) => ({
      comment_id: c.id,
      media_id: mediaId,
      text: c.text ?? '',
      from_user_id: c.from?.id ?? '',
      from_username: c.from?.username ?? c.username,
      timestamp: new Date(c.timestamp).getTime()
    }))
  }

  async replyToCommentPublic(accountId: number, commentId: string, text: string): Promise<void> {
    await this.request(accountId, '/' + commentId + '/replies', {
      method: 'POST',
      query: { message: text },
      context: 'پاسخ عمومی به کامنت'
    })
  }

  /* ─────────────────────────── پیام‌ها ─────────────────────────── */

  private igUserId(accountId: number): string {
    const id = this.igUserIds.get(accountId)
    if (!id) {
      throw new Error('شناسه‌ی اینستاگرام این حساب معلوم نیست — ابتدا getProfile را صدا بزنید')
    }
    return id
  }

  /** ساخت بدنه‌ی پیام؛ اگر دکمه داشت به فرمت generic template متا تبدیل می‌شود */
  private messageBody(text: string, opts?: SendDmOptions): Record<string, unknown> {
    if (opts?.buttons && opts.buttons.length > 0) {
      return {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: text.slice(0, 80),
                subtitle: text.length > 80 ? text.slice(80, 160) : undefined,
                buttons: opts.buttons.slice(0, 3).map((b) => ({
                  type: 'web_url',
                  url: b.url,
                  title: b.title.slice(0, 20)
                }))
              }
            ]
          }
        }
      }
    }
    return { text }
  }

  /**
   * پاسخ خصوصی به کامنت — ستون فقرات «کامنت به دایرکت».
   *
   * نکته‌ی مهم که در مستندات کم دیده می‌شود: گیرنده اینجا شناسه‌ی *کامنت* است،
   * نه شناسه‌ی کاربر. متا خودش کامنت را به فرستنده‌اش نگاشت می‌کند. این تنها
   * راه قانونی برای پیام دادن به کسی است که هنوز به شما پیام نداده.
   * محدودیت: فقط یک بلاک محتوا، و تا ۷ روز بعد از کامنت.
   */
  async replyToCommentPrivate(
    accountId: number,
    commentId: string,
    text: string,
    opts?: SendDmOptions
  ): Promise<void> {
    await this.request(accountId, '/' + this.igUserId(accountId) + '/messages', {
      method: 'POST',
      body: {
        recipient: { comment_id: commentId },
        message: this.messageBody(text, opts)
      },
      context: 'پاسخ خصوصی به کامنت'
    })
  }

  async sendDm(
    accountId: number,
    recipientIgId: string,
    text: string,
    opts?: SendDmOptions
  ): Promise<void> {
    if (opts?.commentId) {
      return this.replyToCommentPrivate(accountId, opts.commentId, text, opts)
    }
    await this.request(accountId, '/' + this.igUserId(accountId) + '/messages', {
      method: 'POST',
      body: {
        recipient: { id: recipientIgId },
        message: this.messageBody(text, opts)
      },
      context: 'ارسال دایرکت'
    })
  }

  /* ─────────────────────────── فالوورها: پشتیبانی نمی‌شود ─────────────────────────── */

  async listFollowers(): Promise<IgUser[]> {
    throw new UnsupportedCapabilityError(
      'list_followers',
      'graph',
      'API رسمی اینستاگرام هیچ اندپوینتی برای گرفتن لیست فالوورها ندارد — فقط تعداد آن‌ها را می‌دهد. برای لیست، موتور Session را فعال کنید.'
    )
  }

  async listFollowing(): Promise<IgUser[]> {
    throw new UnsupportedCapabilityError(
      'list_following',
      'graph',
      'API رسمی اینستاگرام لیست فالووینگ را نمی‌دهد. برای این کار موتور Session را فعال کنید.'
    )
  }

  /* ─────────────────────────── مدیریت توکن ─────────────────────────── */

  /**
   * توکن‌های بلندمدت ۶۰ روز اعتبار دارند و باید *قبل* از انقضا تازه شوند.
   * اگر منقضی شود، کاربر باید کل جریان OAuth را از نو طی کند — پس این را
   * روزانه صدا می‌زنیم، نه ماهانه.
   */
  async refreshToken(accountId: number): Promise<{ access_token: string; expires_in: number }> {
    return this.request<{ access_token: string; expires_in: number }>(
      accountId,
      '/refresh_access_token',
      { query: { grant_type: 'ig_refresh_token' }, context: 'تازه‌سازی توکن' }
    )
  }
}
