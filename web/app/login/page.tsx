import type { Metadata } from 'next'
import { AuthForm } from '@/components/AuthForm'
import { AuthShell } from '@/components/AuthShell'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { loginAction } from '@/lib/actions-auth'

export const metadata: Metadata = { title: 'ورود' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  if (await currentUser().catch(() => null)) redirect(next ?? '/dashboard')
  return (
    <AuthShell title="ورود به پنل" sub="با نام کاربری و رمزی که موقع ثبت‌نام ساختید.">
      <AuthForm mode="login" action={loginAction} next={next ?? '/dashboard'} />
    </AuthShell>
  )
}
