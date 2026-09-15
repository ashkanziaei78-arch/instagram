import { BrowserWindow } from 'electron'
import { secureStore } from '../secure-store'

/**
 * جریان OAuth «Instagram API with Instagram Login».
 *
 * چرا داخل یک BrowserWindow و نه مرورگر سیستم؟ چون آدرس بازگشت (redirect_uri)
 * باید HTTPS باشد و ما روی دسکتاپ سروری نداریم که آن را بگیرد. راه‌حل: پنجره‌ی
 * Electron را باز می‌کنیم، و به‌جای اینکه منتظر *بارگذاری* آدرس بازگشت بمانیم،
 * ناوبری به آن آدرس را رصد می‌کنیم و کد را از query string برمی‌داریم. صفحه
 * هرگز واقعا بارگذاری نمی‌شود — همان لحظه پنجره را می‌بندیم.
 *
 * این یعنی redirect_uri می‌تواند هر آدرس HTTPS معتبری باشد که در داشبورد متا
 * ثبت کرده‌اید (حتی صفحه‌ی اصلی سایتتان)، بدون نیاز به هیچ کد سمت سرور.
 */

const AUTH_HOST = 'https://www.instagram.com/oauth/authorize'
const TOKEN_HOST = 'https://api.instagram.com/oauth/access_token'
const GRAPH_HOST = 'https://graph.instagram.com'

/** مجوزهای لازم برای همه‌ی قابلیت‌های اپ */
export const REQUIRED_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights'
]

export interface OAuthResult {
  accessToken: string
  /** میلی‌ثانیه‌ی یونیکس انقضا */
  expiresAt: number
  igUserId: string
  username: string
  name?: string
  profilePicture?: string
  followersCount: number
  followsCount: number
  mediaCount: number
}

export class OAuthError extends Error {
  constructor(message: string, public hint?: string) {
    super(message)
    this.name = 'OAuthError'
  }
}

/** مرحله‌ی ۱: پنجره را باز کن و کد یک‌بارمصرف را بگیر */
function captureAuthCode(appId: string, redirectUri: string, parent?: BrowserWindow): Promise<string> {
  const url = new URL(AUTH_HOST)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', REQUIRED_SCOPES.join(','))

  return new Promise<string>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 620,
      height: 760,
      parent,
      modal: !!parent,
      autoHideMenuBar: true,
      title: 'ورود به اینستاگرام',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // نشست جدا تا اگر کاربر در مرورگر با حساب دیگری وارد است تداخل نشود
        partition: 'persist:ig-oauth'
      }
    })

    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      fn()
      if (!win.isDestroyed()) win.close()
    }

    const inspect = (raw: string): void => {
      if (!raw.startsWith(redirectUri.split('?')[0])) return
      let parsedUrl: URL
      try {
        parsedUrl = new URL(raw)
      } catch {
        return
      }
      const code = parsedUrl.searchParams.get('code')
      const error = parsedUrl.searchParams.get('error')
      const errorDesc = parsedUrl.searchParams.get('error_description')

      if (code) {
        // اینستاگرام «#_» را به انتهای کد اضافه می‌کند که باید حذف شود
        finish(() => resolve(code.replace(/#_$/, '')))
      } else if (error) {
        finish(() =>
          reject(new OAuthError('اینستاگرام اجازه نداد: ' + (errorDesc ?? error), 'شاید دسترسی را رد کردید'))
        )
      }
    }

    win.webContents.on('will-redirect', (_e, u) => inspect(u))
    win.webContents.on('will-navigate', (_e, u) => inspect(u))
    win.webContents.on('did-fail-load', (_e, _code, _desc, failedUrl) => {
      // آدرس بازگشت معمولا قابل بارگذاری نیست؛ همین رویداد کد را به ما می‌دهد
      inspect(failedUrl)
    })

    win.on('closed', () => {
      if (!settled) {
        settled = true
        reject(new OAuthError('پنجره‌ی ورود بسته شد', 'برای اتصال باید مراحل را کامل کنید'))
      }
    })

    void win.loadURL(url.toString())
  })
}

