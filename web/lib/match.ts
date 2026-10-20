/** یکسان‌سازی متن فارسی برای تطبیق کلیدواژه — همان منطق اپ دسکتاپ */
export function normalize(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ٟ‌‏‎]/g, '')
    .toLowerCase()
    .trim()
}

export const splitKeywords = (k: string): string[] =>
  k
    .split(/[,،\n]/)
    .map((x) => normalize(x))
    .filter(Boolean)

/**
 * خالی یا * یعنی هر پیامی. کلیدواژه‌ی عددی فقط با خود عدد جور می‌شود (تا «۱۰»
 * قانونِ «۱» را روشن نکند)؛ بقیه اگر داخل متن باشند.
 */
export function matches(keywords: string, text: string): boolean {
  const list = splitKeywords(keywords)
  if (list.length === 0 || list.includes('*')) return true
  const t = normalize(text)
  const bare = t.replace(/[\s.!?؟،,]+/g, '')
  return list.some((k) => (/^\d+$/.test(k) ? bare === k : t.includes(k)))
}

export const fill = (tpl: string, username?: string): string =>
  tpl.replace(/\{\{?\s*username\s*\}?\}/g, username ? '@' + username : '')
