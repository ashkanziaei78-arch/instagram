import { getDb, now, todayKey } from './index'
import type {
  AccountRow,
  Rule,
  RuleAction,
  Job,
  JobStatus,
  MediaRow,
  ActivityLogRow,
  SafetySettings,
  Broadcast,
  EngineKind
} from '../../shared/types'

/* ============================ تنظیمات ============================ */

const DEFAULT_SAFETY: SafetySettings = {
  dailyDmCap: 50,
  dailyCommentReplyCap: 100,
  dailyFollowCap: 20,
  minActionDelaySec: 25,
  maxActionDelaySec: 90,
  quietHoursEnabled: true,
  quietStartHour: 1,
  quietEndHour: 8,
  warmupEnabled: true,
  warmupDays: 7,
  killSwitch: false
}

export const settingsRepo = {
  get<T>(key: string, fallback: T): T {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    getDb()
      .prepare(
        'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
      )
      .run(key, JSON.stringify(value))
  },
  getSafety(): SafetySettings {
    return { ...DEFAULT_SAFETY, ...this.get<Partial<SafetySettings>>('safety', {}) }
  },
  setSafety(s: Partial<SafetySettings>): SafetySettings {
    const merged = { ...this.getSafety(), ...s }
    this.set('safety', merged)
    return merged
  }
}

/* ============================ حساب‌ها ============================ */

