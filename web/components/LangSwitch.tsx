import { lp, type Lang } from '@/lib/i18n'

/**
 * همان صفحه به زبان دیگر.
 *
 * عمداً <a> ساده و نه Link: با ناوبری سمت کاربر، Next لایه‌ی ریشه را دوباره
 * نمی‌سازد و lang/dir و فونتِ <html> زبان قبلی می‌ماند. بارگذاری کامل لازم است.
 */
export function LangSwitch({ lang, path, label }: { lang: Lang; path: string; label: string }) {
  const other: Lang = lang === 'fa' ? 'en' : 'fa'
  return (
    <a
      href={lp(other, path)}
      hrefLang={other}
      lang={other}
      className="rounded-full px-2.5 py-1 text-[13px] text-mist transition hover:bg-white/[0.05] hover:text-haze"
    >
      {label}
    </a>
  )
}
