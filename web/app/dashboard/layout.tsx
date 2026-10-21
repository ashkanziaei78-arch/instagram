import Link from 'next/link'
import { DashNav } from '@/components/DashNav'
import { LangSwitch } from '@/components/LangSwitch'
import { Logo } from '@/components/Logo'
import { requireUser } from '@/lib/auth'
import { logoutAction } from '@/lib/actions-auth'
import { getDict, lp } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const { lang, t } = await getDict()
  const n = t.app.nav
  const items = [
    { href: lp(lang, '/dashboard'), label: n.home, icon: '◈' },
    { href: lp(lang, '/dashboard/automations'), label: n.rules, icon: '⚡' },
    { href: lp(lang, '/dashboard/contacts'), label: n.contacts, icon: '☷' },
    { href: lp(lang, '/dashboard/tools'), label: n.tools, icon: '✦' },
    { href: lp(lang, '/dashboard/settings'), label: n.settings, icon: '⚙' },
    { href: lp(lang, '/dashboard/catalog'), label: n.catalog, icon: '▦' }
  ]
  return (
    <div className="min-h-dvh pb-28 md:pb-16">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Logo href={lp(lang, '/dashboard')} />
          <div className="flex items-center gap-2 text-[13px]">
            {user.is_admin && <Link href="/admin" className="text-mist hover:text-haze">{t.dash.admin}</Link>}
            <LangSwitch lang={lang} path="/dashboard" label={t.nav.switchLangShort} />
            <span dir="ltr" className="hidden text-mist sm:inline">{user.username}</span>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm">{t.dash.logout}</button>
            </form>
          </div>
        </div>
      </header>
      <DashNav items={items} />
      <main className="mx-auto max-w-5xl px-4 pt-6">{children}</main>
    </div>
  )
}
