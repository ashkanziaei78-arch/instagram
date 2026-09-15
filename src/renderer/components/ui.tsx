import { useEffect, useState, type ReactNode } from 'react'
import { toasts, type Toast } from '../lib/api'

/* ─────────────── اعلان‌ها ─────────────── */

export function ToastHost(): JSX.Element {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => toasts.subscribe(setList), [])

  const style: Record<Toast['kind'], string> = {
    success: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100',
    error: 'border-rose-500/30 bg-rose-950/80 text-rose-100',
    warn: 'border-amber-500/30 bg-amber-950/80 text-amber-100',
    info: 'border-sky-500/30 bg-sky-950/80 text-sky-100'
  }
  const icon: Record<Toast['kind'], string> = {
    success: '✓',
    error: '✕',
    warn: '!',
    info: 'i'
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-50 flex w-[400px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={
            'rise pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ' +
            style[t.kind]
          }
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.15] text-[11px] font-bold">
            {icon[t.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed">{t.message}</p>
            {t.hint && <p className="mt-1 text-xs leading-relaxed opacity-70">{t.hint}</p>}
          </div>
          <button
            onClick={() => toasts.dismiss(t.id)}
            className="shrink-0 rounded px-1 text-sm opacity-50 hover:opacity-100"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── کارت و سربرگ ─────────────── */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = ''
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={'card ' + className}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'default'
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}): JSX.Element {
  const toneClass = {
    default: 'text-slate-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-rose-300'
  }[tone]

  return (
    <div className="card p-4">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={'tabular mt-1.5 text-2xl font-bold ' + toneClass}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{sub}</p>}
    </div>
  )
}

export function EmptyState({
  icon = '◌',
  title,
  body,
  action
}: {
  icon?: string
  title: string
  body?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="text-3xl opacity-25">{icon}</span>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {body && <p className="max-w-md text-xs leading-relaxed text-slate-500">{body}</p>}
      {action}
    </div>
  )
}

/* ─────────────── کنترل‌های فرم ─────────────── */

export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ' +
          (checked ? 'bg-emerald-500/80' : 'bg-white/[0.12]')
        }
      >
        <span
          className={
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' +
            (checked ? 'right-0.5' : 'right-[22px]')
          }
        />
      </button>
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}): JSX.Element {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ─────────────── مودال ─────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/65 p-6 backdrop-blur-sm">
      <div
        className={
          'rise card my-auto w-full bg-[#0e1420] shadow-2xl ' + (wide ? 'max-w-3xl' : 'max-w-xl')
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded px-1.5 text-slate-500 hover:text-slate-200"
            aria-label="بستن"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ─────────────── هشدار ─────────────── */

export function Notice({
  tone = 'info',
  title,
  children
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  title?: string
  children: ReactNode
}): JSX.Element {
  const cls = {
    info: 'border-sky-500/25 bg-sky-500/[0.07] text-sky-100',
    warn: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100',
    danger: 'border-rose-500/25 bg-rose-500/[0.07] text-rose-100',
    success: 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100'
  }[tone]

  return (
    <div className={'rounded-lg border px-3.5 py-3 text-xs leading-relaxed ' + cls}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-fuchsia-400" />
      {label ?? 'در حال بارگذاری…'}
    </div>
  )
}
