import Link from 'next/link'
import type { IgAccountRow } from '@/lib/db'

/** وقتی بیش از یک پیج وصل است، انتخاب پیج با ?a= */
export function AccountPicker({ accounts, current, base, label }: { accounts: IgAccountRow[]; current: string | undefined; base: string; label: string }) {
  if (accounts.length < 2) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-dim">{label}:</span>
      {accounts.map((a) => (
        <Link
          key={a.id}
          href={base + '?a=' + a.id}
          dir="ltr"
          className={'rounded-full px-3 py-1 ' + (a.id === current ? 'bg-haze font-bold text-ink' : 'bg-white/[0.05] text-mist hover:text-haze')}
        >
          @{a.username}
        </Link>
      ))}
    </div>
  )
}
