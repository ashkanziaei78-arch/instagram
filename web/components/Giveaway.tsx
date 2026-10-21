'use client'

import { useActionState } from 'react'
import type { GiveawayState } from '@/app/dashboard/actions'
import type { Dict } from '@/lib/dict'

export function Giveaway({
  action,
  accountId,
  media,
  g,
  fmt
}: {
  action: (s: GiveawayState, f: FormData) => Promise<GiveawayState>
  accountId: string
  media: { id: string; label: string }[]
  g: Dict['app']['tools']['giveaway']
  fmt: 'fa' | 'en'
}) {
  const [state, run, pending] = useActionState(action, {})
  const n = (x: number) => x.toLocaleString(fmt === 'fa' ? 'fa-IR' : 'en-US')
  return (
    <div>
      <form action={run} className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <input type="hidden" name="account" value={accountId} />
        <div>
          <label className="label" htmlFor="ga_media">{g.post}</label>
          <select id="ga_media" name="media_id" className="input h-10" required>
            {media.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ga_count">{g.count}</label>
          <input id="ga_count" name="count" type="number" min={1} max={20} defaultValue={1} className="input h-10" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ga_kw">{g.keyword}</label>
          <input id="ga_kw" name="keyword" maxLength={100} className="input h-10" />
        </div>
        <button className="btn btn-brand w-full sm:w-auto" disabled={pending}>{pending ? '…' : g.pick}</button>
      </form>
      {state.error && <p className="mt-4 text-[13px] text-magenta">{state.error}</p>}
      {state.winners && (
        <div className="pop mt-5 rounded-2xl border border-white/[0.07] bg-ink/60 p-4">
          {state.winners.length === 0 ? (
            <p className="text-[14px] text-mist">{g.none}</p>
          ) : (
            <>
              <p className="text-[13px] text-mist">
                {g.result} — {g.among} {n(state.total ?? 0)} {g.people}
              </p>
              <ol className="mt-3 space-y-2">
                {state.winners.map((w, i) => (
                  <li key={w.username + i} className="flex items-baseline gap-3">
                    <span className="text-[20px] font-bold text-tangerine">{n(i + 1)}</span>
                    <span dir="ltr" className="font-bold">@{w.username}</span>
                    <span className="truncate text-[13px] text-dim">{w.text}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}
