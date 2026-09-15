/**
 * تست موتور تطبیق و ابزارهای متنی.
 * اجرا: npm run test:matcher
 */
import { normalizeText, toLatinDigits, spin, renderTemplate, buildMessage } from '../src/core/text'
import { matchText, findMatchingRule, parseKeywords } from '../src/core/rules/matcher'
import type { Rule } from '../src/shared/types'

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

console.log('\n=== 1. تبدیل ارقام ===')
check('ارقام فارسی', toLatinDigits('۱۲۳۴۵۶۷۸۹۰') === '1234567890', toLatinDigits('۱۲۳۴۵۶۷۸۹۰'))
check('ارقام عربی', toLatinDigits('٠١٢٣٤٥٦٧٨٩') === '0123456789', toLatinDigits('٠١٢٣٤٥٦٧٨٩'))
check('ترکیب با متن', toLatinDigits('کد ۵ رو بفرست') === 'کد 5 رو بفرست')
check('لاتین دست‌نخورده می‌ماند', toLatinDigits('abc 123') === 'abc 123')

console.log('\n=== 2. نرمال‌سازی ===')
check('ي عربی به ی فارسی', normalizeText('كي') === normalizeText('کی'), [normalizeText('كي'), normalizeText('کی')])
check('حذف ایموجی', normalizeText('۱️⃣') === '1', JSON.stringify(normalizeText('۱️⃣')))
check('حذف علائم', normalizeText('قیمت؟؟!') === 'قیمت', JSON.stringify(normalizeText('قیمت؟؟!')))
check('نیم‌فاصله به فاصله', normalizeText('می‌خواهم') === 'می خواهم', JSON.stringify(normalizeText('می‌خواهم')))
check('فاصله‌های اضافه جمع می‌شوند', normalizeText('  a    b  ') === 'a b')
check('حروف بزرگ کوچک می‌شوند', normalizeText('HELLO') === 'hello')
check('با keepCase حفظ می‌شود', normalizeText('HELLO', { keepCase: true }) === 'HELLO')

console.log('\n=== 3. حالت عدد (مهم‌ترین بخش) ===')
check('عدد فارسی با کلیدواژه لاتین', matchText('۱', 'number', ['1']).matched === true)
check('عدد لاتین با کلیدواژه فارسی', matchText('1', 'number', ['۱']).matched === true)
check('عدد عربی هم کار می‌کند', matchText('١', 'number', ['1']).matched === true)
check('عدد داخل جمله', matchText('لطفا 2 رو برام بفرست', 'number', ['2']).matched === true)
check('عدد با ایموجی', matchText('۳ 🙏', 'number', ['3']).matched === true)
check('«10» قانون «1» را فعال نمی‌کند', matchText('10', 'number', ['1']).matched === false, matchText('10', 'number', ['1']))
check('«21» قانون «2» را فعال نمی‌کند', matchText('21', 'number', ['2']).matched === false)
check('«10» قانون «10» را فعال می‌کند', matchText('10', 'number', ['10']).matched === true)
check('عدد اشتباه تطبیق نمی‌دهد', matchText('5', 'number', ['1', '2', '3']).matched === false)
check('چند عدد در کلیدواژه', matchText('۲', 'number', ['1', '2', '3']).matched === true)

console.log('\n=== 4. حالت contains و مرز کلمه ===')
check('کلمه‌ی کامل تطبیق می‌دهد', matchText('کد رو بده', 'contains', ['کد']).matched === true)
check('«کدوم» قانون «کد» را فعال نمی‌کند', matchText('کدوم رنگ؟', 'contains', ['کد']).matched === false, matchText('کدوم رنگ؟', 'contains', ['کد']))
check('عبارت چندکلمه‌ای', matchText('سلام قیمت چنده', 'contains', ['قیمت چنده']).matched === true)
check('با ك عربی هم تطبیق می‌دهد', matchText('كد رو بفرست', 'contains', ['کد']).matched === true)
check('کلیدواژه با ایموجی اطراف', matchText('🔥 قیمت 🔥', 'contains', ['قیمت']).matched === true)
check('کلمه‌ی نامربوط', matchText('سلام خوبی', 'contains', ['قیمت']).matched === false)

console.log('\n=== 5. حالت exact و starts_with ===')
check('exact برابر', matchText('قیمت', 'exact', ['قیمت']).matched === true)
check('exact با متن اضافه رد می‌شود', matchText('قیمت چنده', 'exact', ['قیمت']).matched === false)
check('exact با ارقام فارسی', matchText('۱۲', 'exact', ['12']).matched === true)
check('starts_with درست', matchText('قیمت این چنده', 'starts_with', ['قیمت']).matched === true)
check('starts_with از وسط رد می‌شود', matchText('این قیمت چنده', 'starts_with', ['قیمت']).matched === false)

console.log('\n=== 6. حالت regex ===')
check('regex ساده', matchText('کد A123', 'regex', ['[A-Z]\\d{3}']).matched === true)
check('regex بی‌تطبیق', matchText('سلام', 'regex', ['^\\d+$']).matched === false)
check('regex معیوب کرش نمی‌کند', matchText('سلام', 'regex', ['[']).matched === false)

console.log('\n=== 7. parseKeywords ===')
check('جدا با کاما', parseKeywords('a, b ,c').length === 3)
check('جدا با کامای فارسی', parseKeywords('الف، ب').length === 2)
check('جدا با خط جدید', parseKeywords('a\nb').length === 2)
check('خالی‌ها حذف می‌شوند', parseKeywords('a,,  ,b').length === 2, parseKeywords('a,,  ,b'))

