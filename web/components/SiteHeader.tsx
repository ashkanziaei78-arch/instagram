import Link from 'next/link'
import { Logo } from './Logo'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-ink/75 backdrop-blur-xl">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[14px] text-mist md:flex">
          <a href="#how" className="hover:text-haze">چطور کار می‌کند</a>
          <a href="#safety" className="hover:text-haze">امنیت پیج</a>
          <a href="#pricing" className="hover:text-haze">قیمت‌ها</a>
          <a href="#faq" className="hover:text-haze">سوال‌ها</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost btn-sm">ورود</Link>
          <Link href="/signup" className="btn btn-brand btn-sm hidden sm:inline-flex">ثبت‌نام</Link>
        </div>
      </div>
    </header>
  )
}
