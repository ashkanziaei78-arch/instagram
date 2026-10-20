import Link from 'next/link'
import { PhoneDemo } from '@/components/PhoneDemo'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { IMAGES, imgSrc } from '@/lib/images'
import { PLANS, toman } from '@/lib/plans'

// صفحه‌ی اصلی کاملاً استاتیک است تا سریع باز شود؛ کاربرِ واردشده از «ورود» مستقیم به پنل می‌رود
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Scenarios />
        <NightBand />
        <HowItWorks />
        <Safety />
        <Pricing />
        <Platforms />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc(IMAGES.hero)}
        alt=""
        className="fade-photo pointer-events-none absolute -left-24 top-0 hidden h-full w-[62%] object-cover opacity-[0.22] mix-blend-luminosity lg:block"
      />
      <div className="wrap relative grid items-center gap-14 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-5 text-[14px] text-mist">برای پیج‌های فروشگاهی، آموزشی و خدماتی</p>
          <h1 className="text-[44px] font-bold leading-[1.15] tracking-tight sm:text-[64px]">
            هر کامنت،
            <br />
            یک <span className="text-brand">دایرکت.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] font-light leading-9 text-mist">
            کسی زیر پستتان می‌نویسد «۱» یا «قیمت»؛ دایرکتینو همان لحظه برایش دایرکت می‌فرستد — لینک خرید، لیست
            قیمت، کد تخفیف. با API رسمی اینستاگرام، بدون اینکه رمز پیج را به کسی بدهید.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#pricing" className="btn btn-brand h-12 px-7 text-[16px]">
              خرید اشتراک
            </a>
            <a href="#how" className="btn btn-ghost h-12 px-6">
              راه‌اندازی چطور است؟
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-mist">
            <li className="flex items-center gap-2"><Tick /> رمز اینستاگرام نمی‌خواهیم</li>
            <li className="flex items-center gap-2"><Tick /> روی گوشی و ویندوز</li>
            <li className="flex items-center gap-2"><Tick /> شبانه‌روز، حتی وقتی خوابید</li>
          </ul>
        </div>
        <PhoneDemo />
      </div>
    </section>
  )
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-tangerine">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SCENARIOS = [
  {
    where: 'زیر پست',
    them: '۱',
    us: 'سلام 👋 این هم لینک خرید. موجودی محدوده، زودتر سفارش بده.',
    rule: 'اگر کسی «۱» کامنت کرد ← لینک محصول به دایرکتش برود',
    also: 'زیر کامنتش هم می‌نویسد: «دایرکتت رو چک کن 💌»'
  },
  {
    where: 'در دایرکت',
    them: 'قیمت؟',
    us: 'تیشرت نخی ۴۸۰ / هودی ۹۲۰ / ست ۱٫۲ میلیون. ارسال به همه‌جای ایران 🚚',
    rule: 'اگر در دایرکت «قیمت» آمد ← لیست قیمت',
    also: 'برای «آدرس»، «ساعت کاری» و «ارسال» هم جواب جدا بگذارید'
  },
  {
    where: 'روی استوری',
    them: '🔥 (جواب به استوری)',
    us: 'ممنون که دیدی! کد STORY20 تا آخر شب ۲۰٪ تخفیف داره.',
    rule: 'اگر کسی به استوری جواب داد یا منشنتان کرد ← کد تخفیف',
    also: 'هر کسی پیج شما را در استوری‌اش منشن کند هم پیام تشکر می‌گیرد'
  }
]

