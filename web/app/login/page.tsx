import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { AuthShell } from '@/components/AuthShell'
import { loginAction } from '@/lib/actions-auth'
import { currentUser } from '@/lib/auth'
import { getDict, localize, lp } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.auth.loginTitle }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { lang, t } = await getDict()
  const next = localize(lang, (await searchParams).next ?? '/dashboard')
  if (await currentUser().catch(() => null)) redirect(next)
  return (
    <AuthShell title={t.auth.loginTitle} sub={t.auth.loginSub} lang={lang} t={t} path="/login">
      <AuthForm mode="login" action={loginAction} next={next} t={t.auth} otherHref={lp(lang, '/signup')} />
    </AuthShell>
  )
}
