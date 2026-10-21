import { cookies, headers } from 'next/headers'
import { dict, type Dict } from './dict'

export type Lang = 'fa' | 'en'

export async function getLang(): Promise<Lang> {
  const h = (await headers()).get('x-dx-lang')
  if (h === 'en' || h === 'fa') return h
  return (await cookies()).get('dx_lang')?.value === 'en' ? 'en' : 'fa'
}

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang()
  return { lang, t: dict[lang] }
}

/** آدرس صفحه به زبان فعلی. فقط برای صفحه‌ها؛ مسیرهای API پیشوند ندارند. */
export const lp = (lang: Lang, path: string): string =>
  lang === 'en' ? '/en' + (path === '/' ? '' : path) : path

export const num = (lang: Lang, n: number): string => n.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')

export const money = (lang: Lang, n: number): string =>
  lang === 'fa' ? n.toLocaleString('fa-IR') + ' تومان' : n.toLocaleString('en-US') + ' Toman'

export const dateLong = (lang: Lang, d: Date): string =>
  new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', { dateStyle: 'medium' }).format(d)

export const dateTime = (lang: Lang, d: Date): string =>
  new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran'
  }).format(d)

/** مسیرهایی که صفحه نیستند و پیشوند زبان نمی‌گیرند */
const NON_PAGE = /^\/(api|checkout|oauth|pay\/callback|connect\/desktop)(\/|$|\?)/

/** هر مسیر داخلی را به زبان فعلی می‌برد (اگر صفحه باشد و پیشوند نداشته باشد) */
export function localize(lang: Lang, path: string): string {
  if (lang !== 'en' || NON_PAGE.test(path) || path === '/en' || path.startsWith('/en/')) return path
  return lp('en', path)
}
