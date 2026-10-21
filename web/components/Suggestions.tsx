'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface Suggestion {
  key: string
  tag: 'must' | 'grow'
  title: string
  body: string
  cta: string
  href: string
}

/**
 * پیشنهادهای امروز به‌صورت پنجره‌ی بازشو. روزی یک بار خودش باز می‌شود
 * (مگر فهرست عوض شده باشد) و با دکمه‌ی «پیشنهادها» هر وقت دوباره باز می‌شود.
 */
export function Suggestions({
  items,
  s,
  lang
}: {
  items: Suggestion[]
  lang: 'fa' | 'en'
  s: { button: string; title: string; sub: string; later: string; empty: string; tags: Record<string, string> }
}) {
  const [open, setOpen] = useState(false)
  const sig = new Date().toISOString().slice(0, 10) + ':' + items.map((i) => i.key).join(',')

  useEffect(() => {
    if (!items.length) return
    try {
      if (localStorage.getItem('dx_suggest_seen') !== sig) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [sig, items.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem('dx_suggest_seen', sig)
    } catch {
      /* فقط همین بار */
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm relative">
        ✦ {s.button}
        {items.length > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta px-1 text-[11px] font-bold text-white">
            {items.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sugg-title"
            onClick={(e) => e.stopPropagation()}
            className="pop max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.08] bg-[#151026] p-6 sm:max-w-lg sm:rounded-[28px]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <h2 id="sugg-title" className="text-[20px] font-bold">{s.title}</h2>
            <p className="mt-1 text-[13px] leading-6 text-mist">{s.sub}</p>
            {items.length === 0 ? (
              <p className="mt-6 text-[14px] text-mist">{s.empty}</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {items.map((it) => (
                  <li key={it.key} className="rounded-2xl border border-white/[0.06] bg-ink/60 p-4">
                    <div className="flex items-center gap-2">
                      <span className={'chip text-[11px] ' + (it.tag === 'must' ? 'bg-magenta/15 text-magenta' : 'bg-emerald-400/10 text-emerald-300')}>
                        {s.tags[it.tag]}
                      </span>
                      <p className="text-[15px] font-bold">{it.title}</p>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-6 text-mist">{it.body}</p>
                    <Link href={it.href} onClick={close} className="mt-3 inline-flex text-[13px] font-bold text-tangerine hover:underline">
                      {it.cta} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={close} className="btn btn-ghost mt-5 w-full">{s.later}</button>
          </div>
        </div>
      )}
    </>
  )
}