export const accountsRepo = {
  all(): AccountRow[] {
    return getDb().prepare('SELECT * FROM accounts ORDER BY id').all() as AccountRow[]
  },
  byId(id: number): AccountRow | undefined {
    return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined
  },
  byIgId(igId: string): AccountRow | undefined {
    return getDb().prepare('SELECT * FROM accounts WHERE ig_user_id = ?').get(igId) as
      | AccountRow
      | undefined
  },
  upsert(a: {
    ig_user_id: string
    username: string
    name?: string | null
    profile_picture_url?: string | null
    engine: EngineKind
    followers_count?: number
    follows_count?: number
    media_count?: number
    token_expires_at?: number | null
  }): AccountRow {
    const t = now()
    getDb()
      .prepare(
        `INSERT INTO accounts
          (ig_user_id, username, name, profile_picture_url, engine, followers_count,
           follows_count, media_count, token_expires_at, status, created_at, updated_at)
         VALUES (@ig_user_id,@username,@name,@profile_picture_url,@engine,@followers_count,
                 @follows_count,@media_count,@token_expires_at,'active',@t,@t)
         ON CONFLICT(ig_user_id) DO UPDATE SET
           username=excluded.username,
           name=excluded.name,
           profile_picture_url=excluded.profile_picture_url,
           engine=excluded.engine,
           followers_count=excluded.followers_count,
           follows_count=excluded.follows_count,
           media_count=excluded.media_count,
           token_expires_at=excluded.token_expires_at,
           status='active',
           last_error=NULL,
           updated_at=@t`
      )
      .run({
        ig_user_id: a.ig_user_id,
        username: a.username,
        name: a.name ?? null,
        profile_picture_url: a.profile_picture_url ?? null,
        engine: a.engine,
        followers_count: a.followers_count ?? 0,
        follows_count: a.follows_count ?? 0,
        media_count: a.media_count ?? 0,
        token_expires_at: a.token_expires_at ?? null,
        t
      })
    return this.byIgId(a.ig_user_id)!
  },
  setStatus(id: number, status: AccountRow['status'], error?: string): void {
    getDb()
      .prepare('UPDATE accounts SET status=?, last_error=?, updated_at=? WHERE id=?')
      .run(status, error ?? null, now(), id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM accounts WHERE id=?').run(id)
  },
  snapshot(accountId: number, followers: number, follows: number, media: number): void {
    getDb()
      .prepare(
        `INSERT INTO follower_snapshots(account_id, day, followers_count, follows_count, media_count)
         VALUES (?,?,?,?,?)
         ON CONFLICT(account_id, day) DO UPDATE SET
           followers_count=excluded.followers_count,
           follows_count=excluded.follows_count,
           media_count=excluded.media_count`
      )
      .run(accountId, todayKey(), followers, follows, media)
  },
  growth(accountId: number, days = 30): { day: string; followers_count: number }[] {
    const rows = getDb()
      .prepare(
        `SELECT day, followers_count FROM follower_snapshots
         WHERE account_id=? ORDER BY day DESC LIMIT ?`
      )
      .all(accountId, days) as { day: string; followers_count: number }[]
    return rows.reverse()
  }
}

/* ============================ قوانین ============================ */

type RuleDbRow = Omit<Rule, 'actions' | 'enabled' | 'case_sensitive' | 'once_per_user'> & {
  actions_json: string
  enabled: number
  case_sensitive: number
  once_per_user: number
}

function hydrateRule(r: RuleDbRow): Rule {
  let actions: RuleAction[] = []
  try {
    actions = JSON.parse(r.actions_json)
  } catch {
    actions = []
  }
  return {
    ...r,
    enabled: !!r.enabled,
    case_sensitive: !!r.case_sensitive,
    once_per_user: !!r.once_per_user,
    actions: actions.sort((a, b) => a.order - b.order)
  }
}

export const rulesRepo = {
  byAccount(accountId: number): Rule[] {
    const rows = getDb()
      .prepare('SELECT * FROM rules WHERE account_id=? ORDER BY priority DESC, id')
      .all(accountId) as RuleDbRow[]
    return rows.map(hydrateRule)
  },
  /** فقط قوانین فعالِ یک تریگر خاص — داغ‌ترین کوئری در مسیر پردازش وبهوک */
  active(accountId: number, trigger: Rule['trigger_type']): Rule[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM rules WHERE account_id=? AND trigger_type=? AND enabled=1 ORDER BY priority DESC, id'
      )
      .all(accountId, trigger) as RuleDbRow[]
    return rows.map(hydrateRule)
  },
  byId(id: number): Rule | undefined {
    const r = getDb().prepare('SELECT * FROM rules WHERE id=?').get(id) as RuleDbRow | undefined
    return r ? hydrateRule(r) : undefined
  },
  create(
    r: Partial<Rule> & { account_id: number; name: string; trigger_type: Rule['trigger_type'] }
  ): Rule {
    const t = now()
    const info = getDb()
      .prepare(
        `INSERT INTO rules (account_id,name,enabled,trigger_type,match_mode,keywords,case_sensitive,
            media_scope,actions_json,once_per_user,delay_min,delay_max,priority,created_at,updated_at)
         VALUES (@account_id,@name,@enabled,@trigger_type,@match_mode,@keywords,@case_sensitive,
            @media_scope,@actions_json,@once_per_user,@delay_min,@delay_max,@priority,@t,@t)`
      )
      .run({
        account_id: r.account_id,
        name: r.name,
        enabled: r.enabled === false ? 0 : 1,
        trigger_type: r.trigger_type,
        match_mode: r.match_mode ?? 'contains',
        keywords: r.keywords ?? '',
        case_sensitive: r.case_sensitive ? 1 : 0,
        media_scope: r.media_scope ?? null,
        actions_json: JSON.stringify(r.actions ?? []),
        once_per_user: r.once_per_user === false ? 0 : 1,
        delay_min: r.delay_min ?? 5,
        delay_max: r.delay_max ?? 40,
        priority: r.priority ?? 0,
        t
      })
    return this.byId(Number(info.lastInsertRowid))!
  },
  update(id: number, r: Partial<Rule>): Rule | undefined {
    const cur = this.byId(id)
    if (!cur) return undefined
    const merged = { ...cur, ...r }
    getDb()
      .prepare(
        `UPDATE rules SET name=@name, enabled=@enabled, trigger_type=@trigger_type,
           match_mode=@match_mode, keywords=@keywords, case_sensitive=@case_sensitive,
           media_scope=@media_scope, actions_json=@actions_json, once_per_user=@once_per_user,
           delay_min=@delay_min, delay_max=@delay_max, priority=@priority, updated_at=@t
         WHERE id=@id`
      )
      .run({
        id,
        name: merged.name,
        enabled: merged.enabled ? 1 : 0,
        trigger_type: merged.trigger_type,
        match_mode: merged.match_mode,
        keywords: merged.keywords,
        case_sensitive: merged.case_sensitive ? 1 : 0,
        media_scope: merged.media_scope,
        actions_json: JSON.stringify(merged.actions),
        once_per_user: merged.once_per_user ? 1 : 0,
        delay_min: merged.delay_min,
        delay_max: merged.delay_max,
        priority: merged.priority,
        t: now()
      })
    return this.byId(id)
  },
  remove(id: number): void {
    getDb().prepare('DELETE FROM rules WHERE id=?').run(id)
  },
  incHit(id: number): void {
    getDb().prepare('UPDATE rules SET hit_count = hit_count + 1 WHERE id=?').run(id)
  }
}

