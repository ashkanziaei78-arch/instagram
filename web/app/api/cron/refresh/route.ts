import { db } from '@/lib/db'
import { seal, unseal } from '@/lib/crypto'
import { refreshToken } from '@/lib/instagram'

export const runtime = 'nodejs'

/** روزانه: توکن‌هایی که کمتر از ۱۰ روز مانده تازه می‌شوند — بعد از انقضا راهی جز اتصال دوباره نیست */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== 'Bearer ' + secret) {
    return new Response('forbidden', { status: 403 })
  }
  const sql = await db()
  const rows = await sql<{ id: string; token_enc: string }[]>`
    select id, token_enc from dx_ig_accounts
    where token_expires_at is not null and token_expires_at < now() + interval '10 days' and token_expires_at > now()`
  let ok = 0
  for (const r of rows) {
    try {
      const t = await refreshToken(unseal(r.token_enc))
      await sql`update dx_ig_accounts set token_enc = ${seal(t.token)}, token_expires_at = ${new Date(t.expiresAt)}, updated_at = now()
                where id = ${r.id}`
      ok++
    } catch (e) {
      console.error('refresh', r.id, e)
    }
  }
  await sql`delete from dx_processed where created_at < now() - interval '7 days'`
  await sql`delete from dx_oauth_states where created_at < now() - interval '1 day'`
  await sql`delete from dx_desktop_claims where created_at < now() - interval '1 day'`
  return Response.json({ refreshed: ok, checked: rows.length })
}
