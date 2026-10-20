import { daysLeft, isActive, readSessionToken, userById } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const uid = readSessionToken((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  const u = uid ? await userById(uid) : null
  if (!u) return Response.json({ error: 'دوباره وارد شوید' }, { status: 401 })
  return Response.json(
    { username: u.username, subUntil: u.sub_until, active: isActive(u), daysLeft: daysLeft(u) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
