import type postgres from 'postgres'
import { db, type AccountSettings, type ContactRow, type IgAccountRow, type ProductRow, type RuleRow, type Trigger } from './db'
import { unseal } from './crypto'
import { fill, matches, normalize, splitKeywords } from './match'
import { aiReply, AI_PROVIDERS } from './ai'
import {
  getUserProfile,
  hideComment,
  isFollower,
  privateReply,
  replyToComment,
  sendCarousel,
  sendDm,
  sendImage,
  type Button
} from './instagram'

/**
 * پردازش رویدادهای وبهوک اینستاگرام — فقط API رسمی.
 *
 * ترتیب کار برای هر پیام: ذخیره‌ی مخاطب ← اگر وسط فرم است، جواب فرم ← پیام
 * خوشامد برای اولین پیام ← ویترین محصولات ← قانون‌های کلیدواژه ← هوش مصنوعی.
 * برای کامنت: فیلتر کلمات ← قانون‌های همان پست یا همه‌ی پست‌ها.
 */

interface CommentChange {
  field: string
  value: { id: string; text?: string; from?: { id: string; username?: string }; media?: { id: string } }
}

interface MessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  message?: {
    mid: string
    text?: string
    is_echo?: boolean
    quick_reply?: { payload?: string }
    reply_to?: { story?: { id: string } }
    attachments?: { type: string }[]
  }
  postback?: { mid?: string; title?: string; payload?: string }
}

interface Entry {
  id: string
  changes?: CommentChange[]
  messaging?: MessagingEvent[]
}

type Acc = IgAccountRow & { sub_until: Date | null }
type Contact = ContactRow & { is_new: boolean }

interface Ctx {
  sql: postgres.Sql
  acc: Acc
  token: string
  settings: AccountSettings
}

/* ─────────── کمکی‌ها ─────────── */

/** چند نسخه‌ی متن با خط «---» جدا می‌شوند و یکی تصادفی انتخاب می‌شود (ضد تکراری بودن) */
export function pickVariant(text: string): string {
  const parts = text.split(/\n\s*-{3,}\s*\n/).map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts[Math.floor(Math.random() * parts.length)] : text
}

const ruleButtons = (r: RuleRow): Button[] | null =>
  r.buttons?.length ? r.buttons : r.button_title && r.button_url ? [{ title: r.button_title, url: r.button_url }] : null

const quickList = (r: RuleRow): string[] | null =>
  r.quick_replies ? r.quick_replies.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) : null

async function firstTime(sql: postgres.Sql, id: string): Promise<boolean> {
  const r = await sql`insert into dx_processed (id) values (${id}) on conflict do nothing returning id`
  return r.length > 0
}

async function log(ctx: Ctx, kind: string, ok: boolean, detail: unknown, ruleId?: string): Promise<void> {
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail)
  await ctx.sql`insert into dx_events (user_id, ig_account_id, kind, ok, detail, rule_id)
    values (${ctx.acc.user_id}, ${ctx.acc.id}, ${kind}, ${ok}, ${text.slice(0, 500)}, ${ruleId ?? null})`
}

async function upsertContact(ctx: Ctx, igsid: string, username: string | undefined, isDm: boolean): Promise<Contact> {
  const [c] = await ctx.sql<Contact[]>`
    insert into dx_contacts (ig_account_id, igsid, username, interactions, last_dm_at)
    values (${ctx.acc.id}, ${igsid}, ${username ?? null}, 1, ${isDm ? new Date() : null})
    on conflict (ig_account_id, igsid) do update set
      username = coalesce(excluded.username, dx_contacts.username),
      interactions = dx_contacts.interactions + 1,
      last_seen = now(),
      last_dm_at = case when ${isDm} then now() else dx_contacts.last_dm_at end
    returning *, (xmax = 0) as is_new`
  // رویداد دایرکت نام کاربری ندارد؛ بار اول از پروفایل می‌خوانیم تا در «مخاطبان» و {username} باشد
  if (!c.username && isDm) {
    const p = await getUserProfile(ctx.token, igsid)
    if (p.username || p.name) {
      await ctx.sql`update dx_contacts set username = coalesce(${p.username ?? null}, username),
        name = coalesce(name, ${p.name ?? null}) where id = ${c.id}`
      c.username = p.username ?? c.username
      c.name = c.name ?? p.name ?? null
    }
  }
  return c
}

