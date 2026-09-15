import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { DashboardStats } from '../../shared/ipc'
import { Card, EmptyState, Notice, Spinner, StatTile } from '../components/ui'
import { call, fmtDuration, fmtFull, fmtNum, fmtRelative } from '../lib/api'

export function DashboardPage({
  accountId,
  onGoToAccounts
}: {
  accountId: number | null
  onGoToAccounts: () => void
}): JSX.Element {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false)
      return
    }
    const d = await call('dashboard', { accountId })
    if (d) setData(d)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void load()
    // داشبورد زنده است: هر ۱۰ ثانیه تازه می‌شود تا پیشرفت صف دیده شود
    const t = setInterval(() => void load(), 10000)
    return () => clearInterval(t)
  }, [load])

  if (!accountId) {
    return (
      <Card>
        <EmptyState
          icon="◎"
          title="هنوز حسابی وصل نکرده‌اید"
          body="برای شروع، یک حساب اینستاگرام بیزنسی یا کریتور را با API رسمی وصل کنید. بعد از آن می‌توانید قانون «کامنت به دایرکت» بسازید."
          action={
            <button className="btn-primary mt-1" onClick={onGoToAccounts}>
              رفتن به صفحه‌ی حساب‌ها
            </button>
          }
        />
      </Card>
    )
  }

  if (loading && !data) return <Spinner />
  if (!data) return <Card>اطلاعاتی در دسترس نیست</Card>

  const { account, totals, today, safety, queue, growth, engines: engineStatus, webhook } = data
  const graph = engineStatus.find((e) => e.kind === 'graph')
  const session = engineStatus.find((e) => e.kind === 'session')

  const growthData = growth.map((g) => ({
    day: g.day.slice(5),
    followers: g.followers_count
  }))
  const growthDelta =
    growth.length >= 2 ? growth[growth.length - 1].followers_count - growth[0].followers_count : 0

  return (
    <div className="space-y-5">
      {safety.killSwitch && (
        <Notice tone="danger" title="توقف اضطراری فعال است">
          هیچ دایرکت یا پاسخی ارسال نمی‌شود. برای ادامه، از دکمه‌ی پایین نوار کناری فعال‌سازی مجدد کنید.
        </Notice>
      )}

      {safety.cooldownMs > 0 && (
        <Notice tone="warn" title="حساب در دوره‌ی خنک‌شدن است">
          اینستاگرام محدودیت اعلام کرده. ارسال‌ها {fmtDuration(safety.cooldownMs)} دیگر از سر گرفته
          می‌شود. سقف‌های روزانه را در تنظیمات پایین‌تر بیاورید.
        </Notice>
      )}

      {safety.quietNow && (
        <Notice tone="info">
          الان در ساعات سکوت هستیم — کارها در صف می‌مانند و صبح ارسال می‌شوند.
        </Notice>
      )}

      {/* ───── آمار کلی ───── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="فالوور"
          value={fmtNum(account?.followers_count)}
          sub={
            growthDelta !== 0
              ? (growthDelta > 0 ? '+' : '') + fmtFull(growthDelta) + ' در بازه‌ی نمودار'
              : 'بدون تغییر ثبت‌شده'
          }
          tone={growthDelta > 0 ? 'good' : growthDelta < 0 ? 'bad' : 'default'}
        />
        <StatTile
          label="دایرکت امروز"
          value={fmtFull(today.dmSent)}
          sub={
            'سقف ' +
            (safety.caps.find((c) => c.action === 'dm')?.cap ?? '—') +
            ' — ' +
            (safety.caps.find((c) => c.action === 'dm')
              ? safety.caps.find((c) => c.action === 'dm')!.cap -
                safety.caps.find((c) => c.action === 'dm')!.used +
                ' باقی'
              : '')
          }
          tone={
            safety.caps.find((c) => c.action === 'dm') &&
            safety.caps.find((c) => c.action === 'dm')!.used >=
              safety.caps.find((c) => c.action === 'dm')!.cap
              ? 'warn'
              : 'default'
          }
        />
        <StatTile
          label="در صف انتظار"
          value={fmtFull(queue.pending)}
          sub={queue.running ? 'صف در حال اجراست' : 'صف متوقف است'}
          tone={queue.running ? 'default' : 'warn'}
        />
        <StatTile
          label="مجموع ویو پست‌ها"
          value={fmtNum(totals.views)}
          sub={fmtFull(totals.posts) + ' پست همگام‌شده'}
        />
      </div>

      {/* ───── نمودار رشد ───── */}
      <Card
        title="رشد فالوور"
        subtitle="یک نقطه در هر روز، از زمانی که اپ حساب را همگام کرده"
      >
        {growthData.length < 2 ? (
          <EmptyState
            title="داده‌ی کافی برای نمودار نیست"
            body="اپ روزی یک عکس از تعداد فالوورها می‌گیرد. بعد از دو روز نمودار ظاهر می‌شود."
          />
        ) : (
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c13584" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#c13584" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} stroke="#ffffff10" />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  stroke="#ffffff10"
                  width={52}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0e1420',
                    border: '1px solid #ffffff18',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  name="فالوور"
                  stroke="#e1306c"
                  strokeWidth={2}
                  fill="url(#fg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ───── وضعیت موتورها ───── */}
        <Card title="وضعیت موتورها" subtitle="کدام قابلیت‌ها در دسترس‌اند">
          <div className="space-y-3">
            {[graph, session].map(
              (e) =>
                e && (
                  <div key={e.kind} className="rounded-lg border border-white/[0.07] p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-200">
                        {e.kind === 'graph' ? 'موتور رسمی (Graph API)' : 'موتور Session (غیررسمی)'}
                      </p>
                      <span className={e.connected ? 'chip-ok' : 'chip-mute'}>
                        {e.connected ? 'وصل' : 'قطع'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">{e.detail}</p>
                  </div>
                )
            )}
          </div>
        </Card>

        {/* ───── سقف‌های امروز ───── */}
        <Card title="مصرف سقف روزانه" subtitle="شمارنده‌ها نیمه‌شب صفر می‌شوند">
          <div className="space-y-3.5">
            {safety.caps.map((c) => {
              const pct = c.cap > 0 ? Math.min(100, (c.used / c.cap) * 100) : 0
              const label =
                c.action === 'dm' ? 'دایرکت' : c.action === 'comment_reply' ? 'پاسخ کامنت' : 'فالو'
              return (
                <div key={c.action}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="tabular text-slate-500">
                      {c.used} / {c.cap}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className={
                        'h-full rounded-full transition-all ' +
                        (pct >= 100 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500')
                      }
                      style={{ width: pct + '%' }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-600">
                    ظرفیت لحظه‌ای: {c.bucketAvailable} اکشن پشت‌سرهم
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ───── وضعیت دریافت رویداد ───── */}
      <Card
        title="دریافت رویداد"
        subtitle="وبهوک واکنش فوری می‌دهد؛ نظرسنجی پشتیبانِ آن است"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.07] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm text-slate-200">وبهوک</p>
              <span className={webhook.running ? 'chip-ok' : 'chip-mute'}>
                {webhook.running ? 'پورت ' + webhook.port : 'خاموش'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {webhook.running
                ? webhook.received +
                  ' رویداد دریافت شده' +
                  (webhook.lastEventAt ? ' — آخرین: ' + fmtRelative(webhook.lastEventAt) : '')
                : 'برای واکنش لحظه‌ای به کامنت‌ها، از تنظیمات روشنش کنید'}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.07] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm text-slate-200">نظرسنجی دوره‌ای</p>
              <span className={data.pollers ? 'chip-ok' : 'chip-mute'}>
                {data.pollers ? 'فعال' : 'خاموش'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              کامنت‌ها هر ۳ دقیقه، پست‌ها هر ۱۵ دقیقه، فالوورها هر ساعت
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
