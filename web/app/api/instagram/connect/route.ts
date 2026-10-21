import { redirect } from 'next/navigation'
import { getLang, localize } from '@/lib/i18n'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { igReady } from '@/lib/env'
import { randomToken } from '@/lib/crypto'
import { authorizeUrl } from '@/lib/instagram'

export async function GET() {
  const user = await currentUser()
  // زبان از کوکی؛ این مسیرها از بیرون (اینستاگرام، بانک) صدا زده می‌شوند
  const lang = await getLang()
  const L = (path: string) => localize(lang, path)
  if (!user) redirect(L('/login?next=/dashboard'))
  if (!igReady()) redirect(L('/dashboard?ig=setup'))
  const state = randomToken()
  const sql = await db()
  await sql`insert into dx_oauth_states (state, user_id) values (${state}, ${user.id})`
  redirect(authorizeUrl(state))
}
