'use server'

import { randomInt } from 'node:crypto'
import type postgres from 'postgres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearSession, requireUser } from '@/lib/auth'
import { seal, unseal } from '@/lib/crypto'
import { db, type IgAccountRow, type LinkButton, type Question } from '@/lib/db'
import { getLang, lp } from '@/lib/i18n'
import { listAllComments, sendDm, setIceBreakers } from '@/lib/instagram'
import { normalize } from '@/lib/match'

const TRIGGERS = ['comment', 'dm', 'first_dm', 'story', 'mention'] as const
const Q_KINDS = ['name', 'phone', 'email', 'custom']
const str = (f: FormData, k: string, max = 1000) => String(f.get(k) ?? '').trim().slice(0, max)
const url = (v: string) => (/^https:\/\/\S+$/i.test(v) ? v : null)

async function page(path: string, query = ''): Promise<string> {
  return lp(await getLang(), path) + query
}

/** پیج باید مال همین کاربر باشد — هر اکشنی که پیج می‌گیرد از این رد می‌شود */
async function ownAccount(userId: string, accountId: string): Promise<IgAccountRow | null> {
  const sql = await db()
  const [acc] = await sql<IgAccountRow[]>`select * from dx_ig_accounts where id = ${accountId} and user_id = ${userId}`
  return acc ?? null
}

/* ─────────── جواب‌های خودکار ─────────── */

export async function addRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const trigger = str(form, 'trigger') as (typeof TRIGGERS)[number]
  const reply = str(form, 'reply', 2000)
  const back = await page('/dashboard/automations')
  const acc = await ownAccount(user.id, str(form, 'account'))
  if (!TRIGGERS.includes(trigger) || !reply || !acc) redirect(back + '?rule=invalid')

  const buttons: LinkButton[] = []
  for (let i = 0; i < 3; i++) {
    const title = str(form, 'btn_title_' + i, 20)
    const link = url(str(form, 'btn_url_' + i, 500))
    if (title && link) buttons.push({ title, url: link })
  }
  const questions: Question[] = []
  for (let i = 0; i < 4; i++) {
    const kind = str(form, 'q_kind_' + i)
    const ask = str(form, 'q_ask_' + i, 300)
    if (ask && Q_KINDS.includes(kind)) questions.push({ key: kind === 'custom' ? 'q' + (i + 1) : kind, ask })
  }
  const isComment = trigger === 'comment'
  const sql = await db()
  await sql`insert into dx_rules (user_id, ig_account_id, name, trigger, media_id, keywords, reply, public_reply,
      buttons, quick_replies, image_url, follow_gate, once_per_user, tag, questions, done_text)
    values (${user.id}, ${acc!.id}, ${str(form, 'name', 80) || null}, ${trigger},
      ${isComment ? str(form, 'media_id', 64) || null : null},
      ${str(form, 'keywords', 500)}, ${reply},
      ${isComment ? str(form, 'public_reply', 300) || null : null},
      ${buttons.length ? sql.json(buttons as unknown as postgres.JSONValue) : null},
      ${isComment ? null : str(form, 'quick_replies', 300) || null},
      ${isComment ? null : url(str(form, 'image_url', 500))},
      ${str(form, 'follow_gate', 500) || null},
      ${form.get('once') === 'on'},
      ${str(form, 'tag', 40) || null},
      ${questions.length ? sql.json(questions as unknown as postgres.JSONValue) : null},
      ${questions.length ? str(form, 'done_text', 500) || null : null})`
  revalidatePath('/dashboard', 'layout')
  redirect(back + '?rule=added')
}

export async function toggleRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`update dx_rules set enabled = not enabled where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard', 'layout')
}

export async function deleteRule(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`delete from dx_rules where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard', 'layout')
}

/* ─────────── پیج و حساب ─────────── */

