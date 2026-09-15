import express, { type Request, type Response } from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Server } from 'node:http'
import { accountsRepo, logRepo } from '../core/db/repos'
import { handleIncomingComment, handleIncomingDm } from '../core/automations'
import { secureStore } from './secure-store'

/**
 * سرور وبهوک متا.
 *
 * وبهوک مسیر *فوری* است: لحظه‌ای که کسی کامنت می‌گذارد، متا به این آدرس
 * می‌زند و ما در همان ثانیه واکنش می‌دهیم. بدون آن، اپ به نظرسنجی دوره‌ای
 * تکیه می‌کند که تا چند دقیقه تأخیر دارد.
 *
 * برای اینکه متا بتواند به کامپیوتر شما برسد، به یک آدرس عمومی HTTPS نیاز
 * دارید. ساده‌ترین راه، یک تونل است:
 *     cloudflared tunnel --url http://localhost:8787
 * سپس آدرس https که می‌دهد را در داشبورد متا به‌عنوان Callback URL بگذارید.
 * (راهنمای کامل در docs/SETUP-META-APP.md)
 */

export interface WebhookOptions {
  port: number
  /** رشته‌ای که خودتان انتخاب می‌کنید و در داشبورد متا هم همان را می‌گذارید */
  verifyToken: string
  /** App Secret برای بررسی امضای X-Hub-Signature-256 */
  appSecret?: string
}

interface MetaWebhookBody {
  object?: string
  entry?: {
    id?: string
    time?: number
    changes?: { field?: string; value?: Record<string, unknown> }[]
    messaging?: {
      sender?: { id?: string }
      recipient?: { id?: string }
      timestamp?: number
      message?: { mid?: string; text?: string; is_echo?: boolean }
    }[]
  }[]
}

export class WebhookServer {
  private server: Server | null = null
  private opts: WebhookOptions | null = null
  private received = 0
  private lastEventAt: number | null = null

  get isRunning(): boolean {
    return this.server !== null
  }

  get stats(): { running: boolean; port: number | null; received: number; lastEventAt: number | null } {
    return {
      running: this.isRunning,
      port: this.opts?.port ?? null,
      received: this.received,
      lastEventAt: this.lastEventAt
    }
  }

