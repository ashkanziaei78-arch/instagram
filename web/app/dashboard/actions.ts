'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearSession, requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

const TRIGGERS = ['comment', 'dm', 'story'] as const
const str = (f: FormData, k: string, max = 1000) => String(f.get(k) ?? '').trim().slice(0, max)

export async function addRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const trigger = str(form, 'trigger') as (typeof TRIGGERS)[number]
  const accountId = str(form, 'account')
  const reply = str(form, 'reply', 1000)
  if (!TRIGGERS.includes(trigger) || !reply) redirect('/dashboard?rule=invalid#rules')
  const btnUrl = str(form, 'button_url', 500)
  const sql = await db()
  // حساب باید مال همین کاربر باشد
  const [acc] = await sql`select id from dx_ig_accounts where id = ${accountId} and user_id = ${user.id}`
  if (!acc) redirect('/dashboard?rule=invalid#rules')
  await sql`insert into dx_rules (user_id, ig_account_id, trigger, keywords, reply, public_reply, button_title, button_url)
    values (${user.id}, ${accountId}, ${trigger}, ${str(form, 'keywords', 500)}, ${reply},
      ${trigger === 'comment' ? str(form, 'public_reply', 300) || null : null},
      ${str(form, 'button_title', 20) || null}, ${/^https?:\/\//i.test(btnUrl) ? btnUrl : null})`
  revalidatePath('/dashboard')
  redirect('/dashboard?rule=added#rules')
}

export async function toggleRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`update dx_rules set enabled = not enabled where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard')
}

export async function deleteRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`delete from dx_rules where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard')
}

export async function disconnectAccount(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`delete from dx_ig_accounts where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard')
}

export async function deleteMyAccount(form: FormData): Promise<void> {
  const user = await requireUser()
  if (str(form, 'confirm') !== user.username) redirect('/dashboard?del=confirm#danger')
  const sql = await db()
  await sql`delete from dx_users where id = ${user.id}`
  await clearSession()
  redirect('/?deleted=1')
}
