/** متن‌های بخش‌های تازه‌ی پنل (نسخه‌ی ۲). ساختار en باید دقیقاً مثل fa باشد. */

export const appFa = {
  nav: { home: 'خانه', rules: 'جواب‌ها', contacts: 'مخاطبان', tools: 'ابزارها', settings: 'تنظیمات', catalog: 'ویترین' },
  account: 'پیج',
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
  saved: 'ذخیره شد.',
  needAccount: 'برای این بخش اول یک پیج اینستاگرام وصل کنید.'
}

export type AppDict = typeof appFa

export const appEn: AppDict = {
  nav: { home: 'Home', rules: 'Replies', contacts: 'Contacts', tools: 'Tools', settings: 'Settings', catalog: 'Showcase' },
  account: 'Account',
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
  saved: 'Saved.',
  needAccount: 'Connect an Instagram account first to use this.'
}