  /**
   * بررسی امضای متا.
   *
   * چرا حتما لازم است: آدرس وبهوک شما عمومی است. بدون بررسی امضا، هر کسی
   * می‌تواند رویداد جعلی بفرستد و اپ شما را وادار به ارسال دایرکت کند.
   * از timingSafeEqual استفاده می‌کنیم تا مقایسه در برابر حملات زمانی مقاوم باشد.
   */
  private verifySignature(req: Request, raw: Buffer): boolean {
    const secret = this.opts?.appSecret
    if (!secret) return true // اگر App Secret تنظیم نشده، بررسی نمی‌کنیم (با هشدار در UI)

    const header = req.get('x-hub-signature-256')
    if (!header) return false

    const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')
    const a = Buffer.from(header)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  async start(opts: WebhookOptions): Promise<{ ok: boolean; message: string }> {
    if (this.server) return { ok: true, message: 'سرور وبهوک از قبل روشن است' }
    this.opts = opts

    const app = express()
    // بدنه‌ی خام لازم است چون امضا روی بایت‌های اصلی محاسبه می‌شود، نه JSON تجزیه‌شده
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          ;(req as Request & { rawBody?: Buffer }).rawBody = buf
        }
      })
    )

    // دست‌دادن تأیید متا
    app.get('/webhook', (req: Request, res: Response) => {
      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']

      if (mode === 'subscribe' && token === opts.verifyToken) {
        logRepo.add({ level: 'success', category: 'webhook', message: 'متا آدرس وبهوک را تأیید کرد' })
        res.status(200).send(String(challenge ?? ''))
        return
      }
      logRepo.add({
        level: 'warn',
        category: 'webhook',
        message: 'تأیید وبهوک ناموفق بود — verify token یکی نیست'
      })
      res.sendStatus(403)
    })

    app.post('/webhook', (req: Request, res: Response) => {
      const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('')
      if (!this.verifySignature(req, raw)) {
        logRepo.add({
          level: 'error',
          category: 'webhook',
          message: 'رویداد با امضای نامعتبر رد شد — ممکن است تلاش برای جعل باشد'
        })
        res.sendStatus(401)
        return
      }

      // *فوری* پاسخ ۲۰۰ بده. متا فقط چند ثانیه صبر می‌کند و اگر دیر شود
      // رویداد را دوباره می‌فرستد — که یعنی پردازش تکراری.
      res.sendStatus(200)

      this.received++
      this.lastEventAt = Date.now()
      void this.process(req.body as MetaWebhookBody)
    })

    app.get('/health', (_req, res) => {
      res.json({ ok: true, ...this.stats })
    })

    return new Promise((resolve) => {
      const server = app.listen(opts.port, '0.0.0.0', () => {
        this.server = server
        logRepo.add({
          level: 'info',
          category: 'webhook',
          message: 'سرور وبهوک روی پورت ' + opts.port + ' گوش می‌دهد'
        })
        resolve({ ok: true, message: 'روی پورت ' + opts.port + ' گوش می‌دهد' })
      })

      server.on('error', (e: NodeJS.ErrnoException) => {
        this.server = null
        const msg =
          e.code === 'EADDRINUSE'
            ? 'پورت ' + opts.port + ' اشغال است — پورت دیگری انتخاب کنید'
            : e.message
        logRepo.add({ level: 'error', category: 'webhook', message: 'سرور وبهوک بالا نیامد: ' + msg })
        resolve({ ok: false, message: msg })
      })
    })
  }

  stop(): void {
    this.server?.close()
    this.server = null
    logRepo.add({ level: 'info', category: 'webhook', message: 'سرور وبهوک خاموش شد' })
  }

  /**
   * تجزیه‌ی رویدادها. ساختار متا تودرتو است:
   *   entry[] → changes[] (کامنت) یا messaging[] (پیام)
   * هر entry.id شناسه‌ی اینستاگرام حسابی است که رویداد برایش رخ داده.
   */
  private async process(body: MetaWebhookBody): Promise<void> {
    try {
      for (const entry of body.entry ?? []) {
        const igId = entry.id ?? ''
        const account = igId ? accountsRepo.byIgId(igId) : accountsRepo.all()[0]
        if (!account) {
          logRepo.add({
            level: 'warn',
            category: 'webhook',
            message: 'رویداد برای حساب ناشناس ' + igId + ' رسید و نادیده گرفته شد'
          })
          continue
        }

        /* ── کامنت‌ها ── */
        for (const change of entry.changes ?? []) {
          if (change.field !== 'comments') continue
          const v = change.value ?? {}
          const from = v.from as { id?: string; username?: string } | undefined
          const media = v.media as { id?: string } | undefined
          const commentId = String(v.id ?? '')
          if (!commentId) continue

          const result = await handleIncomingComment({
            accountId: account.id,
            commentId,
            mediaId: String(media?.id ?? ''),
            text: String(v.text ?? ''),
            fromUserId: String(from?.id ?? ''),
            fromUsername: from?.username
          })

          if (!result.handled) {
            logRepo.add({
              account_id: account.id,
              level: 'info',
              category: 'webhook',
              message: 'کامنت پردازش نشد: ' + result.reason
            })
          }
        }

        /* ── پیام‌های دایرکت ── */
        for (const m of entry.messaging ?? []) {
          // is_echo یعنی پیامی که *خودمان* فرستادیم؛ پردازشش حلقه می‌سازد
          if (m.message?.is_echo) continue
          const senderId = String(m.sender?.id ?? '')
          const text = m.message?.text
          if (!senderId || !text) continue

          await handleIncomingDm({
            accountId: account.id,
            fromUserId: senderId,
            text,
            messageId: m.message?.mid
          })
        }
      }
    } catch (e) {
      logRepo.add({
        level: 'error',
        category: 'webhook',
        message: 'پردازش رویداد وبهوک خطا داد: ' + (e as Error).message
      })
    }
  }
}

export const webhookServer = new WebhookServer()

/** راه‌اندازی از تنظیمات ذخیره‌شده */
export async function startWebhookFromSettings(port = 8787): Promise<{ ok: boolean; message: string }> {
  const cfg = secureStore().getMetaApp()
  if (!cfg.webhookVerifyToken) {
    return { ok: false, message: 'ابتدا در تنظیمات یک Verify Token برای وبهوک تعیین کنید' }
  }
  return webhookServer.start({
    port,
    verifyToken: cfg.webhookVerifyToken,
    appSecret: cfg.appSecret
  })
}
