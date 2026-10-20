import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { daysLeft, isActive, requireUser } from '@/lib/auth'
import { logoutAction } from '@/lib/actions-auth'
import { db, type RuleRow } from '@/lib/db'
import { env, igReady, redirectUri } from '@/lib/env'
import { PLANS, faNum, toman } from '@/lib/plans'
import { addRule, deleteMyAccount, deleteRule, disconnectAccount, toggleRule } from './actions'

export const metadata: Metadata = { title: 'پنل من' }
export const dynamic = 'force-dynamic'

const FLASH: Record<string, [string, 'ok' | 'bad']> = {
  'ig=ok': ['پیج وصل شد. حالا یک جواب خودکار بسازید.', 'ok'],
  'ig=denied': ['اتصال لغو شد؛ در صفحه‌ی اینستاگرام «اجازه» زده نشد.', 'bad'],
  'ig=error': ['اینستاگرام اتصال را نپذیرفت. پیج باید حرفه‌ای (Business یا Creator) باشد؛ دوباره امتحان کنید.', 'bad'],
  'ig=expired': ['زمان اتصال تمام شد؛ دوباره «اتصال پیج» را بزنید.', 'bad'],
  'ig=setup': ['اتصال اینستاگرام هنوز روی سرور تنظیم نشده. با پشتیبانی تماس بگیرید.', 'bad'],
  'pay=ok': ['پرداخت موفق بود و اشتراک تمدید شد.', 'ok'],
  'pay=cancelled': ['پرداخت لغو شد. مبلغی کم نشده؛ اگر کم شده باشد تا ۷۲ ساعت برمی‌گردد.', 'bad'],
  'pay=failed': ['بانک پرداخت را تأیید نکرد. اگر مبلغ کم شده، تا ۷۲ ساعت برمی‌گردد.', 'bad'],
  'pay=gateway': ['درگاه پرداخت در دسترس نیست؛ چند دقیقه بعد امتحان کنید.', 'bad'],
  'rule=added': ['جواب خودکار ذخیره شد و از همین حالا فعال است.', 'ok'],
  'rule=invalid': ['جواب خودکار ذخیره نشد: پیج و متن پیام لازم است.', 'bad'],
  'del=confirm': ['برای حذف حساب، نام کاربری‌تان را دقیق بنویسید.', 'bad']
}

const TRIGGER_LABEL: Record<RuleRow['trigger'], string> = {
  comment: 'کامنت زیر پست',
  dm: 'پیام در دایرکت',
  story: 'جواب یا منشن استوری'
}

