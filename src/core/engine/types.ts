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

export type IgMessageKind = 'text' | 'story_reply' | 'story_mention'

/** یک پیام دایرکت ورودی که نظرسنجی صندوق پیدا کرده */
export interface IgDm {
  message_id: string
  kind: IgMessageKind
  from_user_id: string
  from_username?: string
  text: string
  /** میلی‌ثانیه‌ی یونیکس */
  timestamp: number
}

/** یک گفت‌وگوی دایرکت با آخرین پیام‌هایش — برای صفحه‌ی صندوق و نظرسنج */
export interface IgConversation {
  peer_id: string
  peer_username?: string
  /** از Requests آمده (کسی که شما را فالو نمی‌کند) */
  pending?: boolean
  messages: { id: string; from_me: boolean; kind?: IgMessageKind; text: string; timestamp: number }[]
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

  /**
   * پیام‌های متنی ورودی جدیدتر از `sinceMs`. برای وقتی وبهوک خاموش است — بدون
   * این، قانون «کلیدواژه در دایرکت» هرگز فعال نمی‌شد.
   */
  listIncomingDms?(accountId: number, sinceMs: number): Promise<IgDm[]>
  listConversations?(accountId: number): Promise<IgConversation[]>
}

/**
 * پیام‌های ورودی گفت‌وگوها، قدیمی به جدید. هر دو موتور از همین استفاده می‌کنند
 * تا قاعده‌ی «پیام خودم نه، فقط متنی، فقط تازه‌تر از X» یک جا باشد.
 */
export function incomingFrom(convs: IgConversation[], sinceMs: number): IgDm[] {
  const out: IgDm[] = []
  for (const c of convs) {
    for (const m of c.messages) {
      const kind = m.kind ?? 'text'
      // منشن در استوری متن ندارد ولی خودش رویداد است
      if (m.from_me || m.timestamp < sinceMs || (kind !== 'story_mention' && !m.text)) continue
      out.push({
        message_id: m.id,
        kind,
        from_user_id: c.peer_id,
        from_username: c.peer_username,
        text: m.text,
        timestamp: m.timestamp
      })
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp)
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
