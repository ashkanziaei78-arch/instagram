/**
 * همه‌ی متن‌های سایت به دو زبان. ساختار en باید دقیقاً مثل fa باشد —
 * TypeScript جاافتادن هر کلید را خطا می‌گیرد.
 */

import { appEn, appFa } from './dict-app'

const fa = {
  meta: {
    title: 'دایرکتینو — جواب خودکار کامنت و دایرکت اینستاگرام',
    description:
      'دایرکتینو به کامنت، دایرکت و استوری‌های پیج اینستاگرام شما همان لحظه جواب می‌دهد؛ با API رسمی اینستاگرام و بدون گرفتن رمز پیج.'
  },
  nav: {
    how: 'چطور کار می‌کند',
    templates: 'امکانات',
    safety: 'امنیت پیج',
    pricing: 'قیمت‌ها',
    faq: 'سوال‌ها',
    login: 'ورود',
    signup: 'ثبت‌نام',
    switchLang: 'English',
    switchLangShort: 'EN'
  },
  hero: {
    eyebrow: 'برای پیج‌های فروشگاهی، آموزشی و خدماتی',
    h1a: 'هر کامنت،',
    h1b: 'یک دایرکت.',
    sub: 'کسی زیر پستتان می‌نویسد «۱» یا «قیمت»؛ دایرکتینو همان لحظه برایش دایرکت می‌فرستد — لینک خرید، لیست قیمت، کد تخفیف. با API رسمی اینستاگرام، بدون اینکه رمز پیج را به کسی بدهید.',
    ctaBuy: 'خرید اشتراک',
    ctaHow: 'راه‌اندازی چطور است؟',
    ticks: ['رمز اینستاگرام نمی‌خواهیم', 'روی گوشی و ویندوز', 'شبانه‌روز، حتی وقتی خوابید']
  },
  demo: {
    aria: 'نمایش: کسی زیر پست عدد ۱ را کامنت می‌کند و دایرکتینو همان لحظه برایش دایرکت لینک می‌فرستد',
    labels: ['', 'کامنت رسید', 'دایرکتینو دید', 'در حال نوشتن…', 'دایرکت رفت، در ۲ ثانیه', 'مشتری جواب داد', 'در حال نوشتن…', 'جواب سوال هم رفت', ''],
    account: 'mahtab.manto',
    postKicker: 'کالکشن پاییزه',
    postTitle: 'مانتو کتان',
    postSub: '۷ رنگ',
    postCta: 'برای لینک خرید «۱» کامنت کن',
    likes: '۲۴۸ لایک',
    c1: 'رنگ طوسی هم داره؟',
    one: '۱',
    fromComment: 'از کامنت پست شما',
    dm1a: 'سلام سارا 👋 لینک خرید مانتو کتان اینجاست. کد ',
    dm1b: ' هم ۱۰٪ تخفیف دارد.',
    code: 'PAEEZ',
    button: 'دیدن محصول',
    reply: 'مرسی! سایز L هم داره؟',
    dm2: 'بله، M و L و XL موجوده ✨'
  },
  scenarios: {
    title: 'مشتری هرجا پیام بدهد، همان‌جا جواب می‌گیرد.',
    sub: 'سه جایی که بیشترِ فروش اینستاگرامی از دست می‌رود — چون جواب دیر رسید.',
    items: [
      {
        where: 'زیر پست',
        them: '۱',
        us: 'سلام 👋 این هم لینک خرید. موجودی محدوده، زودتر سفارش بده.',
        rule: 'اگر کسی «۱» کامنت کرد ← لینک محصول به دایرکتش برود',
        also: 'زیر کامنتش هم می‌نویسد: «دایرکتت رو چک کن 💌»'
      },
      {
        where: 'در دایرکت',
        them: 'قیمت؟',
        us: 'تیشرت نخی ۴۸۰ / هودی ۹۲۰ / ست ۱٫۲ میلیون. ارسال به همه‌جای ایران 🚚',
        rule: 'اگر در دایرکت «قیمت» آمد ← لیست قیمت',
        also: 'برای «آدرس»، «ساعت کاری» و «ارسال» هم جواب جدا بگذارید'
      },
      {
        where: 'روی استوری',
        them: '🔥 (جواب به استوری)',
        us: 'ممنون که دیدی! کد STORY20 تا آخر شب ۲۰٪ تخفیف داره.',
        rule: 'اگر کسی به استوری جواب داد یا منشنتان کرد ← کد تخفیف',
        also: 'هر کسی پیج شما را در استوری‌اش منشن کند هم پیام تشکر می‌گیرد'
      }
    ]
  },
  features: {
    title: 'همه‌چیز در یک پنل',
    sub: 'هرچه برای فروش از دایرکت لازم دارید — بدون نصب چند ابزار جدا.',
    items: [
      ['جواب کامنت و دایرکت', 'کلیدواژه، پست خاص، چند نسخه‌ی متن تا تکراری نشود، و دکمه‌ی لینک.'],
      ['اول فالو کن', 'لینک فقط به کسی می‌رسد که پیج را فالو کرده؛ بقیه پیام «اول فالو کن» می‌گیرند.'],
      ['فرم و جمع‌آوری شماره', 'بعد از جواب، نام، شماره یا ایمیل مشتری را می‌پرسد و ذخیره می‌کند.'],
      ['ویترین محصولات', 'محصولات به‌صورت کارت‌های عکس‌دار با دکمه‌ی خرید در دایرکت.'],
      ['مخاطبان و برچسب', 'همه‌ی کامنت‌گذارها و پیام‌دهنده‌ها با برچسب، جستجو و خروجی اکسل.'],
      ['جواب هوشمند', 'هوش مصنوعی (ChatGPT، Gemini، Grok…) وقتی هیچ جوابی جور نشد.'],
      ['قرعه‌کشی و فیلتر کامنت', 'انتخاب برنده از کامنت‌ها و مخفی کردن کامنت‌های اسپم.'],
      ['آمار و نمودار', 'پیام‌های هر روز، منبع پیام‌ها و پرکارترین جواب‌ها.']
    ] as [string, string][]
  },
  templates: {
    title: 'از یک قالب شروع کنید',
    sub: 'همان سناریوهایی که پیج‌های فروشگاهی هر روز استفاده می‌کنند. در پنل با یک کلیک پر می‌شوند؛ فقط متن را شخصی کنید.',
    when: 'وقتی',
    then: 'دایرکتینو',
    items: [
      { name: 'لینک محصول', when: 'کسی «۱» یا «لینک» کامنت کند', then: 'لینک خرید با دکمه به دایرکتش می‌رود' },
      { name: 'لیست قیمت', when: 'در دایرکت «قیمت» بپرسد', then: 'لیست قیمت و شرایط ارسال را می‌فرستد' },
      { name: 'کد تخفیف استوری', when: 'به استوری شما جواب بدهد', then: 'کد تخفیف همان شب را می‌فرستد' },
      { name: 'تشکر از منشن', when: 'شما را در استوری‌اش منشن کند', then: 'پیام تشکر و هدیه‌ی کوچک می‌فرستد' },
      { name: 'قرعه‌کشی', when: 'زیر پست قرعه‌کشی کامنت بگذارد', then: 'ثبت‌نامش را تأیید و قوانین را می‌فرستد' },
      { name: 'سوال‌های تکراری', when: 'بپرسد «آدرس»، «ساعت کاری» یا «ارسال»', then: 'جواب آماده‌ی همان سوال را می‌دهد' }
    ]
  },
  usecases: {
    title: 'برای چه کسانی است؟',
    tabs: [
      {
        label: 'فروشگاه‌ها',
        head: 'هر پست، یک ویترین که خودش جواب می‌دهد',
        points: ['لینک محصول با یک کامنت', 'لیست قیمت و سایزبندی در دایرکت', 'کد تخفیف برای کسانی که استوری را می‌بینند'],
        example: 'کامنت «۱» ← لینک خرید'
      },
      {
        label: 'مدرس‌ها و دوره‌ها',
        head: 'ثبت‌نام دوره بدون جواب دادن تک‌تک',
        points: ['لینک ثبت‌نام برای هر کس «دوره» کامنت کند', 'سرفصل‌ها و قیمت در دایرکت', 'جلسه‌ی رایگان برای جواب‌دهندگان استوری'],
        example: 'کامنت «دوره» ← لینک ثبت‌نام'
      },
      {
        label: 'تولیدکننده‌های محتوا',
        head: 'فایل و لینک را به همه برسانید',
        points: ['ارسال فایل رایگان (چک‌لیست، پی‌دی‌اف) با یک کلمه', 'تشکر خودکار از منشن‌ها', 'لینک همکاری و تبلیغات در دایرکت'],
        example: 'کامنت «فایل» ← لینک دانلود'
      },
      {
        label: 'کلینیک و خدمات',
        head: 'نوبت‌گیری بدون منشی',
        points: ['لینک نوبت‌دهی با کلمه‌ی «نوبت»', 'ساعت کاری و آدرس برای سوال‌های تکراری', 'جواب به استوری‌های پیشنهاد ویژه'],
        example: 'دایرکت «نوبت» ← لینک رزرو'
      }
    ]
  },
  night: {
    time: '۲:۱۴ بامداد',
    l1: 'کسی زیر پستتان نوشته «قیمت؟».',
    l2: 'شما خوابید. جوابش رفته؛ صبح فقط سفارش را می‌بینید.'
  },
  how: {
    title: 'راه‌اندازی، کمتر از ده دقیقه',
    steps: [
      {
        title: 'ثبت‌نام و اشتراک',
        body: 'یک نام کاربری و رمز برای دایرکتینو می‌سازید و اشتراک را با درگاه بانکی پرداخت می‌کنید. روزهای باقی‌مانده همیشه در پنلتان پیداست.'
      },
      {
        title: 'وصل کردن پیج',
        body: 'دکمه‌ی «اتصال پیج» صفحه‌ی رسمی خود اینستاگرام را باز می‌کند. آنجا وارد می‌شوید و «اجازه» می‌دهید. رمزتان فقط در سایت اینستاگرام تایپ می‌شود.'
      },
      {
        title: 'نوشتن جواب‌ها',
        body: 'یک قالب انتخاب می‌کنید یا می‌نویسید «اگر کسی ۱ کامنت کرد، این پیام برود». از همین لحظه دایرکتینو روی سرور بیدار است — گوشی و کامپیوترتان لازم نیست روشن باشد.'
      }
    ],
    note: 'پیج باید «حرفه‌ای» باشد (Business یا Creator). تبدیلش رایگان است و از تنظیمات خود اینستاگرام دو دقیقه طول می‌کشد.'
  },
  safety: {
    title: 'رمز پیج را از شما نمی‌خواهیم.',
    p1: 'بیشتر ابزارهای ایرانی با رمز پیج کار می‌کنند و از سرور خودشان به جای شما وارد اینستاگرام می‌شوند. همین چیزی است که پیج‌ها را به «تأیید هویت» و مسدودی می‌کشاند. دایرکتینو از API رسمی اینستاگرام استفاده می‌کند؛ همان راهی که ابزارهای بزرگ دنیا استفاده می‌کنند.',
    p2: 'صادقانه: API رسمی محدودیت هم دارد. فقط به کسی می‌شود دایرکت داد که کامنت گذاشته، به استوری جواب داده یا در ۲۴ ساعت گذشته پیام داده. پیام انبوه به همه‌ی فالوورها با راه رسمی ممکن نیست — و همین است که پیج شما را امن نگه می‌دارد.',
    us: 'دایرکتینو',
    them: 'ابزارهای رمزی',
    rows: [
      ['نحوه‌ی اتصال', 'صفحه‌ی رسمی اینستاگرام و دکمه‌ی «اجازه»', 'رمز پیج را به آن‌ها می‌دهید'],
      ['ریسک مسدود شدن پیج', 'ندارد — همان راهی که خود متا ساخته', 'بالا؛ اینستاگرام ورود از سرورهای ناشناس را می‌گیرد'],
      ['اگر رمز پیج را عوض کنید', 'چیزی قطع نمی‌شود', 'همه‌چیز از کار می‌افتد'],
      ['قطع دسترسی', 'هر وقت بخواهید، از تنظیمات اینستاگرام', 'باید رمز را عوض کنید']
    ] as [string, string, string][]
  },
  pricing: {
    title: 'قیمت‌ها',
    sub: 'همه‌ی امکانات در همه‌ی پلن‌ها هست؛ فقط مدت فرق می‌کند.',
    plans: { m1: 'یک‌ماهه', m3: 'سه‌ماهه', m6: 'شش‌ماهه' } as Record<string, string>,
    notes: { m3: 'ماهی حدود ۳۳۳ هزار تومان' } as Record<string, string>,
    days: 'روز',
    best: 'به‌صرفه‌تر',
    soon: 'به‌زودی',
    notActive: 'این پلن هنوز فعال نشده',
    unit: 'تومان',
    buy: 'خرید',
    included: ['جواب خودکار کامنت، دایرکت و استوری', 'دکمه‌ی لینک داخل دایرکت', 'پنل موبایل و نسخه‌ی ویندوز', 'گزارش همه‌ی پیام‌های فرستاده‌شده']
  },
  platforms: {
    phoneKicker: 'روی گوشی',
    phoneTitle: 'بدون نصب از استور',
    phoneBody: 'پنل را در مرورگر گوشی باز کنید و «افزودن به صفحه‌ی اصلی» را بزنید. مثل یک اپ کنار بقیه‌ی اپ‌ها می‌نشیند؛ روی اندروید و آیفون.',
    winKicker: 'روی ویندوز',
    winTitle: 'نسخه‌ی دسکتاپ برای کارهای بیشتر',
    winBody: 'صندوق دایرکت، پیام گروهی و جواب هوشمند با هوش مصنوعی. لینک دانلود بعد از خرید اشتراک در پنلتان است و با همان نام کاربری وارد می‌شوید.'
  },
  faq: {
    title: 'سوال‌های رایج',
    items: [
      ['پیجم بن نمی‌شود؟', 'دایرکتینو روی سایت فقط از API رسمی اینستاگرام استفاده می‌کند و رمز پیج را هرگز نمی‌گیرد؛ از نگاه اینستاگرام مثل هر ابزار رسمی دیگری است. فقط پیام تکراری و آزاردهنده نفرستید — آن را خود کاربران گزارش می‌کنند، نه ابزار.'],
      ['چه نوع پیجی لازم است؟', 'پیج حرفه‌ای (Business یا Creator). صفحه‌ی فیسبوک لازم نیست. اگر پیجتان شخصی است، از تنظیمات اینستاگرام «تغییر به حساب حرفه‌ای» را بزنید.'],
      ['می‌شود به همه‌ی فالوورها پیام گروهی داد؟', 'با API رسمی نه؛ اینستاگرام فقط اجازه می‌دهد به کسی پیام بدهید که خودش اول تعامل کرده. نسخه‌ی ویندوز امکان پیام گروهی دارد ولی با روش غیررسمی، و آنجا خودش هشدار ریسک را نشان می‌دهد.'],
      ['اشتراک تمام شود چه می‌شود؟', 'جواب‌های خودکار متوقف می‌شوند ولی هیچ‌چیز پاک نمی‌شود. با تمدید، همه‌چیز از همان‌جا ادامه پیدا می‌کند.'],
      ['پرداخت چطور است؟', 'با درگاه بانکی (کارت‌های عضو شتاب). بعد از پرداخت، روزهای اشتراک فوراً به حسابتان اضافه می‌شود.'],
      ['گوشی یا کامپیوترم باید روشن بماند؟', 'نه. جواب‌ها از سرور دایرکتینو می‌رود؛ حتی اگر گوشی خاموش باشد.']
    ] as [string, string][]
  },
  final: {
    title: 'پست بعدی‌تان را با «۱ کامنت کن» منتشر کنید.',
    sub: 'ماهانه ۴۰۰٬۰۰۰ تومان — بدون قرارداد، هر وقت خواستید تمدید نکنید.',
    cta: 'شروع کنید'
  },
  footer: {
    tagline: 'جواب خودکار کامنت و دایرکت اینستاگرام، با API رسمی.',
    privacy: 'حریم خصوصی',
    terms: 'قوانین استفاده',
    deletion: 'حذف اطلاعات',
    customers: 'ورود مشتری‌ها',
    disclaimer: 'Instagram نشان تجاری Meta است و دایرکتینو وابسته به Meta نیست. عکس‌ها:'
  },
  auth: {
    username: 'نام کاربری',
    usernameHint: 'حروف انگلیسی کوچک، عدد، نقطه یا _',
    password: 'رمز',
    passwordHint: 'دست‌کم ۸ کاراکتر — این رمز دایرکتینو است، نه رمز اینستاگرام',
    wait: 'صبر کنید…',
    create: 'ساخت حساب',
    login: 'ورود',
    haveAccount: 'حساب دارید؟ ',
    noAccount: 'حساب ندارید؟ ',
    goLogin: 'وارد شوید',
    goSignup: 'ثبت‌نام کنید',
    loginTitle: 'ورود به پنل',
    loginSub: 'با نام کاربری و رمزی که موقع ثبت‌نام ساختید.',
    signupTitle: 'ساخت حساب',
    signupSub: 'یک نام کاربری و رمز برای دایرکتینو بسازید. با همین وارد پنل موبایل و نسخه‌ی ویندوز می‌شوید.',
    errUsername: 'نام کاربری: ۳ تا ۳۲ حرف انگلیسی کوچک، عدد، نقطه یا _',
    errPassword: 'رمز باید دست‌کم ۸ کاراکتر باشد',
    errTaken: 'این نام کاربری قبلاً گرفته شده',
    errWrong: 'نام کاربری یا رمز درست نیست',
    errGeneric: 'مشکلی پیش آمد؛ چند لحظه بعد دوباره امتحان کنید',
    errNoDb: 'دیتابیس وصل نیست — DATABASE_URL را در تنظیمات هاست بگذارید'
  },
  dash: {
    title: 'پنل من',
    admin: 'مدیریت',
    logout: 'خروج',
    flash: {
      'ig=ok': 'پیج وصل شد. حالا یک جواب خودکار بسازید.',
      'ig=denied': 'اتصال لغو شد؛ در صفحه‌ی اینستاگرام «اجازه» زده نشد.',
      'ig=error': 'اینستاگرام اتصال را نپذیرفت. پیج باید حرفه‌ای (Business یا Creator) باشد؛ دوباره امتحان کنید.',
      'ig=expired': 'زمان اتصال تمام شد؛ دوباره «اتصال پیج» را بزنید.',
      'ig=setup': 'اتصال اینستاگرام هنوز روی سرور تنظیم نشده. با پشتیبانی تماس بگیرید.',
      'pay=ok': 'پرداخت موفق بود و اشتراک تمدید شد.',
      'pay=cancelled': 'پرداخت لغو شد. مبلغی کم نشده؛ اگر کم شده باشد تا ۷۲ ساعت برمی‌گردد.',
      'pay=failed': 'بانک پرداخت را تأیید نکرد. اگر مبلغ کم شده، تا ۷۲ ساعت برمی‌گردد.',
      'pay=gateway': 'درگاه پرداخت در دسترس نیست؛ چند دقیقه بعد امتحان کنید.',
      'pay=unknown': 'این پرداخت پیدا نشد.',
      'rule=added': 'جواب خودکار ذخیره شد و از همین حالا فعال است.',
      'rule=invalid': 'جواب خودکار ذخیره نشد: پیج و متن پیام لازم است.',
      'del=confirm': 'برای حذف حساب، نام کاربری‌تان را دقیق بنویسید.'
    } as Record<string, string>,
    start: {
      title: 'شروع کار',
      done: 'از',
      steps: ['اشتراک فعال', 'پیج اینستاگرام وصل', 'اولین جواب خودکار', 'تست: از یک حساب دیگر «۱» کامنت بگذارید'],
      testHint: 'بعد از کامنت، دایرکت باید چند ثانیه‌ای برسد و در «آخرین کارها» ثبت شود.'
    },
    stats: { today: 'پیام امروز', week: 'پیام ۷ روز', rules: 'جواب فعال' },
    sub: {
      label: 'اشتراک',
      left: 'روز مانده',
      until: 'تا',
      inactive: 'اشتراک فعال نیست',
      inactiveBody: 'تا وقتی اشتراک فعال نباشد، جواب‌های خودکار ارسال نمی‌شوند. قانون‌ها و پیج‌ها سر جایشان می‌مانند.',
      renew: 'تمدید',
      buy: 'خرید'
    },
    pages: {
      title: 'پیج‌های اینستاگرام',
      connect: '+ اتصال پیج',
      adminHint: 'مدیر سایت: IG_APP_ID و IG_APP_SECRET را تنظیم کنید و این آدرس را در متا به‌عنوان Redirect URI بگذارید:',
      empty: 'هنوز پیجی وصل نیست. «اتصال پیج» صفحه‌ی رسمی اینستاگرام را باز می‌کند؛ آنجا وارد شوید و «اجازه» بدهید.',
      webhookOk: 'دریافت رویدادها فعال',
      webhookBad: 'دریافت رویدادها ثبت نشد — یک بار دوباره وصل کنید',
      validUntil: '، اعتبار اتصال تا ',
      disconnect: 'قطع اتصال'
    },
    rules: {
      title: 'جواب‌های خودکار',
      trigger: { comment: 'کامنت زیر پست', dm: 'پیام در دایرکت', story: 'جواب یا منشن استوری' } as Record<string, string>,
      ifWrote: 'اگر نوشت ',
      anything: 'هر چیزی',
      times: 'بار اجرا شده',
      button: 'دکمه: ',
      off: 'خاموش کن',
      on: 'روشن کن',
      remove: 'حذف',
      needPage: 'اول یک پیج وصل کنید.',
      newTitle: 'جواب تازه',
      useTemplate: 'از یک قالب شروع کنید:',
      whenLabel: 'وقتی کسی…',
      whenOpts: { comment: 'زیر پست کامنت گذاشت', dm: 'در دایرکت پیام داد', story: 'به استوری جواب داد یا منشن کرد' } as Record<string, string>,
      page: 'پیج',
      keywords: 'و نوشت (با ویرگول جدا کنید؛ خالی = هر چیزی)',
      keywordsPh: '۱، قیمت، لینک',
      reply: 'این پیام به دایرکتش برود',
      replyPh: 'سلام {username} 👋 لینک خرید اینجاست…',
      replyHint: '{username} با آیدی طرف عوض می‌شود.',
      extras: 'دکمه‌ی لینک و جواب زیر کامنت (اختیاری)',
      btnTitle: 'متن دکمه',
      btnTitlePh: 'دیدن محصول',
      btnUrl: 'لینک دکمه',
      publicReply: 'جواب عمومی زیر کامنت (فقط برای کامنت)',
      publicReplyPh: 'دایرکتت رو چک کن 💌',
      save: 'ذخیره و فعال‌سازی'
    },
    tpl: [
      { name: 'لینک محصول', trigger: 'comment', keywords: '۱، لینک', reply: 'سلام {username} 👋 لینک خرید اینجاست. موجودی محدوده، زودتر سفارش بده.', button: 'دیدن محصول', pub: 'دایرکتت رو چک کن 💌' },
      { name: 'لیست قیمت', trigger: 'dm', keywords: 'قیمت، چنده، قیمتش', reply: 'لیست قیمت:\n• محصول اول — ...\n• محصول دوم — ...\nارسال به همه‌جای ایران 🚚', button: '', pub: '' },
      { name: 'کد تخفیف استوری', trigger: 'story', keywords: '', reply: 'ممنون که استوری رو دیدی! کد STORY20 تا آخر امشب ۲۰٪ تخفیف داره ✨', button: '', pub: '' },
      { name: 'قرعه‌کشی', trigger: 'comment', keywords: 'شرکت، قرعه', reply: 'ثبت‌نامت در قرعه‌کشی انجام شد 🎉 نتیجه جمعه در استوری اعلام می‌شه. پیج رو فالو داشته باش.', button: '', pub: 'ثبت شد، دایرکتت رو ببین 🎁' },
      { name: 'آدرس و ساعت کاری', trigger: 'dm', keywords: 'آدرس، ساعت، کجایید', reply: 'آدرس: ...\nساعت کاری: شنبه تا پنجشنبه ۱۰ تا ۲۰', button: '', pub: '' }
    ],
    events: { title: 'آخرین کارها', empty: 'هنوز پیامی نرفته. هر دایرکتی که دایرکتینو بفرستد اینجا ثبت می‌شود.' },
    install: {
      title: 'روی گوشی و ویندوز',
      phone: 'گوشی:',
      phoneBody: 'همین صفحه را در کروم (اندروید) یا سافاری (آیفون) باز کنید، منوی اشتراک‌گذاری یا سه‌نقطه ← «افزودن به صفحه‌ی اصلی».',
      win: 'ویندوز:',
      winBody: 'صندوق دایرکت، پیام گروهی و جواب هوشمند. با همین نام کاربری وارد شوید.',
      download: 'دانلود نسخه‌ی ویندوز',
      soon: 'لینک دانلود به‌زودی همین‌جا قرار می‌گیرد.',
      afterBuy: 'لینک دانلود بعد از خرید اشتراک نمایش داده می‌شود.'
    },
    danger: { summary: 'حذف حساب و همه‌ی اطلاعات', confirm: 'نام کاربری برای تأیید', button: 'حذف همیشگی' }
  },
  pay: {
    title: 'اشتراک',
    sub: 'درگاه آنلاین به‌زودی فعال می‌شود. فعلاً با کارت‌به‌کارت پرداخت کنید؛ اشتراک دستی فعال می‌شود.',
    card: 'شماره کارت:',
    noCard: 'اطلاعات پرداخت هنوز ثبت نشده؛ با پشتیبانی تماس بگیرید.',
    after1: 'بعد از واریز، تصویر رسید را همراه نام کاربری ',
    after2: ' بفرستید',
    to: ' به ',
    back: 'برگشت به پنل'
  },
  done: {
    title: 'اتصال پیج',
    okTitle: 'پیج وصل شد',
    badTitle: 'اتصال انجام نشد',
    ok: (u: string) => `@${u} به اپ دایرکتینو وصل شد. این صفحه را ببندید و به اپ برگردید؛ خودش ادامه می‌دهد.`,
    denied: 'در صفحه‌ی اینستاگرام «اجازه» زده نشد. در اپ دوباره «اتصال رسمی» را بزنید.',
    error: 'اینستاگرام اتصال را نپذیرفت. پیج باید حرفه‌ای (Business یا Creator) باشد. در اپ دوباره امتحان کنید.'
  },
  notFound: { title: 'این صفحه پیدا نشد', home: 'صفحه‌ی اصلی' },
  legal: { updated: 'آخرین به‌روزرسانی:', date: 'آبان ۱۴۰۵' },
  app: appFa
}

