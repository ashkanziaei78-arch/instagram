import type { Metadata } from 'next'
import { AccountPicker } from '@/components/AccountPicker'
import { loadDash } from '@/lib/dash'
import type { ProductRow } from '@/lib/db'
import { getDict, lp } from '@/lib/i18n'
import { addProduct, deleteProduct, saveCatalog } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.catalog.title }
}
export const dynamic = 'force-dynamic'

export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { lang, t, sql, accounts, acc } = await loadDash(sp, '/dashboard/catalog')
  const c = t.app.catalog
  if (!acc) return <p className="card p-6 text-[14px] text-mist">{t.app.needAccount}</p>
  const products = await sql<ProductRow[]>`select * from dx_products where ig_account_id = ${acc.id} order by sort, id`
  const cat = acc.settings?.catalog ?? {}

  return (
    <div className="space-y-4">
      <AccountPicker accounts={accounts} current={acc.id} base={lp(lang, '/dashboard/catalog')} label={t.app.account} />
      <section className="card p-6">
        <h1 className="text-[20px] font-bold">{c.title}</h1>
        <p className="mt-1 text-[13px] leading-6 text-mist">{c.sub}</p>
        {sp.saved && <p className="mt-3 text-[13px] text-emerald-300">{t.app.saved}</p>}
        <form action={saveCatalog} className="mt-5 grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="account" value={acc.id} />
          <div>
            <label className="label" htmlFor="keywords">{c.keywords}</label>
            <input id="keywords" name="keywords" defaultValue={cat.keywords ?? ''} className="input h-10" placeholder={c.keywordsPh} />
          </div>
          <div>
            <label className="label" htmlFor="intro">{c.intro}</label>
            <input id="intro" name="intro" defaultValue={cat.intro ?? ''} className="input h-10" placeholder={c.introPh} />
          </div>
          <div>
            <label className="label" htmlFor="button">{c.button}</label>
            <div className="flex gap-2">
              <input id="button" name="button" maxLength={20} defaultValue={cat.button ?? ''} className="input h-10" placeholder={c.buttonPh} />
              <button className="btn btn-brand btn-sm h-10">{c.save}</button>
            </div>
          </div>
        </form>
      </section>

      <section className="card p-6">
        {products.length === 0 ? (
          <p className="text-[14px] text-mist">{c.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink/50">
                <div className="aspect-[1.9/1] bg-plum-2">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <p dir="auto" className="text-start font-bold">{p.title}</p>
                  {p.subtitle && <p className="mt-1 text-[13px] text-mist">{p.subtitle}</p>}
                  <div className="mt-3 flex items-center justify-between text-[13px]">
                    <span className="text-tangerine">{p.price ?? ''}</span>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-dim hover:text-magenta">{c.remove}</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {products.length < 10 && (
          <form action={addProduct} className="mt-6 grid gap-3 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
            <input type="hidden" name="account" value={acc.id} />
            <p className="text-[15px] font-bold sm:col-span-2">{c.add}</p>
            <input name="title" required maxLength={80} className="input h-10" placeholder={c.pTitle} aria-label={c.pTitle} />
            <input name="price" maxLength={40} className="input h-10" placeholder={c.pPrice} aria-label={c.pPrice} />
            <input name="subtitle" maxLength={80} className="input h-10 sm:col-span-2" placeholder={c.pSub} aria-label={c.pSub} />
            <input name="image_url" dir="ltr" className="input h-10 text-left" placeholder={c.pImage + ' — https://'} aria-label={c.pImage} />
            <input name="url" dir="ltr" className="input h-10 text-left" placeholder={c.pUrl + ' — https://'} aria-label={c.pUrl} />
            <button className="btn btn-brand w-full sm:col-span-2 sm:w-auto">{c.add}</button>
          </form>
        )}
      </section>
    </div>
  )
}
