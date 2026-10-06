import { useCallback, useEffect, useState } from 'react'
import type { InboxView } from '../../shared/ipc'
import { Card, EmptyState, Notice, Spinner } from '../components/ui'
import { callRaw, fmtRelative, toasts } from '../lib/api'

/**
 * صندوق دایرکت — ایده از openinstadm و InstaAuto.
 *
 * دو کار می‌کند: جواب دستی از داخل اپ، و مهم‌تر، *دیده‌شدن*. وقتی قانون
 * دایرکت جواب نمی‌دهد، اینجا معلوم می‌شود اپ اصلا پیام را می‌بیند یا نه —
 * فرق «خواندن خراب است» با «قانون تطبیق نخورد».
 */
export function InboxPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [view, setView] = useState<InboxView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!accountId) return
    const r = await callRaw('listInbox', { accountId })
    if (r.ok) {
      setView(r.data as InboxView)
      setError(null)
    } else {
      setError(r.error ?? 'خواندن صندوق ناموفق بود')
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void load()
    // هر ۳۰ ثانیه — کمتر از این فقط سهمیه‌ی درخواست را می‌سوزاند
    const t = setInterval(() => void load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  if (!accountId) {
    return <EmptyState icon="✉" title="حسابی انتخاب نشده" body="اول از صفحه‌ی حساب‌ها یک حساب وصل کنید." />
  }

  const convs = [...(view?.conversations ?? [])].sort(
    (a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0)
  )
  const open = convs.find((c) => c.peer_id === openId) ?? null

  const send = async (): Promise<void> => {
    if (!open || !view || !draft.trim()) return
    setSending(true)
    const r = await callRaw('sendInboxReply', {
      accountId,
      peerId: open.peer_id,
      text: draft,
      source: view.source
    })
    setSending(false)
    if (r.ok) {
      setDraft('')
      toasts.push('success', 'ارسال شد')
      void load()
    } else {
      toasts.push('error', r.error ?? 'ارسال ناموفق بود', r.hint)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Notice tone="danger" title="صندوق خوانده نشد">
          {error}
        </Notice>
      )}
      {view?.fallbackReason && (
        <Notice tone="warn" title="از راه API رسمی خوانده شد">
          راه وب جواب نداد: {view.fallbackReason}
        </Notice>
      )}
      {view?.source === 'graph' && convs.length === 0 && (
        <Notice tone="warn" title="API رسمی هیچ گفت‌وگویی برنگرداند">
          اگر اپ متا هنوز در حالت <strong>Unpublished</strong> است، متا لیست را خالی می‌دهد — بدون هیچ
          خطایی. در داشبورد متا از منوی چپ <strong>Publish</strong> را بزنید.
        </Notice>
      )}

      <Card
        title="صندوق دایرکت"
        subtitle={
          view
            ? (view.source === 'web' ? 'از راه وب' : 'از راه API رسمی') +
              ' · ' + convs.length + ' گفت‌وگو · هر ۳۰ ثانیه تازه می‌شود'
            : 'در حال خواندن…'
        }
        action={
          <button className="btn-ghost btn-sm" onClick={() => void load()}>
            تازه‌سازی
          </button>
        }
      >
        {loading ? (
          <Spinner />
        ) : convs.length === 0 ? (
          <EmptyState icon="✉" title="گفت‌وگویی نیست" body="از یک حساب دیگر به این حساب دایرکت بدهید؛ اینجا ظاهر می‌شود." />
        ) : (
          <div className="grid min-h-[420px] gap-3 md:grid-cols-[260px_1fr]">
            <div className="space-y-1 overflow-y-auto">
              {convs.map((c) => {
                const last = c.messages.at(-1)
                return (
                  <button
                    key={c.peer_id}
                    onClick={() => setOpenId(c.peer_id)}
                    className={
                      'w-full rounded-lg px-3 py-2 text-right transition-colors ' +
                      (c.peer_id === openId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-100">@{c.peer_username ?? c.peer_id}</span>
                      {c.pending && <span className="chip-warn">درخواست</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {last ? (last.from_me ? 'شما: ' : '') + last.text : '—'}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col rounded-lg border border-white/[0.07]">
              {!open ? (
                <p className="m-auto text-xs text-slate-500">یک گفت‌وگو را انتخاب کنید</p>
              ) : (
                <>
                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {open.messages.map((m) => (
                      <div key={m.id} className={'flex ' + (m.from_me ? 'justify-start' : 'justify-end')}>
                        <div
                          className={
                            'max-w-[75%] rounded-xl px-3 py-1.5 text-sm ' +
                            (m.from_me ? 'bg-fuchsia-500/20 text-fuchsia-50' : 'bg-white/[0.07] text-slate-100')
                          }
                        >
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">{fmtRelative(m.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t border-white/[0.07] p-2">
                    <input
                      className="input"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void send()
                      }}
                      placeholder="پاسخ…"
                    />
                    <button className="btn-primary shrink-0" disabled={sending || !draft.trim()} onClick={() => void send()}>
                      {sending ? '…' : 'ارسال'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
