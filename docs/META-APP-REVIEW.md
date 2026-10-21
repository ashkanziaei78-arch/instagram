# دایرکتینو — راهنمای App Review متا

هر متنی که داخل جعبه‌ی کد است را **همان‌طور** در فرم متا کپی کنید (انگلیسی).
آدرس‌ها برای `directino.vercel.app` نوشته شده‌اند؛ اگر دامنه عوض شد، همه را عوض کنید.

---

## ۱. App settings → Basic

| فیلد | مقدار |
|---|---|
| Display name | `Directino` |
| App icon (1024×1024) | `web/public/brand/icon-1024.png` — یا از `https://directino.vercel.app/brand/icon-1024.png` دانلود کنید |
| Privacy Policy URL | `https://directino.vercel.app/en/privacy` |
| Terms of Service URL | `https://directino.vercel.app/en/terms` |
| User data deletion → Instructions URL | `https://directino.vercel.app/en/data-deletion` |
| Category | `Business and pages` |
| App domains | `directino.vercel.app` |
| Contact email | ایمیلی که واقعاً جواب می‌دهید (همان را در Vercel به‌عنوان `NEXT_PUBLIC_CONTACT_EMAIL` بگذارید تا در صفحه‌ی حریم خصوصی هم بیاید) |

## ۲. Instagram → API setup with Instagram login

- **Business login settings → OAuth redirect URIs:** `https://directino.vercel.app/oauth/instagram`
- **Webhooks → Callback URL:** `https://directino.vercel.app/api/webhook/instagram`
- **Verify token:** همان مقدار `WEBHOOK_VERIFY_TOKEN` در Vercel
- **Subscribe:** `comments`، `messages`

## ۳. حساب تست برای بازبین

در Vercel دو متغیر `REVIEWER_USERNAME` و `REVIEWER_PASSWORD` تنظیم شده‌اند؛ سایت این حساب را خودکار
می‌سازد و همیشه دست‌کم ۳۰ روز اشتراک دارد. در فرم App Review، بخش **Test credentials / Instructions**:

```
1. Open https://directino.vercel.app/en/login
2. Log in with:
   Username: <REVIEWER_USERNAME>
   Password: <REVIEWER_PASSWORD>
   (The account already has an active subscription, no payment needed.)
3. Click "+ Connect account" and authorize with an Instagram professional
   (Business or Creator) account that has a role on this app.
4. Under "New auto-reply", click the "Product link" template, choose the
   connected account and click "Save and activate".
5. From a different Instagram account, comment "1" on any post of the
   connected account. Within a few seconds that commenter receives a DM
   with the link, and the event appears under "Recent activity".
6. Send the connected account a DM containing "price" (after adding the
   "Price list" template) to see a direct-message auto-reply.
```

## ۴. متن هر مجوز (Permissions and Features → Request advanced access)

### instagram_business_basic

```
Directino is a customer-service automation tool for Instagram professional
accounts. After a business owner connects their account with Instagram
Login, we use instagram_business_basic to read the account's user ID and
username. We show the username in the dashboard so the owner can see which
account is connected and choose it when creating auto-replies, and we use
the user ID to match incoming webhook events to the right customer. We do
not access any other profile data and we do not use it for advertising.
```

### instagram_business_manage_comments

```
Business owners create keyword rules such as "if someone comments '1' on my
post, send them the product link". We receive comment events through the
comments webhook, check the comment text against the owner's rules, and then:
(1) send a private reply to the commenter using the comment_id, and
(2) optionally post a short public reply under that comment (for example
"Check your DMs"), only when the owner has enabled it for that rule.
We only act on comments made on the connected account's own media, and only
according to rules the owner created. The screencast shows the rule being
created, a test comment, the private reply arriving and the public reply.
```

### instagram_business_manage_messages

```
Directino sends the private reply DM triggered by a comment, and it answers
direct messages and story replies/mentions that contain keywords the owner
configured (e.g. "price" -> price list, "hours" -> opening hours). We receive
these through the messages webhook and reply within the 24-hour messaging
window using the Instagram messaging API. We never initiate conversations
with people who have not interacted with the business first, and we do not
send promotional broadcasts. Message content is processed in real time only
to select the configured reply; we keep a short activity log (max 500
characters per entry) that is deleted after 90 days.
```

## ۵. سناریوی ویدیو (screencast)

یک ویدیوی ۲ تا ۴ دقیقه‌ای، با رابط **انگلیسی** (`/en`). صدا لازم نیست؛ اگر خواستید زیرنویس انگلیسی بگذارید.
یک ویدیو برای هر سه مجوز کافی است، ولی در فرم هر مجوز همان ویدیو را آپلود کنید.

1. **0:00** — صفحه‌ی `https://directino.vercel.app/en` را نشان دهید (نام اپ و توضیح).
2. **0:15** — Log in با حساب تست.
3. **0:30** — **+ Connect account** ← صفحه‌ی اجازه‌ی اینستاگرام کامل دیده شود (نام اپ، مجوزها) ← **Allow** ← برگشت به پنل و نمایش `@username` وصل‌شده.
   *(این بخش `instagram_business_basic` را نشان می‌دهد)*
4. **1:00** — قالب **Product link** ← انتخاب پیج ← لینک دکمه ← **Save and activate**.
5. **1:20** — گوشی دوم یا مرورگر دیگر: از یک حساب دیگر زیر پست پیج «1» کامنت بگذارید.
6. **1:35** — نشان دهید: دایرکت با دکمه‌ی لینک رسید + جواب عمومی زیر کامنت.
   *(این بخش `instagram_business_manage_comments` و `manage_messages` را نشان می‌دهد)*
7. **2:00** — قالب **Price list** را بسازید؛ از حساب دوم دایرکت «price» بفرستید؛ جواب برسد.
8. **2:30** — برگشت به پنل: **Recent activity** هر دو رویداد را نشان دهد.
9. **2:45** — **Disconnect** و صفحه‌ی `/en/data-deletion` را کوتاه نشان دهید.

نکته: قبل از ضبط، حساب دوم را هم در **App roles → Instagram Testers** اضافه کنید، چون تا قبل از تأیید، فقط
حساب‌های دارای نقش رویداد تولید می‌کنند.

## ۶. Data handling (سؤال‌های فرم)

- **Do you share data with third parties?** No — only infrastructure processors (Vercel hosting, Neon database).
- **Where is data stored?** Vercel (Frankfurt region) and Neon Postgres.
- **Data retention:** tokens until disconnect; activity log 90 days; dedupe IDs 7 days.
- **Deletion:** in-app "Delete account" (immediate) + instructions URL above.

## ۷. ترتیب کار

1. Business Verification در business.facebook.com (پیش‌نیاز Advanced Access).
2. اپ را به همان Business Portfolio وصل کنید (App settings → Basic → Business portfolio).
3. بخش ۱ و ۲ این فایل.
4. ضبط ویدیو (بخش ۵).
5. App Review → درخواست Advanced Access برای سه مجوز با متن‌های بخش ۴ و حساب تست بخش ۳.
6. بعد از تأیید: اپ را **Live/Published** کنید.
