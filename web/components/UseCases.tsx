'use client'

import { useState } from 'react'
import type { Dict } from '@/lib/dict'

/** زبانه‌های «برای چه کسانی» — یک نوع کسب‌وکار در هر لحظه، تا متن کوتاه بماند */
export function UseCases({ u }: { u: Dict['usecases'] }) {
  const [i, setI] = useState(0)
  const tab = u.tabs[i]
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {u.tabs.map((x, k) => (
          <button
            key={x.label}
            role="tab"
            id={'uc-tab-' + k}
            aria-selected={k === i}
            aria-controls="uc-panel"
            onClick={() => setI(k)}
            className={
              'rounded-full px-4 py-2 text-[14px] transition ' +
              (k === i ? 'bg-haze font-bold text-ink' : 'bg-white/[0.05] text-mist hover:bg-white/[0.09] hover:text-haze')
            }
          >
            {x.label}
          </button>
        ))}
      </div>
      <div
        id="uc-panel"
        role="tabpanel"
        aria-labelledby={'uc-tab-' + i}
        key={i}
        className="pop mt-6 grid gap-6 rounded-[28px] border border-white/[0.06] bg-plum p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-center"
      >
        <div>
          <h3 className="text-[22px] font-bold leading-[1.5] sm:text-[26px]">{tab.head}</h3>
          <ul className="mt-5 space-y-3 text-[15px] text-mist">
            {tab.points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tangerine" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-ink/70 p-5">
          <p className="text-[12px] text-dim">{tab.label}</p>
          <p className="mt-2 text-[17px] font-bold">{tab.example}</p>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-2/3 rounded-full bg-brand" />
          </div>
        </div>
      </div>
    </div>
  )
}
