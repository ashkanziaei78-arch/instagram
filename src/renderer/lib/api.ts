import type { ApiResult, IpcApi } from '../../shared/ipc'

declare global {
  interface Window {
    ig: IpcApi
    igEvents: {
      onActivity(cb: () => void): () => void
      onAccountsChanged(cb: () => void): () => void
    }
  }
}

export const ig = window.ig
export const igEvents = window.igEvents

/* ─────────────── سیستم اعلان ─────────────── */

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info' | 'warn'
  message: string
  hint?: string
}

type ToastListener = (toasts: Toast[]) => void

class ToastBus {
  private toasts: Toast[] = []
  private listeners = new Set<ToastListener>()
  private seq = 1

  subscribe(fn: ToastListener): () => void {
    this.listeners.add(fn)
    fn(this.toasts)
    return () => this.listeners.delete(fn)
  }

  push(kind: Toast['kind'], message: string, hint?: string): void {
    const t: Toast = { id: this.seq++, kind, message, hint }
    this.toasts = [...this.toasts, t]
    this.emit()
    // خطاها بیشتر می‌مانند تا کاربر فرصت خواندن داشته باشد
    setTimeout(() => this.dismiss(t.id), kind === 'error' ? 9000 : 4200)
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l(this.toasts)
  }
}

export const toasts = new ToastBus()

/**
 * فراخوانی IPC با مدیریت خطای یکسان.
 *
 * چرا این پوشش لازم است: هندلرهای main هرگز throw نمی‌کنند، بلکه
 * `{ ok:false, error }` برمی‌گردانند. اگر هر صفحه خودش این را چک کند، یک جا
 * فراموش می‌شود و خطا بی‌صدا گم می‌گردد. این تابع تضمین می‌کند هر شکستی
 * دیده شود — و با hint، کاربر بفهمد چه کار کند.
 */
export async function call<K extends keyof IpcApi>(
  method: K,
  ...args: Parameters<IpcApi[K]>
): Promise<Awaited<ReturnType<IpcApi[K]>> extends ApiResult<infer D> ? D | null : null> {
  const fn = ig[method] as (...a: unknown[]) => Promise<ApiResult<unknown>>
  let res: ApiResult<unknown>
  try {
    res = await fn(...(args as unknown[]))
  } catch (e) {
    toasts.push('error', 'ارتباط با هسته‌ی برنامه قطع شد', (e as Error).message)
    return null as never
  }

  if (!res.ok) {
    toasts.push('error', res.error ?? 'خطای ناشناخته', res.hint)
    return null as never
  }
  return (res.data ?? null) as never
}

/** نسخه‌ای که خطا را خودش نشان نمی‌دهد — برای وقتی صفحه می‌خواهد خودش تصمیم بگیرد */
export async function callRaw<K extends keyof IpcApi>(
  method: K,
  ...args: Parameters<IpcApi[K]>
): Promise<ApiResult<unknown>> {
  const fn = ig[method] as (...a: unknown[]) => Promise<ApiResult<unknown>>
  try {
    return await fn(...(args as unknown[]))
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/* ─────────────── کمک‌کننده‌های نمایش ─────────────── */

export function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

export function fmtFull(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-US')
}

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function fmtRelative(ts: number | null | undefined): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const abs = Math.abs(diff)
  const future = diff < 0

  const units: [number, string][] = [
    [86400000, 'روز'],
    [3600000, 'ساعت'],
    [60000, 'دقیقه'],
    [1000, 'ثانیه']
  ]
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const v = Math.floor(abs / ms)
      return future ? v + ' ' + label + ' دیگر' : v + ' ' + label + ' پیش'
    }
  }
  return 'همین حالا'
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return h + ' ساعت و ' + m + ' دقیقه'
  if (m > 0) return m + ' دقیقه'
  return Math.ceil(ms / 1000) + ' ثانیه'
}
