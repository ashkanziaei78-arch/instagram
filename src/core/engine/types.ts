import type { Capability, EngineKind } from '../../shared/types'

export interface IgUser {
  ig_user_id: string
  username?: string
  full_name?: string
  profile_pic?: string
  is_private?: boolean
  is_verified?: boolean
  followers_count?: number
}

export interface IgMedia {
  media_id: string
  media_type: string
  caption?: string
  permalink?: string
  thumbnail_url?: string
  timestamp: number
  like_count?: number
  comments_count?: number
}

export interface IgInsights {
  views?: number
  reach?: number
  saved?: number
  shares?: number
  likes?: number
  comments?: number
  total_interactions?: number
}

export interface IgComment {
  comment_id: string
  media_id: string
  text: string
  from_user_id: string
  from_username?: string
  timestamp: number
  parent_id?: string
}

export interface IgProfile {
  ig_user_id: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
}

export interface SendDmOptions {
  /** دکمه‌های لینک — فقط در حالت رسمی و حداکثر ۳ عدد */
  buttons?: { title: string; url: string }[]
  /** اگر true باشد، پیام به عنوان private reply به یک کامنت ارسال می‌شود */
  commentId?: string
}

/**
 * قرارداد مشترک دو موتور.
 * هر متدی که موتور پشتیبانی نمی‌کند باید `UnsupportedCapabilityError` پرتاب کند،
 * نه اینکه بی‌سروصدا شکست بخورد — این تفاوت بین «کار نکرد» و «چرا کار نکرد» است.
 */
export interface IEngine {
  readonly kind: EngineKind
  readonly capabilities: Capability[]

  isConnected(accountId: number): boolean
  can(cap: Capability): boolean

  getProfile(accountId: number): Promise<IgProfile>
  listMedia(accountId: number, limit?: number): Promise<IgMedia[]>
  getMediaInsights(accountId: number, mediaId: string, mediaType: string): Promise<IgInsights>
  listComments(accountId: number, mediaId: string, limit?: number): Promise<IgComment[]>

  replyToCommentPublic(accountId: number, commentId: string, text: string): Promise<void>
  /** private reply: پاسخ کامنت مستقیم به دایرکتِ کامنت‌گذار */
  replyToCommentPrivate(accountId: number, commentId: string, text: string, opts?: SendDmOptions): Promise<void>
  sendDm(accountId: number, recipientIgId: string, text: string, opts?: SendDmOptions): Promise<void>

  listFollowers(accountId: number, limit?: number): Promise<IgUser[]>
  listFollowing(accountId: number, limit?: number): Promise<IgUser[]>
}

export class UnsupportedCapabilityError extends Error {
  constructor(
    public capability: Capability,
    public engine: EngineKind,
    public hint: string
  ) {
    super(`قابلیت «${capability}» در موتور «${engine}» پشتیبانی نمی‌شود. ${hint}`)
    this.name = 'UnsupportedCapabilityError'
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterMs = 15 * 60 * 1000
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
