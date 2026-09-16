/**
 * قرارداد IPC بین renderer و main.
 *
 * این فایل تنها منبع حقیقت برای نام کانال‌ها و شکل داده‌هاست. هر سه لایه
 * (main, preload, renderer) از همین تایپ‌ها استفاده می‌کنند، پس اگر یکی عوض شد
 * و جای دیگری به‌روز نشد، TypeScript سر کامپایل خطا می‌دهد — نه کاربر سر اجرا.
 */
import type {
  AccountRow,
  AccountWithLinks,
  ActivityLogRow,
  Broadcast,
  BroadcastTargetFilter,
  EngineStatus,
  Job,
  MediaRow,
  Rule,
  SafetySettings
} from './types'

export interface DashboardStats {
  account: AccountRow | null
  totals: { posts: number; likes: number; comments: number; views: number; reach: number; saved: number }
  today: { dmSent: number; commentsHandled: number }
  counters: Record<string, number>
  safety: {
    killSwitch: boolean
    cooldownMs: number
    quietNow: boolean
    caps: { action: string; used: number; cap: number; bucketAvailable: number }[]
  }
  queue: { pending: number; running: boolean }
  growth: { day: string; followers_count: number }[]
  engines: EngineStatus[]
  webhook: { running: boolean; port: number | null; received: number; lastEventAt: number | null }
  pollers: boolean
}

export interface MetaAppConfig {
  appId?: string
  appSecret?: string
  redirectUri?: string
  webhookVerifyToken?: string
}

export interface ContactSummary {
  ig_user_id: string
  username: string | null
  full_name: string | null
  profile_pic: string | null
  is_follower: number
  is_following: number
  tags: string
  last_inbound_at: number | null
  welcomed_at: number | null
}

export interface ApiResult<T = void> {
  ok: boolean
  data?: T
  error?: string
  hint?: string
}

/** امضای همه‌ی متدهای قابل‌صدازدن از renderer */
export interface IpcApi {
  /* حساب‌ها */
  listAccounts(): Promise<ApiResult<AccountWithLinks[]>>
  connectGraphAccount(): Promise<ApiResult<AccountRow>>
  /** ورود ساده: پنجره‌ی خود اینستاگرام باز می‌شود و کوکی نشست برداشته می‌شود */
  webLogin(): Promise<ApiResult<AccountRow>>
  /** پاک‌کردن نشست مرورگر داخلی، برای وصل‌کردن حساب دیگر */
  clearWebLogin(): Promise<ApiResult>
  /** اتصال با چسباندن sessionid از مرورگر خود کاربر */
  connectWithSessionId(p: { sessionid: string }): Promise<ApiResult<AccountRow>>
  /** لینک اجازه‌ی اینستاگرام، برای باز کردن در مرورگر خود کاربر */
  getAuthUrl(): Promise<ApiResult<{ url: string; bundled: boolean; redirectUri: string }>>
  /** تکمیل اتصال رسمی با آدرس بازگشتی که کاربر از مرورگرش کپی کرده */
  connectWithAuthCode(p: { codeOrUrl: string }): Promise<ApiResult<AccountRow>>
  sessionLogin(p: { username: string; password: string }): Promise<
    ApiResult<{ status: 'connected' | 'two_factor' | 'checkpoint'; message: string; account?: AccountRow }>
  >
  sessionTwoFactor(p: { username: string; code: string }): Promise<ApiResult<AccountRow>>
  removeAccount(p: { accountId: number }): Promise<ApiResult>
  refreshAccount(p: { accountId: number }): Promise<ApiResult<AccountRow>>

  /* داشبورد */
  dashboard(p: { accountId: number }): Promise<ApiResult<DashboardStats>>

  /* قوانین */
  listRules(p: { accountId: number }): Promise<ApiResult<Rule[]>>
  saveRule(p: { rule: Partial<Rule> & { account_id: number } }): Promise<ApiResult<Rule>>
  deleteRule(p: { ruleId: number }): Promise<ApiResult>
  toggleRule(p: { ruleId: number; enabled: boolean }): Promise<ApiResult<Rule>>
  testRule(p: { ruleId: number; text: string }): Promise<ApiResult<{ matched: boolean; reason: string; preview: string[] }>>