/* ============================ مخاطبان ============================ */

export interface ContactRow {
  id: number
  account_id: number
  ig_user_id: string
  username: string | null
  full_name: string | null
  profile_pic: string | null
  is_follower: number
  is_following: number
  is_private: number
  is_verified: number
  followers_count: number
  tags: string
  last_inbound_at: number | null
  last_outbound_at: number | null
  first_seen_at: number
  welcomed_at: number | null
  blocked: number
}

export const contactsRepo = {
  upsert(
    accountId: number,
    c: {
      ig_user_id: string
      username?: string | null
      full_name?: string | null
      profile_pic?: string | null
      is_follower?: boolean
      is_following?: boolean
      is_private?: boolean
      is_verified?: boolean
      followers_count?: number
    }
  ): void {
    getDb()
      .prepare(
        `INSERT INTO contacts(account_id, ig_user_id, username, full_name, profile_pic,
             is_follower, is_following, is_private, is_verified, followers_count, first_seen_at)
         VALUES (@account_id,@ig_user_id,@username,@full_name,@profile_pic,
             @is_follower,@is_following,@is_private,@is_verified,@followers_count,@t)
         ON CONFLICT(account_id, ig_user_id) DO UPDATE SET
           username=COALESCE(excluded.username, contacts.username),
           full_name=COALESCE(excluded.full_name, contacts.full_name),
           profile_pic=COALESCE(excluded.profile_pic, contacts.profile_pic),
           is_follower=excluded.is_follower,
           is_following=excluded.is_following,
           is_private=excluded.is_private,
           is_verified=excluded.is_verified,
           followers_count=excluded.followers_count`
      )
      .run({
        account_id: accountId,
        ig_user_id: c.ig_user_id,
        username: c.username ?? null,
        full_name: c.full_name ?? null,
        profile_pic: c.profile_pic ?? null,
        is_follower: c.is_follower ? 1 : 0,
        is_following: c.is_following ? 1 : 0,
        is_private: c.is_private ? 1 : 0,
        is_verified: c.is_verified ? 1 : 0,
        followers_count: c.followers_count ?? 0,
        t: now()
      })
  },
  get(accountId: number, igUserId: string): ContactRow | undefined {
    return getDb()
      .prepare('SELECT * FROM contacts WHERE account_id=? AND ig_user_id=?')
      .get(accountId, igUserId) as ContactRow | undefined
  },
  markInbound(accountId: number, igUserId: string): void {
    getDb()
      .prepare(
        `INSERT INTO contacts(account_id, ig_user_id, last_inbound_at, first_seen_at)
         VALUES(?,?,?,?)
         ON CONFLICT(account_id, ig_user_id) DO UPDATE SET last_inbound_at=excluded.last_inbound_at`
      )
      .run(accountId, igUserId, now(), now())
  },
  markOutbound(accountId: number, igUserId: string): void {
    getDb()
      .prepare('UPDATE contacts SET last_outbound_at=? WHERE account_id=? AND ig_user_id=?')
      .run(now(), accountId, igUserId)
  },
  markWelcomed(accountId: number, igUserId: string): void {
    getDb()
      .prepare('UPDATE contacts SET welcomed_at=? WHERE account_id=? AND ig_user_id=?')
      .run(now(), accountId, igUserId)
  },
  /** آیا این کاربر در ۲۴ ساعت گذشته پیام داده؟ (شرط ارسال با API رسمی) */
  isWindowOpen(accountId: number, igUserId: string): boolean {
    const r = getDb()
      .prepare('SELECT last_inbound_at FROM contacts WHERE account_id=? AND ig_user_id=?')
      .get(accountId, igUserId) as { last_inbound_at: number | null } | undefined
    if (!r || !r.last_inbound_at) return false
    return now() - r.last_inbound_at < 24 * 60 * 60 * 1000
  },
  list(accountId: number, filter: { audience?: string; limit?: number } = {}): ContactRow[] {
    const lim = filter.limit ?? 500
    let where = 'account_id=? AND blocked=0'
    switch (filter.audience) {
      case 'followers':
        where += ' AND is_follower=1'
        break
      case 'following':
        where += ' AND is_following=1'
        break
      case 'mutual':
        where += ' AND is_follower=1 AND is_following=1'
        break
      case 'engaged_24h':
        where += ' AND last_inbound_at IS NOT NULL AND last_inbound_at > ' + (now() - 86400000)
        break
    }
    return getDb()
      .prepare('SELECT * FROM contacts WHERE ' + where + ' ORDER BY first_seen_at DESC LIMIT ?')
      .all(accountId, lim) as ContactRow[]
  },
  count(accountId: number, audience: string): number {
    return this.list(accountId, { audience, limit: 1000000 }).length
  },
  /** همگام‌سازی کامل لیست فالوورها و برگرداندن شناسه‌ی فالوورهای *جدید* */
  syncFollowers(
    accountId: number,
    followers: {
      ig_user_id: string
      username?: string
      full_name?: string
      profile_pic?: string
      is_private?: boolean
      is_verified?: boolean
    }[]
  ): string[] {
    const db = getDb()
    const existing = new Set(
      (
        db
          .prepare('SELECT ig_user_id FROM contacts WHERE account_id=? AND is_follower=1')
          .all(accountId) as { ig_user_id: string }[]
      ).map((r) => r.ig_user_id)
    )
    const incoming = new Set(followers.map((f) => f.ig_user_id))
    const newOnes: string[] = []

    const tx = db.transaction(() => {
      for (const f of followers) {
        if (!existing.has(f.ig_user_id)) newOnes.push(f.ig_user_id)
        contactsRepo.upsert(accountId, { ...f, is_follower: true })
      }
      // کسانی که آنفالو کرده‌اند
      for (const old of existing) {
        if (!incoming.has(old)) {
          db.prepare('UPDATE contacts SET is_follower=0 WHERE account_id=? AND ig_user_id=?').run(
            accountId,
            old
          )
        }
      }
    })
    tx()
    return newOnes
  }
}

