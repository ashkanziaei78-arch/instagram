import { useCallback, useEffect, useState } from 'react'
import type { ActivityLogRow, Job } from '../../shared/types'
import { Card, EmptyState, Spinner } from '../components/ui'
import { call, fmtDate, fmtFull, fmtRelative, toasts } from '../lib/api'

export function LogsPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [tab, setTab] = useState<'log' | 'queue'>('log')
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string>('')

  const load = useCallback(async () => {
    const [l, j] = await Promise.all([
      call('listLogs', { limit: 300, accountId: accountId ?? undefined }),
      call('listJobs', { limit: 200 })
    ])
    if (l) setLogs(l)
    if (j) setJobs(j)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 6000)
    return () => clearInterval(t)
  }, [load])

  const levelChip = (lv: ActivityLogRow['level']): string =>
    lv === 'success' ? 'chip-ok' : lv === 'warn' ? 'chip-warn' : lv === 'error' ? 'chip-err' : 'chip-mute'

  const levelLabel = (lv: ActivityLogRow['level']): string =>
    lv === 'success' ? 'موفق' : lv === 'warn' ? 'هشدار' : lv === 'error' ? 'خطا' : 'اطلاع'

  const statusChip = (s: Job['status']): [string, string] => {
    switch (s) {
      case 'pending':
        return ['chip-info', 'در انتظار']
      case 'running':
        return ['chip-warn', 'در اجرا']
      case 'done':
        return ['chip-ok', 'انجام شد']
      case 'failed':
        return ['chip-err', 'شکست']
      case 'cancelled':
        return ['chip-mute', 'لغو شد']
      case 'skipped':
        return ['chip-mute', 'رد شد']
    }
  }

  const kindLabel = (k: string): string =>
    ({
      'dm.send': 'ارسال دایرکت',
      'comment.reply': 'پاسخ کامنت',
      'broadcast.tick': 'پیشبرد ارسال گروهی',
      'contact.tag': 'برچسب مخاطب',
      'user.follow': 'فالو کردن',
      'comment.like': 'لایک کامنت'
    })[k] ?? k

  const visibleLogs = levelFilter ? logs.filter((l) => l.level === levelFilter) : logs
  const pendingCount = jobs.filter((j) => j.status === 'pending').length

  const clearQueue = async (): Promise<void> => {
    if (!confirm(pendingCount + ' کار در انتظار لغو شود؟')) return
    const n = await call('cancelPendingJobs')
    toasts.push('info', fmtFull(n ?? 0) + ' کار لغو شد')
    void load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('log')}
          className={
            'rounded-lg px-4 py-2 text-sm transition-colors ' +
            (tab === 'log' ? 'bg-white/[0.1] font-medium text-white' : 'text-slate-400 hover:bg-white/[0.05]')
          }
        >
          گزارش فعالیت
        </button>
        <button
          onClick={() => setTab('queue')}
          className={
            'rounded-lg px-4 py-2 text-sm transition-colors ' +
            (tab === 'queue' ? 'bg-white/[0.1] font-medium text-white' : 'text-slate-400 hover:bg-white/[0.05]')
          }
        >
          صف کار
          {pendingCount > 0 && <span className="chip-info ms-2">{pendingCount}</span>}
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'log' ? (
        <Card
          title="گزارش فعالیت"
          subtitle="هر اتفاقی که اپ انجام می‌دهد اینجا ثبت می‌شود — برای فهمیدن «چرا پیام نرفت» اول اینجا را ببینید"
          action={
            <div className="flex gap-2">
              <select
                className="input py-1 text-xs"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                aria-label="سطح"
              >
                <option value="">همه</option>
                <option value="error">فقط خطاها</option>
                <option value="warn">فقط هشدارها</option>
                <option value="success">فقط موفق‌ها</option>
                <option value="info">فقط اطلاع‌ها</option>
              </select>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  void call('clearLogs').then(() => {
                    toasts.push('info', 'گزارش پاک شد')
                    void load()
                  })
                }}
              >
                پاک کردن
              </button>
            </div>
          }
        >
          {visibleLogs.length === 0 ? (
            <EmptyState icon="≡" title="گزارشی ثبت نشده" />
          ) : (
            <div className="max-h-[560px] space-y-1.5 overflow-y-auto">
              {visibleLogs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 rounded-lg border border-white/[0.05] px-3 py-2"
                >
                  <span className={levelChip(l.level) + ' mt-0.5 shrink-0'}>{levelLabel(l.level)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-slate-200">{l.message}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      {l.category} · {fmtDate(l.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card
          title="صف کار"
          subtitle="کارها با فاصله‌ی انسانی و زیر سقف روزانه اجرا می‌شوند"
          action={
            pendingCount > 0 && (
              <button className="btn-danger btn-sm" onClick={() => void clearQueue()}>
                لغو {pendingCount} کار در انتظار
              </button>
            )
          }
        >
          {jobs.length === 0 ? (
            <EmptyState icon="◌" title="صف خالی است" body="وقتی قانونی فعال شود، کارها اینجا ظاهر می‌شوند." />
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full min-w-[600px]">
                <thead className="sticky top-0 bg-[#0e1420]">
                  <tr>
                    <th className="th">نوع</th>
                    <th className="th">وضعیت</th>
                    <th className="th">زمان اجرا</th>
                    <th className="th">تلاش</th>
                    <th className="th">آخرین خطا</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => {
                    const [cls, label] = statusChip(j.status)
                    return (
                      <tr key={j.id} className="row-hover">
                        <td className="td text-xs">{kindLabel(j.kind)}</td>
                        <td className="td">
                          <span className={cls}>{label}</span>
                        </td>
                        <td className="td text-xs">
                          {j.status === 'pending' ? fmtRelative(j.run_at) : fmtDate(j.updated_at)}
                        </td>
                        <td className="td tabular text-xs">
                          {j.attempts}/{j.max_attempts}
                        </td>
                        <td className="td max-w-[280px] text-[11px] leading-relaxed text-slate-500">
                          {j.last_error ? (
                            <span className="line-clamp-2">{j.last_error}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
