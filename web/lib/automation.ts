import { db, type IgAccountRow, type RuleRow } from './db'
import { unseal } from './crypto'
import { fill, matches } from './match'
import { privateReply, replyToComment, sendDm } from './instagram'

/**
 * پردازش رویدادهای وبهوک اینستاگرام.
 *
 * فقط API رسمی: جواب خصوصی به کامنت، جواب در پنجره‌ی ۲۴ ساعته‌ی دایرکت، و
 * واکنش به ریپلای/منشن استوری. هیچ‌کدام رمز پیج نمی‌خواهد و ریسک بن ندارد.
 */
type Trigger = RuleRow['trigger']

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
    reply_to?: { story?: { id: string } }
    attachments?: { type: string }[]
  }
}

interface Entry {
  id: string
  changes?: CommentChange[]
  messaging?: MessagingEvent[]
}

async function firstTime(id: string): Promise<boolean> {
  const sql = await db()
  const r = await sql`insert into dx_processed (id) values (${id}) on conflict do nothing returning id`
  return r.length > 0
}

async function log(acc: IgAccountRow, kind: string, ok: boolean, detail: string): Promise<void> {
  const sql = await db()
  await sql`insert into dx_events (user_id, ig_account_id, kind, ok, detail)
            values (${acc.user_id}, ${acc.id}, ${kind}, ${ok}, ${detail.slice(0, 500)})`
}

async function rulesFor(acc: IgAccountRow, trigger: Trigger): Promise<RuleRow[]> {
  const sql = await db()
  return sql<RuleRow[]>`select * from dx_rules
    where ig_account_id = ${acc.id} and trigger = ${trigger} and enabled order by id`
}

async function hit(rule: RuleRow): Promise<void> {
  const sql = await db()
  await sql`update dx_rules set hits = hits + 1 where id = ${rule.id}`
}

const buttonOf = (r: RuleRow) => (r.button_title && r.button_url ? { title: r.button_title, url: r.button_url } : null)

export async function handleWebhook(payload: { object?: string; entry?: Entry[] }): Promise<void> {
  const sql = await db()
  for (const entry of payload.entry ?? []) {
    const [acc] = await sql<(IgAccountRow & { sub_until: Date | null })[]>`
      select a.*, u.sub_until from dx_ig_accounts a join dx_users u on u.id = a.user_id
      where a.ig_user_id = ${entry.id}`
    if (!acc) continue
    if (!acc.sub_until || new Date(acc.sub_until).getTime() < Date.now()) {
      await log(acc, 'skip', false, 'اشتراک تمام شده — پیامی فرستاده نشد')
      continue
    }
    const token = unseal(acc.token_enc)

    for (const ch of entry.changes ?? []) {
      if (ch.field !== 'comments') continue
      const c = ch.value
      if (!c?.id || c.from?.id === entry.id) continue
      if (!(await firstTime('c:' + c.id))) continue
      const rule = (await rulesFor(acc, 'comment')).find((r) => matches(r.keywords, c.text ?? ''))
      if (!rule) continue
      try {
        await privateReply(acc.ig_user_id, token, c.id, fill(rule.reply, c.from?.username), buttonOf(rule))
        if (rule.public_reply) await replyToComment(token, c.id, fill(rule.public_reply, c.from?.username))
        await hit(rule)
        await log(acc, 'comment', true, `کامنت «${c.text ?? ''}» از @${c.from?.username ?? '?'} → دایرکت رفت`)
      } catch (e) {
        await log(acc, 'comment', false, (e as Error).message)
      }
    }

    for (const m of entry.messaging ?? []) {
      const msg = m.message
      if (!msg?.mid || msg.is_echo || m.sender.id === entry.id) continue
      if (!(await firstTime('m:' + msg.mid))) continue
      const isMention = msg.attachments?.some((a) => a.type === 'story_mention')
      const trigger: Trigger = isMention || msg.reply_to?.story ? 'story' : 'dm'
      const rule = (await rulesFor(acc, trigger)).find((r) => matches(r.keywords, msg.text ?? ''))
      if (!rule) continue
      try {
        await sendDm(acc.ig_user_id, token, m.sender.id, fill(rule.reply), buttonOf(rule))
        await hit(rule)
        const what = trigger === 'story' ? (isMention ? 'منشن استوری' : 'جواب استوری') : `دایرکت «${msg.text ?? ''}»`
        await log(acc, trigger, true, what + ' → جواب رفت')
      } catch (e) {
        await log(acc, trigger, false, (e as Error).message)
      }
    }
  }
}
