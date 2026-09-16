import { useEffect, useState } from 'react'
import { Field, Modal, Notice } from './ui'
import { call, callRaw, toasts } from '../lib/api'

/**
 * اتصال رسمی از مرورگر خودِ کاربر.
 *
 * چرا سه مرحله: پشت فیلتر، *شبکه‌ی اپ* معمولا به اینستاگرام نمی‌رسد حتی وقتی
 * مرورگر کاربر می‌رسد. پس کار را به مرورگر می‌سپاریم و کاربر فقط نتیجه را
 * برمی‌گرداند. سرویس‌های آنلاین این مرحله را ندارند چون سرور دارند و کد خودش
 * به آن‌ها می‌رسد؛ اپ دسکتاپ سروری ندارد، در عوض هیچ داده‌ای از کامپیوتر
 * کاربر بیرون نمی‌رود.
 */
export function BrowserOAuthWizard({
  onClose,
  onDone,
  onTryInApp
}: {
  onClose: () => void
  onDone: () => void
  /** مسیر سریع: باز کردن صفحه‌ی اجازه داخل خود اپ (اگر شبکه‌ی اپ برسد) */
  onTryInApp?: () => void
}): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [auth, setAuth] = useState<{ url: string; bundled: boolean; redirectUri: string } | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await callRaw('getAuthUrl')
      if (res.ok) setAuth(res.data as typeof auth)
      else setAuthError(res.error ?? 'لینک اجازه ساخته نشد')
    })()
  }, [])

  const copy = (text: string, label: string): void => {
    void navigator.clipboard.writeText(text)
    toasts.push('success', label + ' کپی شد')
  }

  const openInBrowser = (url: string): void => {
    void call('openExternal', { url })
  }

  const submit = async (): Promise<void> => {
    if (!pasted.trim()) {
      toasts.push('warn', 'آدرس بازگشت را بچسبانید')
      return
    }
    setBusy(true)
    const res = await callRaw('connectWithAuthCode', { codeOrUrl: pasted.trim() })
    setBusy(false)
    if (res.ok) {
      toasts.push('success', 'حساب با API رسمی وصل شد')
      onDone()
    } else {
      toasts.push('error', res.error ?? 'اتصال ناموفق بود', res.hint)
    }
  }

  const StepDots = (): JSX.Element => (
    <div className="mb-4 flex items-center justify-center gap-2">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span
            className={
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ' +
              (step === n
                ? 'bg-gradient-to-l from-[#833ab4] to-[#e1306c] text-white'
                : step > n
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/[0.07] text-slate-500')
            }
          >
            {step > n ? '✓' : n}
          </span>
          {n < 3 && <span className="h-px w-8 bg-white/10" />}
        </div>
      ))}
    </div>
  )

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="اتصال رسمی از مرورگر خودتان"
      subtitle="برای وقتی که اینستاگرام داخل اپ باز نمی‌شود ولی در مرورگر شما باز می‌شود"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          {step > 1 && (
            <button className="btn-ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
              قبلی
            </button>
          )}
          {step < 3 ? (
            <button className="btn-primary" disabled={!auth} onClick={() => setStep((s) => (s === 1 ? 2 : 3))}>
              {step === 1 ? 'وارد شدم، بعدی' : 'اجازه دادم، بعدی'}
            </button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? 'در حال اتصال…' : 'اتصال'}
            </button>
          )}
        </>
      }
    >
      <StepDots />

      {authError && (
        <Notice tone="danger" title="لینک اجازه ساخته نشد">
          {authError}
          <br />
          <br />
          این یعنی اطلاعات اپ متا وارد نشده. اگر خودتان اپ متا ندارید، از روش{' '}
          <strong>ورود ساده با اینستاگرام</strong> یا <strong>اتصال با کد نشست</strong> استفاده کنید —
          آن‌ها به اپ متا نیاز ندارند.
        </Notice>
      )}

      {/* ───────── مرحله ۱ ───────── */}
      {step === 1 && !authError && (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="mb-2 text-sm font-medium text-slate-100">
              اول در مرورگر خودتان وارد اینستاگرام شوید
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              یک تب جدید در مرورگر خودتان (کروم، فایرفاکس، اج) باز کنید و وارد حساب اینستاگرامتان
              شوید. اگر از قبل وارد هستید، همین کافی است و می‌توانید بعدی را بزنید.
            </p>
          </div>

          <div className="flex gap-2">
            <input className="input font-mono text-xs" dir="ltr" readOnly value="https://www.instagram.com/" />
            <button
              className="btn-ghost shrink-0"
              onClick={() => copy('https://www.instagram.com/', 'لینک اینستاگرام')}
            >
              کپی
            </button>
            <button
              className="btn-ghost shrink-0"
              onClick={() => openInBrowser('https://www.instagram.com/')}
            >
              باز کن
            </button>
          </div>

          <Notice tone="warn" title="VPN باید روشن باشد">
            در تمام این مراحل، فیلترشکن مرورگرتان باید روشن باشد. اپ خودش به اینترنت نیازی ندارد
            تا وقتی به مرحله‌ی سوم برسید.
          </Notice>

          {onTryInApp && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-slate-400">
                اگر اینترنت خودِ اپ به اینستاگرام می‌رسد، می‌توانید این سه مرحله را رد کنید و
                مستقیم داخل اپ وارد شوید.
              </p>
              <button className="btn-ghost btn-sm shrink-0" onClick={onTryInApp}>
                امتحان مستقیم
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────── مرحله ۲ ───────── */}
      {step === 2 && auth && (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="mb-2 text-sm font-medium text-slate-100">
              حالا این لینک را در <span className="text-fuchsia-300">همان مرورگر</span> باز کنید
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              صفحه‌ی اینستاگرام می‌پرسد که آیا به این اپ اجازه می‌دهید. روی{' '}
              <strong className="text-slate-200">Allow</strong> یا{' '}
              <strong className="text-slate-200">مجاز است</strong> بزنید.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              className="input truncate font-mono text-xs"
              dir="ltr"
              readOnly
              value={auth.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="btn-ghost shrink-0" onClick={() => copy(auth.url, 'لینک اجازه')}>
              کپی
            </button>
            <button className="btn-primary shrink-0" onClick={() => openInBrowser(auth.url)}>
              باز کن
            </button>
          </div>

          <Notice tone="info" title="بعد از زدن Allow چه می‌بینید">
            مرورگر شما را به آدرسی می‌فرستد که ممکن است صفحه‌ی خطا یا صفحه‌ی سفید نشان دهد —
            <strong> این کاملاً طبیعی است و یعنی کار درست پیش رفته</strong>. چیزی که مهم است، خودِ
            آدرس در نوار بالای مرورگر است. آن را در مرحله‌ی بعد لازم داریم.
          </Notice>
        </div>
      )}

      {/* ───────── مرحله ۳ ───────── */}
      {step === 3 && auth && (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="mb-2 text-sm font-medium text-slate-100">
              آدرس نوار مرورگر را اینجا بچسبانید
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              بعد از زدن Allow، کل آدرسی که در نوار بالای مرورگر است را کپی کنید (حتی اگر صفحه خطا
              نشان می‌دهد) و در کادر پایین بچسبانید. آدرس با{' '}
              <code className="rounded bg-black/40 px-1 text-[11px]" dir="ltr">
                {auth.redirectUri}
              </code>{' '}
              شروع می‌شود و داخلش{' '}
              <code className="rounded bg-black/40 px-1 text-[11px] text-fuchsia-300">code=</code>{' '}
              دارد.
            </p>
          </div>

          <Field
            label="آدرس بازگشت"
            hint="اگر فقط خود کد را هم بچسبانید کار می‌کند — اپ خودش کد را پیدا می‌کند."
          >
            <textarea
              className="input min-h-[90px] resize-y font-mono text-xs"
              dir="ltr"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://...?code=AQB..."
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <Notice tone="warn" title="کد فقط یک بار کار می‌کند">
            اگر خطا گرفتید، باید به مرحله‌ی ۲ برگردید و لینک را دوباره باز کنید تا کد تازه بگیرید —
            چسباندن دوباره‌ی همان آدرس جواب نمی‌دهد.
          </Notice>
        </div>
      )}
    </Modal>
  )
}
