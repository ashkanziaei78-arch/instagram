import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, hasDb, type UserRow } from './db'
import { safeEqual, sign } from './crypto'

const COOKIE = 'dx_session'
const MAX_AGE = 30 * 24 * 60 * 60

/** توکن نشست: `<userId>.<expSec>.<hmac>` — هم کوکی سایت و هم Bearer اپ دسکتاپ */
export function makeSessionToken(userId: string, maxAge = MAX_AGE): string {
  const body = userId + '.' + (Math.floor(Date.now() / 1000) + maxAge)
  return body + '.' + sign(body)
}

export function readSessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [uid, exp, mac] = parts
  if (!safeEqual(mac, sign(uid + '.' + exp))) return null
  if (Number(exp) * 1000 < Date.now()) return null
  return /^\d+$/.test(uid) ? uid : null
}

export async function setSession(userId: string): Promise<void> {
  ;(await cookies()).set(COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE
  })
}

export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}

export async function userById(id: string): Promise<UserRow | null> {
  const sql = await db()
  const [u] = await sql<UserRow[]>`
    select id, username, is_admin, sub_until, created_at from dx_users where id = ${id}`
  return u ?? null
}

export async function currentUser(): Promise<UserRow | null> {
  if (!hasDb()) return null
  const uid = readSessionToken((await cookies()).get(COOKIE)?.value)
  return uid ? userById(uid) : null
}

export async function requireUser(next = '/dashboard'): Promise<UserRow> {
  const u = await currentUser()
  if (!u) redirect('/login?next=' + encodeURIComponent(next))
  return u
}

export const isActive = (u: Pick<UserRow, 'sub_until'>): boolean =>
  !!u.sub_until && new Date(u.sub_until).getTime() > Date.now()

export function daysLeft(u: Pick<UserRow, 'sub_until'>): number {
  if (!u.sub_until) return 0
  return Math.max(0, Math.ceil((new Date(u.sub_until).getTime() - Date.now()) / 86_400_000))
}

export const USERNAME_RE = /^[a-z0-9_.]{3,32}$/
