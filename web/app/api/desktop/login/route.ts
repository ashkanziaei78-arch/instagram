import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import { daysLeft, isActive, makeSessionToken } from '@/lib/auth'

export const runtime = 'nodejs'

/** ورود اپ دسکتاپ با همان نام کاربری و رمز سایت */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string }
  const username = (body.username ?? '').trim().toLowerCase()
  const sql = await db()
  const [u] = await sql<{ id: string; username: string; pass_hash: string; sub_until: Date | null }[]>`
    select id, username, pass_hash, sub_until from dx_users where username = ${username}`
  if (!u || !(await verifyPassword(body.password ?? '', u.pass_hash))) {
    return Response.json({ error: 'نام کاربری یا رمز درست نیست' }, { status: 401 })
  }
  return Response.json({
    token: makeSessionToken(u.id, 90 * 24 * 60 * 60),
    username: u.username,
    subUntil: u.sub_until,
    active: isActive(u),
    daysLeft: daysLeft(u)
  })
}