/* ============================ مدیا ============================ */

export const mediaRepo = {
  upsert(accountId: number, m: Partial<MediaRow> & { media_id: string; timestamp: number }): void {
    getDb()
      .prepare(
        `INSERT INTO media(account_id, media_id, media_type, caption, permalink, thumbnail_url,
            timestamp, like_count, comments_count, views, reach, saved, shares, last_synced)
         VALUES(@account_id,@media_id,@media_type,@caption,@permalink,@thumbnail_url,
            @timestamp,@like_count,@comments_count,@views,@reach,@saved,@shares,@last_synced)
         ON CONFLICT(account_id, media_id) DO UPDATE SET
           caption=excluded.caption, permalink=excluded.permalink,
           thumbnail_url=excluded.thumbnail_url, like_count=excluded.like_count,
           comments_count=excluded.comments_count, views=excluded.views,
           reach=excluded.reach, saved=excluded.saved, shares=excluded.shares,
           last_synced=excluded.last_synced`
      )
      .run({
        account_id: accountId,
        media_id: m.media_id,
        media_type: m.media_type ?? 'IMAGE',
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? null,
        timestamp: m.timestamp,
        like_count: m.like_count ?? 0,
        comments_count: m.comments_count ?? 0,
        views: m.views ?? 0,
        reach: m.reach ?? 0,
        saved: m.saved ?? 0,
        shares: m.shares ?? 0,
        last_synced: now()
      })
  },
  list(accountId: number, limit = 50): MediaRow[] {
    return getDb()
      .prepare('SELECT * FROM media WHERE account_id=? ORDER BY timestamp DESC LIMIT ?')
      .all(accountId, limit) as MediaRow[]
  },
  byMediaId(accountId: number, mediaId: string): MediaRow | undefined {
    return getDb()
      .prepare('SELECT * FROM media WHERE account_id=? AND media_id=?')
      .get(accountId, mediaId) as MediaRow | undefined
  },
  /** پست‌هایی که هنوز برایشان برادکست ارسال نشده (اتوماسیون «پست جدید») */
  pendingBroadcast(accountId: number, sinceTs: number): MediaRow[] {
    return getDb()
      .prepare(
        'SELECT * FROM media WHERE account_id=? AND broadcast_done=0 AND timestamp>=? ORDER BY timestamp'
      )
      .all(accountId, sinceTs) as MediaRow[]
  },
  markBroadcast(accountId: number, mediaId: string): void {
    getDb()
      .prepare('UPDATE media SET broadcast_done=1 WHERE account_id=? AND media_id=?')
      .run(accountId, mediaId)
  },
  totals(accountId: number): {
    posts: number
    likes: number
    comments: number
    views: number
    reach: number
    saved: number
  } {
    return getDb()
      .prepare(
        `SELECT COUNT(*) AS posts, COALESCE(SUM(like_count),0) AS likes,
                COALESCE(SUM(comments_count),0) AS comments, COALESCE(SUM(views),0) AS views,
                COALESCE(SUM(reach),0) AS reach, COALESCE(SUM(saved),0) AS saved
         FROM media WHERE account_id=?`
      )
      .get(accountId) as {
      posts: number
      likes: number
      comments: number
      views: number
      reach: number
      saved: number
    }
  }
}

