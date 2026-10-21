/** متن‌های بخش‌های تازه‌ی پنل (نسخه‌ی ۲). ساختار en باید دقیقاً مثل fa باشد. */

/** یک مرحله‌ی آموزش: متن تنها، یا با تصویر (public/learn/{img}-{lang}.webp)، مسیر منو یا طرح */
export type LearnStep = string | { t: string; img?: string; path?: string[]; art?: 'allow' | 'home' }

export const appFa = {
  nav: { home: 'خانه', rules: 'جواب‌ها', contacts: 'مخاطبان', tools: 'ابزارها', settings: 'تنظیمات', catalog: 'ویترین', learn: 'آموزش' },
  account: 'پیج',
  suggest: {
    button: 'پیشنهادها',
    title: 'کارهای پیشنهادی امروز',
    sub: 'بر اساس وضعیت پیج شما — هر کدام را بزنید مستقیم به همان بخش می‌روید.',
    later: 'بعداً',
    empty: 'همه‌چیز مرتب است 👌 پیشنهاد تازه‌ای نیست.',
    tags: { must: 'لازم', grow: 'رشد' } as Record<string, string>,
    items: {
      renew: ['اشتراک فعال نیست', 'تا تمدید نکنید، هیچ جوابی برای مشتری‌ها نمی‌رود.', 'تمدید'],
      ending: ['{n} روز تا پایان اشتراک', 'تمدید کنید تا جواب‌ها حتی یک ساعت هم قطع نشوند.', 'تمدید'],
      connect: ['پیج اینستاگرام را وصل کنید', 'بدون اتصال پیج، دایرکتینو نمی‌تواند کامنت‌ها و دایرکت‌ها را ببیند.', 'اتصال پیج'],
      webhook: ['دریافت پیام‌های یک پیج قطع است', 'یک بار دوباره «اتصال پیج» را بزنید تا رویدادها دوباره برسند.', 'اتصال دوباره'],
      firstRule: ['اولین جواب خودکار را بسازید', 'قالب «لینک محصول» را بزنید؛ کمتر از یک دقیقه طول می‌کشد.', 'ساخت جواب'],
      comment: ['جواب کامنت ندارید', 'بیشترین فروش از «۱ کامنت کن» می‌آید. یک جواب برای کامنت بسازید.', 'ساخت جواب'],
      welcome: ['پیام خوشامد بگذارید', 'به هر کسی که اولین بار پیام می‌دهد خودکار سلام کنید و منو را نشانش بدهید.', 'ساخت خوشامد'],
      form: ['شماره‌ی مشتری‌ها را جمع کنید', 'به پرکارترین جوابتان یک فرم کوتاه (نام و شماره) اضافه کنید تا لید داشته باشید.', 'افزودن فرم'],
      gate: ['فالوور بگیرید', 'با «اول فالو کن»، لینک فقط به فالوورها می‌رسد؛ راه ساده‌ی رشد پیج با هر پست.', 'فعال کردن'],
      ice: ['منوی سؤال‌های سریع بسازید', 'مشتری قبل از تایپ، دکمه‌های «قیمت؟» و «ارسال؟» را می‌بیند.', 'ساخت منو'],
      showcase: ['ویترین محصولات بسازید', 'با یک کلمه، همه‌ی محصولات به‌صورت کارت عکس‌دار در دایرکت می‌رود.', 'افزودن محصول'],
      moderation: ['فیلتر کامنت را روشن کنید', 'کامنت‌های اسپم و تبلیغ رقبا خودکار مخفی شوند.', 'تنظیم فیلتر'],
      ai: ['هوش مصنوعی را وصل کنید', 'سؤال‌هایی که جواب آماده ندارند هم بی‌جواب نمی‌مانند.', 'تنظیم هوش مصنوعی'],
      broadcast: ['{n} نفر امروز پیام داده‌اند', 'تا ۲۴ ساعت می‌توانید برایشان پیشنهاد یا تخفیف بفرستید.', 'ارسال پیام'],
      idle: ['هفته‌ی گذشته پیامی نرفته', 'در کپشن پست بعدی بنویسید «برای لینک ۱ کامنت کن» تا جواب‌ها کار کنند.', 'دیدن جواب‌ها'],
      export: ['{n} لید جمع شده', 'از بخش مخاطبان خروجی اکسل بگیرید و با آن‌ها تماس بگیرید.', 'دیدن مخاطبان']
    } as Record<string, [string, string, string]>
  },
  menu: {
    open: 'باز کردن منو',
    close: 'بستن منو',
    items: {
      home: 'خلاصه‌ی وضعیت، اشتراک، نمودارها و آخرین پیام‌ها',
      rules: 'تعریف کنید به چه کلمه‌ای، چه جوابی برود',
      contacts: 'همه‌ی کسانی که کامنت گذاشتند یا پیام دادند',
      catalog: 'محصولات را به‌صورت کارت در دایرکت بفرستید',
      tools: 'قرعه‌کشی، فیلتر کامنت، منوی سریع و پیام گروهی',
      settings: 'هوش مصنوعی، نصب روی گوشی و حذف حساب',
      learn: 'ویدیو و تصویر قدم‌به‌قدم برای هر بخش'
    } as Record<string, string>
  },
  intro: {
    home: 'اینجا در یک نگاه می‌بینید دایرکتینو چقدر برایتان کار کرده. با فیلترهای بالای نمودار، بازه و نوع پیام را عوض کنید.',
    rules: 'هر «جواب خودکار» یک قانون است: «وقتی کسی این کار را کرد و این کلمه را نوشت، این پیام برود». از یک قالب شروع کنید؛ امکانات پیشرفته مثل فرم و شرط فالو داخل «تنظیمات پیشرفته» است.',
    contacts: 'هر کسی که زیر پستتان کامنت گذاشته یا دایرکت داده، خودکار اینجا ذخیره می‌شود. شماره و ایمیلی که با فرم جمع شده هم اینجاست. با برچسب دسته‌بندی کنید و خروجی اکسل بگیرید.',
    catalog: 'چند محصول با عکس و لینک اضافه کنید. وقتی کسی در دایرکت یکی از کلمه‌های تعیین‌شده (مثلاً «محصولات») را بنویسد، همه را به‌صورت کارت‌های کنار هم می‌بیند.',
    tools: 'ابزارهای جانبی پیج: برنده‌ی مسابقه را از کامنت‌ها انتخاب کنید، کامنت‌های اسپم را خودکار مخفی کنید، منوی سؤال‌های دایرکت را بچینید و به مخاطبان امروز پیام بدهید.',
    settings: 'هوش مصنوعی را برای جواب سؤال‌هایی که قانون ندارند وصل کنید، پنل را روی گوشی نصب کنید یا حسابتان را حذف کنید.'
  },
  filters: {
    range: 'بازه',
    days: { '7': '۷ روز', '30': '۳۰ روز', '90': '۹۰ روز' } as Record<string, string>,
    kind: 'نوع',
    allKinds: 'همه',
    account: 'پیج',
    allAccounts: 'همه‌ی پیج‌ها',
    daily: (d: string) => `پیام‌های فرستاده‌شده — ${d} اخیر`
  },
  brief: {
    title: 'خلاصه',
    aiTitle: 'تحلیل هوش مصنوعی',
    aiButton: 'نوشتن تحلیل با هوش مصنوعی',
    aiHint: 'برای تحلیل هوشمند، در تنظیمات یک سرویس هوش مصنوعی وصل کنید.',
    aiError: 'هوش مصنوعی جواب نداد: ',
    writing: 'در حال نوشتن…',
    sent: (n: string, d: string) => `در ${d} اخیر ${n} پیام خودکار فرستاده شد`,
    up: (p: string) => `، ${p}٪ بیشتر از دوره‌ی قبل.`,
    down: (p: string) => `، ${p}٪ کمتر از دوره‌ی قبل.`,
    flat: '، تقریباً مثل دوره‌ی قبل.',
    first: '.',
    topKind: (k: string, p: string) => `بیشترِ پیام‌ها (${p}٪) از «${k}» بود.`,
    leads: (n: string) => `${n} شماره یا ایمیل از فرم‌ها جمع شد.`,
    noLeads: 'هنوز با فرم شماره‌ای جمع نشده؛ به پرکارترین جوابتان یک فرم کوتاه اضافه کنید.',
    topRule: (r: string, n: string) => `پرکارترین جواب: «${r}» با ${n} بار.`,
    idle: 'در این بازه پیامی نرفته. یک جواب خودکار بسازید و در کپشن پست بنویسید «۱ کامنت کن».',
    newContacts: (n: string) => `${n} مخاطب تازه اضافه شد.`
  },
  charts: {
    daily: 'پیام‌های فرستاده‌شده — ۳۰ روز اخیر',
    dailyEmpty: 'هنوز داده‌ای برای نمودار نیست؛ با اولین جواب خودکار پر می‌شود.',
    byKind: 'از کجا آمده‌اند',
    topRules: 'پرکارترین جواب‌ها',
    table: 'نمایش به‌صورت جدول',
    day: 'روز',
    count: 'تعداد',
    kinds: {
      comment: 'کامنت', dm: 'دایرکت', story: 'استوری', mention: 'منشن', first_dm: 'خوشامد', form: 'فرم',
      catalog: 'ویترین', ai: 'هوش مصنوعی', gate: 'شرط فالو', moderation: 'کامنت مخفی‌شده', broadcast: 'پیام گروهی'
    } as Record<string, string>,
    contacts: 'مخاطب',
    leads: 'شماره/ایمیل جمع‌شده'
  },
  rule: {
    nameLabel: 'نام (برای خودتان)',
    namePh: 'مثلاً: لینک مانتو پاییزه',
    triggers: {
      comment: 'زیر پست کامنت گذاشت',
      dm: 'در دایرکت پیام داد',
      first_dm: 'برای اولین بار پیام داد (خوشامد)',
      story: 'به استوری جواب داد',
      mention: 'پیج را در استوری منشن کرد'
    } as Record<string, string>,
    post: 'روی کدام پست؟',
    allPosts: 'همه‌ی پست‌ها',
    postsUnavailable: 'لیست پست‌ها از اینستاگرام خوانده نشد؛ قانون روی همه‌ی پست‌ها کار می‌کند.',
    variantsHint: 'برای چند نسخه‌ی متفاوت (تا پیام‌ها تکراری نباشند)، نسخه‌ها را با یک خط --- جدا کنید.',
    buttons: 'دکمه‌های لینک (تا ۳ تا)',
    quick: 'دکمه‌های جواب سریع (با ویرگول جدا)',
    quickPh: 'قیمت، ارسال، مشاوره',
    image: 'عکس قبل از پیام (لینک عکس)',
    advanced: 'تنظیمات پیشرفته',
    gate: 'اول فالو کن: اگر فالو نکرده، این پیام برود',
    gatePh: 'اول پیج رو فالو کن، بعد دوباره «۱» کامنت بذار تا لینک برات بیاد 🌸',
    once: 'به هر نفر فقط یک بار',
    tag: 'برچسب برای مخاطب',
    tagPh: 'مشتری-مانتو',
    form: 'فرم: بعد از پیام، این سؤال‌ها را بپرس',
    formHint: 'جواب‌ها در «مخاطبان» ذخیره می‌شوند. شماره و ایمیل بررسی می‌شوند.',
    qKinds: { name: 'نام', phone: 'شماره موبایل', email: 'ایمیل', custom: 'سؤال دلخواه' } as Record<string, string>,
    qPh: { name: 'اسمت چیه؟', phone: 'شماره موبایلت رو بفرست تا هماهنگ کنیم 📱', email: 'ایمیلت رو بفرست', custom: 'سایزت چنده؟' } as Record<string, string>,
    done: 'پیام پایان فرم',
    donePh: 'ممنون! همکارمون به‌زودی باهات تماس می‌گیره ✨',
    badges: { once: 'یک‌بار', gate: 'شرط فالو', form: 'فرم', post: 'پست خاص', image: 'عکس', ai: 'AI' } as Record<string, string>
  },
  contacts: {
    title: 'مخاطبان',
    sub: 'هر کسی که کامنت گذاشته یا پیام داده، خودکار اینجا ذخیره می‌شود.',
    search: 'جستجو در نام، آیدی، شماره…',
    allTags: 'همه‌ی برچسب‌ها',
    export: 'خروجی اکسل (CSV)',
    empty: 'هنوز مخاطبی نیست.',
    cols: { user: 'کاربر', name: 'نام', phone: 'شماره', email: 'ایمیل', tags: 'برچسب‌ها', count: 'تعامل', last: 'آخرین بار' },
    addTag: 'افزودن برچسب',
    window: 'در پنجره‌ی ۲۴ ساعته',
    total: 'مخاطب'
  },
  catalog: {
    title: 'ویترین محصولات',
    sub: 'وقتی کسی در دایرکت یکی از کلمه‌های زیر را بنویسد، محصولات به‌صورت کارت‌های عکس‌دار با دکمه‌ی خرید برایش می‌رود (تا ۱۰ محصول).',
    keywords: 'کلمه‌های نمایش ویترین',
    keywordsPh: 'محصولات، کاتالوگ، لیست',
    intro: 'پیام قبل از ویترین',
    introPh: 'اینم محصولات این هفته 👇',
    button: 'متن دکمه‌ی هر کارت',
    buttonPh: 'خرید',
    save: 'ذخیره',
    add: 'افزودن محصول',
    pTitle: 'نام محصول',
    pSub: 'توضیح کوتاه',
    pPrice: 'قیمت',
    pImage: 'لینک عکس',
    pUrl: 'لینک خرید',
    empty: 'هنوز محصولی اضافه نشده.',
    remove: 'حذف'
  },
  tools: {
    title: 'ابزارها',
    giveaway: {
      title: 'قرعه‌کشی از کامنت‌ها',
      sub: 'یک پست را انتخاب کنید؛ از بین کامنت‌گذارها (هر نفر یک شانس) برنده انتخاب می‌شود.',
      post: 'پست',
      count: 'تعداد برنده',
      keyword: 'فقط کامنت‌هایی که این کلمه را دارند (اختیاری)',
      pick: 'انتخاب برنده',
      result: 'برنده‌ها',
      among: 'از بین',
      people: 'نفر',
      none: 'کامنتی برای قرعه‌کشی پیدا نشد.',
      noPosts: 'برای قرعه‌کشی، اول یک پیج وصل کنید.'
    },
    moderation: {
      title: 'فیلتر کامنت',
      sub: 'کامنت‌هایی که این کلمه‌ها را دارند خودکار مخفی می‌شوند (فحش، تبلیغ رقبا، لینک).',
      enabled: 'فعال',
      words: 'کلمه‌ها (با ویرگول جدا)',
      wordsPh: 'http، تبلیغ، فالوور رایگان',
      save: 'ذخیره'
    },
    ice: {
      title: 'منوی سؤال‌های سریع',
      sub: 'وقتی کسی برای اولین بار دایرکت شما را باز می‌کند، این سؤال‌ها را به‌صورت دکمه می‌بیند (تا ۴ تا). برای هر کدام یک «جواب دایرکت» با همان کلمه بسازید.',
      ph: ['قیمت محصولات؟', 'ارسال چطوریه؟', 'آدرس فروشگاه؟', 'مشاوره می‌خوام'],
      save: 'ذخیره در اینستاگرام',
      ok: 'منو در اینستاگرام ذخیره شد.',
      fail: 'اینستاگرام منو را نپذیرفت: '
    },
    broadcast: {
      title: 'پیام به مخاطبان ۲۴ ساعت اخیر',
      sub: 'اینستاگرام فقط اجازه می‌دهد به کسانی پیام بدهید که در ۲۴ ساعت گذشته به شما پیام داده‌اند.',
      eligible: 'نفر الان قابل ارسال‌اند',
      tag: 'فقط این برچسب (اختیاری)',
      text: 'متن پیام',
      send: 'ارسال',
      sent: 'ارسال شد به'
    },
    showcase: { title: 'ویترین محصولات', sub: 'محصولات را به‌صورت کارت در دایرکت بفرستید.', open: 'مدیریت ویترین' }
  },
  settings: {
    title: 'تنظیمات',
    ai: {
      title: 'جواب هوشمند (هوش مصنوعی)',
      sub: 'وقتی هیچ جواب خودکاری با پیام جور نشد، هوش مصنوعی بر اساس اطلاعات کسب‌وکار شما جواب می‌دهد. کلید سرویس را خودتان می‌گذارید.',
      enabled: 'فعال',
      provider: 'سرویس',
      model: 'مدل (اختیاری)',
      baseUrl: 'آدرس API (فقط برای Custom)',
      key: 'کلید API',
      keySet: 'کلید ذخیره شده — برای عوض کردن، کلید تازه بنویسید',
      prompt: 'اطلاعات کسب‌وکار',
      promptPh: 'ما فروشگاه مانتو هستیم. قیمت‌ها: ... ارسال به همه‌ی شهرها ۳ روزه. ساعت کاری: ... آدرس: ...',
      save: 'ذخیره'
    },
    saved: 'ذخیره شد.'
  },
  learn: {
    title: 'آموزش',
    intro: 'هر بخش دایرکتینو یک آموزش کوتاه دارد: ویدیوهای زیر یک دقیقه از روی خود پنل، و راهنمای تصویری برای کارهایی که بیرون از پنل انجام می‌شود (مثل اینستاگرام و نصب روی گوشی).',
    video: 'ویدیو',
    images: 'راهنمای تصویری',
    secs: (n: string) => `${n} ثانیه`,
    stepsN: (n: string) => `${n} مرحله`,
    steps: 'مرحله‌ها',
    open: 'رفتن به همین بخش',
    next: 'آموزش بعدی',
    all: 'همه‌ی آموزش‌ها',
    help: 'آموزش این بخش',
    allow: { wants: 'دایرکتینو می‌خواهد:', p1: 'پیام‌های دایرکت را ببیند و جواب بدهد', p2: 'کامنت‌ها را ببیند و مدیریت کند', p3: 'اطلاعات پایه‌ی پیج را بخواند', cancel: 'Cancel', ok: 'Allow' },
    home: 'صفحه‌ی اصلی گوشی',
    lessons: {
      start: {
        title: 'ساخت حساب و شروع',
        sub: 'از ثبت‌نام تا خرید اشتراک و اتصال پیج',
        steps: ['یک نام کاربری انگلیسی و یک رمز بنویسید', 'روی «ساخت حساب» بزنید', 'پنل باز شد. پیشنهادهای امروز کارهای لازم را نشان می‌دهد', 'اول اشتراک را بخرید؛ روزهای باقی‌مانده همین‌جا دیده می‌شود', 'بعد «اتصال پیج» را بزنید و در صفحه‌ی اینستاگرام «Allow» بدهید']
      },
      connect: {
        title: 'وصل کردن پیج اینستاگرام',
        sub: 'پیج باید حرفه‌ای (Business یا Creator) باشد',
        steps: [
          { t: 'پیج اینستاگرام باید «حرفه‌ای» باشد. اگر نیست، در خود اپ اینستاگرام این مسیر را بروید (رایگان است و پست‌ها دست نمی‌خورند):', path: ['تنظیمات', 'نوع حساب و ابزارها', 'تغییر به حساب حرفه‌ای'] },
          { t: 'در صفحه‌ی «خانه»ی دایرکتینو، روی «اتصال پیج» بزنید.', img: 'connect-1' },
          { t: 'صفحه‌ی ورود اینستاگرام باز می‌شود. وارد همان پیج شوید و «Allow» (اجازه) را بزنید.', art: 'allow' },
          { t: 'به پنل برمی‌گردید و پیج در فهرست دیده می‌شود. از همین لحظه جواب‌های خودکار کار می‌کنند.', img: 'connect-2' },
          { t: 'برای اینکه جواب دایرکت‌ها هم برسد، این گزینه را در اینستاگرام روشن کنید:', path: ['تنظیمات', 'پیام‌ها و پاسخ به استوری', 'کنترل پیام‌ها', 'ابزارهای متصل', 'اجازه‌ی دسترسی به پیام‌ها'] }
        ]
      },
      'first-reply': {
        title: 'اولین جواب خودکار',
        sub: 'هر کس «۱» کامنت کرد، لینک محصول را در دایرکت بگیرد',
        steps: ['منو را باز کنید', 'بخش «جواب‌ها» را بزنید', 'یک قالب انتخاب کنید؛ مثلاً «لینک محصول»', 'لینک محصولتان را جلوی دکمه بگذارید', 'اگر فقط برای یک پست است، پست را انتخاب کنید', '«ذخیره و فعال‌سازی» — از همین لحظه کار می‌کند', 'جواب ساخته شد ✓ حالا کسی «۱» کامنت کند، دایرکت می‌گیرد']
      },
      form: {
        title: 'جمع کردن شماره‌ی مشتری',
        sub: 'یک فرم کوتاه نام و موبایل داخل دایرکت',
        steps: ['قالب «لینک محصول» را بزنید', '«تنظیمات پیشرفته» را باز کنید', '«سؤال دلخواه» را بزنید؛ سؤال نام آماده است', 'یک بار دیگر بزنید تا شماره موبایل هم پرسیده شود', 'پیام پایان فرم را بنویسید', 'ذخیره کنید. جواب‌ها در «مخاطبان» جمع می‌شوند']
      },
      showcase: {
        title: 'ویترین محصولات',
        sub: 'محصولات به‌صورت کارت عکس‌دار در دایرکت',
        steps: ['از منو «ویترین» را باز کنید', 'کلمه‌هایی که ویترین را نشان می‌دهند', 'پیام قبل از ویترین و متن دکمه را بنویسید و ذخیره کنید', 'حالا محصول اضافه کنید: نام و قیمت', 'لینک خرید را بگذارید و «افزودن محصول»', 'هر کس در دایرکت بنویسد «محصولات»، کارت‌ها را می‌بیند']
      },
      contacts: {
        title: 'مخاطبان و خروجی اکسل',
        sub: 'جستجو، برچسب و دانلود همه‌ی مشتری‌ها',
        steps: ['از منو «مخاطبان» را باز کنید', 'همه‌ی کامنت‌گذارها و پیام‌دهنده‌ها اینجا هستند', 'جستجو بر اساس نام، آیدی یا شماره', 'برای هر نفر برچسب بگذارید', 'با «خروجی اکسل» همه را دانلود کنید']
      },
      giveaway: {
        title: 'قرعه‌کشی از کامنت‌ها',
        sub: 'برنده‌ی مسابقه در چند ثانیه، منصفانه',
        steps: ['از منو «ابزارها» را باز کنید', 'پست مسابقه را انتخاب کنید', 'تعداد برنده را بنویسید', '«انتخاب برنده» — هر نفر فقط یک شانس دارد', 'برنده مشخص شد 🎉']
      },
      install: {
        title: 'نصب روی گوشی',
        sub: 'مثل یک اپ، با یک لمس باز شود',
        steps: [
          { t: 'همین سایت را در مرورگر گوشی باز کنید و وارد حساب شوید.' },
          { t: 'اندروید (Chrome): منوی سه‌نقطه را بزنید و «نصب برنامه» یا «افزودن به صفحه‌ی اصلی» را انتخاب کنید.', path: ['⋮', 'Install app', 'Install'] },
          { t: 'آیفون (Safari): دکمه‌ی اشتراک‌گذاری پایین صفحه را بزنید و «Add to Home Screen» را انتخاب کنید.', path: ['Share', 'Add to Home Screen', 'Add'] },
          { t: 'آیکن دایرکتینو روی صفحه‌ی گوشی می‌آید و پنل تمام‌صفحه، مثل یک اپ، باز می‌شود.', art: 'home' }
        ]
      }
    } as Record<string, { title: string; sub: string; steps: LearnStep[] }>
  },
  saved: 'ذخیره شد.',
  needAccount: 'برای این بخش اول یک پیج اینستاگرام وصل کنید.'
}

