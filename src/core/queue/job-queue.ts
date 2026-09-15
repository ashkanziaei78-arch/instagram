import type { Job } from '../../shared/types'
import { jobsRepo, logRepo } from '../db/repos'
import { RateLimitError, AuthError, UnsupportedCapabilityError } from '../engine/types'
import { safetyGate, type ActionKind } from './limiter'

export interface JobContext {
  job: Job
  payload: Record<string, unknown>
}

export interface JobHandler {
  /** نوع اکشن برای اعمال محدودیت‌ها. اگر undefined باشد از نگهبان رد نمی‌شود. */
  action?: ActionKind
  run(ctx: JobContext): Promise<void>
}

/**
 * صف کار پایدار.
 *
 * چرا صف؟ سه دلیل که هر کدام به‌تنهایی کافی است:
 *  ۱. محدودیت نرخ — نمی‌توان ۲۰۰ دایرکت را پشت‌سرهم فرستاد، باید پخش شود.
 *  ۲. مقاومت در برابر خرابی — اگر اپ بسته شود، کارها در SQLite می‌مانند.
 *  ۳. تأخیر انسانی — واکنش فوری به کامنت، خودش نشانه‌ی ربات است.
 */
export class JobQueue {
  private handlers = new Map<string, JobHandler>()
  private timer: NodeJS.Timeout | null = null
  private running = false
  private busy = false
  /** شمارش خطاهای محدودیت پشت‌سرهم به ازای هر حساب، برای backoff تصاعدی */
  private consecutiveRateLimits = new Map<number, number>()

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler)
  }

  start(tickMs = 5000): void {
    if (this.running) return
    this.running = true

    // کارهایی که هنگام بسته‌شدن ناگهانی در حالت running مانده‌اند را آزاد کن
    const recovered = jobsRepo.recoverStuck()
    if (recovered > 0) {
      logRepo.add({
        level: 'warn',
        category: 'queue',
        message: recovered + ' کار نیمه‌کاره از اجرای قبلی بازیابی شد'
      })
    }

    this.timer = setInterval(() => {
      void this.tick()
    }, tickMs)
    logRepo.add({ level: 'info', category: 'queue', message: 'صف کار راه افتاد' })
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * یک دور اجرا. عمدا هر بار فقط *یک* کار را پردازش می‌کنیم:
   * موازی‌سازی در اتوماسیون اینستاگرام دشمن است، نه دوست — الگوی ترافیک
   * انسانی ترتیبی است، نه انبوه.
   */
  private async tick(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const jobs = jobsRepo.claimReady(1)
      for (const job of jobs) {
        await this.execute(job)
      }
    } catch (e) {
      logRepo.add({
        level: 'error',
        category: 'queue',
        message: 'خطای غیرمنتظره در حلقه‌ی صف: ' + (e as Error).message
      })
    } finally {
      this.busy = false
    }
  }

  private async execute(job: Job): Promise<void> {
    const handler = this.handlers.get(job.kind)
    if (!handler) {
      jobsRepo.finish(job.id, 'failed', 'هندلری برای نوع «' + job.kind + '» ثبت نشده است')
      return
    }

    // نگهبان ایمنی: اگر اجازه نداد، کار را به آینده موکول کن (تلاش حساب نمی‌شود)
    if (handler.action) {
      const gate = safetyGate.check(job.account_id, handler.action)
      if (!gate.allowed) {
        if (gate.retryAfterMs === 0) {
          jobsRepo.finish(job.id, 'skipped', gate.reason)
          logRepo.add({
            account_id: job.account_id,
            level: 'warn',
            category: 'queue',
            message: 'کار لغو شد: ' + gate.reason
          })
        } else {
          // تأخیر است نه شکست، پس سهمیه‌ی تلاش‌ها نباید بسوزد
          jobsRepo.defer(job.id, gate.retryAfterMs, gate.reason)
        }
        return
      }
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(job.payload) as Record<string, unknown>
    } catch {
      payload = {}
    }

    try {
      await handler.run({ job, payload })
      jobsRepo.finish(job.id, 'done')
      if (handler.action) safetyGate.record(job.account_id, handler.action)
      this.consecutiveRateLimits.delete(job.account_id)
      safetyGate.clearCooldown(job.account_id)
    } catch (e) {
      this.handleFailure(job, e as Error)
    }
  }

  private handleFailure(job: Job, err: Error): void {
    // خطای دسترسی: تلاش دوباره بی‌فایده است تا کاربر توکن را تازه کند
    if (err instanceof AuthError) {
      jobsRepo.finish(job.id, 'failed', err.message)
      logRepo.add({
        account_id: job.account_id,
        level: 'error',
        category: 'auth',
        message: 'دسترسی منقضی شد: ' + err.message
      })
      return
    }

    // قابلیت پشتیبانی‌نشده: هرگز با تلاش دوباره درست نمی‌شود
    if (err instanceof UnsupportedCapabilityError) {
      jobsRepo.finish(job.id, 'failed', err.message)
      logRepo.add({
        account_id: job.account_id,
        level: 'error',
        category: 'engine',
        message: err.message
      })
      return
    }

    // محدودیت نرخ: حساب را خنک کن و کار را عقب بینداز
    if (err instanceof RateLimitError) {
      const hits = (this.consecutiveRateLimits.get(job.account_id) ?? 0) + 1
      this.consecutiveRateLimits.set(job.account_id, hits)
      const wait = safetyGate.onRateLimited(job.account_id, hits)
      jobsRepo.retry(job.id, wait, err.message)
      logRepo.add({
        account_id: job.account_id,
        level: 'warn',
        category: 'ratelimit',
        message:
          'اینستاگرام محدودیت اعلام کرد (بار ' + hits + '). ' +
          Math.round(wait / 60000) + ' دقیقه صبر می‌کنیم.',
        meta: { error: err.message }
      })
      return
    }

    // خطاهای معمولی: backoff تصاعدی تا سقف تلاش‌ها
    const attempts = job.attempts + 1
    if (attempts >= job.max_attempts) {
      jobsRepo.finish(job.id, 'failed', err.message)
      logRepo.add({
        account_id: job.account_id,
        level: 'error',
        category: 'queue',
        message: 'کار «' + job.kind + '» بعد از ' + attempts + ' تلاش شکست خورد: ' + err.message
      })
      return
    }

    const backoff = Math.min(30 * 60000, 60000 * Math.pow(2, attempts - 1))
    const jittered = Math.round(backoff * (0.8 + Math.random() * 0.4))
    jobsRepo.retry(job.id, jittered, err.message)
    logRepo.add({
      account_id: job.account_id,
      level: 'warn',
      category: 'queue',
      message:
        'کار «' + job.kind + '» شکست خورد، تلاش ' + attempts + ' از ' + job.max_attempts +
        ' — ' + Math.round(jittered / 1000) + ' ثانیه بعد دوباره',
      meta: { error: err.message }
    })
  }
}

export const jobQueue = new JobQueue()
