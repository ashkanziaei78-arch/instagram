import { useCallback, useEffect, useState } from 'react'
import type { AccountWithLinks } from '../shared/types'
import { ToastHost } from './components/ui'
import { call, igEvents } from './lib/api'
import { AccountsPage } from './pages/Accounts'
import { AnalyticsPage } from './pages/Analytics'
import { AutomationsPage } from './pages/Automations'
import { BroadcastsPage } from './pages/Broadcasts'
import { ContactsPage } from './pages/Contacts'
import { DashboardPage } from './pages/Dashboard'
import { InboxPage } from './pages/Inbox'
import { LogsPage } from './pages/Logs'
import { SettingsPage } from './pages/Settings'

type PageKey =
  | 'dashboard'
  | 'automations'
  | 'inbox'
  | 'broadcasts'
  | 'analytics'
  | 'contacts'
  | 'accounts'
  | 'logs'
  | 'settings'

/**
 * advanced: فقط در «حالت پیشرفته» دیده می‌شود. بیشتر کاربرها فقط می‌خواهند
 * حساب را وصل کنند و یک قانون بسازند — بقیه‌ی صفحه‌ها برایشان شلوغی است.
 */
const NAV: { key: PageKey; label: string; icon: string; group: 1 | 2 | 3; advanced?: boolean }[] = [
  { key: 'dashboard', label: 'خانه', icon: '◈', group: 1 },
  { key: 'automations', label: 'جواب خودکار', icon: '⚡', group: 1 },
  { key: 'inbox', label: 'دایرکت‌ها', icon: '✉', group: 1 },
  { key: 'broadcasts', label: 'پیام گروهی', icon: '✈', group: 1 },
  { key: 'analytics', label: 'آمار پست‌ها', icon: '▤', group: 2, advanced: true },
  { key: 'contacts', label: 'مخاطبان', icon: '☷', group: 2, advanced: true },
  { key: 'accounts', label: 'حساب من', icon: '◎', group: 3 },
  { key: 'logs', label: 'گزارش کارها', icon: '≡', group: 3, advanced: true },
  { key: 'settings', label: 'تنظیمات', icon: '⚙', group: 3, advanced: true }
]

/** ترجیح هر کاربر — اگر حافظه‌ی مرورگر در دسترس نبود، حالت ساده */
function loadAdvanced(): boolean {
  try {
    return localStorage.getItem('advancedMode') === '1'
  } catch {
    return false
  }
}

/** چند تا از سه راه اتصال برای این حساب برقرار است */
const linkCount = (a: AccountWithLinks): number =>
  Number(a.links.simple) + Number(a.links.sessionid) + Number(a.links.official)

