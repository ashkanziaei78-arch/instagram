import { BrowserWindow, session as electronSession, type Cookie } from 'electron'

/**
 * ورود ساده: پنجره‌ی خود اینستاگرام.
 *
 * کاربر دقیقاً همان صفحه‌ی لاگین instagram.com را می‌بیند که در مرورگر می‌بیند،
 * در همان‌جا وارد می‌شود، و ما فقط کوکی نشست را از پنجره برمی‌داریم.
 *
 * چرا این از گرفتن نام کاربری و رمز بهتر است:
 *   ۱. رمز هرگز وارد اپ ما نمی‌شود — مستقیم در صفحه‌ی اینستاگرام تایپ می‌شود.
 *   ۲. دو مرحله‌ای، checkpoint، کپچا و «این شما بودید؟» را خودِ اینستاگرام
 *      مدیریت می‌کند. این بزرگ‌ترین نقطه‌ی شکست مسیر نام‌کاربری/رمز بود، چون
 *      آنجا باید هر حالت را دستی پیاده و نگه‌داری می‌کردیم.
 *   ۳. حساب لازم نیست Business یا Creator باشد.
 *
 * چه چیزی *بهتر نمی‌شود*: این هم مثل مسیر نام‌کاربری/رمز از API غیررسمی
 * استفاده می‌کند. ساده‌تر است، اما از نظر شرایط استفاده‌ی اینستاگرام در همان
 * دسته است و همان ریسک محدودیت حساب را دارد.
 */

/** پارتیشن جدا تا نشست این اپ با هیچ‌چیز دیگری قاطی نشود */
const PARTITION = 'persist:ig-weblogin'

/** کوکی‌هایی که برای ساختن نشست لازم داریم */
const REQUIRED = ['sessionid', 'ds_user_id'] as const
const WANTED = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did', 'rur', 'shbid', 'shbts']

export interface WebSessionCookies {
  sessionid: string
  ds_user_id: string
  csrftoken?: string
  mid?: string
  ig_did?: string
  [key: string]: string | undefined
}

export interface WebLoginResult {
  cookies: WebSessionCookies
  /** User-Agent ای که نشست با آن ساخته شد — باید در درخواست‌های بعدی هم همان بماند */
  userAgent: string
}

export class WebLoginError extends Error {
  constructor(
    message: string,
    public hint?: string
  ) {
    super(message)
    this.name = 'WebLoginError'
  }
}

/**
 * User-Agent را از نشانه‌های Electron پاک می‌کند.
 *
 * چرا لازم است: UA پیش‌فرض Electron شامل «Electron/33.4.11» و نام اپ است.
 * اینستاگرام این را به‌عنوان کلاینت غیرمرورگری می‌شناسد و می‌تواند صفحه‌ی
 * لاگین را خراب بدهد یا نشست را زودتر باطل کند. بعد از پاک‌سازی، UA دقیقاً
 * شبیه Chrome معمولی می‌شود — که همان چیزی است که واقعاً هست.
 */
function browserLikeUserAgent(raw: string): string {
  return raw
    .replace(/\s*Electron\/[\d.]+/i, '')
    .replace(/\s*IG Auto Suite\/[\d.]+/i, '')
    .replace(/\s*ig-auto-suite\/[\d.]+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function toMap(cookies: Cookie[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of cookies) {
    if (WANTED.includes(c.name)) out[c.name] = c.value
  }
  return out
}

function hasRequired(map: Record<string, string>): boolean {
  return REQUIRED.every((k) => typeof map[k] === 'string' && map[k].length > 0)
}

/**
 * پنجره‌ی ورود را باز می‌کند و منتظر می‌ماند تا کوکی نشست ظاهر شود.
 *
 * روش تشخیص موفقیت عمدی ساده است: به‌جای حدس‌زدن از روی آدرس صفحه — که
 * اینستاگرام هر چند وقت عوضش می‌کند — هر ثانیه کوکی‌ها را می‌خوانیم. لحظه‌ای
 * که sessionid و ds_user_id هر دو موجود شدند، کاربر قطعاً وارد شده است،
 * مهم نیست از چه مسیری (رمز، دو مرحله‌ای، یا نشست از قبل باز).
 */
export function loginWithInstagramWindow(parent?: BrowserWindow): Promise<WebLoginResult> {
  return new Promise<WebLoginResult>((resolve, reject) => {
    const ses = electronSession.fromPartition(PARTITION)
    const userAgent = browserLikeUserAgent(ses.getUserAgent())

    const win = new BrowserWindow({
      width: 480,
      height: 760,
      parent,
      modal: !!parent,
      autoHideMenuBar: true,
      title: 'ورود به اینستاگرام',
      backgroundColor: '#ffffff',
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        // هیچ کد ما داخل این صفحه اجرا نمی‌شود — فقط صفحه‌ی خود اینستاگرام
        preload: undefined
      }
    })

    win.webContents.setUserAgent(userAgent)

    let settled = false
    let poller: NodeJS.Timeout | null = null

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      if (poller) clearInterval(poller)
      fn()
      if (!win.isDestroyed()) win.close()
    }

    const checkCookies = async (): Promise<void> => {
      if (settled) return
      try {
        const all = await ses.cookies.get({ domain: '.instagram.com' })
        const map = toMap(all)
        if (hasRequired(map)) {
          finish(() => resolve({ cookies: map as WebSessionCookies, userAgent }))
        }
      } catch {
        // خطای خواندن کوکی موقتی است؛ دور بعدی دوباره امتحان می‌شود
      }
    }

    // هر ثانیه چک کن — و بلافاصله بعد از هر ناوبری هم، تا اگر کاربر از قبل
    // وارد بود، پنجره فوراً بسته شود و او اصلاً چیزی تایپ نکند
    poller = setInterval(() => void checkCookies(), 1000)
    win.webContents.on('did-navigate', () => void checkCookies())
    win.webContents.on('did-navigate-in-page', () => void checkCookies())

    win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      // -3 یعنی ناوبری لغو شده؛ طبیعی است و خطا نیست
      if (!isMainFrame || code === -3) return
      finish(() =>
        reject(
          new WebLoginError(
            'صفحه‌ی ورود اینستاگرام باز نشد: ' + desc,
            'اتصال اینترنت را بررسی کنید. اگر از فیلترشکن استفاده می‌کنید، روشن باشد. (' + url + ')'
          )
        )
      )
    })

    win.on('closed', () => {
      if (!settled) {
        settled = true
        if (poller) clearInterval(poller)
        reject(
          new WebLoginError(
            'پنجره‌ی ورود بسته شد',
            'برای اتصال، باید ورود را تا انتها کامل کنید'
          )
        )
      }
    })

    void win.loadURL('https://www.instagram.com/accounts/login/')
  })
}

/**
 * پاک‌کردن نشست مرورگر داخلی.
 *
 * بدون این، پنجره‌ی ورود دفعه‌ی بعد کاربر را از قبل وارد نشان می‌دهد و
 * نمی‌شود حساب دیگری وصل کرد.
 */
export async function clearWebLoginSession(): Promise<void> {
  const ses = electronSession.fromPartition(PARTITION)
  await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'websql'] })
}

/** کوکی‌ها را به رشته‌ی هدر Cookie تبدیل می‌کند */
export function cookieHeader(cookies: WebSessionCookies): string {
  return Object.entries(cookies)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => k + '=' + v)
    .join('; ')
}
