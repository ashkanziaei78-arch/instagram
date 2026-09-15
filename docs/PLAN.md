# پلن اپ دسکتاپ اتوماسیون اینستاگرام (IG Auto Suite)

## ۱. خلاصه‌ی محصول
یک اپ دسکتاپ (Electron + React + TypeScript + SQLite) برای مدیریت و اتوماسیون یک یا چند حساب اینستاگرام:
- کامنت → دایرکت خودکار (بر اساس کلمه/عدد)
- دایرکت خوشامد به فالوور جدید
- ارسال انبوه دایرکت هنگام انتشار پست جدید (به فالوور / فالووینگ)
- پاسخ خودکار به کلیدواژه در دایرکت
- آنالیتیکس: ویو، ریچ، لایک، کامنت، سیو، رشد فالوور
- صف کار با محدودکننده‌ی نرخ، تأخیر انسانی، سقف روزانه و ساعات سکوت

## ۲. واقعیت فنی API اینستاگرام (نتیجه‌ی تحقیق)

| قابلیت | API رسمی (Graph) | راهکار |
|---|---|---|
| وبهوک کامنت جدید | ✅ `comments` field | موتور Graph |
| Private Reply به کامنت | ✅ ۱ بلاک پیام، ۷ روز مهلت | موتور Graph |
| پاسخ عمومی به کامنت | ✅ `instagram_manage_comments` | موتور Graph |
| پیام در پنجره‌ی ۲۴ ساعته | ✅ | موتور Graph |
| **لیست فالوورها** | ❌ فقط `followers_count` | موتور Session |
| **وبهوک فالوور جدید** | ❌ وجود ندارد | Polling + دیف |
| **دایرکت انبوه به فالوورها** | ❌ نقض پنجره ۲۴ ساعته | موتور Session |
| Insights (ویو/ریچ/سیو) | ✅ | موتور Graph |

### نتیجه‌ی معماری: الگوی Strategy با دو موتور
```
IEngine (interface)
 ├── GraphEngine    → رسمی، امن، بدون ریسک بن، محدود
 └── SessionEngine  → غیررسمی، کامل، ریسک محدودیت حساب
```
هر اتوماسیون اعلام می‌کند چه قابلیتی («capability») لازم دارد؛ EngineManager موتور مناسب را انتخاب می‌کند و اگر در دسترس نبود، در UI دلیل را شفاف نشان می‌دهد.

## ۳. ساختار پوشه‌ها
```
src/
  main/      فرایند اصلی Electron: پنجره، Tray، IPC، OAuth، وب‌هوک، رمزنگاری توکن
  core/      منطق خالص Node (قابل تست بدون Electron)
    db/          SQLite + migrations + repository
    engine/      GraphEngine / SessionEngine / EngineManager
    rules/       matcher (کلمه، عدد، regex) + runner
    queue/       صف پایدار + TokenBucket + سقف روزانه + Quiet Hours
    automations/ ۴ اتوماسیون اصلی
    pollers/     فالوور، مدیا، کامنت
    analytics/   Insights + aggregation
  preload/   پل امن contextBridge
  renderer/  React + Tailwind + RTL فارسی
```

## ۴. مدل داده (SQLite)
`accounts`, `rules`, `rule_triggers`, `rule_actions`, `contacts`, `follower_snapshots`,
`media`, `media_insights`, `messages`, `comments_seen`, `jobs`, `broadcasts`,
`broadcast_targets`, `activity_log`, `settings`

## ۵. سیستم ایمنی (مهم‌ترین بخش)
1. **TokenBucket** به ازای هر حساب و هر نوع عمل
2. **سقف روزانه** قابل تنظیم (پیش‌فرض محافظه‌کارانه: ۵۰ دایرکت/روز)
3. **تأخیر انسانی** تصادفی بین اکشن‌ها (jitter)
4. **Quiet Hours** — شب ارسال نکن
5. **Spintax** — `{سلام|درود}` برای جلوگیری از پیام تکراری
6. **Dedupe** — به هر کاربر برای هر قانون فقط یک‌بار
7. **Kill Switch** — توقف فوری همه‌ی صف‌ها
8. **Warm-up** — چند روز اول با سقف پایین‌تر

## ۶. مراحل اجرا
1. اسکفولد + پیکربندی ساخت (electron-vite + builder)
2. لایه‌ی دیتابیس و مهاجرت‌ها
3. صف + محدودکننده‌ی نرخ
4. موتور Graph (OAuth، وبهوک، کامنت، پیام، Insights)
5. موتور Session (فالوور، دایرکت انبوه)
6. موتور قوانین (matcher + runner)
7. چهار اتوماسیون
8. UI فارسی RTL (۸ صفحه)
9. مستندات + بسته‌بندی ویندوز
