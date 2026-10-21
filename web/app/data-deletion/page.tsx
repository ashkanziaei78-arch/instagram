import type { Metadata } from 'next'
import { Legal } from '@/components/Legal'
import { env } from '@/lib/env'
import { getDict } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getDict()
  return { title: lang === 'fa' ? 'حذف اطلاعات' : 'Data Deletion Instructions' }
}

export default async function DataDeletion() {
  const { lang, t } = await getDict()
  const contact = env.contactEmail
  if (lang === 'en') {
    return (
      <Legal lang={lang} t={t} path="/data-deletion" title="Data Deletion Instructions">
        <p>You can delete your data from Directino at any time, in one of these ways:</p>
        <h2>Delete everything (immediate)</h2>
        <ol className="ms-5 list-decimal space-y-1">
          <li>Log in at directino.vercel.app.</li>
          <li>At the bottom of your dashboard, open “Delete account and all data”.</li>
          <li>Type your username and click “Delete permanently”.</li>
        </ol>
        <p>Your account, connected Instagram accounts, access tokens, rules and activity log are removed immediately and cannot be recovered.</p>
        <h2>Remove Instagram access only</h2>
        <ul>
          <li>In your dashboard, click “Disconnect” next to the account — its access token is deleted immediately.</li>
          <li>Or in Instagram: Settings → Apps and websites → Directino → Remove.</li>
        </ul>
        {contact && (
          <>
            <h2>By email</h2>
            <p>
              If you can’t log in, email <a href={'mailto:' + contact}>{contact}</a> with your Directino username or Instagram
              username. We delete the data within 7 days and confirm by email.
            </p>
          </>
        )}
      </Legal>
    )
  }
  return (
    <Legal lang={lang} t={t} path="/data-deletion" title="حذف اطلاعات کاربر">
      <p>برای حذف اطلاعاتتان از دایرکتینو یکی از این راه‌ها را انجام دهید:</p>
      <h2>حذف کامل (فوری)</h2>
      <ul>
        <li>وارد پنل شوید و در پایین صفحه «حذف حساب و همه‌ی اطلاعات» را باز کنید.</li>
        <li>نام کاربری‌تان را بنویسید و «حذف همیشگی» را بزنید. حساب، پیج‌ها، توکن‌ها، قانون‌ها و گزارش‌ها بلافاصله پاک می‌شوند.</li>
      </ul>
      <h2>فقط قطع دسترسی اینستاگرام</h2>
      <ul>
        <li>در پنل کنار پیج «قطع اتصال» را بزنید؛ توکن همان لحظه حذف می‌شود.</li>
        <li>یا در اینستاگرام: Settings ← Apps and websites ← Directino ← Remove.</li>
      </ul>
      {contact && <p>اگر به پنل دسترسی ندارید، نام کاربری‌تان را به <a href={'mailto:' + contact}>{contact}</a> بفرستید؛ ظرف ۷ روز پاک می‌شود.</p>}
    </Legal>
  )
}