function Scenarios() {
  return (
    <section className="wrap py-20 lg:py-28">
      <h2 className="max-w-2xl text-[30px] font-bold leading-[1.35] sm:text-[40px]">
        مشتری هرجا پیام بدهد، همان‌جا جواب می‌گیرد.
      </h2>
      <p className="mt-4 max-w-xl text-[16px] font-light leading-8 text-mist">
        سه جایی که بیشترِ فروش اینستاگرامی از دست می‌رود — چون جواب دیر رسید.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s) => (
          <article key={s.where} className="card flex flex-col p-5">
            <p className="text-[13px] font-bold text-tangerine">{s.where}</p>
            <div className="mt-5 flex flex-1 flex-col gap-2.5 text-[14px]">
              <p className="max-w-[80%] self-start rounded-[18px] rounded-br-md bg-plum-3 px-3.5 py-2 leading-6">{s.them}</p>
              <p className="max-w-[88%] self-end rounded-[18px] rounded-bl-md bg-brand px-3.5 py-2 leading-6 text-white">{s.us}</p>
            </div>
            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <p className="text-[13px] leading-6 text-haze">{s.rule}</p>
              <p className="mt-1.5 text-[12px] leading-6 text-dim">{s.also}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function NightBand() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.05]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc(IMAGES.night)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16] mix-blend-luminosity"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-ink via-ink/80 to-ink/40" aria-hidden />
      <div className="wrap relative py-24 lg:py-32">
        <p className="text-[15px] text-mist">۲:۱۴ بامداد</p>
        <p className="mt-3 max-w-3xl text-[28px] font-bold leading-[1.5] sm:text-[38px]">
          کسی زیر پستتان نوشته «قیمت؟».
          <br />
          <span className="font-light text-mist">شما خوابید. جوابش رفته؛ صبح فقط سفارش را می‌بینید.</span>
        </p>
      </div>
    </section>
  )
}

const STEPS = [
  {
    title: 'ثبت‌نام و اشتراک',
    body: 'یک نام کاربری و رمز برای دایرکتینو می‌سازید و اشتراک را با درگاه بانکی پرداخت می‌کنید. روزهای باقی‌مانده همیشه در پنلتان پیداست.'
  },
  {
    title: 'وصل کردن پیج',
    body: 'دکمه‌ی «اتصال پیج» صفحه‌ی رسمی خود اینستاگرام را باز می‌کند. آنجا وارد می‌شوید و «اجازه» می‌دهید. رمزتان فقط در سایت اینستاگرام تایپ می‌شود.'
  },
  {
    title: 'نوشتن جواب‌ها',
    body: 'می‌نویسید «اگر کسی ۱ کامنت کرد، این پیام برود». از همین لحظه دایرکتینو روی سرور بیدار است — گوشی و کامپیوترتان لازم نیست روشن باشد.'
  }
]

function HowItWorks() {
  return (
    <section id="how" className="wrap scroll-mt-20 py-20 lg:py-28">
      <h2 className="text-[30px] font-bold sm:text-[40px]">راه‌اندازی، کمتر از ده دقیقه</h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="text-[56px] font-bold leading-none text-white/[0.07]">{(i + 1).toLocaleString('fa-IR')}</span>
            <h3 className="-mt-5 text-[19px] font-bold">{s.title}</h3>
            <p className="mt-3 text-[15px] font-light leading-8 text-mist">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-[13px] leading-7 text-dim">
        پیج باید «حرفه‌ای» باشد (Business یا Creator). تبدیلش رایگان است و از تنظیمات خود اینستاگرام دو دقیقه طول می‌کشد.
      </p>
    </section>
  )
}

const COMPARE: [string, string, string][] = [
  ['نحوه‌ی اتصال', 'صفحه‌ی رسمی اینستاگرام و دکمه‌ی «اجازه»', 'رمز پیج را به آن‌ها می‌دهید'],
  ['ریسک مسدود شدن پیج', 'ندارد — همان راهی که خود متا ساخته', 'بالا؛ اینستاگرام ورود از سرورهای ناشناس را می‌گیرد'],
  ['اگر رمز پیج را عوض کنید', 'چیزی قطع نمی‌شود', 'همه‌چیز از کار می‌افتد'],
  ['قطع دسترسی', 'هر وقت بخواهید، از تنظیمات اینستاگرام', 'باید رمز را عوض کنید']
]

