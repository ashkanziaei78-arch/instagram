/**
 * جواب هوشمند وقتی هیچ قانونی جور نشد (ایده از اینستام و نوین‌هاب).
 *
 * هر مشتری کلید سرویس خودش را می‌گذارد؛ همه از قرارداد OpenAI-compatible
 * پشتیبانی می‌کنند، پس یک کد برای همه کافی است.
 */
export const AI_PROVIDERS: Record<string, { label: string; baseUrl: string; model: string }> = {
  openai: { label: 'ChatGPT (OpenAI)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  grok: { label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1', model: 'grok-4' },
  gemini: { label: 'Gemini (Google)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  custom: { label: 'Custom (OpenAI-compatible)', baseUrl: '', model: '' }
}

export async function aiReply(opts: {
  baseUrl: string
  model: string
  apiKey: string
  businessPrompt: string
  userMessage: string
}): Promise<string | null> {
  const res = await fetch(opts.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + opts.apiKey },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You answer Instagram direct messages for a business. Reply in the customer’s language, briefly (max 3 short sentences), ' +
            'friendly and specific. Only use facts from the business information below; if you do not know, say a team member will answer soon. ' +
            'Never invent prices, stock or policies.\n\nBusiness information:\n' +
            opts.businessPrompt
        },
        { role: 'user', content: opts.userMessage.slice(0, 1000) }
      ]
    })
  })
  if (!res.ok) throw new Error('AI ' + res.status + ': ' + (await res.text()).slice(0, 200))
  const d = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = d.choices?.[0]?.message?.content?.trim()
  return text ? text.slice(0, 1000) : null
}

/**
 * تحلیل کوتاه آمار پنل. فقط عددهای جمع‌شده فرستاده می‌شود — نه متن پیام‌ها و نه
 * اطلاعات مخاطبان — تا داده‌ی مشتری‌ها به سرویس هوش مصنوعی نرود.
 */
export async function aiAnalyze(opts: { baseUrl: string; model: string; apiKey: string; lang: 'fa' | 'en'; facts: string }): Promise<string> {
  const res = await fetch(opts.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + opts.apiKey },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 350,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            (opts.lang === 'fa' ? 'Answer in Persian (Farsi). ' : 'Answer in English. ') +
            'You are an Instagram growth analyst for a small online business using DM automation. ' +
            'Given the aggregated stats, write exactly 3 short bullet points: what went well, what to watch, and one concrete action for this week. ' +
            'Plain language for a non-technical shop owner, no jargon, no made-up numbers, max 25 words per bullet. Use "• " bullets only.'
        },
        { role: 'user', content: opts.facts }
      ]
    })
  })
  if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160))
  const d = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return (d.choices?.[0]?.message?.content ?? '').trim().slice(0, 1500)
}
