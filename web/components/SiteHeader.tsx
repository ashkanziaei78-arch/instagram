import Link from 'next/link'
import { lp, type Lang } from '@/lib/i18n'
import type { Dict } from '@/lib/dict'
import { LangSwitch } from './LangSwitch'
import { Logo } from './Logo'

export function SiteHeader({ lang, t, path = '/' }: { lang: Lang; t: Dict; path?: string }) {
  const home = lp(lang, '/')
  const anchor = (id: string) => (path === '/' ? '#' + id : home + '#' + id)
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-ink/75 backdrop-blur-xl">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo href={home} />
        <nav className="hidden items-center gap-6 text-[14px] text-mist lg:flex">
          <a href={anchor('how')} className="hover:text-haze">{t.nav.how}</a>
          <a href={anchor('features')} className="hover:text-haze">{t.nav.templates}</a>
          <a href={anchor('safety')} className="hover:text-haze">{t.nav.safety}</a>
          <a href={anchor('pricing')} className="hover:text-haze">{t.nav.pricing}</a>
          <a href={anchor('faq')} className="hover:text-haze">{t.nav.faq}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitch lang={lang} path={path} label={t.nav.switchLang} />
          <Link href={lp(lang, '/login')} className="btn btn-ghost btn-sm">{t.nav.login}</Link>
          <Link href={lp(lang, '/signup')} className="btn btn-brand btn-sm hidden sm:inline-flex">{t.nav.signup}</Link>
        </div>
      </div>
    </header>
  )
}
