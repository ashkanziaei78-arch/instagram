import { useEffect, useState } from 'react'
import type { AccountRow } from '../../shared/types'
import { BrowserOAuthWizard } from '../components/BrowserOAuthWizard'
import { Card, EmptyState, Field, Modal, Notice } from '../components/ui'
import { call, callRaw, fmtDate, fmtFull, toasts } from '../lib/api'

export function AccountsPage({
  accounts,
  onChanged
}: {
  accounts: AccountRow[]
  onChanged: () => void
}): JSX.Element {
  const [connecting, setConnecting] = useState(false)
  const [webBusy, setWebBusy] = useState(false)
  const [sessionModal, setSessionModal] = useState(false)
  const [sidModal, setSidModal] = useState(false)
  const [oauthWizard, setOauthWizard] = useState(false)
  const [sessionAvailable, setSessionAvailable] = useState({ enabled: false, libraryAvailable: false })

  /**
   * ورود ساده. هیچ تنظیم قبلی لازم نیست — پنجره‌ی خود اینستاگرام باز می‌شود.
   * کاربر آنجا وارد می‌شود و ما فقط کوکی نشست را برمی‌داریم.
   */
  const connectWeb = async (): Promise<void> => {
    setWebBusy(true)
    const res = await callRaw('webLogin')
    setWebBusy(false)
    if (res.ok) {
      toasts.push('success', 'حساب با موفقیت وصل شد')
      onChanged()
    } else {
      toasts.push('error', res.error ?? 'اتصال ناموفق بود', res.hint)
    }
  }

  useEffect(() => {
    void (async () => {
      const s = await call('getSessionEngineEnabled')
      if (s) setSessionAvailable(s)
    })()
  }, [sessionModal])

  const connectGraph = async (): Promise<void> => {
    setConnecting(true)
    const res = await callRaw('connectGraphAccount')
    setConnecting(false)
    if (res.ok) {
      toasts.push('success', 'حساب با موفقیت وصل شد')
      onChanged()
    } else {
      toasts.push('error', res.error ?? 'اتصال ناموفق بود', res.hint)
    }
  }

  const refresh = async (a: AccountRow): Promise<void> => {
    const r = await call('refreshAccount', { accountId: a.id })
    if (r) {
      toasts.push('success', 'اطلاعات @' + a.username + ' به‌روز شد')
      onChanged()
    }
  }

  const remove = async (a: AccountRow): Promise<void> => {
    if (!confirm('حساب @' + a.username + ' و همه‌ی قوانین و داده‌هایش حذف شود؟')) return
    await call('removeAccount', { accountId: a.id })
    toasts.push('info', 'حساب حذف شد')
    onChanged()
  }

  return (
    <div className="space-y-5">
      <Card
        title="حساب‌های وصل‌شده"
        subtitle="می‌توانید چند حساب داشته باشید؛ قوانین و آمار هر حساب جداست"
        action={
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={webBusy} onClick={() => void connectWeb()}>
              {webBusy ? 'در انتظار ورود…' : '+ ورود ساده با اینستاگرام'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setSidModal(true)}>
              + اتصال با کد نشست
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setOauthWizard(true)}>
              + API رسمی
            </button>
          </div>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            icon="◎"
            title="هیچ حسابی وصل نیست"
            body="ساده‌ترین راه: دکمه‌ی «ورود ساده با اینستاگرام». پنجره‌ی خود اینستاگرام باز می‌شود، وارد می‌شوید، تمام. هیچ تنظیم دیگری لازم نیست."
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const expiringSoon =
                a.token_expires_at && a.token_expires_at - Date.now() < 10 * 86400000
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-white/[0.07] p-3.5"
                >
                  {a.profile_picture_url ? (
                    <img
                      src={a.profile_picture_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-sm text-slate-400">
                      @
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-100">@{a.username}</p>
                      <span className={a.engine === 'graph' ? 'chip-ok' : 'chip-warn'}>
                        {a.engine === 'graph' ? 'API رسمی' : 'موتور Session'}
                      </span>
                      {a.status !== 'active' && <span className="chip-err">{a.status}</span>}
                      {expiringSoon && <span className="chip-warn">توکن نزدیک انقضا</span>}
                    </div>
                    <p className="tabular mt-1 text-xs text-slate-500">
                      {fmtFull(a.followers_count)} فالوور · {fmtFull(a.media_count)} پست
                      {a.token_expires_at && ' · توکن تا ' + fmtDate(a.token_expires_at)}
                    </p>
                    {a.last_error && (
                      <p className="mt-1 text-[11px] leading-relaxed text-rose-300">{a.last_error}</p>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button className="btn-ghost btn-sm" onClick={() => void refresh(a)}>
                      به‌روزرسانی
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => void remove(a)}>
                      حذف
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card title="کدام روش اتصال؟" subtitle="می‌توانید هر دو را هم‌زمان وصل کنید — اپ برای هر کار بهترین را انتخاب می‌کند">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold text-fuchsia-200">ورود ساده با اینستاگرام</p>
              <span className="chip-info">ساده‌ترین</span>
            </div>
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-300">
              <li>✓ هیچ تنظیمی لازم نیست — فقط یک کلیک</li>
              <li>✓ رمز شما وارد این اپ نمی‌شود</li>
              <li>✓ دو مرحله‌ای را خود اینستاگرام مدیریت می‌کند</li>
              <li>✓ لیست فالوور، فالوور جدید و دایرکت انبوه</li>
              <li>✓ حساب لازم نیست بیزنسی باشد</li>
              <li>✕ رسمی نیست — ریسک محدود شدن حساب دارد</li>
              <li>✕ آمار ریچ و سیو نمی‌دهد</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              پنجره‌ی خود اینستاگرام باز می‌شود، دقیقاً مثل ورود در مرورگر.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold text-emerald-200">API رسمی</p>
              <span className="chip-ok">بی‌ریسک</span>
            </div>
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-300">
              <li>✓ هیچ ریسکی برای حساب ندارد</li>
              <li>✓ پاسخ خصوصی به کامنت (بهترین حالت کامنت‌به‌دایرکت)</li>
              <li>✓ آمار دقیق: ویو، ریچ، سیو، اشتراک‌گذاری</li>
              <li>✕ راه‌اندازی‌اش حدود ۱۰ دقیقه طول می‌کشد</li>
              <li>✕ حساب باید بیزنسی یا کریتور باشد</li>
              <li>✕ لیست فالوور و دایرکت انبوه نمی‌دهد</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              نیازمند یک اپ در داشبورد متا. اتصالش از مرورگر خودتان انجام می‌شود، پس پشت فیلتر هم
              کار می‌کند.
            </p>
          </div>
        </div>

        <Notice tone="info" title="پیشنهاد عملی">
          با <strong>ورود ساده</strong> شروع کنید تا همه‌چیز کار کند. بعداً اگر آمار دقیق یا
          کامنت‌به‌دایرکتِ بی‌ریسک خواستید، همان حساب را با <strong>API رسمی</strong> هم وصل کنید —
          اپ خودش برای هر کار موتور مناسب را انتخاب می‌کند.
        </Notice>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-slate-400">
            می‌خواهید حساب دیگری وصل کنید و پنجره‌ی ورود شما را از قبل وارد نشان می‌دهد؟
          </p>
          <button
            className="btn-ghost btn-sm shrink-0"
            onClick={() => {
              void call('clearWebLogin').then(() =>
                toasts.push('info', 'نشست مرورگر داخلی پاک شد — حالا می‌توانید با حساب دیگری وارد شوید')
              )
            }}
          >
            خروج از پنجره‌ی ورود
          </button>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
            روش سوم: ورود با نام کاربری و رمز (توصیه نمی‌شود)
          </summary>
          <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <p className="text-[11px] leading-relaxed text-slate-300">
              این روش از کتابخانه‌ای استفاده می‌کند که نسخه‌ی قدیمی اپ موبایل را اعلام می‌کند و
              اینستاگرام معمولاً با پیام{' '}
              <span dir="ltr" className="text-amber-200">
                Your version of Instagram is out of date
              </span>{' '}
              ردش می‌کند. فقط به‌عنوان پشتیبان نگه داشته شده — اگر «ورود ساده» به هر دلیلی کار نکرد،
              امتحانش کنید.
            </p>
            <button className="btn-ghost btn-sm mt-2" onClick={() => setSessionModal(true)}>
              امتحان با نام کاربری و رمز
            </button>
          </div>
        </details>
      </Card>

      {oauthWizard && (
        <BrowserOAuthWizard
          onClose={() => setOauthWizard(false)}
          onDone={() => {
            setOauthWizard(false)
            onChanged()
          }}
          onTryInApp={() => {
            setOauthWizard(false)
            void connectGraph()
          }}
        />
      )}

      {sidModal && (
        <SessionIdModal
          onClose={() => setSidModal(false)}
          onDone={() => {
            setSidModal(false)
            onChanged()
          }}
        />
      )}

      {sessionModal && (
        <SessionLoginModal
          available={sessionAvailable}
          onClose={() => setSessionModal(false)}
          onDone={() => {
            setSessionModal(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════ ورود با نام کاربری ═══════════════════════ */

function SessionLoginModal({
  available,
  onClose,
  onDone
}: {
  available: { enabled: boolean; libraryAvailable: boolean }
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'login' | 'two_factor'>('login')
  const [busy, setBusy] = useState(false)

  const doLogin = async (): Promise<void> => {
    if (!username.trim() || !password) {
      toasts.push('warn', 'نام کاربری و رمز را وارد کنید')
      return
    }
    setBusy(true)
    const res = await call('sessionLogin', { username: username.trim(), password })
    setBusy(false)
    if (!res) return

    if (res.status === 'connected') {
      toasts.push('success', 'حساب وصل شد')
      onDone()
    } else if (res.status === 'two_factor') {
      setStage('two_factor')
      toasts.push('info', res.message)
    } else {
      toasts.push('warn', res.message)
    }
  }

  const doTwoFactor = async (): Promise<void> => {
    if (!code.trim()) return
    setBusy(true)
    const res = await call('sessionTwoFactor', { username: username.trim(), code: code.trim() })
    setBusy(false)
    if (res) {
      toasts.push('success', 'حساب وصل شد')
      onDone()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="اتصال با نام کاربری و رمز"
      subtitle="فقط برای قابلیت‌هایی که API رسمی ندارد"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          {stage === 'login' ? (
            <button
              className="btn-primary"
              disabled={busy || !available.enabled}
              onClick={() => void doLogin()}
            >
              {busy ? 'در حال ورود…' : 'ورود'}
            </button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={() => void doTwoFactor()}>
              {busy ? 'در حال تأیید…' : 'تأیید کد'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!available.libraryAvailable && (
          <Notice tone="danger" title="کتابخانه‌ی لازم نصب نیست">
            دستور <code>npm install instagram-private-api</code> را در پوشه‌ی پروژه اجرا کنید و اپ را
            دوباره باز کنید.
          </Notice>
        )}

        {!available.enabled && (
          <Notice tone="warn" title="موتور Session خاموش است">
            ابتدا از صفحه‌ی تنظیمات، بخش «موتور پیشرفته» را روشن کنید. آنجا ریسک‌ها توضیح داده شده.
          </Notice>
        )}

        <Notice tone="warn" title="این روش معمولاً کار نمی‌کند">
          کتابخانه‌ای که این مسیر استفاده می‌کند نسخه‌ی قدیمی اپ موبایل را اعلام می‌کند و اینستاگرام
          اغلب با پیام «Your version of Instagram is out of date» ردش می‌کند. اگر این خطا را گرفتید،
          باگ اپ نیست — از دکمه‌ی «ورود ساده با اینستاگرام» استفاده کنید که این مشکل را ندارد.
        </Notice>

        <Notice tone="danger" title="قبل از ادامه بخوانید">
          این روش شرایط استفاده‌ی اینستاگرام را نقض می‌کند و ممکن است حساب موقتاً محدود شود. رمز شما با
          رمزنگاری ویندوز روی همین کامپیوتر ذخیره می‌شود و به هیچ سروری فرستاده نمی‌شود — اما ریسک
          محدودیت حساب صفر نیست.
        </Notice>

        {stage === 'login' ? (
          <>
            <Field label="نام کاربری">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="بدون @"
                autoComplete="off"
              />
            </Field>
            <Field label="رمز">
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </>
        ) : (
          <Field
            label="کد تأیید دو مرحله‌ای"
            hint="کدی که به پیامک یا اپ احرازهویت شما آمده"
          >
            <input
              className="input tabular text-center text-lg tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="------"
              maxLength={8}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}

/* ═══════════════════════ اتصال با کد نشست ═══════════════════════ */

/**
 * ساده‌ترین مسیر وقتی بقیه کار نمی‌کنند.
 *
 * کاربر در مرورگر خودش — که از قبل وارد اینستاگرام است و VPN اش کار می‌کند —
 * یک مقدار را کپی می‌کند. نه فیسبوک لازم است، نه شماره‌ی تلفن، نه اینکه شبکه‌ی
 * داخل خود اپ به اینستاگرام برسد.
 */
function SessionIdModal({
  onClose,
  onDone
}: {
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!value.trim()) {
      toasts.push('warn', 'مقدار sessionid را بچسبانید')
      return
    }
    setBusy(true)
    const res = await callRaw('connectWithSessionId', { sessionid: value.trim() })
    setBusy(false)
    if (res.ok) {
      toasts.push('success', 'حساب با موفقیت وصل شد')
      onDone()
    } else {
      toasts.push('error', res.error ?? 'اتصال ناموفق بود', res.hint)
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="اتصال با کد نشست"
      subtitle="وقتی روش‌های دیگر به مشکل می‌خورند، این همیشه کار می‌کند"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'در حال بررسی…' : 'اتصال'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice tone="success" title="چرا این روش دردسر ندارد">
          به فیسبوک، شماره‌ی تلفن و اپ متا هیچ کاری ندارد. چون مقدار را از مرورگر
          <strong> خودتان </strong>
          می‌گیرید، اگر اینستاگرام آنجا باز می‌شود، اینجا هم کار می‌کند.
        </Notice>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">مرحله به مرحله</p>
          <ol className="space-y-2.5 text-xs leading-relaxed text-slate-300">
            <li>
              <span className="chip-info me-1.5">۱</span>
              در مرورگر خودتان (کروم / فایرفاکس) وارد{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5" dir="ltr">
                instagram.com
              </code>{' '}
              شوید — اگر از قبل وارد هستید، همین کافی است.
            </li>
            <li>
              <span className="chip-info me-1.5">۲</span>
              کلید <kbd className="rounded bg-black/40 px-1.5 py-0.5">F12</kbd> را بزنید تا ابزار
              توسعه‌دهنده باز شود.
            </li>
            <li>
              <span className="chip-info me-1.5">۳</span>
              به تب <strong>Application</strong> بروید (در فایرفاکس: <strong>Storage</strong>)، از
              ستون چپ <strong>Cookies</strong> و بعد{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5" dir="ltr">
                https://www.instagram.com
              </code>{' '}
              را انتخاب کنید.
            </li>
            <li>
              <span className="chip-info me-1.5">۴</span>
              در لیست، ردیف{' '}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-fuchsia-300" dir="ltr">
                sessionid
              </code>{' '}
              را پیدا کنید و روی ستون <strong>Value</strong> دوبار کلیک کنید تا انتخاب شود، بعد
              کپی کنید.
            </li>
            <li>
              <span className="chip-info me-1.5">۵</span>
              همان را در کادر پایین بچسبانید.
            </li>
          </ol>
        </div>

        <Field
          label="مقدار sessionid"
          hint="اگر کل رشته‌ی کوکی‌ها را هم بچسبانید مشکلی نیست — خودش sessionid را پیدا می‌کند. شناسه‌ی حسابتان هم از همین مقدار استخراج می‌شود."
        >
          <textarea
            className="input min-h-[80px] resize-y font-mono text-xs"
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="12345678%3AabcDEF123...%3A26%3AAYc..."
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Notice tone="warn" title="این مقدار را با کسی به اشتراک نگذارید">
          کد نشست مثل رمز عبور است — هر کسی آن را داشته باشد به حساب شما دسترسی دارد. اپ آن را با
          رمزنگاری ویندوز روی همین کامپیوتر ذخیره می‌کند و به هیچ سروری نمی‌فرستد.
          <br />
          اگر در اینستاگرام «خروج از همه‌ی دستگاه‌ها» بزنید، این کد باطل می‌شود و باید دوباره وصل شوید.
        </Notice>
      </div>
    </Modal>
  )
}