/* ============================ کامنت‌ها / پیام‌ها ============================ */

export const commentsRepo = {
  /** true اگر این کامنت برای اولین بار دیده می‌شود (وبهوک ممکن است تکراری بفرستد) */
  markSeen(
    accountId: number,
    c: {
      comment_id: string
      media_id?: string
      from_user_id?: string
      from_username?: string
      text?: string
      matched_rule_id?: number | null
    }
  ): boolean {
    try {
      getDb()
        .prepare(
          `INSERT INTO comments_seen(account_id, comment_id, media_id, from_user_id, from_username, text, matched_rule_id, processed_at)
           VALUES(?,?,?,?,?,?,?,?)`
        )
        .run(
          accountId,
          c.comment_id,
          c.media_id ?? null,
          c.from_user_id ?? null,
          c.from_username ?? null,
          c.text ?? null,
          c.matched_rule_id ?? null,
          now()
        )
      return true
    } catch {
      return false // UNIQUE constraint → قبلا پردازش شده
    }
  },
  recent(accountId: number, limit = 100): Record<string, unknown>[] {
    return getDb()
      .prepare('SELECT * FROM comments_seen WHERE account_id=? ORDER BY processed_at DESC LIMIT ?')
      .all(accountId, limit) as Record<string, unknown>[]
  },
  /** آیا این کاربر قبلا با این قانون پاسخ گرفته؟ (once_per_user) */
  alreadyHandled(accountId: number, ruleId: number, fromUserId: string): boolean {
    const r = getDb()
      .prepare(
        'SELECT 1 FROM comments_seen WHERE account_id=? AND matched_rule_id=? AND from_user_id=? LIMIT 1'
      )
      .get(accountId, ruleId, fromUserId)
    return !!r
  }
}

