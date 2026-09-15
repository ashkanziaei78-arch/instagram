/**
 * تست موتور وب بدون تماس با اینستاگرام واقعی.
 *
 * چه چیزی اینجا تست می‌شود: منطق نشست، ساخت هدرها، نگاشت خطاها و صفحه‌بندی.
 * برای این کار fetch سراسری را با یک نسخه‌ی ساختگی جایگزین می‌کنیم که پاسخ‌های
 * واقعی اینستاگرام را تقلید می‌کند.
 *
 * چه چیزی اینجا تست *نمی‌شود*: اینکه اندپوینت‌های واقعی اینستاگرام همان شکلی
 * که انتظار داریم جواب می‌دهند. آن فقط با یک حساب واقعی قابل تأیید است.
 *
 * اجرا: npm run test:web
 */
import { WebEngine, type WebSessionData } from '../src/core/engine/web-engine'
import { AuthError, RateLimitError } from '../src/core/engine/types'
import { initDb, closeDb } from '../src/core/db/index'
import { existsSync, rmSync } from 'node:fs'

const DB = './scratch-web.sqlite'
const cleanup = (): void => {
  for (const f of [DB, DB + '.lock', DB + '-journal']) {
    if (existsSync(f)) rmSync(f, { recursive: true, force: true })
  }
}
cleanup()
initDb(DB) // logRepo داخل موتور استفاده می‌شود

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

/* ─────────── ذخیره‌گاه ساختگی ─────────── */
const mem = new Map<number, string>()
const store = {
  load: (id: number): string | null => mem.get(id) ?? null,
  save: (id: number, s: string): void => void mem.set(id, s),
  clear: (id: number): void => void mem.delete(id)
}

const SESSION: WebSessionData = {
  cookies: {
    sessionid: 'SESSION_ABC',
    ds_user_id: '12345',
    csrftoken: 'CSRF_XYZ',
    mid: 'MID_1'
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36'
}

/* ─────────── fetch ساختگی ─────────── */
interface Captured {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}
let captured: Captured[] = []
interface FakeResponse {
  status: number
  body: string
  url?: string
  redirected?: boolean
}
let nextResponse: FakeResponse = { status: 200, body: '{}' }
const responseQueue: FakeResponse[] = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString()
  captured.push({
    url,
    method: init?.method ?? 'GET',
    headers: (init?.headers as Record<string, string>) ?? {},
    body: init?.body as string | undefined
  })
  const r = responseQueue.length > 0 ? responseQueue.shift()! : nextResponse
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    url: r.url ?? url,
    redirected: r.redirected ?? false,
    text: async () => r.body
  } as Response
}) as typeof fetch

const engine = new WebEngine(store)

