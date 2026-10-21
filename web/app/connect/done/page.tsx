import type { Metadata } from 'next'
import { AuthShell } from '@/components/AuthShell'
import { getDict } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.done.title }
}

export default async function Done({ searchParams }: { searchParams: Promise<{ status?: string; u?: string }> }) {
  const { lang, t } = await getDict()
  const { status, u } = await searchParams
  const ok = status === 'ok'
  return (
    <AuthShell
      lang={lang}
      t={t}
      path="/connect/done"
      title={ok ? t.done.okTitle : t.done.badTitle}
      sub={ok ? t.done.ok(u ?? '') : status === 'denied' ? t.done.denied : t.done.error}
    >
      <p className="text-center text-[56px]">{ok ? '✓' : '×'}</p>
    </AuthShell>
  )
}
