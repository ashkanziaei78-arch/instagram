import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { planById } from '@/lib/plans'
import { verifyPayment } from '@/lib/zarinpal'

export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority') ?? ''
  const status = req.nextUrl.searchParams.get('Status')
  const sql = await db()
  const [pay] = await sql<{ id: string; user_id: string; plan: string; amount: number; status: string }[]>`
    select id, user_id, plan, amount, status from dx_payments where authority = ${authority}`
  if (!pay) redirect('/dashboard?pay=unknown')
  if (pay.status === 'paid') redirect('/dashboard?pay=ok')
  if (status !== 'OK') {
    await sql`update dx_payments set status = 'failed' where id = ${pay.id} and status = 'pending'`
    redirect('/dashboard?pay=cancelled')
  }

  const v = await verifyPayment(pay.amount, authority)
  if (!v.ok) {
    await sql`update dx_payments set status = 'failed' where id = ${pay.id} and status = 'pending'`
    redirect('/dashboard?pay=failed')
  }

  const days = planById(pay.plan)?.days ?? 30
  // فقط یک بار: اگر کاربر صفحه را رفرش کند دوباره روز اضافه نمی‌شود
  await sql.begin(async (tx) => {
    const done = await tx`update dx_payments set status = 'paid', ref_id = ${v.refId ?? null}, verified_at = now()
      where id = ${pay.id} and status = 'pending' returning id`
    if (done.length) {
      await tx`update dx_users set sub_until = greatest(coalesce(sub_until, now()), now()) + make_interval(days => ${days})
        where id = ${pay.user_id}`
    }
  })
  redirect('/dashboard?pay=ok')
}