async function rulesFor(ctx: Ctx, triggers: Trigger[]): Promise<RuleRow[]> {
  return ctx.sql<RuleRow[]>`select * from dx_rules
    where ig_account_id = ${ctx.acc.id} and trigger in ${ctx.sql(triggers)} and enabled order by id`
}

async function blockedOnce(ctx: Ctx, rule: RuleRow, contact: Contact): Promise<boolean> {
  if (!rule.once_per_user) return false
  const r = await ctx.sql`select 1 from dx_rule_sends where rule_id = ${rule.id} and contact_id = ${contact.id}`
  return r.length > 0
}

async function markSent(ctx: Ctx, rule: RuleRow, contact: Contact): Promise<void> {
  await ctx.sql`update dx_rules set hits = hits + 1 where id = ${rule.id}`
  if (rule.once_per_user) {
    await ctx.sql`insert into dx_rule_sends (rule_id, contact_id) values (${rule.id}, ${contact.id}) on conflict do nothing`
  }
  if (rule.tag) {
    await ctx.sql`update dx_contacts set tags = array_append(tags, ${rule.tag})
      where id = ${contact.id} and not (${rule.tag} = any(tags))`
  }
}

async function startForm(ctx: Ctx, rule: RuleRow, contact: Contact): Promise<void> {
  await ctx.sql`insert into dx_convos (contact_id, rule_id, step, expires_at)
    values (${contact.id}, ${rule.id}, 0, now() + interval '1 day')
    on conflict (contact_id) do update set rule_id = excluded.rule_id, step = 0, expires_at = excluded.expires_at`
}

/* ─────────── ورود ─────────── */

export async function handleWebhook(payload: { object?: string; entry?: Entry[] }): Promise<void> {
  const sql = await db()
  for (const entry of payload.entry ?? []) {
    const [acc] = await sql<Acc[]>`
      select a.*, u.sub_until from dx_ig_accounts a join dx_users u on u.id = a.user_id
      where a.ig_user_id = ${entry.id}`
    if (!acc) continue
    const ctx: Ctx = { sql, acc, token: '', settings: acc.settings ?? {} }
    if (!acc.sub_until || new Date(acc.sub_until).getTime() < Date.now()) {
      await log(ctx, 'skip', false, { e: 'expired' })
      continue
    }
    ctx.token = unseal(acc.token_enc)

    for (const ch of entry.changes ?? []) {
      if (ch.field !== 'comments' || !ch.value?.id || ch.value.from?.id === entry.id) continue
      if (!(await firstTime(sql, 'c:' + ch.value.id))) continue
      try {
        await handleComment(ctx, ch.value)
      } catch (e) {
        await log(ctx, 'comment', false, (e as Error).message)
      }
    }

    for (const m of entry.messaging ?? []) {
      const id = m.message?.mid ?? m.postback?.mid
      if (!id || m.message?.is_echo || m.sender.id === entry.id) continue
      if (!(await firstTime(sql, 'm:' + id))) continue
      try {
        await handleMessage(ctx, m)
      } catch (e) {
        await log(ctx, 'dm', false, (e as Error).message)
      }
    }
  }
}

/* ─────────── کامنت ─────────── */

