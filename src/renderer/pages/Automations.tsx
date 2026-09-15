import { useCallback, useEffect, useState } from 'react'
import type { MatchMode, Rule, RuleAction, TriggerType } from '../../shared/types'
import { Card, EmptyState, Field, Modal, Notice, Select, Spinner, Toggle } from '../components/ui'
import { call, fmtFull, toasts } from '../lib/api'

const TRIGGERS: { value: TriggerType; label: string; desc: string }[] = [
  {
    value: 'comment_keyword',
    label: 'کامنت با کلیدواژه یا عدد',
    desc: 'کسی روی پست کامنت می‌گذارد که شامل کلیدواژه/عدد شماست → دایرکت می‌گیرد'
  },
  {
    value: 'comment_any',
    label: 'هر کامنتی',
    desc: 'به هر کامنتی روی پست‌های انتخابی واکنش می‌دهد (مراقب باشید، حجم بالا می‌رود)'
  },
  {
    value: 'dm_keyword',
    label: 'کلیدواژه در دایرکت',
    desc: 'کسی در دایرکت کلیدواژه می‌فرستد → پاسخ خودکار می‌گیرد'
  },
  {
    value: 'new_follower',
    label: 'فالوور جدید',
    desc: 'کسی شما را فالو می‌کند → پیام خوشامد می‌گیرد (نیازمند موتور Session)'
  },
  {
    value: 'new_post',
    label: 'پست جدید گذاشتم',
    desc: 'پست جدید منتشر می‌شود → به فالوورها/فالووینگ اطلاع داده می‌شود (نیازمند موتور Session)'
  }
]

const MATCH_MODES: { value: MatchMode; label: string }[] = [
  { value: 'number', label: 'عدد (فقط اگر همان عدد را تنها بنویسد)' },
  { value: 'contains', label: 'شامل کلمه باشد' },
  { value: 'exact', label: 'کاملاً برابر باشد' },
  { value: 'starts_with', label: 'با آن شروع شود' },
  { value: 'regex', label: 'عبارت باقاعده (regex)' }
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
          <button className="btn-primary btn-sm" onClick={() => setDraft(emptyDraft(accountId))}>
            + قانون جدید
          </button>
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

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={d.id ? 'ویرایش قانون' : 'قانون جدید'}
      subtitle="تریگر تعیین می‌کند کِی اجرا شود، اکشن‌ها تعیین می‌کنند چه کاری انجام شود"
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
        <Field label="نام قانون" hint="فقط برای خودتان — در اینستاگرام دیده نمی‌شود">
          <input
            className="input"
            value={d.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="مثلاً: عدد ۱ → لینک صفحه‌ی محصول"
          />
        </Field>

        <Field label="تریگر (چه زمانی اجرا شود)">
          <Select
            value={(d.trigger_type ?? 'comment_keyword') as TriggerType}
            onChange={(v) => set('trigger_type', v)}
            options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))}
          />
          <p className="hint">{TRIGGERS.find((t) => t.value === d.trigger_type)?.desc}</p>
        </Field>

        {(isNewFollower || isNewPost) && (
          <Notice tone="warn" title="این تریگر به موتور Session نیاز دارد">
            API رسمی اینستاگرام نه رویداد «فالوور جدید» دارد و نه اجازه‌ی دایرکت انبوه می‌دهد. برای این
            قانون باید در تنظیمات، موتور Session را روشن و حساب را با نام کاربری و رمز وصل کنید.
          </Notice>
        )}

        {needsKeywords && (
          <>
            <Field label="حالت تطبیق">
              <Select
                value={(d.match_mode ?? 'number') as MatchMode}
                onChange={(v) => set('match_mode', v)}
                options={MATCH_MODES}
              />
            </Field>

            <Field
              label="کلیدواژه‌ها یا اعداد"
              hint="با کاما جدا کنید. ارقام فارسی و عربی خودکار تبدیل می‌شوند — «۱» و «1» یکی حساب می‌شوند. «كد» با ك عربی هم با «کد» تطبیق می‌دهد."
            >
              <input
                className="input"
                value={d.keywords ?? ''}
                onChange={(e) => set('keywords', e.target.value)}
                placeholder="1, یک, قیمت"
              />
            </Field>
          </>
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

        {/* ───── اکشن‌ها ───── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">اکشن‌ها (به ترتیب اجرا)</label>
            <div className="flex gap-1.5">
              <button className="btn-ghost btn-sm" onClick={() => addAction('send_dm')}>
                + دایرکت
              </button>
              <button className="btn-ghost btn-sm" onClick={() => addAction('reply_comment')}>
                + پاسخ کامنت
              </button>
              <button className="btn-ghost btn-sm" onClick={() => addAction('wait')}>
                + صبر
              </button>
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
                      ? 'ارسال دایرکت'
                      : a.type === 'reply_comment'
                        ? 'پاسخ عمومی به کامنت'
                        : 'صبر کردن'}
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
                      متغیرها: <code className="text-fuchsia-300">{'{{username}}'}</code>{' '}
                      <code className="text-fuchsia-300">{'{{name}}'}</code>{' '}
                      <code className="text-fuchsia-300">{'{{post_link}}'}</code> — و برای تنوع متن:{' '}
                      <code className="text-fuchsia-300">{'{سلام|درود}'}</code> یکی را تصادفی
                      انتخاب می‌کند
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ───── تنظیمات رفتار ───── */}
        <div className="rounded-lg border border-white/[0.07] p-3">
          <Toggle
            checked={d.once_per_user !== false}
            onChange={(v) => set('once_per_user', v)}
            label="هر کاربر فقط یک بار پاسخ بگیرد"
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
            تست قانون — بدون ارسال هیچ پیامی
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
    </Modal>
  )
}
