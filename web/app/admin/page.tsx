import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { daysLeft, requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { faNum } from '@/lib/plans'
import { addDays } from './actions'

export const metadata: Metadata = { title: 'مدیریت' }
export const dynamic = 'force-dynamic'

const MSG: Record<string, string> = { ok: 'انجام شد.', bad: 'نام کاربری و تعداد روز را درست وارد کنید.', nouser: 'چنین کاربری نیست.' }

export default async function Admin({ searchParams }: { searchParams: Promise<{ r?: string; q?: string }> }) {
  const me = await requireUser('/admin')
  if (!me.is_admin) redirect('/dashboard')
  const { r, q } = await searchParams
  const sql = await db()
  const like = '%' + (q ?? '').toLowerCase() + '%'
  const [users, pays, [stats]] = await Promise.all([
    sql<{ id: string; username: string; sub_until: Date | null; created_at: Date; pages: number }[]>`
      select u.id, u.username, u.sub_until, u.created_at,
        (select count(*)::int from dx_ig_accounts a where a.user_id = u.id) as pages
      from dx_users u where u.username like ${like} order by u.id desc limit 100`,
    sql<{ id: string; username: string; plan: string; amount: number; status: string; ref_id: string | null; created_at: Date }[]>`
      select p.id, u.username, p.plan, p.amount, p.status, p.ref_id, p.created_at
      from dx_payments p join dx_users u on u.id = p.user_id order by p.id desc limit 30`,
    sql<{ users: number; active: number; revenue: number }[]>`
      select (select count(*)::int from dx_users) as users,
        (select count(*)::int from dx_users where sub_until > now()) as active,
        (select coalesce(sum(amount),0)::bigint from dx_payments where status = 'paid' and created_at > now() - interval '30 days') as revenue`
  ])

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold">مدیریت</h1>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">پنل من</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['کاربر', faNum(stats.users)],
          ['اشتراک فعال', faNum(stats.active)],
          ['درآمد ۳۰ روز (تومان)', faNum(Number(stats.revenue))]
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-[12px] text-mist">{k}</p>
            <p className="mt-1 text-[22px] font-bold">{v}</p>
          </div>
        ))}
      </div>

      <section className="card p-6">
        <h2 className="font-bold">فعال‌سازی دستی</h2>
        <p className="mt-1 text-[13px] text-mist">برای کارت‌به‌کارت: ۳۰ = یک ماه، ۹۰ = سه ماه. عدد منفی کم می‌کند.</p>
        {r && <p className="mt-3 text-[14px] text-tangerine">{MSG[r]}</p>}
        <form action={addDays} className="mt-4 flex flex-wrap gap-2">
          <input name="username" dir="ltr" required className="input h-11 max-w-[220px]" placeholder="username" />
          <input name="days" type="number" required className="input h-11 max-w-[120px]" defaultValue={30} />
          <button className="btn btn-brand">اعمال</button>
        </form>
      </section>

      <section className="card p-6">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} dir="ltr" className="input h-10 max-w-[240px]" placeholder="جستجوی نام کاربری" />
          <button className="btn btn-ghost btn-sm h-10">جستجو</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-right text-[13px]">
            <thead className="text-mist">
              <tr><th className="py-2 font-normal">کاربر</th><th className="font-normal">روز مانده</th><th className="font-normal">پیج</th><th className="font-normal">عضویت</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/[0.06]">
                  <td className="py-2" dir="ltr">{u.username}</td>
                  <td>{faNum(daysLeft(u))}</td>
                  <td>{faNum(u.pages)}</td>
                  <td className="text-dim">{new Date(u.created_at).toLocaleDateString('fa-IR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-bold">آخرین پرداخت‌ها</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-right text-[13px]">
            <tbody>
              {pays.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="py-2" dir="ltr">{p.username}</td>
                  <td>{p.plan}</td>
                  <td>{faNum(p.amount)}</td>
                  <td className={p.status === 'paid' ? 'text-emerald-300' : 'text-dim'}>{p.status}</td>
                  <td className="text-dim" dir="ltr">{p.ref_id ?? ''}</td>
                  <td className="text-dim">{new Date(p.created_at).toLocaleDateString('fa-IR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