async function handleComment(ctx: Ctx, c: CommentChange['value']): Promise<void> {
  const text = c.text ?? ''
  const mod = ctx.settings.moderation
  if (mod?.enabled && splitKeywords(mod.words ?? '').length && matches(mod.words ?? '', text)) {
    await hideComment(ctx.token, c.id)
    await log(ctx, 'moderation', true, { t: text, u: c.from?.username ?? '' })
    return
  }
  if (!c.from?.id) return
  const contact = await upsertContact(ctx, c.from.id, c.from.username, false)
  const mediaId = c.media?.id
  const rule = (await rulesFor(ctx, ['comment'])).find(
    (r) => (!r.media_id || r.media_id === mediaId) && matches(r.keywords, text)
  )
  if (!rule || (await blockedOnce(ctx, rule, contact))) return
  const username = c.from.username

  // اینستاگرام اجازه‌ی فقط یک پیام خصوصی به ازای هر کامنت می‌دهد؛ پس شرط فالو،
  // جواب و اولین سؤال فرم همه باید در همان یک پیام باشند
  if (rule.follow_gate && (await isFollower(ctx.token, c.from.id)) === false) {
    await privateReply(ctx.acc.ig_user_id, ctx.token, c.id, fill(rule.follow_gate, username))
    await log(ctx, 'gate', true, { u: username ?? '' }, rule.id)
    return
  }
  let msg = fill(pickVariant(rule.reply), username)
  const form = rule.questions?.length ? rule.questions : null
  if (form) msg += '\n\n' + form[0].ask
  await privateReply(ctx.acc.ig_user_id, ctx.token, c.id, msg, form ? null : ruleButtons(rule))
  if (form) await startForm(ctx, rule, contact)
  if (rule.public_reply) await replyToComment(ctx.token, c.id, fill(pickVariant(rule.public_reply), username))
  await markSent(ctx, rule, contact)
  await log(ctx, 'comment', true, { t: text, u: username ?? '' }, rule.id)
}

/* ─────────── دایرکت ─────────── */

async function handleMessage(ctx: Ctx, m: MessagingEvent): Promise<void> {
  const msg = m.message
  const text = (msg?.quick_reply?.payload ?? msg?.text ?? m.postback?.payload ?? m.postback?.title ?? '').trim()
  const isMention = !!msg?.attachments?.some((a) => a.type === 'story_mention')
  const isStoryReply = !!msg?.reply_to?.story
  const contact = await upsertContact(ctx, m.sender.id, undefined, true)

  // ۱. وسط یک فرم است: این پیام جواب سؤال قبلی است
  if (text && !isMention) {
    const [convo] = await ctx.sql<{ rule_id: string; step: number }[]>`
      select rule_id, step from dx_convos where contact_id = ${contact.id} and expires_at > now()`
    if (convo) {
      await continueForm(ctx, contact, convo.rule_id, convo.step, text)
      return
    }
  }

  // ۲. اولین پیام این شخص به پیج
  if (contact.is_new && !isMention) {
    const welcome = (await rulesFor(ctx, ['first_dm']))[0]
    if (welcome) {
      await runDmRule(ctx, welcome, contact, 'first_dm', text)
      return
    }
  }

  // ۳. استوری
  if (isMention || isStoryReply) {
    const triggers: Trigger[] = isMention ? ['mention', 'story'] : ['story']
    const rule = (await rulesFor(ctx, triggers)).find((r) => matches(r.keywords, text))
    if (rule) await runDmRule(ctx, rule, contact, isMention ? 'mention' : 'story', text)
    return
  }
  if (!text) return

  // ۴. ویترین محصولات
  const cat = ctx.settings.catalog
  if (cat?.keywords && splitKeywords(cat.keywords).length && matches(cat.keywords, text)) {
    const products = await ctx.sql<ProductRow[]>`
      select * from dx_products where ig_account_id = ${ctx.acc.id} order by sort, id limit 10`
    if (products.length) {
      if (cat.intro) await sendDm(ctx.acc.ig_user_id, ctx.token, m.sender.id, cat.intro)
      await sendCarousel(ctx.acc.ig_user_id, ctx.token, m.sender.id, products.map((p) => ({ ...p, button: cat.button || 'View' })))
      await log(ctx, 'catalog', true, { t: text })
      return
    }
  }

  // ۵. قانون‌های کلیدواژه
  const rule = (await rulesFor(ctx, ['dm'])).find((r) => matches(r.keywords, text))
  if (rule) {
    await runDmRule(ctx, rule, contact, 'dm', text)
    return
  }

  // ۶. هوش مصنوعی
  const ai = ctx.settings.ai
  if (ai?.enabled && ai.keyEnc && ai.prompt) {
    const preset = AI_PROVIDERS[ai.provider ?? 'openai'] ?? AI_PROVIDERS.openai
    const reply = await aiReply({
      baseUrl: ai.baseUrl || preset.baseUrl,
      model: ai.model || preset.model,
      apiKey: unseal(ai.keyEnc),
      businessPrompt: ai.prompt,
      userMessage: text
    })
    if (reply) {
      await sendDm(ctx.acc.ig_user_id, ctx.token, m.sender.id, reply)
      await log(ctx, 'ai', true, { t: text })
    }
  }
}

