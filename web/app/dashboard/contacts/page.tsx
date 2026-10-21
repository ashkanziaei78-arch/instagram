import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountPicker } from '@/components/AccountPicker'
import { loadDash } from '@/lib/dash'
import type { ContactRow } from '@/lib/db'
import { dateTime, getDict, lp, num } from '@/lib/i18n'
import { tagContact } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.contacts.title }
}
export const dynamic = 'force-dynamic'

export default async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { lang, t, sql, accounts, acc } = await loadDash(sp, '/dashboard/contacts')
  const c = t.app.contacts
  if (!acc) return <p className="card p-6 text-[14px] text-mist">{t.app.needAccount}</p>

  const q = (sp.q ?? '').trim().slice(0, 80)
  const tag = (sp.tag ?? '').trim().slice(0, 40)
  const like = '%' + q + '%'
  const [rows, tags, [stats]] = await Promise.all([
    sql<ContactRow[]>`
      select * from dx_contacts where ig_account_id = ${acc.id}
        ${q ? sql`and (username ilike ${like} or name ilike ${like} or phone ilike ${like} or email ilike ${like})` : sql``}
        ${tag ? sql`and ${tag} = any(tags)` : sql``}
      order by last_seen desc limit 200`,
    sql<{ tag: string; n: number }[]>`
      select unnest(tags) as tag, count(*)::int as n from dx_contacts where ig_account_id = ${acc.id} group by 1 order by 2 desc limit 30`,
    sql<{ total: number; window: number }[]>`
      select count(*)::int as total, count(*) filter (where last_dm_at > now() - interval '24 hours')::int as window
      from dx_contacts where ig_account_id = ${acc.id}`
  ])
  const base = lp(lang, '/dashboard/contacts')
  const qs = (extra: Record<string, string>) =>
    '?' + new URLSearchParams({ a: acc.id, ...(q ? { q } : {}), ...(tag ? { tag } : {}), ...extra }).toString()

  return (
    <div className="space-y-4">
      <AccountPicker accounts={accounts} current={acc.id} base={base} label={t.app.account} />
      <section className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold">{c.title}</h1>
            <p className="mt-1 text-[13px] text-mist">{c.sub}</p>
          </div>
          <a href={'/dashboard/contacts/export?a=' + acc.id} className="btn btn-ghost btn-sm">{c.export}</a>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-mist">
          <span className="chip bg-white/[0.06]">{num(lang, stats.total)} {c.total}</span>
          <span className="chip bg-emerald-400/10 text-emerald-200">{num(lang, stats.window)} {c.window}</span>
        </div>
        <form className="mt-4 flex flex-wrap gap-2" action={base}>
          <input type="hidden" name="a" value={acc.id} />
          <input name="q" defaultValue={q} className="input h-10 max-w-xs" placeholder={c.search} />
          <select name="tag" defaultValue={tag} className="input h-10 max-w-[12rem]">
            <option value="">{c.allTags}</option>
            {tags.map((x) => (
              <option key={x.tag} value={x.tag}>{x.tag} ({num(lang, x.n)})</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm h-10">↵</button>
        </form>
      </section>

      <section className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-[14px] text-mist">{c.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-[13px]">
              <thead className="bg-white/[0.03] text-mist">
                <tr>
                  {[c.cols.user, c.cols.name, c.cols.phone, c.cols.email, c.cols.tags, c.cols.count, c.cols.last].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.05] align-top">
                    <td className="px-4 py-3 font-bold" dir="ltr">{r.username ? '@' + r.username : '—'}</td>
                    <td className="px-4 py-3" dir="auto">{r.name ?? '—'}</td>
                    <td className="px-4 py-3" dir="ltr">{r.phone ?? '—'}</td>
                    <td className="px-4 py-3" dir="ltr">{r.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tags.map((x) => (
                          <form key={x} action={tagContact}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="tag" value={x} />
                            <input type="hidden" name="remove" value="1" />
                            <button className="chip bg-magenta/10 text-haze hover:line-through" title="×">{x}</button>
                          </form>
                        ))}
                        <form action={tagContact} className="flex">
                          <input type="hidden" name="id" value={r.id} />
                          <input name="tag" maxLength={40} placeholder="+" aria-label={c.addTag} className="w-14 rounded-full bg-white/[0.05] px-2 py-0.5 text-[12px] outline-none focus:w-24 focus:ring-1 focus:ring-magenta/40" />
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-3">{num(lang, r.interactions)}</td>
                    <td className="px-4 py-3 text-dim">{dateTime(lang, new Date(r.last_seen))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {rows.length === 200 && (
        <p className="text-center text-[12px] text-dim">
          <Link href={base + qs({})}>…</Link>
        </p>
      )}
    </div>
  )
}
