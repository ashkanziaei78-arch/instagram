# دایرکتینو — راه‌اندازی نسخه‌ی فروشی

## چه چیزی کجاست

| بخش | کجا | کار |
|---|---|---|
| سایت + پنل موبایل | `web/` (Next.js) | فروش اشتراک، ورود مشتری، اتصال پیج، جواب خودکار از روی سرور |
| اپ ویندوز | ریشه‌ی مخزن (Electron) | همان حساب سایت؛ امکانات بیشتر (صندوق دایرکت، پیام گروهی، هوش مصنوعی) |

**سایت فقط از API رسمی اینستاگرام استفاده می‌کند**؛ رمز پیج مشتری هرگز گرفته نمی‌شود و ریسک بن ندارد.
روش‌های غیررسمی (ورود ساده / sessionid) فقط در اپ ویندوز هستند و همان‌جا هشدار ریسک دارند —
اگر آن‌ها را برای صدها مشتری روی یک سرور اجرا کنید، اینستاگرام IP سرور را می‌گیرد و پیج‌ها قفل می‌شوند.

---

## ۱. ساخت سایت روی Vercel

1. به <https://vercel.com/new> بروید و مخزن `ashkanziaei78-arch/instagram` را Import کنید.
2. **Root Directory** را روی `web` بگذارید (Framework خودش Next.js تشخیص داده می‌شود).
3. قبل از Deploy، متغیرهای بخش ۳ را وارد کنید و Deploy بزنید.
4. بعد از ساخت: Settings → Git → **Production Branch** را `main-f61xuh` بگذارید (یا این شاخه را در `main` ادغام کنید).
5. آدرسی که Vercel داد (مثلا `https://directino.vercel.app`) را در `NEXT_PUBLIC_SITE_URL` بگذارید و یک بار Redeploy کنید.

## ۲. دیتابیس

ساده‌ترین: در پروژه‌ی Vercel → تب **Storage** → **Neon (Postgres)** → Create. خودش `DATABASE_URL` را اضافه می‌کند.
جدول‌ها (با پیشوند `dx_`) اولین بار خودکار ساخته می‌شوند.

جایگزین: هر Postgres دیگری (Supabase، یا Postgres روی هاست ویندوزی). روی Postgres محلی بدون SSL، `DATABASE_SSL=disable` بگذارید.

## ۳. متغیرهای محیطی

| نام | مقدار |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | آدرس سایت بدون `/` آخر |
| `DATABASE_URL` | از بخش ۲ |
| `SESSION_SECRET` | یک رشته‌ی تصادفی ۴۰ کاراکتری. **بعداً عوضش نکنید** — توکن‌های اینستاگرام با آن رمز شده‌اند |
| `IG_APP_ID` / `IG_APP_SECRET` | Instagram App ID و Secret (نه Facebook) |
| `WEBHOOK_VERIFY_TOKEN` | یک رشته‌ی دلخواه؛ همان را در متا هم می‌نویسید |
| `ADMIN_USERNAME` | نام کاربری‌ای که با ثبت‌نامش مدیر می‌شوید. **بلافاصله بعد از Deploy همین را ثبت‌نام کنید** |
| `CRON_SECRET` | رشته‌ی تصادفی؛ Vercel خودش با آن کران روزانه‌ی تازه‌سازی توکن را صدا می‌زند |
| `ZARINPAL_MERCHANT_ID` | مرچنت زرین‌پال. خالی = پرداخت کارت‌به‌کارت و فعال‌سازی دستی |
| `ZARINPAL_SANDBOX` | `1` برای تست |
| `MANUAL_PAY_CARD` / `MANUAL_PAY_CONTACT` | شماره کارت و راه ارتباط (تلگرام/واتساپ) برای پرداخت دستی |
| `NEXT_PUBLIC_DESKTOP_URL` | لینک دانلود اپ ویندوز (فقط به مشتری فعال نشان داده می‌شود) |

## ۴. تنظیمات داشبورد متا

در developers.facebook.com → اپ → Instagram → API setup with Instagram login:

- **Business login settings → OAuth redirect URIs:** `<سایت>/oauth/instagram`
- **Webhooks → Callback URL:** `<سایت>/api/webhook/instagram` — Verify token همان `WEBHOOK_VERIFY_TOKEN`؛ فیلدهای `comments` و `messages` را Subscribe کنید.
- **App settings → Basic:** Privacy Policy = `<سایت>/privacy`، Terms = `<سایت>/terms`، User data deletion = `<سایت>/data-deletion`
- اپ را **Publish** کنید (در حالت Unpublished، متا رویدادها و لیست‌ها را خالی می‌دهد).

