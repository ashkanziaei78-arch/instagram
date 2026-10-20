'use server'

import { redirect } from 'next/navigation'
import { clearSession, setSession, USERNAME_RE } from './auth'
import { db, NoDbError } from './db'
import { env } from './env'
import { hashPassword, verifyPassword } from './crypto'

export interface AuthState {
  error?: string
}

const safeNext = (n: FormDataEntryValue | null): string => {
  const s = typeof n === 'string' ? n : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/dashboard'
}

function dbMessage(e: unknown): AuthState {
  if (e instanceof NoDbError) return { error: e.message }
  console.error(e)
  return { error: 'مشکلی پیش آمد؛ چند لحظه بعد دوباره امتحان کنید' }
}

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!USERNAME_RE.test(username)) {
    return { error: 'نام کاربری: ۳ تا ۳۲ حرف انگلیسی کوچک، عدد، نقطه یا _' }
  }
  if (password.length < 8) return { error: 'رمز باید دست‌کم ۸ کاراکتر باشد' }

  let id: string
  try {
    const sql = await db()
    const isAdmin = !!env.adminUsername && username === env.adminUsername
    const rows = await sql<{ id: string }[]>`
      insert into dx_users (username, pass_hash, is_admin)
      values (${username}, ${await hashPassword(password)}, ${isAdmin})
      on conflict (username) do nothing returning id`
    if (!rows.length) return { error: 'این نام کاربری قبلاً گرفته شده' }
    id = rows[0].id
  } catch (e) {
    return dbMessage(e)
  }
  await setSession(id)
  redirect(safeNext(form.get('next')))
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  let id: string
  try {
    const sql = await db()
    const [u] = await sql<{ id: string; pass_hash: string }[]>`
      select id, pass_hash from dx_users where username = ${username}`
    if (!u || !(await verifyPassword(password, u.pass_hash))) {
      return { error: 'نام کاربری یا رمز درست نیست' }
    }
    id = u.id
  } catch (e) {
    return dbMessage(e)
  }
  await setSession(id)
  redirect(safeNext(form.get('next')))
}

export async function logoutAction(): Promise<void> {
  await clearSession()
  redirect('/')
}
