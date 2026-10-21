import type postgres from 'postgres'
import type { DayPoint } from '@/components/Charts'

/** رویدادهایی که «پیام فرستاده‌شده» حساب می‌شوند */
const NOT_SENT = ['skip', 'moderation', 'gate']

export interface StatsFilter {
  days: 7 | 30 | 90
  accountId?: string
  kind?: string
}

export interface Stats {
  daily: DayPoint[]
  total: number
  prevTotal: number
  byKind: { kind: string; n: number }[]
  topRules: { label: string; n: number }[]
  newContacts: number
  leads: number
}

export const parseFilter = (sp: Record<string, string | undefined>): StatsFilter => ({
  days: sp.r === '7' ? 7 : sp.r === '90' ? 90 : 30,
  accountId: sp.acc && /^\d+$/.test(sp.acc) ? sp.acc : undefined,
  kind: sp.k && /^[a-z_]{2,20}$/.test(sp.k) ? sp.k : undefined
})

/**
 * آمار یک بازه با فیلترها. همه‌ی نمودارها و خلاصه از همین می‌خوانند تا
 * فیلتر روی همه یکسان اعمال شود.
 */
export async function computeStats(sql: postgres.Sql, userId: string, f: StatsFilter): Promise<Stats> {
  const acc = f.accountId ? sql`and e.ig_account_id = ${f.accountId}` : sql``
  const kind = f.kind ? sql`and e.kind = ${f.kind}` : sql``
  const since = sql`now() - make_interval(days => ${f.days})`
  const [daily, [tot], byKind, topRules, [crm]] = await Promise.all([
    sql<DayPoint[]>`
      select to_char(g.d, 'YYYY-MM-DD') as day, count(e.id)::int as count
      from generate_series(current_date - ${f.days - 1}::int, current_date, interval '1 day') as g(d)
      left join dx_events e on e.user_id = ${userId} and e.ok and e.kind <> all(${NOT_SENT})
        and e.created_at::date = g.d::date ${acc} ${kind}
      group by g.d order by g.d`,
    sql<{ total: number; prev: number }[]>`
      select
        count(*) filter (where e.created_at > ${since})::int as total,
        count(*) filter (where e.created_at <= ${since} and e.created_at > now() - make_interval(days => ${f.days * 2}))::int as prev
      from dx_events e where e.user_id = ${userId} and e.ok and e.kind <> all(${NOT_SENT}) ${acc} ${kind}`,
    sql<{ kind: string; n: number }[]>`
      select e.kind, count(*)::int as n from dx_events e
      where e.user_id = ${userId} and e.ok and e.kind <> 'skip' and e.created_at > ${since} ${acc} ${kind}
      group by e.kind order by n desc`,
    sql<{ label: string; n: number }[]>`
      select coalesce(nullif(r.name, ''), nullif(left(r.keywords, 30), ''), r.trigger) as label, count(*)::int as n
      from dx_events e join dx_rules r on r.id = e.rule_id
      where e.user_id = ${userId} and e.ok and e.created_at > ${since} ${acc} ${kind}
      group by 1 order by n desc limit 5`,
    sql<{ new_contacts: number; leads: number }[]>`
      select
        (select count(*)::int from dx_contacts c join dx_ig_accounts a on a.id = c.ig_account_id
          where a.user_id = ${userId} and c.first_seen > ${since} ${f.accountId ? sql`and a.id = ${f.accountId}` : sql``}) as new_contacts,
        (select count(*)::int from dx_events e where e.user_id = ${userId} and e.ok and e.kind = 'form'
          and e.created_at > ${since} ${acc}) as leads`
  ])
  return {
    daily,
    total: tot?.total ?? 0,
    prevTotal: tot?.prev ?? 0,
    byKind,
    topRules,
    newContacts: crm?.new_contacts ?? 0,
    leads: crm?.leads ?? 0
  }
}