export default function App(): JSX.Element {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [accounts, setAccounts] = useState<AccountWithLinks[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [killSwitch, setKillSwitch] = useState(false)
  const [advanced, setAdvanced] = useState(loadAdvanced)
  const toggleAdvanced = (): void => {
    const next = !advanced
    setAdvanced(next)
    try {
      localStorage.setItem('advancedMode', next ? '1' : '0')
    } catch {
      /* فقط همین جلسه */
    }
    if (!next && NAV.find((n) => n.key === page)?.advanced) setPage('dashboard')
  }

  const loadAccounts = useCallback(async () => {
    const list = await call('listAccounts')
    if (list) {
      setAccounts(list)
      setActiveId((cur) => {
        if (cur && list.some((a) => a.id === cur)) return cur
        return list[0]?.id ?? null
      })
    }
    setLoading(false)
  }, [])

  const loadSafety = useCallback(async () => {
    const s = await call('getSafety')
    if (s) setKillSwitch(s.killSwitch)
  }, [])

  useEffect(() => {
    void loadAccounts()
    void loadSafety()
    // main می‌تواند از سینی سیستم کلید قطع را بزند؛ آن را رصد می‌کنیم
    const off = igEvents.onActivity(() => void loadSafety())
    return off
  }, [loadAccounts, loadSafety])

  const toggleKill = async (): Promise<void> => {
    const next = !killSwitch
    await call('setKillSwitch', { enabled: next })
    setKillSwitch(next)
  }

  const account = accounts.find((a) => a.id === activeId) ?? null

  const renderPage = (): JSX.Element => {
    // صفحه‌هایی که بدون حساب معنا ندارند، خودشان پیام راهنما نشان می‌دهند
    switch (page) {
      case 'dashboard':
        return <DashboardPage accountId={activeId} onGoToAccounts={() => setPage('accounts')} />
      case 'automations':
        return <AutomationsPage accountId={activeId} />
      case 'inbox':
        return <InboxPage accountId={activeId} />
      case 'broadcasts':
        return <BroadcastsPage accountId={activeId} />
      case 'analytics':
        return <AnalyticsPage accountId={activeId} />
      case 'contacts':
        return <ContactsPage accountId={activeId} />
      case 'accounts':
        return <AccountsPage accounts={accounts} onChanged={loadAccounts} />
      case 'logs':
        return <LogsPage accountId={activeId} />
      case 'settings':
        return <SettingsPage hasGraphAccount={accounts.some((a) => a.links.official)} />
    }
  }

  return (
    <div className="flex h-full">
      {/* ───── نوار کناری ───── */}
      <aside className="flex w-60 shrink-0 flex-col border-l border-white/[0.06] bg-[#0e1420]">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#833ab4] via-[#c13584] to-[#e1306c] text-sm font-bold text-white">
            IG
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">دایرکت خودکار</p>
            <p className="text-[10px] text-slate-500">
              اتوماسیون اینستاگرام · نسخه‌ی {__APP_VERSION__}
            </p>
          </div>
        </div>

        {/* انتخاب حساب فعال */}
        <div className="px-3 pb-3">
          {accounts.length > 0 ? (
            <select
              className="input py-1.5 text-xs"
              value={activeId ?? ''}
              onChange={(e) => setActiveId(Number(e.target.value))}
              aria-label="حساب فعال"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username}
                </option>
              ))}
            </select>
          ) : (
            <button className="btn-ghost btn-sm w-full" onClick={() => setPage('accounts')}>
              + افزودن حساب
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          {[1, 2, 3].map((g) => (
            <div key={g} className="mb-1">
              {g > 1 && <div className="my-2 border-t border-white/[0.06]" />}
              {NAV.filter((n) => n.group === g && (advanced || !n.advanced)).map((n) => (
                <button
                  key={n.key}
                  onClick={() => setPage(n.key)}
                  className={
                    'mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-right text-sm transition-colors ' +
                    (page === n.key
                      ? 'bg-white/[0.08] font-medium text-white'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200')
                  }
                >
                  <span className="w-4 text-center text-xs opacity-70">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-3 pb-2">
          <button
            onClick={toggleAdvanced}
            className="w-full rounded-lg px-3 py-1.5 text-right text-[11px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            {advanced ? '◂ حالت ساده' : '▸ حالت پیشرفته'}
          </button>
        </div>

        {/* کلید قطع اضطراری — همیشه در دید */}
        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={() => void toggleKill()}
            className={killSwitch ? 'btn-primary w-full' : 'btn-danger w-full'}
          >
            {killSwitch ? '▶ دوباره روشن کن' : '■ همه را متوقف کن'}
          </button>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
            {killSwitch
              ? 'هیچ پیامی فرستاده نمی‌شود'
              : 'اگر چیزی اشتباه شد، این را بزن'}
          </p>
        </div>
      </aside>

      {/* ───── محتوا ───── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-6">
          <h1 className="text-base font-semibold text-slate-100">
            {NAV.find((n) => n.key === page)?.label}
          </h1>
          <div className="flex items-center gap-2 text-xs">
            {killSwitch && <span className="chip-err">توقف اضطراری فعال</span>}
            {account ? (
              // شمارش اتصال‌ها، نه نام یک موتور: یک حساب می‌تواند چند اتصال
              // داشته باشد و نمایش فقط یکی، بقیه را نامرئی می‌کرد.
              <span className={linkCount(account) === 3 ? 'chip-ok' : 'chip-warn'}>
                @{account.username} · {linkCount(account) === 3 ? 'کامل وصل است' : linkCount(account) + ' از ۳ اتصال'}
              </span>
            ) : (
              !loading && <span className="chip-warn">هیچ حسابی وصل نیست</span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">{renderPage()}</div>
      </main>

      <ToastHost />
    </div>
  )
}
