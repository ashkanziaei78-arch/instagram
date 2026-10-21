import type { Metadata } from 'next'
import { Legal } from '@/components/Legal'
import { getDict } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getDict()
  return { title: lang === 'fa' ? 'قوانین استفاده' : 'Terms of Service' }
}

export default async function Terms() {
  const { lang, t } = await getDict()
  if (lang === 'en') {
    return (
      <Legal lang={lang} t={t} path="/terms" title="Terms of Service">
        <h2>The service</h2>
        <p>
          Directino lets owners of Instagram professional accounts send automatic replies to comments, direct messages and
          story interactions through the official Instagram API.
        </p>
        <h2>Subscriptions</h2>
        <ul>
          <li>A subscription starts when payment is confirmed and does not renew automatically.</li>
          <li>When it ends, automatic replies pause; your settings are kept.</li>
          <li>If an outage on our side lasts more than 24 hours, the same period is added to your subscription.</li>
        </ul>
        <h2>Acceptable use</h2>
        <ul>
          <li>Connect only accounts you own or are authorized to manage.</li>
          <li>Do not send spam, misleading or harassing messages, or anything that breaks Instagram’s Community Guidelines or Meta’s Platform Terms. Violations lead to suspension.</li>
          <li>You are responsible for the content of the replies you configure.</li>
        </ul>
        <h2>Instagram’s limits</h2>
        <p>
          Directino is subject to the Instagram API’s rules — for example, messages can only be sent to people who interacted
          with your account first. Changes made by Instagram may affect features.
        </p>
        <h2>Windows app</h2>
        <p>
          The optional Windows app also offers unofficial methods (browser-session login). Using them is your choice, carries a
          risk of account restrictions, and the app warns you before you enable them.
        </p>
        <h2>Liability</h2>
        <p>The service is provided “as is”. To the extent permitted by law, our liability is limited to the amount you paid in the last month.</p>
      </Legal>
    )
  }
  return (
    <Legal lang={lang} t={t} path="/terms" title="قوانین استفاده">
      <h2>اشتراک</h2>
      <ul>
        <li>اشتراک از لحظه‌ی پرداخت فعال می‌شود و پس از پایان مدت، خودکار تمدید نمی‌شود.</li>
        <li>با پایان اشتراک، ارسال جواب‌های خودکار متوقف می‌شود ولی تنظیمات شما پاک نمی‌شود.</li>
        <li>اگر به‌خاطر مشکل فنی ما سرویس بیش از ۲۴ ساعت قطع باشد، همان مدت به اشتراکتان اضافه می‌شود.</li>
      </ul>
      <h2>استفاده‌ی مجاز</h2>
      <ul>
        <li>فقط پیج‌هایی را وصل کنید که مالک یا مدیر مجاز آن هستید.</li>
        <li>ارسال پیام آزاردهنده، فریبنده یا مغایر با قوانین اینستاگرام و Meta ممنوع است و حساب را مسدود می‌کند.</li>
        <li>مسئولیت محتوای پیام‌هایی که تعریف می‌کنید با خود شماست.</li>
      </ul>
      <h2>محدودیت‌های اینستاگرام</h2>
      <p>دایرکتینو از API رسمی اینستاگرام استفاده می‌کند و تابع محدودیت‌های آن است؛ مثلاً پیام فقط به کسانی می‌رود که خودشان تعامل کرده‌اند.</p>
      <h2>نسخه‌ی ویندوز</h2>
      <p>نسخه‌ی ویندوز علاوه بر API رسمی، روش‌های غیررسمی را هم دارد. استفاده از آن‌ها انتخاب خود شماست و ریسک محدود شدن پیج دارد؛ اپ پیش از استفاده هشدار می‌دهد.</p>
    </Legal>
  )
}
