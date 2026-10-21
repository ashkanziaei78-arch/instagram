import type { Metadata } from 'next'
import Link from 'next/link'
import { DailyBars, HBars, type DayPoint } from '@/components/Charts'
import { daysLeft, isActive } from '@/lib/auth'
import { loadDash } from '@/lib/dash'
import { igReady, redirectUri } from '@/lib/env'
import { eventText } from '@/lib/events'
import { dateLong, dateTime, getDict, lp, money, num } from '@/lib/i18n'
import { PLANS } from '@/lib/plans'
import { disconnectAccount } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.dash.title }
}
export const dynamic = 'force-dynamic'

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { user, lang, t, sql, accounts } = await loadDash(sp)
  const d = t.dash
  const a = t.app
  const flashKey = Object.entries(sp)
    .map(([k, v]) => k + '=' + v)
    .find((k) => d.flash[k])
  const flashOk = !!flashKey && /=ok$|=added$/.test(flashKey)

  const [daily, byKind, topRules, events, [counts], [crm], [ruleCount]] = await Promise.all([
    sql<DayPoint[]>`
      select to_char(g.d, 'YYYY-MM-DD') as day, count(e.id)::int as count
      from generate_series(current_date - 29, current_date, interval '1 day') as g(d)
      left join dx_events e on e.user_id = ${user.id} and e.ok
        and e.kind not in ('skip', 'moderation', 'gate') and e.created_at::date = g.d::date
      group by g.d order by g.d`,
    sql<{ kind: string; n: number }[]>`
      select kind, count(*)::int as n from dx_events
      where user_id = ${user.id} and ok and kind <> 'skip' and created_at > now() - interval '30 days'
      group by kind order by n desc`,
    sql<{ label: string; hits: number }[]>`
      select coalesce(nullif(name, ''), nullif(left(keywords, 30), ''), trigger) as label, hits
      from dx_rules where user_id = ${user.id} and hits > 0 order by hits desc limit 5`,
    sql<{ id: string; kind: string; ok: boolean; detail: string; created_at: Date }[]>`
      select id, kind, ok, detail, created_at from dx_events where user_id = ${user.id} order by id desc limit 12`,
    sql<{ today: number; week: number; any_ok: boolean }[]>`
      select
        count(*) filter (where ok and created_at > now() - interval '1 day')::int as today,
        count(*) filter (where ok and created_at > now() - interval '7 days')::int as week,
        bool_or(ok) as any_ok
      from dx_events where user_id = ${user.id} and kind not in ('skip', 'moderation', 'gate')`,
    sql<{ contacts: number; leads: number }[]>`
      select count(*)::int as contacts, count(*) filter (where phone is not null or email is not null)::int as leads
      from dx_contacts c join dx_ig_accounts a on a.id = c.ig_account_id where a.user_id = ${user.id}`,
    sql<{ n: number }[]>`select count(*)::int as n from dx_rules where user_id = ${user.id}`
  ])

  const active = isActive(user)
  const left = daysLeft(user)
  const steps = [active, accounts.length > 0, ruleCount.n > 0, !!counts?.any_ok]
  const doneCount = steps.filter(Boolean).length
  const hasData = daily.some((x) => x.count > 0)

  return (
    <div className="space-y-4">
      {flashKey && (
        <p
          role="status"
          className={
            'rounded-2xl px-4 py-3 text-[14px] leading-7 ' +
            (flashOk ? 'border border-emerald-400/25 bg-emerald-400/10' : 'border border-magenta/30 bg-magenta/10')
          }
        >
          {d.flash[flashKey]}
        </p>
      )}

      {doneCount < steps.length && (
        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">{d.start.title}</h2>
            <span className="text-[13px] text-mist">
              {num(lang, doneCount)} {d.start.done} {num(lang, steps.length)}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-brand" style={{ width: (doneCount / steps.length) * 100 + '%' }} />
          </div>
          <ol className="mt-5 space-y-3">
            {d.start.steps.map((label, i) => (
              <li key={label} className="flex items-start gap-3 text-[14px]">
                <span
                  className={
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
                    (steps[i] ? 'bg-emerald-400/20 text-emerald-300' : 'border border-white/15 text-dim')
                  }
                >
                  {steps[i] ? '✓' : num(lang, i + 1)}
                </span>
                <span className={steps[i] ? 'text-dim line-through decoration-white/20' : 'text-haze'}>{label}</span>
              </li>
            ))}
          </ol>
          {steps[2] && !steps[3] && <p className="mt-4 text-[13px] leading-6 text-mist">{d.start.testHint}</p>}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* اشتراک */}
        <section className="card relative overflow-hidden p-6">
          {active && <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand opacity-25 blur-3xl" aria-hidden />}
          <p className="text-[13px] text-mist">{d.sub.label}</p>
          {active ? (
            <>
              <p className="mt-2 text-[44px] font-bold leading-none">
                {num(lang, left)} <span className="text-[18px] font-normal text-mist">{d.sub.left}</span>
              </p>
              <p className="mt-3 text-[14px] text-mist">
                {d.sub.until} {dateLong(lang, new Date(user.sub_until!))}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-brand" style={{ width: Math.min(100, (left / 90) * 100) + '%' }} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[24px] font-bold">{d.sub.inactive}</p>
              <p className="mt-2 text-[14px] leading-7 text-mist">{d.sub.inactiveBody}</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {PLANS.filter((p) => p.enabled && p.price).map((p) => (
              <Link key={p.id} href={'/checkout/' + p.id} className={'btn btn-sm ' + (p.id === 'm3' ? 'btn-brand' : 'btn-ghost')}>
                {active ? d.sub.renew : d.sub.buy} {t.pricing.plans[p.id]} — {money(lang, p.price!)}
              </Link>
            ))}
          </div>
        </section>

        {/* آمار */}
        <section className="grid grid-cols-2 gap-3">
          {[
            [d.stats.today, counts?.today ?? 0],
            [d.stats.week, counts?.week ?? 0],
            [a.charts.contacts, crm?.contacts ?? 0],
            [a.charts.leads, crm?.leads ?? 0]
          ].map(([label, value]) => (
            <div key={label as string} className="card flex flex-col justify-between p-5">
              <p className="text-[12px] leading-5 text-mist">{label}</p>
              <p className="mt-2 text-[30px] font-bold leading-none">{num(lang, value as number)}</p>
            </div>
          ))}
        </section>
      </div>

      {/* نمودارها */}
      <section className="card p-6">
        <h2 className="mb-4 text-[16px] font-bold">{a.charts.daily}</h2>
        {hasData ? (
          <DailyBars data={daily} lang={lang} tableLabel={a.charts.table} dayCol={a.charts.day} countCol={a.charts.count} />
        ) : (
          <p className="py-8 text-center text-[14px] text-dim">{a.charts.dailyEmpty}</p>
        )}
      </section>

      {(byKind.length > 0 || topRules.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card p-6">
            <h2 className="mb-4 text-[16px] font-bold">{a.charts.byKind}</h2>
            <HBars lang={lang} items={byKind.map((k) => ({ label: a.charts.kinds[k.kind] ?? k.kind, value: k.n }))} />
          </section>
          <section className="card p-6">
            <h2 className="mb-4 text-[16px] font-bold">{a.charts.topRules}</h2>
            <HBars
              lang={lang}
              items={topRules.map((r) => ({ label: d.rules.trigger[r.label] ?? a.rule.triggers[r.label] ?? r.label, value: r.hits }))}
            />
          </section>
        </div>
      )}

      {/* پیج‌ها */}
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-bold">{d.pages.title}</h2>
          <a href="/api/instagram/connect" className="btn btn-brand btn-sm">{d.pages.connect}</a>
        </div>
        {!igReady() && (
          <p className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-[13px] leading-6 text-mist">
            {d.pages.adminHint} <code dir="ltr" className="text-haze">{redirectUri()}</code>
          </p>
        )}
        {accounts.length === 0 ? (
          <p className="mt-4 text-[14px] leading-7 text-mist">{d.pages.empty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p dir="ltr" className="text-start font-bold">@{acc.username}</p>
                  <p className="mt-0.5 text-[12px] text-dim">
                    {acc.webhook_ok ? d.pages.webhookOk : d.pages.webhookBad}
                    {acc.token_expires_at && d.pages.validUntil + dateLong(lang, new Date(acc.token_expires_at))}
                  </p>
                </div>
                <form action={disconnectAccount}>
                  <input type="hidden" name="id" value={acc.id} />
                  <button className="text-[13px] text-dim hover:text-magenta">{d.pages.disconnect}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* گزارش */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold">{d.events.title}</h2>
          {ruleCount.n === 0 && accounts.length > 0 && (
            <Link href={lp(lang, '/dashboard/automations')} className="text-[13px] text-tangerine hover:underline">
              {d.rules.newTitle} →
            </Link>
          )}
        </div>
        {events.length === 0 ? (
          <p className="mt-3 text-[14px] leading-7 text-mist">{d.events.empty}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-[13px] leading-6">
                <span className={'mt-2 h-1.5 w-1.5 shrink-0 rounded-full ' + (e.ok ? 'bg-emerald-400' : 'bg-magenta')} />
                <span className="flex-1 text-mist">{eventText(lang, e.kind, e.ok, e.detail)}</span>
                <span className="shrink-0 text-dim">{dateTime(lang, new Date(e.created_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
