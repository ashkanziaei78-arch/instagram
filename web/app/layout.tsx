import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'دایرکتینو — جواب خودکار کامنت و دایرکت اینستاگرام', template: '%s | دایرکتینو' },
  description:
    'دایرکتینو به کامنت، دایرکت و استوری‌های پیج اینستاگرام شما همان لحظه جواب می‌دهد؛ با API رسمی اینستاگرام و بدون گرفتن رمز پیج.',
  applicationName: 'دایرکتینو',
  appleWebApp: { capable: true, title: 'دایرکتینو', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: '/brand/apple-touch-icon.png'
  },
  openGraph: { images: ['/brand/icon-512.png'], locale: 'fa_IR', siteName: 'دایرکتینو' }
}

export const viewport: Viewport = {
  themeColor: '#0e0a1c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={dana.variable}>
      <body>{children}</body>
    </html>
  )
}
