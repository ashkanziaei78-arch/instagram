import { useState } from 'react'
import type { AccountLinks, AccountWithLinks, LinkMethod } from '../../shared/types'
import { Modal, Notice } from './ui'

/**
 * مرکز اتصال — یک پنجره که هر سه راه را کنار هم نشان می‌دهد.
 *
 * چرا یکی به‌جای سه دکمه‌ی پراکنده: سه دکمه یعنی کاربر باید *خودش* بفهمد کدام
 * را لازم دارد، و معمولا یکی را می‌زند و بقیه را نادیده می‌گیرد. نتیجه: نیمی از
 * قابلیت‌ها بی‌صدا کار نمی‌کنند و کاربر فکر می‌کند اپ خراب است. اینجا هر سه با
 * وضعیت زنده دیده می‌شوند و دقیقا نوشته شده هرکدام *چه چیزی* را روشن می‌کند.
 */

export interface MethodSpec {
  id: LinkMethod
  title: string
  badge: string
  /** یک جمله: این روش چه کاری را ممکن می‌کند */
  unlocks: string
  /** هزینه‌اش چیست */
  cost: string
  action: string
}

export const METHODS: MethodSpec[] = [
  {
    id: 'simple',
    title: 'ورود ساده',
    badge: 'یک کلیک',
    unlocks: 'لیست فالوورها، تشخیص فالوور جدید، دایرکت به کسی که به شما پیام نداده',
    cost: 'رسمی نیست — ریسک محدود شدن حساب',
    action: 'ورود در پنجره‌ی اینستاگرام'
  },
  {
    id: 'sessionid',
    title: 'کد نشست',
    badge: 'پشتیبان',
    unlocks: 'همان کارهای ورود ساده — ولی وقتی پنجره‌ی ورود باز نمی‌شود',
    cost: 'باید یک مقدار را از مرورگر کپی کنید',
    action: 'چسباندن sessionid'
  },
  {
    id: 'official',
    title: 'API رسمی',
    badge: 'بی‌ریسک',
    unlocks: 'پاسخ خصوصی به کامنت، آمار ویو و ریچ و سیو، واکنش لحظه‌ای',
    cost: 'یک‌بار ساخت اپ متا (~۱۰ دقیقه) + حساب بیزنسی',
    action: 'اتصال از مرورگر'
  }
]

const DONE = 'وصل است'

export function LinkChips({ links }: { links: AccountLinks }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METHODS.map((m) => (
        <span
          key={m.id}
          title={links[m.id] ? m.title + ': ' + DONE : m.title + ': وصل نیست — ' + m.unlocks}
          className={
            'rounded px-1.5 py-0.5 text-[10px] font-medium ' +
            (links[m.id]
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-white/[0.05] text-slate-500 line-through decoration-slate-600')
          }
        >
          {links[m.id] ? '✓ ' : ''}
          {m.title}
        </span>
      ))}
    </div>
  )
}

/**
 * مثال عینی.
 *
 * چرا این در UI است و نه فقط در مستندات: کاربری که «کامنت به دایرکت» را
 * انتخاب می‌کند لزوما نمی‌داند که هر مرحله‌اش با موتور متفاوتی انجام می‌شود.
 * این مثال همان یک سناریو را می‌گیرد و نشان می‌دهد کدام مرحله بدون کدام اتصال
 * از کار می‌افتد.
 */
