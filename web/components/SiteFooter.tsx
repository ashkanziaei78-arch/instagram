import Link from 'next/link'
import { IMAGES } from '@/lib/images'
import { lp, type Lang } from '@/lib/i18n'
import type { Dict } from '@/lib/dict'

export function SiteFooter({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <footer className="border-t border-white/[0.06] py-10 text-[13px] text-dim">
      <div className="wrap flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-light.png" alt="Directino" className="h-5 w-auto opacity-80" />
          <p>{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={lp(lang, '/privacy')} className="hover:text-mist">{t.footer.privacy}</Link>
          <Link href={lp(lang, '/terms')} className="hover:text-mist">{t.footer.terms}</Link>
          <Link href={lp(lang, '/data-deletion')} className="hover:text-mist">{t.footer.deletion}</Link>
          <Link href={lp(lang, '/login')} className="hover:text-mist">{t.footer.customers}</Link>
        </nav>
      </div>
      <div className="wrap mt-6 text-[11px] leading-6 text-dim/80">
        {t.footer.disclaimer}{' '}
        {Object.values(IMAGES)
          .filter((i) => !i.licensed)
          .map((i) => i.credit)
          .join(lang === 'fa' ? '، ' : ', ')}
      </div>
    </footer>
  )
}
