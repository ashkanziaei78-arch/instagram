'use client'

import { useActionState } from 'react'
import type { BriefState } from '@/app/dashboard/actions'

export function AiBrief({
  action,
  filter,
  s
}: {
  action: (st: BriefState, f: FormData) => Promise<BriefState>
  filter: { r: string; acc: string; k: string }
  s: { aiTitle: string; aiButton: string; aiHint: string; aiError: string; writing: string }
}) {
  const [state, run, pending] = useActionState(action, {})
  return (
    <div className="mt-4 border-t border-white/[0.06] pt-4">
      {state.text ? (
        <div className="pop">
          <p className="mb-2 text-[13px] font-bold text-tangerine">✦ {s.aiTitle}</p>
          <p dir="auto" className="whitespace-pre-line text-start text-[14px] leading-7 text-haze">{state.text}</p>
        </div>
      ) : (
        <form action={run} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="r" value={filter.r} />
          <input type="hidden" name="acc" value={filter.acc} />
          <input type="hidden" name="k" value={filter.k} />
          <button className="btn btn-ghost btn-sm" disabled={pending}>
            ✦ {pending ? s.writing : s.aiButton}
          </button>
          {state.error === 'no-ai' && <span className="text-[12px] text-dim">{s.aiHint}</span>}
          {state.error && state.error !== 'no-ai' && <span className="text-[12px] text-magenta">{s.aiError + state.error}</span>}
        </form>
      )}
    </div>
  )
}
