import type { Metadata } from 'next'
import { AccountPicker } from '@/components/AccountPicker'
import { AI_PROVIDERS } from '@/lib/ai'
import { isActive } from '@/lib/auth'
import { loadDash } from '@/lib/dash'
import { env } from '@/lib/env'
import { getDict, lp } from '@/lib/i18n'
import { deleteMyAccount, saveAi } from '../actions'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.settings.title }
}
export const dynamic = 'force-dynamic'

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const { user, lang, t, accounts, acc } = await loadDash(sp, '/dashboard/settings')
  const s = t.app.settings
  const d = t.dash
  const ai = acc?.settings?.ai ?? {}
  const active = isActive(user)

  return (
    <div className="space-y-4">
      <AccountPicker accounts={accounts} current={acc?.id} base={lp(lang, '/dashboard/settings')} label={t.app.account} />
      <h1 className="text-[20px] font-bold">{s.title}</h1>
      {sp.del === 'confirm' && <p className="rounded-2xl border border-magenta/30 bg-magenta/10 px-4 py-3 text-[14px]">{d.flash['del=confirm']}</p>}

      <section className="card p-6">
        <h2 className="text-[17px] font-bold">{s.ai.title}</h2>
        <p className="mb-4 mt-1 text-[13px] leading-6 text-mist">{s.ai.sub}</p>
        {sp.saved === 'ai' && <p className="mb-3 text-[13px] text-emerald-300">{s.saved}</p>}
        {!acc ? (
          <p className="text-[13px] text-dim">{t.app.needAccount}</p>
        ) : (
          <form action={saveAi} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="account" value={acc.id} />
            <label className="flex items-center gap-2 text-[14px] text-mist sm:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={!!ai.enabled} className="h-4 w-4 accent-[#e1306c]" /> {s.ai.enabled}
            </label>
            <div>
              <label className="label" htmlFor="provider">{s.ai.provider}</label>
              <select id="provider" name="provider" defaultValue={ai.provider ?? 'openai'} className="input h-10">
                {Object.entries(AI_PROVIDERS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="model">{s.ai.model}</label>
              <input id="model" name="model" dir="ltr" defaultValue={ai.model ?? ''} className="input h-10 text-left" placeholder="gpt-4o-mini" />
            </div>
            <div>
              <label className="label" htmlFor="key">{s.ai.key}</label>
              <input id="key" name="key" type="password" dir="ltr" autoComplete="off" className="input h-10 text-left" placeholder={ai.keyEnc ? '••••••••' : 'sk-…'} />
              {ai.keyEnc && <p className="mt-1 text-[12px] text-dim">{s.ai.keySet}</p>}
            </div>
            <div>
              <label className="label" htmlFor="base_url">{s.ai.baseUrl}</label>
              <input id="base_url" name="base_url" dir="ltr" defaultValue={ai.baseUrl ?? ''} className="input h-10 text-left" placeholder="https://…/v1" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="prompt">{s.ai.prompt}</label>
              <textarea id="prompt" name="prompt" rows={5} defaultValue={ai.prompt ?? ''} className="input" placeholder={s.ai.promptPh} />
            </div>
            <button className="btn btn-brand w-full sm:w-auto">{s.ai.save}</button>
          </form>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-[17px] font-bold">{d.install.title}</h2>
        <p className="mt-3 text-[14px] leading-7 text-mist">
          <b className="text-haze">{d.install.phone}</b> {d.install.phoneBody}
        </p>
        <p className="mt-3 text-[14px] leading-7 text-mist">
          <b className="text-haze">{d.install.win}</b> {d.install.winBody}
        </p>
        {active && env.desktopUrl ? (
          <a href={env.desktopUrl} className="btn btn-ghost mt-4">{d.install.download}</a>
        ) : (
          <p className="mt-4 text-[13px] text-dim">{active ? d.install.soon : d.install.afterBuy}</p>
        )}
      </section>

      <details id="danger" className="px-2 pt-2 text-[13px] text-dim">
        <summary className="cursor-pointer">{d.danger.summary}</summary>
        <form action={deleteMyAccount} className="mt-3 flex flex-wrap gap-2">
          <input name="confirm" dir="ltr" className="input h-10 max-w-[220px]" placeholder={user.username} aria-label={d.danger.confirm} />
          <button className="btn btn-sm border border-magenta/40 text-magenta">{d.danger.button}</button>
        </form>
      </details>
    </div>
  )
}
