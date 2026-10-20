import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" className="h-14 w-14 opacity-80" />
      <h1 className="text-[24px] font-bold">این صفحه پیدا نشد</h1>
      <Link href="/" className="btn btn-ghost">صفحه‌ی اصلی</Link>
    </main>
  )
}
