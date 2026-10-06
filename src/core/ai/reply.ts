import Anthropic from '@anthropic-ai/sdk'
import { settingsRepo } from '../db/repos'

/**
 * جواب هوشمند — ایده از InstaAuto.
 *
 * وقتی دایرکتی می‌رسد که هیچ قانونی برایش نیست، به‌جای سکوت یک جواب کوتاه و
 * مرتبط ساخته می‌شود بر اساس توضیحی که خود کاربر درباره‌ی کسب‌وکارش نوشته.
 *
 * کلید API در انبار رمزنگاری‌شده‌ی main است، نه در دیتابیس؛ main آن را از راه
 * setAiKeyProvider در اختیار این ماژول می‌گذارد تا core به Electron وابسته نشود.
 */

export interface AiSettings {
  enabled: boolean
  /** توضیح کسب‌وکار: چه می‌فروشی، قیمت‌ها، لینک‌ها، ساعت کاری */
  businessInfo: string
  /**
   * آدرس واسط اختیاری. از ایران api.anthropic.com مستقیم در دسترس نیست؛ کاربر
   * می‌تواند آدرس یک رله‌ی سازگار با API انتروپیک را بدهد. خالی = آدرس اصلی.
   */
  baseUrl: string
}

const DEFAULTS: AiSettings = { enabled: false, businessInfo: '', baseUrl: '' }

export function getAiSettings(): AiSettings {
  return { ...DEFAULTS, ...settingsRepo.get<Partial<AiSettings>>('aiReply', {}) }
}

export function setAiSettings(patch: Partial<AiSettings>): AiSettings {
  const next = { ...getAiSettings(), ...patch }
  settingsRepo.set('aiReply', next)
  return next
}

let keyProvider: () => string | null = () => null
export function setAiKeyProvider(fn: () => string | null): void {
  keyProvider = fn
}

export function aiReady(): boolean {
  const s = getAiSettings()
  return s.enabled && !!keyProvider() && !!s.businessInfo.trim()
}

const SYSTEM = `تو دستیار دایرکت اینستاگرامِ یک کسب‌وکار هستی و از طرف صاحب حساب جواب می‌دهی.

قواعد:
- به زبان خود پیام‌دهنده جواب بده (اگر فارسی نوشت، فارسی محاوره‌ای و گرم).
- کوتاه: یک تا سه جمله، مثل یک آدم واقعی در دایرکت. بدون تیتر و فهرست.
- فقط از «اطلاعات کسب‌وکار» استفاده کن. قیمت، لینک، موجودی یا قولی که آنجا نیست را از خودت نساز.
- اگر جواب را در اطلاعات نداری، صادقانه بگو صاحب حساب خودش به‌زودی جواب می‌دهد.
- فقط متن جواب را بنویس، بدون توضیح اضافه.`

/**
 * یک جواب کوتاه می‌سازد. null یعنی «جوابی نفرست» — مثلا وقتی مدل به دلیل
 * ایمنی امتناع کرده است.
 */
export async function generateReply(incoming: string, username?: string): Promise<string | null> {
  const apiKey = keyProvider()
  const s = getAiSettings()
  if (!apiKey) throw new Error('کلید جواب هوشمند وارد نشده')

  const client = new Anthropic({ apiKey, baseURL: s.baseUrl.trim() || undefined, timeout: 60_000 })

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    // جواب دایرکت کوتاه و ساده است؛ تلاش کم یعنی سریع‌تر و ارزان‌تر
    output_config: { effort: 'low' },
    // اگر مدل اصلی به دلیل ایمنی امتناع کرد، سرور خودش مدل جایگزین را امتحان می‌کند
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: 'اطلاعات کسب‌وکار:\n' + s.businessInfo.trim() }
    ],
    messages: [
      {
        role: 'user',
        content: (username ? 'پیام از @' + username + ':\n' : '') + incoming
      }
    ]
  })

  if (response.stop_reason === 'refusal') return null

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return text || null
}
