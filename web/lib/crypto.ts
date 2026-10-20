import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sessionSecret } from './env'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(pw, salt, 32)
  return 's1$' + salt.toString('base64url') + '$' + hash.toString('base64url')
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [v, salt, hash] = stored.split('$')
  if (v !== 's1' || !salt || !hash) return false
  const want = Buffer.from(hash, 'base64url')
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64url'), want.length)
  return timingSafeEqual(want, got)
}

export function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const randomToken = (bytes = 24): string => randomBytes(bytes).toString('base64url')

/**
 * توکن‌های اینستاگرام رمزشده در دیتابیس می‌مانند (AES-256-GCM). اگر دیتابیس
 * نشت کند، بدون SESSION_SECRET توکن‌ها قابل استفاده نیستند.
 */
const key = (): Buffer => createHash('sha256').update('dx-token:' + sessionSecret()).digest()

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}

export function unseal(sealed: string): string {
  const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
