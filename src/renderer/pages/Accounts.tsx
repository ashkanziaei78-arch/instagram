import { useEffect, useState } from 'react'
import type { AccountRow } from '../../shared/types'
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
  const [sessionModal, setSessionModal] = useState(false)
  const [sessionAvailable, setSessionAvailable] = useState({ enabled: false, libraryAvailable: false })

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
            <button className="btn-primary btn-sm" disabled={connecting} onClick={() => void connectGraph()}>
              {connecting ? 'در حال اتصال…' : '+ اتصال با API رسمی'}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setSessionModal(true)}>
              + اتصال با نام کاربری
            </button>
          </div>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            icon="◎"
            title="هیچ حسابی وصل نیست"
            body="برای «کامنت به دایرکت» و آنالیتیکس، اتصال با API رسمی کافی و بی‌ریسک است. اتصال با نام کاربری فقط وقتی لازم است که لیست فالوور یا دایرکت انبوه می‌خواهید."
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

      <Card title="کدام روش اتصال؟" subtitle="تفاوت‌ها را قبل از انتخاب بدانید">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5">
            <p className="mb-2 text-sm font-semibold text-emerald-200">API رسمی — توصیه‌شده</p>
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-300">
              <li>✓ بدون ریسک محدود شدن حساب</li>
              <li>✓ کامنت به دایرکت (پاسخ خصوصی) کامل کار می‌کند</li>
              <li>✓ آمار دقیق: ویو، ریچ، سیو، اشتراک‌گذاری</li>
              <li>✓ رمز حساب لازم نیست</li>
              <li>✕ لیست فالوورها را نمی‌دهد</li>
              <li>✕ دایرکت انبوه ممکن نیست</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              نیازمند: حساب بیزنسی/کریتور + یک اپ در داشبورد متا (راهنما در تنظیمات)
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
            <p className="mb-2 text-sm font-semibold text-amber-200">نام کاربری و رمز (Session)</p>
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-300">
              <li>✓ لیست کامل فالوور و فالووینگ</li>
              <li>✓ تشخیص فالوور جدید و پیام خوشامد</li>
              <li>✓ دایرکت انبوه هنگام پست جدید</li>
              <li>✕ نقض شرایط استفاده‌ی اینستاگرام</li>
              <li>✕ احتمال محدود شدن موقت حساب</li>
              <li>✕ رمز حساب لازم است</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              اگر استفاده می‌کنید: سقف‌ها را پایین نگه دارید و اول با حساب کم‌اهمیت تست کنید.
            </p>
          </div>
        </div>
      </Card>

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
