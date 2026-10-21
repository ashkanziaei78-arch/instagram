import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getDict } from '@/lib/i18n'
import './globals.css'

const dana = localFont({
  src: [
    { path: '../fonts/DanaFaNum-Light.ttf', weight: '300' },
    { path: '../fonts/DanaFaNum-Regular.ttf', weight: '400' },
    { path: '../fonts/DanaFaNum-Bold.ttf', weight: '700' }
  ],
  variable: '--font-dana',
  display: 'swap'
})

// دانا ارقام را فارسی می‌کشد؛ نسخه‌ی انگلیسی فونت لاتین جدا لازم دارد
const bricolage = localFont({
  src: '../fonts/BricolageGrotesque-Variable.woff2',
  weight: '200 800',
  variable: '--font-bricolage',
  display: 'swap'
})

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getDict()
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    metadataBase: new URL(base),
    title: { default: t.meta.title, template: lang === 'fa' ? '%s | دایرکتینو' : '%s | Directino' },
    description: t.meta.description,
    applicationName: lang === 'fa' ? 'دایرکتینو' : 'Directino',
    appleWebApp: { capable: true, title: lang === 'fa' ? 'دایرکتینو' : 'Directino', statusBarStyle: 'black-translucent' },
    icons: {
      icon: [
        { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }
      ],
      apple: '/brand/apple-touch-icon.png'
    },
    alternates: { languages: { fa: base + '/', en: base + '/en' } },
    openGraph: {
      images: ['/brand/icon-1024.png'],
      locale: lang === 'fa' ? 'fa_IR' : 'en_US',
      siteName: 'Directino'
    }
  }
}

export const viewport: Viewport = {
  themeColor: '#0e0a1c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getDict()
  return (
    <html lang={lang} dir={lang === 'fa' ? 'rtl' : 'ltr'} className={dana.variable + ' ' + bricolage.variable}>
      <body>{children}</body>
    </html>
  )
}
