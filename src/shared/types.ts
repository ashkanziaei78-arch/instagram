/**
 * تایپ‌های مشترک بین main / preload / renderer.
 * این فایل هیچ وابستگی به Node یا DOM ندارد تا هر سه لایه بتوانند از آن استفاده کنند.
 */

export type EngineKind = 'graph' | 'session'

/** قابلیت‌هایی که یک موتور می‌تواند ارائه دهد. هر اتوماسیون قابلیت موردنیازش را اعلام می‌کند. */
export type Capability =
  | 'read_comments'
  | 'reply_comment_public'
  | 'reply_comment_private'
  | 'send_dm_open_window'   // پیام در پنجره ۲۴ ساعته (رسمی)
  | 'send_dm_cold'          // پیام به کسی که پیام نداده (فقط غیررسمی)
  | 'list_followers'
  | 'list_following'
  | 'detect_new_followers'
  | 'read_insights'
  | 'read_media'

export interface AccountRow {
  id: number
  ig_user_id: string
  username: string
  name: string | null
  profile_picture_url: string | null
  engine: EngineKind
  followers_count: number
  follows_count: number
  media_count: number
  token_expires_at: number | null
  status: 'active' | 'expired' | 'error' | 'disabled'
  last_error: string | null
  created_at: number
  updated_at: number
}

export type TriggerType =
  | 'comment_keyword'
  | 'comment_any'
  | 'dm_keyword'
  | 'new_follower'
  | 'new_post'
  | 'story_reply'
  | 'mention'

export type MatchMode = 'contains' | 'exact' | 'starts_with' | 'regex' | 'number'

export type ActionType =
  | 'send_dm'
  | 'reply_comment'
  | 'like_comment'
  | 'follow_user'
  | 'add_tag'
  | 'wait'

export interface RuleAction {
  id?: number
  type: ActionType
  /** متن پیام؛ از spintax و متغیرها پشتیبانی می‌کند: {{username}} {{name}} {{post_caption}} */
  text?: string
  /** دکمه‌های لینک برای دایرکت (حداکثر ۳ عدد طبق محدودیت اینستاگرام) */
  buttons?: { title: string; url: string }[]
  /** تأخیر بر حسب ثانیه برای اکشن wait */
  seconds?: number
  order: number
}

export interface Rule {
  id: number
  account_id: number
  name: string
  enabled: boolean
  trigger_type: TriggerType
  match_mode: MatchMode
  /** کلیدواژه‌ها یا اعداد، جداشده با کاما. برای number مثلا: 1,2,3 */
  keywords: string
  case_sensitive: boolean
  /** خالی = همه‌ی پست‌ها، یا لیست media_id ها */
  media_scope: string | null
  actions: RuleAction[]
  /** هر کاربر فقط یک‌بار این قانون را دریافت کند */
  once_per_user: boolean
  /** تأخیر تصادفی بین این دو عدد (ثانیه) قبل از اجرا */
  delay_min: number
  delay_max: number
  priority: number
  hit_count: number
  created_at: number
  updated_at: number
}

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'skipped'

export interface Job {
  id: number
  account_id: number
  kind: string
  payload: string
  status: JobStatus
  run_at: number
  attempts: number
  max_attempts: number
  last_error: string | null
  created_at: number
  updated_at: number
}

export interface BroadcastTargetFilter {
  /** مخاطبان هدف */
  audience: 'followers' | 'following' | 'mutual' | 'engaged_24h' | 'tag' | 'custom'
  tag?: string
  usernames?: string[]
  /** فیلترهای کیفی برای کاهش اسپم */
  minFollowers?: number
  maxFollowers?: number
  skipPrivate?: boolean
  skipNoAvatar?: boolean
  /** حداکثر تعداد گیرنده */
  limit?: number
}

export interface Broadcast {
  id: number
  account_id: number
  name: string
  message: string
  media_id: string | null
  filter_json: string
  status: 'draft' | 'queued' | 'running' | 'paused' | 'done' | 'failed'
  total: number
  sent: number
  failed: number
  created_at: number
  started_at: number | null
  finished_at: number | null
}

export interface SafetySettings {
  dailyDmCap: number
  dailyCommentReplyCap: number
  dailyFollowCap: number
  minActionDelaySec: number
  maxActionDelaySec: number
  quietHoursEnabled: boolean
  quietStartHour: number
  quietEndHour: number
  warmupEnabled: boolean
  warmupDays: number
  killSwitch: boolean
}

export interface MediaRow {
  id: number
  account_id: number
  media_id: string
  media_type: string
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  timestamp: number
  like_count: number
  comments_count: number
  views: number
  reach: number
  saved: number
  shares: number
  last_synced: number
}

export interface ActivityLogRow {
  id: number
  account_id: number | null
  level: 'info' | 'warn' | 'error' | 'success'
  category: string
  message: string
  meta: string | null
  created_at: number
}

export interface EngineStatus {
  kind: EngineKind
  connected: boolean
  capabilities: Capability[]
  detail: string
}