/** مرحله‌ی ۲: کد یک‌بارمصرف → توکن کوتاه‌مدت */
async function exchangeCode(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string
): Promise<{ token: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code
  })

  const res = await fetch(TOKEN_HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const text = await res.text()
  if (!res.ok) {
    throw new OAuthError(
      'تبدیل کد به توکن ناموفق بود: ' + text,
      'معمولا یعنی App Secret یا Redirect URI با داشبورد متا یکی نیست'
    )
  }
  const d = JSON.parse(text) as { access_token: string; user_id: number | string }
  return { token: d.access_token, userId: String(d.user_id) }
}

/** مرحله‌ی ۳: توکن کوتاه‌مدت (۱ ساعت) → توکن بلندمدت (۶۰ روز) */
async function exchangeForLongLived(
  appSecret: string,
  shortToken: string
): Promise<{ token: string; expiresIn: number }> {
  const url = new URL(GRAPH_HOST + '/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('access_token', shortToken)

  const res = await fetch(url.toString())
  const text = await res.text()
  if (!res.ok) {
    throw new OAuthError('تبدیل به توکن بلندمدت ناموفق بود: ' + text)
  }
  const d = JSON.parse(text) as { access_token: string; expires_in: number }
  return { token: d.access_token, expiresIn: d.expires_in }
}

/** مرحله‌ی ۴: پروفایل را بخوان تا حساب را بشناسیم */
async function fetchProfile(token: string): Promise<{
  igUserId: string
  username: string
  name?: string
  profilePicture?: string
  followersCount: number
  followsCount: number
  mediaCount: number
}> {
  const url = new URL(GRAPH_HOST + '/v21.0/me')
  url.searchParams.set(
    'fields',
    'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count'
  )
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString())
  const text = await res.text()
  if (!res.ok) throw new OAuthError('خواندن پروفایل ناموفق بود: ' + text)

  const d = JSON.parse(text) as {
    user_id?: string
    id?: string
    username: string
    name?: string
    profile_picture_url?: string
    followers_count?: number
    follows_count?: number
    media_count?: number
  }

  return {
    igUserId: String(d.user_id ?? d.id ?? ''),
    username: d.username,
    name: d.name,
    profilePicture: d.profile_picture_url,
    followersCount: d.followers_count ?? 0,
    followsCount: d.follows_count ?? 0,
    mediaCount: d.media_count ?? 0
  }
}

/** جریان کامل اتصال حساب */
export async function connectInstagramAccount(parent?: BrowserWindow): Promise<OAuthResult> {
  const cfg = secureStore().getMetaApp()
  if (!cfg.appId || !cfg.appSecret || !cfg.redirectUri) {
    throw new OAuthError(
      'اطلاعات اپ متا کامل نیست',
      'در تنظیمات، App ID و App Secret و Redirect URI را از داشبورد developers.facebook.com وارد کنید'
    )
  }

  const code = await captureAuthCode(cfg.appId, cfg.redirectUri, parent)
  const short = await exchangeCode(cfg.appId, cfg.appSecret, cfg.redirectUri, code)
  const long = await exchangeForLongLived(cfg.appSecret, short.token)
  const profile = await fetchProfile(long.token)

  return {
    accessToken: long.token,
    expiresAt: Date.now() + long.expiresIn * 1000,
    igUserId: profile.igUserId || short.userId,
    username: profile.username,
    name: profile.name,
    profilePicture: profile.profilePicture,
    followersCount: profile.followersCount,
    followsCount: profile.followsCount,
    mediaCount: profile.mediaCount
  }
}

/**
 * تازه‌سازی توکن بلندمدت.
 *
 * توکن ۶۰ روز اعتبار دارد و *قبل* از انقضا باید تازه شود؛ بعد از انقضا هیچ
 * راهی جز طی‌کردن مجدد کل جریان OAuth نیست. پس روزانه چک می‌کنیم و اگر کمتر
 * از ۱۰ روز مانده، تازه‌سازی می‌کنیم.
 */
export async function refreshLongLivedToken(
  token: string
): Promise<{ token: string; expiresAt: number }> {
  const url = new URL(GRAPH_HOST + '/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString())
  const text = await res.text()
  if (!res.ok) throw new OAuthError('تازه‌سازی توکن ناموفق بود: ' + text)

  const d = JSON.parse(text) as { access_token: string; expires_in: number }
  return { token: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 }
}

export const TOKEN_REFRESH_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000
