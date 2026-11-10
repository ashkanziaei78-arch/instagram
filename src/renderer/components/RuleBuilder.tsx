import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CatalogCard, FormQuestion, MediaRow, MessageMedia, Rule, RuleAction, TriggerType } from '../../shared/types'
import type { StoryItem } from '../../shared/ipc'
import { call, callRaw, toasts } from '../lib/api'

/**
 * سازنده‌ی قانون به سبک «کامنت هوشمند»: شرط‌ها، کلمه‌ها، نوع جواب و گزینه‌های
 * تعامل در یک صفحه، با پیش‌نمایش زنده. همه‌جا پیام آماده هست تا کاربر لازم
 * نباشد چیزی تایپ کند — یک ضربه روی پیام آماده، متن را پر می‌کند.
 */

/* ═══════════════════════ پیام‌های آماده ═══════════════════════ */

const PRESET = {
  keywords: ['قیمت', 'لینک', 'خرید', 'اطلاعات', 'سفارش', 'موجودی', 'تخفیف', '۱'],
  dm: [
    'سلام {{username}} جان 👋 اینم لینکی که خواستی:',
    'سلام! مرسی از کامنتت 🌸 اطلاعات کامل محصول رو اینجا ببین 👇',
    'درود {{username}} 🙌 قیمت و موجودی رو برات فرستادم؛ سؤالی بود همین‌جا بپرس',
    'مرسی که پیام دادی ✨ برای سفارش کافیه روی دکمه‌ی زیر بزنی',
    'سلام عزیزم 😍 کد تخفیف ۱۰٪ مخصوص تو: OFF10'
  ],
  buttonTitles: ['مشاهده محصول', 'خرید', 'ثبت سفارش', 'سایت ما', 'دانلود', 'تماس با ما'],
  mediaCaption: ['اینم ویدیوی کاملش 🎬', 'عکس محصول از نزدیک 📸', 'گوش بده 🎧', ''],
  catalogIntro: ['اینم محصولات این هفته 👇', 'پرفروش‌ترین‌ها 🔥', 'جدیدترین‌ها رسید ✨'],
  questions: {
    name: 'اسم قشنگت چیه؟ 😊',
    phone: 'شماره‌ی موبایلت رو بفرست تا هماهنگ کنیم 📱',
    email: 'ایمیلت رو بنویس تا فایل رو برات بفرستیم ✉️',
    custom: 'از کدوم شهر سفارش می‌دی؟ 🏙️'
  } as Record<FormQuestion['kind'], string>,
  formIntro: ['سلام {{username}} 👋 برای ثبت سفارش چند سؤال کوتاه می‌پرسم', 'برای رزرو، لطفاً به این سؤال‌ها جواب بده 🙏', ''],
  done: [
    'مرسی! اطلاعاتت ثبت شد، به‌زودی باهات تماس می‌گیریم ✨',
    'ثبت شد ✅ همکارامون امروز پیام می‌دن',
    'عالی 🎉 فایل رو همین الان برات می‌فرستیم'
  ],
  publicReplies: [
    'مرسی ❤️ دایرکتو ببین 👀',
    'دمت گرم 🙌 دایرکت چک کن',
    'ممنون 🌟 ادامه‌ش تو دایرکته',
    'مرسی رفیق 💬 دایرکت فرستادم',
    'فرستادم برات 📩',
    'جوابت تو دایرکته ✨',
    'ارسال شد ✅ دایرکت رو ببین',
    'قربونت 💜 پیام دادم',
    'مرسی از کامنتت 🌸 دایرکت',
    'چک کن دایرکتتو 😉'
  ],
  gate: [
    'این لینک مخصوص فالوورهای منه ✨ فالو کن و دوباره همون کلمه رو بفرست تا لینک بیاد 🎉',
    'اول فالوم کن 🙏 بعد همون کامنت رو دوباره بذار تا برات بفرستم',
    'فقط فالوورها لینک رو می‌گیرن 💜 فالو کن و دوباره امتحان کن'
  ],
  followUp: [
    'سلام دوباره 👋 فرصت کردی محصول رو ببینی؟ اگه سؤالی داری همین‌جا بپرس',
    'هنوز موجوده 😍 برای سفارش فقط کافیه جواب بدی',
    'یادت نره! کد تخفیفت تا امشب اعتبار داره ⏰',
    'نظرت چی بود؟ 🌸 خوشحال می‌شم بدونم'
  ]
}

const HOURS = [1, 3, 6, 12, 23]

/* ═══════════════════════ مدل فرم ═══════════════════════ */

type ReplyKind = 'text' | 'buttons' | 'media' | 'catalog' | 'form'
type MatchKind = 'derivative' | 'exact' | 'number' | 'any'

interface Reply {
  kind: ReplyKind
  text: string
  buttons: { title: string; url: string }[]
  media: MessageMedia
  cards: CatalogCard[]
  questions: FormQuestion[]
  doneText: string
}

interface BuilderState {
  id?: number
  name: string
  enabled: boolean
  conds: { postSpecific: boolean; postAny: boolean; storySpecific: boolean; storyAny: boolean; dm: boolean }
  mediaIds: string[]
  storyIds: string[]
  match: MatchKind
  keywords: string[]
  reply: Reply
  publicOn: boolean
  publicReplies: string[]
  gateOn: boolean
  gateText: string
  followOn: boolean
  follow: Reply
  hours: number | null
  oncePerUser: boolean
  priority: number
  delay_min: number
  delay_max: number
}

const emptyReply = (kind: ReplyKind = 'text'): Reply => ({
  kind,
  text: '',
  buttons: [{ title: PRESET.buttonTitles[0], url: '' }],
  media: { url: '', kind: 'image' },
  cards: [{ title: '', subtitle: '', imageUrl: '', url: '', buttonTitle: 'خرید' }],
  questions: [
    { kind: 'name', ask: PRESET.questions.name },
    { kind: 'phone', ask: PRESET.questions.phone }
  ],
  doneText: PRESET.done[0]
})

