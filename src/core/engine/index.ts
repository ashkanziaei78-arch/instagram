import type { Capability, EngineKind, EngineStatus } from '../../shared/types'
import { contactsRepo, settingsRepo } from '../db/repos'
import { GraphEngine, type TokenProvider } from './graph-engine'
import { SessionEngine, type SessionStore } from './session-engine'
import { UnsupportedCapabilityError, type IEngine } from './types'

export interface EngineManagerOptions {
  tokenProvider: TokenProvider
  sessionStore: SessionStore
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

  constructor(opts: EngineManagerOptions) {
    this.graph = new GraphEngine(opts.tokenProvider)
    this.session = new SessionEngine(opts.sessionStore)
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

    if (this.session.can(cap)) {
      if (!this.sessionEnabled) {
        throw new UnsupportedCapabilityError(
          cap,
          'graph',
          'این قابلیت در API رسمی وجود ندارد و موتور Session خاموش است. از تنظیمات > موتور پیشرفته روشنش کنید (ریسک‌ها را بخوانید).'
        )
      }
      if (!this.session.isConnected(accountId)) {
        throw new UnsupportedCapabilityError(
          cap,
          'session',
          'موتور Session روشن است ولی این حساب با آن وصل نشده. از صفحه‌ی حساب‌ها با نام کاربری و رمز وصل شوید.'
        )
      }
      return this.session
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

  /** وضعیت هر دو موتور برای نمایش در UI */
  status(accountId: number): EngineStatus[] {
    const graphConnected = this.graph.isConnected(accountId)
    const sessionAvailable = SessionEngine.isAvailable()
    const sessionConnected = this.sessionEnabled && this.session.isConnected(accountId)

    return [
      {
        kind: 'graph',
        connected: graphConnected,
        capabilities: this.graph.capabilities,
        detail: graphConnected
          ? 'وصل است — کامنت به دایرکت و آنالیتیکس کامل کار می‌کند'
          : 'وصل نیست — از صفحه‌ی حساب‌ها با اینستاگرام وارد شوید'
      },
      {
        kind: 'session',
        connected: sessionConnected,
        capabilities: this.session.capabilities,
        detail: !sessionAvailable
          ? 'کتابخانه‌ی instagram-private-api نصب نیست'
          : !this.sessionEnabled
            ? 'خاموش است (پیش‌فرض) — برای لیست فالوور و دایرکت انبوه لازم است'
            : sessionConnected
              ? 'وصل است — لیست فالوور، فالوور جدید و دایرکت انبوه فعال'
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
export type { SessionStore, LoginChallenge } from './session-engine'
export type { TokenProvider } from './graph-engine'
