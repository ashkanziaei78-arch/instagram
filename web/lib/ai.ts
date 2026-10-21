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
