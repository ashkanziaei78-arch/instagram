'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

/** فعال‌سازی دستی — برای پرداخت کارت‌به‌کارت یا هدیه. روز منفی یعنی کم کردن. */
export async function addDays(form: FormData): Promise<void> {
  const me = await requireUser('/admin')
  if (!me.is_admin) redirect('/dashboard')
  const username = String(form.get('username') ?? '').trim().toLowerCase()
  const days = Math.trunc(Number(form.get('days')))
  if (!username || !Number.isFinite(days) || days === 0 || Math.abs(days) > 3650) redirect('/admin?r=bad')
  const sql = await db()
  const r = await sql`update dx_users
    set sub_until = greatest(coalesce(sub_until, now()), now()) + make_interval(days => ${days})
    where username = ${username} returning id`
  if (!r.length) redirect('/admin?r=nouser')
  await sql`insert into dx_payments (user_id, plan, amount, status, ref_id, verified_at)
            values (${r[0].id}, ${'manual:' + days}, 0, 'paid', ${'admin:' + me.username}, now())`
  revalidatePath('/admin')
  redirect('/admin?r=ok')
}
