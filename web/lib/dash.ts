import { requireUser } from './auth'
import { db, type IgAccountRow } from './db'
import { getDict } from './i18n'

/** بار مشترک صفحه‌های پنل: کاربر، زبان، پیج‌ها و پیج انتخاب‌شده (?a=) */
export async function loadDash(sp: Record<string, string | undefined>, next = '/dashboard') {
  const user = await requireUser(next)
  const { lang, t } = await getDict()
  const sql = await db()
  const accounts = await sql<IgAccountRow[]>`
    select * from dx_ig_accounts where user_id = ${user.id} order by id`
  const acc = accounts.find((a) => a.id === sp.a) ?? accounts[0] ?? null
  return { user, lang, t, sql, accounts, acc }
}
