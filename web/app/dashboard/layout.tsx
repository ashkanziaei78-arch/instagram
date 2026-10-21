import Link from 'next/link'
import { DashMenu, type MenuItem } from '@/components/DashMenu'
import { LangSwitch } from '@/components/LangSwitch'
import { Logo } from '@/components/Logo'
import { daysLeft, isActive, requireUser } from '@/lib/auth'
import { logoutAction } from '@/lib/actions-auth'
import { getDict, lp, num } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const { lang, t } = await getDict()
  const n = t.app.nav
  const desc = t.app.menu.items
  const items: MenuItem[] = [
    { key: 'home', href: lp(lang, '/dashboard'), label: n.home, desc: desc.home },
    { key: 'rules', href: lp(lang, '/dashboard/automations'), label: n.rules, desc: desc.rules },
    { key: 'contacts', href: lp(lang, '/dashboard/contacts'), label: n.contacts, desc: desc.contacts },
    { key: 'catalog', href: lp(lang, '/dashboard/catalog'), label: n.catalog, desc: desc.catalog },
    { key: 'tools', href: lp(lang, '/dashboard/tools'), label: n.tools, desc: desc.tools },
    { key: 'settings', href: lp(lang, '/dashboard/settings'), label: n.settings, desc: desc.settings },
    { key: 'learn', href: lp(lang, '/dashboard/learn'), label: n.learn, desc: desc.learn }
  ]
  const active = isActive(user)

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <DashMenu
            items={items}
            openLabel={t.app.menu.open}
            closeLabel={t.app.menu.close}
            footer={
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span dir="ltr" className="font-bold">{user.username}</span>
                  <span className={active ? 'text-emerald-300' : 'text-magenta'}>
                    {active ? num(lang, daysLeft(user)) + ' ' + t.dash.sub.left : t.dash.sub.inactive}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {user.is_admin && (
                    <Link href="/admin" className="btn btn-ghost btn-sm">{t.dash.admin}</Link>
                  )}
                  <LangSwitch lang={lang} path="/dashboard" label={t.nav.switchLang} />
                  <form action={logoutAction} className="ms-auto">
                    <button className="btn btn-ghost btn-sm">{t.dash.logout}</button>
                  </form>
                </div>
              </div>
            }
          />
          <Logo href={lp(lang, '/dashboard')} compact />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6">{children}</main>
    </div>
  )
}
