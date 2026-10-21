'use client'

import { useRef, useState } from 'react'
import type { Dict } from '@/lib/dict'

export interface MediaOption {
  id: string
  label: string
  thumb?: string
}

/**
 * فرم جواب تازه. قالب‌ها با یک کلیک پر می‌کنند (ایده از ManyChat و Inzy)؛
 * امکانات پیشرفته (شرط فالو، فرم، دکمه‌ها، عکس، پست خاص) داخل «پیشرفته»
 * می‌مانند تا کاربر تازه‌کار با فرم شلوغ روبه‌رو نشود.
 */
export function RuleForm({
  action,
  accounts,
  media,
  r,
  a,
  tpl
}: {
  action: (f: FormData) => Promise<void>
  accounts: { id: string; username: string }[]
  media: MediaOption[] | null
  r: Dict['dash']['rules']
  a: Dict['app']['rule']
  tpl: Dict['dash']['tpl']
}) {
  const form = useRef<HTMLFormElement>(null)
  const [trigger, setTrigger] = useState('comment')
  const [qRows, setQRows] = useState(0)
  const isComment = trigger === 'comment'

  const apply = (x: Dict['dash']['tpl'][number]) => {
    const f = form.current
    if (!f) return
    const set = (name: string, v: string) => {
      const el = f.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
      if (el) el.value = v
    }
    setTrigger(x.trigger)
    set('trigger', x.trigger)
    set('name', x.name)
    set('keywords', x.keywords)
    set('reply', x.reply)
    set('btn_title_0', x.button)
    set('public_reply', x.pub)
    ;(f.elements.namedItem('reply') as HTMLTextAreaElement | null)?.focus()
  }

  return (
    <form ref={form} action={action} className="space-y-4">
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
          <select id="trigger" name="trigger" className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {Object.entries(a.triggers).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="account">{r.page}</label>
          <select id="account" name="account" className="input" dir="ltr">
            {accounts.map((x) => (
              <option key={x.id} value={x.id}>@{x.username}</option>
            ))}
          </select>
        </div>
      </div>

      {isComment && (
        <div>
          <label className="label" htmlFor="media_id">{a.post}</label>
          {media ? (
            <select id="media_id" name="media_id" className="input">
              <option value="">{a.allPosts}</option>
              {media.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-dim">{a.postsUnavailable}</p>
          )}
        </div>
      )}

      {trigger !== 'first_dm' && (
        <div>
          <label className="label" htmlFor="keywords">{r.keywords}</label>
          <input id="keywords" name="keywords" className="input" placeholder={r.keywordsPh} />
        </div>
      )}

      <div>
        <label className="label" htmlFor="reply">{r.reply}</label>
        <textarea id="reply" name="reply" rows={4} required maxLength={2000} className="input" placeholder={r.replyPh} />
        <p className="mt-1.5 text-[12px] leading-5 text-dim">
          {r.replyHint} {a.variantsHint}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="btn_title_0">{a.buttons}</label>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr] gap-2">
                <input name={'btn_title_' + i} maxLength={20} className="input h-10" placeholder={i === 0 ? r.btnTitlePh : r.btnTitle} id={'btn_title_' + i} aria-label={r.btnTitle} />
                <input name={'btn_url_' + i} dir="ltr" className="input h-10 text-left" placeholder="https://" aria-label={r.btnUrl} />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="name">{a.nameLabel}</label>
            <input id="name" name="name" maxLength={80} className="input h-10" placeholder={a.namePh} />
          </div>
          {isComment ? (
            <div>
              <label className="label" htmlFor="public_reply">{r.publicReply}</label>
              <input id="public_reply" name="public_reply" maxLength={300} className="input h-10" placeholder={r.publicReplyPh} />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="quick_replies">{a.quick}</label>
              <input id="quick_replies" name="quick_replies" maxLength={300} className="input h-10" placeholder={a.quickPh} />
            </div>
          )}
        </div>
      </div>

      <details className="rounded-2xl bg-ink/40 p-4">
        <summary className="cursor-pointer text-[14px] text-mist">{a.advanced}</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="follow_gate">{a.gate}</label>
            <textarea id="follow_gate" name="follow_gate" rows={2} maxLength={500} className="input" placeholder={a.gatePh} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isComment && (
              <div>
                <label className="label" htmlFor="image_url">{a.image}</label>
                <input id="image_url" name="image_url" dir="ltr" className="input h-10 text-left" placeholder="https://…/photo.jpg" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="tag">{a.tag}</label>
              <input id="tag" name="tag" maxLength={40} className="input h-10" placeholder={a.tagPh} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[14px] text-mist">
            <input type="checkbox" name="once" className="h-4 w-4 accent-[#e1306c]" /> {a.once}
          </label>

          <div className="rounded-2xl border border-white/[0.06] p-4">
            <p className="text-[14px] font-bold">{a.form}</p>
            <p className="mt-1 text-[12px] text-dim">{a.formHint}</p>
            <div className="mt-3 space-y-2">
              {Array.from({ length: qRows }).map((_, i) => (
                <QuestionRow key={i} i={i} a={a} />
              ))}
            </div>
            {qRows < 4 && (
              <button type="button" onClick={() => setQRows(qRows + 1)} className="btn btn-ghost btn-sm mt-3">
                + {a.qKinds.custom}
              </button>
            )}
            {qRows > 0 && (
              <div className="mt-3">
                <label className="label" htmlFor="done_text">{a.done}</label>
                <input id="done_text" name="done_text" maxLength={500} className="input h-10" placeholder={a.donePh} />
              </div>
            )}
          </div>
        </div>
      </details>

      <button className="btn btn-brand w-full sm:w-auto">{r.save}</button>
    </form>
  )
}

function QuestionRow({ i, a }: { i: number; a: Dict['app']['rule'] }) {
  const defaults = ['name', 'phone', 'email', 'custom']
  const [kind, setKind] = useState(defaults[i] ?? 'custom')
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <select name={'q_kind_' + i} value={kind} onChange={(e) => setKind(e.target.value)} className="input h-10" aria-label={a.form}>
        {Object.entries(a.qKinds).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input key={kind} name={'q_ask_' + i} defaultValue={a.qPh[kind]} maxLength={300} className="input h-10" aria-label={a.qKinds[kind]} />
    </div>
  )
}
