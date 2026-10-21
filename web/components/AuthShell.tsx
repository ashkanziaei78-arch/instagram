import type { Lang } from '@/lib/i18n'
import type { Dict } from '@/lib/dict'
import { lp } from '@/lib/i18n'
import { LangSwitch } from './LangSwitch'
import { Logo } from './Logo'

export function AuthShell({
  title,
  sub,
  lang,
  t,
  path,
  children
}: {
  title: string
  sub: string
  lang: Lang
  t: Dict
  /** برای دکمه‌ی تغییر زبان */
  path: string
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[80%] -translate-x-1/2 rounded-full bg-brand opacity-[0.18] blur-3xl" aria-hidden />
      <div className="absolute end-4 top-4">
        <LangSwitch lang={lang} path={path} label={t.nav.switchLang} />
      </div>
      <div className="relative w-full max-w-[400px]">
        <div className="mb-10 flex justify-center"><Logo href={lp(lang, '/')} /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-[24px] font-bold">{title}</h1>
          <p className="mb-7 mt-2 text-[14px] leading-7 text-mist">{sub}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
