/**
 * OAuth از مرورگر خودِ کاربر — روشی که سرویس‌های ایرانی مثل Inzy استفاده می‌کنند.
 *
 * ── مسئله ──
 * جریان استاندارد OAuth، صفحه‌ی ورود اینستاگرام را داخل خود اپ باز می‌کند. برای
 * کاربری که پشت فیلتر است این یعنی *شبکه‌ی اپ* باید به اینستاگرام برسد — و
 * معمولا نمی‌رسد، چون VPN فقط روی مرورگر تنظیم شده یا اتصال داخل اپ ناپایدار است.
 *
 * ── راه‌حل ──
 * کاربر لینک را در **مرورگر خودش** باز می‌کند (جایی که اینستاگرام باز می‌شود)،
 * اجازه را می‌دهد، و آدرسی که به آن هدایت شده را برمی‌گرداند داخل اپ. کد
 * یک‌بارمصرف داخل همان آدرس است.
 *
 * ── چرا سرویس‌های آنلاین این مرحله را ندارند ──
 * آن‌ها یک سرور دارند که redirect_uri به آن اشاره می‌کند، پس کد خودش می‌رسد.
 * اپ دسکتاپ سروری ندارد، پس کاربر نقش پیک را بازی می‌کند. در عوض، هیچ داده‌ای
 * از کامپیوتر کاربر بیرون نمی‌رود.
 */

export class ManualOAuthError extends Error {
  constructor(
    message: string,
    public hint?: string
  ) {
    super(message)
    this.name = 'ManualOAuthError'
  }
}

/**
 * استخراج کد از هر چیزی که کاربر بچسباند.
 *
 * عمدا سخت‌گیر نیستیم: کاربر ممکن است کل آدرس را کپی کند، یا فقط کد را، یا
 * آدرسی که مرورگر «این سایت در دسترس نیست» نشانش داده. هر سه باید کار کند،
 * چون این مرحله دستی است و اشتباه در کپی، رایج‌ترین نقطه‌ی شکست است.
 */
export function extractAuthCode(raw: string): string {
  const input = (raw ?? '').trim()
  if (!input) {
    throw new ManualOAuthError('چیزی وارد نشده', 'آدرسی که بعد از زدن «Allow» به آن رسیدید را بچسبانید')
  }

  // حالت ۱: کل آدرس بازگشت
  if (/^https?:\/\//i.test(input)) {
    let url: URL
    try {
      url = new URL(input)
    } catch {
      throw new ManualOAuthError('آدرس معتبر نیست', 'کل آدرس را از نوار آدرس مرورگر کپی کنید')
    }

    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description') ?? url.searchParams.get('error_reason')
    if (error) {
      throw new ManualOAuthError(
        'اینستاگرام اجازه نداد: ' + (errorDesc ?? error),
        'اگر روی Cancel زدید، دوباره لینک را باز کنید و این بار Allow را بزنید'
      )
    }

    const code = url.searchParams.get('code')
    if (!code) {
      throw new ManualOAuthError(
        'در این آدرس کدی پیدا نشد',
        'مطمئن شوید آدرسِ *بعد* از زدن Allow را کپی کرده‌اید — باید داخلش «code=» داشته باشد'
      )
    }
    // اینستاگرام «#_» را به انتهای کد اضافه می‌کند
    return code.replace(/#_$/, '')
  }

  // حالت ۲: فقط بخش query یا کد خام
  const m = input.match(/[?&]code=([^&\s]+)/)
  if (m) return decodeURIComponent(m[1]).replace(/#_$/, '')

  // حالت ۳: کد خام — کدهای اینستاگرام طولانی و بدون فاصله‌اند
  if (/^[A-Za-z0-9_.-]{20,}$/.test(input)) {
    return input.replace(/#_$/, '')
  }

  throw new ManualOAuthError(
    'این متن شبیه آدرس بازگشت یا کد نیست',
    'کل آدرس نوار مرورگر را بعد از زدن Allow کپی کنید — چیزی شبیه https://…?code=AQB…'
  )
}
