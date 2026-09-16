import { app, safeStorage } from 'electron'
import type { WebOrigin } from '../core/engine/web-engine'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface VaultShape {
  /** توکن‌های API رسمی، به تفکیک شناسه‌ی حساب */
  tokens: Record<string, { value: string; expiresAt: number | null }>
  /** نشست‌های موتور Session (سریال‌شده‌ی instagram-private-api) */
  sessions: Record<string, string>
  /** نشست‌های موتور وب، با کلید `<accountId>:<origin>` */
  webSessions: Record<string, string>
  /** تنظیمات اپ متا */
  metaApp: { appId?: string; appSecret?: string; redirectUri?: string; webhookVerifyToken?: string }
}

const EMPTY: VaultShape = { tokens: {}, sessions: {}, webSessions: {}, metaApp: {} }

/**
 * انبار رمزنگاری‌شده‌ی اعتبارنامه‌ها.
 *
 * چرا safeStorage و نه فایل ساده؟ safeStorage کلید رمزنگاری را از خودِ
 * سیستم‌عامل می‌گیرد (DPAPI در ویندوز، Keychain در مک). یعنی اگر کسی فایل را
 * کپی کند و روی کامپیوتر دیگری ببرد، قابل خواندن نیست — کلید به حساب کاربری
 * ویندوز گره خورده است.
 *
 * چرا توکن‌ها در SQLite نیستند؟ چون فایل دیتابیس ممکن است پشتیبان‌گیری،
 * همگام‌سازی ابری یا اشتراک‌گذاری شود. اعتبارنامه را از داده جدا نگه می‌داریم.
 */
class SecureStore {
  private cache: VaultShape | null = null
  private readonly file: string

  constructor() {
    const dir = join(app.getPath('userData'), 'vault')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'credentials.bin')
  }

  get encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  private read(): VaultShape {
    if (this.cache) return this.cache

    if (!existsSync(this.file)) {
      this.cache = structuredClone(EMPTY)
      return this.cache
    }

    try {
      const buf = readFileSync(this.file)
      const json = this.encryptionAvailable
        ? safeStorage.decryptString(buf)
        : buf.toString('utf8')
      this.cache = { ...structuredClone(EMPTY), ...(JSON.parse(json) as VaultShape) }
    } catch {
      // فایل خراب یا با حساب کاربری دیگری رمز شده — از نو شروع می‌کنیم.
      // بی‌صدا رد نمی‌شویم: کاربر باید بفهمد که باید دوباره وصل شود.
      this.cache = structuredClone(EMPTY)
      this.cache.metaApp = {}
    }
    return this.cache
  }

  private write(): void {
    const json = JSON.stringify(this.cache ?? EMPTY)
    const buf = this.encryptionAvailable
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf8')
    writeFileSync(this.file, buf)
  }

  /* ─────────── توکن API رسمی ─────────── */

  getToken(accountId: number): string | null {
    const t = this.read().tokens[String(accountId)]
    return t ? t.value : null
  }

  getTokenExpiry(accountId: number): number | null {
    return this.read().tokens[String(accountId)]?.expiresAt ?? null
  }

  setToken(accountId: number, value: string, expiresAt: number | null): void {
    const v = this.read()
    v.tokens[String(accountId)] = { value, expiresAt }
    this.write()
  }

  clearToken(accountId: number): void {
    const v = this.read()
    delete v.tokens[String(accountId)]
    this.write()
  }

  /* ─────────── نشست موتور Session ─────────── */

  getSession(accountId: number): string | null {
    return this.read().sessions[String(accountId)] ?? null
  }

  setSession(accountId: number, serialized: string): void {
    const v = this.read()
    v.sessions[String(accountId)] = serialized
    this.write()
  }

  clearSession(accountId: number): void {
    const v = this.read()
    delete v.sessions[String(accountId)]
    this.write()
  }

  /* ─────────── نشست‌های موتور وب (ورود ساده / کد نشست) ─────────── */

  /**
   * هر حساب برای هر مسیر اتصال یک اسلات جدا دارد: کلید `<accountId>:<origin>`.
   *
   * چرا جدا و نه یکی: اگر هر دو مسیر روی یک کلید بنویسند، وصل‌کردن دومی اولی
   * را پاک می‌کند و کاربر هرگز نمی‌تواند هر دو را هم‌زمان داشته باشد. جدا بودن
   * یعنی وقتی یکی باطل شد، موتور بی‌سروصدا سراغ دیگری می‌رود.
   */
  private webKey(accountId: number, origin: WebOrigin): string {
    return accountId + ':' + origin
  }

  getWebSession(accountId: number, origin: WebOrigin): string | null {
    const v = this.read()
    const direct = v.webSessions[this.webKey(accountId, origin)]
    if (direct) return direct

    // مهاجرت نرم: نسخه‌های قبلی با کلید بدون origin ذخیره می‌کردند. آن نشست‌ها
    // فقط از پنجره‌ی ورود می‌آمدند، پس همان اسلات را می‌گیرند.
    if (origin === 'window') return v.webSessions[String(accountId)] ?? null
    return null
  }

  setWebSession(accountId: number, origin: WebOrigin, serialized: string): void {
    const v = this.read()
    v.webSessions[this.webKey(accountId, origin)] = serialized
    if (origin === 'window') delete v.webSessions[String(accountId)]
    this.write()
  }

  /** بدون origin یعنی همه‌ی اسلات‌های این حساب */
  clearWebSession(accountId: number, origin?: WebOrigin): void {
    const v = this.read()
    if (origin) {
      delete v.webSessions[this.webKey(accountId, origin)]
      if (origin === 'window') delete v.webSessions[String(accountId)]
    } else {
      delete v.webSessions[String(accountId)]
      for (const o of ['window', 'sessionid'] as WebOrigin[]) {
        delete v.webSessions[this.webKey(accountId, o)]
      }
    }
    this.write()
  }

  /* ─────────── تنظیمات اپ متا ─────────── */

  getMetaApp(): VaultShape['metaApp'] {
    return { ...this.read().metaApp }
  }

  setMetaApp(cfg: Partial<VaultShape['metaApp']>): void {
    const v = this.read()
    v.metaApp = { ...v.metaApp, ...cfg }
    this.write()
  }

  /** پاک‌کردن کامل — برای وقتی کاربر می‌خواهد همه‌ی اعتبارنامه‌ها حذف شوند */
  wipe(): void {
    this.cache = structuredClone(EMPTY)
    this.write()
  }
}

let store: SecureStore | null = null

export function secureStore(): SecureStore {
  if (!store) store = new SecureStore()
  return store
}
