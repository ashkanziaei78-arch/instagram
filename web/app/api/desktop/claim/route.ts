import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { unseal } from '@/lib/crypto'

export const runtime = 'nodejs'

/** اپ دسکتاپ هر چند ثانیه می‌پرسد؛ نتیجه فقط یک‌بار تحویل داده می‌شود */
export async function GET(req: NextRequest) {
  const nonce = req.nextUrl.searchParams.get('nonce') ?? ''
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(nonce)) return Response.json({ error: 'bad nonce' }, { status: 400 })
  const sql = await db()
  const [row] = await sql<{ payload: string }[]>`
    delete from dx_desktop_claims where nonce = ${nonce} and created_at > now() - interval '15 minutes'
    returning payload`
  if (!row) return Response.json({ pending: true }, { status: 202 })
  return Response.json(JSON.parse(unseal(row.payload)), { headers: { 'Cache-Control': 'no-store' } })
}
