import Link from 'next/link'
import { PhoneDemo } from '@/components/PhoneDemo'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { UseCases } from '@/components/UseCases'
import type { Dict } from '@/lib/dict'
import { getDict, money, num, type Lang } from '@/lib/i18n'
import { IMAGES, imgSrc } from '@/lib/images'
import { PLANS } from '@/lib/plans'

export default async function Home() {
  const { lang, t } = await getDict()
  return (
    <>
      <SiteHeader lang={lang} t={t} />
      <main>
        <Hero lang={lang} t={t} />
        <Scenarios t={t} />
        <Features lang={lang} t={t} />
        <Templates t={t} />
        <NightBand lang={lang} t={t} />
        <section className="wrap py-20 lg:py-28">
          <h2 className="mb-10 text-[30px] font-bold sm:text-[40px]">{t.usecases.title}</h2>
          <UseCases u={t.usecases} />
        </section>
        <HowItWorks lang={lang} t={t} />
        <Safety t={t} />
        <Pricing lang={lang} t={t} />
        <Platforms t={t} />
        <Faq t={t} />
        <FinalCta t={t} />
      </main>
      <SiteFooter lang={lang} t={t} />
    </>
  )
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-tangerine">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Hero({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <section className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc(IMAGES.hero)}
        alt=""
        className="fade-photo pointer-events-none absolute -end-24 top-0 hidden h-full w-[62%] object-cover opacity-[0.22] mix-blend-luminosity lg:block"
      />
      <div className="wrap relative grid items-center gap-14 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-5 text-[14px] text-mist">{t.hero.eyebrow}</p>
          <h1 className={'font-bold leading-[1.12] tracking-tight ' + (lang === 'fa' ? 'text-[44px] sm:text-[64px]' : 'text-[46px] sm:text-[68px]')}>
            {t.hero.h1a}
            <br />
            <span className="text-brand">{t.hero.h1b}</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] font-light leading-9 text-mist">{t.hero.sub}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#pricing" className="btn btn-brand h-12 px-7 text-[16px]">{t.hero.ctaBuy}</a>
            <a href="#how" className="btn btn-ghost h-12 px-6">{t.hero.ctaHow}</a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-mist">
            {t.hero.ticks.map((x) => (
              <li key={x} className="flex items-center gap-2"><Tick /> {x}</li>
            ))}
          </ul>
        </div>
        <PhoneDemo d={t.demo} rtl={lang === 'fa'} />
      </div>
    </section>
  )
}