console.log('\n=== 8. اولویت قوانین ===')
const base = {
  account_id: 1,
  enabled: true,
  case_sensitive: false,
  media_scope: null,
  actions: [],
  once_per_user: true,
  delay_min: 0,
  delay_max: 0,
  hit_count: 0,
  created_at: 0,
  updated_at: 0
}
const rules: Rule[] = [
  { ...base, id: 1, name: 'اولویت بالا', trigger_type: 'comment_keyword', match_mode: 'contains', keywords: 'قیمت', priority: 10 },
  { ...base, id: 2, name: 'اولویت پایین', trigger_type: 'comment_keyword', match_mode: 'contains', keywords: 'قیمت', priority: 1 }
]
check('قانون با اولویت بالاتر برنده می‌شود', findMatchingRule(rules, 'قیمت چنده')?.rule.id === 1)
const disabled: Rule[] = [{ ...rules[0], enabled: false }, rules[1]]
check('قانون غیرفعال رد می‌شود', findMatchingRule(disabled, 'قیمت چنده')?.rule.id === 2)
check('بدون تطبیق null برمی‌گردد', findMatchingRule(rules, 'سلام') === null)

console.log('\n=== 9. محدوده‌ی پست (media_scope) ===')
const scoped: Rule[] = [
  { ...base, id: 3, name: 'فقط پست خاص', trigger_type: 'comment_keyword', match_mode: 'contains', keywords: 'کد', priority: 0, media_scope: 'm100,m200' }
]
check('پست داخل محدوده', findMatchingRule(scoped, 'کد', 'm100')?.rule.id === 3)
check('پست بیرون محدوده رد می‌شود', findMatchingRule(scoped, 'کد', 'm999') === null)
check('بدون media_scope همه‌ی پست‌ها', findMatchingRule(rules, 'قیمت', 'm999')?.rule.id === 1)

console.log('\n=== 10. comment_any ===')
const anyRule: Rule[] = [
  { ...base, id: 4, name: 'همه', trigger_type: 'comment_any', match_mode: 'contains', keywords: '', priority: 0 }
]
check('comment_any هر متنی را می‌گیرد', findMatchingRule(anyRule, 'هر چیزی')?.rule.id === 4)

console.log('\n=== 11. Spintax ===')
const always0 = (): number => 0
const always99 = (): number => 0.999
check('گزینه‌ی اول با rng=0', spin('{الف|ب|ج}', always0) === 'الف')
check('گزینه‌ی آخر با rng≈1', spin('{الف|ب|ج}', always99) === 'ج')
check('متن اطراف حفظ می‌شود', spin('سلام {دوست|رفیق} من', always0) === 'سلام دوست من')
check('تودرتو', spin('{سلام {علی|رضا}|بای}', always0) === 'سلام علی', spin('{سلام {علی|رضا}|بای}', always0))
check('بدون spintax دست‌نخورده', spin('سلام ساده') === 'سلام ساده')
check('ورودی معیوب کرش نمی‌کند', typeof spin('{بدون بسته') === 'string')

console.log('\n=== 12. قالب متغیرها ===')
check('جای‌گذاری ساده', renderTemplate('سلام {{username}}', { username: 'ali' }) === 'سلام ali')
check('چند متغیر', renderTemplate('{{name}} - {{username}}', { name: 'A', username: 'b' }) === 'A - b')
check('فاصله داخل آکولاد', renderTemplate('{{ username }}', { username: 'ali' }) === 'ali')
check('متغیر ناموجود خالی می‌شود نه undefined', renderTemplate('x{{nope}}y', {}) === 'xy', renderTemplate('x{{nope}}y', {}))
check('عدد هم کار می‌کند', renderTemplate('{{followers_count}}', { followers_count: 120 }) === '120')

console.log('\n=== 13. خط لوله‌ی کامل پیام ===')
const msg = buildMessage('{سلام|درود} {{username}} جان، {{post_link}}', { username: 'ali', post_link: 'https://x.co/p' }, always0)
check('spintax و متغیر با هم', msg === 'سلام ali جان، https://x.co/p', msg)

console.log('\n=== 14. نیم‌فاصله در تطبیق ===')
check('کلیدواژه با نیم‌فاصله، کامنت بدون آن', matchText('قیمتها چنده', 'contains', ['قیمت‌ها']).matched === true)
check('کلیدواژه بدون نیم‌فاصله، کامنت با آن', matchText('قیمت‌ها چنده', 'contains', ['قیمتها']).matched === true)
check('کلیدواژه با فاصله، کامنت با نیم‌فاصله', matchText('می‌خواهم', 'contains', ['می خواهم']).matched === true)
check('exact با نیم‌فاصله', matchText('بسته‌بندی', 'exact', ['بستهبندی']).matched === true)
check('کلمه‌ی کوتاه تطبیق کاذب نمی‌دهد', matchText('کدوم رنگ', 'contains', ['کد']).matched === false)
check('نرمال‌سازی نیم‌فاصله درست است', normalizeText('می‌خواهم') === 'می خواهم', JSON.stringify(normalizeText('می‌خواهم')))

console.log('\n' + '='.repeat(46))
console.log('  موفق: ' + pass + '   ناموفق: ' + fail)
console.log('='.repeat(46) + '\n')
process.exit(fail > 0 ? 1 : 0)
