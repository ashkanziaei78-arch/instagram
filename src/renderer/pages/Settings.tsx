import { useEffect, useState } from 'react'
import type { SafetySettings } from '../../shared/types'
import type { MetaAppConfig } from '../../shared/ipc'
import { Card, Field, Notice, Spinner, Toggle } from '../components/ui'
import { call, toasts } from '../lib/api'

export function SettingsPage({ hasGraphAccount }: { hasGraphAccount: boolean }): JSX.Element {
  const [safety, setSafety] = useState<SafetySettings | null>(null)
  const [meta, setMeta] = useState<MetaAppConfig>({})
  const [session, setSession] = useState({ enabled: false, libraryAvailable: false })
  const [info, setInfo] = useState<{ version: string; userData: string; encryptionAvailable: boolean } | null>(null)
  const [webhookPort, setWebhookPort] = useState(8787)
  const [webhookOn, setWebhookOn] = useState(false)
  const [pollersOn, setPollersOn] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [s, m, se, i, d] = await Promise.all([
        call('getSafety'),
        call('getMetaApp'),
        call('getSessionEngineEnabled'),
        call('appInfo'),
        call('dashboard', { accountId: 0 })
      ])
      if (s) setSafety(s)
      if (m) setMeta(m)
      if (se) setSession(se)
      if (i) setInfo(i)
      if (d) {
        setWebhookOn(d.webhook.running)
        setPollersOn(d.pollers)
        if (d.webhook.port) setWebhookPort(d.webhook.port)
      }
      setLoading(false)
    })()
  }, [])

  if (loading || !safety) return <Spinner />

  const patchSafety = async (patch: Partial<SafetySettings>): Promise<void> => {
    const next = await call('setSafety', { settings: patch })
    if (next) setSafety(next)
  }

  const saveMeta = async (): Promise<void> => {
    await call('setMetaApp', { config: meta })
    toasts.push('success', 'تنظیمات اپ متا ذخیره شد')
    const m = await call('getMetaApp')
    if (m) setMeta(m)
  }

  const toggleWebhook = async (on: boolean): Promise<void> => {
    if (on) {
      const r = await call('startWebhook', { port: webhookPort })
      if (r) {
        setWebhookOn(true)
        toasts.push('success', 'وبهوک روشن شد — ' + r.message)
      }
    } else {
      await call('stopWebhook')
      setWebhookOn(false)
      toasts.push('info', 'وبهوک خاموش شد')
    }
  }

  const togglePollers = async (on: boolean): Promise<void> => {
    await call('setPollers', { enabled: on })
    setPollersOn(on)
    toasts.push('info', on ? 'نظرسنجی دوره‌ای روشن شد' : 'نظرسنجی دوره‌ای خاموش شد')
  }

  return (
    <div className="space-y-5">
      {/* ═══════ ایمنی ═══════ */}
      <Card
        title="محدودیت‌های ایمنی"
        subtitle="مهم‌ترین بخش تنظیمات. این اعداد تفاوت بین «کار می‌کند» و «حساب محدود می‌شود» است."
      >
        <Notice tone="warn" title="چرا سقف‌ها را بالا نبرید">
          اینستاگرام حجم را نمی‌بیند، <em>الگو</em> را می‌بیند. ۵۰ دایرکت پخش‌شده در روز مشکلی ندارد؛
          همان ۵۰ عدد در ۱۰ دقیقه، تقریباً همیشه به محدودیت می‌خورد. اگر حسابتان تازه است، اعداد
          پیش‌فرض را کم هم بکنید.
        </Notice>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="سقف دایرکت در روز" hint="پیش‌فرض محافظه‌کارانه: ۵۰">
            <input
              className="input tabular"
              type="number"
              min={1}
              max={500}
              value={safety.dailyDmCap}
              onChange={(e) => void patchSafety({ dailyDmCap: Number(e.target.value) })}
            />
          </Field>
          <Field label="سقف پاسخ کامنت در روز">
            <input
              className="input tabular"
              type="number"
              min={1}
              max={1000}
              value={safety.dailyCommentReplyCap}
              onChange={(e) => void patchSafety({ dailyCommentReplyCap: Number(e.target.value) })}
            />
          </Field>
          <Field label="سقف فالو در روز">
            <input
              className="input tabular"
              type="number"
              min={0}
              max={200}
              value={safety.dailyFollowCap}
              onChange={(e) => void patchSafety({ dailyFollowCap: Number(e.target.value) })}
            />
          </Field>
          <Field label="کمترین فاصله بین اکشن‌ها (ثانیه)" hint="در ارسال گروهی استفاده می‌شود">
            <input
              className="input tabular"
              type="number"
              min={5}
              value={safety.minActionDelaySec}
              onChange={(e) => void patchSafety({ minActionDelaySec: Number(e.target.value) })}
            />
          </Field>
          <Field label="بیشترین فاصله بین اکشن‌ها (ثانیه)">
            <input
              className="input tabular"
              type="number"
              min={5}
              value={safety.maxActionDelaySec}
              onChange={(e) => void patchSafety({ maxActionDelaySec: Number(e.target.value) })}
            />
          </Field>
          <Field label="طول دوره‌ی گرم‌کردن (روز)" hint="حساب تازه با سقف کمتر شروع می‌کند">
            <input
              className="input tabular"
              type="number"
              min={0}
              max={30}
              value={safety.warmupDays}
              onChange={(e) => void patchSafety({ warmupDays: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-2 divide-y divide-white/[0.06]">
          <Toggle
            checked={safety.warmupEnabled}
            onChange={(v) => void patchSafety({ warmupEnabled: v })}
            label="دوره‌ی گرم‌کردن"
            hint="روز اول با ۲۰٪ سقف شروع و تا پایان دوره خطی بالا می‌رود"
          />
          <Toggle
            checked={safety.quietHoursEnabled}
            onChange={(v) => void patchSafety({ quietHoursEnabled: v })}
            label="ساعات سکوت"
            hint="شب هیچ پیامی ارسال نمی‌شود — هم طبیعی‌تر است، هم مخاطب را اذیت نمی‌کند"
          />
        </div>

        {safety.quietHoursEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field label="شروع سکوت (ساعت)">
              <input
                className="input tabular"
                type="number"
                min={0}
                max={23}
                value={safety.quietStartHour}
                onChange={(e) => void patchSafety({ quietStartHour: Number(e.target.value) })}
              />
            </Field>
            <Field label="پایان سکوت (ساعت)">
              <input
                className="input tabular"
                type="number"
                min={0}
                max={23}
                value={safety.quietEndHour}
                onChange={(e) => void patchSafety({ quietEndHour: Number(e.target.value) })}
              />
            </Field>
          </div>
        )}
      </Card>

      {/* ═══════ اپ متا ═══════ */}
      <Card
        title="اتصال به API رسمی اینستاگرام"
        subtitle="یک بار تنظیم می‌شود. راهنمای گام‌به‌گام در فایل docs/SETUP-META-APP.md پروژه."
      >
        {meta.bundled ? (
          <Notice tone="success" title="اعتبارنامه از قبل داخل اپ هست">
            این نسخه با اعتبارنامه‌ی اپ متا بیلد شده، پس لازم نیست چیزی وارد کنید. مستقیم
            به <strong>حساب‌ها</strong> بروید و <strong>+ اتصال حساب</strong> را بزنید.
            <br />
            <br />
            تنها چیزی که پایین باقی می‌ماند <strong>Webhook Verify Token</strong> است، و آن
            هم فقط اگر واکنش لحظه‌ای می‌خواهید — بدونش اپ با نظرسنجی هر ۳ دقیقه کار می‌کند.
          </Notice>
        ) : (
          <Notice tone="info" title="چطور این مقادیر را بگیرم">
            <ol className="mr-4 mt-1 list-decimal space-y-1">
              <li>به developers.facebook.com بروید و یک اپ از نوع Business بسازید</li>
              <li>محصول «Instagram» را اضافه کنید و گزینه‌ی API setup with Instagram login را بزنید</li>
              <li>
                در بخش <strong>Business login settings</strong>، مقادیر{' '}
                <strong>Instagram app ID</strong> و <strong>Instagram app secret</strong> را کپی
                کنید — نه App ID و App Secret صفحه‌ی Basic Settings؛ آن‌ها مال اپ فیسبوک‌اند و
                اینجا کار نمی‌کنند
              </li>
              <li>
                در همان بخش یک Redirect URI اضافه کنید (هر آدرس HTTPS معتبر — حتی سایت خودتان) و
                همان را اینجا هم بنویسید
              </li>
              <li>حساب اینستاگرام باید Business یا Creator باشد</li>
            </ol>
          </Notice>
        )}

        <div className="mt-4 space-y-4">
          <Field
            label="App ID"
            hint={meta.bundled ? 'در زمان بیلد جاسازی شده — قابل تغییر از اینجا نیست' : undefined}
          >
            <input
              className="input tabular"
              value={meta.appId ?? ''}
              disabled={meta.bundled}
              onChange={(e) => setMeta({ ...meta, appId: e.target.value })}
              placeholder="مثلاً 1234567890123456"
            />
          </Field>
          <Field
            label="App Secret"
            hint={
              meta.bundled
                ? 'در زمان بیلد جاسازی شده'
                : 'با رمزنگاری ویندوز ذخیره می‌شود و در نمایش ماسک می‌شود'
            }
          >
            <input
              className="input"
              type="text"
              value={meta.appSecret ?? ''}
              disabled={meta.bundled}
              onChange={(e) => setMeta({ ...meta, appSecret: e.target.value })}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Redirect URI" hint="باید مو‌به‌مو با آنچه در داشبورد متا ثبت کرده‌اید یکی باشد">
            <input
              className="input"
              dir="ltr"
              value={meta.redirectUri ?? ''}
              disabled={meta.bundled}
              onChange={(e) => setMeta({ ...meta, redirectUri: e.target.value })}
              placeholder="https://example.com/auth/callback"
            />
          </Field>
          <Field
            label="Webhook Verify Token"
            hint="یک رشته‌ی دلخواه که خودتان می‌سازید و در داشبورد متا هم همان را می‌گذارید"
          >
            <input
              className="input"
              dir="ltr"
              value={meta.webhookVerifyToken ?? ''}
              onChange={(e) => setMeta({ ...meta, webhookVerifyToken: e.target.value })}
              placeholder="my-secret-verify-token-123"
            />
          </Field>
          <button className="btn-primary" onClick={() => void saveMeta()}>
            {meta.bundled ? 'ذخیره‌ی Verify Token' : 'ذخیره‌ی تنظیمات متا'}
          </button>
        </div>
      </Card>

      {/* ═══════ دریافت رویداد ═══════ */}
      <Card title="دریافت رویداد" subtitle="چطور اپ از کامنت‌ها و پیام‌های جدید باخبر شود">
        <div className="divide-y divide-white/[0.06]">
          <Toggle
            checked={pollersOn}
            onChange={(v) => void togglePollers(v)}
            label="نظرسنجی دوره‌ای"
            hint="کامنت‌ها هر ۳ دقیقه، پست‌ها هر ۱۵ دقیقه، فالوورها هر ساعت بررسی می‌شوند. بدون نیاز به تنظیم شبکه کار می‌کند."
          />
          <Toggle
            checked={webhookOn}
            disabled={!hasGraphAccount}
            onChange={(v) => void toggleWebhook(v)}
            label="وبهوک (واکنش لحظه‌ای)"
            hint={
              hasGraphAccount
                ? 'کامنت‌ها را در همان ثانیه دریافت می‌کند، اما به یک آدرس عمومی HTTPS نیاز دارد'
                : 'برای حساب شما کاری نمی‌کند — رویدادهای وبهوک را سرورهای متا می‌فرستند و این فقط با اتصال «API رسمی» معنا دارد'
            }
          />
        </div>

        <div className="mt-3" hidden={!hasGraphAccount}>
          <Field
            label="پورت وبهوک"
            hint="اگر پورت اشغال بود، عدد دیگری بگذارید"
          >
            <input
              className="input tabular w-32"
              type="number"
              min={1024}
              max={65535}
              value={webhookPort}
              onChange={(e) => setWebhookPort(Number(e.target.value))}
              disabled={webhookOn}
            />
          </Field>
        </div>

        {!hasGraphAccount ? (
          <Notice tone="success" title="وبهوک را لازم ندارید — رد شوید">
            وبهوک یعنی «سرورهای متا به کامپیوتر شما خبر بدهند». اما متا فقط برای اپ‌هایی خبر
            می‌فرستد که در داشبورد خودش ثبت شده‌اند. حساب شما با <strong>ورود ساده</strong> وصل است،
            نه با API رسمی — پس متا اصلا نمی‌داند این اپ وجود دارد و این کلید هیچ کاری نمی‌کند.
            <br />
            <br />
            <strong>همه‌چیز همین الان کار می‌کند:</strong> نظرسنجی دوره‌ای (کلید بالا، که روشن است)
            هر ۳ دقیقه کامنت‌ها را می‌خواند. تنها تفاوتش با وبهوک، چند دقیقه تأخیر است.
          </Notice>
        ) : (
        <Notice tone="info" title="برای وبهوک به آدرس عمومی نیاز دارید">
          ساده‌ترین راه، یک تونل است. در ترمینال اجرا کنید:
          <code className="mt-1.5 block rounded bg-black/40 px-2 py-1.5 text-[11px]" dir="ltr">
            cloudflared tunnel --url http://localhost:{webhookPort}
          </code>
            آدرس https که می‌دهد را با مسیر <code>/webhook</code> در داشبورد متا به‌عنوان Callback
            URL ثبت کنید. اگر این کار برایتان سخت است، فقط نظرسنجی دوره‌ای را روشن بگذارید —
            همه‌چیز کار می‌کند، فقط چند دقیقه تأخیر دارد.
          </Notice>
        )}
      </Card>

      {/* ═══════ موتور پیشرفته ═══════ */}
      <Card
        title="موتور پیشرفته (Session)"
        subtitle="برای قابلیت‌هایی که API رسمی اصلاً ندارد"
      >
        <Notice tone="danger" title="ریسک‌ها را بخوانید">
          این موتور با API خصوصی اینستاگرام (همان که اپ موبایل استفاده می‌کند) کار می‌کند. سه قابلیت
          می‌دهد که راه رسمی ندارند: <strong>لیست فالوورها</strong>،{' '}
          <strong>تشخیص فالوور جدید</strong> و <strong>دایرکت به کسی که به شما پیام نداده</strong>.
          <br />
          <br />
          در عوض: نقض شرایط استفاده‌ی اینستاگرام است، حساب می‌تواند موقتاً محدود یا در موارد شدید
          بسته شود، و نیاز به رمز حساب دارد.
          <br />
          <br />
          <strong>توصیه‌ی من:</strong> برای «کامنت به دایرکت» و آنالیتیکس از API رسمی استفاده کنید (بدون
          ریسک). این موتور را فقط اگر واقعاً به آن سه قابلیت نیاز دارید روشن کنید، با سقف پایین، و
          اول روی حسابی که برایتان حیاتی نیست تست بگیرید.
        </Notice>

        <div className="mt-3">
          <Toggle
            checked={session.enabled}
            disabled={!session.libraryAvailable}
            onChange={async (v) => {
              await call('setSessionEngineEnabled', { enabled: v })
              setSession({ ...session, enabled: v })
              toasts.push(v ? 'warn' : 'info', v ? 'موتور Session روشن شد' : 'موتور Session خاموش شد')
            }}
            label="موتور Session فعال باشد"
            hint={
              session.libraryAvailable
                ? 'بعد از روشن کردن، از صفحه‌ی حساب‌ها با نام کاربری و رمز وصل شوید'
                : 'کتابخانه نصب نیست — دستور npm install instagram-private-api را اجرا کنید'
            }
          />
        </div>
      </Card>

      {/* ═══════ اطلاعات ═══════ */}
      <Card title="اطلاعات برنامه">
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">نسخه</dt>
            <dd className="tabular text-slate-300">{info?.version ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-slate-500">مسیر داده‌ها</dt>
            <dd className="break-all text-left text-slate-400" dir="ltr">
              {info?.userData ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">رمزنگاری سیستم‌عامل</dt>
            <dd>
              {info?.encryptionAvailable ? (
                <span className="chip-ok">فعال</span>
              ) : (
                <span className="chip-warn">غیرفعال — اعتبارنامه‌ها بدون رمز ذخیره می‌شوند</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
