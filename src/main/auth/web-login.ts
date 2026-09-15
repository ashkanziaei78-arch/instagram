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

/** تابعی که بررسی می‌کند این کوکی‌ها واقعاً یک نشست معتبر هستند */
export type SessionVerifier = (result: WebLoginResult) => Promise<boolean>

export interface WebLoginOptions {
  parent?: BrowserWindow
  /**
   * تأییدکننده‌ی نشست. *قبل* از بستن پنجره صدا زده می‌شود.
   * اگر false برگرداند، پنجره باز می‌ماند و کاربر می‌تواند ادامه دهد.
   */
  verify?: SessionVerifier
  /** حداکثر زمان انتظار برای کامل‌شدن ورود (پیش‌فرض ۱۰ دقیقه) */
  timeoutMs?: number
}

/**
 * پنجره‌ی ورود را باز می‌کند و منتظر می‌ماند تا ورود *واقعاً* کامل شود.
 *
 * ── دو درسی که از شکست نسخه‌ی قبل گرفته شد ──
 *
 * ۱. **وجود کوکی ≠ ورود موفق.** نسخه‌ی قبل به‌محض دیدن sessionid و ds_user_id
 *    پنجره را می‌بست. اما این کوکی‌ها می‌توانند از یک تلاش ناموفق قبلی، یا از
 *    نشست ناشناس اینستاگرام مانده باشند. نتیجه: پنجره قبل از اینکه کاربر فرصت
 *    تایپ پیدا کند بسته می‌شد و بعد خطای «نشست نامعتبر» می‌آمد.
 *    حالا قبل از بستن، نشست را با یک فراخوانی واقعی *تأیید* می‌کنیم.
 *
 * ۲. **خطای بارگذاری نباید پنجره را ببندد.** نسخه‌ی قبل روی هر خطای بارگذاری
 *    پنجره را می‌بست. روی VPN — که برای دسترسی به اینستاگرام لازم است — خطای
 *    گذرای ERR_NETWORK_CHANGED کاملاً عادی است. حالا فقط ثبت می‌شود و کاربر
 *    می‌تواند داخل همان پنجره دوباره تلاش کند.
 */
export function loginWithInstagramWindow(opts: WebLoginOptions = {}): Promise<WebLoginResult> {
  const { parent, verify, timeoutMs = 10 * 60 * 1000 } = opts

  return new Promise<WebLoginResult>((resolve, reject) => {
    const ses = electronSession.fromPartition(PARTITION)
    const userAgent = browserLikeUserAgent(ses.getUserAgent())

    const win = new BrowserWindow({
      width: 520,
      height: 780,
      parent,
      modal: !!parent,
      autoHideMenuBar: true,
      title: 'ورود به اینستاگرام — بعد از ورود، این پنجره خودکار بسته می‌شود',
      backgroundColor: '#ffffff',
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    win.webContents.setUserAgent(userAgent)

    let settled = false
    let checking = false
    let poller: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null
    /** کوکی‌هایی که قبلاً تأیید نشدند — دوباره امتحانشان نمی‌کنیم */
    const rejectedSessionIds = new Set<string>()
    let lastFailure = ''

    const cleanup = (): void => {
      if (poller) clearInterval(poller)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      poller = null
      timeoutTimer = null
    }

    const succeed = (result: WebLoginResult): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
      if (!win.isDestroyed()) win.close()
    }

    const failNow = (err: WebLoginError): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
      if (!win.isDestroyed()) win.close()
    }

    const checkCookies = async (): Promise<void> => {
      if (settled || checking) return
      checking = true
      try {
        const all = await ses.cookies.get({ domain: '.instagram.com' })
        const map = toMap(all)
        if (!hasRequired(map)) return

        const sid = map.sessionid
        if (rejectedSessionIds.has(sid)) return // این نشست را قبلاً امتحان کردیم

        const result: WebLoginResult = { cookies: map as WebSessionCookies, userAgent }

        if (!verify) {
          succeed(result)
          return
        }

        const valid = await verify(result).catch((e: Error) => {
          lastFailure = e.message
          return false
        })

        if (valid) {
          succeed(result)
        } else {
          // نشست معتبر نبود: علامتش می‌زنیم و پنجره را *باز می‌گذاریم* تا
          // کاربر ورودش را کامل کند
          rejectedSessionIds.add(sid)
        }
      } catch {
        // خطای خواندن کوکی گذراست؛ دور بعد دوباره
      } finally {
        checking = false
      }
    }

    poller = setInterval(() => void checkCookies(), 1500)
    win.webContents.on('did-navigate', () => void checkCookies())
    win.webContents.on('did-navigate-in-page', () => void checkCookies())

    win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return
      // پنجره را نمی‌بندیم: روی VPN خطای گذرا عادی است و کاربر می‌تواند
      // داخل همان پنجره رفرش کند یا صبر کند تا اتصال برگردد
      lastFailure = desc + ' (' + url + ')'
    })

    timeoutTimer = setTimeout(() => {
      failNow(
        new WebLoginError(
          'زمان ورود تمام شد',
          lastFailure
            ? 'آخرین مشکل: ' + lastFailure
            : 'ورود در مهلت مقرر کامل نشد. دوباره تلاش کنید.'
        )
      )
    }, timeoutMs)

    win.on('closed', () => {
      if (settled) return
      settled = true
      cleanup()
      reject(
        new WebLoginError(
          'پنجره‌ی ورود بسته شد',
          lastFailure
            ? 'آخرین مشکل: ' + lastFailure
            : 'ورود کامل نشد. اگر وارد شده بودید ولی پنجره بسته نشد، دوباره تلاش کنید.'
        )
      )
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
