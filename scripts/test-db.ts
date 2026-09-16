/**
 * تست دودی (smoke test) لایه‌ی دیتابیس.
 * اجرا: npm run test:db
 */
import { rmSync, existsSync } from 'node:fs'
import { initDb, closeDb, getDb } from '../src/core/db/index'
import {
  accountsRepo,
  rulesRepo,
  contactsRepo,
  mediaRepo,
  commentsRepo,
  countersRepo,
  jobsRepo,
  broadcastsRepo,
  logRepo,
  settingsRepo
} from '../src/core/db/repos'

const DB = './scratch-test.sqlite'
const cleanup = (): void => {
  for (const f of [DB, DB + '-wal', DB + '-shm', DB + '-journal', DB + '-lock', DB + '.lock']) {
    if (existsSync(f)) rmSync(f, { recursive: true, force: true })
  }
}
cleanup()

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    pass++
    console.log('  PASS  ' + name)
  } else {
    fail++
    console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''))
  }
}

console.log('\n=== 1. مهاجرت و باز شدن دیتابیس ===')
initDb(DB)
const ver = getDb().pragma('user_version', { simple: true })
check('user_version برابر آخرین مهاجرت است', Number(ver) === 2, ver)
const tables = getDb()
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all<{ name: string }>()
  .map((r) => r.name)
check('همه‌ی جدول‌ها ساخته شدند', tables.length >= 14, tables.length)

console.log('\n=== 2. حساب: upsert و idempotency ===')
const acc = accountsRepo.upsert({
  ig_user_id: '17841400000000001',
  username: 'ashkan_shop',
  name: 'Ashkan Shop',
  engine: 'graph',
  followers_count: 1200,
  follows_count: 300,
  media_count: 42
})
check('حساب ساخته شد', acc.id === 1 && acc.username === 'ashkan_shop')
const acc2 = accountsRepo.upsert({
  ig_user_id: '17841400000000001',
  username: 'ashkan_store',
  engine: 'graph',
  followers_count: 1250
})
check('upsert دوباره رکورد جدید نساخت', acc2.id === 1, acc2.id)
check('username به‌روز شد', acc2.username === 'ashkan_store')
check('تعداد حساب‌ها = ۱', accountsRepo.all().length === 1)

// وصل‌کردن روش دوم روی همان حساب نباید اولی را پاک کند — باگی که باعث می‌شد
// کاربر بعد از «ورود ساده»، اتصال رسمی‌اش را بی‌صدا از دست بدهد
const withToken = accountsRepo.upsert({
  ig_user_id: '17841400000000001',
  username: 'ashkan_store',
  engine: 'graph',
  token_expires_at: 9999999999999
})
check('توکن ثبت شد', withToken.token_expires_at === 9999999999999)

const afterSimple = accountsRepo.upsert({
  ig_user_id: '17841400000000001',
  username: 'ashkan_store',
  engine: 'session',
  followers_count: 1300
})
check('اتصال ساده، برچسب رسمی را تنزل نداد', afterSimple.engine === 'graph')
check('اتصال ساده، انقضای توکن را پاک نکرد', afterSimple.token_expires_at === 9999999999999)
check('اطلاعات تازه به‌روز شد', afterSimple.followers_count === 1300)

console.log('\n=== 3. قوانین: JSON actions و فیلترِ فعال ===')
const rule = rulesRepo.create({
  account_id: 1,
  name: 'کد ۱ به لینک تخفیف',
  trigger_type: 'comment_keyword',
  match_mode: 'number',
  keywords: '1,۱',
  priority: 5,
  actions: [
    { type: 'send_dm', text: 'سلام {{username}} جان، لینک تخفیف: https://ex.com', order: 0 },
    { type: 'reply_comment', text: 'دایرکت رو چک کن', order: 1 }
  ]
})
check('قانون با ۲ اکشن ذخیره شد', rule.actions.length === 2, rule.actions)
check('اکشن‌ها مرتب برگشتند', rule.actions[0].type === 'send_dm')
check('boolean ها درست hydrate شدند', rule.enabled === true && rule.once_per_user === true)
rulesRepo.create({ account_id: 1, name: 'غیرفعال', trigger_type: 'comment_keyword', enabled: false })
check('active() فقط قوانین فعال را می‌دهد', rulesRepo.active(1, 'comment_keyword').length === 1)
check('byAccount() همه را می‌دهد', rulesRepo.byAccount(1).length === 2)
rulesRepo.update(rule.id, { name: 'ویرایش شد', priority: 9 })
check('update کار کرد', rulesRepo.byId(rule.id)?.name === 'ویرایش شد')

