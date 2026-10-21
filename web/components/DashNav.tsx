'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface NavItem {
  href: string
  label: string
  icon: string
}

/** ناوبری پنل: نوار پایین در موبایل (مثل اپ)، زبانه‌های بالا در دسکتاپ */
export function DashNav({ items }: { items: NavItem[] }) {
  const path = usePathname()
  const active = (href: string) => {
    const clean = (p: string) => p.replace(/^\/en(?=\/|$)/, '') || '/'
    const h = clean(href)
    const p = clean(path)
    return h === '/dashboard' ? p === h : p === h || p.startsWith(h + '/')
  }
  return (
    <>
      <nav className="sticky top-14 z-20 hidden border-b border-white/[0.05] bg-ink/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-5xl gap-1 px-4">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={
                'border-b-2 px-3 py-3 text-[14px] transition ' +
                (active(it.href) ? 'border-magenta font-bold text-haze' : 'border-transparent text-mist hover:text-haze')
              }
            >
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {items.slice(0, 5).map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={'flex flex-col items-center gap-0.5 py-2.5 text-[11px] ' + (active(it.href) ? 'text-haze' : 'text-dim')}
            >
              <span className={'text-[18px] leading-none ' + (active(it.href) ? 'text-magenta' : '')} aria-hidden>
                {it.icon}
              </span>
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
