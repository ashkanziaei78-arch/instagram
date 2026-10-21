import { redirect } from 'next/navigation'
import { getLang, localize } from '@/lib/i18n'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { planById } from '@/lib/plans'
import { requestPayment, zarinpalReady } from '@/lib/zarinpal'

export async function GET(_req: Request, ctx: { params: Promise<{ plan: string }> }) {
  const { plan: planId } = await ctx.params
  // زبان از کوکی؛ این مسیرها از بیرون (اینستاگرام، بانک) صدا زده می‌شوند
  const lang = await getLang()
  const L = (path: string) => localize(lang, path)
  const plan = planById(planId)
  if (!plan || !plan.enabled || !plan.price) redirect(L('/#pricing'))
  const user = await currentUser()
  if (!user) redirect(L('/signup') + '?next=' + encodeURIComponent('/checkout/' + plan.id))
  if (!zarinpalReady()) redirect(L('/pay/manual') + '?plan=' + plan.id)

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
    redirect(L('/dashboard?pay=gateway'))
  }
  redirect(payUrl)
}
