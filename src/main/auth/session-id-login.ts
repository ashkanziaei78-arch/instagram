import { randomBytes } from 'node:crypto'

/**
 * ورود با کد نشست — ساده‌ترین و مقاوم‌ترین مسیر.
 *
 * چرا این روش وجود دارد: دو مسیر دیگر هر کدام یک نقطه‌ی شکست دارند که از کنترل
 * ما بیرون است —
 *   • اپ متا: با IP ایران، فیسبوک برای ساخت اپ شماره‌ی تلفن می‌خواهد.
 *   • پنجره‌ی ورود داخل اپ: به اتصال شبکه‌ی خود اپ وابسته است و روی VPN گاهی
 *     صفحه بالا نمی‌آید.
 *
 * این روش هر دو را دور می‌زند: کاربر در **مرورگر خودش** — که از قبل وارد
 * اینستاگرام است و VPN اش کار می‌کند — یک مقدار را کپی می‌کند و اینجا می‌چسباند.
 *
 * نکته‌ی کلیدی که این را واقعاً ساده می‌کند: خودِ sessionid شناسه‌ی کاربر را
 * در خودش دارد. فرمتش «<user_id>%3A<توکن>%3A<عدد>…» است، پس فقط همین یک مقدار
 * کافی است و لازم نیست کاربر چند کوکی را جدا جدا پیدا کند.
 */

export class SessionIdError extends Error {
  constructor(
    message: string,
    public hint?: string
  ) {
    super(message)
    this.name = 'SessionIdError'
  }
}

export interface ParsedSessionId {
  sessionid: string
  ds_user_id: string
}

/**
 * ورودی کاربر را تمیز می‌کند و شناسه‌ی کاربر را از آن بیرون می‌کشد.
 *
 * عمداً سخت‌گیر نیستیم در *شکل* ورودی: کاربر ممکن است فقط مقدار را کپی کند،
 * یا «sessionid=...» را، یا کل رشته‌ی کوکی‌ها را با نقطه‌ویرگول. هر سه را
 * می‌پذیریم — چون اشتباه در کپی‌کردن رایج‌ترین نقطه‌ی شکست این روش است.
 */
export function parseSessionId(raw: string): ParsedSessionId {
  let value = (raw ?? '').trim()

  if (!value) {
    throw new SessionIdError('چیزی وارد نشده', 'مقدار sessionid را از مرورگر کپی کنید')
  }

  // حالت «کل کوکی‌ها با ; جدا شده» یا «sessionid=xxx»
  if (value.includes('sessionid=')) {
    const m = value.match(/sessionid=([^;\s]+)/)
    if (m) value = m[1]
  }

  // گیومه‌های احتمالی از کپی‌کردن از DevTools
  value = value.replace(/^["']|["']$/g, '').trim()

  if (!value) {
    throw new SessionIdError('مقدار sessionid خالی است')
  }

  // شناسه‌ی کاربر = ارقام ابتدای مقدار، تا اولین جداکننده.
  // جداکننده در مقدار خام «%3A» است و در مقدار دیکدشده «:».
  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()

  const m = decoded.match(/^(\d{3,})\s*:/)
  if (!m) {
    throw new SessionIdError(
      'این مقدار شبیه sessionid اینستاگرام نیست',
      'sessionid با شماره‌ی حساب شروع می‌شود، مثل «12345678%3AabcDEF…». مطمئن شوید همان ردیف sessionid را کپی کرده‌اید، نه csrftoken یا mid.'
    )
  }

  return { sessionid: value, ds_user_id: m[1] }
}

/**
 * ساخت مجموعه‌ی کامل کوکی‌ها از روی sessionid.
 *
 * csrftoken برای درخواست‌های نوشتنی (ارسال دایرکت، پاسخ کامنت) لازم است.
 * اول تلاش می‌کنیم واقعی‌اش را از خود اینستاگرام بگیریم؛ اگر شبکه اجازه نداد،
 * یک مقدار تصادفی می‌سازیم — چون اینستاگرام فقط بررسی می‌کند که هدر
 * X-CSRFToken با کوکی csrftoken یکی باشد، و هر دو را خودمان می‌فرستیم.
 */
export async function buildCookiesFromSessionId(
  parsed: ParsedSessionId,
  userAgent: string
): Promise<Record<string, string>> {
  const cookies: Record<string, string> = {
    sessionid: parsed.sessionid,
    ds_user_id: parsed.ds_user_id
  }

  try {
    const res = await fetch('https://www.instagram.com/', {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'sessionid=' + parsed.sessionid + '; ds_user_id=' + parsed.ds_user_id
      }
    })

    // getSetCookie در Node 20+ موجود است؛ اگر نبود به هدر تکی برمی‌گردیم
    const setCookies: string[] =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
        : [res.headers.get('set-cookie') ?? '']

    for (const line of setCookies) {
      for (const name of ['csrftoken', 'mid', 'ig_did', 'rur']) {
        const m = line.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
        if (m && !cookies[name]) cookies[name] = m[1]
      }
    }
  } catch {
    // شبکه در دسترس نبود — با مقدار ساختگی ادامه می‌دهیم
  }

  if (!cookies.csrftoken) {
    cookies.csrftoken = randomBytes(16).toString('hex')
  }

  return cookies
}

/** User-Agent مرورگرمانند برای درخواست‌ها */
export function defaultUserAgent(): string {
  return (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  )
}
