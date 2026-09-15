/**
 * اسکیمای دیتابیس به صورت رشته‌ی TypeScript (نه فایل .sql) تا باندلر Electron
 * بدون تنظیم اضافی آن را داخل خروجی قرار دهد.
 *
 * هر مهاجرت یک بار و به ترتیب اجرا می‌شود؛ نسخه در PRAGMA user_version نگه‌داری می‌گردد.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ig_user_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      name TEXT,
      profile_picture_url TEXT,
      engine TEXT NOT NULL DEFAULT 'graph',
      followers_count INTEGER NOT NULL DEFAULT 0,
      follows_count INTEGER NOT NULL DEFAULT 0,
      media_count INTEGER NOT NULL DEFAULT 0,
      token_expires_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      trigger_type TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'contains',
      keywords TEXT NOT NULL DEFAULT '',
      case_sensitive INTEGER NOT NULL DEFAULT 0,
      media_scope TEXT,
      actions_json TEXT NOT NULL DEFAULT '[]',
      once_per_user INTEGER NOT NULL DEFAULT 1,
      delay_min INTEGER NOT NULL DEFAULT 5,
      delay_max INTEGER NOT NULL DEFAULT 40,
      priority INTEGER NOT NULL DEFAULT 0,
      hit_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rules_account ON rules(account_id, enabled, trigger_type);

    -- مخاطبان: هر کسی که با حساب تعامل داشته یا فالوور است
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      username TEXT,
      full_name TEXT,
      profile_pic TEXT,
      is_follower INTEGER NOT NULL DEFAULT 0,
      is_following INTEGER NOT NULL DEFAULT 0,
      is_private INTEGER NOT NULL DEFAULT 0,
      is_verified INTEGER NOT NULL DEFAULT 0,
      followers_count INTEGER DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '',
      -- زمان آخرین پیامی که *کاربر* فرستاده؛ مبنای پنجره ۲۴ ساعته
      last_inbound_at INTEGER,
      last_outbound_at INTEGER,
      first_seen_at INTEGER NOT NULL,
      welcomed_at INTEGER,
      blocked INTEGER NOT NULL DEFAULT 0,
      UNIQUE(account_id, ig_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_follower ON contacts(account_id, is_follower);
    CREATE INDEX IF NOT EXISTS idx_contacts_window ON contacts(account_id, last_inbound_at);

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'IMAGE',
      caption TEXT,
      permalink TEXT,
      thumbnail_url TEXT,
      timestamp INTEGER NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      reach INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      broadcast_done INTEGER NOT NULL DEFAULT 0,
      last_synced INTEGER NOT NULL DEFAULT 0,
      UNIQUE(account_id, media_id)
    );
    CREATE INDEX IF NOT EXISTS idx_media_ts ON media(account_id, timestamp DESC);

    -- جلوگیری از پردازش دوباره‌ی یک کامنت (وبهوک ممکن است دوبار بفرستد)
    CREATE TABLE IF NOT EXISTS comments_seen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      comment_id TEXT NOT NULL,
      media_id TEXT,
      from_user_id TEXT,
      from_username TEXT,
      text TEXT,
      matched_rule_id INTEGER,
      processed_at INTEGER NOT NULL,
      UNIQUE(account_id, comment_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      contact_ig_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      text TEXT,
      rule_id INTEGER,
      broadcast_id INTEGER,
      status TEXT NOT NULL DEFAULT 'sent',
      error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(account_id, contact_ig_id, created_at DESC);

    -- صف کار پایدار: اگر اپ بسته شود، کارها از بین نمی‌روند
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      run_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      dedupe_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(status, run_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe ON jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      media_id TEXT,
      filter_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      total INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS broadcast_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at INTEGER,
      UNIQUE(broadcast_id, ig_user_id)
    );

    -- شمارش اکشن‌ها برای اعمال سقف روزانه
    CREATE TABLE IF NOT EXISTS action_counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      action TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(account_id, day, action)
    );

    CREATE TABLE IF NOT EXISTS follower_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      followers_count INTEGER NOT NULL,
      follows_count INTEGER NOT NULL,
      media_count INTEGER NOT NULL,
      UNIQUE(account_id, day)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      level TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_log_time ON activity_log(created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    `
  },
  {
    version: 2,
    sql: `
    -- ذخیره‌ی زمان آخرین نظرسنجیِ فالوور برای تشخیص فالوور جدید
    CREATE TABLE IF NOT EXISTS follower_poll_state (
      account_id INTEGER PRIMARY KEY,
      last_full_sync INTEGER NOT NULL DEFAULT 0,
      last_known_count INTEGER NOT NULL DEFAULT 0,
      baseline_done INTEGER NOT NULL DEFAULT 0
    );
    `
  }
]