function fresh(): BuilderState {
  return {
    name: '',
    enabled: true,
    conds: { postSpecific: false, postAny: true, storySpecific: false, storyAny: false, dm: false },
    mediaIds: [],
    storyIds: [],
    match: 'derivative',
    keywords: [],
    reply: { ...emptyReply('buttons'), text: PRESET.dm[0] },
    publicOn: true,
    publicReplies: PRESET.publicReplies.slice(0, 4),
    gateOn: false,
    gateText: PRESET.gate[0],
    followOn: false,
    follow: { ...emptyReply('text'), text: PRESET.followUp[0] },
    hours: null,
    oncePerUser: true,
    priority: 0,
    delay_min: 8,
    delay_max: 45
  }
}

/** یک اکشن دایرکت → Reply (برای ویرایش قانون موجود) */
function actionToReply(a: RuleAction | undefined, fallback: ReplyKind): Reply {
  const r = emptyReply(fallback)
  if (!a) return r
  const kind: ReplyKind = a.questions?.length
    ? 'form'
    : a.cards?.length
      ? 'catalog'
      : a.media?.url
        ? 'media'
        : a.buttons?.length
          ? 'buttons'
          : 'text'
  return {
    ...r,
    kind,
    text: a.text ?? '',
    buttons: a.buttons?.length ? a.buttons : r.buttons,
    media: a.media ?? r.media,
    cards: a.cards?.length ? a.cards : r.cards,
    questions: a.questions?.length ? a.questions : r.questions,
    doneText: a.doneText ?? r.doneText
  }
}

export function ruleToState(rule: Rule): BuilderState {
  const t = [rule.trigger_type, ...(rule.extra_triggers ?? [])]
  const hasPost = t.includes('comment_keyword') || t.includes('comment_any')
  const hasStory = t.includes('story_reply')
  const dm = rule.actions.find((a) => a.type === 'send_dm')
  const pub = rule.actions.find((a) => a.type === 'reply_comment')
  const fu = rule.actions.find((a) => a.type === 'follow_up')
  const kws = rule.keywords.split(/[,،\n]/).map((k) => k.trim()).filter(Boolean)
  return {
    ...fresh(),
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    conds: {
      postSpecific: hasPost && !!rule.media_scope,
      postAny: hasPost && !rule.media_scope,
      storySpecific: hasStory && !!rule.story_scope,
      storyAny: hasStory && !rule.story_scope,
      dm: t.includes('dm_keyword')
    },
    mediaIds: rule.media_scope ? rule.media_scope.split(',').map((x) => x.trim()) : [],
    storyIds: rule.story_scope ? rule.story_scope.split(',').map((x) => x.trim()) : [],
    match: kws.length === 0 ? 'any' : rule.match_mode === 'exact' ? 'exact' : rule.match_mode === 'number' ? 'number' : 'derivative',
    keywords: kws,
    reply: actionToReply(dm, 'text'),
    publicOn: !!pub,
    publicReplies: pub ? (pub.variants?.length ? pub.variants : [pub.text ?? '']) : PRESET.publicReplies.slice(0, 4),
    gateOn: !!dm?.followGate,
    gateText: dm?.followGate || PRESET.gate[0],
    followOn: !!fu,
    follow: actionToReply(fu, 'text'),
    hours: fu?.hours ?? null,
    oncePerUser: rule.once_per_user,
    priority: rule.priority,
    delay_min: rule.delay_min,
    delay_max: rule.delay_max
  }
}

function replyFields(r: Reply): Partial<RuleAction> {
  switch (r.kind) {
    case 'buttons':
      return { text: r.text, buttons: r.buttons.filter((b) => b.title.trim() && b.url.trim()).slice(0, 3) }
    case 'media':
      return { text: r.text, media: r.media }
    case 'catalog':
      return { text: r.text, cards: r.cards.filter((c) => c.title.trim()).slice(0, 10) }
    case 'form':
      return { text: r.text, questions: r.questions.filter((q) => q.ask.trim()), doneText: r.doneText }
    default:
      return { text: r.text }
  }
}