const faDate = (d: Date) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium' }).format(d)
const faTime = (d: Date) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(d)

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const flash = Object.entries(sp)
    .map(([k, v]) => FLASH[k + '=' + v])
    .find(Boolean)

  const sql = await db()
  const [accounts, rules, events] = await Promise.all([
    sql<{ id: string; username: string; token_expires_at: Date | null; webhook_ok: boolean }[]>`
      select id, username, token_expires_at, webhook_ok from dx_ig_accounts where user_id = ${user.id} order by id`,
    sql<(RuleRow & { username: string })[]>`
      select r.*, a.username from dx_rules r join dx_ig_accounts a on a.id = r.ig_account_id
      where r.user_id = ${user.id} order by r.id desc`,
    sql<{ id: string; kind: string; ok: boolean; detail: string; created_at: Date }[]>`
      select id, kind, ok, detail, created_at from dx_events where user_id = ${user.id} order by id desc limit 30`
  ])

  const active = isActive(user)
  const left = daysLeft(user)

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3 text-[13px]">
            {user.is_admin && <Link href="/admin" className="text-mist hover:text-haze">مدیریت</Link>}
            <span dir="ltr" className="text-mist">{user.username}</span>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm">خروج</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        {flash && (
          <p
            role="status"
            className={
              'rounded-2xl px-4 py-3 text-[14px] leading-7 ' +
              (flash[1] === 'ok' ? 'border border-emerald-400/25 bg-emerald-400/10' : 'border border-magenta/30 bg-magenta/10')
            }
          >
            {flash[0]}
          </p>
        )}

        {/* اشتراک */}
        <section className="card relative overflow-hidden p-6">
          {active && <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand opacity-25 blur-3xl" aria-hidden />}
          <p className="text-[13px] text-mist">اشتراک</p>
          {active ? (
            <>
              <p className="mt-2 text-[44px] font-bold leading-none">
                {faNum(left)} <span className="text-[18px] font-normal text-mist">روز مانده</span>
              </p>
              <p className="mt-3 text-[14px] text-mist">تا {faDate(new Date(user.sub_until!))}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-brand" style={{ width: Math.min(100, (left / 90) * 100) + '%' }} />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[24px] font-bold">اشتراک فعال نیست</p>
              <p className="mt-2 text-[14px] leading-7 text-mist">
                تا وقتی اشتراک فعال نباشد، جواب‌های خودکار ارسال نمی‌شوند. قانون‌ها و پیج‌ها سر جایشان می‌مانند.
              </p>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {PLANS.filter((p) => p.enabled).map((p) => (
              <Link key={p.id} href={'/checkout/' + p.id} className={'btn btn-sm ' + (p.id === 'm3' ? 'btn-brand' : 'btn-ghost')}>
                {active ? 'تمدید' : 'خرید'} {p.title} — {toman(p.price!)}
              </Link>
            ))}
          </div>
        </section>

        {/* پیج‌ها */}
        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">پیج‌های اینستاگرام</h2>
            <a href="/api/instagram/connect" className="btn btn-brand btn-sm">+ اتصال پیج</a>
          </div>
          {!igReady() && (
            <p className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-[13px] leading-6 text-mist">
              مدیر سایت: IG_APP_ID و IG_APP_SECRET را تنظیم کنید و این آدرس را در متا به‌عنوان Redirect URI بگذارید:{' '}
              <code dir="ltr" className="text-haze">{redirectUri()}</code>
            </p>
          )}
          {accounts.length === 0 ? (
            <p className="mt-4 text-[14px] leading-7 text-mist">
              هنوز پیجی وصل نیست. «اتصال پیج» صفحه‌ی رسمی اینستاگرام را باز می‌کند؛ آنجا وارد شوید و «اجازه» بدهید.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p dir="ltr" className="text-right font-bold">@{a.username}</p>
                    <p className="mt-0.5 text-[12px] text-dim">
                      {a.webhook_ok ? 'دریافت رویدادها فعال' : 'دریافت رویدادها ثبت نشد — یک بار دوباره وصل کنید'}
                      {a.token_expires_at && '، اعتبار اتصال تا ' + faDate(new Date(a.token_expires_at))}
                    </p>
                  </div>
                  <form action={disconnectAccount}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-[13px] text-dim hover:text-magenta">قطع اتصال</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* قانون‌ها */}
        <section id="rules" className="card scroll-mt-20 p-6">
          <h2 className="text-[18px] font-bold">جواب‌های خودکار</h2>
          {rules.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {rules.map((r) => (
                <li key={r.id} className={'rounded-2xl border border-white/[0.06] bg-ink/50 p-4 ' + (r.enabled ? '' : 'opacity-55')}>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-mist">
                    <span className="chip bg-white/[0.06]">{TRIGGER_LABEL[r.trigger]}</span>
                    <span dir="ltr">@{r.username}</span>
                    <span>{faNum(r.hits)} بار اجرا شده</span>
                  </div>
                  <p className="mt-2.5 text-[14px] leading-7">
                    <span className="text-mist">اگر نوشت </span>
                    <b>{r.keywords.trim() || 'هر چیزی'}</b>
                    <span className="text-mist"> ← </span>
                    {r.reply}
                  </p>
                  {r.button_title && <p className="mt-1 text-[12px] text-dim">دکمه: {r.button_title}</p>}
                  <div className="mt-3 flex gap-4 text-[13px]">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-mist hover:text-haze">{r.enabled ? 'خاموش کن' : 'روشن کن'}</button>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-dim hover:text-magenta">حذف</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {accounts.length === 0 ? (
            <p className="mt-4 text-[14px] text-mist">اول یک پیج وصل کنید.</p>
          ) : (
            <form action={addRule} className="mt-6 space-y-4 border-t border-white/[0.06] pt-6">
              <p className="text-[15px] font-bold">جواب تازه</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="trigger">وقتی کسی…</label>
                  <select id="trigger" name="trigger" className="input">
                    <option value="comment">زیر پست کامنت گذاشت</option>
                    <option value="dm">در دایرکت پیام داد</option>
                    <option value="story">به استوری جواب داد یا منشن کرد</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="account">پیج</label>
                  <select id="account" name="account" className="input" dir="ltr">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>@{a.username}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="keywords">و نوشت (با ویرگول جدا کنید؛ خالی = هر چیزی)</label>
                <input id="keywords" name="keywords" className="input" placeholder="۱، قیمت، لینک" />
              </div>
              <div>
                <label className="label" htmlFor="reply">این پیام به دایرکتش برود</label>
                <textarea id="reply" name="reply" rows={3} required maxLength={1000} className="input" placeholder="سلام {username} 👋 لینک خرید اینجاست…" />
                <p className="mt-1.5 text-[12px] text-dim">{'{username}'} با آیدی طرف عوض می‌شود.</p>
              </div>
              <details className="rounded-2xl bg-ink/40 p-4">
                <summary className="cursor-pointer text-[14px] text-mist">دکمه‌ی لینک و جواب زیر کامنت (اختیاری)</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="button_title">متن دکمه</label>
                    <input id="button_title" name="button_title" maxLength={20} className="input" placeholder="دیدن محصول" />
                  </div>
                  <div>
                    <label className="label" htmlFor="button_url">لینک دکمه</label>
                    <input id="button_url" name="button_url" dir="ltr" className="input text-left" placeholder="https://" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="public_reply">جواب عمومی زیر کامنت (فقط برای کامنت)</label>
                    <input id="public_reply" name="public_reply" maxLength={300} className="input" placeholder="دایرکتت رو چک کن 💌" />
                  </div>
                </div>
              </details>
              <button className="btn btn-brand w-full sm:w-auto">ذخیره و فعال‌سازی</button>
            </form>
          )}
        </section>

        {/* گزارش */}
        <section className="card p-6">
          <h2 className="text-[18px] font-bold">آخرین کارها</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-[14px] leading-7 text-mist">هنوز پیامی نرفته. هر دایرکتی که دایرکتینو بفرستد اینجا ثبت می‌شود.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-[13px] leading-6">
                  <span className={'mt-2 h-1.5 w-1.5 shrink-0 rounded-full ' + (e.ok ? 'bg-emerald-400' : 'bg-magenta')} />
                  <span className="flex-1 text-mist">{e.detail}</span>
                  <span className="shrink-0 text-dim">{faTime(new Date(e.created_at))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* نصب */}
        <section className="card p-6">
          <h2 className="text-[18px] font-bold">روی گوشی و ویندوز</h2>
          <p className="mt-3 text-[14px] leading-7 text-mist">
            <b className="text-haze">گوشی:</b> همین صفحه را در کروم (اندروید) یا سافاری (آیفون) باز کنید، منوی اشتراک‌گذاری یا سه‌نقطه
            ← «افزودن به صفحه‌ی اصلی».
          </p>
          <p className="mt-3 text-[14px] leading-7 text-mist">
            <b className="text-haze">ویندوز:</b> صندوق دایرکت، پیام گروهی و جواب هوشمند. با همین نام کاربری وارد شوید.
          </p>
          {active && env.desktopUrl ? (
            <a href={env.desktopUrl} className="btn btn-ghost mt-4">دانلود نسخه‌ی ویندوز</a>
          ) : (
            <p className="mt-4 text-[13px] text-dim">{active ? 'لینک دانلود به‌زودی همین‌جا قرار می‌گیرد.' : 'لینک دانلود بعد از خرید اشتراک نمایش داده می‌شود.'}</p>
          )}
        </section>

        <details id="danger" className="px-2 pt-4 text-[13px] text-dim">
          <summary className="cursor-pointer">حذف حساب و همه‌ی اطلاعات</summary>
          <form action={deleteMyAccount} className="mt-3 flex flex-wrap gap-2">
            <input name="confirm" dir="ltr" className="input h-10 max-w-[220px]" placeholder={user.username} aria-label="نام کاربری برای تأیید" />
            <button className="btn btn-sm border border-magenta/40 text-magenta">حذف همیشگی</button>
          </form>
        </details>
      </main>
    </div>
  )
}
