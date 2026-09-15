/**
 * ابزارهای متنی: نرمال‌سازی فارسی/عربی، spintax و قالب متغیرها.
 *
 * چرا نرمال‌سازی حیاتی است؟
 * کاربر ایرانی که روی پست شما کامنت می‌گذارد ممکن است «۱» (رقم فارسی)،
 * «١» (رقم عربی) یا «1» (لاتین) تایپ کند — و همه یک چیز را می‌خواهند.
 * همین‌طور «کی» با ی فارسی و «كي» با ك/ي عربی از نظر بایت متفاوت‌اند ولی
 * از نظر کاربر یکی هستند. بدون نرمال‌سازی، نصف تریگرها بی‌صدا از دست می‌روند.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** ارقام فارسی و عربی را به لاتین تبدیل می‌کند: «۱۲۳» → «123» */
export function toLatinDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const p = PERSIAN_DIGITS.indexOf(ch)
    if (p !== -1) {
      out += String(p)
      continue
    }
    const a = ARABIC_DIGITS.indexOf(ch)
    if (a !== -1) {
      out += String(a)
      continue
    }
    out += ch
  }
  return out
}

/**
 * نرمال‌سازی کامل برای مقایسه:
 *  - ارقام فارسی/عربی → لاتین
 *  - ي/ك عربی → ی/ک فارسی
 *  - حذف اعراب و نیم‌فاصله و کشیده
 *  - یکسان‌سازی فاصله‌ها
 *  - حذف ایموجی و علائم (تا «۱» و «۱️⃣» و «1.» یکی شوند)
 */
export function normalizeText(input: string, opts: { keepCase?: boolean; stripPunct?: boolean } = {}): string {
  let s = toLatinDigits(input)

  s = s
    .replace(/[يى]/g, 'ی') // ي ی
    .replace(/ك/g, 'ک') // ك
    .replace(/[أإآ]/g, 'ا') // أ إ آ
    .replace(/ة/g, 'ه') // ة
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // اعراب
    .replace(/ـ/g, '') // کشیده
    // نیم‌فاصله → فاصله. ترتیب مهم است: این خط باید *قبل* از حذف کاراکترهای
    // کنترلی بیاید، چون بازه‌ی ​-‏ خودِ ‌ را هم در بر می‌گیرد و
    // اگر جلوتر بیاید نیم‌فاصله حذف می‌شود نه تبدیل.
    .replace(/‌/g, ' ')
    .replace(/[​‍-‏‪-‮﻿]/g, '') // کنترلی‌های جهت‌دهی

  if (opts.stripPunct !== false) {
    // حذف ایموجی، نمادها و علائم نگارشی — فقط حرف، رقم و فاصله می‌ماند
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ')
  }

  s = s.replace(/\s+/g, ' ').trim()
  return opts.keepCase ? s : s.toLowerCase()
}

/**
 * نرمال‌سازی «شل»: همان normalizeText به‌اضافه‌ی حذف کامل فاصله‌ها.
 *
 * چرا لازم است؟ نیم‌فاصله را به فاصله تبدیل می‌کنیم تا مرز کلمه حفظ شود، اما
 * این یک عدم‌تقارن می‌سازد: «قیمت‌ها» → «قیمت ها» در حالی که «قیمتها» همان
 * می‌ماند، و این دو دیگر برابر نیستند — هرچند کاربر هر دو را یک کلمه می‌داند.
 * matcher اول با حالت دقیق مقایسه می‌کند و اگر نشد با این حالت شل، تا هر دو
 * جهت («قیمت‌ها» در برابر «قیمتها» و برعکس) پوشش داده شوند.
 */
export function normalizeLoose(input: string, opts: { keepCase?: boolean } = {}): string {
  return normalizeText(input, opts).replace(/\s+/g, '')
}

/**
 * Spintax: «{سلام|درود|وقت بخیر} دوست من» → یکی از سه حالت به تصادف.
 *
 * چرا لازم است؟ اینستاگرام ارسال عین‌به‌عین یک متن به دهها نفر را الگوی
 * اسپم می‌شناسد. تغییر تصادفی متن این ریسک را پایین می‌آورد.
 * از تودرتو هم پشتیبانی می‌کند: «{سلام {رفیق|دوست}|درود}»
 */
export function spin(template: string, rng: () => number = Math.random): string {
  let s = template
  let guard = 0

  // از درونی‌ترین گروه شروع می‌کنیم (گروهی که داخلش { ندارد).
  //
  // شرط «باید | داشته باشد» فقط یک بهینه‌سازی نیست، درست‌بودن را تضمین می‌کند:
  // قالب متغیرهای ما {{username}} است، که خودش یک {...} تلقی می‌شود. اگر گروه‌های
  // بدون | را هم باز کنیم، {{username}} به «username» تبدیل می‌شود و کاربر
  // پیام «سلام username جان» می‌گیرد. با این شرط، {{var}} دست‌نخورده رد می‌شود.
  const innermostWithPipe = /\{([^{}]*\|[^{}]*)\}/

  while (guard++ < 200) {
    const m = innermostWithPipe.exec(s)
    if (!m) break
    const options = m[1].split('|')
    const picked = options[Math.floor(rng() * options.length)] ?? ''
    s = s.slice(0, m.index) + picked + s.slice(m.index + m[0].length)
  }
  return s
}

export interface TemplateVars {
  username?: string
  name?: string
  full_name?: string
  post_caption?: string
  post_link?: string
  followers_count?: number | string
  [key: string]: string | number | undefined
}

/**
 * جای‌گذاری متغیرها: «سلام {{username}}» → «سلام ali»
 * متغیر ناموجود با رشته‌ی خالی جایگزین می‌شود، نه با «undefined».
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** خط لوله‌ی کامل متن پیام: اول spintax، بعد متغیرها، بعد پاک‌سازی فاصله */
export function buildMessage(template: string, vars: TemplateVars, rng?: () => number): string {
  return renderTemplate(spin(template, rng), vars).replace(/[ \t]+\n/g, '\n').trim()
}

/** تأخیر تصادفی انسانی بین دو عدد (ثانیه) به میلی‌ثانیه */
export function humanDelayMs(minSec: number, maxSec: number, rng: () => number = Math.random): number {
  const lo = Math.max(0, Math.min(minSec, maxSec))
  const hi = Math.max(minSec, maxSec)
  return Math.round((lo + rng() * (hi - lo)) * 1000)
}
