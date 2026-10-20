import Link from 'next/link'
import { IMAGES } from '@/lib/images'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-10 text-[13px] text-dim">
      <div className="wrap flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-light.png" alt="Directino" className="h-5 w-auto opacity-80" />
          <p>جواب خودکار کامنت و دایرکت اینستاگرام، با API رسمی.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/privacy" className="hover:text-mist">حریم خصوصی</Link>
          <Link href="/terms" className="hover:text-mist">قوانین استفاده</Link>
          <Link href="/data-deletion" className="hover:text-mist">حذف اطلاعات</Link>
          <Link href="/login" className="hover:text-mist">ورود مشتری‌ها</Link>
        </nav>
      </div>
      <div className="wrap mt-6 text-[11px] leading-6 text-dim/80">
        Instagram نشان تجاری Meta است و دایرکتینو وابسته به Meta نیست. عکس‌ها:{' '}
        {Object.values(IMAGES)
          .filter((i) => !i.licensed)
          .map((i) => i.credit)
          .join('، ')}
      </div>
    </footer>
  )
}
