import Link from 'next/link'
import { getDict, lp } from '@/lib/i18n'

export default async function NotFound() {
  const { lang, t } = await getDict()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" className="h-14 w-14 opacity-80" />
      <h1 className="text-[24px] font-bold">{t.notFound.title}</h1>
      <Link href={lp(lang, '/')} className="btn btn-ghost">{t.notFound.home}</Link>
    </main>
  )
}