export function WorkedExample({ links }: { links: AccountLinks }): JSX.Element {
  const web = links.simple || links.sessionid

  /**
   * `needs` می‌گوید چه چیزی این مرحله را ممکن می‌کند — و همان متن به کاربر
   * نشان داده می‌شود. پس شرطِ ok و متنِ راهنما نمی‌توانند از هم جدا بیفتند.
   */
  const NEEDS = {
    none: { ok: true, label: '' },
    either: { ok: web || links.official, label: 'هر کدام از سه روش' },
    web: { ok: web, label: 'ورود ساده یا کد نشست' },
    official: { ok: links.official, label: 'API رسمی' }
  } as const

  const steps: { text: string; needs: keyof typeof NEEDS }[] = [
    { text: 'پست می‌گذارید و می‌نویسید: «عدد ۱ رو کامنت کن تا لینک رو برات بفرستم»', needs: 'none' },
    { text: 'کسی زیر پست «۱» کامنت می‌کند', needs: 'none' },
    { text: 'اپ کامنت را می‌بیند', needs: 'either' },
    { text: 'برایش دایرکت می‌فرستد', needs: 'either' },
    { text: 'زیر کامنتش هم جواب عمومی می‌گذارد', needs: 'either' },
    { text: 'بعداً می‌بینید آن پست چند ویو و چند سیو خورده', needs: 'official' },
    { text: 'همان شخص اگر فالو کند، پیام خوشامد می‌گیرد', needs: 'web' }
  ]

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3.5">
      <p className="mb-2.5 text-xs font-semibold text-slate-200">
        یک مثال واقعی — با اتصال‌های فعلی شما
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const need = NEEDS[s.needs]
          return (
            <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span
                className={
                  'mt-px shrink-0 font-bold ' + (need.ok ? 'text-emerald-400' : 'text-rose-400')
                }
              >
                {need.ok ? '✓' : '✕'}
              </span>
              <span className={need.ok ? 'text-slate-300' : 'text-slate-500'}>
                {s.text}
                {!need.ok && (
                  <span className="text-rose-300"> — برای این، {need.label} لازم است</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function ConnectHub({
  accounts,
  busy,
  onClose,
  onPick
}: {
  accounts: AccountWithLinks[]
  /** کدام روش همین حالا در حال اجراست */
  busy: LinkMethod | null
  onClose: () => void
  onPick: (m: LinkMethod) => void
}): JSX.Element {
  // وقتی چند حساب داریم، وضعیت را برای حسابی نشان می‌دهیم که کاربر انتخاب کرده
  const [focusId, setFocusId] = useState<number | null>(accounts[0]?.id ?? null)
  const focus = accounts.find((a) => a.id === focusId) ?? accounts[0] ?? null

  const links: AccountLinks = focus?.links ?? {
    simple: false,
    sessionid: false,
    official: false
  }
  const missing = METHODS.filter((m) => !links[m.id])

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="اتصال حساب"
      subtitle="هر سه روش را وصل کنید تا هیچ قابلیتی خاموش نماند"
      footer={
        <button className="btn-ghost" onClick={onClose}>
          بستن
        </button>
      }
    >
      <div className="space-y-4">
        {accounts.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">حساب:</span>
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setFocusId(a.id)}
                className={
                  'rounded-full px-2.5 py-1 text-[11px] transition-colors ' +
                  (a.id === focus?.id
                    ? 'bg-fuchsia-500/20 text-fuchsia-200'
                    : 'bg-white/[0.05] text-slate-400 hover:text-slate-200')
                }
              >
                @{a.username}
              </button>
            ))}
          </div>
        )}

        {focus ? (
          missing.length === 0 ? (
            <Notice tone="success" title="هر سه روش وصل است">
              @{focus.username} کامل وصل است. همه‌ی قابلیت‌ها در دسترس‌اند و اگر یکی از
              نشست‌ها باطل شود، اپ خودش سراغ دیگری می‌رود.
            </Notice>
          ) : (
            <Notice tone="warn" title={missing.length + ' روش هنوز وصل نشده'}>
              @{focus.username} کار می‌کند، ولی بخشی از قابلیت‌ها خاموش است. پایین دقیقا
              نوشته کدام.
            </Notice>
          )
        ) : (
          <Notice tone="info" title="هنوز حسابی وصل نیست">
            از «ورود ساده» شروع کنید — سریع‌ترین راه و هیچ تنظیمی نمی‌خواهد. بعد بقیه را
            اضافه کنید.
          </Notice>
        )}

        <div className="grid gap-2.5">
          {METHODS.map((m) => {
            const done = links[m.id]
            return (
              <div
                key={m.id}
                className={
                  'flex flex-wrap items-center gap-3 rounded-lg border p-3.5 ' +
                  (done
                    ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                    : 'border-white/[0.08] bg-white/[0.02]')
                }
              >
                <span
                  className={
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ' +
                    (done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-slate-500')
                  }
                >
                  {done ? '✓' : '+'}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-100">{m.title}</p>
                    <span className={done ? 'chip-ok' : 'chip-info'}>{done ? DONE : m.badge}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    <span className="text-slate-300">روشن می‌کند:</span> {m.unlocks}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    <span className="text-slate-400">هزینه‌اش:</span> {m.cost}
                  </p>
                </div>

                <button
                  className={done ? 'btn-ghost btn-sm shrink-0' : 'btn-primary btn-sm shrink-0'}
                  disabled={busy !== null}
                  onClick={() => onPick(m.id)}
                >
                  {busy === m.id ? 'در حال اتصال…' : done ? 'اتصال دوباره' : m.action}
                </button>
              </div>
            )
          })}
        </div>

        <WorkedExample links={links} />

        <Notice tone="info" title="چرا هر سه؟">
          هیچ‌کدام جای دیگری را نمی‌گیرد. API رسمی لیست فالوورها را{' '}
          <strong>اصلا ندارد</strong> (اندپوینتش وجود ندارد، نه اینکه اپ پیاده‌سازی نکرده)،
          و روش‌های ساده آمار ویو و ریچ نمی‌دهند. وصل‌کردن هر سه یعنی اپ برای هر کار
          بهترین مسیر را دارد — و اگر یکی از کار افتاد، بقیه ادامه می‌دهند.
        </Notice>
      </div>
    </Modal>
  )
}
