import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { requireUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { planById, toman } from '@/lib/plans'

export const metadata: Metadata = { title: 'پرداخت' }

export default async function ManualPay({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: id } = await searchParams
  const user = await requireUser('/pay/manual?plan=' + (id ?? 'm1'))
  const plan = planById(id ?? 'm1') ?? planById('m1')!
  return (
    <AuthShell title={`اشتراک ${plan.title}`} sub="درگاه آنلاین به‌زودی فعال می‌شود. فعلاً با کارت‌به‌کارت پرداخت کنید؛ اشتراک دستی فعال می‌شود.">
      <div className="space-y-4 text-[14px] leading-7">
        <p className="text-[28px] font-bold">{toman(plan.price ?? 0)}</p>
        {env.manualCard ? (
          <p className="rounded-2xl bg-ink p-4">
            شماره کارت: <b dir="ltr" className="tracking-wider">{env.manualCard}</b>
          </p>
        ) : (
          <p className="rounded-2xl bg-ink p-4 text-mist">اطلاعات پرداخت هنوز ثبت نشده؛ با پشتیبانی تماس بگیرید.</p>
        )}
        <p className="text-mist">
          بعد از واریز، تصویر رسید را همراه نام کاربری <b dir="ltr" className="text-haze">{user.username}</b> بفرستید
          {env.manualContact ? <> به <b className="text-haze">{env.manualContact}</b></> : ''}.
        </p>
        <Link href="/dashboard" className="btn btn-ghost w-full">برگشت به پنل</Link>
      </div>
    </AuthShell>
  )
}