export async function disconnectAccount(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`delete from dx_ig_accounts where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard', 'layout')
}

export async function deleteMyAccount(form: FormData): Promise<void> {
  const user = await requireUser()
  const lang = await getLang()
  if (str(form, 'confirm') !== user.username) redirect(lp(lang, '/dashboard/settings') + '?del=confirm#danger')
  const sql = await db()
  await sql`delete from dx_users where id = ${user.id}`
  await clearSession()
  redirect(lp(lang, '/') + '?deleted=1')
}

/* ─────────── مخاطبان ─────────── */

export async function tagContact(form: FormData): Promise<void> {
  const user = await requireUser()
  const tag = str(form, 'tag', 40)
  const sql = await db()
  const id = str(form, 'id')
  if (form.get('remove') === '1') {
    await sql`update dx_contacts c set tags = array_remove(c.tags, ${tag})
      from dx_ig_accounts a where c.id = ${id} and a.id = c.ig_account_id and a.user_id = ${user.id}`
  } else if (tag) {
    await sql`update dx_contacts c set tags = array_append(c.tags, ${tag})
      from dx_ig_accounts a where c.id = ${id} and a.id = c.ig_account_id and a.user_id = ${user.id}
        and not (${tag} = any(c.tags))`
  }
  revalidatePath('/dashboard/contacts')
}

/* ─────────── ویترین ─────────── */

export async function saveCatalog(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  if (!acc) redirect(await page('/dashboard/catalog'))
  const sql = await db()
  const catalog = { keywords: str(form, 'keywords', 300), intro: str(form, 'intro', 500), button: str(form, 'button', 20) }
  await sql`update dx_ig_accounts set settings = settings || ${sql.json({ catalog })} where id = ${acc!.id}`
  redirect(await page('/dashboard/catalog', '?a=' + acc!.id + '&saved=1'))
}

export async function addProduct(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  const title = str(form, 'title', 80)
  if (!acc || !title) redirect(await page('/dashboard/catalog'))
  const sql = await db()
  await sql`insert into dx_products (user_id, ig_account_id, title, subtitle, price, image_url, url, sort)
    values (${user.id}, ${acc!.id}, ${title}, ${str(form, 'subtitle', 80) || null}, ${str(form, 'price', 40) || null},
      ${url(str(form, 'image_url', 500))}, ${url(str(form, 'url', 500))},
      (select coalesce(max(sort), 0) + 1 from dx_products where ig_account_id = ${acc!.id}))`
  redirect(await page('/dashboard/catalog', '?a=' + acc!.id))
}

export async function deleteProduct(form: FormData): Promise<void> {
  const user = await requireUser()
  const sql = await db()
  await sql`delete from dx_products where id = ${str(form, 'id')} and user_id = ${user.id}`
  revalidatePath('/dashboard/catalog')
}

/* ─────────── ابزارها ─────────── */

export async function saveModeration(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  if (!acc) redirect(await page('/dashboard/tools'))
  const sql = await db()
  const moderation = { enabled: form.get('enabled') === 'on', words: str(form, 'words', 1000) }
  await sql`update dx_ig_accounts set settings = settings || ${sql.json({ moderation })} where id = ${acc!.id}`
  redirect(await page('/dashboard/tools', '?a=' + acc!.id + '&saved=mod#moderation'))
}

export async function saveIceBreakers(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  if (!acc) redirect(await page('/dashboard/tools'))
  const qs = [0, 1, 2, 3].map((i) => str(form, 'q' + i, 80)).filter(Boolean)
  const sql = await db()
  await sql`update dx_ig_accounts set settings = settings || ${sql.json({ iceBreakers: qs })} where id = ${acc!.id}`
  let q = '&ice=ok'
  try {
    await setIceBreakers(unseal(acc!.token_enc), qs)
  } catch (e) {
    q = '&ice=fail&msg=' + encodeURIComponent((e as Error).message.slice(0, 160))
  }
  redirect(await page('/dashboard/tools', '?a=' + acc!.id + q + '#ice'))
}

export async function sendBroadcast(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  const text = str(form, 'text', 1000)
  if (!acc || !text) redirect(await page('/dashboard/tools'))
  const sql = await db()
  const tag = str(form, 'tag', 40)
  // فقط پنجره‌ی ۲۴ ساعته‌ی رسمی؛ سقف برای اینکه یک کلیک طول اجرای سرور را رد نکند
  const people = await sql<{ igsid: string }[]>`
    select igsid from dx_contacts where ig_account_id = ${acc!.id}
      and last_dm_at > now() - interval '23 hours 50 minutes'
      ${tag ? sql`and ${tag} = any(tags)` : sql``}
    order by last_dm_at desc limit 80`
  const token = unseal(acc!.token_enc)
  let sent = 0
  for (const p of people) {
    try {
      await sendDm(acc!.ig_user_id, token, p.igsid, text)
      sent++
    } catch {
      /* یک نفر خطا داد؛ بقیه ادامه */
    }
  }
  await sql`insert into dx_events (user_id, ig_account_id, kind, ok, detail)
    values (${user.id}, ${acc!.id}, 'broadcast', ${sent > 0}, ${JSON.stringify({ t: String(sent) })})`
  redirect(await page('/dashboard/tools', '?a=' + acc!.id + '&sent=' + sent + '#broadcast'))
}

export interface GiveawayState {
  winners?: { username: string; text: string }[]
  total?: number
  error?: string
}

/** قرعه‌کشی: هر کامنت‌گذار یک شانس، پیج خودش حذف، انتخاب با randomInt امن */
export async function pickWinners(_: GiveawayState, form: FormData): Promise<GiveawayState> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  const mediaId = str(form, 'media_id', 64)
  if (!acc || !mediaId) return { error: 'invalid' }
  const count = Math.min(20, Math.max(1, Number(str(form, 'count')) || 1))
  const kw = normalize(str(form, 'keyword', 100))
  try {
    const comments = await listAllComments(unseal(acc.token_enc), mediaId)
    const byUser = new Map<string, { username: string; text: string }>()
    for (const c of comments) {
      const username = c.username ?? c.from?.username ?? ''
      const key = c.from?.id ?? username
      if (!key || username === acc.username) continue
      if (kw && !normalize(c.text ?? '').includes(kw)) continue
      if (!byUser.has(key)) byUser.set(key, { username, text: c.text ?? '' })
    }
    const pool = [...byUser.values()]
    const winners: { username: string; text: string }[] = []
    while (winners.length < count && pool.length) winners.push(pool.splice(randomInt(pool.length), 1)[0])
    return { winners, total: byUser.size }
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) }
  }
}

/* ─────────── تنظیمات ─────────── */

export async function saveAi(form: FormData): Promise<void> {
  const user = await requireUser()
  const acc = await ownAccount(user.id, str(form, 'account'))
  if (!acc) redirect(await page('/dashboard/settings'))
  const prev = acc!.settings?.ai ?? {}
  const key = str(form, 'key', 300)
  const ai = {
    enabled: form.get('enabled') === 'on',
    provider: str(form, 'provider', 20) || 'openai',
    model: str(form, 'model', 80),
    baseUrl: url(str(form, 'base_url', 300)) ?? '',
    prompt: str(form, 'prompt', 4000),
    keyEnc: key ? seal(key) : prev.keyEnc
  }
  const sql = await db()
  await sql`update dx_ig_accounts set settings = settings || ${sql.json({ ai })} where id = ${acc!.id}`
  redirect(await page('/dashboard/settings', '?a=' + acc!.id + '&saved=ai'))
}

/* ─────────── تحلیل هوش مصنوعی ─────────── */

export interface BriefState {
  text?: string
  error?: string
}

export async function aiBrief(_: BriefState, form: FormData): Promise<BriefState> {
  const user = await requireUser()
  const lang = await getLang()
  const sql = await db()
  const { computeStats, parseFilter } = await import('@/lib/stats')
  const { aiAnalyze, AI_PROVIDERS } = await import('@/lib/ai')
  const f = parseFilter({ r: str(form, 'r'), acc: str(form, 'acc'), k: str(form, 'k') })
  // اولین پیجی که هوش مصنوعی دارد (یا همان پیج فیلترشده)
  const accounts = await sql<IgAccountRow[]>`select * from dx_ig_accounts where user_id = ${user.id} order by id`
  const withAi = accounts.find((a) => (!f.accountId || a.id === f.accountId) && a.settings?.ai?.keyEnc) ?? accounts.find((a) => a.settings?.ai?.keyEnc)
  const ai = withAi?.settings?.ai
  if (!ai?.keyEnc) return { error: 'no-ai' }
  const s = await computeStats(sql, user.id, f)
  const [{ rules, forms, gates }] = await sql<{ rules: number; forms: number; gates: number }[]>`
    select count(*)::int as rules,
      count(*) filter (where questions is not null)::int as forms,
      count(*) filter (where follow_gate is not null)::int as gates
    from dx_rules where user_id = ${user.id} and enabled`
  const facts = JSON.stringify({
    periodDays: f.days,
    messagesSent: s.total,
    previousPeriod: s.prevTotal,
    bySource: Object.fromEntries(s.byKind.map((k) => [k.kind, k.n])),
    topReplies: s.topRules,
    newContacts: s.newContacts,
    leadsFromForms: s.leads,
    activeRules: rules,
    rulesWithForm: forms,
    rulesWithFollowGate: gates
  })
  const preset = AI_PROVIDERS[ai.provider ?? 'openai'] ?? AI_PROVIDERS.openai
  try {
    const text = await aiAnalyze({
      baseUrl: ai.baseUrl || preset.baseUrl,
      model: ai.model || preset.model,
      apiKey: unseal(ai.keyEnc),
      lang,
      facts
    })
    return text ? { text } : { error: 'empty' }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
