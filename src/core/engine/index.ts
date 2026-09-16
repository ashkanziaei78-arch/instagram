import type { Capability, EngineKind, EngineStatus } from '../../shared/types'
import { contactsRepo, settingsRepo } from '../db/repos'
import { GraphEngine, type TokenProvider } from './graph-engine'
import { SessionEngine, type SessionStore } from './session-engine'
import { WebEngine, type WebSessionStore } from './web-engine'
import { UnsupportedCapabilityError, type IEngine } from './types'

export interface EngineManagerOptions {
  tokenProvider: TokenProvider
  sessionStore: SessionStore
  webSessionStore: WebSessionStore
}

/**
 * مدیر موتورها: تصمیم می‌گیرد هر کار با کدام موتور انجام شود.
 *
 * قاعده‌ی کلی: **موتور رسمی اولویت دارد.** فقط وقتی کاری از توان موتور رسمی
 * بیرون است به موتور Session می‌رویم. چرا؟ چون هزینه‌ی خطا نامتقارن است —
 * موتور رسمی نهایتا خطا می‌دهد، موتور Session می‌تواند حساب را محدود کند.
 */
export class EngineManager {
  readonly graph: GraphEngine
  readonly session: SessionEngine
  readonly web: WebEngine

  constructor(opts: EngineManagerOptions) {
    this.graph = new GraphEngine(opts.tokenProvider)
    this.session = new SessionEngine(opts.sessionStore)
    this.web = new WebEngine(opts.webSessionStore)
  }

  /**
   * موتورهای غیررسمی به ترتیب ترجیح.
   *
   * چرا موتور وب اول است: مسیر نام‌کاربری/رمز به کتابخانه‌ی
   * instagram-private-api تکیه دارد که نسخه‌ی اپ موبایلِ منقضی اعلام می‌کند و
   * اینستاگرام با «Your version of Instagram is out of date» ردش می‌کند.
   * موتور وب همان درخواست‌های مرورگر را می‌زند و چنین چکی ندارد.
   */
  private unofficialEngines(): IEngine[] {
    return [this.web, this.session]
  }

  /** آیا کاربر موتور Session را آگاهانه روشن کرده؟ پیش‌فرض: خیر */
  get sessionEnabled(): boolean {
    return settingsRepo.get<boolean>('sessionEngineEnabled', false)
  }

  setSessionEnabled(v: boolean): void {
    settingsRepo.set('sessionEngineEnabled', v)
  }

  /**
   * موتوری که می‌تواند این قابلیت را برای این حساب انجام دهد.
   * اگر هیچ‌کدام نتوانند، خطایی با توضیح *دقیق چرا* می‌دهد — کاربر باید بفهمد
   * مشکل نبود قابلیت است، نه باگ.
   */
  pick(accountId: number, cap: Capability): IEngine {
    if (this.graph.can(cap) && this.graph.isConnected(accountId)) return this.graph

    const candidates = this.unofficialEngines().filter((e) => e.can(cap))
    if (candidates.length > 0) {
      if (!this.sessionEnabled) {
        throw new UnsupportedCapabilityError(
          cap,
          'graph',
          'این قابلیت در API رسمی وجود ندارد. در صفحه‌ی حساب‌ها دکمه‌ی «اتصال حساب» را بزنید و «ورود ساده» یا «کد نشست» را وصل کنید.'
        )
      }
      const connected = candidates.find((e) => e.isConnected(accountId))
      if (!connected) {
        throw new UnsupportedCapabilityError(
          cap,
          'session',
          'این حساب با روش ساده وصل نشده. در صفحه‌ی حساب‌ها «اتصال حساب» را باز کنید و «ورود ساده» یا «کد نشست» را وصل کنید.'
        )
      }
      return connected
    }

    if (this.graph.can(cap)) {
      throw new UnsupportedCapabilityError(
        cap,
        'graph',
        'حساب با API رسمی وصل نیست یا توکنش منقضی شده — دوباره وصل شوید.'
      )
    }

    throw new UnsupportedCapabilityError(cap, 'graph', 'هیچ موتوری این قابلیت را پشتیبانی نمی‌کند.')
  }

