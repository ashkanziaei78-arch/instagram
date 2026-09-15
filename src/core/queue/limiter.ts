import type { SafetySettings } from '../../shared/types'
import { accountsRepo, countersRepo, settingsRepo } from '../db/repos'

export type ActionKind = 'dm' | 'comment_reply' | 'follow' | 'like' | 'read'

export interface GateDecision {
  allowed: boolean
  /** اگر اجازه نداد، چند میلی‌ثانیه بعد دوباره امتحان شود (0 = هرگز، رد نهایی) */
  retryAfterMs: number
  reason: string
}

const ALLOW: GateDecision = { allowed: true, retryAfterMs: 0, reason: 'مجاز' }

/**
 * سطل توکن (Token Bucket) برای کنترل نرخ لحظه‌ای.
 *
 * تفاوتش با سقف روزانه: سقف روزانه جلوی «۵۰۰ دایرکت در روز» را می‌گیرد، اما
 * جلوی «۵۰ دایرکت در ۳۰ ثانیه» را نمی‌گیرد — و دقیقا همین دومی است که
 * اینستاگرام را به واکنش وامی‌دارد. سطل توکن فاصله‌ی بین اکشن‌ها را کنترل می‌کند.
 */
export class TokenBucket {
  private tokens: number
  private lastRefill: number

  constructor(
    private readonly capacity: number,
    /** توکن در دقیقه */
    private readonly refillPerMinute: number
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  private refill(): void {
    const elapsedMin = (Date.now() - this.lastRefill) / 60000
    if (elapsedMin <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMin * this.refillPerMinute)
    this.lastRefill = Date.now()
  }

  tryTake(n = 1): boolean {
    this.refill()
    if (this.tokens >= n) {
      this.tokens -= n
      return true
    }
    return false
  }

  /** چند میلی‌ثانیه تا آزاد شدن n توکن */
  msUntilAvailable(n = 1): number {
    this.refill()
    if (this.tokens >= n) return 0
    const needed = n - this.tokens
    return Math.ceil((needed / this.refillPerMinute) * 60000)
  }

  get available(): number {
    this.refill()
    return Math.floor(this.tokens)
  }
}

/** ظرفیت پیش‌فرض سطل‌ها به ازای هر نوع اکشن */
const BUCKET_CONFIG: Record<ActionKind, { capacity: number; perMinute: number }> = {
  // محافظه‌کارانه: حداکثر ۵ دایرکت پشت‌سرهم، بعد ۲ در دقیقه
  dm: { capacity: 5, perMinute: 2 },
  comment_reply: { capacity: 8, perMinute: 4 },
  follow: { capacity: 3, perMinute: 1 },
  like: { capacity: 10, perMinute: 6 },
  read: { capacity: 60, perMinute: 60 }
}

/**
 * نگهبان ایمنی: تنها دری که هر اکشن نویسنده (دایرکت، ریپلای، فالو) باید از آن بگذرد.
 *
 * ترتیب بررسی‌ها عمدی است — از ارزان به گران و از قطعی به احتمالی:
 *   ۱. کلید قطع اضطراری   → رد نهایی
 *   ۲. ساعات سکوت         → تا پایان سکوت صبر کن
 *   ۳. سقف روزانه         → تا بامداد فردا صبر کن
 *   ۴. دوره‌ی گرم‌کردن     → سقف کمتر برای حساب‌های تازه
 *   ۵. سطل توکن           → چند دقیقه صبر کن
 */
export class SafetyGate {
  private buckets = new Map<string, TokenBucket>()
  /** وقتی اینستاگرام محدودیت اعلام کند، تا این زمان هیچ اکشنی نمی‌فرستیم */
  private cooldownUntil = new Map<number, number>()

  private bucket(accountId: number, action: ActionKind): TokenBucket {
    const key = accountId + ':' + action
    let b = this.buckets.get(key)
    if (!b) {
      const cfg = BUCKET_CONFIG[action]
      b = new TokenBucket(cfg.capacity, cfg.perMinute)
      this.buckets.set(key, b)
    }
    return b
  }

  private settings(): SafetySettings {
    return settingsRepo.getSafety()
  }

  /** سقف روزانه‌ی مؤثر، با اعمال ضریب گرم‌کردن برای حساب‌های تازه */
  effectiveDailyCap(accountId: number, action: ActionKind): number {
    const s = this.settings()
    const base =
      action === 'dm' ? s.dailyDmCap
        : action === 'comment_reply' ? s.dailyCommentReplyCap
          : action === 'follow' ? s.dailyFollowCap
            : Number.MAX_SAFE_INTEGER

    if (!s.warmupEnabled || base === Number.MAX_SAFE_INTEGER) return base

    const acc = accountsRepo.byId(accountId)
    if (!acc) return base

    const ageDays = Math.floor((Date.now() - acc.created_at) / 86400000)
    if (ageDays >= s.warmupDays) return base

    // روز اول ۲۰٪ سقف، و تا پایان دوره‌ی گرم‌کردن خطی بالا می‌رود
    const ratio = 0.2 + 0.8 * (ageDays / Math.max(1, s.warmupDays))
    return Math.max(1, Math.floor(base * ratio))
  }

