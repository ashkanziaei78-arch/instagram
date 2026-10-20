import { env } from './env'

/** درگاه زرین‌پال نسخه‌ی ۴ — مبلغ به تومان (IRT) */
const host = (): string => (env.zarinpalSandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com')

export const zarinpalReady = (): boolean => !!env.zarinpalMerchant

export async function requestPayment(opts: {
  amount: number
  description: string
  callbackUrl: string
}): Promise<{ authority: string; payUrl: string }> {
  const res = await fetch(host() + '/pg/v4/payment/request.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      merchant_id: env.zarinpalMerchant,
      amount: opts.amount,
      currency: 'IRT',
      description: opts.description,
      callback_url: opts.callbackUrl
    })
  })
  const d = (await res.json()) as { data?: { code?: number; authority?: string }; errors?: unknown }
  if (d.data?.code !== 100 || !d.data.authority) {
    throw new Error('زرین‌پال درخواست را نپذیرفت: ' + JSON.stringify(d.errors ?? d.data))
  }
  return { authority: d.data.authority, payUrl: host() + '/pg/StartPay/' + d.data.authority }
}

export async function verifyPayment(amount: number, authority: string): Promise<{ ok: boolean; refId?: string; code?: number }> {
  const res = await fetch(host() + '/pg/v4/payment/verify.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant_id: env.zarinpalMerchant, amount, authority })
  })
  const d = (await res.json()) as { data?: { code?: number; ref_id?: number | string } }
  const code = d.data?.code
  // 101 یعنی قبلا تأیید شده — همان پرداخت موفق است
  return { ok: code === 100 || code === 101, refId: d.data?.ref_id ? String(d.data.ref_id) : undefined, code }
}
