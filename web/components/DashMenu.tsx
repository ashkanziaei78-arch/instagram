'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  key: 'home' | 'rules' | 'contacts' | 'catalog' | 'tools' | 'settings' | 'learn'
  href: string
  label: string
  desc: string
}

const ICONS: Record<MenuItem['key'], string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  rules: 'M13 2 4 14h7l-1 8 9-12h-7z',
  contacts: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  catalog: 'M5 7h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 7V5.5a3 3 0 0 1 6 0V7',
  tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  learn: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 8.6v6.8l5.4-3.4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1'
}

export function Icon({ k, className = '' }: { k: MenuItem['key']; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[k]} />
    </svg>
  )
}

/**
 * منوی همبرگری پنل. هر بخش جدا با یک خط توضیح، تا کاربر بدون حدس زدن بداند
 * کجا برود. کشو از سمت «شروع» باز می‌شود (راست در فارسی، چپ در انگلیسی).
 */
export function DashMenu({
  items,
  openLabel,
  closeLabel,
  footer
}: {
  items: MenuItem[]
  openLabel: string
  closeLabel: string
  footer?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // کشو با portal در body رسم می‌شود: هدر blur دارد و backdrop-filter عناصر
  // fixed داخلش را به خودش محدود می‌کند
  const [mounted, setMounted] = useState(false)
  const path = usePathname()
  useEffect(() => setMounted(true), [])

  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const clean = (p: string) => p.replace(/^\/en(?=\/|$)/, '') || '/'
  const active = (href: string) => {
    const h = clean(href)
    const p = clean(path)
    return h === '/dashboard' ? p === h : p === h || p.startsWith(h + '/')
  }
  const current = items.find((i) => active(i.href))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
        aria-controls="dash-drawer"
        className="flex items-center gap-2.5 rounded-full py-1.5 pe-3 ps-1.5 text-[14px] transition hover:bg-white/[0.05]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </span>
        {current && <span className="font-bold">{current.label}</span>}
      </button>

      {mounted && createPortal(<>
      <div
        className={'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ' + (open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        id="dash-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={openLabel}
        className={
          'fixed inset-y-0 start-0 z-50 flex w-[86%] max-w-sm flex-col border-e border-white/[0.07] bg-[#120d22] shadow-2xl transition-transform duration-300 ' +
          (open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full')
        }
      >
        <div className="flex h-16 items-center justify-between px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-light.png" alt="Directino" className="h-5 w-auto" />
          <button type="button" onClick={() => setOpen(false)} aria-label={closeLabel} className="flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/[0.06] hover:text-haze">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {items.map((it) => {
            const on = active(it.href)
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={on ? 'page' : undefined}
                className={'flex items-start gap-3 rounded-2xl p-3 transition ' + (on ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
              >
                <span className={'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + (on ? 'bg-brand text-white' : 'bg-white/[0.05] text-mist')}>
                  <Icon k={it.key} />
                </span>
                <span>
                  <span className={'block text-[15px] font-bold ' + (on ? 'text-haze' : '')}>{it.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-dim">{it.desc}</span>
                </span>
              </Link>
            )
          })}
        </nav>
        {footer && <div className="border-t border-white/[0.06] p-4">{footer}</div>}
      </aside>
      </>, document.body)}
    </>
  )
}
