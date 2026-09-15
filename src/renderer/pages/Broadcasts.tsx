import { useCallback, useEffect, useState } from 'react'
import type { Broadcast, BroadcastTargetFilter } from '../../shared/types'
import { Card, EmptyState, Field, Modal, Notice, Select, Spinner } from '../components/ui'
import { call, fmtDate, fmtFull, toasts } from '../lib/api'

const AUDIENCE_OPTIONS: { value: BroadcastTargetFilter['audience']; label: string; note: string }[] = [
  {
    value: 'engaged_24h',
    label: 'کسانی که در ۲۴ ساعت اخیر پیام دادند',
    note: 'بی‌ریسک — با API رسمی مجاز است'
  },
  { value: 'followers', label: 'فالوورهای من', note: 'نیازمند موتور Session' },
  { value: 'following', label: 'کسانی که فالو کرده‌ام', note: 'نیازمند موتور Session' },
  { value: 'mutual', label: 'فالوور متقابل', note: 'نیازمند موتور Session' }
]

export function BroadcastsPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [list, setList] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false)
      return
    }
    const r = await call('listBroadcasts', { accountId })
    if (r) setList(r)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void load()
    const t = setInterval(() => void load(), 8000)
    return () => clearInterval(t)
  }, [load])

  if (!accountId) {
    return (
      <Card>
        <EmptyState title="اول یک حساب وصل کنید" />
      </Card>
    )
  }

  const act = async (
    method: 'startBroadcast' | 'pauseBroadcast' | 'resumeBroadcast',
    id: number
  ): Promise<void> => {
    const r = await call(method, { broadcastId: id })
    if (r !== null) {
      if (method === 'startBroadcast' && typeof r === 'object' && r && 'message' in r) {
        toasts.push('success', String((r as { message: string }).message))
      } else {
        toasts.push('info', 'انجام شد')
      }
      void load()
    }
  }

  const statusChip = (s: Broadcast['status']): JSX.Element => {
    const map: Record<Broadcast['status'], [string, string]> = {
      draft: ['chip-mute', 'پیش‌نویس'],
      queued: ['chip-info', 'در صف'],
      running: ['chip-info', 'در حال ارسال'],
      paused: ['chip-warn', 'متوقف'],
      done: ['chip-ok', 'تمام‌شده'],
      failed: ['chip-err', 'ناموفق']
    }
    const [cls, label] = map[s]
    return <span className={cls}>{label}</span>
  }

  return (
    <div className="space-y-5">
      <Notice tone="warn" title="ارسال گروهی را جدی بگیرید">
        دایرکت انبوه سریع‌ترین راه برای محدود شدن حساب است. اپ هر پیام را با فاصله‌ی تصادفی و زیر سقف
        روزانه می‌فرستد، اما مسئولیت محتوا و حجم با شماست. با ۲۰–۳۰ نفر شروع کنید، نه ۲۰۰۰ نفر.
      </Notice>

      <Card
        title="ارسال‌های گروهی"
        subtitle="هر ارسال در صف پردازش می‌شود و می‌توانید هر لحظه متوقفش کنید"
        action={
          <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>
            + ارسال جدید
          </button>
        }
      >
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon="✈"
            title="ارسال گروهی‌ای ثبت نشده"
            body="برای اعلام خودکار پست جدید، به‌جای ساخت دستی، از صفحه‌ی اتوماسیون‌ها قانونی با تریگر «پست جدید گذاشتم» بسازید."
          />
        ) : (
          <div className="space-y-3">
            {list.map((b) => {
              const pct = b.total > 0 ? Math.round(((b.sent + b.failed) / b.total) * 100) : 0
              return (
                <div key={b.id} className="rounded-lg border border-white/[0.07] p-3.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-100">{b.name}</p>
                        {statusChip(b.status)}
                      </div>
                      <p className="tabular mt-0.5 text-[11px] text-slate-500">
                        {fmtFull(b.sent)} ارسال · {fmtFull(b.failed)} ناموفق · از {fmtFull(b.total)}{' '}
                        · ساخته‌شده {fmtDate(b.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {(b.status === 'draft' || b.status === 'failed') && (
                        <button className="btn-primary btn-sm" onClick={() => void act('startBroadcast', b.id)}>
                          شروع
                        </button>
                      )}
                      {b.status === 'running' && (
                        <button className="btn-ghost btn-sm" onClick={() => void act('pauseBroadcast', b.id)}>
                          توقف
                        </button>
                      )}
                      {b.status === 'paused' && (
                        <button className="btn-primary btn-sm" onClick={() => void act('resumeBroadcast', b.id)}>
                          ادامه
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mb-2 whitespace-pre-wrap rounded bg-[#0b0f17] px-3 py-2 text-xs leading-relaxed text-slate-300">
                    {b.message}
                  </p>

                  {b.total > 0 && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-[#833ab4] to-[#e1306c] transition-all"
                        style={{ width: pct + '%' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {creating && (
        <CreateBroadcastModal
          accountId={accountId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function CreateBroadcastModal({
  accountId,
  onClose,
  onCreated
}: {
  accountId: number
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<BroadcastTargetFilter['audience']>('engaged_24h')
  const [limit, setLimit] = useState(30)
  const [skipPrivate, setSkipPrivate] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const filter: BroadcastTargetFilter = { audience, limit, skipPrivate }

  // تعداد گیرندگان را زنده نشان می‌دهیم تا کاربر قبل از شروع بداند چند نفر است
  useEffect(() => {
    void (async () => {
      const c = await call('audienceCount', { accountId, filter })
      setCount(c)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, audience, limit, skipPrivate])

  const create = async (): Promise<void> => {
    if (!name.trim() || !message.trim()) {
      toasts.push('warn', 'نام و متن پیام را وارد کنید')
      return
    }
    setBusy(true)
    const bc = await call('createBroadcast', { accountId, name: name.trim(), message: message.trim(), filter })
    setBusy(false)
    if (bc) {
      toasts.push('success', 'ارسال گروهی ساخته شد — با دکمه‌ی «شروع» آغازش کنید')
      onCreated()
    }
  }

  const note = AUDIENCE_OPTIONS.find((a) => a.value === audience)?.note

  return (
    <Modal
      open
      onClose={onClose}
      title="ارسال گروهی جدید"
      subtitle="ابتدا ساخته می‌شود و تا زمانی که «شروع» را نزنید هیچ پیامی نمی‌رود"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? 'در حال ساخت…' : 'ساخت (بدون ارسال)'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="نام" hint="برای شناسایی در لیست">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: اعلام تخفیف آخر هفته"
          />
        </Field>

        <Field
          label="متن پیام"
          hint="از {سلام|درود} برای تنوع متن استفاده کنید — پیام یکسان برای همه، الگوی اسپم است"
        >
          <textarea
            className="input min-h-[100px] resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="{سلام|درود}! پست جدیدم رو گذاشتم، خوشحال می‌شم ببینی: https://..."
          />
        </Field>

        <Field label="گیرندگان">
          <Select
            value={audience}
            onChange={(v) => setAudience(v)}
            options={AUDIENCE_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
          />
          <p className="hint">{note}</p>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="حداکثر تعداد گیرنده" hint="محافظه‌کارانه شروع کنید">
            <input
              className="input"
              type="number"
              min={1}
              max={5000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </Field>
          <Field label="حساب‌های خصوصی">
            <label className="flex h-[38px] items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={skipPrivate}
                onChange={(e) => setSkipPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              رد شوند
            </label>
          </Field>
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
          <p className="text-xs text-slate-400">
            گیرندگان یافت‌شده:{' '}
            <span className="tabular font-semibold text-slate-100">
              {count === null ? '…' : fmtFull(count)}
            </span>
            {count === 0 && (
              <span className="mt-1 block text-[11px] leading-relaxed text-amber-300">
                لیست خالی است. اگر مخاطب «فالوورها» است، ابتدا از صفحه‌ی مخاطبان لیست فالوورها را
                همگام کنید (نیازمند موتور Session).
              </span>
            )}
          </p>
        </div>
      </div>
    </Modal>
  )
}
