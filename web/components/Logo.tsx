import Link from 'next/link'

/** نشان + نوشته. نوشته‌ی روشن برای پس‌زمینه‌ی تیره ساخته شده (wordmark-light). */
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="دایرکتینو — صفحه‌ی اصلی">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
      {!compact && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/wordmark-light.png" alt="Directino" width={112} height={25} className="h-[22px] w-auto" />
      )}
    </Link>
  )
}