### فروش به پیج‌های دیگر

راهنمای کامل App Review با متن‌های آماده: [META-APP-REVIEW.md](META-APP-REVIEW.md)

تا وقتی اپ در حالت Development/Standard Access است، فقط پیج‌هایی که در Roles به‌عنوان Tester اضافه شده‌اند
(و دعوت را از مرورگر دسکتاپ پذیرفته‌اند) می‌توانند وصل شوند. برای مشتری واقعی لازم است:

1. **Business Verification** (مدارک کسب‌وکار؛ برای شرکت ایرانی دشوار است — معمولا با شرکت/شخص خارج از ایران انجام می‌شود).
2. **App Review** برای `instagram_business_basic`، `instagram_business_manage_messages`، `instagram_business_manage_comments` با **Advanced Access**.
   ویدیوی ضبط‌شده از همین سایت (اتصال پیج → ساخت جواب → کامنت → رسیدن دایرکت) را بفرستید.

## ۵. پرداخت

- با `ZARINPAL_MERCHANT_ID`: دکمه‌های خرید مستقیم به درگاه می‌روند و بعد از تأیید بانک، روزها خودکار اضافه می‌شوند.
  آدرس بازگشت `<سایت>/pay/callback` است؛ دامنه باید در پنل زرین‌پال ثبت شده باشد.
- بدون مرچنت: مشتری به صفحه‌ی کارت‌به‌کارت می‌رود؛ شما در `<سایت>/admin` نام کاربری + تعداد روز (۳۰ یا ۹۰) را وارد می‌کنید.

## ۶. اپ ویندوز با اشتراک

در `.env.local` ریشه:

```
DIRECTINO_SITE_URL=https://directino.vercel.app
IG_APP_ID=
IG_APP_SECRET=
```

`IG_APP_SECRET` را **خالی** بگذارید: اتصال رسمی از راه سایت انجام می‌شود و Secret داخل فایل اجرایی نمی‌رود.
بعد `npm run pack:win`. اپ موقع باز شدن نام کاربری و رمز سایت را می‌خواهد، روزهای باقی‌مانده را در نوار کناری نشان می‌دهد
و اگر اشتراک تمام شود اتوماسیون‌ها را متوقف می‌کند (تا ۳ روز آفلاین کار می‌کند).

پوشه‌ی داده‌ی قبلی (`IG Auto Suite`) نگه داشته می‌شود؛ مشتری‌های نسخه‌ی قبل چیزی از دست نمی‌دهند.

## ۷. انتقال به هاست ویندوزی (بعداً)

```
cd web
npm ci
npm run build
```

پوشه‌های `web/.next/standalone`، `web/.next/static` (به `standalone/.next/static`) و `web/public` (به `standalone/public`) را روی سرور کپی کنید و
`node server.js` را با همان متغیرهای محیطی اجرا کنید (مثلا با `pm2` یا NSSM به‌عنوان سرویس ویندوز).
در IIS با **URL Rewrite + ARR** دامنه را به `http://localhost:3000` بفرستید و SSL را روی IIS بگذارید.
کران روزانه: Task Scheduler هر روز `curl -H "Authorization: Bearer <CRON_SECRET>" <سایت>/api/cron/refresh`.
بعد از عوض شدن دامنه، Redirect URI و Webhook را در متا و `NEXT_PUBLIC_SITE_URL` را به‌روز کنید.

## ۸. عکس‌ها

عکس‌ها از Shutterstock انتخاب شده‌اند ولی پیش‌نمایش Shutterstock واترمارک دارد و بدون لایسنس قابل استفاده‌ی تجاری نیست؛
تا خرید، معادل رایگان Unsplash نمایش داده می‌شود. بعد از خرید:

- [شماره‌ی 1629730711](https://www.shutterstock.com/image-photo/vlogging-cinematic-portrait-handsome-stylish-woman-1629730711) → `web/public/img/hero-neon.jpg`
- [شماره‌ی 2351507029](https://www.shutterstock.com/image-photo/unlock-achievements-asian-male-online-shop-2351507029) → `web/public/img/night-shop.jpg`

و در `web/lib/images.ts` مقدار `licensed` همان عکس را `true` کنید.

## ۹. فونت

فونت دانا (DanaFaNum) تجاری است. مخزن فعلاً عمومی است، پس فایل‌های فونت برای همه قابل دانلودند؛
اگر لایسنس شما اجازه‌ی انتشار فایل را نمی‌دهد، مخزن را Private کنید (Vercel با مخزن خصوصی هم کار می‌کند).
