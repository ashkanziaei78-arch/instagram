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

/**
 * سرویس‌دهنده‌ها. همه به‌جز Claude یک API مشترک به سبک OpenAI دارند
 * (POST {base}/chat/completions)، پس یک پیاده‌سازی همه را پوشش می‌دهد —
 * از جمله سرویس‌های واسط ایرانی که همین قالب را دارند (گزینه‌ی «دیگر»).
 *
 * نام مدل‌ها پیش‌فرض‌اند و قابل تغییر: سرویس‌دهنده‌ها مدل‌ها را مرتب عوض
 * می‌کنند و نام دقیق در پنل خودشان است.
 */
export const AI_PROVIDERS = {
  claude: { label: 'Claude (انتروپیک)', baseUrl: '', model: 'claude-opus-5-5' },
  grok: { label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1', model: 'grok-4' },
  openai: { label: 'ChatGPT (OpenAI)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: {
    label: 'Gemini (گوگل)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash'
  },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openrouter: { label: 'OpenRouter (همه‌ی مدل‌ها)', baseUrl: 'https://openrouter.ai/api/v1', model: 'x-ai/grok-4' },
  custom: { label: 'سرویس دیگر / واسط ایرانی', baseUrl: '', model: '' }
} as const

export type AiProvider = keyof typeof AI_PROVIDERS

export interface AiSettings {
  enabled: boolean
  provider: AiProvider
  /** خالی = پیش‌فرض همان سرویس‌دهنده */
  model: string
  /** توضیح کسب‌وکار: چه می‌فروشی، قیمت‌ها، لینک‌ها، ساعت کاری */
  businessInfo: string
  /**
   * آدرس واسط اختیاری. از ایران api.anthropic.com مستقیم در دسترس نیست؛ کاربر
   * می‌تواند آدرس یک رله‌ی سازگار با API انتروپیک را بدهد. خالی = آدرس اصلی.
   */
  baseUrl: string
}

const DEFAULTS: AiSettings = { enabled: false, provider: 'claude', model: '', businessInfo: '', baseUrl: '' }

export function getAiSettings(): AiSettings {
  return { ...DEFAULTS, ...settingsRepo.get<Partial<AiSettings>>('aiReply', {}) }
}

export function setAiSettings(patch: Partial<AiSettings>): AiSettings {
  const next = { ...getAiSettings(), ...patch }
  settingsRepo.set('aiReply', next)
  return next
}

/** کلید هر سرویس‌دهنده جدا نگه داشته می‌شود تا با عوض کردن، کلید قبلی گم نشود */
let keyProvider: (p: AiProvider) => string | null = () => null
export function setAiKeyProvider(fn: (p: AiProvider) => string | null): void {
  keyProvider = fn
}

export function aiReady(): boolean {
  const s = getAiSettings()
  return s.enabled && !!keyProvider(s.provider) && !!s.businessInfo.trim()
}

function resolvedModel(s: AiSettings): string {
  return s.model.trim() || AI_PROVIDERS[s.provider].model
}

function resolvedBaseUrl(s: AiSettings): string {
  return s.baseUrl.trim() || AI_PROVIDERS[s.provider].baseUrl
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
  const s = getAiSettings()
  const apiKey = keyProvider(s.provider)
  if (!apiKey) throw new Error('کلید ' + AI_PROVIDERS[s.provider].label + ' وارد نشده')

  const userText = (username ? 'پیام از @' + username + ':\n' : '') + incoming
  const businessBlock = 'اطلاعات کسب‌وکار:\n' + s.businessInfo.trim()

  if (s.provider !== 'claude') return openAiCompatible(s, apiKey, businessBlock, userText)

  const client = new Anthropic({ apiKey, baseURL: s.baseUrl.trim() || undefined, timeout: 60_000 })

  const response = await client.beta.messages.create({
    model: resolvedModel(s),
    max_tokens: 2000,
    // جواب دایرکت کوتاه و ساده است؛ تلاش کم یعنی سریع‌تر و ارزان‌تر
    output_config: { effort: 'low' },
    // اگر مدل اصلی به دلیل ایمنی امتناع کرد، سرور خودش مدل جایگزین را امتحان می‌کند
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: businessBlock }
    ],
    messages: [{ role: 'user', content: userText }]
  })

  if (response.stop_reason === 'refusal') return null

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return text || null
}

/**
 * Grok، ChatGPT، Gemini، DeepSeek، OpenRouter و واسط‌های سازگار — همه با یک
 * درخواست chat/completions. خطای سرویس‌دهنده با متن خودش برمی‌گردد تا معلوم
 * باشد مشکل کلید است، نام مدل یا اعتبار حساب.
 */
async function openAiCompatible(
  s: AiSettings,
  apiKey: string,
  businessBlock: string,
  userText: string
): Promise<string | null> {
  const base = resolvedBaseUrl(s).replace(/\/+$/, '')
  if (!base) throw new Error('آدرس سرویس وارد نشده')
  const model = resolvedModel(s)
  if (!model) throw new Error('نام مدل وارد نشده')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60_000)
  let res: Response
  try {
    res = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYSTEM + '\n\n' + businessBlock },
          { role: 'user', content: userText }
        ]
      })
    })
  } catch (e) {
    throw new Error('به ' + base + ' وصل نشد: ' + (e as Error).message)
  } finally {
    clearTimeout(timer)
  }

  const raw = await res.text()
  if (!res.ok) {
    let msg = raw.slice(0, 200)
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } | string }
      msg = typeof j.error === 'string' ? j.error : j.error?.message ?? msg
    } catch {
      /* متن خام */
    }
    throw new Error('سرویس جواب نداد (' + res.status + '): ' + msg)
  }
  const d = JSON.parse(raw) as { choices?: { message?: { content?: string }; finish_reason?: string }[] }
  const text = d.choices?.[0]?.message?.content?.trim()
  return text || null
}
