import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { igReady } from '@/lib/env'
import { randomToken } from '@/lib/crypto'
import { authorizeUrl } from '@/lib/instagram'

export async function GET() {
  const user = await currentUser()
  if (!user) redirect('/login?next=/dashboard')
  if (!igReady()) redirect('/dashboard?ig=setup')
  const state = randomToken()
  const sql = await db()
  await sql`insert into dx_oauth_states (state, user_id) values (${state}, ${user.id})`
  redirect(authorizeUrl(state))
}
