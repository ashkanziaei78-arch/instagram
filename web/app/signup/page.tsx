import type { Metadata } from 'next'
import { AuthForm } from '@/components/AuthForm'
import { AuthShell } from '@/components/AuthShell'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { signupAction } from '@/lib/actions-auth'

export const metadata: Metadata = { title: 'ثبت‌نام' }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  if (await currentUser().catch(() => null)) redirect(next ?? '/dashboard')
  return (
    <AuthShell title="ساخت حساب" sub="یک نام کاربری و رمز برای دایرکتینو بسازید. با همین وارد پنل موبایل و نسخه‌ی ویندوز می‌شوید.">
      <AuthForm mode="signup" action={signupAction} next={next ?? '/dashboard'} />
    </AuthShell>
  )
}
