import { NextResponse, type NextRequest } from 'next/server'

/**
 * زبان از روی آدرس: /en/... انگلیسی، بقیه فارسی.
 *
 * /en/x به /x بازنویسی می‌شود و زبان در هدر x-dx-lang به صفحه می‌رسد؛ پس هر
 * صفحه یک نسخه دارد، نه دو. زبان در کوکی هم ذخیره می‌شود تا مسیرهایی که از
 * بیرون برمی‌گردند (بازگشت اینستاگرام و بانک) کاربر را به زبان خودش ببرند.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const lang = isEn ? 'en' : 'fa'
  const headers = new Headers(req.headers)
  headers.set('x-dx-lang', lang)

  let res: NextResponse
  if (isEn) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.slice(3) || '/'
    res = NextResponse.rewrite(url, { request: { headers } })
  } else {
    res = NextResponse.next({ request: { headers } })
  }
  if (req.cookies.get('dx_lang')?.value !== lang) {
    res.cookies.set('dx_lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  return res
}

export const config = {
  // مسیرهای API و بازگشت‌ها زبان ندارند؛ از کوکی تصمیم می‌گیرند
  matcher: ['/((?!api|_next|brand|img|fonts|oauth|checkout|pay/callback|connect/desktop|manifest|.*\\..*).*)']
}
