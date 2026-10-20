import { after, type NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'
import { env } from '@/lib/env'
import { safeEqual } from '@/lib/crypto'
import { handleWebhook } from '@/lib/automation'

export const runtime = 'nodejs'

/** تأیید آدرس وبهوک در داشبورد متا */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && env.webhookVerifyToken && p.get('hub.verify_token') === env.webhookVerifyToken) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const want = 'sha256=' + createHmac('sha256', env.igAppSecret).update(raw).digest('hex')
  if (!env.igAppSecret || !safeEqual(sig, want)) return new Response('bad signature', { status: 401 })

  // متا اگر سریع ۲۰۰ نگیرد دوباره می‌فرستد؛ پس اول جواب، بعد کار
  after(async () => {
    try {
      await handleWebhook(JSON.parse(raw))
    } catch (e) {
      console.error('webhook', e)
    }
  })
  return new Response('EVENT_RECEIVED', { status: 200 })
}