console.log('\n=== 4. مخاطبان: تراکنش تودرتو در syncFollowers ===')
const new1 = contactsRepo.syncFollowers(1, [
  { ig_user_id: 'u1', username: 'ali' },
  { ig_user_id: 'u2', username: 'sara' },
  { ig_user_id: 'u3', username: 'reza' }
])
check('بار اول ۳ فالوور جدید', new1.length === 3, new1)
const new2 = contactsRepo.syncFollowers(1, [
  { ig_user_id: 'u1', username: 'ali' },
  { ig_user_id: 'u3', username: 'reza' },
  { ig_user_id: 'u4', username: 'nima' }
])
check('بار دوم فقط u4 جدید است', new2.length === 1 && new2[0] === 'u4', new2)
check('u2 که آنفالو کرد is_follower=0 شد', contactsRepo.get(1, 'u2')?.is_follower === 0)
check('شمارش فالوورها = ۳', contactsRepo.count(1, 'followers') === 3)

console.log('\n=== 5. پنجره ۲۴ ساعته ===')
check('کاربری که پیام نداده پنجره‌اش بسته است', contactsRepo.isWindowOpen(1, 'u1') === false)
contactsRepo.markInbound(1, 'u1')
check('بعد از پیام ورودی پنجره باز است', contactsRepo.isWindowOpen(1, 'u1') === true)
getDb()
  .prepare('UPDATE contacts SET last_inbound_at=? WHERE ig_user_id=?')
  .run(Date.now() - 25 * 3600 * 1000, 'u1')
check('بعد از ۲۵ ساعت پنجره بسته می‌شود', contactsRepo.isWindowOpen(1, 'u1') === false)

console.log('\n=== 6. جلوگیری از پردازش تکراری کامنت ===')
check(
  'اولین بار دیده شد',
  commentsRepo.markSeen(1, { comment_id: 'c100', from_user_id: 'u1', matched_rule_id: rule.id }) ===
    true
)
check(
  'بار دوم رد شد (UNIQUE)',
  commentsRepo.markSeen(1, { comment_id: 'c100', from_user_id: 'u1' }) === false
)
check('alreadyHandled برای once_per_user کار می‌کند', commentsRepo.alreadyHandled(1, rule.id, 'u1') === true)
check('برای کاربر دیگر false است', commentsRepo.alreadyHandled(1, rule.id, 'u9') === false)

console.log('\n=== 7. صف: dedupe_key و claim اتمیک ===')
const j1 = jobsRepo.enqueue({ account_id: 1, kind: 'send_dm', payload: { to: 'u1' }, dedupe_key: 'dm:u1:r1' })
const j2 = jobsRepo.enqueue({ account_id: 1, kind: 'send_dm', payload: { to: 'u1' }, dedupe_key: 'dm:u1:r1' })
check('کار اول در صف رفت', j1 !== null)
check('کار تکراری رد شد', j2 === null, j2)
jobsRepo.enqueue({ account_id: 1, kind: 'send_dm', payload: { to: 'u4' } })
jobsRepo.enqueue({ account_id: 1, kind: 'send_dm', run_at: Date.now() + 600000 })
check('۳ کار pending', jobsRepo.pendingCount() === 3, jobsRepo.pendingCount())
const claimed = jobsRepo.claimReady(10)
check('فقط ۲ کارِ آماده برداشته شد (سومی زمانش نرسیده)', claimed.length === 2, claimed.length)
check('کارهای برداشته‌شده دیگر pending نیستند', jobsRepo.pendingCount() === 1)
jobsRepo.finish(claimed[0].id, 'done')
jobsRepo.retry(claimed[1].id, 5000, 'خطای شبیه‌سازی‌شده')
check('retry کار را به pending برگرداند', jobsRepo.pendingCount() === 2)
getDb().prepare("UPDATE jobs SET status='running' WHERE id=?").run(claimed[1].id)
check('recoverStuck کارهای گیرکرده را آزاد کرد', jobsRepo.recoverStuck() === 1)

