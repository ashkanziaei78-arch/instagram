import type { Metadata } from 'next'
import { PageIntro } from '@/components/PageIntro'
import Link from 'next/link'
import { AccountPicker } from '@/components/AccountPicker'
import { Giveaway } from '@/components/Giveaway'
import { unseal } from '@/lib/crypto'
import { loadDash } from '@/lib/dash'
import { getDict, lp, num } from '@/lib/i18n'
import { listMedia } from '@/lib/instagram'
import { pickWinners, saveIceBreakers, saveModeration, sendBroadcast } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.tools.title }
}
export const dynamic = 'force-dynamic'

export default async function Tools({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { lang, t, sql, accounts, acc } = await loadDash(sp, '/dashboard/tools')
  const x = t.app.tools
  if (!acc) return <p className="card p-6 text-[14px] text-mist">{t.app.needAccount}</p>

  let media: { id: string; label: string }[] = []
  try {
    media = (await listMedia(unseal(acc.token_enc), 30)).map((m) => ({
      id: m.id,
      label: ((m.caption ?? m.media_type).replace(/\s+/g, ' ').slice(0, 50) || m.id) + (m.comments_count ? ` (${num(lang, m.comments_count)})` : '')
    }))
  } catch {
    media = []
  }
  const [{ n: eligible }] = await sql<{ n: number }[]>`
    select count(*)::int as n from dx_contacts where ig_account_id = ${acc.id} and last_dm_at > now() - interval '23 hours 50 minutes'`
  const s = acc.settings ?? {}
  const ice = s.iceBreakers ?? []

  return (
    <div className="space-y-4">
      <PageIntro title={x.title} text={t.app.intro.tools} learn={{ href: lp(lang, '/dashboard/learn/giveaway'), label: t.app.learn.help }} />
      <AccountPicker accounts={accounts} current={acc.id} base={lp(lang, '/dashboard/tools')} label={t.app.account} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-[17px] font-bold">{x.giveaway.title}</h2>
          <p className="mb-4 mt-1 text-[13px] leading-6 text-mist">{x.giveaway.sub}</p>
          {media.length ? (
            <Giveaway action={pickWinners} accountId={acc.id} media={media} g={x.giveaway} fmt={lang} />
          ) : (
            <p className="text-[13px] text-dim">{x.giveaway.noPosts}</p>
          )}
        </section>

        <section className="card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -end-12 -top-12 h-36 w-36 rounded-full bg-brand opacity-20 blur-3xl" aria-hidden />
          <h2 className="text-[17px] font-bold">{x.showcase.title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-mist">{x.showcase.sub}</p>
          <Link href={lp(lang, '/dashboard/catalog') + '?a=' + acc.id} className="btn btn-ghost btn-sm mt-4">{x.showcase.open}</Link>
        </section>

        <section id="moderation" className="card scroll-mt-28 p-6">
          <h2 className="text-[17px] font-bold">{x.moderation.title}</h2>
          <p className="mb-4 mt-1 text-[13px] leading-6 text-mist">{x.moderation.sub}</p>
          {sp.saved === 'mod' && <p className="mb-3 text-[13px] text-emerald-300">{t.app.saved}</p>}
          <form action={saveModeration} className="space-y-3">
            <input type="hidden" name="account" value={acc.id} />
            <label className="flex items-center gap-2 text-[14px] text-mist">
              <input type="checkbox" name="enabled" defaultChecked={!!s.moderation?.enabled} className="h-4 w-4 accent-[#e1306c]" /> {x.moderation.enabled}
            </label>
            <div>
              <label className="label" htmlFor="words">{x.moderation.words}</label>
              <textarea id="words" name="words" rows={2} defaultValue={s.moderation?.words ?? ''} className="input" placeholder={x.moderation.wordsPh} />
            </div>
            <button className="btn btn-ghost btn-sm">{x.moderation.save}</button>
          </form>
        </section>

        <section id="ice" className="card scroll-mt-28 p-6">
          <h2 className="text-[17px] font-bold">{x.ice.title}</h2>
          <p className="mb-4 mt-1 text-[13px] leading-6 text-mist">{x.ice.sub}</p>
          {sp.ice === 'ok' && <p className="mb-3 text-[13px] text-emerald-300">{x.ice.ok}</p>}
          {sp.ice === 'fail' && <p className="mb-3 text-[13px] text-magenta">{x.ice.fail + (sp.msg ?? '')}</p>}
          <form action={saveIceBreakers} className="space-y-2">
            <input type="hidden" name="account" value={acc.id} />
            {[0, 1, 2, 3].map((i) => (
              <input key={i} name={'q' + i} maxLength={80} defaultValue={ice[i] ?? ''} className="input h-10" placeholder={x.ice.ph[i]} aria-label={x.ice.title + ' ' + (i + 1)} />
            ))}
            <button className="btn btn-ghost btn-sm mt-2">{x.ice.save}</button>
          </form>
        </section>

        <section id="broadcast" className="card scroll-mt-28 p-6 lg:col-span-2">
          <h2 className="text-[17px] font-bold">{x.broadcast.title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-mist">{x.broadcast.sub}</p>
          <p className="mb-4 mt-3 text-[14px]">
            <b className="text-[22px]">{num(lang, eligible)}</b> <span className="text-mist">{x.broadcast.eligible}</span>
          </p>
          {sp.sent && (
            <p className="mb-3 text-[13px] text-emerald-300">
              {x.broadcast.sent} {num(lang, Number(sp.sent) || 0)} {x.giveaway.people}
            </p>
          )}
          <form action={sendBroadcast} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <input type="hidden" name="account" value={acc.id} />
            <textarea name="text" required rows={3} maxLength={1000} className="input" placeholder={x.broadcast.text} aria-label={x.broadcast.text} />
            <div className="flex flex-col gap-2">
              <input name="tag" maxLength={40} className="input h-10" placeholder={x.broadcast.tag} aria-label={x.broadcast.tag} />
              <button className="btn btn-brand" disabled={eligible === 0}>{x.broadcast.send}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
