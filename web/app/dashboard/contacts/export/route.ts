import { currentUser } from '@/lib/auth'
import { db, type ContactRow } from '@/lib/db'

export const runtime = 'nodejs'

/** خروجی CSV با BOM تا اکسل فارسی را درست باز کند */
export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const accountId = new URL(req.url).searchParams.get('a') ?? ''
  const sql = await db()
  const rows = await sql<(ContactRow & { account: string })[]>`
    select c.*, a.username as account from dx_contacts c join dx_ig_accounts a on a.id = c.ig_account_id
    where a.user_id = ${user.id} ${accountId ? sql`and a.id = ${accountId}` : sql``}
    order by c.last_seen desc`
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const head = ['account', 'username', 'name', 'phone', 'email', 'tags', 'answers', 'interactions', 'first_seen', 'last_seen']
  const lines = rows.map((r) =>
    [r.account, r.username, r.name, r.phone, r.email, r.tags.join('|'), JSON.stringify(r.answers ?? {}), r.interactions,
      new Date(r.first_seen).toISOString(), new Date(r.last_seen).toISOString()].map(esc).join(',')
  )
  return new Response('﻿' + [head.join(','), ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="directino-contacts.csv"',
      'Cache-Control': 'no-store'
    }
  })
}
