'use client'

import { useRef } from 'react'
import type { Dict } from '@/lib/dict'

/**
 * فرم جواب تازه با قالب‌های آماده (ایده از ManyChat و Inzy): یک کلیک فرم را
 * پر می‌کند و کاربر فقط متن را شخصی می‌کند. فرم همان server action قبلی است.
 */
export function RuleForm({
  action,
  accounts,
  r,
  tpl
}: {
  action: (f: FormData) => Promise<void>
  accounts: { id: string; username: string }[]
  r: Dict['dash']['rules']
  tpl: Dict['dash']['tpl']
}) {
  const form = useRef<HTMLFormElement>(null)

  const apply = (x: Dict['dash']['tpl'][number]) => {
    const f = form.current
    if (!f) return
    const set = (name: string, v: string) => {
      const el = f.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      if (el) el.value = v
    }
    set('trigger', x.trigger)
    set('keywords', x.keywords)
    set('reply', x.reply)
    set('button_title', x.button)
    set('public_reply', x.pub)
    const details = f.querySelector('details')
    if (details && (x.button || x.pub)) details.open = true
    ;(f.elements.namedItem('reply') as HTMLTextAreaElement | null)?.focus()
  }

  return (
    <form ref={form} action={action} className="mt-6 space-y-4 border-t border-white/[0.06] pt-6">
      <p className="text-[15px] font-bold">{r.newTitle}</p>
      <div>
        <p className="mb-2 text-[13px] text-mist">{r.useTemplate}</p>
        <div className="flex flex-wrap gap-2">
          {tpl.map((x) => (
            <button
              key={x.name}
              type="button"
              onClick={() => apply(x)}
              className="rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-[13px] text-mist transition hover:border-tangerine/50 hover:text-haze"
            >
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="trigger">{r.whenLabel}</label>
          <select id="trigger" name="trigger" className="input">
            {Object.entries(r.whenOpts).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="account">{r.page}</label>
          <select id="account" name="account" className="input" dir="ltr">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>@{a.username}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="keywords">{r.keywords}</label>
        <input id="keywords" name="keywords" className="input" placeholder={r.keywordsPh} />
      </div>
      <div>
        <label className="label" htmlFor="reply">{r.reply}</label>
        <textarea id="reply" name="reply" rows={4} required maxLength={1000} className="input" placeholder={r.replyPh} />
        <p className="mt-1.5 text-[12px] text-dim">{r.replyHint}</p>
      </div>
      <details className="rounded-2xl bg-ink/40 p-4">
        <summary className="cursor-pointer text-[14px] text-mist">{r.extras}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="button_title">{r.btnTitle}</label>
            <input id="button_title" name="button_title" maxLength={20} className="input" placeholder={r.btnTitlePh} />
          </div>
          <div>
            <label className="label" htmlFor="button_url">{r.btnUrl}</label>
            <input id="button_url" name="button_url" dir="ltr" className="input text-left" placeholder="https://" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="public_reply">{r.publicReply}</label>
            <input id="public_reply" name="public_reply" maxLength={300} className="input" placeholder={r.publicReplyPh} />
          </div>
        </div>
      </details>
      <button className="btn btn-brand w-full sm:w-auto">{r.save}</button>
    </form>
  )
}
