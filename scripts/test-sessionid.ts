/**
 * تست پارس کردن sessionid.
 *
 * چرا این تست مهم است: این مسیر برای وقتی است که بقیه‌ی راه‌ها کار نکرده‌اند،
 * و ورودی‌اش دستیِ کاربر است. اشتباه در کپی‌کردن رایج‌ترین حالت است، پس باید
 * هم انعطاف داشته باشیم هم خطای واضح بدهیم.
 *
 * اجرا: npm run test:sessionid
 */
import { parseSessionId, SessionIdError } from '../src/main/auth/session-id-login'

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

const RAW = '12345678%3AabcDEF123xyz%3A26%3AAYcSomeTokenValue'
const DECODED = '12345678:abcDEF123xyz:26:AYcSomeTokenValue'

console.log('\n=== 1. حالت‌های درست ===')
check('مقدار خام (URL-encoded)', parseSessionId(RAW).ds_user_id === '12345678')
check('مقدار دیکدشده', parseSessionId(DECODED).ds_user_id === '12345678')
check('sessionid دست‌نخورده می‌ماند', parseSessionId(RAW).sessionid === RAW)
check('با فاصله‌های اضافه', parseSessionId('  ' + RAW + '  ').ds_user_id === '12345678')

console.log('\n=== 2. فرمت‌هایی که کاربر ممکن است بچسباند ===')
check('با پیشوند sessionid=', parseSessionId('sessionid=' + RAW).ds_user_id === '12345678')
check(
  'کل رشته‌ی کوکی‌ها',
  parseSessionId('mid=XYZ; csrftoken=abc; sessionid=' + RAW + '; ds_user_id=12345678').ds_user_id ===
    '12345678'
)
check(
  'کوکی‌ها با ترتیب متفاوت',
  parseSessionId('sessionid=' + RAW + '; mid=ABC').sessionid === RAW,
  parseSessionId('sessionid=' + RAW + '; mid=ABC').sessionid
)
check('با گیومه‌ی دوتایی', parseSessionId('"' + RAW + '"').ds_user_id === '12345678')
check("با گیومه‌ی تکی", parseSessionId("'" + RAW + "'").ds_user_id === '12345678')

console.log('\n=== 3. ورودی‌های نادرست باید خطای واضح بدهند ===')
const expectError = (name: string, input: string, hintIncludes?: string): void => {
  try {
    parseSessionId(input)
    check(name, false, 'خطایی پرتاب نشد')
  } catch (e) {
    const isRight = e instanceof SessionIdError
    const hintOk = hintIncludes ? ((e as SessionIdError).hint ?? '').includes(hintIncludes) : true
    check(name, isRight && hintOk, (e as Error).message)
  }
}

expectError('ورودی خالی', '')
expectError('فقط فاصله', '   ')
expectError('csrftoken به‌جای sessionid', 'abcdef123456789', 'sessionid')
expectError('mid به‌جای sessionid', 'XyZaBcDeFgHiJkLmNoP', 'sessionid')
expectError('متن تصادفی', 'سلام این اشتباه است')
expectError('بدون شناسه‌ی عددی در ابتدا', 'abc%3Adef%3A26')

console.log('\n=== 4. حالت‌های مرزی ===')
check(
  'شناسه‌ی کوتاه (۳ رقم) پذیرفته می‌شود',
  parseSessionId('123%3Atoken%3A26').ds_user_id === '123'
)
check(
  'شناسه‌ی بلند (۱۵ رقم)',
  parseSessionId('123456789012345%3Atoken%3A26').ds_user_id === '123456789012345'
)
try {
  parseSessionId('12%3Atoken')
  check('شناسه‌ی خیلی کوتاه (۲ رقم) رد می‌شود', false)
} catch {
  check('شناسه‌ی خیلی کوتاه (۲ رقم) رد می‌شود', true)
}

console.log('\n=== 5. پیام خطا راهنما دارد ===')
try {
  parseSessionId('wrongvalue')
} catch (e) {
  const hint = (e as SessionIdError).hint ?? ''
  check('راهنما csrftoken و mid را نام می‌برد', hint.includes('csrftoken') && hint.includes('mid'), hint)
  check('راهنما نمونه‌ی درست نشان می‌دهد', hint.includes('%3A'), hint)
}

console.log('\n' + '='.repeat(46))
console.log('  موفق: ' + pass + '   ناموفق: ' + fail)
console.log('='.repeat(46) + '\n')
process.exit(fail > 0 ? 1 : 0)
