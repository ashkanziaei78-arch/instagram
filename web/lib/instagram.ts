import { env, redirectUri } from './env'

/**
 * Instagram API with Instagram Login — همه‌ی تماس‌ها سمت سرور.
 * App Secret هرگز از این فایل بیرون نمی‌رود؛ اپ دسکتاپ هم توکن را از سایت
 * می‌گیرد و خودش Secret ندارد.
 */
// IG_GRAPH_BASE فقط برای تست با سرور ساختگی؛ در عمل خالی است
const GRAPH = process.env.IG_GRAPH_BASE || 'https://graph.instagram.com'
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

/** شکل پیام اینستاگرام: متن ساده، متن با دکمه‌ی لینک (تا ۳)، یا متن با دکمه‌های جواب سریع */
export function messageBody(text: string, buttons?: Button[] | null, quick?: string[] | null): Record<string, unknown> {
  const btns = (buttons ?? []).filter((b) => b.title && b.url).slice(0, 3)
  if (btns.length) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text.slice(0, 640),
          buttons: btns.map((b) => ({ type: 'web_url', url: b.url, title: b.title.slice(0, 20) }))
        }
      }
    }
  }
  const q = (quick ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 13)
  if (q.length) {
    return { text, quick_replies: q.map((x) => ({ content_type: 'text', title: x.slice(0, 20), payload: x.slice(0, 1000) })) }
  }
  return { text }
}

export async function sendMessage(
  igUserId: string,
  token: string,
  recipient: Record<string, string>,
  message: Record<string, unknown>
): Promise<void> {
  await json(
    await fetch(GRAPH + V + '/' + igUserId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ recipient, message })
    }),
    'ارسال پیام'
  )
}

/** جواب خصوصی به یک کامنت — تنها راه رسمی دایرکت به کسی که پیام نداده؛ فقط یک پیام */
export const privateReply = (igUserId: string, token: string, commentId: string, text: string, buttons?: Button[] | null) =>
  sendMessage(igUserId, token, { comment_id: commentId }, messageBody(text, buttons))

export const sendDm = (
  igUserId: string,
  token: string,
  userId: string,
  text: string,
  buttons?: Button[] | null,
  quick?: string[] | null
) => sendMessage(igUserId, token, { id: userId }, messageBody(text, buttons, quick))

export const sendImage = (igUserId: string, token: string, userId: string, url: string) =>
  sendMessage(igUserId, token, { id: userId }, { attachment: { type: 'image', payload: { url } } })

export interface CarouselItem {
  title: string
  subtitle?: string | null
  image_url?: string | null
  url?: string | null
  button?: string
}

/** ویترین محصولات: کاروسل تا ۱۰ کارت با عکس و دکمه */
export const sendCarousel = (igUserId: string, token: string, userId: string, items: CarouselItem[]) =>
  sendMessage(igUserId, token, { id: userId }, {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: items.slice(0, 10).map((p) => ({
          title: p.title.slice(0, 80),
          ...(p.subtitle ? { subtitle: p.subtitle.slice(0, 80) } : {}),
          ...(p.image_url ? { image_url: p.image_url } : {}),
          ...(p.url ? { default_action: { type: 'web_url', url: p.url }, buttons: [{ type: 'web_url', url: p.url, title: (p.button ?? 'View').slice(0, 20) }] } : {})
        }))
      }
    }
  })

/** آیا این شخص پیج را فالو کرده؟ برای «اول فالو کن» */
export async function isFollower(token: string, igsid: string): Promise<boolean | null> {
  const u = new URL(GRAPH + V + '/' + igsid)
  u.searchParams.set('fields', 'is_user_follow_business')
  u.searchParams.set('access_token', token)
  try {
    const d = await json<{ is_user_follow_business?: boolean }>(await fetch(u), 'بررسی فالو')
    return typeof d.is_user_follow_business === 'boolean' ? d.is_user_follow_business : null
  } catch {
    return null
  }
}

/** نام کاربری و اسم کسی که پیام داده (رویداد دایرکت فقط شناسه دارد) */
export async function getUserProfile(token: string, igsid: string): Promise<{ username?: string; name?: string }> {
  const u = new URL(GRAPH + V + '/' + igsid)
  u.searchParams.set('fields', 'username,name')
  u.searchParams.set('access_token', token)
  try {
    return await json<{ username?: string; name?: string }>(await fetch(u), 'پروفایل مخاطب')
  } catch {
    return {}
  }
}

export async function hideComment(token: string, commentId: string): Promise<void> {
  const u = new URL(GRAPH + V + '/' + commentId)
  u.searchParams.set('hide', 'true')
  await json(await fetch(u, { method: 'POST', headers: { Authorization: 'Bearer ' + token } }), 'مخفی کردن کامنت')
}

export interface MediaItem {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
  comments_count?: number
  like_count?: number
}

export async function listMedia(token: string, limit = 24): Promise<MediaItem[]> {
  const u = new URL(GRAPH + V + '/me/media')
  u.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count')
  u.searchParams.set('limit', String(limit))
  u.searchParams.set('access_token', token)
  return (await json<{ data: MediaItem[] }>(await fetch(u), 'خواندن پست‌ها')).data ?? []
}

export interface CommentItem {
  id: string
  text?: string
  username?: string
  timestamp?: string
  from?: { id: string; username?: string }
}

/** همه‌ی کامنت‌های یک پست (تا سقف) — برای قرعه‌کشی */
export async function listAllComments(token: string, mediaId: string, cap = 2000): Promise<CommentItem[]> {
  const out: CommentItem[] = []
  let next: string | null = (() => {
    const u = new URL(GRAPH + V + '/' + mediaId + '/comments')
    u.searchParams.set('fields', 'id,text,username,timestamp,from')
    u.searchParams.set('limit', '50')
    u.searchParams.set('access_token', token)
    return u.toString()
  })()
  while (next && out.length < cap) {
    const page: { data: CommentItem[]; paging?: { next?: string } } = await json(await fetch(next), 'خواندن کامنت‌ها')
    out.push(...(page.data ?? []))
    next = page.paging?.next ?? null
  }
  return out
}

/** منوی سؤال‌های سریع که هنگام باز کردن دایرکت نمایش داده می‌شود (Ice breakers) */
export async function setIceBreakers(token: string, questions: string[]): Promise<void> {
  const qs = questions.map((q) => q.trim()).filter(Boolean).slice(0, 4)
  const res = await fetch(GRAPH + V + '/me/messenger_profile', {
    method: qs.length ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(
      qs.length
        ? { platform: 'instagram', ice_breakers: [{ locale: 'default', call_to_actions: qs.map((q) => ({ question: q.slice(0, 80), payload: q })) }] }
        : { platform: 'instagram', fields: ['ice_breakers'] }
    )
  })
  await json(res, 'منوی سریع')
}

export async function replyToComment(token: string, commentId: string, text: string): Promise<void> {
  const u = new URL(GRAPH + V + '/' + commentId + '/replies')
  u.searchParams.set('message', text)
  await json(
    await fetch(u, { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),
    'جواب عمومی کامنت'
  )
}
