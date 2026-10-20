import { env, redirectUri } from './env'

/**
 * Instagram API with Instagram Login — همه‌ی تماس‌ها سمت سرور.
 * App Secret هرگز از این فایل بیرون نمی‌رود؛ اپ دسکتاپ هم توکن را از سایت
 * می‌گیرد و خودش Secret ندارد.
 */
const GRAPH = 'https://graph.instagram.com'
const V = '/v21.0'

export const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments'
]

export class IgError extends Error {}

export function authorizeUrl(state: string): string {
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', env.igAppId)
  u.searchParams.set('redirect_uri', redirectUri())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPES.join(','))
  u.searchParams.set('state', state)
  return u.toString()
}

async function json<T>(res: Response, what: string): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new IgError(what + ': ' + text.slice(0, 300))
  return JSON.parse(text) as T
}

export interface IgConnection {
  accessToken: string
  expiresAt: number
  igUserId: string
  username: string
  name?: string
  profilePicture?: string
}

/** کد → توکن کوتاه → توکن ۶۰روزه → پروفایل */
export async function completeLogin(code: string): Promise<IgConnection> {
  const short = await json<{ access_token: string; user_id: string | number }>(
    await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.igAppId,
        client_secret: env.igAppSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(),
        code: code.replace(/#_$/, '')
      })
    }),
    'تبدیل کد به توکن'
  )

  const lu = new URL(GRAPH + '/access_token')
  lu.searchParams.set('grant_type', 'ig_exchange_token')
  lu.searchParams.set('client_secret', env.igAppSecret)
  lu.searchParams.set('access_token', short.access_token)
  const long = await json<{ access_token: string; expires_in: number }>(await fetch(lu), 'توکن بلندمدت')

  const pu = new URL(GRAPH + V + '/me')
  pu.searchParams.set('fields', 'user_id,username,name,profile_picture_url')
  pu.searchParams.set('access_token', long.access_token)
  const me = await json<{ user_id?: string; id?: string; username: string; name?: string; profile_picture_url?: string }>(
    await fetch(pu),
    'خواندن پروفایل'
  )

  return {
    accessToken: long.access_token,
    expiresAt: Date.now() + long.expires_in * 1000,
    // شناسه‌ای که وبهوک با آن می‌آید user_id است، نه id
    igUserId: String(me.user_id ?? me.id ?? short.user_id),
    username: me.username,
    name: me.name,
    profilePicture: me.profile_picture_url
  }
}

export async function refreshToken(token: string): Promise<{ token: string; expiresAt: number }> {
  const u = new URL(GRAPH + '/refresh_access_token')
  u.searchParams.set('grant_type', 'ig_refresh_token')
  u.searchParams.set('access_token', token)
  const d = await json<{ access_token: string; expires_in: number }>(await fetch(u), 'تازه‌سازی توکن')
  return { token: d.access_token, expiresAt: Date.now() + d.expires_in * 1000 }
}

/** بدون این، متا رویداد کامنت و دایرکت این حساب را به وبهوک ما نمی‌فرستد */
export async function subscribeWebhooks(token: string): Promise<void> {
  const u = new URL(GRAPH + V + '/me/subscribed_apps')
  u.searchParams.set('subscribed_fields', 'comments,messages')
  u.searchParams.set('access_token', token)
  await json(await fetch(u, { method: 'POST' }), 'ثبت وبهوک')
}

export interface Button {
  title: string
  url: string
}

function messageBody(text: string, button?: Button | null): Record<string, unknown> {
  if (!button?.title || !button.url) return { text }
  return {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: text.slice(0, 640),
        buttons: [{ type: 'web_url', url: button.url, title: button.title.slice(0, 20) }]
      }
    }
  }
}

async function send(igUserId: string, token: string, recipient: Record<string, string>, text: string, button?: Button | null) {
  await json(
    await fetch(GRAPH + V + '/' + igUserId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ recipient, message: messageBody(text, button) })
    }),
    'ارسال پیام'
  )
}

/** جواب خصوصی به یک کامنت — تنها راه رسمی دایرکت به کسی که پیام نداده */
export const privateReply = (igUserId: string, token: string, commentId: string, text: string, button?: Button | null) =>
  send(igUserId, token, { comment_id: commentId }, text, button)

export const sendDm = (igUserId: string, token: string, userId: string, text: string, button?: Button | null) =>
  send(igUserId, token, { id: userId }, text, button)

export async function replyToComment(token: string, commentId: string, text: string): Promise<void> {
  const u = new URL(GRAPH + V + '/' + commentId + '/replies')
  u.searchParams.set('message', text)
  await json(
    await fetch(u, { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),
    'جواب عمومی کامنت'
  )
}
