import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { requireUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { getDict, lp, money } from '@/lib/i18n'
import { planById } from '@/lib/plans'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.pay.title }
}

export default async function ManualPay({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: id } = await searchParams
  const user = await requireUser('/pay/manual?plan=' + (id ?? 'm1'))
  const { lang, t } = await getDict()
  const plan = planById(id ?? 'm1') ?? planById('m1')!
  return (
    <AuthShell lang={lang} t={t} path={'/pay/manual?plan=' + plan.id} title={t.pay.title + ' ' + t.pricing.plans[plan.id]} sub={t.pay.sub}>
      <div className="space-y-4 text-[14px] leading-7">
        <p className="text-[28px] font-bold">{money(lang, plan.price ?? 0)}</p>
        {env.manualCard ? (
          <p className="rounded-2xl bg-ink p-4">
            {t.pay.card} <b dir="ltr" className="tracking-wider">{env.manualCard}</b>
          </p>
        ) : (
          <p className="rounded-2xl bg-ink p-4 text-mist">{t.pay.noCard}</p>
        )}
        <p className="text-mist">
          {t.pay.after1}
          <b dir="ltr" className="text-haze">{user.username}</b>
          {env.manualContact ? (
            <>
              {t.pay.to}
              <b className="text-haze">{env.manualContact}</b>
            </>
          ) : null}
          {t.pay.after2}.
        </p>
        <Link href={lp(lang, '/dashboard')} className="btn btn-ghost w-full">{t.pay.back}</Link>
      </div>
    </AuthShell>
  )
}
