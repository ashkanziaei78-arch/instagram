import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { planById } from '@/lib/plans'
import { requestPayment, zarinpalReady } from '@/lib/zarinpal'

export async function GET(_req: Request, ctx: { params: Promise<{ plan: string }> }) {
  const { plan: planId } = await ctx.params
  const plan = planById(planId)
  if (!plan || !plan.enabled || !plan.price) redirect('/#pricing')
  const user = await currentUser()
  if (!user) redirect('/signup?next=' + encodeURIComponent('/checkout/' + plan.id))
  if (!zarinpalReady()) redirect('/pay/manual?plan=' + plan.id)

  let payUrl: string
  try {
    const r = await requestPayment({
      amount: plan.price,
      description: `اشتراک ${plan.title} دایرکتینو — ${user.username}`,
      callbackUrl: env.siteUrl + '/pay/callback'
    })
    const sql = await db()
    await sql`insert into dx_payments (user_id, plan, amount, authority)
              values (${user.id}, ${plan.id}, ${plan.price}, ${r.authority})`
    payUrl = r.payUrl
  } catch (e) {
    console.error('zarinpal', e)
    redirect('/dashboard?pay=gateway')
  }
  redirect(payUrl)
}