export type Dict = typeof fa

const en: Dict = {
  meta: {
    title: 'Directino — Instagram comment & DM auto-replies',
    description:
      'Directino replies to comments, DMs and story replies on your Instagram account the moment they arrive — through the official Instagram API, without ever asking for your password.'
  },
  nav: {
    how: 'How it works',
    templates: 'Features',
    safety: 'Account safety',
    pricing: 'Pricing',
    faq: 'FAQ',
    login: 'Log in',
    signup: 'Sign up',
    switchLang: 'فارسی',
    switchLangShort: 'FA'
  },
  hero: {
    eyebrow: 'For online shops, course creators and service businesses',
    h1a: 'Every comment,',
    h1b: 'a DM.',
    sub: 'Someone comments “1” or “price” under your post, and Directino sends them a DM right away — a product link, a price list, a discount code. Built on the official Instagram API, so you never hand your password to anyone.',
    ctaBuy: 'Get started',
    ctaHow: 'How does setup work?',
    ticks: ['We never ask for your Instagram password', 'Works on phone and Windows', 'Replies 24/7, even while you sleep']
  },
  demo: {
    aria: 'Demo: someone comments 1 under a post and Directino instantly sends them a DM with the link',
    labels: ['', 'Comment received', 'Directino picked it up', 'Typing…', 'DM sent in 2 seconds', 'Customer replied', 'Typing…', 'Question answered too', ''],
    account: 'mahtab.store',
    postKicker: 'Fall collection',
    postTitle: 'Linen coat',
    postSub: '7 colors',
    postCta: 'Comment “1” for the link',
    likes: '248 likes',
    c1: 'Does it come in grey?',
    one: '1',
    fromComment: 'From a comment on your post',
    dm1a: 'Hi Sara 👋 here’s the link to the linen coat. Code ',
    dm1b: ' gives you 10% off.',
    code: 'FALL10',
    button: 'View product',
    reply: 'Thanks! Is size L available?',
    dm2: 'Yes — M, L and XL are in stock ✨'
  },
  scenarios: {
    title: 'Wherever customers reach out, they get an answer right there.',
    sub: 'The three places most Instagram sales are lost — because the reply came too late.',
    items: [
      {
        where: 'Under a post',
        them: '1',
        us: 'Hi 👋 here’s the link. Stock is limited, so grab it soon.',
        rule: 'If someone comments “1” → send the product link to their DMs',
        also: 'It also replies under their comment: “Check your DMs 💌”'
      },
      {
        where: 'In DMs',
        them: 'price?',
        us: 'T-shirt 480k / Hoodie 920k / Set 1.2M. We ship nationwide 🚚',
        rule: 'If a DM says “price” → send the price list',
        also: 'Add separate answers for “address”, “opening hours” and “shipping”'
      },
      {
        where: 'On stories',
        them: '🔥 (story reply)',
        us: 'Thanks for watching! Code STORY20 gives 20% off until midnight.',
        rule: 'If someone replies to or mentions your story → send a discount code',
        also: 'Anyone who mentions you in their story gets a thank-you message too'
      }
    ]
  },
  features: {
    title: 'Everything in one dashboard',
    sub: 'All you need to sell through DMs — without stitching together several tools.',
    items: [
      ['Comment & DM replies', 'Keywords, specific posts, text variations so it never feels repetitive, and link buttons.'],
      ['Follow to unlock', 'The link only goes to people who follow you; everyone else gets a “follow first” message.'],
      ['Forms & lead capture', 'After replying, ask for a name, phone or email and save it automatically.'],
      ['Product showcase', 'Your products as image cards with buy buttons, right inside DMs.'],
      ['Contacts & tags', 'Everyone who comments or messages, with tags, search and CSV export.'],
      ['Smart AI replies', 'AI (ChatGPT, Gemini, Grok…) answers when no auto-reply matches.'],
      ['Giveaways & comment filter', 'Draw winners from comments and hide spam comments automatically.'],
      ['Analytics', 'Messages per day, where they came from and your busiest replies.']
    ]
  },
  templates: {
    title: 'Start from a template',
    sub: 'The flows Instagram shops use every day. In your dashboard they fill in with one click — just personalise the text.',
    when: 'When',
    then: 'Directino',
    items: [
      { name: 'Product link', when: 'someone comments “1” or “link”', then: 'sends the product link with a button' },
      { name: 'Price list', when: 'someone asks “price” in DMs', then: 'sends your prices and shipping terms' },
      { name: 'Story discount', when: 'someone replies to your story', then: 'sends tonight’s discount code' },
      { name: 'Mention thank-you', when: 'someone mentions you in their story', then: 'thanks them with a small gift' },
      { name: 'Giveaway', when: 'someone comments on a giveaway post', then: 'confirms their entry and sends the rules' },
      { name: 'FAQ answers', when: 'someone asks “address”, “hours” or “shipping”', then: 'sends the ready-made answer' }
    ]
  },
  usecases: {
    title: 'Who is it for?',
    tabs: [
      {
        label: 'Shops',
        head: 'Every post becomes a storefront that answers itself',
        points: ['Product links with a single comment', 'Price lists and size charts in DMs', 'Discount codes for people who watch your stories'],
        example: 'Comment “1” → product link'
      },
      {
        label: 'Courses & teachers',
        head: 'Course sign-ups without replying one by one',
        points: ['Sign-up link for everyone who comments “course”', 'Syllabus and price in DMs', 'A free session for story repliers'],
        example: 'Comment “course” → sign-up link'
      },
      {
        label: 'Creators',
        head: 'Deliver your freebie to everyone who asks',
        points: ['Send a free file (checklist, PDF) for one keyword', 'Automatic thank-yous for mentions', 'Partnership and ad links in DMs'],
        example: 'Comment “file” → download link'
      },
      {
        label: 'Clinics & services',
        head: 'Bookings without a receptionist',
        points: ['Booking link when someone writes “book”', 'Hours and address for repeat questions', 'Answers to replies on special-offer stories'],
        example: 'DM “book” → booking link'
      }
    ]
  },
  night: {
    time: '2:14 a.m.',
    l1: 'Someone just commented “price?” under your post.',
    l2: 'You’re asleep. They already have the answer — in the morning you just see the order.'
  },
  how: {
    title: 'Set up in under ten minutes',
    steps: [
      {
        title: 'Sign up and subscribe',
        body: 'Create a Directino username and password, then pay for your plan. Your remaining days are always visible in your dashboard.'
      },
      {
        title: 'Connect your account',
        body: 'The “Connect account” button opens Instagram’s own authorization page. You log in there and tap “Allow”. Your password is only ever typed on Instagram.'
      },
      {
        title: 'Write your replies',
        body: 'Pick a template or write “when someone comments 1, send this message”. From that moment Directino runs on our servers — your phone and computer can stay off.'
      }
    ],
    note: 'Your account must be a professional account (Business or Creator). Switching is free and takes two minutes in Instagram’s settings.'
  },
  safety: {
    title: 'We never ask for your password.',
    p1: 'Many automation tools log in with your password from their own servers. That is exactly what triggers Instagram’s security checks and account restrictions. Directino uses the official Instagram API — the same route the major tools worldwide use.',
    p2: 'To be upfront: the official API has limits. You can only message people who commented, replied to a story, or messaged you in the last 24 hours. Mass messaging all your followers isn’t possible the official way — and that is what keeps your account safe.',
    us: 'Directino',
    them: 'Password-based tools',
    rows: [
      ['How you connect', 'Instagram’s official page and an “Allow” button', 'You hand over your password'],
      ['Risk of restriction', 'None — it’s the route Meta built', 'High; Instagram flags logins from unknown servers'],
      ['If you change your password', 'Nothing breaks', 'Everything stops working'],
      ['Revoking access', 'Any time, from Instagram’s settings', 'You have to change your password']
    ]
  },
  pricing: {
    title: 'Pricing',
    sub: 'Every plan includes every feature; only the length differs.',
    plans: { m1: '1 month', m3: '3 months', m6: '6 months' },
    notes: { m3: 'about 333,000 Toman a month' },
    days: 'days',
    best: 'Best value',
    soon: 'Coming soon',
    notActive: 'This plan isn’t available yet',
    unit: 'Toman',
    buy: 'Buy',
    included: ['Auto-replies to comments, DMs and stories', 'Link buttons inside DMs', 'Mobile dashboard and Windows app', 'A log of every message sent']
  },
  platforms: {
    phoneKicker: 'On your phone',
    phoneTitle: 'No app store needed',
    phoneBody: 'Open the dashboard in your phone’s browser and tap “Add to Home Screen”. It sits next to your other apps, on Android and iPhone.',
    winKicker: 'On Windows',
    winTitle: 'A desktop app for power users',
    winBody: 'Unified inbox, broadcasts and AI replies. The download link appears in your dashboard once you subscribe, and you log in with the same username.'
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      ['Will my account get banned?', 'On the website Directino only uses the official Instagram API and never takes your password, so to Instagram it looks like any other approved tool. Just don’t send repetitive or annoying messages — users report those, not the tool.'],
      ['What kind of account do I need?', 'A professional account (Business or Creator). A Facebook Page is not required. If your account is personal, switch it in Instagram’s settings.'],
      ['Can I message all my followers?', 'Not through the official API; Instagram only lets you message people who interacted with you first. The Windows app has broadcasts using an unofficial method, and it shows a risk warning before you use it.'],
      ['What happens when my plan ends?', 'Auto-replies pause, but nothing is deleted. Renew and everything picks up where it left off.'],
      ['How do I pay?', 'Through an Iranian bank gateway (Shetab cards). Your subscription days are added the moment the payment clears.'],
      ['Does my phone or computer need to stay on?', 'No. Replies are sent from Directino’s servers, even when your phone is off.']
    ]
  },
  final: {
    title: 'Publish your next post with “comment 1”.',
    sub: '400,000 Toman a month — no contract, stop renewing whenever you like.',
    cta: 'Get started'
  },
  footer: {
    tagline: 'Instagram comment and DM auto-replies, via the official API.',
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    deletion: 'Data deletion',
    customers: 'Customer login',
    disclaimer: 'Instagram is a trademark of Meta. Directino is not affiliated with Meta. Photos:'
  },
  auth: {
    username: 'Username',
    usernameHint: 'Lowercase letters, numbers, dots or underscores',
    password: 'Password',
    passwordHint: 'At least 8 characters — this is your Directino password, not your Instagram one',
    wait: 'Please wait…',
    create: 'Create account',
    login: 'Log in',
    haveAccount: 'Already have an account? ',
    noAccount: 'No account yet? ',
    goLogin: 'Log in',
    goSignup: 'Sign up',
    loginTitle: 'Log in to your dashboard',
    loginSub: 'Use the username and password you chose when you signed up.',
    signupTitle: 'Create your account',
    signupSub: 'Choose a username and password for Directino. You’ll use them for the mobile dashboard and the Windows app.',
    errUsername: 'Username: 3–32 lowercase letters, numbers, dots or underscores',
    errPassword: 'Password must be at least 8 characters',
    errTaken: 'That username is already taken',
    errWrong: 'Wrong username or password',
    errGeneric: 'Something went wrong — please try again in a moment',
    errNoDb: 'Database not connected — set DATABASE_URL in your hosting settings'
  },
  dash: {
    title: 'Dashboard',
    admin: 'Admin',
    logout: 'Log out',
    flash: {
      'ig=ok': 'Account connected. Now create an auto-reply.',
      'ig=denied': 'Connection cancelled — “Allow” wasn’t tapped on Instagram.',
      'ig=error': 'Instagram rejected the connection. The account must be Business or Creator; please try again.',
      'ig=expired': 'The connection timed out. Tap “Connect account” again.',
      'ig=setup': 'Instagram connection isn’t configured on the server yet. Please contact support.',
      'pay=ok': 'Payment successful — your subscription has been extended.',
      'pay=cancelled': 'Payment cancelled. If anything was deducted, it will be refunded within 72 hours.',
      'pay=failed': 'The bank didn’t confirm the payment. If anything was deducted, it will be refunded within 72 hours.',
      'pay=gateway': 'The payment gateway is unavailable; please try again in a few minutes.',
      'pay=unknown': 'Payment not found.',
      'rule=added': 'Auto-reply saved and active from now on.',
      'rule=invalid': 'Auto-reply not saved: an account and a message are required.',
      'del=confirm': 'To delete your account, type your username exactly.'
    },
    start: {
      title: 'Getting started',
      done: 'of',
      steps: ['Active subscription', 'Instagram account connected', 'First auto-reply created', 'Test it: comment “1” from another account'],
      testHint: 'After you comment, the DM should arrive within seconds and show up under “Recent activity”.'
    },
    stats: { today: 'Messages today', week: 'Last 7 days', rules: 'Active replies' },
    sub: {
      label: 'Subscription',
      left: 'days left',
      until: 'until',
      inactive: 'No active subscription',
      inactiveBody: 'Auto-replies are paused until your subscription is active. Your rules and accounts are kept.',
      renew: 'Renew',
      buy: 'Buy'
    },
    pages: {
      title: 'Instagram accounts',
      connect: '+ Connect account',
      adminHint: 'Site admin: set IG_APP_ID and IG_APP_SECRET and add this Redirect URI in Meta:',
      empty: 'No account connected yet. “Connect account” opens Instagram’s official page — log in there and tap “Allow”.',
      webhookOk: 'Receiving events',
      webhookBad: 'Event subscription failed — reconnect once',
      validUntil: ', connection valid until ',
      disconnect: 'Disconnect'
    },
    rules: {
      title: 'Auto-replies',
      trigger: { comment: 'Comment on a post', dm: 'Direct message', story: 'Story reply or mention' },
      ifWrote: 'If they write ',
      anything: 'anything',
      times: 'times sent',
      button: 'Button: ',
      off: 'Turn off',
      on: 'Turn on',
      remove: 'Delete',
      needPage: 'Connect an account first.',
      newTitle: 'New auto-reply',
      useTemplate: 'Start from a template:',
      whenLabel: 'When someone…',
      whenOpts: { comment: 'comments on a post', dm: 'sends a direct message', story: 'replies to or mentions your story' },
      page: 'Account',
      keywords: 'and writes (comma-separated; empty = anything)',
      keywordsPh: '1, price, link',
      reply: 'Send this message to their DMs',
      replyPh: 'Hi {username} 👋 here’s the link…',
      replyHint: '{username} is replaced with their handle.',
      extras: 'Link button and public comment reply (optional)',
      btnTitle: 'Button text',
      btnTitlePh: 'View product',
      btnUrl: 'Button link',
      publicReply: 'Public reply under the comment (comments only)',
      publicReplyPh: 'Check your DMs 💌',
      save: 'Save and activate'
    },
    tpl: [
      { name: 'Product link', trigger: 'comment', keywords: '1, link', reply: 'Hi {username} 👋 here’s the link. Stock is limited, so grab it soon.', button: 'View product', pub: 'Check your DMs 💌' },
      { name: 'Price list', trigger: 'dm', keywords: 'price, how much, cost', reply: 'Our prices:\n• Item one — ...\n• Item two — ...\nWe ship nationwide 🚚', button: '', pub: '' },
      { name: 'Story discount', trigger: 'story', keywords: '', reply: 'Thanks for watching! Code STORY20 gives 20% off until midnight ✨', button: '', pub: '' },
      { name: 'Giveaway', trigger: 'comment', keywords: 'enter, giveaway', reply: 'You’re in the giveaway 🎉 Winners are announced Friday in our stories. Stay tuned!', button: '', pub: 'You’re in — check your DMs 🎁' },
      { name: 'Address & hours', trigger: 'dm', keywords: 'address, hours, where', reply: 'Address: ...\nOpening hours: Sat–Thu, 10:00–20:00', button: '', pub: '' }
    ],
    events: { title: 'Recent activity', empty: 'Nothing sent yet. Every DM Directino sends is logged here.' },
    install: {
      title: 'On your phone and Windows',
      phone: 'Phone:',
      phoneBody: 'Open this page in Chrome (Android) or Safari (iPhone), then Share or ⋮ menu → “Add to Home Screen”.',
      win: 'Windows:',
      winBody: 'Unified inbox, broadcasts and AI replies. Log in with the same username.',
      download: 'Download for Windows',
      soon: 'The download link will appear here soon.',
      afterBuy: 'The download link appears once you subscribe.'
    },
    danger: { summary: 'Delete account and all data', confirm: 'Username to confirm', button: 'Delete permanently' }
  },
  pay: {
    title: 'Subscription',
    sub: 'Online payment is coming soon. For now, pay by card transfer and your subscription will be activated manually.',
    card: 'Card number:',
    noCard: 'Payment details aren’t set up yet; please contact support.',
    after1: 'After paying, send a photo of the receipt along with your username ',
    after2: '',
    to: ' to ',
    back: 'Back to dashboard'
  },
  done: {
    title: 'Connect account',
    okTitle: 'Account connected',
    badTitle: 'Connection failed',
    ok: (u: string) => `@${u} is now connected to the Directino app. Close this page and return to the app — it will continue on its own.`,
    denied: '“Allow” wasn’t tapped on Instagram. Click “Official connection” in the app again.',
    error: 'Instagram rejected the connection. The account must be Business or Creator. Try again from the app.'
  },
  notFound: { title: 'Page not found', home: 'Home' },
  legal: { updated: 'Last updated:', date: 'October 2026' },
  app: appEn
}

export const dict: Record<'fa' | 'en', Dict> = { fa, en }
