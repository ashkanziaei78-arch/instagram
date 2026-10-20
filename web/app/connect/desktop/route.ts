import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { igReady } from '@/lib/env'
import { randomToken } from '@/lib/crypto'
import { authorizeUrl } from '@/lib/instagram'

/**
 * اتصال رسمی از اپ دسکتاپ: اپ یک nonce تصادفی می‌سازد، این صفحه را در مرورگر
 * باز می‌کند و بعد /api/desktop/claim را می‌پرسد. Secret فقط روی سرور است.
 */
export async function GET(req: NextRequest) {
  const nonce = req.nextUrl.searchParams.get('nonce') ?? ''
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(nonce)) return new Response('nonce نامعتبر', { status: 400 })
  if (!igReady()) return new Response('اتصال اینستاگرام هنوز روی سرور تنظیم نشده', { status: 503 })
  const state = randomToken()
  const sql = await db()
  await sql`insert into dx_oauth_states (state, nonce) values (${state}, ${nonce})`
  redirect(authorizeUrl(state))
}