export const messagesRepo = {
  log(m: {
    account_id: number
    contact_ig_id: string
    direction: 'in' | 'out'
    text?: string
    rule_id?: number | null
    broadcast_id?: number | null
    status?: string
    error?: string | null
  }): void {
    getDb()
      .prepare(
        `INSERT INTO messages(account_id, contact_ig_id, direction, text, rule_id, broadcast_id, status, error, created_at)
         VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(
        m.account_id,
        m.contact_ig_id,
        m.direction,
        m.text ?? null,
        m.rule_id ?? null,
        m.broadcast_id ?? null,
        m.status ?? 'sent',
        m.error ?? null,
        now()
      )
  },
  thread(accountId: number, contactId: string, limit = 50): Record<string, unknown>[] {
    return getDb()
      .prepare(
        'SELECT * FROM messages WHERE account_id=? AND contact_ig_id=? ORDER BY created_at DESC LIMIT ?'
      )
      .all(accountId, contactId, limit) as Record<string, unknown>[]
  },
  recent(accountId: number, limit = 100): Record<string, unknown>[] {
    return getDb()
      .prepare('SELECT * FROM messages WHERE account_id=? ORDER BY created_at DESC LIMIT ?')
      .all(accountId, limit) as Record<string, unknown>[]
  },
  sentToday(accountId: number): number {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const r = getDb()
      .prepare(
        "SELECT COUNT(*) AS c FROM messages WHERE account_id=? AND direction='out' AND created_at>=?"
      )
      .get(accountId, start.getTime()) as { c: number }
    return r.c
  }
}

/* ============================ شمارنده‌ی اکشن (سقف روزانه) ============================ */

export const countersRepo = {
  get(accountId: number, action: string): number {
    const r = getDb()
      .prepare('SELECT count FROM action_counters WHERE account_id=? AND day=? AND action=?')
      .get(accountId, todayKey(), action) as { count: number } | undefined
    return r ? r.count : 0
  },
  inc(accountId: number, action: string, by = 1): number {
    getDb()
      .prepare(
        `INSERT INTO action_counters(account_id, day, action, count) VALUES(?,?,?,?)
         ON CONFLICT(account_id, day, action) DO UPDATE SET count = count + ?`
      )
      .run(accountId, todayKey(), action, by, by)
    return this.get(accountId, action)
  },
  todayAll(accountId: number): Record<string, number> {
    const rows = getDb()
      .prepare('SELECT action, count FROM action_counters WHERE account_id=? AND day=?')
      .all(accountId, todayKey()) as { action: string; count: number }[]
    return Object.fromEntries(rows.map((r) => [r.action, r.count]))
  }
}

/* ============================ صف کار ============================ */

export const jobsRepo = {
  enqueue(j: {
    account_id: number
    kind: string
    payload?: unknown
    run_at?: number
    max_attempts?: number
    dedupe_key?: string | null
  }): number | null {
    const t = now()
    try {
      const info = getDb()
        .prepare(
          `INSERT INTO jobs(account_id, kind, payload, status, run_at, max_attempts, dedupe_key, created_at, updated_at)
           VALUES(?,?,?,'pending',?,?,?,?,?)`
        )
        .run(
          j.account_id,
          j.kind,
          JSON.stringify(j.payload ?? {}),
          j.run_at ?? t,
          j.max_attempts ?? 3,
          j.dedupe_key ?? null,
          t,
          t
        )
      return Number(info.lastInsertRowid)
    } catch {
      return null // dedupe_key تکراری → کار قبلا در صف است
    }
  },
  /** برداشتن کارهای آماده و قفل‌کردن اتمیک آن‌ها در یک تراکنش */
  claimReady(limit = 5): Job[] {
    const db = getDb()
    const tx = db.transaction(() => {
      const rows = db
        .prepare("SELECT * FROM jobs WHERE status='pending' AND run_at<=? ORDER BY run_at LIMIT ?")
        .all(now(), limit) as Job[]
      for (const r of rows) {
        db.prepare("UPDATE jobs SET status='running', updated_at=? WHERE id=?").run(now(), r.id)
      }
      return rows
    })
    return tx()
  },
  finish(id: number, status: JobStatus, error?: string): void {
    getDb()
      .prepare('UPDATE jobs SET status=?, last_error=?, updated_at=? WHERE id=?')
      .run(status, error ?? null, now(), id)
  },
  retry(id: number, delayMs: number, error: string): void {
    getDb()
      .prepare(
        "UPDATE jobs SET status='pending', attempts=attempts+1, run_at=?, last_error=?, updated_at=? WHERE id=?"
      )
      .run(now() + delayMs, error, now(), id)
  },
  /**
   * موکول کردن کار به آینده *بدون* افزایش شمارنده‌ی تلاش.
   * برای وقتی که نگهبان ایمنی اجازه نداده — این تأخیر است، نه شکست، و نباید
   * سهمیه‌ی تلاش‌های کار را بسوزاند (وگرنه یک شب ساعات سکوت، کار را می‌کشد).
   */
  defer(id: number, delayMs: number, reason: string): void {
    getDb()
      .prepare("UPDATE jobs SET status='pending', run_at=?, last_error=?, updated_at=? WHERE id=?")
      .run(now() + delayMs, reason, now(), id)
  },
  /** کارهایی که هنگام بسته‌شدن ناگهانی اپ در حالت running مانده‌اند */
  recoverStuck(): number {
    const info = getDb()
      .prepare("UPDATE jobs SET status='pending', updated_at=? WHERE status='running'")
      .run(now())
    return info.changes
  },
  pendingCount(accountId?: number): number {
    const r = accountId
      ? getDb()
          .prepare("SELECT COUNT(*) c FROM jobs WHERE status='pending' AND account_id=?")
          .get(accountId)
      : getDb().prepare("SELECT COUNT(*) c FROM jobs WHERE status='pending'").get()
    return (r as { c: number }).c
  },
  list(limit = 100): Job[] {
    return getDb().prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit) as Job[]
  },
  cancelPending(): number {
    const info = getDb()
      .prepare("UPDATE jobs SET status='cancelled', updated_at=? WHERE status='pending'")
      .run(now())
    return info.changes
  }
}

/* ============================ برادکست ============================ */

export const broadcastsRepo = {
  create(b: {
    account_id: number
    name: string
    message: string
    media_id?: string | null
    filter_json: string
  }): Broadcast {
    const info = getDb()
      .prepare(
        `INSERT INTO broadcasts(account_id,name,message,media_id,filter_json,status,created_at)
         VALUES(?,?,?,?,?,'draft',?)`
      )
      .run(b.account_id, b.name, b.message, b.media_id ?? null, b.filter_json, now())
    return this.byId(Number(info.lastInsertRowid))!
  },
  byId(id: number): Broadcast | undefined {
    return getDb().prepare('SELECT * FROM broadcasts WHERE id=?').get(id) as Broadcast | undefined
  },
  list(accountId: number): Broadcast[] {
    return getDb()
      .prepare('SELECT * FROM broadcasts WHERE account_id=? ORDER BY id DESC')
      .all(accountId) as Broadcast[]
  },
  addTargets(broadcastId: number, targets: { ig_user_id: string; username?: string | null }[]): number {
    const db = getDb()
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO broadcast_targets(broadcast_id, ig_user_id, username, status)
       VALUES(?,?,?,'pending')`
    )
    const tx = db.transaction(() => {
      for (const t of targets) stmt.run(broadcastId, t.ig_user_id, t.username ?? null)
    })
    tx()
    const c = db
      .prepare('SELECT COUNT(*) c FROM broadcast_targets WHERE broadcast_id=?')
      .get(broadcastId) as { c: number }
    db.prepare('UPDATE broadcasts SET total=? WHERE id=?').run(c.c, broadcastId)
    return c.c
  },
  nextTarget(
    broadcastId: number
  ): { id: number; ig_user_id: string; username: string | null } | undefined {
    return getDb()
      .prepare("SELECT * FROM broadcast_targets WHERE broadcast_id=? AND status='pending' LIMIT 1")
      .get(broadcastId) as { id: number; ig_user_id: string; username: string | null } | undefined
  },
  markTarget(id: number, status: 'sent' | 'failed' | 'skipped', error?: string): void {
    getDb()
      .prepare('UPDATE broadcast_targets SET status=?, error=?, sent_at=? WHERE id=?')
      .run(status, error ?? null, now(), id)
  },
  setStatus(id: number, status: Broadcast['status']): void {
    if (status === 'running') {
      getDb()
        .prepare('UPDATE broadcasts SET status=?, started_at=COALESCE(started_at, ?) WHERE id=?')
        .run(status, now(), id)
    } else if (status === 'done' || status === 'failed') {
      getDb()
        .prepare('UPDATE broadcasts SET status=?, finished_at=? WHERE id=?')
        .run(status, now(), id)
    } else {
      getDb().prepare('UPDATE broadcasts SET status=? WHERE id=?').run(status, id)
    }
  },
  bumpCounters(id: number): void {
    getDb()
      .prepare(
        `UPDATE broadcasts SET
           sent=(SELECT COUNT(*) FROM broadcast_targets WHERE broadcast_id=? AND status='sent'),
           failed=(SELECT COUNT(*) FROM broadcast_targets WHERE broadcast_id=? AND status='failed')
         WHERE id=?`
      )
      .run(id, id, id)
  },
  targets(broadcastId: number, limit = 200): Record<string, unknown>[] {
    return getDb()
      .prepare('SELECT * FROM broadcast_targets WHERE broadcast_id=? LIMIT ?')
      .all(broadcastId, limit) as Record<string, unknown>[]
  }
}