console.log('\n=== 8. سقف روزانه ===')
check('شمارنده از صفر شروع می‌شود', countersRepo.get(1, 'dm') === 0)
countersRepo.inc(1, 'dm')
countersRepo.inc(1, 'dm', 4)
check('شمارنده = ۵', countersRepo.get(1, 'dm') === 5, countersRepo.get(1, 'dm'))
check('اکشن دیگر مستقل است', countersRepo.get(1, 'comment_reply') === 0)
check('todayAll درست است', countersRepo.todayAll(1).dm === 5)

console.log('\n=== 9. مدیا و برادکست ===')
mediaRepo.upsert(1, {
  media_id: 'm1',
  timestamp: Date.now(),
  media_type: 'REELS',
  like_count: 100,
  comments_count: 20,
  views: 5000,
  reach: 4000,
  saved: 30
})
mediaRepo.upsert(1, {
  media_id: 'm1',
  timestamp: Date.now(),
  like_count: 150,
  comments_count: 25,
  views: 6000,
  reach: 4500,
  saved: 35
})
check('upsert مدیا رکورد تکراری نساخت', mediaRepo.list(1).length === 1)
check('آمار به‌روز شد', mediaRepo.list(1)[0].like_count === 150)
const tot = mediaRepo.totals(1)
check('totals درست جمع زد', tot.views === 6000 && tot.likes === 150, tot)
check('pendingBroadcast پست را می‌دهد', mediaRepo.pendingBroadcast(1, 0).length === 1)
mediaRepo.markBroadcast(1, 'm1')
check('بعد از علامت‌گذاری خالی است', mediaRepo.pendingBroadcast(1, 0).length === 0)

const bc = broadcastsRepo.create({
  account_id: 1,
  name: 'اعلام پست جدید',
  message: 'پست جدید گذاشتم',
  filter_json: '{"audience":"followers"}'
})
const n = broadcastsRepo.addTargets(bc.id, [
  { ig_user_id: 'u1' },
  { ig_user_id: 'u3' },
  { ig_user_id: 'u1' }
])
check('گیرنده‌ی تکراری فیلتر شد (۲ نه ۳)', n === 2, n)
const t1 = broadcastsRepo.nextTarget(bc.id)!
broadcastsRepo.markTarget(t1.id, 'sent')
broadcastsRepo.bumpCounters(bc.id)
check('شمارنده‌ی sent = ۱', broadcastsRepo.byId(bc.id)?.sent === 1)
check('nextTarget گیرنده‌ی بعدی را می‌دهد', broadcastsRepo.nextTarget(bc.id)?.ig_user_id !== t1.ig_user_id)

console.log('\n=== 10. تنظیمات و لاگ ===')
const safe = settingsRepo.getSafety()
check('پیش‌فرض سقف دایرکت = ۵۰', safe.dailyDmCap === 50, safe.dailyDmCap)
settingsRepo.setSafety({ dailyDmCap: 30, killSwitch: true })
check(
  'تنظیمات ذخیره و merge شد',
  settingsRepo.getSafety().dailyDmCap === 30 && settingsRepo.getSafety().killSwitch === true
)
check('بقیه‌ی فیلدها حفظ شدند', settingsRepo.getSafety().quietStartHour === 1)
logRepo.add({
  account_id: 1,
  level: 'success',
  category: 'dm',
  message: 'یک دایرکت ارسال شد',
  meta: { to: 'u1' }
})
check('لاگ ثبت شد', logRepo.list(10).length === 1)
check('meta به صورت JSON ذخیره شد', JSON.parse(logRepo.list(1)[0].meta!).to === 'u1')

console.log('\n=== 11. ماندگاری روی دیسک ===')
closeDb()
initDb(DB)
check(
  'بعد از بستن و باز کردن، داده‌ها سر جایشان هستند',
  accountsRepo.all().length === 1 && rulesRepo.byAccount(1).length === 2
)
closeDb()
cleanup()

console.log('\n' + '='.repeat(46))
console.log('  موفق: ' + pass + '   ناموفق: ' + fail)
console.log('='.repeat(46) + '\n')
process.exit(fail > 0 ? 1 : 0)
