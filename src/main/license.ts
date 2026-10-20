import { randomBytes } from 'node:crypto'
import { shell } from 'electron'
import type { LicenseView } from '../shared/ipc'
import { secureStore } from './secure-store'

/**
 * اشتراک دایرکتینو.
 *
 * اپ با همان نام کاربری و رمز سایت وارد می‌شود و روزهای باقی‌مانده را از سایت
 * می‌پرسد. اگر موقع بیلد آدرس سایت داده نشده باشد (DIRECTINO_SITE_URL)، هیچ
 * قفلی در کار نیست — نسخه‌ی شخصی مثل قبل کار می‌کند.
 */
export const SITE_URL = (process.env.DIRECTINO_SITE_URL ?? '').replace(/\/$/, '')
export const licenseRequired = (): boolean => SITE_URL !== ''

/** اگر سایت در دسترس نبود، تا وقتی تاریخ ذخیره‌شده نگذشته اپ کار می‌کند */
const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000

async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(SITE_URL + path, { ...init, signal: AbortSignal.timeout(10_000) })
  const body = (await res.json().catch(() => ({}))) as T
  return { status: res.status, body }
}

const daysUntil = (iso: string | null | undefined): number =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0

function view(offline = false): LicenseView {
  const l = secureStore().getLicense()
  const until = l?.subUntil ?? null
  const active = !!until && new Date(until).getTime() > Date.now()
  return {
    required: licenseRequired(),
    siteUrl: SITE_URL,
    loggedIn: !!l,
    username: l?.username,
    subUntil: until,
    daysLeft: daysUntil(until),
    // آفلاین: فقط تا چند روز بعد از آخرین بررسی موفق
    active: active && (!offline || Date.now() - (l?.checkedAt ?? 0) < OFFLINE_GRACE_MS),
    offline
  }
}

export async function checkLicense(): Promise<LicenseView> {
  if (!licenseRequired()) return { ...view(), active: true }
  const l = secureStore().getLicense()
  if (!l) return view()
  try {
    const r = await api<{ username?: string; subUntil?: string | null; error?: string }>('/api/desktop/me', {
      headers: { Authorization: 'Bearer ' + l.token }
    })
    if (r.status === 401) {
      secureStore().setLicense(null)
      return view()
    }
    if (r.status !== 200) return view(true)
    secureStore().setLicense({ ...l, subUntil: r.body.subUntil ?? null, checkedAt: Date.now() })
    return view()
  } catch {
    return view(true)
  }
}

export async function licenseLogin(username: string, password: string): Promise<LicenseView> {
  const r = await api<{ token?: string; username?: string; subUntil?: string | null; error?: string }>(
    '/api/desktop/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }
  )
  if (r.status !== 200 || !r.body.token) throw new Error(r.body.error ?? 'ورود ناموفق بود')
  secureStore().setLicense({
    token: r.body.token,
    username: r.body.username ?? username,
    subUntil: r.body.subUntil ?? null,
    checkedAt: Date.now()
  })
  return view()
}

export function licenseLogout(): LicenseView {
  secureStore().setLicense(null)
  return view()
}

export interface SiteConnection {
  accessToken: string
  expiresAt: number
  igUserId: string
  username: string
  name?: string
  profilePicture?: string
}

/**
 * اتصال رسمی از راه سایت: صفحه‌ی اجازه در مرورگر خود کاربر باز می‌شود، سایت
 * کد را با Secret خودش به توکن تبدیل می‌کند و اپ نتیجه را با یک nonce
 * یک‌بارمصرف برمی‌دارد. App Secret هرگز داخل اپ نیست.
 */
export async function connectViaSite(): Promise<SiteConnection> {
  const nonce = randomBytes(24).toString('base64url')
  await shell.openExternal(SITE_URL + '/connect/desktop?nonce=' + nonce)
  const deadline = Date.now() + 10 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    try {
      const r = await api<SiteConnection & { pending?: boolean }>('/api/desktop/claim?nonce=' + nonce)
      if (r.status === 200 && r.body.accessToken) return r.body
    } catch {
      /* شبکه لحظه‌ای قطع است؛ دوباره می‌پرسیم */
    }
  }
  throw new Error('اتصال در ۱۰ دقیقه کامل نشد؛ دوباره «اتصال رسمی» را بزنید')
}