  /** نسخه‌ی بی‌خطا برای UI: فقط می‌گوید می‌شود یا نه */
  canDo(accountId: number, cap: Capability): boolean {
    try {
      this.pick(accountId, cap)
      return true
    } catch {
      return false
    }
  }

  /**
   * ارسال هوشمند دایرکت — مهم‌ترین تصمیم اجرایی اپ.
   *
   * سه مسیر، به ترتیب اولویت:
   *  ۱. اگر پاسخ به کامنت است → private reply رسمی.
   *     بهترین حالت: قانونی، بدون نیاز به پنجره‌ی ۲۴ ساعته، تا ۷ روز مهلت.
   *  ۲. اگر کاربر در ۲۴ ساعت گذشته پیام داده → دایرکت رسمی.
   *  ۳. در غیر این صورت (دایرکت سرد) → فقط موتور Session.
   *
   * اگر هیچ مسیری باز نبود، خطا دقیقا می‌گوید کدام شرط برقرار نیست.
   */
  async sendDmSmart(
    accountId: number,
    recipientIgId: string,
    text: string,
    opts: { commentId?: string; buttons?: { title: string; url: string }[] } = {}
  ): Promise<{ via: EngineKind; method: 'private_reply' | 'dm' }> {
    // مسیر ۱: پاسخ خصوصی به کامنت
    if (opts.commentId && this.graph.isConnected(accountId)) {
      await this.graph.replyToCommentPrivate(accountId, opts.commentId, text, { buttons: opts.buttons })
      return { via: 'graph', method: 'private_reply' }
    }

    // مسیر ۲: پنجره‌ی ۲۴ ساعته باز است
    if (this.graph.isConnected(accountId) && contactsRepo.isWindowOpen(accountId, recipientIgId)) {
      await this.graph.sendDm(accountId, recipientIgId, text, { buttons: opts.buttons })
      return { via: 'graph', method: 'dm' }
    }

    // مسیر ۳: دایرکت سرد
    const engine = this.pick(accountId, 'send_dm_cold')
    await engine.sendDm(accountId, recipientIgId, text, { buttons: opts.buttons })
    return { via: engine.kind, method: 'dm' }
  }

  /** وضعیت موتورها برای نمایش در UI */
  status(accountId: number): EngineStatus[] {
    const graphConnected = this.graph.isConnected(accountId)
    const webConnected = this.web.isConnected(accountId)
    const sessionConnected = this.session.isConnected(accountId)
    const simpleConnected = this.sessionEnabled && (webConnected || sessionConnected)

    return [
      {
        kind: 'graph',
        connected: graphConnected,
        capabilities: this.graph.capabilities,
        detail: graphConnected
          ? 'وصل است — کامنت به دایرکت و آمار دقیق (ویو، ریچ، سیو) کار می‌کند'
          : 'وصل نیست — برای آمار دقیق و پاسخ خصوصی به کامنت لازم است'
      },
      {
        kind: 'session',
        connected: simpleConnected,
        capabilities: this.web.capabilities,
        detail: !this.sessionEnabled
          ? 'وصل نیست — از «اتصال حساب» روش «ورود ساده» یا «کد نشست» را وصل کنید'
          : simpleConnected
            ? (webConnected ? 'وصل است (ورود ساده)' : 'وصل است (نام کاربری و رمز)') +
              ' — لیست فالوور، فالوور جدید و دایرکت انبوه فعال'
            : 'روشن است ولی این حساب وارد نشده'
      }
    ]
  }
}

let manager: EngineManager | null = null

export function initEngines(opts: EngineManagerOptions): EngineManager {
  manager = new EngineManager(opts)
  return manager
}

export function engines(): EngineManager {
  if (!manager) throw new Error('موتورها هنوز initialize نشده‌اند (initEngines صدا زده نشده)')
  return manager
}

export * from './types'
export { GraphEngine } from './graph-engine'
export { SessionEngine } from './session-engine'
export { WebEngine } from './web-engine'
export type { WebSessionStore, WebSessionData, WebOrigin } from './web-engine'
export type { SessionStore, LoginChallenge } from './session-engine'
export type { TokenProvider } from './graph-engine'
