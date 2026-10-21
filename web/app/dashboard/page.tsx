import type { Metadata } from 'next'
import Link from 'next/link'
import { LangSwitch } from '@/components/LangSwitch'
import { Logo } from '@/components/Logo'
import { RuleForm } from '@/components/RuleForm'
import { daysLeft, isActive, requireUser } from '@/lib/auth'
import { logoutAction } from '@/lib/actions-auth'
import { db, type RuleRow } from '@/lib/db'
import { env, igReady, redirectUri } from '@/lib/env'
import { dateLong, dateTime, getDict, lp, money, num } from '@/lib/i18n'
import { PLANS } from '@/lib/plans'
import { eventText } from '@/lib/events'
import { addRule, deleteMyAccount, deleteRule, disconnectAccount, toggleRule } from './actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.dash.title }
}
export const dynamic = 'force-dynamic'

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser()
  const { lang, t } = await getDict()
  const d = t.dash
  const sp = await searchParams
  const flashKey = Object.entries(sp)
    .map(([k, v]) => k + '=' + v)
    .find((k) => d.flash[k])
  const flashOk = !!flashKey && /=ok$|=added$/.test(flashKey)

  const sql = await db()
  const [accounts, rules, events, [counts]] = await Promise.all([
    sql<{ id: string; username: string; token_expires_at: Date | null; webhook_ok: boolean }[]>`
      select id, username, token_expires_at, webhook_ok from dx_ig_accounts where user_id = ${user.id} order by id`,
    sql<(RuleRow & { username: string })[]>`
      select r.*, a.username from dx_rules r join dx_ig_accounts a on a.id = r.ig_account_id
      where r.user_id = ${user.id} order by r.id desc`,
    sql<{ id: string; kind: string; ok: boolean; detail: string; created_at: Date }[]>`
      select id, kind, ok, detail, created_at from dx_events where user_id = ${user.id} order by id desc limit 30`,
    sql<{ today: number; week: number; any_ok: boolean }[]>`
      select
        count(*) filter (where ok and created_at > now() - interval '1 day')::int as today,
        count(*) filter (where ok and created_at > now() - interval '7 days')::int as week,
        bool_or(ok) as any_ok
      from dx_events where user_id = ${user.id} and kind <> 'skip'`
  ])

  const active = isActive(user)
  const left = daysLeft(user)
  const activeRules = rules.filter((r) => r.enabled).length

  // چک‌لیست شروع (ایده از ManyChat): تا وقتی کامل نشده بالای صفحه می‌ماند
  const steps = [active, accounts.length > 0, rules.length > 0, !!counts?.any_ok]
  const doneCount = steps.filter(Boolean).length

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <Logo href={lp(lang, '/dashboard')} />
          <div className="flex items-center gap-2 text-[13px]">
            {user.is_admin && <Link href="/admin" className="text-mist hover:text-haze">{d.admin}</Link>}
            <LangSwitch lang={lang} path="/dashboard" label={t.nav.switchLangShort} />
            <span dir="ltr" className="hidden text-mist sm:inline">{user.username}</span>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm">{d.logout}</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
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
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: (doneCount / steps.length) * 100 + '%' }} />
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
        <section className="grid grid-cols-3 gap-3">
          {[
            [d.stats.today, counts?.today ?? 0],
            [d.stats.week, counts?.week ?? 0],
            [d.stats.rules, activeRules]
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <p className="text-[12px] leading-5 text-mist">{label}</p>
              <p className="mt-1 text-[26px] font-bold">{num(lang, value as number)}</p>
            </div>
          ))}
        </section>

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
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p dir="ltr" className="text-start font-bold">@{a.username}</p>
                    <p className="mt-0.5 text-[12px] text-dim">
                      {a.webhook_ok ? d.pages.webhookOk : d.pages.webhookBad}
                      {a.token_expires_at && d.pages.validUntil + dateLong(lang, new Date(a.token_expires_at))}
                    </p>
                  </div>
                  <form action={disconnectAccount}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-[13px] text-dim hover:text-magenta">{d.pages.disconnect}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* قانون‌ها */}
        <section id="rules" className="card scroll-mt-20 p-6">
          <h2 className="text-[18px] font-bold">{d.rules.title}</h2>
          {rules.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {rules.map((r) => (
                <li key={r.id} className={'rounded-2xl border border-white/[0.06] bg-ink/50 p-4 ' + (r.enabled ? '' : 'opacity-55')}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-mist">
                    <span className="chip bg-white/[0.06]">{d.rules.trigger[r.trigger]}</span>
                    <span dir="ltr">@{r.username}</span>
                    <span>
                      {num(lang, r.hits)} {d.rules.times}
                    </span>
                  </div>
                  <p className="mt-2.5 whitespace-pre-line text-[14px] leading-7">
                    <span className="text-mist">{d.rules.ifWrote}</span>
                    <b>{r.keywords.trim() || d.rules.anything}</b>
                    <span className="text-mist"> → </span>
                    {r.reply}
                  </p>
                  {r.button_title && (
                    <p className="mt-1 text-[12px] text-dim">
                      {d.rules.button}
                      {r.button_title}
                    </p>
                  )}
                  <div className="mt-3 flex gap-4 text-[13px]">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-mist hover:text-haze">{r.enabled ? d.rules.off : d.rules.on}</button>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-dim hover:text-magenta">{d.rules.remove}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {accounts.length === 0 ? (
            <p className="mt-4 text-[14px] text-mist">{d.rules.needPage}</p>
          ) : (
            <RuleForm action={addRule} accounts={accounts.map(({ id, username }) => ({ id, username }))} r={d.rules} tpl={d.tpl} />
          )}
        </section>

        {/* گزارش */}
        <section className="card p-6">
          <h2 className="text-[18px] font-bold">{d.events.title}</h2>
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

        {/* نصب */}
        <section className="card p-6">
          <h2 className="text-[18px] font-bold">{d.install.title}</h2>
          <p className="mt-3 text-[14px] leading-7 text-mist">
            <b className="text-haze">{d.install.phone}</b> {d.install.phoneBody}
          </p>
          <p className="mt-3 text-[14px] leading-7 text-mist">
            <b className="text-haze">{d.install.win}</b> {d.install.winBody}
          </p>
          {active && env.desktopUrl ? (
            <a href={env.desktopUrl} className="btn btn-ghost mt-4">{d.install.download}</a>
          ) : (
            <p className="mt-4 text-[13px] text-dim">{active ? d.install.soon : d.install.afterBuy}</p>
          )}
        </section>

        <details id="danger" className="px-2 pt-4 text-[13px] text-dim">
          <summary className="cursor-pointer">{d.danger.summary}</summary>
          <form action={deleteMyAccount} className="mt-3 flex flex-wrap gap-2">
            <input name="confirm" dir="ltr" className="input h-10 max-w-[220px]" placeholder={user.username} aria-label={d.danger.confirm} />
            <button className="btn btn-sm border border-magenta/40 text-magenta">{d.danger.button}</button>
          </form>
        </details>
      </main>
    </div>
  )
}
