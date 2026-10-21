import type { Metadata } from 'next'
import Link from 'next/link'
import { PageIntro } from '@/components/PageIntro'
import { getDict, lp, num } from '@/lib/i18n'
import { LESSONS } from '@/lib/learn'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict()
  return { title: t.app.learn.title }
}

/** فهرست آموزش‌ها به ترتیب راه‌اندازی: از ساخت حساب تا ابزارهای جانبی */
export default async function Learn() {
  const { lang, t } = await getDict()
  const L = t.app.learn

  return (
    <div>
      <PageIntro title={L.title} text={L.intro} />
      <ol className="grid gap-3 sm:grid-cols-2">
        {LESSONS.map((l, i) => {
          const x = L.lessons[l.id]
          return (
            <li key={l.id}>
              <Link
                href={lp(lang, '/dashboard/learn/' + l.id)}
                className="card group flex h-full items-center gap-4 p-3 transition hover:border-white/[0.14] hover:bg-white/[0.03]"
              >
                <Thumb id={l.id} lang={lang} video={l.kind === 'video'} />
                <span className="min-w-0 flex-1 py-1">
                  <span className="text-[12px] font-bold text-dim">{num(lang, i + 1)}</span>
                  <span className="mt-0.5 block text-[16px] font-bold leading-7">{x.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-6 text-mist">{x.sub}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                    <span className={'chip ' + (l.kind === 'video' ? 'bg-magenta/15 text-pink-200' : 'bg-white/[0.06] text-mist')}>
                      {l.kind === 'video' ? L.video : L.images}
                    </span>
                    <span className="chip bg-white/[0.04] text-dim">
                      {l.secs ? L.secs(num(lang, l.secs)) : L.stepsN(num(lang, x.steps.length))}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** پیش‌نمایش کوچک به شکل صفحه‌ی گوشی؛ آموزش تصویری یک نماد ساده دارد */
function Thumb({ id, lang, video }: { id: string; lang: string; video: boolean }) {
  if (!video) {
    return (
      <span className="flex h-[118px] w-[60px] shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-gradient-to-b from-violet/25 to-magenta/10 text-haze">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5a1 1 0 1 0 0-.01" />
        </svg>
      </span>
    )
  }
  return (
    <span className="relative h-[118px] w-[60px] shrink-0 overflow-hidden rounded-[14px] border border-white/[0.08] bg-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/learn/${id}-${lang}.webp`} alt="" width={60} height={118} loading="lazy" className="h-full w-full object-cover object-top opacity-80 transition group-hover:opacity-100" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden className="ml-0.5">
            <path d="M7 5v14l12-7z" />
          </svg>
        </span>
      </span>
    </span>
  )
}
