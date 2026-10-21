import type { Metadata } from 'next'
import { PageIntro } from '@/components/PageIntro'
import { RuleForm, type MediaOption } from '@/components/RuleForm'
import { unseal } from '@/lib/crypto'
import { loadDash } from '@/lib/dash'
import type { RuleRow } from '@/lib/db'
import { getDict, lp, num } from '@/lib/i18n'
import { listMedia } from '@/lib/instagram'
import { addRule, deleteRule, toggleRule } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.nav.rules }
}
export const dynamic = 'force-dynamic'

export default async function Automations({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { user, lang, t, sql, accounts, acc } = await loadDash(sp, '/dashboard/automations')
  const d = t.dash
  const a = t.app.rule
  const rules = await sql<(RuleRow & { username: string })[]>`
    select r.*, a.username from dx_rules r join dx_ig_accounts a on a.id = r.ig_account_id
    where r.user_id = ${user.id} order by r.id desc`

  // پست‌ها برای «روی کدام پست؟» — اگر اینستاگرام جواب نداد، فرم بدون آن کار می‌کند
  let media: MediaOption[] | null = null
  if (acc) {
    try {
      media = (await listMedia(unseal(acc.token_enc), 24)).map((m) => ({
        id: m.id,
        label: (m.caption ?? m.media_type).replace(/\s+/g, ' ').slice(0, 60) || m.id
      }))
    } catch {
      media = null
    }
  }
  const flash = sp.rule === 'added' ? d.flash['rule=added'] : sp.rule === 'invalid' ? d.flash['rule=invalid'] : null

  const badges = (r: RuleRow) =>
    [
      r.once_per_user && a.badges.once,
      r.follow_gate && a.badges.gate,
      r.questions?.length && a.badges.form,
      r.media_id && a.badges.post,
      r.image_url && a.badges.image
    ].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      <PageIntro title={t.app.nav.rules} text={t.app.intro.rules} learn={{ href: lp(lang, '/dashboard/learn/first-reply'), label: t.app.learn.help }} />
      {flash && (
        <p role="status" className={'rounded-2xl px-4 py-3 text-[14px] ' + (sp.rule === 'added' ? 'border border-emerald-400/25 bg-emerald-400/10' : 'border border-magenta/30 bg-magenta/10')}>
          {flash}
        </p>
      )}
      <section className="card p-6">
        <h2 className="text-[18px] font-bold">{d.rules.title}</h2>
        {rules.length > 0 && (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {rules.map((r) => (
              <li key={r.id} className={'rounded-2xl border border-white/[0.06] bg-ink/50 p-4 ' + (r.enabled ? '' : 'opacity-55')}>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-mist">
                  <span className="chip bg-white/[0.06]">{a.triggers[r.trigger] ?? r.trigger}</span>
                  {badges(r).map((b) => (
                    <span key={b} className="chip bg-magenta/10 text-haze">{b}</span>
                  ))}
                  <span dir="ltr">@{r.username}</span>
                </div>
                {r.name && <p dir="auto" className="mt-2 text-start text-[15px] font-bold">{r.name}</p>}
                <p dir="auto" className="mt-1.5 line-clamp-3 whitespace-pre-line text-start text-[14px] leading-7">
                  {r.trigger !== 'first_dm' && (
                    <>
                      <span className="text-mist">{d.rules.ifWrote}</span>
                      <b>{r.keywords.trim() || d.rules.anything}</b>
                      <span className="text-mist"> → </span>
                    </>
                  )}
                  {r.reply}
                </p>
                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <span className="text-dim">
                    {num(lang, r.hits)} {d.rules.times}
                  </span>
                  <div className="flex gap-4">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-mist hover:text-haze">{r.enabled ? d.rules.off : d.rules.on}</button>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-dim hover:text-magenta">{d.rules.remove}</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-5 text-[18px] font-bold">{d.rules.newTitle}</h2>
        {accounts.length === 0 ? (
          <p className="text-[14px] text-mist">{d.rules.needPage}</p>
        ) : (
          <RuleForm
            action={addRule}
            accounts={accounts.map(({ id, username }) => ({ id, username }))}
            media={media}
            r={d.rules}
            a={a}
            tpl={d.tpl}
          />
        )}
      </section>
    </div>
  )
}
