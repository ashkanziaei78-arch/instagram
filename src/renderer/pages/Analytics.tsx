import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MediaRow } from '../../shared/types'
import { Card, EmptyState, Notice, Spinner, StatTile } from '../components/ui'
import { call, fmtDate, fmtFull, fmtNum, toasts } from '../lib/api'

type SortKey = 'timestamp' | 'views' | 'like_count' | 'comments_count' | 'reach' | 'saved' | 'engagement'

export function AnalyticsPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [media, setMedia] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sort, setSort] = useState<SortKey>('timestamp')

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false)
      return
    }
    const r = await call('listMedia', { accountId, limit: 100 })
    if (r) setMedia(r)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const sync = async (): Promise<void> => {
    if (!accountId) return
    setSyncing(true)
    const r = await call('syncMedia', { accountId })
    setSyncing(false)
    if (r) {
      toasts.push('success', r.message)
      void load()
    }
  }

  /** نرخ تعامل: (لایک + کامنت + سیو) تقسیم بر ریچ. اگر ریچ نداریم، محاسبه بی‌معنی است. */
  const withEngagement = useMemo(
    () =>
      media.map((m) => ({
        ...m,
        engagement:
          m.reach > 0 ? ((m.like_count + m.comments_count + m.saved) / m.reach) * 100 : 0
      })),
    [media]
  )

  const sorted = useMemo(() => {
    const arr = [...withEngagement]
    arr.sort((a, b) => {
      const av = sort === 'engagement' ? a.engagement : (a[sort] as number)
      const bv = sort === 'engagement' ? b.engagement : (b[sort] as number)
      return bv - av
    })
    return arr
  }, [withEngagement, sort])

  const topPosts = useMemo(
    () =>
      [...withEngagement]
        .sort((a, b) => b.views - a.views)
        .slice(0, 8)
        .reverse()
        .map((m) => ({
          label: (m.caption ?? 'بدون کپشن').slice(0, 18) + '…',
          views: m.views,
          id: m.media_id
        })),
    [withEngagement]
  )

  if (!accountId) {
    return (
      <Card>
        <EmptyState title="اول یک حساب وصل کنید" />
      </Card>
    )
  }

  if (loading) return <Spinner />

  const totals = media.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      reach: acc.reach + m.reach,
      likes: acc.likes + m.like_count,
      comments: acc.comments + m.comments_count,
      saved: acc.saved + m.saved
    }),
    { views: 0, reach: 0, likes: 0, comments: 0, saved: 0 }
  )
  const noInsights = media.length > 0 && totals.reach === 0 && totals.views === 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {media.length > 0
            ? fmtFull(media.length) + ' پست همگام‌شده'
            : 'هنوز پستی همگام نشده'}
        </p>
        <button className="btn-primary btn-sm" disabled={syncing} onClick={() => void sync()}>
          {syncing ? 'در حال همگام‌سازی…' : 'همگام‌سازی پست‌ها و آمار'}
        </button>
      </div>

      {noInsights && (
        <Notice tone="info" title="آمار ویو و ریچ صفر است">
          این معمولاً یعنی حساب با موتور Session وصل است، نه API رسمی. آمار دقیق (ویو، ریچ، سیو) فقط از
          API رسمی می‌آید. برای دیدنش، حساب را با API رسمی هم وصل کنید.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="مجموع ویو" value={fmtNum(totals.views)} />
        <StatTile label="مجموع ریچ" value={fmtNum(totals.reach)} />
        <StatTile label="مجموع لایک" value={fmtNum(totals.likes)} />
        <StatTile label="مجموع کامنت" value={fmtNum(totals.comments)} />
        <StatTile label="مجموع سیو" value={fmtNum(totals.saved)} />
      </div>

      {topPosts.length > 1 && (
        <Card title="پربازدیدترین پست‌ها" subtitle="بر اساس تعداد ویو">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPosts} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#ffffff10" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} stroke="#ffffff10" width={52} />
                <Tooltip
                  contentStyle={{
                    background: '#0e1420',
                    border: '1px solid #ffffff18',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="views" name="ویو" radius={[4, 4, 0, 0]}>
                  {topPosts.map((_, i) => (
                    <Cell key={i} fill={i === topPosts.length - 1 ? '#e1306c' : '#833ab4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card
        title="جدول پست‌ها"
        subtitle="برای ساختن قانون محدود به یک پست، شناسه‌ی آن را از همین‌جا کپی کنید"
        action={
          <select
            className="input py-1 text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="ترتیب"
          >
            <option value="timestamp">جدیدترین</option>
            <option value="views">بیشترین ویو</option>
            <option value="like_count">بیشترین لایک</option>
            <option value="comments_count">بیشترین کامنت</option>
            <option value="reach">بیشترین ریچ</option>
            <option value="saved">بیشترین سیو</option>
            <option value="engagement">بالاترین نرخ تعامل</option>
          </select>
        }
      >
        {media.length === 0 ? (
          <EmptyState
            icon="▤"
            title="پستی همگام نشده"
            body="دکمه‌ی «همگام‌سازی پست‌ها و آمار» را بزنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="th">پست</th>
                  <th className="th">نوع</th>
                  <th className="th">تاریخ</th>
                  <th className="th">ویو</th>
                  <th className="th">ریچ</th>
                  <th className="th">لایک</th>
                  <th className="th">کامنت</th>
                  <th className="th">سیو</th>
                  <th className="th">تعامل</th>
                  <th className="th">شناسه</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m.media_id} className="row-hover">
                    <td className="td max-w-[220px]">
                      <div className="flex items-center gap-2">
                        {m.thumbnail_url && (
                          <img
                            src={m.thumbnail_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded object-cover"
                          />
                        )}
                        <span className="truncate text-xs text-slate-300">
                          {m.caption?.slice(0, 50) ?? '— بدون کپشن —'}
                        </span>
                      </div>
                    </td>
                    <td className="td">
                      <span className="chip-mute">
                        {m.media_type === 'REELS'
                          ? 'ریلز'
                          : m.media_type === 'VIDEO'
                            ? 'ویدیو'
                            : m.media_type === 'CAROUSEL_ALBUM'
                              ? 'آلبوم'
                              : 'عکس'}
                      </span>
                    </td>
                    <td className="td text-xs">{fmtDate(m.timestamp)}</td>
                    <td className="td tabular">{fmtFull(m.views)}</td>
                    <td className="td tabular">{fmtFull(m.reach)}</td>
                    <td className="td tabular">{fmtFull(m.like_count)}</td>
                    <td className="td tabular">{fmtFull(m.comments_count)}</td>
                    <td className="td tabular">{fmtFull(m.saved)}</td>
                    <td className="td tabular">
                      {m.engagement > 0 ? m.engagement.toFixed(1) + '٪' : '—'}
                    </td>
                    <td className="td">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(m.media_id)
                          toasts.push('success', 'شناسه‌ی پست کپی شد')
                        }}
                      >
                        کپی
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