export type AppDict = typeof appFa

export const appEn: AppDict = {
  nav: { home: 'Home', rules: 'Replies', contacts: 'Contacts', tools: 'Tools', settings: 'Settings', catalog: 'Showcase', learn: 'Tutorials' },
  account: 'Account',
  suggest: {
    button: 'Suggestions',
    title: 'Suggested for today',
    sub: 'Based on your account’s current state — tap one to jump straight to it.',
    later: 'Later',
    empty: 'All set 👌 nothing new to suggest.',
    tags: { must: 'Needed', grow: 'Growth' },
    items: {
      renew: ['Your subscription isn’t active', 'Until you renew, no replies are sent to your customers.', 'Renew'],
      ending: ['{n} days left on your subscription', 'Renew so replies never stop, not even for an hour.', 'Renew'],
      connect: ['Connect your Instagram account', 'Without a connected account, Directino can’t see comments or DMs.', 'Connect account'],
      webhook: ['One account isn’t receiving messages', 'Tap “Connect account” once more to restore events.', 'Reconnect'],
      firstRule: ['Create your first auto-reply', 'Tap the “Product link” template — it takes under a minute.', 'Create reply'],
      comment: ['No comment auto-reply yet', 'Most sales come from “comment 1”. Add a reply for comments.', 'Create reply'],
      welcome: ['Add a welcome message', 'Greet everyone who messages you for the first time and show them your menu.', 'Create welcome'],
      form: ['Collect customers’ phone numbers', 'Add a short form (name and phone) to your busiest reply to capture leads.', 'Add a form'],
      gate: ['Grow your followers', 'With “follow first”, the link only goes to followers — easy growth with every post.', 'Turn on'],
      ice: ['Set up quick questions', 'Customers see “Prices?” and “Shipping?” buttons before they type.', 'Create menu'],
      showcase: ['Build a product showcase', 'One word sends all your products as image cards in DMs.', 'Add products'],
      moderation: ['Turn on the comment filter', 'Hide spam and competitor ads automatically.', 'Set up filter'],
      ai: ['Connect AI', 'Questions without a ready-made answer won’t go unanswered.', 'Set up AI'],
      broadcast: ['{n} people messaged you today', 'For 24 hours you can send them an offer or discount.', 'Send message'],
      idle: ['Nothing was sent last week', 'Write “comment 1 for the link” in your next caption so your replies kick in.', 'View replies'],
      export: ['{n} leads collected', 'Export them from Contacts and follow up.', 'View contacts']
    }
  },
  menu: {
    open: 'Open menu',
    close: 'Close menu',
    items: {
      home: 'Status, subscription, charts and latest messages',
      rules: 'Decide which words get which reply',
      contacts: 'Everyone who commented or messaged you',
      catalog: 'Send your products as cards in DMs',
      tools: 'Giveaways, comment filter, quick menu and broadcasts',
      settings: 'AI replies, install on your phone, delete account',
      learn: 'Step-by-step videos and pictures for every section'
    }
  },
  intro: {
    home: 'See at a glance how much Directino has done for you. Use the filters above the charts to change the period and message type.',
    rules: 'Each auto-reply is a rule: “when someone does this and writes this word, send this message”. Start from a template; advanced options like forms and follow-gating are under “Advanced settings”.',
    contacts: 'Everyone who comments on your posts or DMs you is saved here automatically, along with phone numbers and emails collected by forms. Organise them with tags and export to Excel.',
    catalog: 'Add a few products with a photo and link. When someone writes one of your showcase words in DMs (e.g. “products”), they get them all as swipeable cards.',
    tools: 'Extra tools for your account: draw giveaway winners from comments, hide spam comments automatically, set up the DM question menu and message today’s contacts.',
    settings: 'Connect AI to answer questions no rule covers, install the dashboard on your phone, or delete your account.'
  },
  filters: {
    range: 'Period',
    days: { '7': '7 days', '30': '30 days', '90': '90 days' },
    kind: 'Type',
    allKinds: 'All',
    account: 'Account',
    allAccounts: 'All accounts',
    daily: (d: string) => `Messages sent — last ${d}`
  },
  brief: {
    title: 'Summary',
    aiTitle: 'AI analysis',
    aiButton: 'Write an AI analysis',
    aiHint: 'For an AI analysis, connect an AI provider in Settings.',
    aiError: 'The AI didn’t respond: ',
    writing: 'Writing…',
    sent: (n: string, d: string) => `In the last ${d}, ${n} automatic messages were sent`,
    up: (p: string) => ` — ${p}% more than the previous period.`,
    down: (p: string) => ` — ${p}% fewer than the previous period.`,
    flat: ' — about the same as the previous period.',
    first: '.',
    topKind: (k: string, p: string) => `Most of them (${p}%) came from “${k}”.`,
    leads: (n: string) => `${n} phone numbers or emails were collected by forms.`,
    noLeads: 'No leads collected by forms yet — add a short form to your busiest reply.',
    topRule: (r: string, n: string) => `Busiest reply: “${r}” (${n} times).`,
    idle: 'Nothing was sent in this period. Create an auto-reply and write “comment 1” in your next caption.',
    newContacts: (n: string) => `${n} new contacts were added.`
  },
  charts: {
    daily: 'Messages sent — last 30 days',
    dailyEmpty: 'No data yet; this fills in with your first auto-reply.',
    byKind: 'Where they came from',
    topRules: 'Busiest auto-replies',
    table: 'Show as table',
    day: 'Day',
    count: 'Count',
    kinds: {
      comment: 'Comment', dm: 'DM', story: 'Story', mention: 'Mention', first_dm: 'Welcome', form: 'Form',
      catalog: 'Showcase', ai: 'AI', gate: 'Follow gate', moderation: 'Hidden comment', broadcast: 'Broadcast'
    },
    contacts: 'Contacts',
    leads: 'Phones/emails collected'
  },
  rule: {
    nameLabel: 'Name (for you)',
    namePh: 'e.g. Fall coat link',
    triggers: {
      comment: 'comments on a post',
      dm: 'sends a direct message',
      first_dm: 'messages you for the first time (welcome)',
      story: 'replies to your story',
      mention: 'mentions you in their story'
    },
    post: 'Which post?',
    allPosts: 'All posts',
    postsUnavailable: 'Couldn’t load posts from Instagram; the rule will apply to all posts.',
    variantsHint: 'For several variations (so messages don’t look repetitive), separate them with a line containing ---.',
    buttons: 'Link buttons (up to 3)',
    quick: 'Quick-reply buttons (comma-separated)',
    quickPh: 'Price, Shipping, Advice',
    image: 'Image before the message (image URL)',
    advanced: 'Advanced settings',
    gate: 'Follow first: if they don’t follow you, send this instead',
    gatePh: 'Follow us first, then comment “1” again and the link is yours 🌸',
    once: 'Only once per person',
    tag: 'Tag the contact',
    tagPh: 'coat-lead',
    form: 'Form: after the message, ask these questions',
    formHint: 'Answers are saved under Contacts. Phone numbers and emails are validated.',
    qKinds: { name: 'Name', phone: 'Phone', email: 'Email', custom: 'Custom question' },
    qPh: { name: 'What’s your name?', phone: 'Send your phone number so we can follow up 📱', email: 'What’s your email?', custom: 'What size are you?' },
    done: 'Message when the form is complete',
    donePh: 'Thanks! Our team will contact you soon ✨',
    badges: { once: 'Once', gate: 'Follow gate', form: 'Form', post: 'One post', image: 'Image', ai: 'AI' }
  },
  contacts: {
    title: 'Contacts',
    sub: 'Everyone who comments or messages you is saved here automatically.',
    search: 'Search name, handle, phone…',
    allTags: 'All tags',
    export: 'Export (CSV)',
    empty: 'No contacts yet.',
    cols: { user: 'User', name: 'Name', phone: 'Phone', email: 'Email', tags: 'Tags', count: 'Interactions', last: 'Last seen' },
    addTag: 'Add tag',
    window: 'In 24-hour window',
    total: 'contacts'
  },
  catalog: {
    title: 'Product showcase',
    sub: 'When someone writes one of these words in DMs, your products arrive as image cards with a buy button (up to 10 products).',
    keywords: 'Words that show the showcase',
    keywordsPh: 'products, catalog, menu',
    intro: 'Message before the showcase',
    introPh: 'Here’s this week’s collection 👇',
    button: 'Button text on each card',
    buttonPh: 'Buy',
    save: 'Save',
    add: 'Add product',
    pTitle: 'Product name',
    pSub: 'Short description',
    pPrice: 'Price',
    pImage: 'Image URL',
    pUrl: 'Buy link',
    empty: 'No products yet.',
    remove: 'Delete'
  },
  tools: {
    title: 'Tools',
    giveaway: {
      title: 'Comment giveaway',
      sub: 'Pick a post; winners are drawn from its commenters (one chance per person).',
      post: 'Post',
      count: 'Number of winners',
      keyword: 'Only comments containing this word (optional)',
      pick: 'Draw winners',
      result: 'Winners',
      among: 'drawn from',
      people: 'people',
      none: 'No eligible comments found.',
      noPosts: 'Connect an account first to run a giveaway.'
    },
    moderation: {
      title: 'Comment filter',
      sub: 'Comments containing these words are hidden automatically (abuse, competitor ads, links).',
      enabled: 'Enabled',
      words: 'Words (comma-separated)',
      wordsPh: 'http, promo, free followers',
      save: 'Save'
    },
    ice: {
      title: 'Quick-question menu',
      sub: 'When someone opens your DMs for the first time they see these questions as buttons (up to 4). Create a DM auto-reply for each with the same words.',
      ph: ['What are your prices?', 'How does shipping work?', 'Where is your store?', 'I need advice'],
      save: 'Save to Instagram',
      ok: 'Menu saved on Instagram.',
      fail: 'Instagram rejected the menu: '
    },
    broadcast: {
      title: 'Message contacts from the last 24 hours',
      sub: 'Instagram only lets you message people who messaged you in the last 24 hours.',
      eligible: 'people can be messaged now',
      tag: 'Only this tag (optional)',
      text: 'Message',
      send: 'Send',
      sent: 'Sent to'
    },
    showcase: { title: 'Product showcase', sub: 'Send your products as cards in DMs.', open: 'Manage showcase' }
  },
  settings: {
    title: 'Settings',
    ai: {
      title: 'Smart replies (AI)',
      sub: 'When no auto-reply matches a message, AI answers using your business information. You provide your own API key.',
      enabled: 'Enabled',
      provider: 'Provider',
      model: 'Model (optional)',
      baseUrl: 'API URL (Custom only)',
      key: 'API key',
      keySet: 'Key saved — type a new key to replace it',
      prompt: 'Business information',
      promptPh: 'We sell coats. Prices: ... Shipping nationwide in 3 days. Hours: ... Address: ...',
      save: 'Save'
    },
    saved: 'Saved.'
  },
  learn: {
    title: 'Tutorials',
    intro: 'Every part of Directino has a short tutorial: under-a-minute videos recorded in the dashboard itself, and picture guides for things you do outside it (like on Instagram or installing on your phone).',
    video: 'Video',
    images: 'Picture guide',
    secs: (n: string) => `${n} sec`,
    stepsN: (n: string) => `${n} steps`,
    steps: 'Steps',
    open: 'Go to this section',
    next: 'Next tutorial',
    all: 'All tutorials',
    help: 'How this works',
    allow: { wants: 'Directino would like to:', p1: 'Read and reply to your direct messages', p2: 'Read and manage your comments', p3: 'Read your basic account info', cancel: 'Cancel', ok: 'Allow' },
    home: 'Phone home screen',
    lessons: {
      start: {
        title: 'Create your account',
        sub: 'From sign-up to buying a plan and connecting your account',
        steps: ['Choose a username and a password', 'Tap “Create account”', 'Your dashboard opens. Today’s suggestions show what to do first', 'First buy a plan — your remaining days show up right here', 'Then tap “Connect account” and tap “Allow” on Instagram']
      },
      connect: {
        title: 'Connect your Instagram account',
        sub: 'It must be a professional (Business or Creator) account',
        steps: [
          { t: 'Your Instagram account must be “professional”. If it isn’t, switch in the Instagram app (it’s free and your posts stay as they are):', path: ['Settings', 'Account type and tools', 'Switch to professional account'] },
          { t: 'On Directino’s Home, tap “Connect account”.', img: 'connect-1' },
          { t: 'Instagram’s login opens. Log in to that account and tap “Allow”.', art: 'allow' },
          { t: 'You’re back in the dashboard and the account is listed. Auto-replies work from this moment.', img: 'connect-2' },
          { t: 'So DM replies arrive too, turn this on in Instagram:', path: ['Settings', 'Messages and story replies', 'Message controls', 'Connected tools', 'Allow access to messages'] }
        ]
      },
      'first-reply': {
        title: 'Your first auto-reply',
        sub: 'Everyone who comments “1” gets the product link by DM',
        steps: ['Open the menu', 'Tap “Replies”', 'Pick a template — e.g. “Product link”', 'Paste your product link next to the button', 'For a single post, choose it here', '“Save and activate” — it works from now on', 'Done ✓ Anyone who comments “1” now gets the DM']
      },
      form: {
        title: 'Collect phone numbers',
        sub: 'A short name-and-phone form inside DMs',
        steps: ['Tap the “Product link” template', 'Open “Advanced settings”', 'Tap “Custom question” — a name question is ready', 'Tap again to also ask for a phone number', 'Write the message for when the form is done', 'Save. Answers are collected under Contacts']
      },
      showcase: {
        title: 'Product showcase',
        sub: 'Your products as image cards in DMs',
        steps: ['Open “Showcase” from the menu', 'Words that trigger the showcase', 'Write the intro and button text, then save', 'Now add a product: name and price', 'Add the buy link and tap “Add product”', 'Anyone who DMs “products” gets the cards']
      },
      contacts: {
        title: 'Contacts and Excel export',
        sub: 'Search, tag and download all your customers',
        steps: ['Open “Contacts” from the menu', 'Everyone who commented or messaged is here', 'Search by name, handle or phone', 'Tag people to organise them', 'Download everyone with “Export (CSV)”']
      },
      giveaway: {
        title: 'Giveaway from comments',
        sub: 'A fair winner in seconds',
        steps: ['Open “Tools” from the menu', 'Choose the giveaway post', 'Set the number of winners', '“Draw winners” — one chance per person', 'We have a winner 🎉']
      },
      install: {
        title: 'Install on your phone',
        sub: 'Opens like an app with one tap',
        steps: [
          { t: 'Open this site in your phone’s browser and log in.' },
          { t: 'Android (Chrome): tap the three-dot menu and choose “Install app” or “Add to Home screen”.', path: ['⋮', 'Install app', 'Install'] },
          { t: 'iPhone (Safari): tap the Share button at the bottom and choose “Add to Home Screen”.', path: ['Share', 'Add to Home Screen', 'Add'] },
          { t: 'The Directino icon appears on your home screen and the dashboard opens full-screen, like an app.', art: 'home' }
        ]
      }
    }
  },
  saved: 'Saved.',
  needAccount: 'Connect an Instagram account first to use this.'
}
