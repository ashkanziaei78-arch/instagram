import type postgres from 'postgres'
import type { Suggestion } from '@/components/Suggestions'
import { daysLeft, isActive } from './auth'
import type { IgAccountRow, UserRow } from './db'
import type { Dict } from './dict'
import { lp, num, type Lang } from './i18n'

/**
 * پیشنهادهای امروز از روی وضعیت واقعی حساب. اول کارهای «لازم» (بدون آن‌ها
 * چیزی کار نمی‌کند)، بعد پیشنهادهای «رشد»؛ حداکثر ۶ تا تا فهرست خواندنی بماند.
 */
export async function buildSuggestions(
  sql: postgres.Sql,
  user: UserRow,
  accounts: IgAccountRow[],
  lang: Lang,
  t: Dict
): Promise<Suggestion[]> {
  const S = t.app.suggest.items
  const out: Suggestion[] = []
  const add = (key: string, tag: Suggestion['tag'], path: string, n?: number) => {
    const [title, body, cta] = S[key]
    const fill = (x: string) => (n === undefined ? x : x.replace('{n}', num(lang, n)))
    out.push({ key, tag, title: fill(title), body: fill(body), cta, href: path.startsWith('/checkout') ? path : lp(lang, path) })
  }

  if (!isActive(user)) add('renew', 'must', '/checkout/m1')
  else if (daysLeft(user) <= 5) add('ending', 'must', '/checkout/m1', daysLeft(user))
  if (!accounts.length) {
    add('connect', 'must', '/dashboard')
    return out
  }
  if (accounts.some((a) => !a.webhook_ok)) add('webhook', 'must', '/dashboard')

  const [r] = await sql<{ total: number; comment: number; welcome: number; forms: number; gates: number; sent7: number; products: number; leads: number; window: number }[]>`
    select
      (select count(*)::int from dx_rules where user_id = ${user.id} and enabled) as total,
      (select count(*)::int from dx_rules where user_id = ${user.id} and enabled and trigger = 'comment') as comment,
      (select count(*)::int from dx_rules where user_id = ${user.id} and enabled and trigger = 'first_dm') as welcome,
      (select count(*)::int from dx_rules where user_id = ${user.id} and questions is not null) as forms,
      (select count(*)::int from dx_rules where user_id = ${user.id} and follow_gate is not null) as gates,
      (select count(*)::int from dx_events where user_id = ${user.id} and ok and created_at > now() - interval '7 days' and kind not in ('skip','moderation','gate')) as sent7,
      (select count(*)::int from dx_products where user_id = ${user.id}) as products,
      (select count(*)::int from dx_contacts c join dx_ig_accounts a on a.id = c.ig_account_id
        where a.user_id = ${user.id} and (c.phone is not null or c.email is not null)) as leads,
      (select count(*)::int from dx_contacts c join dx_ig_accounts a on a.id = c.ig_account_id
        where a.user_id = ${user.id} and c.last_dm_at > now() - interval '20 hours') as window`

  if (!r.total) add('firstRule', 'must', '/dashboard/automations')
  else {
    if (!r.comment) add('comment', 'grow', '/dashboard/automations')
    if (r.sent7 === 0) add('idle', 'grow', '/dashboard/automations')
  }
  if (r.window > 0) add('broadcast', 'grow', '/dashboard/tools#broadcast', r.window)
  if (r.total && !r.forms) add('form', 'grow', '/dashboard/automations')
  if (!r.welcome) add('welcome', 'grow', '/dashboard/automations')
  if (r.comment && !r.gates) add('gate', 'grow', '/dashboard/automations')
  if (!accounts.some((a) => a.settings?.iceBreakers?.length)) add('ice', 'grow', '/dashboard/tools#ice')
  if (!r.products) add('showcase', 'grow', '/dashboard/catalog')
  if (!accounts.some((a) => a.settings?.moderation?.enabled)) add('moderation', 'grow', '/dashboard/tools#moderation')
  if (!accounts.some((a) => a.settings?.ai?.enabled)) add('ai', 'grow', '/dashboard/settings')
  if (r.leads > 0) add('export', 'grow', '/dashboard/contacts', r.leads)
  return out.slice(0, 6)
}