function Safety() {
  return (
    <section id="safety" className="scroll-mt-20 bg-plum/50 py-20 lg:py-28">
      <div className="wrap">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-[30px] font-bold leading-[1.4] sm:text-[40px]">رمز پیج را از شما نمی‌خواهیم.</h2>
            <p className="mt-5 text-[16px] font-light leading-8 text-mist">
              بیشتر ابزارهای ایرانی با رمز پیج کار می‌کنند و از سرور خودشان به جای شما وارد اینستاگرام می‌شوند. همین
              چیزی است که پیج‌ها را به «تأیید هویت» و مسدودی می‌کشاند. دایرکتینو از API رسمی اینستاگرام استفاده
              می‌کند؛ همان راهی که ابزارهای بزرگ دنیا استفاده می‌کنند.
            </p>
            <p className="mt-5 rounded-2xl border border-white/[0.07] bg-ink/60 p-4 text-[14px] leading-7 text-mist">
              صادقانه: API رسمی محدودیت هم دارد. فقط به کسی می‌شود دایرکت داد که کامنت گذاشته، به استوری جواب داده یا
              در ۲۴ ساعت گذشته پیام داده. پیام انبوه به همه‌ی فالوورها با راه رسمی ممکن نیست — و همین است که پیج شما را
              امن نگه می‌دارد.
            </p>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-white/[0.07]">
            <table className="w-full text-right text-[14px]">
              <thead>
                <tr className="bg-white/[0.03] text-[13px]">
                  <th className="p-4 font-normal text-dim" />
                  <th className="p-4 font-bold text-haze">دایرکتینو</th>
                  <th className="p-4 font-normal text-dim">ابزارهای رمزی</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([k, us, them]) => (
                  <tr key={k} className="border-t border-white/[0.06] align-top">
                    <th scope="row" className="p-4 text-[13px] font-normal text-mist">{k}</th>
                    <td className="p-4 leading-7 text-haze">{us}</td>
                    <td className="p-4 leading-7 text-dim">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

const INCLUDED = ['جواب خودکار کامنت، دایرکت و استوری', 'دکمه‌ی لینک داخل دایرکت', 'پنل موبایل و نسخه‌ی ویندوز', 'گزارش همه‌ی پیام‌های فرستاده‌شده']

function Pricing() {
  return (
    <section id="pricing" className="wrap scroll-mt-20 py-20 lg:py-28">
      <h2 className="text-[30px] font-bold sm:text-[40px]">قیمت‌ها</h2>
      <p className="mt-3 text-[15px] text-mist">همه‌ی امکانات در همه‌ی پلن‌ها هست؛ فقط مدت فرق می‌کند.</p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const best = p.id === 'm3'
          return (
            <div key={p.id} className={best ? 'rounded-[30px] bg-brand p-[1.5px]' : ''}>
              <div className={'card flex h-full flex-col p-6 ' + (p.enabled ? '' : 'opacity-60')}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-bold">{p.title}</h3>
                  {best && <span className="chip bg-white/10 text-haze">به‌صرفه‌تر</span>}
                  {!p.enabled && <span className="chip bg-white/[0.06] text-mist">به‌زودی</span>}
                </div>
                <p className="mt-6 text-[34px] font-bold leading-none">
                  {p.price ? p.price.toLocaleString('fa-IR') : '—'}
                  {p.price && <span className="mr-1.5 text-[15px] font-normal text-mist">تومان</span>}
                </p>
                <p className="mt-2 h-5 text-[13px] text-dim">{p.enabled ? p.note ?? `${p.days.toLocaleString('fa-IR')} روز` : 'این پلن هنوز فعال نشده'}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[14px] text-mist">
                  {INCLUDED.map((x) => (
                    <li key={x} className="flex items-start gap-2"><Tick />{x}</li>
                  ))}
                </ul>
                {p.enabled ? (
                  <Link href={'/checkout/' + p.id} className={'btn mt-8 ' + (best ? 'btn-brand' : 'btn-ghost')}>
                    خرید {p.title} — {toman(p.price!)}
                  </Link>
                ) : (
                  <button className="btn btn-ghost mt-8" disabled>به‌زودی</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Platforms() {
  return (
    <section className="wrap pb-20 lg:pb-28">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-7">
          <p className="text-[13px] font-bold text-tangerine">روی گوشی</p>
          <h3 className="mt-3 text-[22px] font-bold">بدون نصب از استور</h3>
          <p className="mt-3 text-[15px] font-light leading-8 text-mist">
            پنل را در مرورگر گوشی باز کنید و «افزودن به صفحه‌ی اصلی» را بزنید. مثل یک اپ کنار بقیه‌ی اپ‌ها می‌نشیند؛
            روی اندروید و آیفون.
          </p>
        </div>
        <div className="card p-7">
          <p className="text-[13px] font-bold text-tangerine">روی ویندوز</p>
          <h3 className="mt-3 text-[22px] font-bold">نسخه‌ی دسکتاپ برای کارهای بیشتر</h3>
          <p className="mt-3 text-[15px] font-light leading-8 text-mist">
            صندوق دایرکت، پیام گروهی و جواب هوشمند با هوش مصنوعی. لینک دانلود بعد از خرید اشتراک در پنلتان است و با
            همان نام کاربری وارد می‌شوید.
          </p>
        </div>
      </div>
    </section>
  )
}

const FAQ: [string, string][] = [
  [
    'پیجم بن نمی‌شود؟',
    'دایرکتینو روی سایت فقط از API رسمی اینستاگرام استفاده می‌کند و رمز پیج را هرگز نمی‌گیرد؛ از نگاه اینستاگرام مثل هر ابزار رسمی دیگری است. فقط پیام تکراری و آزاردهنده نفرستید — آن را خود کاربران گزارش می‌کنند، نه ابزار.'
  ],
  [
    'چه نوع پیجی لازم است؟',
    'پیج حرفه‌ای (Business یا Creator). صفحه‌ی فیسبوک لازم نیست. اگر پیجتان شخصی است، از تنظیمات اینستاگرام «تغییر به حساب حرفه‌ای» را بزنید.'
  ],
  [
    'می‌شود به همه‌ی فالوورها پیام گروهی داد؟',
    'با API رسمی نه؛ اینستاگرام فقط اجازه می‌دهد به کسی پیام بدهید که خودش اول تعامل کرده. نسخه‌ی ویندوز امکان پیام گروهی دارد ولی با روش غیررسمی، و آنجا خودش هشدار ریسک را نشان می‌دهد.'
  ],
  ['اشتراک تمام شود چه می‌شود؟', 'جواب‌های خودکار متوقف می‌شوند ولی هیچ‌چیز پاک نمی‌شود. با تمدید، همه‌چیز از همان‌جا ادامه پیدا می‌کند.'],
  ['پرداخت چطور است؟', 'با درگاه بانکی (کارت‌های عضو شتاب). بعد از پرداخت، روزهای اشتراک فوراً به حسابتان اضافه می‌شود.'],
  ['گوشی یا کامپیوترم باید روشن بماند؟', 'نه. جواب‌ها از سرور دایرکتینو می‌رود؛ حتی اگر گوشی خاموش باشد.']
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.05] py-20 lg:py-28">
      <div className="wrap grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <h2 className="text-[30px] font-bold sm:text-[40px]">سوال‌های رایج</h2>
        <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-[22px] font-light text-mist transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] font-light leading-8 text-mist">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="wrap pb-24">
      <div className="relative overflow-hidden rounded-[32px] bg-plum-2 px-6 py-14 text-center sm:px-12">
        <div className="absolute -top-24 left-1/2 -z-0 h-48 w-[70%] -translate-x-1/2 rounded-full bg-brand opacity-30 blur-3xl" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" className="relative mx-auto h-16 w-16" />
        <h2 className="relative mt-6 text-[28px] font-bold sm:text-[36px]">پست بعدی‌تان را با «۱ کامنت کن» منتشر کنید.</h2>
        <p className="relative mt-3 text-[15px] text-mist">ماهانه {toman(400_000)} — بدون قرارداد، هر وقت خواستید تمدید نکنید.</p>
        <a href="#pricing" className="btn btn-brand relative mt-8 h-12 px-8 text-[16px]">
          شروع کنید
        </a>
      </div>
    </section>
  )
}