  /* مدیا و آنالیتیکس */
  listMedia(p: { accountId: number; limit?: number }): Promise<ApiResult<MediaRow[]>>
  syncMedia(p: { accountId: number }): Promise<ApiResult<{ total: number; newPosts: number; message: string }>>

  /* مخاطبان */
  listContacts(p: { accountId: number; audience?: string; limit?: number }): Promise<ApiResult<ContactSummary[]>>
  syncFollowers(p: { accountId: number }): Promise<ApiResult<{ total: number; newCount: number; welcomed: number; message: string }>>
  syncFollowing(p: { accountId: number }): Promise<ApiResult<{ total: number; message: string }>>
  audienceCount(p: { accountId: number; filter: BroadcastTargetFilter }): Promise<ApiResult<number>>

  /* برادکست */
  listBroadcasts(p: { accountId: number }): Promise<ApiResult<Broadcast[]>>
  createBroadcast(p: {
    accountId: number
    name: string
    message: string
    filter: BroadcastTargetFilter
  }): Promise<ApiResult<Broadcast>>
  startBroadcast(p: { broadcastId: number }): Promise<ApiResult<{ total: number; message: string }>>
  pauseBroadcast(p: { broadcastId: number }): Promise<ApiResult>
  resumeBroadcast(p: { broadcastId: number }): Promise<ApiResult>

  /* صف */
  listJobs(p: { limit?: number }): Promise<ApiResult<Job[]>>
  cancelPendingJobs(): Promise<ApiResult<number>>

  /* لاگ */
  listLogs(p: { limit?: number; accountId?: number }): Promise<ApiResult<ActivityLogRow[]>>
  clearLogs(): Promise<ApiResult>

  /* تنظیمات */
  getSafety(): Promise<ApiResult<SafetySettings>>
  setSafety(p: { settings: Partial<SafetySettings> }): Promise<ApiResult<SafetySettings>>
  getMetaApp(): Promise<ApiResult<MetaAppConfig>>
  setMetaApp(p: { config: MetaAppConfig }): Promise<ApiResult>
  getSessionEngineEnabled(): Promise<ApiResult<{ enabled: boolean; libraryAvailable: boolean }>>
  setSessionEngineEnabled(p: { enabled: boolean }): Promise<ApiResult>

  /* سیستم */
  startWebhook(p: { port: number }): Promise<ApiResult<{ message: string }>>
  stopWebhook(): Promise<ApiResult>
  setPollers(p: { enabled: boolean }): Promise<ApiResult>
  setKillSwitch(p: { enabled: boolean }): Promise<ApiResult>
  openExternal(p: { url: string }): Promise<ApiResult>
  appInfo(): Promise<ApiResult<{ version: string; userData: string; encryptionAvailable: boolean }>>
}

export type IpcChannel = keyof IpcApi

/** همه‌ی کانال‌ها — preload از این لیست برای ساختن پل استفاده می‌کند */
export const IPC_CHANNELS: IpcChannel[] = [
  'listAccounts',
  'connectGraphAccount',
  'webLogin',
  'clearWebLogin',
  'connectWithSessionId',
  'getAuthUrl',
  'connectWithAuthCode',
  'sessionLogin',
  'sessionTwoFactor',
  'removeAccount',
  'refreshAccount',
  'dashboard',
  'listRules',
  'saveRule',
  'deleteRule',
  'toggleRule',
  'testRule',
  'listMedia',
  'syncMedia',
  'listContacts',
  'syncFollowers',
  'syncFollowing',
  'audienceCount',
  'listBroadcasts',
  'createBroadcast',
  'startBroadcast',
  'pauseBroadcast',
  'resumeBroadcast',
  'listJobs',
  'cancelPendingJobs',
  'listLogs',
  'clearLogs',
  'getSafety',
  'setSafety',
  'getMetaApp',
  'setMetaApp',
  'getSessionEngineEnabled',
  'setSessionEngineEnabled',
  'startWebhook',
  'stopWebhook',
  'setPollers',
  'setKillSwitch',
  'openExternal',
  'appInfo'
]

/** رویدادهایی که main به renderer push می‌کند */
export const PUSH_EVENTS = {
  activity: 'push:activity',
  accountsChanged: 'push:accounts-changed'
} as const