function hasContent(r: Reply): string | null {
  if (r.kind === 'text' && !r.text.trim()) return 'متن پیام را بنویسید یا یک پیام آماده انتخاب کنید'
  if (r.kind === 'buttons') {
    if (!r.text.trim()) return 'متن بالای دکمه را بنویسید'
    if (!r.buttons.some((b) => b.title.trim() && /^https?:\/\//.test(b.url.trim()))) return 'لینک دکمه باید با https:// شروع شود'
  }
  if (r.kind === 'media' && !/^https:\/\//.test(r.media.url.trim())) return 'لینک مستقیم رسانه باید با https:// شروع شود'
  if (r.kind === 'catalog' && !r.cards.some((c) => c.title.trim())) return 'حداقل یک محصول با نام اضافه کنید'
  if (r.kind === 'form' && !r.questions.some((q) => q.ask.trim())) return 'حداقل یک سؤال برای فرم بگذارید'
  return null
}

/** وضعیت فرم → قانون ذخیره‌شدنی */
function compile(s: BuilderState, accountId: number): { rule?: Partial<Rule> & { account_id: number }; error?: string } {
  const c = s.conds
  const post = c.postSpecific || c.postAny
  const story = c.storySpecific || c.storyAny
  if (!post && !story && !c.dm) return { error: 'حداقل یک «شرط برای» انتخاب کنید' }
  if (c.postSpecific && !c.postAny && s.mediaIds.length === 0) return { error: 'پست یا ریل موردنظر را انتخاب کنید' }
  if (c.storySpecific && !c.storyAny && s.storyIds.length === 0) return { error: 'استوری موردنظر را انتخاب کنید' }
  const anyText = s.match === 'any'
  if (!anyText && s.keywords.length === 0) return { error: 'حداقل یک کلمه وارد کنید و + را بزنید' }
  if (c.dm && anyText) return { error: 'برای دایرکت باید کلمه‌ی کلیدی تعریف کنید («هر پیامی» فقط برای کامنت و استوری است)' }
  const err = hasContent(s.reply)
  if (err) return { error: err }
  if (s.followOn) {
    if (!s.hours) return { error: 'زمان ارسال پیام پیگیری را انتخاب کنید' }
    const e2 = hasContent(s.follow)
    if (e2) return { error: 'پیام پیگیری: ' + e2 }
  }

  const triggers: TriggerType[] = []
  if (post) triggers.push(anyText ? 'comment_any' : 'comment_keyword')
  if (story) triggers.push('story_reply')
  if (c.dm) triggers.push('dm_keyword')

  const actions: RuleAction[] = []
  actions.push({
    type: 'send_dm',
    order: 0,
    ...replyFields(s.reply),
    followGate: s.gateOn && s.gateText.trim() ? s.gateText : undefined
  })
  const pub = s.publicReplies.map((x) => x.trim()).filter(Boolean)
  if (post && s.publicOn && pub.length) {
    actions.push({ type: 'reply_comment', order: actions.length, text: pub[0], variants: pub })
  }
  if (s.followOn && s.hours) {
    actions.push({ type: 'follow_up', order: actions.length, hours: s.hours, ...replyFields(s.follow) })
  }

  const name =
    s.name.trim() ||
    (anyText ? 'هر کامنت' : s.keywords.slice(0, 2).join('، ')) + ' → ' + KIND_LABEL[s.reply.kind]
  return {
    rule: {
      id: s.id,
      account_id: accountId,
      name,
      enabled: s.enabled,
      trigger_type: triggers[0],
      extra_triggers: triggers.slice(1),
      match_mode: s.match === 'exact' ? 'exact' : s.match === 'number' ? 'number' : 'contains',
      keywords: anyText ? '' : s.keywords.join(','),
      case_sensitive: false,
      media_scope: post && !c.postAny ? s.mediaIds.join(',') : null,
      story_scope: story && !c.storyAny ? s.storyIds.join(',') : null,
      once_per_user: s.oncePerUser,
      delay_min: s.delay_min,
      delay_max: s.delay_max,
      priority: s.priority,
      actions
    }
  }
}

const KIND_LABEL: Record<ReplyKind, string> = {
  text: 'متن',
  buttons: 'متن همراه با دکمه',
  media: 'رسانه (تصویر، ویدیو، صدا)',
  catalog: 'کاتالوگ محصولات',
  form: 'فرم'
}

const KIND_ICON: Record<ReplyKind, string> = {
  text: 'M5 6h14M12 6v12M9 18h6',
  buttons: 'M4 5h16v6H4zM4 15h16M4 19h16',
  media: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5h.01',
  catalog: 'M8 8h12v12H8zM4 4h12v2M4 4v12h2',
  form: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3'
}

/* ═══════════════════════ اجزای کوچک ═══════════════════════ */

function Section({ title, sub, children }: { title?: string; sub?: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-3">
      {title && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-100">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
      )}
      <div className="rounded-2xl bg-white/[0.045] p-4">{children}</div>
    </section>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-right">
      <span className="text-sm leading-7 text-slate-200">{label}</span>
      <span
        className={
          'relative h-7 w-12 shrink-0 rounded-full transition-colors ' + (checked ? 'bg-violet-600' : 'bg-white/15')
        }
        aria-hidden
      >
        <span
          className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ' + (checked ? 'left-1' : 'left-6')}
        />
      </span>
    </button>
  )
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-right text-sm transition-colors ' +
        (checked ? 'bg-violet-500/15 text-slate-100 ring-1 ring-violet-400/40' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]')
      }
    >
      <span>{label}</span>
      <span
        className={
          'flex h-6 w-6 items-center justify-center rounded-md border-2 ' +
          (checked ? 'border-violet-400 bg-violet-500 text-white' : 'border-white/25')
        }
      >
        {checked && '✓'}
      </span>
    </button>
  )
}