async function runDmRule(ctx: Ctx, rule: RuleRow, contact: Contact, kind: string, text: string): Promise<void> {
  if (await blockedOnce(ctx, rule, contact)) return
  const to = contact.igsid
  const ig = ctx.acc.ig_user_id
  if (rule.follow_gate && (await isFollower(ctx.token, to)) === false) {
    await sendDm(ig, ctx.token, to, fill(rule.follow_gate, contact.username ?? undefined))
    await log(ctx, 'gate', true, { u: contact.username ?? '' }, rule.id)
    return
  }
  if (rule.image_url) await sendImage(ig, ctx.token, to, rule.image_url)
  const body = fill(pickVariant(rule.reply), contact.username ?? undefined)
  const form = rule.questions?.length ? rule.questions : null
  if (form) {
    await sendDm(ig, ctx.token, to, body)
    await sendDm(ig, ctx.token, to, form[0].ask)
    await startForm(ctx, rule, contact)
  } else {
    await sendDm(ig, ctx.token, to, body, ruleButtons(rule), quickList(rule))
  }
  await markSent(ctx, rule, contact)
  await log(ctx, kind, true, { t: text }, rule.id)
}

/* ─────────── فرم (جمع‌آوری اطلاعات مشتری) ─────────── */

const PHONE = /^\+?\d{8,15}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function continueForm(ctx: Ctx, contact: Contact, ruleId: string, step: number, raw: string): Promise<void> {
  const [rule] = await ctx.sql<RuleRow[]>`select * from dx_rules where id = ${ruleId}`
  const qs = rule?.questions ?? []
  const q = qs[step]
  const to = contact.igsid
  const ig = ctx.acc.ig_user_id
  if (!rule || !q) {
    await ctx.sql`delete from dx_convos where contact_id = ${contact.id}`
    return
  }
  let value = raw.trim().slice(0, 300)
  if (q.key === 'phone') {
    value = normalize(value).replace(/[\s\-()]/g, '')
    if (!PHONE.test(value)) {
      await sendDm(ig, ctx.token, to, '⚠️ ' + q.ask)
      return
    }
  }
  if (q.key === 'email' && !EMAIL.test(value)) {
    await sendDm(ig, ctx.token, to, '⚠️ ' + q.ask)
    return
  }

  if (q.key === 'name') await ctx.sql`update dx_contacts set name = ${value} where id = ${contact.id}`
  else if (q.key === 'phone') await ctx.sql`update dx_contacts set phone = ${value} where id = ${contact.id}`
  else if (q.key === 'email') await ctx.sql`update dx_contacts set email = ${value} where id = ${contact.id}`
  else {
    await ctx.sql`update dx_contacts set answers = answers || ${ctx.sql.json({ [q.key]: value })} where id = ${contact.id}`
  }

  if (step + 1 < qs.length) {
    await ctx.sql`update dx_convos set step = ${step + 1}, expires_at = now() + interval '1 day' where contact_id = ${contact.id}`
    await sendDm(ig, ctx.token, to, qs[step + 1].ask)
    return
  }
  await ctx.sql`delete from dx_convos where contact_id = ${contact.id}`
  if (rule.done_text) await sendDm(ig, ctx.token, to, fill(rule.done_text, contact.username ?? undefined), ruleButtons(rule))
  await log(ctx, 'form', true, { u: contact.username ?? '', t: rule.name ?? '' }, rule.id)
}
