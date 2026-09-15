import { useCallback, useEffect, useState } from 'react'
import type { ContactSummary } from '../../shared/ipc'
import { Card, EmptyState, Notice, Spinner } from '../components/ui'
import { call, callRaw, fmtFull, fmtRelative, toasts } from '../lib/api'

const FILTERS = [
  { value: '', label: 'همه' },
  { value: 'followers', label: 'فالوورها' },
  { value: 'following', label: 'فالو کرده‌ام' },
  { value: 'mutual', label: 'متقابل' },
  { value: 'engaged_24h', label: 'پنجره‌ی ۲۴ ساعته باز' }
]

export function ContactsPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [contacts, setContacts] = useState<ContactSummary[]>([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<'followers' | 'following' | null>(null)

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false)
      return
    }
    const r = await call('listContacts', {
      accountId,
      audience: filter || undefined,
      limit: 500
    })
    if (r) setContacts(r)
    setLoading(false)
  }, [accountId, filter])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  if (!accountId) {
    return (
      <Card>
        <EmptyState title="اول یک حساب وصل کنید" />
      </Card>
    )
  }

  const doSync = async (kind: 'followers' | 'following'): Promise<void> => {
    setSyncing(kind)
    const res = await callRaw(kind === 'followers' ? 'syncFollowers' : 'syncFollowing', { accountId })
    setSyncing(null)

    if (res.ok) {
      const d = res.data as { message: string; newCount?: number }
      toasts.push('success', d.message)
      void load()
    } else {
      toasts.push('error', res.error ?? 'همگام‌سازی ناموفق بود', res.hint)
    }
  }

  const visible = search.trim()
    ? contacts.filter(
        (c) =>
          (c.username ?? '').includes(search.trim().replace(/^@/, '')) ||
          (c.full_name ?? '').includes(search.trim())
      )
    : contacts

  return (
    <div className="space-y-5">
      <Notice tone="info" title="لیست فالوورها از کجا می‌آید">
        API رسمی اینستاگرام لیست فالوورها را نمی‌دهد — فقط تعدادشان را. برای داشتن لیست (که برای پیام
        خوشامد و ارسال گروهی لازم است) باید موتور Session روشن و حساب با نام کاربری وصل باشد.
        <br />
        کسانی که به شما دایرکت یا کامنت داده‌اند، خودکار و بدون نیاز به موتور Session اینجا ثبت می‌شوند.
      </Notice>

      <Card
        title="مخاطبان"
        subtitle="پایه‌ی همه‌ی ارسال‌های گروهی و پیام‌های خوشامد"
        action={
          <div className="flex gap-2">
            <button
              className="btn-ghost btn-sm"
              disabled={syncing !== null}
              onClick={() => void doSync('followers')}
            >
              {syncing === 'followers' ? 'در حال همگام‌سازی…' : 'همگام‌سازی فالوورها'}
            </button>
            <button
              className="btn-ghost btn-sm"
              disabled={syncing !== null}
              onClick={() => void doSync('following')}
            >
              {syncing === 'following' ? 'در حال همگام‌سازی…' : 'همگام‌سازی فالووینگ'}
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                'rounded-lg px-3 py-1.5 text-xs transition-colors ' +
                (filter === f.value
                  ? 'bg-white/[0.1] font-medium text-white'
                  : 'text-slate-400 hover:bg-white/[0.05]')
              }
            >
              {f.label}
            </button>
          ))}
          <input
            className="input ms-auto w-52 py-1.5 text-xs"
            placeholder="جستجوی نام کاربری…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="☷"
            title={contacts.length === 0 ? 'مخاطبی ثبت نشده' : 'با این فیلتر کسی پیدا نشد'}
            body={
              contacts.length === 0
                ? 'به‌محض اینکه کسی کامنت بگذارد یا دایرکت بدهد، اینجا ظاهر می‌شود. برای لیست کامل فالوورها، دکمه‌ی همگام‌سازی را بزنید.'
                : undefined
            }
          />
        ) : (
          <>
            <p className="mb-2 text-[11px] text-slate-500">{fmtFull(visible.length)} نفر</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className="th">کاربر</th>
                    <th className="th">رابطه</th>
                    <th className="th">آخرین پیام او</th>
                    <th className="th">خوشامد</th>
                    <th className="th">برچسب‌ها</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.ig_user_id} className="row-hover">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          {c.profile_pic ? (
                            <img src={c.profile_pic} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-[10px] text-slate-500">
                              @
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-200">
                              {c.username ? '@' + c.username : c.ig_user_id}
                            </p>
                            {c.full_name && (
                              <p className="truncate text-[10px] text-slate-500">{c.full_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          {c.is_follower === 1 && <span className="chip-ok">فالوور</span>}
                          {c.is_following === 1 && <span className="chip-info">فالو کرده‌ام</span>}
                          {c.is_follower === 0 && c.is_following === 0 && (
                            <span className="chip-mute">تعامل داشته</span>
                          )}
                        </div>
                      </td>
                      <td className="td text-xs">
                        {c.last_inbound_at ? (
                          <span
                            className={
                              Date.now() - c.last_inbound_at < 86400000
                                ? 'text-emerald-300'
                                : 'text-slate-500'
                            }
                          >
                            {fmtRelative(c.last_inbound_at)}
                            {Date.now() - c.last_inbound_at < 86400000 && ' (پنجره باز)'}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td text-xs">
                        {c.welcomed_at ? (
                          <span className="chip-ok">ارسال شد</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td text-xs text-slate-400">{c.tags || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
