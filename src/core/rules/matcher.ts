import type { MatchMode, Rule } from '../../shared/types'
import { normalizeText, normalizeLoose, toLatinDigits } from '../text'

export interface MatchResult {
  matched: boolean
  /** کدام کلیدواژه باعث تطبیق شد (برای لاگ و دیباگ) */
  keyword?: string
  reason?: string
}

/** کلیدواژه‌های ذخیره‌شده (رشته‌ی جداشده با کاما یا خط جدید) را به آرایه تبدیل می‌کند */
export function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n،]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
}

/**
 * آیا متن شامل این کلیدواژه به عنوان یک «کلمه‌ی کامل» است؟
 *
 * چرا این مهم است: اگر کلیدواژه «کد» باشد، کامنت «کدوم رنگ؟» نباید تریگر شود.
 * مرزبندی با \b برای فارسی کار نمی‌کند (حروف فارسی از نظر regex جزء \w نیستند
 * در حالت پیش‌فرض)، پس دستی با فاصله مرزبندی می‌کنیم.
 */
function containsWholeWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  const padded = ' ' + haystack + ' '
  return padded.includes(' ' + needle + ' ')
}

/**
 * حالت «عدد»: فقط اگر کاربر آن عدد را به تنهایی (یا به عنوان یک توکن مستقل)
 * نوشته باشد تطبیق می‌دهد.
 *
 * تصمیم طراحی مهم: کامنت «10» نباید قانونِ عدد «1» را فعال کند. اگر با
 * includes ساده کار می‌کردیم، هر کسی که «10» می‌نوشت پاسخِ «1» را می‌گرفت.
 * پس عدد را به صورت توکن کامل مقایسه می‌کنیم.
 */
function matchNumber(text: string, keywords: string[]): MatchResult {
  const normalized = normalizeText(text)
  const tokens = normalized.split(' ').filter(Boolean)

  for (const kw of keywords) {
    const target = toLatinDigits(kw).trim()
    if (!target) continue
    if (tokens.includes(target)) {
      return { matched: true, keyword: kw, reason: 'عدد «' + target + '» به صورت توکن مستقل پیدا شد' }
    }
  }
  return { matched: false, reason: 'هیچ‌یک از اعداد به صورت توکن مستقل در کامنت نبود' }
}

/**
 * تطبیق یک متن با یک قانون.
 * text می‌تواند متن کامنت، متن دایرکت یا هر ورودی کاربر باشد.
 */
export function matchText(text: string, mode: MatchMode, keywords: string[], caseSensitive = false): MatchResult {
  if (mode === 'number') return matchNumber(text, keywords)

  if (mode === 'regex') {
    for (const kw of keywords) {
      try {
        const re = new RegExp(kw, caseSensitive ? 'u' : 'iu')
        if (re.test(text)) return { matched: true, keyword: kw, reason: 'regex تطبیق یافت' }
      } catch {
        // الگوی معیوب نباید کل پردازش را بخواباند
        continue
      }
    }
    return { matched: false, reason: 'هیچ regex ای تطبیق نیافت' }
  }

  const hay = normalizeText(text, { keepCase: caseSensitive })
  // نسخه‌ی بدون فاصله، برای پوشش تفاوت نیم‌فاصله (قیمت‌ها / قیمتها / قیمت ها)
  const hayLoose = normalizeLoose(text, { keepCase: caseSensitive })

  for (const kw of keywords) {
    const needle = normalizeText(kw, { keepCase: caseSensitive })
    if (!needle) continue
    const needleLoose = normalizeLoose(kw, { keepCase: caseSensitive })

    switch (mode) {
      case 'exact':
        if (hay === needle) return { matched: true, keyword: kw, reason: 'متن کاملا برابر است' }
        if (hayLoose === needleLoose) {
          return { matched: true, keyword: kw, reason: 'برابر است (نادیده‌گرفتن نیم‌فاصله)' }
        }
        break
      case 'starts_with':
        if (hay.startsWith(needle)) {
          return { matched: true, keyword: kw, reason: 'متن با کلیدواژه شروع می‌شود' }
        }
        if (hayLoose.startsWith(needleLoose)) {
          return { matched: true, keyword: kw, reason: 'با کلیدواژه شروع می‌شود (نادیده‌گرفتن نیم‌فاصله)' }
        }
        break
      case 'contains':
      default:
        // اول کلمه‌ی کامل را امتحان می‌کنیم (دقیق‌تر)، بعد زیررشته‌ی ساده
        if (containsWholeWord(hay, needle)) {
          return { matched: true, keyword: kw, reason: 'کلیدواژه به صورت کلمه‌ی کامل پیدا شد' }
        }
        // برای کلیدواژه‌های چندکلمه‌ای یا چسبیده به علائم
        if (needle.includes(' ') && hay.includes(needle)) {
          return { matched: true, keyword: kw, reason: 'عبارت چندکلمه‌ای پیدا شد' }
        }
        // حالت شل: تفاوت نیم‌فاصله را می‌پوشاند. عمدا فقط برای کلیدواژه‌های
        // بلندتر از ۳ حرف، چون بدون مرز فاصله احتمال تطبیق کاذب بالا می‌رود.
        if (needleLoose.length > 3 && hayLoose.includes(needleLoose)) {
          return { matched: true, keyword: kw, reason: 'پیدا شد (نادیده‌گرفتن نیم‌فاصله)' }
        }
        break
    }
  }

  return { matched: false, reason: 'هیچ کلیدواژه‌ای تطبیق نیافت' }
}

/** آیا این قانون به این پست اعمال می‌شود؟ (media_scope خالی = همه‌ی پست‌ها) */
export function ruleAppliesToMedia(rule: Rule, mediaId: string | undefined): boolean {
  if (!rule.media_scope || rule.media_scope.trim() === '') return true
  if (!mediaId) return false
  return rule.media_scope
    .split(',')
    .map((s) => s.trim())
    .includes(mediaId)
}

export interface RuleMatch {
  rule: Rule
  keyword?: string
  reason?: string
}

/**
 * از میان قوانین فعال، اولین قانونی که تطبیق می‌دهد را برمی‌گرداند.
 *
 * ترتیب اهمیت دارد: قوانین از قبل بر اساس priority نزولی مرتب شده‌اند، پس
 * «اولین تطبیق» یعنی «تطبیقِ با بالاترین اولویت». این عمدی است — اگر کامنتی
 * هم «۱» داشت و هم «قیمت»، باید تصمیم بگیریم کدام برنده شود، و اولویتِ
 * دستیِ کاربر قابل‌پیش‌بینی‌ترین معیار است (به‌جای مثلا «طولانی‌ترین کلیدواژه»).
 */
export function findMatchingRule(
  rules: Rule[],
  text: string,
  mediaId?: string
): RuleMatch | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!ruleAppliesToMedia(rule, mediaId)) continue

    if (rule.trigger_type === 'comment_any') {
      return { rule, reason: 'قانون روی همه‌ی کامنت‌ها اعمال می‌شود' }
    }

    const keywords = parseKeywords(rule.keywords)
    if (keywords.length === 0) continue

    const res = matchText(text, rule.match_mode, keywords, rule.case_sensitive)
    if (res.matched) return { rule, keyword: res.keyword, reason: res.reason }
  }
  return null
}