function Scenarios({ t }: { t: Dict }) {
  return (
    <section className="wrap py-20 lg:py-28">
      <h2 className="max-w-2xl text-[30px] font-bold leading-[1.35] sm:text-[40px]">{t.scenarios.title}</h2>
      <p className="mt-4 max-w-xl text-[16px] font-light leading-8 text-mist">{t.scenarios.sub}</p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {t.scenarios.items.map((s) => (
          <article key={s.where} className="card flex flex-col p-5">
            <p className="text-[13px] font-bold text-tangerine">{s.where}</p>
            <div className="mt-5 flex flex-1 flex-col gap-2.5 text-[14px]">
              <p className="max-w-[80%] self-start rounded-[18px] rounded-es-md bg-plum-3 px-3.5 py-2 leading-6">{s.them}</p>
              <p className="max-w-[88%] self-end rounded-[18px] rounded-ee-md bg-brand px-3.5 py-2 leading-6 text-white">{s.us}</p>
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

/** امکانات پنل — ترتیب ندارند، پس شماره نمی‌گیرند */
function Features({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <section id="features" className="scroll-mt-20 border-t border-white/[0.05] py-20 lg:py-28">
      <div className="wrap">
        <h2 className="text-[30px] font-bold sm:text-[40px]">{t.features.title}</h2>
        <p className="mt-4 max-w-2xl text-[16px] font-light leading-8 text-mist">{t.features.sub}</p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {t.features.items.map(([h, b], i) => (
            <div key={h} className="bg-ink p-6">
              <span className="block h-1 w-8 rounded-full bg-brand" style={{ opacity: 1 - (i % 4) * 0.15 }} aria-hidden />
              <h3 className="mt-4 text-[16px] font-bold">{h}</h3>
              <p className={'mt-2 text-[14px] text-mist ' + (lang === 'fa' ? 'leading-7' : 'leading-6')}>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** قالب‌ها به شکل گره‌های یک جریان: محرک ← کار */
function Templates({ t }: { t: Dict }) {
  return (
    <section id="templates" className="scroll-mt-20 pb-20 lg:pb-28">
      <div className="wrap">
        <h2 className="text-[30px] font-bold sm:text-[40px]">{t.templates.title}</h2>
        <p className="mt-4 max-w-2xl text-[16px] font-light leading-8 text-mist">{t.templates.sub}</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.templates.items.map((x) => (
            <article key={x.name} className="group rounded-[24px] border border-white/[0.06] bg-plum/60 p-5 transition hover:border-white/[0.14]">
              <h3 className="text-[16px] font-bold">{x.name}</h3>
              <div className="relative mt-4 space-y-3 ps-5 text-[14px] leading-6">
                <span className="absolute bottom-3 top-3 w-px bg-gradient-to-b from-violet via-magenta to-tangerine start-[5px]" aria-hidden />
                <p className="relative">
                  <span className="absolute -start-5 top-2 h-[11px] w-[11px] rounded-full border-2 border-violet bg-ink" aria-hidden />
                  <span className="text-dim">{t.templates.when} </span>
                  <span className="text-mist">{x.when}</span>
                </p>
                <p className="relative">
                  <span className="absolute -start-5 top-2 h-[11px] w-[11px] rounded-full bg-tangerine" aria-hidden />
                  <span className="text-dim">{t.templates.then} </span>
                  <span className="text-haze">{x.then}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function NightBand({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.05]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc(IMAGES.night)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.16] mix-blend-luminosity" />
      <div className={'absolute inset-0 from-ink via-ink/80 to-ink/40 ' + (lang === 'fa' ? 'bg-gradient-to-l' : 'bg-gradient-to-r')} aria-hidden />
      <div className="wrap relative py-24 lg:py-32">
        <p className="text-[15px] text-mist">{t.night.time}</p>
        <p className="mt-3 max-w-3xl text-[28px] font-bold leading-[1.5] sm:text-[38px]">
          {t.night.l1}
          <br />
          <span className="font-light text-mist">{t.night.l2}</span>
        </p>
      </div>
    </section>
  )
}

function HowItWorks({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <section id="how" className="wrap scroll-mt-20 py-20 lg:py-28">
      <h2 className="text-[30px] font-bold sm:text-[40px]">{t.how.title}</h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
        {t.how.steps.map((s, i) => (
          <li key={s.title}>
            <span className="text-[56px] font-bold leading-none text-white/[0.07]">{num(lang, i + 1)}</span>
            <h3 className="-mt-5 text-[19px] font-bold">{s.title}</h3>
            <p className="mt-3 text-[15px] font-light leading-8 text-mist">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-[13px] leading-7 text-dim">{t.how.note}</p>
    </section>
  )
}

function Safety({ t }: { t: Dict }) {
  return (
    <section id="safety" className="scroll-mt-20 bg-plum/50 py-20 lg:py-28">
      <div className="wrap grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-[30px] font-bold leading-[1.4] sm:text-[40px]">{t.safety.title}</h2>
          <p className="mt-5 text-[16px] font-light leading-8 text-mist">{t.safety.p1}</p>
          <p className="mt-5 rounded-2xl border border-white/[0.07] bg-ink/60 p-4 text-[14px] leading-7 text-mist">{t.safety.p2}</p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/[0.07]">
          <table className="w-full text-start text-[14px]">
            <thead>
              <tr className="bg-white/[0.03] text-[13px]">
                <th className="p-4 font-normal text-dim" />
                <th className="p-4 text-start font-bold text-haze">{t.safety.us}</th>
                <th className="p-4 text-start font-normal text-dim">{t.safety.them}</th>
              </tr>
            </thead>
            <tbody>
              {t.safety.rows.map(([k, us, them]) => (
                <tr key={k} className="border-t border-white/[0.06] align-top">
                  <th scope="row" className="p-4 text-start text-[13px] font-normal text-mist">{k}</th>
                  <td className="p-4 leading-7 text-haze">{us}</td>
                  <td className="p-4 leading-7 text-dim">{them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Pricing({ lang, t }: { lang: Lang; t: Dict }) {
  return (
    <section id="pricing" className="wrap scroll-mt-20 py-20 lg:py-28">
      <h2 className="text-[30px] font-bold sm:text-[40px]">{t.pricing.title}</h2>
      <p className="mt-3 text-[15px] text-mist">{t.pricing.sub}</p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const best = p.id === 'm3'
          const title = t.pricing.plans[p.id]
          return (
            <div key={p.id} className={best ? 'rounded-[30px] bg-brand p-[1.5px]' : ''}>
              <div className={'card flex h-full flex-col p-6 ' + (p.enabled ? '' : 'opacity-60')}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[18px] font-bold">{title}</h3>
                  {best && <span className="chip bg-white/10 text-haze">{t.pricing.best}</span>}
                  {!p.enabled && <span className="chip bg-white/[0.06] text-mist">{t.pricing.soon}</span>}
                </div>
                <p className="mt-6 text-[34px] font-bold leading-none">
                  {p.price ? num(lang, p.price) : '—'}
                  {p.price && <span className="ms-1.5 text-[15px] font-normal text-mist">{t.pricing.unit}</span>}
                </p>
                <p className="mt-2 h-5 text-[13px] text-dim">
                  {p.enabled ? t.pricing.notes[p.id] ?? num(lang, p.days) + ' ' + t.pricing.days : t.pricing.notActive}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[14px] text-mist">
                  {t.pricing.included.map((x) => (
                    <li key={x} className="flex items-start gap-2"><Tick />{x}</li>
                  ))}
                </ul>
                {p.enabled && p.price ? (
                  <Link href={'/checkout/' + p.id} className={'btn mt-8 ' + (best ? 'btn-brand' : 'btn-ghost')}>
                    {t.pricing.buy} {title} — {money(lang, p.price)}
                  </Link>
                ) : (
                  <button className="btn btn-ghost mt-8" disabled>{t.pricing.soon}</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Platforms({ t }: { t: Dict }) {
  const p = t.platforms
  return (
    <section className="wrap pb-20 lg:pb-28">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [p.phoneKicker, p.phoneTitle, p.phoneBody],
          [p.winKicker, p.winTitle, p.winBody]
        ].map(([k, h, b]) => (
          <div key={k} className="card p-7">
            <p className="text-[13px] font-bold text-tangerine">{k}</p>
            <h3 className="mt-3 text-[22px] font-bold">{h}</h3>
            <p className="mt-3 text-[15px] font-light leading-8 text-mist">{b}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Faq({ t }: { t: Dict }) {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.05] py-20 lg:py-28">
      <div className="wrap grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <h2 className="text-[30px] font-bold sm:text-[40px]">{t.faq.title}</h2>
        <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {t.faq.items.map(([q, a]) => (
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

function FinalCta({ t }: { t: Dict }) {
  return (
    <section className="wrap pb-24">
      <div className="relative overflow-hidden rounded-[32px] bg-plum-2 px-6 py-14 text-center sm:px-12">
        <div className="absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-brand opacity-30 blur-3xl" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" className="relative mx-auto h-16 w-16" />
        <h2 className="relative mt-6 text-[28px] font-bold sm:text-[36px]">{t.final.title}</h2>
        <p className="relative mt-3 text-[15px] text-mist">{t.final.sub}</p>
        <a href="#pricing" className="btn btn-brand relative mt-8 h-12 px-8 text-[16px]">{t.final.cta}</a>
      </div>
    </section>
  )
}
