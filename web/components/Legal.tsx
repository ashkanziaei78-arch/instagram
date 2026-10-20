import { SiteFooter } from './SiteFooter'
import { Logo } from './Logo'

export function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <header className="wrap flex h-16 items-center"><Logo /></header>
      <main className="wrap max-w-3xl py-12">
        <h1 className="text-[32px] font-bold">{title}</h1>
        <p className="mt-2 text-[13px] text-dim">آخرین به‌روزرسانی: {updated}</p>
        <div className="mt-8 space-y-5 text-[15px] font-light leading-8 text-mist [&_h2]:mt-10 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-haze [&_li]:mr-5 [&_li]:list-disc [&_strong]:text-haze">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
