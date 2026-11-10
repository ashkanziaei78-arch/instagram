/**
 * تست قابلیت‌های «کامنت هوشمند»: چند تریگر، محدوده‌ی استوری، فرم داخل دایرکت،
 * پاسخ عمومی تصادفی و پیام پیگیری.
 * اجرا: npm run test:builder
 */
import { rmSync, existsSync } from 'node:fs'
import { initDb, getDb } from '../src/core/db/index'
import { accountsRepo, contactsRepo, formsRepo, jobsRepo, rulesRepo } from '../src/core/db/repos'
import { handleIncomingComment, handleIncomingDm, handleStoryEvent, validateAnswer } from '../src/core/automations'
import { richToText } from '../src/core/engine/types'

const DB = './scratch-builder.sqlite'
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
const payloads = (kind: string): Record<string, unknown>[] =>
  jobsRepo
    .list(500)
    .filter((j) => j.kind === kind)
    .map((j) => ({ ...JSON.parse(j.payload), run_at: j.run_at }))

;(async () => {
  initDb(DB)
  const acc = accountsRepo.upsert({ ig_user_id: '17841400000000099', username: 'mahtab.store', engine: 'graph' })

  console.log('\n=== 1. یک قانون، چند تریگر ===')
  const rule = rulesRepo.create({
    account_id: acc.id,
    name: 'قیمت → فرم',
    trigger_type: 'comment_keyword',
    extra_triggers: ['story_reply', 'dm_keyword'],
    story_scope: 'story_1',
    match_mode: 'contains',
    keywords: 'قیمت,price',
    delay_min: 0,
    delay_max: 0,
    actions: [
      {
        type: 'send_dm',
        order: 0,
        text: 'سلام {{username}}',
        questions: [
          { kind: 'name', ask: 'اسمت چیه؟' },
          { kind: 'phone', ask: 'شماره‌ات؟' }
        ],
        doneText: 'مرسی!'
      },
      { type: 'reply_comment', order: 1, text: 'الف', variants: ['الف', 'ب', 'ج'] },
      { type: 'follow_up', order: 2, hours: 3, text: 'پیگیری' }
    ]
  })
  check('extra_triggers ذخیره و خوانده شد', rule.extra_triggers.join(',') === 'story_reply,dm_keyword', rule.extra_triggers)
  check('story_scope ذخیره شد', rule.story_scope === 'story_1')
  check('در قوانین کامنت دیده می‌شود', rulesRepo.active(acc.id, 'comment_keyword').some((r) => r.id === rule.id))
  check('در قوانین استوری دیده می‌شود', rulesRepo.active(acc.id, 'story_reply').some((r) => r.id === rule.id))
  check('در قوانین دایرکت دیده می‌شود', rulesRepo.active(acc.id, 'dm_keyword').some((r) => r.id === rule.id))
  check('در قوانین منشن نیست', !rulesRepo.active(acc.id, 'mention').some((r) => r.id === rule.id))

  console.log('\n=== 2. کامنت → دایرکت با فرم، پاسخ عمومی تصادفی، پیگیری ===')
  const t0 = Date.now()
  const res = await handleIncomingComment({
    accountId: acc.id,
    commentId: 'c1',
    mediaId: 'm1',
    text: 'قیمتشون لطفا',
    fromUserId: 'u1',
    fromUsername: 'sara'
  })
  check('مشتق کلمه («قیمتشون») تطبیق یافت', res.handled, res)
  const dm = payloads('dm.send').find((p) => p.commentId === 'c1')
  check('دایرکت اول شامل سؤال اول فرم است', String(dm?.text).includes('اسمت چیه؟'), dm?.text)
  check('دایرکت اول فرم را همراه دارد', Array.isArray((dm?.form as { questions?: unknown[] })?.questions))
  const pub = payloads('comment.reply')[0]
  check('پاسخ عمومی یکی از نسخه‌هاست', ['الف', 'ب', 'ج'].includes(String(pub?.text)), pub?.text)
  const fu = payloads('dm.send').find((p) => p.text === 'پیگیری')
  check('پیگیری بدون commentId است', !!fu && !fu.commentId)
  check('پیگیری فقط در پنجره‌ی ۲۴ ساعته', fu?.requireWindow === true)
  check('پیگیری ~۳ ساعت بعد است', Number(fu?.run_at) - t0 >= 3 * 3600e3 - 5000, Number(fu?.run_at) - t0)

  const again = await handleIncomingComment({ accountId: acc.id, commentId: 'c2', mediaId: 'm1', text: 'قیمت', fromUserId: 'u1', fromUsername: 'sara' })
  check('کامنت دوم همان نفر (هر نفر یک بار) رد می‌شود', !again.handled && again.reason.includes('قبلا'), again)

  console.log('\n=== 3. محدوده‌ی استوری ===')
  const other = await handleStoryEvent({ accountId: acc.id, fromUserId: 'u2', text: 'قیمت', kind: 'story_reply', storyId: 'story_9' })
  check('جواب به استوری دیگر رد می‌شود', !other.handled, other)
  const unknown = await handleStoryEvent({ accountId: acc.id, fromUserId: 'u3', text: 'قیمت', kind: 'story_reply' })
  check('استوری نامعلوم هم رد می‌شود (ایمن)', !unknown.handled, unknown)
  const same = await handleStoryEvent({ accountId: acc.id, fromUserId: 'u4', text: 'قیمت', kind: 'story_reply', storyId: 'story_1' })
  check('جواب به همان استوری قبول است', same.handled, same)

  console.log('\n=== 4. محدوده‌ی پست روی دایرکت اثر ندارد ===')
  const scoped = rulesRepo.create({
    account_id: acc.id,
    name: 'پست خاص + دایرکت',
    trigger_type: 'comment_keyword',
    extra_triggers: ['dm_keyword'],
    media_scope: 'm7',
    match_mode: 'contains',
    keywords: 'تخفیف',
    actions: [{ type: 'send_dm', order: 0, text: 'کد: OFF10' }]
  })
  const dmRes = await handleIncomingDm({ accountId: acc.id, fromUserId: 'u5', text: 'تخفیف دارید؟' })
  check('کلمه در دایرکت با وجود محدوده‌ی پست می‌خورد', dmRes.handled && dmRes.reason.includes(scoped.name), dmRes)
  const offPost = await handleIncomingComment({ accountId: acc.id, commentId: 'c9', mediaId: 'm8', text: 'تخفیف', fromUserId: 'u6' })
  check('کامنت روی پست دیگر نمی‌خورد', !offPost.handled, offPost)

  console.log('\n=== 5. فرم داخل دایرکت ===')
  check('موبایل فارسی معتبر', validateAnswer('phone', '۰۹۱۲ ۳۴۵ ۶۷۸۹') === '09123456789')
  check('موبایل با +98', validateAnswer('phone', '+989123456789') === '09123456789')
  check('موبایل نامعتبر رد', validateAnswer('phone', '12345') === null)
  check('ایمیل معتبر', validateAnswer('email', 'A@Mail.com') === 'a@mail.com')
  check('ایمیل نامعتبر رد', validateAnswer('email', 'a@b') === null)

  contactsRepo.upsert(acc.id, { ig_user_id: 'u1', username: 'sara' })
  formsRepo.start({
    account_id: acc.id,
    contact_ig_id: 'u1',
    rule_id: rule.id,
    questions: [
      { kind: 'name', ask: 'اسمت چیه؟' },
      { kind: 'phone', ask: 'شماره‌ات؟' }
    ],
    done_text: 'مرسی!',
    id_source: 'graph'
  })
  const a1 = await handleIncomingDm({ accountId: acc.id, fromUserId: 'u1', text: 'سارا', messageId: 'mm1' })
  check('جواب اول ثبت و سؤال بعد رفت', a1.reason.includes('سؤال بعدی'), a1)
  // «قیمت» کلیدواژه است ولی چون وسط فرم است باید جواب فرم حساب شود
  const a2 = await handleIncomingDm({ accountId: acc.id, fromUserId: 'u1', text: 'قیمت', messageId: 'mm2' })
  check('وسط فرم، کلیدواژه جواب فرم حساب می‌شود (و نامعتبر است)', a2.reason.includes('معتبر نبود'), a2)
  const a3 = await handleIncomingDm({ accountId: acc.id, fromUserId: 'u1', text: '۰۹۱۲۳۴۵۶۷۸۹', messageId: 'mm3' })
  check('فرم کامل شد', a3.reason === 'فرم کامل شد', a3)
  const c = getDb().prepare('SELECT full_name, phone, form_answers FROM contacts WHERE ig_user_id=?').get('u1') as {
    full_name: string
    phone: string
    form_answers: string
  }
  check('نام روی مخاطب ذخیره شد', c.full_name === 'سارا', c)
  check('شماره روی مخاطب ذخیره شد', c.phone === '09123456789', c)
  check('فرم بسته شد', !formsRepo.get(acc.id, 'u1'))
  check('پیام پایان فرم در صف است', payloads('dm.send').some((p) => p.text === 'مرسی!' && p.recipientIgId === 'u1'))

  console.log('\n=== 6. متن جایگزین برای موتور غیررسمی ===')
  const txt = richToText('سلام', {
    media: { url: 'https://x.ir/v.mp4', kind: 'video' },
    cards: [{ title: 'مانتو', subtitle: '۱.۲ میلیون', url: 'https://x.ir/p' }]
  })
  check('لینک رسانه و کارت در متن آمد', txt.includes('https://x.ir/v.mp4') && txt.includes('مانتو') && txt.includes('https://x.ir/p'), txt)

  console.log('\n==============================================')
  console.log('  موفق: ' + pass + '   ناموفق: ' + fail)
  console.log('==============================================')
  cleanup()
  process.exit(fail ? 1 : 0)
})()
