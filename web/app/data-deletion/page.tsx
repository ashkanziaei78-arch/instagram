import type { Metadata } from 'next'
import { Legal } from '@/components/Legal'

export const metadata: Metadata = { title: 'حذف اطلاعات' }

export default function DataDeletion() {
  return (
    <Legal title="حذف اطلاعات کاربر" updated="آبان ۱۴۰۵">
      <p>برای حذف کامل اطلاعاتتان از دایرکتینو یکی از این راه‌ها را انجام دهید:</p>
      <h2>از پنل (فوری)</h2>
      <ul>
        <li>وارد پنل شوید و در پایین صفحه «حذف حساب و همه‌ی اطلاعات» را باز کنید.</li>
        <li>نام کاربری‌تان را بنویسید و «حذف همیشگی» را بزنید. حساب، پیج‌های وصل‌شده، توکن‌ها، قانون‌ها و گزارش‌ها بلافاصله پاک می‌شوند.</li>
      </ul>
      <h2>فقط قطع دسترسی اینستاگرام</h2>
      <ul>
        <li>در اینستاگرام: Settings ← Apps and websites ← دایرکتینو ← Remove.</li>
        <li>یا در پنل دایرکتینو کنار پیج، «قطع اتصال» را بزنید؛ توکن آن پیج همان لحظه حذف می‌شود.</li>
      </ul>
      <h2>Instructions (English)</h2>
      <p dir="ltr" className="text-left">
        To delete your data, sign in to Directino, open “Delete account” at the bottom of your dashboard and confirm with your
        username. All connected Instagram accounts, access tokens, rules and logs are removed immediately. You can also remove
        Directino from Instagram → Settings → Apps and websites.
      </p>
    </Legal>
  )
}
