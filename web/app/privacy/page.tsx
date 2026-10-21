import type { Metadata } from 'next'
import Link from 'next/link'
import { Legal } from '@/components/Legal'
import { env } from '@/lib/env'
import { getDict, lp } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getDict()
  return { title: lang === 'fa' ? 'حریم خصوصی' : 'Privacy Policy' }
}

export default async function Privacy() {
  const { lang, t } = await getDict()
  const contact = env.contactEmail
  if (lang === 'en') {
    return (
      <Legal lang={lang} t={t} path="/privacy" title="Privacy Policy">
        <p>
          Directino (“we”, “us”) provides automatic replies to comments, direct messages and story interactions on Instagram
          professional accounts that our customers connect. This policy explains what data we process, why, and how you can
          have it deleted.
        </p>
        <h2>Data we collect</h2>
        <ul>
          <li><strong>Directino account:</strong> your username and a password, stored only as a salted scrypt hash.</li>
          <li>
            <strong>Connected Instagram account:</strong> the Instagram user ID and username of the professional account you
            connect, and the access token Instagram issues to us. Access tokens are encrypted at rest (AES-256-GCM).
          </li>
          <li><strong>Your automation settings:</strong> keywords, reply texts and link buttons you configure.</li>
          <li>
            <strong>Interaction data from Instagram:</strong> when someone comments on your posts, sends your account a direct
            message, or replies to or mentions your story, Instagram sends us that event (the sender’s Instagram-scoped ID,
            username where available, and the message or comment text). We use it only to decide whether one of your rules
            applies and to send the reply you configured.
          </li>
          <li><strong>Activity log:</strong> a short record of each reply sent (time, trigger, up to 500 characters).</li>
          <li><strong>Payments:</strong> plan, amount, date and the bank’s reference number. We never see or store card details.</li>
        </ul>
        <h2>How we use data</h2>
        <ul>
          <li>To send the automatic replies you set up, on your behalf, through the official Instagram API.</li>
          <li>To show you your activity log and remaining subscription time.</li>
          <li>To keep the service secure and prevent abuse.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell data, use it for advertising, build profiles of the people who message you, or share
          it with third parties, except the infrastructure providers that host the service (Vercel for hosting, Neon for the
          database) under their data-processing terms. Data received through the Instagram Platform is used in accordance with
          Meta’s Platform Terms and Developer Policies.
        </p>
        <h2>What we never collect</h2>
        <ul>
          <li>Your Instagram password. Authorization happens on Instagram’s own page; we only receive a revocable token.</li>
          <li>Your full inbox history. We only process the individual events Instagram sends us in real time.</li>
        </ul>
        <h2>Retention</h2>
        <ul>
          <li>Access tokens are kept while the Instagram account stays connected and are deleted immediately when you disconnect it.</li>
          <li>Activity-log entries are deleted automatically after 90 days.</li>
          <li>Event identifiers used to avoid duplicate replies are deleted after 7 days.</li>
          <li>Deleting your Directino account removes all of the above immediately.</li>
        </ul>
        <h2>Your choices</h2>
        <p>
          You can disconnect an Instagram account from your dashboard at any time, or remove Directino from Instagram →
          Settings → Apps and websites. To delete everything, follow the <Link href={lp(lang, '/data-deletion')}>data deletion instructions</Link>.
        </p>
        <h2>Contact</h2>
        <p>{contact ? <>Questions about this policy: <a href={'mailto:' + contact}>{contact}</a></> : 'Questions about this policy can be sent through the support contact shown in your dashboard.'}</p>
      </Legal>
    )
  }
  return (
    <Legal lang={lang} t={t} path="/privacy" title="حریم خصوصی">
      <p>دایرکتینو ابزاری برای جواب خودکار به کامنت‌ها، دایرکت‌ها و استوری‌های پیج‌های حرفه‌ای اینستاگرام است که مشتری‌ها خودشان وصل می‌کنند. این صفحه می‌گوید چه اطلاعاتی نگه می‌داریم، چرا، و چطور پاکش کنید.</p>
      <h2>چه چیزی ذخیره می‌کنیم</h2>
      <ul>
        <li><strong>حساب دایرکتینو:</strong> نام کاربری و رمز (رمز فقط به‌صورت هش غیرقابل‌برگشت).</li>
        <li><strong>پیج وصل‌شده:</strong> شناسه و نام کاربری پیج و توکن دسترسی‌ای که اینستاگرام می‌دهد؛ توکن رمزنگاری‌شده (AES-256-GCM) نگه داشته می‌شود.</li>
        <li><strong>تنظیمات شما:</strong> کلیدواژه‌ها، متن جواب‌ها و دکمه‌های لینک.</li>
        <li><strong>رویدادهای اینستاگرام:</strong> وقتی کسی کامنت می‌گذارد، دایرکت می‌دهد یا به استوری جواب می‌دهد، اینستاگرام آن رویداد را برای ما می‌فرستد. فقط برای تشخیص قانون مناسب و فرستادن جواب شما استفاده می‌شود.</li>
        <li><strong>گزارش کارها:</strong> خلاصه‌ی هر جواب ارسال‌شده (زمان، نوع، حداکثر ۵۰۰ کاراکتر).</li>
        <li><strong>پرداخت‌ها:</strong> پلن، مبلغ، تاریخ و کد پیگیری بانک. اطلاعات کارت هرگز به ما نمی‌رسد.</li>
      </ul>
      <h2>استفاده و اشتراک‌گذاری</h2>
      <p>داده‌ها فقط برای فرستادن جواب‌های خودکاری که خودتان تعریف کرده‌اید، از طریق API رسمی اینستاگرام، استفاده می‌شوند. به هیچ شخص ثالثی فروخته یا داده نمی‌شوند و برای تبلیغات استفاده نمی‌شوند؛ جز سرویس‌دهنده‌های زیرساخت (Vercel برای میزبانی و Neon برای دیتابیس). داده‌های دریافتی از اینستاگرام طبق قوانین پلتفرم Meta استفاده می‌شوند.</p>
      <h2>چه چیزی ذخیره نمی‌کنیم</h2>
      <ul>
        <li>رمز اینستاگرام شما — ورود در صفحه‌ی رسمی اینستاگرام انجام می‌شود.</li>
        <li>تاریخچه‌ی کامل دایرکت‌ها؛ فقط همان رویدادی که باید به آن جواب بدهیم پردازش می‌شود.</li>
      </ul>
      <h2>مدت نگهداری</h2>
      <ul>
        <li>توکن تا وقتی پیج وصل است می‌ماند و با «قطع اتصال» همان لحظه پاک می‌شود.</li>
        <li>گزارش کارها بعد از ۹۰ روز خودکار پاک می‌شود.</li>
        <li>با حذف حساب دایرکتینو، همه‌ی موارد بالا فوراً پاک می‌شوند.</li>
      </ul>
      <h2>حذف</h2>
      <p>راهنمای کامل در <Link href={lp(lang, '/data-deletion')}>صفحه‌ی حذف اطلاعات</Link> است.</p>
      {contact && <p>ارتباط: <a href={'mailto:' + contact}>{contact}</a></p>}
    </Legal>
  )
}