  /** آیا الان داخل ساعات سکوت هستیم؟ و اگر بله تا کی؟ */
  private quietHoursCheck(): GateDecision | null {
    const s = this.settings()
    if (!s.quietHoursEnabled) return null

    const now = new Date()
    const hour = now.getHours()
    const start = s.quietStartHour
    const end = s.quietEndHour

    // بازه می‌تواند از نیمه‌شب بگذرد (مثلا ۱ تا ۸ یا ۲۳ تا ۷)
    const inQuiet = start <= end ? hour >= start && hour < end : hour >= start || hour < end
    if (!inQuiet) return null

    const resume = new Date(now)
    resume.setHours(end, Math.floor(Math.random() * 20), 0, 0)
    if (resume.getTime() <= now.getTime()) resume.setDate(resume.getDate() + 1)

    return {
      allowed: false,
      retryAfterMs: resume.getTime() - now.getTime(),
      reason: 'ساعات سکوت (' + start + ' تا ' + end + ') — ارسال تا ساعت ' + end + ' متوقف است'
    }
  }

  private msUntilTomorrow(): number {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    // کمی بعد از نیمه‌شب، با پراکندگی تصادفی تا همه‌ی کارها هم‌زمان بیدار نشوند
    t.setHours(0, 5 + Math.floor(Math.random() * 30), 0, 0)
    return t.getTime() - Date.now()
  }

  /**
   * بررسی نهایی قبل از انجام یک اکشن. این متد توکن *مصرف نمی‌کند* اگر رد کند.
   */
  check(accountId: number, action: ActionKind): GateDecision {
    if (action === 'read') return ALLOW

    const s = this.settings()

    // ۱. کلید قطع اضطراری
    if (s.killSwitch) {
      return { allowed: false, retryAfterMs: 0, reason: 'کلید قطع اضطراری فعال است' }
    }

    // ۱.۵ دوره‌ی خنک‌شدن پس از اعلام محدودیت از سوی اینستاگرام
    const cd = this.cooldownUntil.get(accountId)
    if (cd && cd > Date.now()) {
      return {
        allowed: false,
        retryAfterMs: cd - Date.now(),
        reason: 'حساب در دوره‌ی خنک‌شدن است (اینستاگرام محدودیت اعلام کرد)'
      }
    }

    // ۲. ساعات سکوت
    const quiet = this.quietHoursCheck()
    if (quiet) return quiet

    // ۳. سقف روزانه
    const cap = this.effectiveDailyCap(accountId, action)
    const used = countersRepo.get(accountId, action)
    if (used >= cap) {
      return {
        allowed: false,
        retryAfterMs: this.msUntilTomorrow(),
        reason: 'سقف روزانه پر شد (' + used + ' از ' + cap + ')'
      }
    }

    // ۴. سطل توکن
    const b = this.bucket(accountId, action)
    if (!b.tryTake(1)) {
      return {
        allowed: false,
        retryAfterMs: Math.max(30000, b.msUntilAvailable(1)),
        reason: 'نرخ لحظه‌ای بالاست — کمی صبر'
      }
    }

    return ALLOW
  }

  /** بعد از انجام موفق یک اکشن صدا زده می‌شود تا در شمارنده‌ی روزانه ثبت شود */
  record(accountId: number, action: ActionKind): void {
    if (action === 'read') return
    countersRepo.inc(accountId, action)
  }

  /**
   * ── نقطه‌ی تصمیم (قابل تنظیم توسط شما) ─────────────────────────────
   *
   * وقتی اینستاگرام سیگنال محدودیت می‌دهد، چقدر عقب بکشیم؟
   *
   * این تابع تنها جایی است که «سیاست ریسک» شما را کد می‌کند. مقدار پیش‌فرضی
   * که گذاشته‌ام محافظه‌کارانه است (رشد تصاعدی، حداکثر ۶ ساعت) چون هزینه‌ی
   * اشتباه نامتقارن است: چند ساعت تأخیر در ارسال، در مقابل محدود شدن حساب.
   *
   * اگر خواستید تندتر یا محتاط‌تر باشد، فقط همین تابع را عوض کنید.
   *  - تندتر:   ضریب را ۲ بگذارید و سقف را ۳۰ دقیقه
   *  - محتاطتر: اولین بازه را ۱ ساعت و سقف را ۲۴ ساعت بگذارید
   */
  onRateLimited(accountId: number, consecutiveHits: number): number {
    const FIRST_BACKOFF_MS = 15 * 60 * 1000 // ۱۵ دقیقه
    const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000 // ۶ ساعت
    const GROWTH = 3 // هر بار سه برابر

    const wait = Math.min(MAX_BACKOFF_MS, FIRST_BACKOFF_MS * Math.pow(GROWTH, Math.max(0, consecutiveHits - 1)))
    // ±۲۰٪ پراکندگی تا چند حساب هم‌زمان با هم بیدار نشوند
    const jittered = Math.round(wait * (0.8 + Math.random() * 0.4))
    this.cooldownUntil.set(accountId, Date.now() + jittered)
    return jittered
  }

  clearCooldown(accountId: number): void {
    this.cooldownUntil.delete(accountId)
  }

  cooldownRemaining(accountId: number): number {
    const cd = this.cooldownUntil.get(accountId)
    return cd && cd > Date.now() ? cd - Date.now() : 0
  }

  /** خلاصه‌ی وضعیت برای نمایش در داشبورد */
  status(accountId: number): {
    killSwitch: boolean
    cooldownMs: number
    quietNow: boolean
    caps: { action: ActionKind; used: number; cap: number; bucketAvailable: number }[]
  } {
    const s = this.settings()
    const actions: ActionKind[] = ['dm', 'comment_reply', 'follow']
    return {
      killSwitch: s.killSwitch,
      cooldownMs: this.cooldownRemaining(accountId),
      quietNow: this.quietHoursCheck() !== null,
      caps: actions.map((a) => ({
        action: a,
        used: countersRepo.get(accountId, a),
        cap: this.effectiveDailyCap(accountId, a),
        bucketAvailable: this.bucket(accountId, a).available
      }))
    }
  }
}

export const safetyGate = new SafetyGate()
