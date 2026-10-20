'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { AuthState } from '@/lib/actions-auth'

export function AuthForm({
  mode,
  action,
  next
}: {
  mode: 'login' | 'signup'
  action: (s: AuthState, f: FormData) => Promise<AuthState>
  next: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const signup = mode === 'signup'
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="username">نام کاربری</label>
        <input
          id="username"
          name="username"
          dir="ltr"
          className="input text-left"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="mahtab.shop"
        />
        {signup && <p className="mt-1.5 text-[12px] text-dim">حروف انگلیسی کوچک، عدد، نقطه یا _</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">رمز</label>
        <input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          className="input text-left"
          autoComplete={signup ? 'new-password' : 'current-password'}
          minLength={signup ? 8 : undefined}
          required
        />
        {signup && <p className="mt-1.5 text-[12px] text-dim">دست‌کم ۸ کاراکتر — این رمز دایرکتینو است، نه رمز اینستاگرام</p>}
      </div>
      {state.error && (
        <p role="alert" className="rounded-2xl border border-magenta/30 bg-magenta/10 px-4 py-3 text-[14px] text-haze">
          {state.error}
        </p>
      )}
      <button className="btn btn-brand h-12 w-full text-[16px]" disabled={pending}>
        {pending ? 'صبر کنید…' : signup ? 'ساخت حساب' : 'ورود'}
      </button>
      <p className="text-center text-[14px] text-mist">
        {signup ? 'حساب دارید؟ ' : 'حساب ندارید؟ '}
        <Link href={(signup ? '/login' : '/signup') + '?next=' + encodeURIComponent(next)} className="font-bold text-haze underline-offset-4 hover:underline">
          {signup ? 'وارد شوید' : 'ثبت‌نام کنید'}
        </Link>
      </p>
    </form>
  )
}
