'use server'

import { redirect } from 'next/navigation'
import { clearSession, setSession, USERNAME_RE } from './auth'
import { db, NoDbError } from './db'
import { env } from './env'
import { hashPassword, verifyPassword } from './crypto'
import { getDict, localize, lp } from './i18n'

export interface AuthState {
  error?: string
}

const safeNext = (n: FormDataEntryValue | null): string => {
  const s = typeof n === 'string' ? n : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/dashboard'
}

export async function signupAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { lang, t } = await getDict()
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!USERNAME_RE.test(username)) return { error: t.auth.errUsername }
  if (password.length < 8) return { error: t.auth.errPassword }

  let id: string
  try {
    const sql = await db()
    const isAdmin = !!env.adminUsername && username === env.adminUsername
    const rows = await sql<{ id: string }[]>`
      insert into dx_users (username, pass_hash, is_admin)
      values (${username}, ${await hashPassword(password)}, ${isAdmin})
      on conflict (username) do nothing returning id`
    if (!rows.length) return { error: t.auth.errTaken }
    id = rows[0].id
  } catch (e) {
    if (e instanceof NoDbError) return { error: t.auth.errNoDb }
    console.error(e)
    return { error: t.auth.errGeneric }
  }
  await setSession(id)
  redirect(localize(lang, safeNext(form.get('next'))))
}

export async function loginAction(_: AuthState, form: FormData): Promise<AuthState> {
  const { lang, t } = await getDict()
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  let id: string
  try {
    const sql = await db()
    const [u] = await sql<{ id: string; pass_hash: string }[]>`
      select id, pass_hash from dx_users where username = ${username}`
    if (!u || !(await verifyPassword(password, u.pass_hash))) return { error: t.auth.errWrong }
    id = u.id
  } catch (e) {
    if (e instanceof NoDbError) return { error: t.auth.errNoDb }
    console.error(e)
    return { error: t.auth.errGeneric }
  }
  await setSession(id)
  redirect(localize(lang, safeNext(form.get('next'))))
}

export async function logoutAction(): Promise<void> {
  const { lang } = await getDict()
  await clearSession()
  redirect(lp(lang, '/'))
}
