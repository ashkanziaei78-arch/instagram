import { useCallback, useEffect, useState } from 'react'
import type { LicenseView } from '../../shared/ipc'
import markUrl from '../assets/mark.png'
import { call, callRaw, igEvents } from '../lib/api'

/**
 * در نسخه‌ی فروشی، اپ فقط با حساب دایرکتینو و اشتراک فعال باز می‌شود.
 * نسخه‌ی شخصی (بدون آدرس سایت در بیلد) از این صفحه رد می‌شود.
 */
export function LicenseGate({ children }: { children: (l: LicenseView) => JSX.Element }): JSX.Element {
  const [license, setLicense] = useState<LicenseView | null>(null)

  const load = useCallback(async () => {
    const l = await call('getLicense')
    if (l) setLicense(l)
  }, [])

  useEffect(() => {
    void load()
    return igEvents.onLicenseChanged(() => void load())
  }, [load])

  if (!license) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">در حال بررسی اشتراک…</div>
  }
  if (!license.required || license.active) return children(license)
  return <GateScreen license={license} onChange={setLicense} />
}

function GateScreen({ license, onChange }: { license: LicenseView; onChange: (l: LicenseView) => void }): JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const login = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const r = await callRaw('licenseLogin', { username, password })
    setBusy(false)
    if (r.ok) onChange(r.data as LicenseView)
    else setError(r.error ?? 'ورود ناموفق بود')
  }

  const open = (path: string): void => void call('openExternal', { url: license.siteUrl + path })

  return (
    <div className="flex h-full items-center justify-center bg-[#0e0a1c] p-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[#171127] p-8">
        <img src={markUrl} alt="" className="mx-auto h-14 w-14" />
        {license.loggedIn ? (
          <>
            <h1 className="mt-6 text-center text-lg font-bold text-slate-100">اشتراک @{license.username} تمام شده</h1>
            <p className="mt-2 text-center text-xs leading-6 text-slate-400">
              {license.offline
                ? 'سایت دایرکتینو در دسترس نیست و آخرین بررسی قدیمی است. اینترنت را چک کنید.'
                : 'برای ادامه، اشتراک را در سایت تمدید کنید. تنظیمات و حساب‌هایتان سر جایشان است.'}
            </p>
            <button className="btn-primary mt-6 w-full" onClick={() => open('/dashboard')}>
              تمدید در سایت
            </button>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost flex-1" onClick={async () => onChange((await call('getLicense')) ?? license)}>
                دوباره بررسی کن
              </button>
              <button className="btn-ghost flex-1" onClick={async () => onChange((await call('licenseLogout')) ?? license)}>
                خروج
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void login()
            }}
          >
            <h1 className="mt-6 text-center text-lg font-bold text-slate-100">ورود به دایرکتینو</h1>
            <p className="mt-2 text-center text-xs leading-6 text-slate-400">با همان نام کاربری و رمز سایت</p>
            <input
              className="input mt-6 text-left"
              dir="ltr"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              className="input mt-3 text-left"
              dir="ltr"
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="mt-3 text-center text-xs text-rose-300">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={busy || !username || !password}>
              {busy ? '…' : 'ورود'}
            </button>
            <button type="button" className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-200" onClick={() => open('/signup')}>
              حساب ندارید؟ ثبت‌نام و خرید اشتراک در سایت
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
