import Link from 'next/link'

/**
 * سرصفحه‌ی هر بخش: عنوان + یک بند توضیح ساده که این بخش چه کاری می‌کند،
 * و اگر آموزشی دارد، لینک ویدیو/تصویر همان بخش.
 */
export function PageIntro({
  title,
  text,
  learn,
  children
}: {
  title: string
  text: string
  learn?: { href: string; label: string }
  children?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h1 className="text-[24px] font-bold">{title}</h1>
        <p className="mt-2 text-[14px] leading-7 text-mist">{text}</p>
        {learn && (
          <Link href={learn.href} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-magenta hover:text-haze">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 8.6v6.8l5.4-3.4z" />
            </svg>
            {learn.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}