async function run(): Promise<void> {
  console.log('\n=== 1. مدیریت نشست ===')
  check('بدون نشست، وصل نیست', engine.isConnected(1) === false)
  engine.attach(1, SESSION)
  check('بعد از attach وصل است', engine.isConnected(1) === true)
  check('نشست در ذخیره‌گاه رفت', mem.has(1))
  const fresh = new WebEngine(store)
  check('موتور تازه نشست را از ذخیره‌گاه می‌خواند', fresh.isConnected(1) === true)
  engine.detach(1)
  check('بعد از detach وصل نیست', engine.isConnected(1) === false)
  engine.attach(1, SESSION)

  console.log('\n=== 2. هدرهای درخواست ===')
  // از listFollowers استفاده می‌کنیم چون یک فراخوانی قطعی با آدرس مشخص دارد؛
  // listMedia حالا زنجیره‌ای است و اولین آدرسش به کش نام کاربری بستگی دارد.
  captured = []
  nextResponse = { status: 200, body: JSON.stringify({ users: [] }) }
  await engine.listFollowers(1, 5)
  const h = captured[0].headers
  check('X-IG-App-ID فرستاده شد', h['X-IG-App-ID'] === '936619743392459', h['X-IG-App-ID'])
  check('کوکی‌ها در هدر هستند', (h.Cookie ?? '').includes('sessionid=SESSION_ABC'))
  check('ds_user_id در کوکی هست', (h.Cookie ?? '').includes('ds_user_id=12345'))
  check('CSRF از کوکی برداشته شد', h['X-CSRFToken'] === 'CSRF_XYZ')
  check('User-Agent همان نشست است', h['User-Agent'] === SESSION.userAgent)
  check('Referer ست شده', h.Referer === 'https://www.instagram.com/')
  check('آدرس درست است', captured[0].url.includes('/api/v1/friendships/12345/followers/'), captured[0].url)

  console.log('\n=== 3. نگاشت خطاها ===')
  const expectError = async (
    label: string,
    resp: FakeResponse,
    kind: 'auth' | 'rate' | 'plain'
  ): Promise<void> => {
    nextResponse = resp
    try {
      await engine.listFollowers(1, 5)
      check(label, false, 'خطایی پرتاب نشد')
    } catch (e) {
      const isAuth = e instanceof AuthError
      const isRate = e instanceof RateLimitError
      const ok = kind === 'auth' ? isAuth : kind === 'rate' ? isRate : !isAuth && !isRate
      check(label, ok, (e as Error).name + ': ' + (e as Error).message.slice(0, 60))
    }
  }

  await expectError('۴۰۱ به AuthError نگاشت می‌شود', { status: 401, body: '{}' }, 'auth')
  await expectError(
    'login_required به AuthError',
    { status: 403, body: '{"message":"login_required"}' },
    'auth'
  )
  await expectError('۴۲۹ به RateLimitError', { status: 429, body: '{}' }, 'rate')
  await expectError(
    'feedback_required به RateLimitError',
    { status: 400, body: '{"message":"feedback_required"}' },
    'rate'
  )
  await expectError(
    'ریدایرکت به صفحه‌ی لاگین یعنی نشست باطل',
    {
      status: 200,
      body: '<!DOCTYPE html><html><body>login</body></html>',
      url: 'https://www.instagram.com/accounts/login/?next=/api/v1/feed/',
      redirected: true
    },
    'auth'
  )
  await expectError(
    'HTML بدون ریدایرکت = خطای قابل تلاش دوباره، نه نشست باطل',
    { status: 200, body: '<!DOCTYPE html><html><body>something else</body></html>' },
    'plain'
  )
  await expectError(
    'کلمه‌ی spam داخل HTML نباید خطای اسپم بدهد',
    {
      status: 200,
      body: '<!DOCTYPE html><html><body>report spam feedback_required</body></html>'
    },
    'plain'
  )
  await expectError('۵۰۰ خطای معمولی است', { status: 500, body: 'server error' }, 'plain')

  console.log('\n=== 4. تأیید نشست ===')
  nextResponse = {
    status: 200,
    body: JSON.stringify({
      user: {
        pk: 12345,
        username: 'ashkan_test',
        full_name: 'Ashkan',
        follower_count: 1200,
        following_count: 300,
        media_count: 42
      }
    })
  }
  const profile = await engine.verifyAndGetProfile(SESSION)
  check('نام کاربری برگشت', profile.username === 'ashkan_test')
  check('تعداد فالوور برگشت', profile.followers_count === 1200)
  check('شناسه برگشت', profile.ig_user_id === '12345')

  nextResponse = { status: 200, body: JSON.stringify({ user: {} }) }
  try {
    await engine.verifyAndGetProfile(SESSION)
    check('پاسخ بدون username رد می‌شود', false)
  } catch (e) {
    check('پاسخ بدون username رد می‌شود', e instanceof AuthError)
  }

  console.log('\n=== 5. صفحه‌بندی فالوورها ===')
  responseQueue.length = 0
  responseQueue.push({
    status: 200,
    body: JSON.stringify({
      users: [
        { pk: 'u1', username: 'ali', is_private: false },
        { pk: 'u2', username: 'sara', is_private: true }
      ],
      next_max_id: 'CURSOR_2'
    })
  })
  responseQueue.push({
    status: 200,
    body: JSON.stringify({ users: [{ pk: 'u3', username: 'reza' }] })
  })
  captured = []
  const followers = await engine.listFollowers(1, 100)
  check('هر دو صفحه جمع شد', followers.length === 3, followers.length)
  check('ترتیب حفظ شد', followers[0].username === 'ali' && followers[2].username === 'reza')
  check('is_private خوانده شد', followers[1].is_private === true)
  check('cursor صفحه‌ی دوم فرستاده شد', captured[1].url.includes('max_id=CURSOR_2'), captured[1].url)
  check('بدون next_max_id متوقف شد', captured.length === 2, captured.length)

  console.log('\n=== 6. سقف تعداد ===')
  responseQueue.length = 0
  responseQueue.push({
    status: 200,
    body: JSON.stringify({
      users: [{ pk: 'a' }, { pk: 'b' }, { pk: 'c' }, { pk: 'd' }],
      next_max_id: 'MORE'
    })
  })
  const limited = await engine.listFollowers(1, 2)
  check('limit رعایت شد', limited.length === 2, limited.length)

  console.log('\n=== 7. صفحه‌بندی نیمه‌کاره ===')
  responseQueue.length = 0
  responseQueue.push({
    status: 200,
    body: JSON.stringify({ users: [{ pk: 'x1' }, { pk: 'x2' }], next_max_id: 'C2' })
  })
  responseQueue.push({ status: 429, body: '{}' })
  const partial = await engine.listFollowers(1, 100)
  check(
    'وقتی وسط کار محدود شدیم، نتیجه‌ی جزئی برمی‌گردد نه خطا',
    partial.length === 2,
    partial.length
  )

  console.log('\n=== 7-ب. زنجیره‌ی دریافت پست‌ها ===')
  // سناریوی واقعی کاربر: میزبان وب HTML می‌دهد ولی web_profile_info سالم است
  responseQueue.length = 0
  // فراخوانی اول: گرفتن نام کاربری (getProfile)
  responseQueue.push({
    status: 200,
    body: JSON.stringify({ user: { pk: 12345, username: 'ashkan_test' } })
  })
  responseQueue.push({
    status: 200,
    body: JSON.stringify({
      data: {
        user: {
          edge_owner_to_timeline_media: {
            edges: [
              {
                node: {
                  id: 'g1',
                  shortcode: 'ABC',
                  is_video: true,
                  product_type: 'clips',
                  taken_at_timestamp: 1700000000,
                  edge_media_to_caption: { edges: [{ node: { text: 'کپشن ریلز' } }] },
                  edge_liked_by: { count: 42 },
                  edge_media_to_comment: { count: 7 },
                  thumbnail_src: 'https://img/g1.jpg'
                }
              }
            ]
          }
        }
      }
    })
  })
  captured = []
  const chained = await engine.listMedia(1, 10)
  check('web_profile_info پست‌ها را می‌دهد', chained.length === 1, chained.length)
  check('ریلز از نود گراف تشخیص داده شد', chained[0].media_type === 'REELS', chained[0].media_type)
  check('کپشن از edge_media_to_caption', chained[0].caption === 'کپشن ریلز')
  check('لایک از edge_liked_by', chained[0].like_count === 42)
  check('کامنت از edge_media_to_comment', chained[0].comments_count === 7)
  check('لینک از shortcode', chained[0].permalink === 'https://www.instagram.com/p/ABC/')
  check('آدرس web_profile_info صدا زده شد', captured.some((c) => c.url.includes('web_profile_info')))

  console.log('\n=== 7-ج. سقوط به میزبان موبایل ===')
  responseQueue.length = 0
  responseQueue.push({ status: 200, body: JSON.stringify({ data: { user: {} } }) })
  responseQueue.push({
    status: 200,
    body: JSON.stringify({ items: [{ pk: 'm9', media_type: 1, taken_at: 1700000500 }] })
  })
  captured = []
  const viaMobile = await engine.listMedia(1, 10)
  check('وقتی web_profile_info خالی است، میزبان موبایل امتحان می‌شود', viaMobile.length === 1, viaMobile.length)
  check(
    'آدرس i.instagram استفاده شد',
    captured.some((c) => c.url.includes('i.instagram.com')),
    captured.map((c) => c.url)
  )

  console.log('\n=== 7-د. خطاها در زنجیره ===')
  responseQueue.length = 0
  nextResponse = { status: 200, body: '<!DOCTYPE html><html></html>' }
  try {
    await engine.listMedia(1, 10)
    check('خطای جامع پرتاب می‌شود', false)
  } catch (e) {
    const msg = (e as Error).message
    check('خطا همه‌ی تلاش‌ها را فهرست می‌کند', msg.includes('•'), msg.slice(0, 70))
  }

  responseQueue.length = 0
  nextResponse = { status: 401, body: '{}' }
  try {
    await engine.listMedia(1, 10)
    check('نشست باطل فورا پرتاب می‌شود نه بعد از امتحان همه', false)
  } catch (e) {
    check('نشست باطل فورا پرتاب می‌شود نه بعد از امتحان همه', e instanceof AuthError, (e as Error).name)
  }

  responseQueue.length = 0
  nextResponse = { status: 429, body: '{}' }
  try {
    await engine.listMedia(1, 10)
    check('محدودیت نرخ در زنجیره بلعیده نمی‌شود', false)
  } catch (e) {
    check('محدودیت نرخ در زنجیره بلعیده نمی‌شود', e instanceof RateLimitError, (e as Error).name)
  }

  console.log('\n=== 8. ارسال دایرکت ===')
  captured = []
  responseQueue.length = 0
  nextResponse = { status: 200, body: '{"status":"ok"}' }
  await engine.sendDm(1, '999', 'سلام رفیق')
  check('متد POST است', captured[0].method === 'POST')
  check('اندپوینت درست است', captured[0].url.includes('/direct_v2/threads/broadcast/text/'))
  const form = new URLSearchParams(captured[0].body ?? '')
  check('گیرنده در قالب آرایه', form.get('recipient_users') === '[[999]]', form.get('recipient_users'))
  check('متن فرستاده شد', form.get('text') === 'سلام رفیق')
  check('action درست است', form.get('action') === 'send_item')
  check('client_context یکتا دارد', (form.get('client_context') ?? '').length > 10)
  check('Content-Type فرم است', captured[0].headers['Content-Type'] === 'application/x-www-form-urlencoded')

  console.log('\n=== 9. پاسخ به کامنت ===')
  captured = []
  await engine.replyToCommentPublic(1, 'MEDIA7:COMMENT9', 'ممنون')
  check('شناسه‌ی پست از ref استخراج شد', captured[0].url.includes('/comments/MEDIA7/add/'), captured[0].url)
  const cform = new URLSearchParams(captured[0].body ?? '')
  check('متن کامنت درست است', cform.get('comment_text') === 'ممنون')
  check('شناسه‌ی کامنت والد ست شد', cform.get('replied_to_comment_id') === 'COMMENT9')

  try {
    await engine.replyToCommentPublic(1, 'ONLY_COMMENT', 'x')
    check('بدون شناسه‌ی پست خطای واضح می‌دهد', false)
  } catch (e) {
    check(
      'بدون شناسه‌ی پست خطای واضح می‌دهد',
      (e as Error).message.includes('شناسه‌ی پست'),
      (e as Error).message.slice(0, 50)
    )
  }

  console.log('\n=== 10. پارس کردن پست‌ها ===')
  nextResponse = {
    status: 200,
    body: JSON.stringify({
      items: [
        {
          pk: 'm1',
          code: 'ABC',
          media_type: 2,
          product_type: 'clips',
          caption: { text: 'کپشن ریلز' },
          like_count: 10,
          comment_count: 3,
          taken_at: 1700000000,
          image_versions2: { candidates: [{ url: 'https://img/1.jpg' }] }
        },
        { pk: 'm2', media_type: 1, taken_at: 1700000100 }
      ]
    })
  }
  const media = await engine.listMedia(1, 10)
  check('ریلز تشخیص داده شد', media[0].media_type === 'REELS', media[0].media_type)
  check('عکس تشخیص داده شد', media[1].media_type === 'IMAGE')
  check('کپشن خوانده شد', media[0].caption === 'کپشن ریلز')
  check('لینک ساخته شد', media[0].permalink === 'https://www.instagram.com/p/ABC/')
  check('زمان به میلی‌ثانیه تبدیل شد', media[0].timestamp === 1700000000000)
  check('تصویر بندانگشتی', media[0].thumbnail_url === 'https://img/1.jpg')

  console.log('\n=== 11. پارس کردن کامنت‌ها ===')
  nextResponse = {
    status: 200,
    body: JSON.stringify({
      comments: [
        { pk: 'c1', text: '۱', user: { pk: 'u9', username: 'ali' }, created_at: 1700000200 }
      ]
    })
  }
  const comments = await engine.listComments(1, 'm1')
  check('متن کامنت', comments[0].text === '۱')
  check('فرستنده', comments[0].from_user_id === 'u9' && comments[0].from_username === 'ali')
  check('شناسه‌ی پست همراهش است', comments[0].media_id === 'm1')

  console.log('\n=== 12. نشست خراب ===')
  const broken = new WebEngine({
    load: () => '{ not json',
    save: () => undefined,
    clear: () => undefined
  })
  try {
    await broken.listMedia(5, 1)
    check('نشست خراب خطای واضح می‌دهد', false)
  } catch (e) {
    check('نشست خراب خطای واضح می‌دهد', e instanceof AuthError)
  }

  const noSessionId = new WebEngine({
    load: () => JSON.stringify({ cookies: { ds_user_id: '1' }, userAgent: 'x' }),
    save: () => undefined,
    clear: () => undefined
  })
  try {
    await noSessionId.listMedia(6, 1)
    check('نشست بدون sessionid رد می‌شود', false)
  } catch (e) {
    check('نشست بدون sessionid رد می‌شود', e instanceof AuthError)
  }
}

run()
  .then(() => {
    globalThis.fetch = realFetch
    closeDb()
    cleanup()
    console.log('\n' + '='.repeat(46))
    console.log('  موفق: ' + pass + '   ناموفق: ' + fail)
    console.log('='.repeat(46) + '\n')
    process.exit(fail > 0 ? 1 : 0)
  })
  .catch((e) => {
    console.error('تست کرش کرد:', e)
    closeDb()
    cleanup()
    process.exit(1)
  })
