import { useCallback, useEffect, useState } from 'react'
import type { MatchMode, Rule, RuleAction, TriggerType } from '../../shared/types'
import { Card, EmptyState, Field, Modal, Notice, Select, Spinner, Toggle } from '../components/ui'
import { call, callRaw, fmtFull, toasts } from '../lib/api'
import type { AiSettingsView } from '../../shared/ipc'

const TRIGGERS: { value: TriggerType; label: string; desc: string }[] = [
  {
    value: 'comment_keyword',
    label: 'کامنت با یک کلمه یا عدد',
    desc: 'کسی زیر پستت کلمه یا عدد مشخصی کامنت می‌کند و دایرکت می‌گیرد'
  },
  { value: 'comment_any', label: 'هر کامنتی', desc: 'به هر کامنتی زیر پست‌هایت جواب می‌دهد' },
  { value: 'dm_keyword', label: 'کلمه در دایرکت', desc: 'کسی در دایرکت کلمه‌ی مشخصی می‌فرستد و جواب می‌گیرد' },
  { value: 'story_reply', label: 'جواب به استوری', desc: 'کسی به استوری‌ات جواب می‌دهد و دایرکت می‌گیرد' },
  { value: 'mention', label: 'منشن در استوری', desc: 'کسی تو را در استوری‌اش منشن می‌کند و تشکر می‌گیرد' },
  { value: 'new_follower', label: 'فالوور جدید', desc: 'کسی فالوات می‌کند و پیام خوشامد می‌گیرد' },
  { value: 'new_post', label: 'پست جدید گذاشتم', desc: 'وقتی پست جدید می‌گذاری، به فالوورهایت خبر داده می‌شود' }
]

/**
 * الگوهای آماده — ایده از CampaignCue و openinstadm. کاربر به‌جای فهمیدن
 * «تریگر» و «حالت تطبیق»، یک کارت با زبان ساده انتخاب می‌کند و فرم پر می‌شود.
 */
const TEMPLATES: { title: string; desc: string; icon: string; draft: Partial<Rule> }[] = [
  {
    icon: '💬',
    title: 'کامنت → دایرکت',
    desc: 'هر کس زیر پستت «۱» کامنت کند، لینک را در دایرکت می‌گیرد',
    draft: {
      name: 'کامنت ۱ → لینک',
      trigger_type: 'comment_keyword',
      match_mode: 'number',
      keywords: '1',
      actions: [
        { type: 'send_dm', order: 0, text: '{سلام|درود} {{username}} جان! این هم لینکی که خواستی: https://' },
        { type: 'reply_comment', order: 1, text: '{دایرکتت رو چک کن|برات فرستادم} 📩' }
      ]
    }
  },
  {
    icon: '✉️',
    title: 'کلمه در دایرکت',
    desc: 'هر کس در دایرکت «قیمت» بفرستد، جواب آماده می‌گیرد',
    draft: {
      name: 'قیمت در دایرکت',
      trigger_type: 'dm_keyword',
      match_mode: 'contains',
      keywords: 'قیمت',
      actions: [{ type: 'send_dm', order: 0, text: '{سلام|درود} {{username}}! قیمت‌ها اینجاست: https://' }]
    }
  },
  {
    icon: '📖',
    title: 'جواب به استوری',
    desc: 'هر کس به استوری‌ات جواب بدهد، پیام می‌گیرد',
    draft: {
      name: 'جواب استوری',
      trigger_type: 'story_reply',
      match_mode: 'contains',
      keywords: '',
      actions: [{ type: 'send_dm', order: 0, text: 'مرسی که جواب دادی {{username}} جان! 🌟' }]
    }
  },
  {
    icon: '🙌',
    title: 'تشکر از منشن',
    desc: 'هر کس تو را در استوری‌اش منشن کند، تشکر می‌گیرد',
    draft: {
      name: 'تشکر از منشن',
      trigger_type: 'mention',
      match_mode: 'contains',
      keywords: '',
      actions: [{ type: 'send_dm', order: 0, text: 'وای مرسی که منشنم کردی {{username}}! ❤️' }]
    }
  },
  {
    icon: '👋',
    title: 'خوشامد فالوور جدید',
    desc: 'هر کس فالوات کند، پیام خوشامد می‌گیرد',
    draft: {
      name: 'خوشامد',
      trigger_type: 'new_follower',
      match_mode: 'contains',
      keywords: '',
      actions: [
        {
          type: 'send_dm',
          order: 0,
          text: '{سلام|درود} {{username}}! خیلی خوشحالم که دنبالم کردی. پست‌های دیگرم را هم ببین 🌸'
        }
      ]
    }
  },
  {
    icon: '📣',
    title: 'خبر پست جدید',
    desc: 'وقتی پست می‌گذاری، به فالوورهایت دایرکت می‌رود',
    draft: {
      name: 'خبر پست جدید',
      trigger_type: 'new_post',
      match_mode: 'contains',
      keywords: 'followers',
      actions: [{ type: 'send_dm', order: 0, text: '{سلام|درود}! پست جدید گذاشتم، خوشحال می‌شوم ببینی: {{post_link}}' }]
    }
  }
]