/* ============================ لاگ ============================ */

export const logRepo = {
  add(l: {
    account_id?: number | null
    level?: ActivityLogRow['level']
    category?: string
    message: string
    meta?: unknown
  }): void {
    getDb()
      .prepare(
        'INSERT INTO activity_log(account_id, level, category, message, meta, created_at) VALUES(?,?,?,?,?,?)'
      )
      .run(
        l.account_id ?? null,
        l.level ?? 'info',
        l.category ?? 'general',
        l.message,
        l.meta ? JSON.stringify(l.meta) : null,
        now()
      )
  },
  list(limit = 200, accountId?: number): ActivityLogRow[] {
    return accountId
      ? (getDb()
          .prepare('SELECT * FROM activity_log WHERE account_id=? ORDER BY id DESC LIMIT ?')
          .all(accountId, limit) as ActivityLogRow[])
      : (getDb()
          .prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?')
          .all(limit) as ActivityLogRow[])
  },
  prune(keepDays = 30): void {
    getDb()
      .prepare('DELETE FROM activity_log WHERE created_at < ?')
      .run(now() - keepDays * 86400000)
  }
}

/* ============================ وضعیت نظرسنجی فالوور ============================ */

export const followerPollRepo = {
  state(accountId: number): { last_full_sync: number; last_known_count: number; baseline_done: number } {
    const r = getDb()
      .prepare('SELECT * FROM follower_poll_state WHERE account_id=?')
      .get(accountId) as
      | { account_id: number; last_full_sync: number; last_known_count: number; baseline_done: number }
      | undefined
    if (r) return r
    getDb()
      .prepare('INSERT INTO follower_poll_state(account_id) VALUES(?)')
      .run(accountId)
    return { last_full_sync: 0, last_known_count: 0, baseline_done: 0 }
  },
  update(accountId: number, s: { last_full_sync?: number; last_known_count?: number; baseline_done?: number }): void {
    const cur = this.state(accountId)
    getDb()
      .prepare(
        'UPDATE follower_poll_state SET last_full_sync=?, last_known_count=?, baseline_done=? WHERE account_id=?'
      )
      .run(
        s.last_full_sync ?? cur.last_full_sync,
        s.last_known_count ?? cur.last_known_count,
        s.baseline_done ?? cur.baseline_done,
        accountId
      )
  }
}
