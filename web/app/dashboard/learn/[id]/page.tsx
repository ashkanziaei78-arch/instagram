import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { LearnStep } from '@/lib/dict-app'
import { getDict, lp, num } from '@/lib/i18n'
import { LESSONS, lessonById } from '@/lib/learn'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { t } = await getDict()
  return { title: t.app.learn.lessons[id]?.title ?? t.app.learn.title }
}

export default async function LessonPage({ params }: Props) {
  const { id } = await params
  const lesson = lessonById(id)
  if (!lesson) notFound()
  const { lang, t } = await getDict()
  const L = t.app.learn
  const x = L.lessons[id]
  const next = LESSONS[LESSONS.indexOf(lesson) + 1]
  const steps = x.steps.map((s) => (typeof s === 'string' ? { t: s } : s))

  return (
    <div>
      <Link href={lp(lang, '/dashboard/learn')} className="inline-flex items-center gap-1 text-[13px] text-mist hover:text-haze">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="rtl:rotate-180">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {L.all}
      </Link>
      <h1 className="mt-3 text-[24px] font-bold">{x.title}</h1>
      <p className="mt-1 text-[14px] leading-7 text-mist">{x.sub}</p>

      {lesson.kind === 'video' ? (
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[300px_1fr]">
          {/* قاب گوشی: ویدیوها در عرض موبایل ضبط شده‌اند */}
          <div className="mx-auto w-full max-w-[300px] rounded-[32px] border border-white/[0.1] bg-black p-2 shadow-2xl shadow-violet/10">
            <video
              controls
              playsInline
              preload="metadata"
              poster={`/learn/${id}-${lang}.webp`}
              className="aspect-[414/820] w-full rounded-[24px] bg-ink"
            >
              <source src={`/learn/${id}-${lang}.mp4`} type="video/mp4" />
              <source src={`/learn/${id}-${lang}.webm`} type="video/webm" />
            </video>
          </div>
          <section className="card p-6">
            <h2 className="text-[17px] font-bold">{L.steps}</h2>
            <ol className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-7">
                  <Num n={num(lang, i + 1)} />
                  <span>{s.t}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="card p-5">
              <div className="flex gap-3 text-[15px] leading-7">
                <Num n={num(lang, i + 1)} />
                <p>{s.t}</p>
              </div>
              <Visual step={s} lang={lang} allow={L.allow} home={L.home} />
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={lp(lang, lesson.goto)} className="btn btn-brand">{L.open}</Link>
        {next && (
          <Link href={lp(lang, '/dashboard/learn/' + next.id)} className="btn btn-ghost">
            {L.next}: {L.lessons[next.id].title}
          </Link>
        )}
      </div>
    </div>
  )
}

function Num({ n }: { n: string }) {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">{n}</span>
  )
}

type Step = Exclude<LearnStep, string>

/** تصویر یا طرح زیر هر مرحله‌ی آموزش تصویری */
function Visual({ step, lang, allow, home }: { step: Step; lang: string; allow: Record<string, string>; home: string }) {
  if (step.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/learn/${step.img}-${lang}.webp`}
        alt=""
        loading="lazy"
        width={382}
        height={180}
        className="mt-4 h-auto w-full max-w-sm rounded-[22px] border border-white/[0.06] sm:ms-9"
      />
    )
  }
  if (step.path) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] sm:ms-9">
        {step.path.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="text-dim rtl:rotate-180">
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
            <span dir="auto" className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-bold">{p}</span>
          </span>
        ))}
      </div>
    )
  }
  if (step.art === 'allow') {
    // طرح ساده‌ی صفحه‌ی اجازه — فقط برای نشان دادن جای دکمه، نه کپی ظاهر اینستاگرام
    return (
      <div className="mt-4 max-w-xs rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-5 sm:ms-9">
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
          <span className="text-dim">⇄</span>
          <span className="h-11 w-11 rounded-full border-2 border-magenta/60 bg-plum-3" />
        </div>
        <p className="mt-4 text-[13px] font-bold">{allow.wants}</p>
        <ul className="mt-2 space-y-1.5 text-[12px] text-mist">
          {[allow.p1, allow.p2, allow.p3].map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-emerald-300">✓</span>
              {p}
            </li>
          ))}
        </ul>
        <div dir="ltr" className="mt-4 grid grid-cols-2 gap-2 text-[13px] font-bold">
          <span className="rounded-xl border border-white/[0.1] py-2 text-center text-mist">{allow.cancel}</span>
          <span className="relative rounded-xl bg-haze py-2 text-center text-ink ring-4 ring-magenta/40">{allow.ok}</span>
        </div>
      </div>
    )
  }
  if (step.art === 'home') {
    return (
      <div className="mt-4 max-w-[220px] rounded-[26px] border border-white/[0.08] bg-gradient-to-b from-violet/20 to-ink p-4 sm:ms-9" aria-label={home}>
        <div dir="ltr" className="grid grid-cols-4 gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="aspect-square rounded-[10px] bg-white/[0.07]" />
          ))}
          <span className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-192.png" alt="" width={40} height={40} className="aspect-square w-full rounded-[10px] ring-2 ring-magenta/60" />
            <span className="text-[8px] text-haze">Directino</span>
          </span>
        </div>
      </div>
    )
  }
  return null
}