const MATCH_MODES: { value: MatchMode; label: string }[] = [
  { value: 'number', label: 'عدد (فقط اگر همان عدد را تنها بنویسد)' },
  { value: 'contains', label: 'شامل کلمه باشد' },
  { value: 'exact', label: 'کاملاً برابر باشد' },
  { value: 'starts_with', label: 'با آن شروع شود' },
  { value: 'regex', label: 'الگوی پیشرفته' }
]

const AUDIENCES = [
  { value: 'followers', label: 'فالوورهای من' },
  { value: 'following', label: 'کسانی که فالو کرده‌ام' },
  { value: 'mutual', label: 'فالوور متقابل' },
  { value: 'engaged_24h', label: 'کسانی که در ۲۴ ساعت اخیر پیام دادند (بی‌ریسک)' }
]

type Draft = Partial<Rule> & { account_id: number }

function emptyDraft(accountId: number): Draft {
  return {
    account_id: accountId,
    name: '',
    enabled: true,
    trigger_type: 'comment_keyword',
    match_mode: 'number',
    keywords: '',
    case_sensitive: false,
    media_scope: null,
    once_per_user: true,
    delay_min: 8,
    delay_max: 45,
    priority: 0,
    actions: [{ type: 'send_dm', text: '', order: 0 }]
  }
}

