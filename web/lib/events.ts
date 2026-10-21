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
  const u = d.u ? '@' + d.u : fa ? 'یک کاربر' : 'someone'
  const lines: Record<string, [string, string]> = {
    comment: [`کامنت ${q(d.t)} از ${u} ← دایرکت رفت`, `Comment ${q(d.t)} from ${u} → DM sent`],
    dm: [`دایرکت ${q(d.t)} ← جواب رفت`, `DM ${q(d.t)} → reply sent`],
    first_dm: ['اولین پیام یک مخاطب تازه ← پیام خوشامد رفت', 'First message from a new contact → welcome sent'],
    story: ['جواب به استوری ← پیام رفت', 'Story reply → message sent'],
    mention: ['منشن در استوری ← پیام تشکر رفت', 'Story mention → thank-you sent'],
    gate: [`${u} هنوز فالو نکرده ← پیام «اول فالو کن» رفت`, `${u} isn’t following yet → “follow first” message sent`],
    form: [`فرم ${q(d.t)} توسط ${u} کامل شد`, `${u} completed the form ${q(d.t)}`],
    catalog: [`درخواست ${q(d.t)} ← ویترین محصولات رفت`, `${q(d.t)} → product showcase sent`],
    ai: [`دایرکت ${q(d.t)} ← هوش مصنوعی جواب داد`, `DM ${q(d.t)} → AI replied`],
    moderation: [`کامنت ${q(d.t)} از ${u} مخفی شد`, `Comment ${q(d.t)} from ${u} was hidden`],
    broadcast: [`پیام گروهی به ${d.t} نفر رفت`, `Broadcast sent to ${d.t} people`]
  }
  const l = lines[kind]
  return l ? l[fa ? 0 : 1] : detail
}
