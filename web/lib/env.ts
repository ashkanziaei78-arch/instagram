/** تنظیمات سمت سرور. هیچ‌کدام از این‌ها (جز NEXT_PUBLIC_*) به مرورگر نمی‌رسد. */
export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  igAppId: process.env.IG_APP_ID ?? '',
  igAppSecret: process.env.IG_APP_SECRET ?? '',
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN ?? '',
  adminUsername: (process.env.ADMIN_USERNAME ?? '').toLowerCase(),
  zarinpalMerchant: process.env.ZARINPAL_MERCHANT_ID ?? '',
  zarinpalSandbox: process.env.ZARINPAL_SANDBOX === '1',
  manualCard: process.env.MANUAL_PAY_CARD ?? '',
  manualContact: process.env.MANUAL_PAY_CONTACT ?? '',
  desktopUrl: process.env.NEXT_PUBLIC_DESKTOP_URL ?? '',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? ''
}

export const igReady = (): boolean => !!(env.igAppId && env.igAppSecret)
export const redirectUri = (): string => env.siteUrl + '/oauth/instagram'

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET تنظیم نشده یا کوتاه است (حداقل ۱۶ کاراکتر)')
  }
  return 'dev-only-secret-change-me'
}
