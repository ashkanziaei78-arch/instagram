import type { Dict } from '@/lib/dict'
import type { Lang } from '@/lib/i18n'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function Legal({
  lang,
  t,
  path,
  title,
  children
}: {
  lang: Lang
  t: Dict
  path: string
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader lang={lang} t={t} path={path} />
      <main className="wrap max-w-3xl py-12">
        <h1 className="text-[32px] font-bold">{title}</h1>
        <p className="mt-2 text-[13px] text-dim">
          {t.legal.updated} {t.legal.date}
        </p>
        <div className="mt-8 space-y-5 text-[15px] font-light leading-8 text-mist [&_a]:underline [&_h2]:mt-10 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-haze [&_li]:ms-5 [&_li]:list-disc [&_strong]:text-haze">
          {children}
        </div>
      </main>
      <SiteFooter lang={lang} t={t} />
    </>
  )
}
