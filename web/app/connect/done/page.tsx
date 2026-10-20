import type { Metadata } from 'next'
import { AuthShell } from '@/components/AuthShell'

export const metadata: Metadata = { title: 'اتصال پیج' }

export default async function Done({ searchParams }: { searchParams: Promise<{ status?: string; u?: string }> }) {
  const { status, u } = await searchParams
  const ok = status === 'ok'
  return (
    <AuthShell
      title={ok ? 'پیج وصل شد' : 'اتصال انجام نشد'}
      sub={
        ok
          ? `@${u ?? ''} به اپ دایرکتینو وصل شد. این صفحه را ببندید و به اپ برگردید؛ خودش ادامه می‌دهد.`
          : status === 'denied'
            ? 'در صفحه‌ی اینستاگرام «اجازه» زده نشد. در اپ دوباره «اتصال رسمی» را بزنید.'
            : 'اینستاگرام اتصال را نپذیرفت. پیج باید حرفه‌ای (Business یا Creator) باشد. در اپ دوباره امتحان کنید.'
      }
    >
      <p className="text-center text-[56px]">{ok ? '✓' : '×'}</p>
    </AuthShell>
  )
}
