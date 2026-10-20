import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { seal } from '@/lib/crypto'
import { completeLogin, subscribeWebhooks } from '@/lib/instagram'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const sql = await db()
  const [st] = await sql<{ user_id: string | null; nonce: string | null }[]>`
    delete from dx_oauth_states where state = ${p.get('state') ?? ''}
      and created_at > now() - interval '20 minutes'
    returning user_id, nonce`
  if (!st) redirect('/dashboard?ig=expired')

  const code = p.get('code')
  if (!code) redirect(st.nonce ? '/connect/done?status=denied' : '/dashboard?ig=denied')

  let conn
  try {
    conn = await completeLogin(code)
  } catch (e) {
    console.error('oauth', e)
    redirect(st.nonce ? '/connect/done?status=error' : '/dashboard?ig=error')
  }

  if (st.nonce) {
    await sql`insert into dx_desktop_claims (nonce, payload) values (${st.nonce}, ${seal(JSON.stringify(conn))})
              on conflict (nonce) do update set payload = excluded.payload, created_at = now()`
    redirect('/connect/done?status=ok&u=' + encodeURIComponent(conn.username))
  }

  let webhookOk = true
  try {
    await subscribeWebhooks(conn.accessToken)
  } catch (e) {
    console.error('subscribe', e)
    webhookOk = false
  }

  // کسی که OAuth را رد کرده مالک پیج است؛ اگر پیج قبلا زیر حساب دیگری بود، منتقل می‌شود
  await sql`insert into dx_ig_accounts (user_id, ig_user_id, username, token_enc, token_expires_at, webhook_ok)
    values (${st.user_id}, ${conn.igUserId}, ${conn.username}, ${seal(conn.accessToken)}, ${new Date(conn.expiresAt)}, ${webhookOk})
    on conflict (ig_user_id) do update set user_id = excluded.user_id, username = excluded.username,
      token_enc = excluded.token_enc, token_expires_at = excluded.token_expires_at,
      webhook_ok = excluded.webhook_ok, updated_at = now()`
  redirect('/dashboard?ig=ok')
}
