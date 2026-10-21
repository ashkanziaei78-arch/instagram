import type { Lang } from './i18n'

/**
 * رویدادها ساختاری ذخیره می‌شوند ({t: متن، u: کاربر}) و موقع نمایش به زبان
 * پنل ترجمه می‌شوند. خطاها متن خام خطای اینستاگرام‌اند.
 */
export function eventText(lang: Lang, kind: string, ok: boolean, detail: string): string {
  let d: { t?: string; u?: string; e?: string }
  try {
    d = JSON.parse(detail)
  } catch {
    return detail
  }
  if (typeof d !== 'object' || d === null) return detail
  const fa = lang === 'fa'
  if (d.e === 'expired') return fa ? 'اشتراک تمام شده — پیامی فرستاده نشد' : 'Subscription expired — nothing was sent'
  if (!ok) return detail
  const q = (x?: string) => (fa ? `«${x ?? ''}»` : `“${x ?? ''}”`)
  switch (kind) {
    case 'comment':
      return fa ? `کامنت ${q(d.t)} از @${d.u} ← دایرکت رفت` : `Comment ${q(d.t)} from @${d.u} → DM sent`
    case 'dm':
      return fa ? `دایرکت ${q(d.t)} ← جواب رفت` : `DM ${q(d.t)} → reply sent`
    case 'story':
      return fa ? 'جواب به استوری ← پیام رفت' : 'Story reply → message sent'
    case 'mention':
      return fa ? 'منشن در استوری ← پیام تشکر رفت' : 'Story mention → thank-you sent'
    default:
      return detail
  }
}