/** ردیف‌های پیام آماده: یک ضربه = همان متن */
function Presets({ items, onPick, label = 'پیام آماده' }: { items: string[]; onPick: (v: string) => void; label?: string }): JSX.Element {
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500">{label} — بزنید تا جایگزین شود</p>
      <div className="flex flex-wrap gap-1.5">
        {items.filter(Boolean).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="max-w-full truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-slate-300 hover:border-violet-400/50 hover:text-white"
            title={p}
          >
            {p.length > 42 ? p.slice(0, 42) + '…' : p}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextBox({
  value,
  onChange,
  placeholder,
  rows = 3,
  max = 1000
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  max?: number
}): JSX.Element {
  return (
    <div>
      <textarea
        className="w-full resize-y rounded-xl bg-black/30 px-4 py-3 text-sm leading-7 text-slate-100 outline-none ring-1 ring-white/[0.06] focus:ring-violet-400/50"
        rows={rows}
        maxLength={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <button type="button" className="hover:text-violet-300" onClick={() => onChange(value + '{{username}}')}>
          + اسم طرف ({'{{username}}'})
        </button>
        <span className="tabular">
          {value.length}/{max}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════ ویرایشگر جواب ═══════════════════════ */

function ReplyEditor({
  r,
  set,
  kinds,
  presets
}: {
  r: Reply
  set: (r: Reply) => void
  kinds: ReplyKind[]
  presets: string[]
}): JSX.Element {
  const patch = (p: Partial<Reply>): void => set({ ...r, ...p })
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">نوع پاسخی که کاربران دریافت می‌کنند رو مشخص کنید.</p>
      <div className="space-y-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => patch({ kind: k })}
            className={
              'flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-right text-sm transition-colors ' +
              (r.kind === k ? 'bg-violet-500/15 ring-1 ring-violet-400/40' : 'bg-black/25 hover:bg-white/[0.06]')
            }
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-950/70 text-violet-200 ring-1 ring-violet-400/30">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
                  <path d={KIND_ICON[k]} />
                </svg>
              </span>
              <span className="text-slate-100">{KIND_LABEL[k]}</span>
            </span>
            <span className={'h-6 w-6 rounded-full border-2 ' + (r.kind === k ? 'border-violet-400 bg-violet-500 shadow-[inset_0_0_0_4px_#1a1526]' : 'border-white/30')} />
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-black/20 p-3">
        {r.kind === 'text' && (
          <>
            <TextBox value={r.text} onChange={(v) => patch({ text: v })} placeholder="متن دایرکت…" />
            <Presets items={presets} onPick={(v) => patch({ text: v })} />
          </>
        )}

        {r.kind === 'buttons' && (
          <>
            <TextBox value={r.text} onChange={(v) => patch({ text: v })} placeholder="متن بالای دکمه…" max={640} />
            <Presets items={presets} onPick={(v) => patch({ text: v })} />
            <div className="mt-3 space-y-2">
              {r.buttons.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                  <input
                    className="input"
                    maxLength={20}
                    value={b.title}
                    placeholder="متن دکمه"
                    onChange={(e) => patch({ buttons: r.buttons.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                  />
                  <input
                    className="input"
                    dir="ltr"
                    value={b.url}
                    placeholder="https://"
                    onChange={(e) => patch({ buttons: r.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={r.buttons.length === 1}
                    onClick={() => patch({ buttons: r.buttons.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                {PRESET.buttonTitles.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
                    onClick={() => {
                      const empty = r.buttons.findIndex((b) => !b.title.trim())
                      if (empty >= 0) patch({ buttons: r.buttons.map((x, j) => (j === empty ? { ...x, title: t } : x)) })
                      else if (r.buttons.length < 3) patch({ buttons: [...r.buttons, { title: t, url: '' }] })
                      else patch({ buttons: r.buttons.map((x, j) => (j === r.buttons.length - 1 ? { ...x, title: t } : x)) })
                    }}
                  >
                    {t}
                  </button>
                ))}
                {r.buttons.length < 3 && (
                  <button type="button" className="text-[12px] text-violet-300" onClick={() => patch({ buttons: [...r.buttons, { title: '', url: '' }] })}>
                    + دکمه (حداکثر ۳)
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {r.kind === 'media' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['image', 'video', 'audio'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ media: { ...r.media, kind: k } })}
                  className={'rounded-lg px-3 py-1.5 text-xs ' + (r.media.kind === k ? 'bg-violet-500/25 text-white' : 'bg-white/[0.05] text-slate-400')}
                >
                  {k === 'image' ? 'تصویر' : k === 'video' ? 'ویدیو' : 'صدا'}
                </button>
              ))}
            </div>
            <input
              className="input"
              dir="ltr"
              value={r.media.url}
              placeholder="https://… (لینک مستقیم فایل)"
              onChange={(e) => patch({ media: { ...r.media, url: e.target.value } })}
            />
            <p className="hint">
              لینک باید عمومی و مستقیم باشد (مثلاً فایلی که روی سایت خودتان گذاشته‌اید). در جواب کامنت اینستاگرام فقط یک پیام
              اجازه می‌دهد؛ اگر متن هم بنویسید، رسانه به‌صورت دکمه‌ی «مشاهده» زیر متن می‌آید.
            </p>
            <TextBox value={r.text} onChange={(v) => patch({ text: v })} placeholder="متن همراه (اختیاری)" rows={2} />
            <Presets items={PRESET.mediaCaption} onPick={(v) => patch({ text: v })} />
          </div>
        )}

        {r.kind === 'catalog' && (
          <div className="space-y-2">
            <TextBox value={r.text} onChange={(v) => patch({ text: v })} placeholder="پیام قبل از کارت‌ها (اختیاری)" rows={2} />
            <Presets items={PRESET.catalogIntro} onPick={(v) => patch({ text: v })} />
            {r.cards.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-white/[0.03] p-2.5 sm:grid-cols-2">
                <input className="input" placeholder="نام محصول" value={c.title} onChange={(e) => patch({ cards: r.cards.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <input className="input" placeholder="قیمت یا توضیح کوتاه" value={c.subtitle ?? ''} onChange={(e) => patch({ cards: r.cards.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)) })} />
                <input className="input" dir="ltr" placeholder="https://… عکس" value={c.imageUrl ?? ''} onChange={(e) => patch({ cards: r.cards.map((x, j) => (j === i ? { ...x, imageUrl: e.target.value } : x)) })} />
                <input className="input" dir="ltr" placeholder="https://… لینک خرید" value={c.url ?? ''} onChange={(e) => patch({ cards: r.cards.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                <div className="flex items-center gap-2 sm:col-span-2">
                  <select className="input h-9 max-w-[10rem]" value={c.buttonTitle ?? 'خرید'} onChange={(e) => patch({ cards: r.cards.map((x, j) => (j === i ? { ...x, buttonTitle: e.target.value } : x)) })}>
                    {PRESET.buttonTitles.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-ghost btn-sm ms-auto" disabled={r.cards.length === 1} onClick={() => patch({ cards: r.cards.filter((_, j) => j !== i) })}>
                    حذف محصول
                  </button>
                </div>
              </div>
            ))}
            {r.cards.length < 10 && (
              <button type="button" className="text-[13px] text-violet-300" onClick={() => patch({ cards: [...r.cards, { title: '', subtitle: '', imageUrl: '', url: '', buttonTitle: 'خرید' }] })}>
                + افزودن محصول (حداکثر ۱۰)
              </button>
            )}
          </div>
        )}

        {r.kind === 'form' && (
          <div className="space-y-2">
            <TextBox value={r.text} onChange={(v) => patch({ text: v })} placeholder="پیام اول (اختیاری)" rows={2} />
            <Presets items={PRESET.formIntro} onPick={(v) => patch({ text: v })} />
            {r.questions.map((q, i) => (
              <div key={i} className="grid grid-cols-[8rem_1fr_auto] gap-2">
                <select
                  className="input"
                  value={q.kind}
                  onChange={(e) => {
                    const kind = e.target.value as FormQuestion['kind']
                    patch({ questions: r.questions.map((x, j) => (j === i ? { kind, ask: PRESET.questions[kind] } : x)) })
                  }}
                >
                  <option value="name">نام</option>
                  <option value="phone">موبایل</option>
                  <option value="email">ایمیل</option>
                  <option value="custom">سؤال دلخواه</option>
                </select>
                <input className="input" value={q.ask} onChange={(e) => patch({ questions: r.questions.map((x, j) => (j === i ? { ...x, ask: e.target.value } : x)) })} />
                <button type="button" className="btn-ghost btn-sm" onClick={() => patch({ questions: r.questions.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
            {r.questions.length < 5 && (
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PRESET.questions) as FormQuestion['kind'][]).map((k) => (
                  <button key={k} type="button" className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white" onClick={() => patch({ questions: [...r.questions, { kind: k, ask: PRESET.questions[k] }] })}>
                    + {k === 'name' ? 'نام' : k === 'phone' ? 'موبایل' : k === 'email' ? 'ایمیل' : 'سؤال دلخواه'}
                  </button>
                ))}
              </div>
            )}
            <p className="hint">شماره و ایمیل خودکار بررسی می‌شود؛ اگر اشتباه باشد دوباره پرسیده می‌شود. جواب‌ها در «مخاطبان» ذخیره می‌شود.</p>
            <label className="label mt-2">پیام پایان فرم</label>
            <TextBox value={r.doneText} onChange={(v) => patch({ doneText: v })} rows={2} />
            <Presets items={PRESET.done} onPick={(v) => patch({ doneText: v })} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════ انتخاب پست و استوری ═══════════════════════ */

function PostPicker({ accountId, selected, onChange }: { accountId: number; selected: string[]; onChange: (ids: string[]) => void }): JSX.Element {
  const [media, setMedia] = useState<MediaRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const load = (): void => {
    void call('listMedia', { accountId, limit: 30 }).then((m) => setMedia(m ?? []))
  }
  useEffect(load, [accountId])
  const sync = (): void => {
    setBusy(true)
    void callRaw('syncMedia', { accountId }).then((r) => {
      setBusy(false)
      if (!r.ok) toasts.push('error', r.error ?? 'پست‌ها خوانده نشد', r.hint)
      load()
    })
  }
  if (!media) return <p className="text-xs text-slate-500">در حال خواندن پست‌ها…</p>
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{selected.length ? selected.length + ' پست انتخاب شده' : 'روی پست‌ها بزنید تا انتخاب شوند'}</span>
        <button type="button" className="text-violet-300" disabled={busy} onClick={sync}>
          {busy ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی پست‌ها'}
        </button>
      </div>
      {media.length === 0 ? (
        <p className="rounded-lg bg-black/20 p-3 text-xs text-slate-500">هنوز پستی خوانده نشده. «به‌روزرسانی پست‌ها» را بزنید.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.map((m) => {
            const on = selected.includes(m.media_id)
            return (
              <button
                key={m.media_id}
                type="button"
                title={m.caption ?? ''}
                onClick={() => onChange(on ? selected.filter((x) => x !== m.media_id) : [...selected, m.media_id])}
                className={'relative aspect-square overflow-hidden rounded-lg bg-white/[0.05] ring-2 ' + (on ? 'ring-violet-400' : 'ring-transparent')}
              >
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="p-1 text-[10px] text-slate-400">{(m.caption ?? m.media_type).slice(0, 30)}</span>
                )}
                {m.media_type === 'VIDEO' && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">ریل</span>}
                {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[11px] text-white">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StoryPicker({ accountId, selected, onChange }: { accountId: number; selected: string[]; onChange: (ids: string[]) => void }): JSX.Element {
  const [stories, setStories] = useState<StoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void callRaw('listStories', { accountId }).then((r) => {
      if (r.ok) setStories((r.data as StoryItem[]) ?? [])
      else setError((r.error ?? 'استوری‌ها خوانده نشد') + (r.hint ? ' — ' + r.hint : ''))
    })
  }, [accountId])
  if (error) return <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">{error}</p>
  if (!stories) return <p className="mt-3 text-xs text-slate-500">در حال خواندن استوری‌ها…</p>
  if (stories.length === 0)
    return <p className="mt-3 rounded-lg bg-black/20 p-3 text-xs text-slate-500">الان استوری فعالی ندارید (استوری‌ها ۲۴ ساعت می‌مانند).</p>
  return (
    <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8">
      {stories.map((st) => {
        const on = selected.includes(st.id)
        return (
          <button
            key={st.id}
            type="button"
            onClick={() => onChange(on ? selected.filter((x) => x !== st.id) : [...selected, st.id])}
            className={'relative aspect-[9/16] overflow-hidden rounded-lg bg-white/[0.05] ring-2 ' + (on ? 'ring-violet-400' : 'ring-transparent')}
          >
            {st.thumbnail_url && <img src={st.thumbnail_url} alt="" className="h-full w-full object-cover" />}
            {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[11px] text-white">✓</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════ مثال‌های تطبیق ═══════════════════════ */

const MATCH_INFO: Record<MatchKind, { label: string; kw: string; ok: string; no?: string }> = {
  derivative: {
    label: 'اگر در یک جمله دقیقاً کلمات زیر یا مشتقات کلمات زیر وجود داشت',
    kw: 'قیمت، ۱۲، ۱۸',
    ok: 'قیمت، قیمت کالا لطفا، قیمتشون لطفا، قیمت های کالا را لطفا بفرمایید، کد ۱۲، ۱۸',
    no: 'ارزش کالا لطفا، غیمت کالا'
  },
  exact: { label: 'اگر کل پیام دقیقاً همین کلمه بود', kw: 'قیمت', ok: 'قیمت', no: 'قیمت لطفا، قیمتش چنده' },
  number: { label: 'اگر عدد مشخص را جدا نوشت', kw: '۱', ok: '۱، 1، کد ۱', no: '۱۰، ۱۱، ۲۱' },
  any: { label: 'هر کامنت یا جوابی (بدون کلمه)', kw: '—', ok: 'هر متنی که بنویسد' }
}

/* ═══════════════════════ پیش‌نمایش ═══════════════════════ */

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <div className={'flex ' + (me ? 'justify-start' : 'justify-end')}>
      <div className={'max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-6 ' + (me ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-100')}>
        {children}
      </div>
    </div>
  )
}

function ReplyBubble({ r }: { r: Reply }): JSX.Element {
  const t = r.text.replace(/\{\{username\}\}/g, 'sara.shop')
  return (
    <>
      {(t.trim() || r.kind === 'buttons') && (
        <Bubble me>
          <span className="whitespace-pre-wrap">{t || '…'}</span>
          {r.kind === 'buttons' &&
            r.buttons.filter((b) => b.title).map((b, i) => (
              <span key={i} className="mt-1.5 block rounded-lg bg-white/20 py-1 text-center font-bold">
                {b.title}
              </span>
            ))}
          {r.kind === 'form' && r.questions[0] && <span className="mt-2 block">{r.questions[0].ask}</span>}
        </Bubble>
      )}
      {!t.trim() && r.kind === 'form' && r.questions[0] && <Bubble me>{r.questions[0].ask}</Bubble>}
      {r.kind === 'media' && (
        <Bubble me>
          <span className="flex h-24 w-36 items-center justify-center rounded-lg bg-black/30 text-[11px]">
            {r.media.kind === 'image' ? '🖼️ تصویر' : r.media.kind === 'video' ? '🎬 ویدیو' : '🎧 صدا'}
          </span>
        </Bubble>
      )}
      {r.kind === 'catalog' && (
        <div className="flex gap-2 overflow-x-auto pb-1" dir="rtl">
          {r.cards.filter((c) => c.title).map((c, i) => (
            <div key={i} className="w-32 shrink-0 overflow-hidden rounded-xl bg-white/10 text-[11px]">
              {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-20 w-full object-cover" /> : <div className="h-20 bg-black/30" />}
              <div className="p-2">
                <p className="font-bold text-slate-100">{c.title}</p>
                {c.subtitle && <p className="text-slate-400">{c.subtitle}</p>}
                <p className="mt-1 rounded bg-white/15 py-0.5 text-center">{c.buttonTitle || 'مشاهده'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Preview({ s }: { s: BuilderState }): JSX.Element {
  const post = s.conds.postAny || s.conds.postSpecific
  const kw = s.match === 'any' ? 'عالیه 😍' : s.keywords[0] || 'قیمت'
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[34px] border border-white/10 bg-black p-3 shadow-2xl">
      <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-white/10" />
      <div className="space-y-2.5 rounded-[24px] bg-[#121018] p-3">
        {post && (
          <div className="rounded-xl bg-white/[0.04] p-2.5 text-[12px]">
            <p className="text-slate-400">کامنت زیر پست</p>
            <p className="mt-1">
              <b className="text-slate-200">sara.shop</b> <span className="text-slate-300">{kw}</span>
            </p>
            {s.publicOn && s.publicReplies[0] && (
              <p className="mt-1.5 border-r-2 border-violet-400/50 pr-2 text-slate-300">
                <b>شما</b> {s.publicReplies[0]}
              </p>
            )}
          </div>
        )}
        {!post && <Bubble>{kw}</Bubble>}
        <p className="text-center text-[10px] text-slate-500">دایرکت</p>
        {s.gateOn && (
          <>
            <p className="text-center text-[10px] text-amber-300/80">اگر فالو نکرده باشد:</p>
            <Bubble me>{s.gateText}</Bubble>
            <p className="text-center text-[10px] text-emerald-300/80">اگر فالو کرده باشد:</p>
          </>
        )}
        <ReplyBubble r={s.reply} />
        {s.followOn && s.hours && (
          <>
            <p className="text-center text-[10px] text-slate-500">{s.hours} ساعت بعد (اگر جواب داده باشد)</p>
            <ReplyBubble r={s.follow} />
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════ صفحه‌ی اصلی سازنده ═══════════════════════ */

export function RuleBuilder({
  accountId,
  rule,
  onClose,
  onSaved
}: {
  accountId: number
  rule?: Rule
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [s, setS] = useState<BuilderState>(() => (rule ? ruleToState(rule) : fresh()))
  const [kwInput, setKwInput] = useState('')
  const [review, setReview] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof BuilderState>(k: K, v: BuilderState[K]): void => setS((p) => ({ ...p, [k]: v }))
  const setCond = (k: keyof BuilderState['conds'], v: boolean): void => setS((p) => ({ ...p, conds: { ...p.conds, [k]: v } }))
  const post = s.conds.postAny || s.conds.postSpecific
  const compiled = useMemo(() => compile(s, accountId), [s, accountId])

  const addKw = (raw: string): void => {
    const parts = raw.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) return
    setS((p) => ({ ...p, keywords: [...new Set([...p.keywords, ...parts])], match: p.match === 'any' ? 'derivative' : p.match }))
    setKwInput('')
  }

  const apply = async (): Promise<void> => {
    if (!compiled.rule) return
    setSaving(true)
    const res = await call('saveRule', { rule: compiled.rule })
    setSaving(false)
    if (res) {
      toasts.push('success', 'کامنت هوشمند «' + res.name + '» فعال شد')
      onSaved()
    }
  }

  // در body رسم می‌شود: صفحه‌ها انیمیشن transform دارند و fixed داخلشان به همان قاب محدود می‌شد
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0b13] text-slate-100" dir="rtl">
      {/* نوار بالا */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <button type="button" onClick={onClose} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white" aria-label="بازگشت">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {rule ? 'ویرایش کامنت هوشمند' : 'کامنت هوشمند جدید'}
        </button>
        <button type="button" className="text-sm text-sky-400 hover:text-sky-300" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'بستن پیش نمایش' : 'پیش نمایش'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto px-5 pb-28 pt-5">
          <div className="mx-auto max-w-2xl space-y-7">
            {/* شرط برای */}
            <div className="space-y-2.5">
              <div>
                <h3 className="text-[15px] font-bold">شرط برای</h3>
                <p className="text-xs text-slate-500">می‌توانید یک یا چند گزینه رو انتخاب کنید</p>
              </div>
              <CheckRow checked={s.conds.postSpecific} onChange={(v) => setS((p) => ({ ...p, conds: { ...p.conds, postSpecific: v, postAny: v ? false : p.conds.postAny } }))} label="یک یا چند پست خاص یا ریل" />
              {s.conds.postSpecific && <PostPicker accountId={accountId} selected={s.mediaIds} onChange={(ids) => set('mediaIds', ids)} />}
              <CheckRow checked={s.conds.postAny} onChange={(v) => setS((p) => ({ ...p, conds: { ...p.conds, postAny: v, postSpecific: v ? false : p.conds.postSpecific } }))} label="هر پستی" />
              <CheckRow checked={s.conds.storySpecific} onChange={(v) => setS((p) => ({ ...p, conds: { ...p.conds, storySpecific: v, storyAny: v ? false : p.conds.storyAny } }))} label="یک یا چند استوری خاص" />
              {s.conds.storySpecific && <StoryPicker accountId={accountId} selected={s.storyIds} onChange={(ids) => set('storyIds', ids)} />}
              <CheckRow checked={s.conds.storyAny} onChange={(v) => setS((p) => ({ ...p, conds: { ...p.conds, storyAny: v, storySpecific: v ? false : p.conds.storySpecific } }))} label="همه‌ی استوری‌ها" />
              <CheckRow checked={s.conds.dm} onChange={(v) => setCond('dm', v)} label="مستقیم در دایرکت (با تعریف کلمه کلیدی)" />
            </div>

            {/* شرط را مشخص کنید */}
            <div className="space-y-2.5">
              <h3 className="text-[15px] font-bold">شرط را مشخص کنید</h3>
              <label className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-4 py-3.5">
                <span className="shrink-0 text-sm text-slate-400">شرط</span>
                <select className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none" value={s.match} onChange={(e) => set('match', e.target.value as MatchKind)}>
                  {(Object.keys(MATCH_INFO) as MatchKind[]).map((k) => (
                    <option key={k} value={k} className="bg-[#16131f]">
                      {MATCH_INFO[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl bg-black/30 p-4 text-[13px] leading-7">
                <div className="flex justify-between">
                  <span>کلمات کلیدی: {MATCH_INFO[s.match].kw}</span>
                  <span className="text-slate-500">مثال</span>
                </div>
                <p className="mt-2 flex items-start justify-between gap-3">
                  <span>
                    <b>قابل قبول:</b> {MATCH_INFO[s.match].ok}
                  </span>
                  <span className="text-emerald-400">✓</span>
                </p>
                {MATCH_INFO[s.match].no && (
                  <p className="mt-1 flex items-start justify-between gap-3">
                    <span>
                      <b>غیر قابل قبول:</b> {MATCH_INFO[s.match].no}
                    </span>
                    <span className="text-rose-400">✕</span>
                  </p>
                )}
                {s.match === 'derivative' && (
                  <p className="mt-2 text-[12px] text-slate-400">
                    ⓘ بهتر است مشتقات کلمات، حتی غلط املایی‌هایی که ممکن است کاربرانتان داشته باشند را پیش‌بینی کنید. «۱» و «1» یکی حساب می‌شوند.
                  </p>
                )}
              </div>

              {s.match !== 'any' && (
                <div className="rounded-2xl bg-white/[0.045] p-3">
                  <div className="flex items-center gap-2 rounded-xl bg-black/30 px-3">
                    <input
                      className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                      value={kwInput}
                      placeholder="کلمات را وارد کنید و پلاس رو فشار دهید"
                      onChange={(e) => setKwInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addKw(kwInput)
                        }
                      }}
                    />
                    <button type="button" className="text-2xl text-slate-200 hover:text-white" aria-label="افزودن کلمه" onClick={() => addKw(kwInput)}>
                      +
                    </button>
                  </div>
                  {s.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.keywords.map((k) => (
                        <span key={k} className="flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-[13px]">
                          {k}
                          <button type="button" className="text-slate-400 hover:text-white" onClick={() => set('keywords', s.keywords.filter((x) => x !== k))} aria-label={'حذف ' + k}>
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[12px] text-slate-500">یک یا چند کلمه‌ی خاص مرتبط با پست موردنظرتون مانند قیمت، اطلاعات، خرید و… انتخاب کنید.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESET.keywords.filter((k) => !s.keywords.includes(k)).map((k) => (
                      <button key={k} type="button" className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] text-slate-300 hover:border-violet-400/50" onClick={() => addKw(k)}>
                        + {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* پاسخ دریافتی کاربران */}
            <Section title="پاسخ دریافتی کاربران">
              <ReplyEditor r={s.reply} set={(r) => set('reply', r)} kinds={['text', 'buttons', 'media', 'catalog', 'form']} presets={PRESET.dm} />
            </Section>

            {/* گزینه‌های تعامل */}
            <div className="space-y-3">
              <h3 className="text-[15px] font-bold">گزینه‌هایی برای افزایش تعامل با مخاطبان</h3>

              {post && (
                <div className="rounded-2xl bg-white/[0.045] p-4">
                  <Switch checked={s.publicOn} onChange={(v) => set('publicOn', v)} label="با جواب دادن به کامنت‌ها زیر پست یا ریل، بیشتر دیده میشی" />
                  {s.publicOn && (
                    <div className="mt-3 space-y-2">
                      {s.publicReplies.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl bg-black/30 px-4 py-3">
                          <input
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            value={t}
                            maxLength={1000}
                            onChange={(e) => set('publicReplies', s.publicReplies.map((x, j) => (j === i ? e.target.value : x)))}
                          />
                          <span className="tabular text-[11px] text-slate-500">{t.length}/1000</span>
                          <button type="button" aria-label="حذف" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black" onClick={() => set('publicReplies', s.publicReplies.filter((_, j) => j !== i))}>
                            ✕
                          </button>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-500">هر بار یکی از این‌ها تصادفی انتخاب می‌شود تا جواب‌ها تکراری نباشند.</p>
                      <button
                        type="button"
                        className="text-sm text-violet-300"
                        onClick={() => {
                          const next = PRESET.publicReplies.find((p) => !s.publicReplies.includes(p))
                          set('publicReplies', [...s.publicReplies, next ?? ''])
                        }}
                      >
                        + افزودن پاسخ‌های دیگر
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-white/[0.045] p-4">
                <Switch checked={s.gateOn} onChange={(v) => set('gateOn', v)} label="با فعال‌سازی درخواست فالو برای دریافت پاسخ، مخاطبا بیشتر درگیر میشن" />
                {s.gateOn && (
                  <div className="mt-3">
                    <TextBox value={s.gateText} onChange={(v) => set('gateText', v)} rows={3} />
                    <Presets items={PRESET.gate} onPick={(v) => set('gateText', v)} />
                    <p className="hint">اینستاگرام خبر فالو را به اپ نمی‌دهد؛ برای همین در پیام بگویید بعد از فالو دوباره همان کلمه را بفرستد.</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white/[0.045] p-4">
                <Switch checked={s.followOn} onChange={(v) => set('followOn', v)} label="با فعال‌سازی درخواست پیگیری، پیام پیگیری خودکار ارسال میشه و تعاملت زیاد میشه" />
                {s.followOn && (
                  <div className="mt-4 space-y-4">
                    <ReplyEditor r={s.follow} set={(r) => set('follow', r)} kinds={['text', 'buttons', 'media', 'catalog']} presets={PRESET.followUp} />
                    <div className="rounded-xl bg-black/25 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          زمان ارسال <span className="text-slate-500">(اجباری)</span>
                        </span>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {HOURS.map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => set('hours', h)}
                              className={'rounded-full border px-3 py-1.5 text-xs ' + (s.hours === h ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-violet-400/30 text-violet-200')}
                            >
                              🕒 {h} ساعت بعد
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-[12px] text-slate-400">
                        پیام پیگیری باید در زمانی مشخص ارسال شود. اینستاگرام فقط تا ۲۴ ساعت بعد از آخرین پیام خود مخاطب اجازه‌ی پیام می‌دهد، پس حداکثر ۲۳ ساعت؛ و فقط به کسانی می‌رسد که در این فاصله جواب داده یا دکمه‌ای را زده باشند.
                      </p>
                      {!s.hours && <p className="mt-2 text-sm font-bold">لطفا زمان ارسال را انتخاب کنید</p>}
                    </div>
                  </div>
                )}
              </div>

              <details className="rounded-2xl bg-white/[0.03] p-4 text-sm">
                <summary className="cursor-pointer text-slate-400">تنظیمات بیشتر (اختیاری)</summary>
                <div className="mt-3 space-y-3">
                  <input className="input" value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="اسم (اختیاری) — خالی بماند، خودکار ساخته می‌شود" />
                  <Switch checked={s.oncePerUser} onChange={(v) => set('oncePerUser', v)} label="هر کس فقط یک بار جواب بگیرد" />
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs text-slate-400">
                      کمترین تأخیر (ثانیه)
                      <input className="input mt-1" type="number" min={0} value={s.delay_min} onChange={(e) => set('delay_min', Number(e.target.value))} />
                    </label>
                    <label className="text-xs text-slate-400">
                      بیشترین تأخیر
                      <input className="input mt-1" type="number" min={0} value={s.delay_max} onChange={(e) => set('delay_max', Number(e.target.value))} />
                    </label>
                    <label className="text-xs text-slate-400">
                      اولویت
                      <input className="input mt-1" type="number" value={s.priority} onChange={(e) => set('priority', Number(e.target.value))} />
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </main>

        {showPreview && (
          <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-black/20 p-6 lg:block">
            <p className="mb-4 text-center text-xs text-slate-500">پیش نمایش — همان چیزی که مخاطب می‌بیند</p>
            <Preview s={s} />
          </aside>
        )}
      </div>

      {/* دکمه‌ی پایین */}
      <footer className="absolute inset-x-0 bottom-0 border-t border-white/[0.08] bg-[#0d0b13]/95 px-5 py-4 backdrop-blur">
        <button
          type="button"
          className="mx-auto block w-full max-w-2xl rounded-2xl bg-white py-4 text-[15px] font-medium text-slate-900 hover:bg-slate-100"
          onClick={() => {
            if (compiled.error) toasts.push('warn', compiled.error)
            else setReview(true)
          }}
        >
          چیدمان، پیش نمایش و اعمال کامنت هوشمند
        </button>
      </footer>

      {review && compiled.rule && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="پیش نمایش و اعمال">
          <div className="grid max-h-full w-full max-w-3xl gap-6 overflow-y-auto rounded-3xl bg-[#16131f] p-6 md:grid-cols-[1fr_300px]">
            <div className="space-y-3 text-sm">
              <h3 className="text-lg font-bold">آماده‌ی اعمال</h3>
              <Summary s={s} />
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-primary" disabled={saving} onClick={() => void apply()}>
                  {saving ? 'در حال اعمال…' : rule ? 'ذخیره‌ی تغییرات' : 'اعمال و فعال‌سازی'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setReview(false)}>
                  برگشت و ویرایش
                </button>
              </div>
            </div>
            <Preview s={s} />
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

function Summary({ s }: { s: BuilderState }): JSX.Element {
  const where: string[] = []
  if (s.conds.postAny) where.push('کامنت زیر هر پست')
  if (s.conds.postSpecific) where.push('کامنت زیر ' + s.mediaIds.length + ' پست انتخاب‌شده')
  if (s.conds.storyAny) where.push('جواب به همه‌ی استوری‌ها')
  if (s.conds.storySpecific) where.push('جواب به ' + s.storyIds.length + ' استوری انتخاب‌شده')
  if (s.conds.dm) where.push('پیام در دایرکت')
  const rows: [string, string][] = [
    ['کجا', where.join('، ')],
    ['کلمه‌ها', s.match === 'any' ? 'هر متنی' : s.keywords.join('، ') + ' — ' + MATCH_INFO[s.match].label],
    ['جواب', KIND_LABEL[s.reply.kind]],
    ['جواب زیر کامنت', (s.conds.postAny || s.conds.postSpecific) && s.publicOn ? s.publicReplies.filter(Boolean).length + ' متن، تصادفی' : 'خاموش'],
    ['اول فالو کن', s.gateOn ? 'روشن' : 'خاموش'],
    ['پیگیری', s.followOn && s.hours ? s.hours + ' ساعت بعد — ' + KIND_LABEL[s.follow.kind] : 'خاموش'],
    ['هر نفر', s.oncePerUser ? 'فقط یک بار' : 'هر بار']
  ]
  return (
    <dl className="divide-y divide-white/[0.06] rounded-xl bg-black/20">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 px-4 py-2.5">
          <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
          <dd className="text-slate-200">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