export function AutomationsPage({ accountId }: { accountId: number | null }): JSX.Element {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false)
      return
    }
    const r = await call('listRules', { accountId })
    if (r) setRules(r)
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  if (!accountId) {
    return (
      <Card>
        <EmptyState title="اول یک حساب وصل کنید" body="قوانین به حساب گره خورده‌اند." />
      </Card>
    )
  }

  const toggle = async (rule: Rule): Promise<void> => {
    const res = await call('toggleRule', { ruleId: rule.id, enabled: !rule.enabled })
    if (res) {
      toasts.push('success', 'قانون «' + rule.name + '» ' + (!rule.enabled ? 'فعال' : 'غیرفعال') + ' شد')
      void load()
    }
  }

  const remove = async (rule: Rule): Promise<void> => {
    if (!confirm('قانون «' + rule.name + '» حذف شود؟ این کار قابل بازگشت نیست.')) return
    await call('deleteRule', { ruleId: rule.id })
    toasts.push('info', 'قانون حذف شد')
    void load()
  }

  return (
    <div className="space-y-5">
      <Card
        title="قوانین اتوماسیون"
        subtitle="هر قانون یک تریگر دارد و یک یا چند اکشن. قوانین با اولویت بالاتر اول بررسی می‌شوند."
        action={
          <div className="flex gap-2">
            {accountId && (
              <button
                className="btn-ghost btn-sm"
                title="دایرکت‌ها خودکار هر ۹۰ ثانیه خوانده می‌شوند؛ این دکمه همین الان می‌خواند"
                onClick={() => {
                  void callRaw('pollInboxNow', { accountId }).then((r) =>
                    r.ok
                      ? toasts.push('success', (r.data as { message?: string } | undefined)?.message ?? 'انجام شد')
                      : toasts.push('error', r.error ?? 'خواندن دایرکت ناموفق بود', r.hint)
                  )
                }}
              >
                بررسی دایرکت‌ها الان
              </button>
            )}
            <button className="btn-primary btn-sm" onClick={() => setDraft(emptyDraft(accountId))}>
              + قانون جدید
            </button>
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : rules.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="هنوز قانونی نساخته‌اید"
            body="پرکاربردترین حالت: کاربر عدد ۱ را کامنت می‌کند و لینک را در دایرکت می‌گیرد. با «قانون جدید» شروع کنید."
            action={
              <button className="btn-primary mt-1" onClick={() => setDraft(emptyDraft(accountId))}>
                ساخت اولین قانون
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th">قانون</th>
                  <th className="th">تریگر</th>
                  <th className="th">کلیدواژه</th>
                  <th className="th">اکشن‌ها</th>
                  <th className="th">اجرا</th>
                  <th className="th">وضعیت</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="row-hover">
                    <td className="td">
                      <p className="font-medium text-slate-100">{r.name}</p>
                      {r.priority !== 0 && (
                        <span className="chip-mute mt-1">اولویت {r.priority}</span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-400">
                      {TRIGGERS.find((t) => t.value === r.trigger_type)?.label ?? r.trigger_type}
                    </td>
                    <td className="td">
                      {r.keywords ? (
                        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-fuchsia-200">
                          {r.keywords}
                        </code>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-400">
                      {r.actions.length === 0
                        ? '—'
                        : r.actions
                            .map((a) =>
                              a.type === 'send_dm'
                                ? 'دایرکت'
                                : a.type === 'reply_comment'
                                  ? 'پاسخ کامنت'
                                  : a.type === 'wait'
                                    ? 'صبر'
                                    : a.type
                            )
                            .join(' → ')}
                    </td>
                    <td className="td tabular text-xs text-slate-400">{fmtFull(r.hit_count)} بار</td>
                    <td className="td">
                      <span className={r.enabled ? 'chip-ok' : 'chip-mute'}>
                        {r.enabled ? 'فعال' : 'خاموش'}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-ghost btn-sm" onClick={() => void toggle(r)}>
                          {r.enabled ? 'خاموش' : 'فعال'}
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setDraft({ ...r, account_id: accountId })}
                        >
                          ویرایش
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => void remove(r)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AiReplyCard />
      {accountId && <IceBreakersCard accountId={accountId} />}

      {draft && (
        <RuleEditor
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════ ویرایشگر قانون ═══════════════════════ */

function RuleEditor({
  draft,
  onClose,
  onSaved
}: {
  draft: Draft
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [d, setD] = useState<Draft>(draft)
  // قانون تازه اول با کارت‌های آماده شروع می‌شود، نه با یک فرم خالی
  const [picking, setPicking] = useState(!draft.id)
  const [saving, setSaving] = useState(false)
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<{ matched: boolean; reason: string; preview: string[] } | null>(null)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void => {
    setD((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  const actions = d.actions ?? []
  const setAction = (i: number, patch: Partial<RuleAction>): void => {
    const next = actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    set('actions', next)
  }
  const addAction = (type: RuleAction['type']): void => {
    set('actions', [...actions, { type, text: '', order: actions.length, seconds: type === 'wait' ? 10 : undefined }])
  }
  const removeAction = (i: number): void => {
    set(
      'actions',
      actions.filter((_, idx) => idx !== i).map((a, idx) => ({ ...a, order: idx }))
    )
  }

  const isNewPost = d.trigger_type === 'new_post'
  const isNewFollower = d.trigger_type === 'new_follower'
  const needsKeywords = d.trigger_type === 'comment_keyword' || d.trigger_type === 'dm_keyword'

  const save = async (): Promise<void> => {
    if (!d.name?.trim()) {
      toasts.push('warn', 'نام قانون را وارد کنید')
      return
    }
    if (needsKeywords && !d.keywords?.trim()) {
      toasts.push('warn', 'برای این تریگر حداقل یک کلیدواژه لازم است')
      return
    }
    if (actions.filter((a) => a.type !== 'wait').length === 0) {
      toasts.push('warn', 'حداقل یک اکشن (مثلاً ارسال دایرکت) اضافه کنید')
      return
    }
    if (actions.some((a) => a.type !== 'wait' && !a.text?.trim())) {
      toasts.push('warn', 'متن همه‌ی اکشن‌ها را پر کنید')
      return
    }

    setSaving(true)
    const res = await call('saveRule', { rule: d })
    setSaving(false)
    if (res) {
      toasts.push('success', 'قانون ذخیره شد')
      onSaved()
    }
  }

  const runTest = async (): Promise<void> => {
    if (!d.id) {
      toasts.push('info', 'اول قانون را ذخیره کنید، بعد می‌توانید تستش کنید')
      return
    }
    const r = await call('testRule', { ruleId: d.id, text: testText })
    if (r) setTestResult(r)
  }

  if (picking) {
    return (
      <Modal open wide onClose={onClose} title="چی می‌خوای خودکار بشه؟" subtitle="یکی را انتخاب کن — بعدش متن را عوض می‌کنی">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              onClick={() => {
                setD({ ...d, ...t.draft, actions: t.draft.actions?.map((a) => ({ ...a })) })
                setPicking(false)
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-right transition-colors hover:border-fuchsia-400/40 hover:bg-fuchsia-500/[0.06]"
            >
              <p className="text-2xl">{t.icon}</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-100">{t.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t.desc}</p>
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="rounded-xl border border-dashed border-white/[0.12] p-4 text-right text-slate-400 hover:text-slate-200"
          >
            <p className="text-2xl">✏️</p>
            <p className="mt-1.5 text-sm font-semibold">از صفر</p>
            <p className="mt-1 text-[11px]">خودم همه‌چیز را تنظیم می‌کنم</p>
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={d.id ? 'ویرایش قانون' : 'قانون جدید'}
      subtitle="متن پیام را به سلیقه‌ی خودت عوض کن و ذخیره کن"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            انصراف
          </button>
          <button className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'در حال ذخیره…' : 'ذخیره‌ی قانون'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="اسم" hint="فقط برای خودت — کسی نمی‌بیند">
          <input
            className="input"
            value={d.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="مثلاً: عدد ۱ → لینک صفحه‌ی محصول"
          />
        </Field>

        <Field label="کِی اجرا شود؟">
          <Select
            value={(d.trigger_type ?? 'comment_keyword') as TriggerType}
            onChange={(v) => set('trigger_type', v)}
            options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))}
          />
          <p className="hint">{TRIGGERS.find((t) => t.value === d.trigger_type)?.desc}</p>
        </Field>

        {(isNewFollower || isNewPost) && (
          <Notice tone="info" title="برای این یکی «ورود ساده» لازم است">
            اگر حسابت را با «ورود ساده» یا «کد نشست» وصل کرده‌ای، کار می‌کند.
          </Notice>
        )}

        {(needsKeywords || d.trigger_type === 'story_reply') && (
          <Field
            label={d.trigger_type === 'story_reply' ? 'کلمه (اختیاری)' : 'چه کلمه یا عددی؟'}
            hint={
              d.trigger_type === 'story_reply'
                ? 'خالی بگذار تا به هر جوابی پیام بدهد'
                : 'اگر چند تا است، با ویرگول جدا کن. «۱» و «1» یکی حساب می‌شوند.'
            }
          >
            <input
              className="input"
              value={d.keywords ?? ''}
              onChange={(e) => set('keywords', e.target.value)}
              placeholder="1, قیمت, لینک"
            />
          </Field>
        )}

        {isNewPost && (
          <Field label="این پیام به چه کسانی برود" hint="گیرندگان از لیست مخاطبان همگام‌شده انتخاب می‌شوند">
            <Select
              value={(d.keywords?.trim() || 'followers') as string}
              onChange={(v) => set('keywords', v)}
              options={AUDIENCES}
            />
          </Field>
        )}

        {/* ───── اکشن‌ها ───── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">چه پیامی برود؟</label>
            <div className="flex gap-1.5">
              <button className="btn-ghost btn-sm" onClick={() => addAction('send_dm')}>
                + دایرکت
              </button>
              {(d.trigger_type === 'comment_keyword' || d.trigger_type === 'comment_any') && (
                <button className="btn-ghost btn-sm" onClick={() => addAction('reply_comment')}>
                  + جواب زیر کامنت
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {actions.length === 0 && (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                هیچ اکشنی اضافه نشده
              </p>
            )}

            {actions.map((a, i) => (
              <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="chip-info">
                    {i + 1}.{' '}
                    {a.type === 'send_dm'
                      ? 'دایرکت'
                      : a.type === 'reply_comment'
                        ? 'جواب زیر کامنت'
                        : 'صبر'}
                  </span>
                  <button className="btn-danger btn-sm" onClick={() => removeAction(i)}>
                    حذف
                  </button>
                </div>

                {a.type === 'wait' ? (
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={3600}
                    value={a.seconds ?? 10}
                    onChange={(e) => setAction(i, { seconds: Number(e.target.value) })}
                    placeholder="ثانیه"
                  />
                ) : (
                  <>
                    <textarea
                      className="input min-h-[80px] resize-y"
                      value={a.text ?? ''}
                      onChange={(e) => setAction(i, { text: e.target.value })}
                      placeholder={
                        a.type === 'send_dm'
                          ? 'سلام {{username}} جان! {سلام|درود} — لینکی که خواستی: https://...'
                          : 'دایرکت رو چک کن 📩'
                      }
                    />
                    <p className="hint">
                      <code className="text-fuchsia-300">{'{{username}}'}</code> جای اسم طرف می‌نشیند.{' '}
                      <code className="text-fuchsia-300">{'{سلام|درود}'}</code> هر بار یکی را انتخاب
                      می‌کند تا پیام‌ها تکراری نباشند.
                    </p>
                    {a.type === 'send_dm' && (
                      <div className="mt-2 rounded-lg border border-white/[0.06] p-2.5">
                        <Toggle
                          checked={a.followGate !== undefined}
                          onChange={(v) =>
                            setAction(i, {
                              followGate: v ? 'اول فالوم کن، بعد دوباره همون کلمه رو بفرست تا برات بفرستم 🙏' : undefined
                            })
                          }
                          label="فقط به کسی که فالوم کرده"
                          hint="اگر فالو نکرده باشد، اول این پیام را می‌گیرد؛ بعد از فالو دوباره امتحان کند"
                        />
                        {a.followGate !== undefined && (
                          <textarea
                            className="input mt-2 min-h-[60px] resize-y"
                            value={a.followGate}
                            onChange={(e) => setAction(i, { followGate: e.target.value })}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* همه‌چیزِ تخصصی اینجا، بسته — بیشتر کاربرها هیچ‌وقت لازمش ندارند */}
        <details className="rounded-lg border border-white/[0.07] p-3">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
            تنظیمات بیشتر (اختیاری)
          </summary>
          <div className="mt-3 space-y-4">
            {needsKeywords && (
              <Field label="کلمه چطور مقایسه شود؟">
                <Select
                  value={(d.match_mode ?? 'contains') as MatchMode}
                  onChange={(v) => set('match_mode', v)}
                  options={MATCH_MODES}
                />
              </Field>
            )}
        {(d.trigger_type === 'comment_keyword' || d.trigger_type === 'comment_any') && (
              <Field
                label="محدود به پست‌های خاص (اختیاری)"
                hint="شناسه‌ی پست‌ها با کاما. خالی بگذارید تا روی همه‌ی پست‌ها اعمال شود. شناسه‌ها را در صفحه‌ی آنالیتیکس می‌بینید."
              >
                <input
                  className="input"
                  value={d.media_scope ?? ''}
                  onChange={(e) => set('media_scope', e.target.value || null)}
                  placeholder="خالی = همه‌ی پست‌ها"
                />
              </Field>
            )}
    
    
            <button className="btn-ghost btn-sm" onClick={() => addAction('wait')}>
              + صبر بین پیام‌ها
            </button>
        {/* ───── تنظیمات رفتار ───── */}
        <div className="rounded-lg border border-white/[0.07] p-3">
          <Toggle
            checked={d.once_per_user !== false}
            onChange={(v) => set('once_per_user', v)}
            label="هر کس فقط یک بار جواب بگیرد"
            hint="اگر خاموش کنید، کاربری که چند بار کامنت بگذارد چند بار دایرکت می‌گیرد — که معمولاً آزاردهنده است"
          />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="کمترین تأخیر (ثانیه)" hint="پاسخ فوری، نشانه‌ی ربات است">
              <input
                className="input"
                type="number"
                min={0}
                value={d.delay_min ?? 8}
                onChange={(e) => set('delay_min', Number(e.target.value))}
              />
            </Field>
            <Field label="بیشترین تأخیر (ثانیه)">
              <input
                className="input"
                type="number"
                min={0}
                value={d.delay_max ?? 45}
                onChange={(e) => set('delay_max', Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="اولویت" hint="اگر چند قانون با یک کامنت تطبیق دهند، بالاترین اولویت برنده می‌شود">
            <input
              className="input"
              type="number"
              value={d.priority ?? 0}
              onChange={(e) => set('priority', Number(e.target.value))}
            />
          </Field>
        </div>

        {/* ───── تستر ───── */}
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
          <p className="mb-2 text-xs font-medium text-sky-200">
            امتحان کن — هیچ پیامی واقعاً فرستاده نمی‌شود
          </p>
          <div className="flex gap-2">
            <input
              className="input"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="متن کامنت را اینجا بنویسید، مثلاً: ۱"
            />
            <button className="btn-ghost shrink-0" onClick={() => void runTest()}>
              تست
            </button>
          </div>
          {!d.id && (
            <p className="hint">برای تست، اول قانون را ذخیره کنید.</p>
          )}
          {testResult && (
            <div className="rise mt-3 space-y-2">
              <p className={testResult.matched ? 'chip-ok' : 'chip-err'}>
                {testResult.matched ? '✓ تطبیق یافت' : '✕ تطبیق نیافت'}
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">{testResult.reason}</p>
              {testResult.matched && testResult.preview.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-400">پیامی که ارسال می‌شود:</p>
                  {testResult.preview.map((p, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-wrap rounded-lg bg-[#0b0f17] px-3 py-2 text-xs leading-relaxed text-slate-200"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
          </div>
        </details>
      </div>
    </Modal>
  )
}


/**
 * جواب هوشمند (ایده از InstaAuto): وقتی هیچ قانونی به یک دایرکت نخورد، به‌جای
 * سکوت یک جواب کوتاه بر اساس توضیحی که خودت درباره‌ی کارت نوشته‌ای می‌رود.
 */
function AiReplyCard(): JSX.Element {
  const [s, setS] = useState<AiSettingsView | null>(null)
  const [info, setInfo] = useState('')
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [testText, setTestText] = useState('')
  const [testOut, setTestOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void call('getAiSettings').then((v) => {
      if (!v) return
      setS(v)
      setInfo(v.businessInfo)
      setBaseUrl(v.baseUrl)
    })
  }, [])

  const save = async (patch: Parameters<typeof call<'setAiSettings'>>[1]): Promise<void> => {
    const v = await call('setAiSettings', patch)
    if (v) {
      setS(v)
      toasts.push('success', 'ذخیره شد')
    }
  }

  if (!s) return <></>

  return (
    <Card
      title="🤖 جواب هوشمند"
      subtitle="اگر کسی دایرکتی داد که هیچ قانونی برایش نیست، هوش مصنوعی از طرف تو جواب کوتاه می‌دهد"
    >
      <div className="space-y-4">
        <Toggle
          checked={s.enabled}
          onChange={(v) => {
            if (v && (!s.hasKey || !info.trim())) {
              toasts.push('warn', 'اول توضیح کارت و کلید را وارد کن و ذخیره بزن')
              return
            }
            void save({ enabled: v })
          }}
          label={s.enabled ? 'روشن است' : 'خاموش است'}
        />

        <Field label="درباره‌ی کارت بنویس" hint="چه می‌فروشی، قیمت‌ها، لینک‌ها، ساعت کاری. فقط از همین‌ها جواب می‌دهد و چیزی از خودش نمی‌سازد.">
          <textarea
            className="input min-h-[110px] resize-y"
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder="مثلا: فروشگاه لباس زنانه. ارسال به همه‌ی شهرها ۲ تا ۴ روز. سفارش از سایت: https://… پاسخگویی ۹ صبح تا ۹ شب."
          />
        </Field>

        <Field
          label="کلید"
          hint={s.hasKey ? 'کلید ذخیره شده است. برای عوض کردن، کلید تازه را بنویس.' : 'کلید API انتروپیک (Claude) — از console.anthropic.com'}
        >
          <input
            className="input"
            dir="ltr"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={s.hasKey ? '••••••••' : 'sk-ant-…'}
          />
        </Field>

        <details>
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
            از ایران وصل نمی‌شود؟
          </summary>
          <Field label="آدرس واسط" hint="آدرس یک واسطِ سازگار با API انتروپیک. خالی = آدرس اصلی.">
            <input className="input" dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </details>

        <button
          className="btn-primary"
          onClick={() => {
            void save({ businessInfo: info, baseUrl, ...(key.trim() ? { apiKey: key.trim() } : {}) }).then(() => setKey(''))
          }}
        >
          ذخیره
        </button>

        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
          <p className="mb-2 text-xs font-medium text-sky-200">امتحان کن — چیزی فرستاده نمی‌شود</p>
          <div className="flex gap-2">
            <input className="input" value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="مثلا: سلام، ارسال به شیراز دارید؟" />
            <button
              className="btn-ghost shrink-0"
              disabled={busy || !testText.trim()}
              onClick={() => {
                setBusy(true)
                setTestOut(null)
                void callRaw('testAiReply', { text: testText }).then((r) => {
                  setBusy(false)
                  if (r.ok) setTestOut((r.data as { reply: string | null }).reply ?? '(جوابی نساخت)')
                  else toasts.push('error', r.error ?? 'امتحان ناموفق بود', r.hint)
                })
              }}
            >
              {busy ? '…' : 'امتحان'}
            </button>
          </div>
          {testOut && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#0b0f17] px-3 py-2 text-xs leading-relaxed text-slate-200">
              {testOut}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * سوال‌های آماده (Ice Breakers، ایده از InstaAuto) — دکمه‌هایی که کسی موقع
 * باز کردن دایرکت می‌بیند. ضربه روی هر سوال یک دایرکت معمولی است، پس قوانین
 * «کلمه در دایرکت» یا جواب هوشمند جوابش را می‌دهند.
 */
function IceBreakersCard({ accountId }: { accountId: number }): JSX.Element {
  const [qs, setQs] = useState<string[]>(['', '', '', ''])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void call('getIceBreakers', { accountId }).then((v) => {
      if (v) setQs([...v, '', '', '', ''].slice(0, 4))
    })
  }, [accountId])

  return (
    <Card
      title="❓ سوال‌های آماده‌ی دایرکت"
      subtitle="وقتی کسی برای اولین بار دایرکتت را باز می‌کند، این سوال‌ها را به شکل دکمه می‌بیند"
    >
      <div className="space-y-2">
        {qs.map((q, i) => (
          <input
            key={i}
            className="input"
            value={q}
            maxLength={80}
            onChange={(e) => setQs(qs.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={['قیمت‌ها چنده؟', 'ارسال دارید؟', 'چطور سفارش بدم؟', 'ساعت کاری؟'][i]}
          />
        ))}
        <p className="hint">
          برای هر سوال یک قانون «کلمه در دایرکت» بساز، یا جواب هوشمند را روشن کن. فقط با اتصال «API رسمی» کار می‌کند.
        </p>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void callRaw('setIceBreakers', { accountId, questions: qs }).then((r) => {
              setBusy(false)
              if (r.ok) toasts.push('success', 'سوال‌ها در اینستاگرام ذخیره شد')
              else toasts.push('error', r.error ?? 'ذخیره نشد', r.hint)
            })
          }}
        >
          {busy ? 'در حال ذخیره…' : 'ذخیره در اینستاگرام'}
        </button>
      </div>
    </Card>
  )
}
