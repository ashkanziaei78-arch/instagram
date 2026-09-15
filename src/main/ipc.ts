import { BrowserWindow, app, ipcMain, shell } from 'electron'
import {
  accountsRepo,
  broadcastsRepo,
  contactsRepo,
  countersRepo,
  jobsRepo,
  logRepo,
  mediaRepo,
  messagesRepo,
  rulesRepo,
  settingsRepo
} from '../core/db/repos'
import { engines, type IgProfile } from '../core/engine'
import { SessionEngine } from '../core/engine/session-engine'
import { jobQueue } from '../core/queue/job-queue'
import { safetyGate } from '../core/queue/limiter'
import { findMatchingRule } from '../core/rules/matcher'
import { templateVarsFrom } from '../core/rules/runner'
import { buildMessage } from '../core/text'
import {
  pauseBroadcast as pauseBc,
  resolveAudience,
  resumeBroadcast as resumeBc,
  startBroadcast as startBc
} from '../core/automations'
import { pollFollowers, pollMedia, pollerScheduler, syncFollowing } from '../core/pollers'
import { IPC_CHANNELS, type ApiResult, type IpcApi } from '../shared/ipc'
import { connectInstagramAccount, refreshLongLivedToken, TOKEN_REFRESH_THRESHOLD_MS } from './auth/oauth'
import { clearWebLoginSession, loginWithInstagramWindow } from './auth/web-login'
import {
  buildCookiesFromSessionId,
  defaultUserAgent,
  parseSessionId
} from './auth/session-id-login'
import { secureStore } from './secure-store'
import { startWebhookFromSettings, webhookServer } from './webhook-server'

const ok = <T>(data?: T): ApiResult<T> => ({ ok: true, data })
const fail = (error: string, hint?: string): ApiResult<never> => ({ ok: false, error, hint })

/** هر هندلر داخل try/catch می‌رود تا یک خطای پیش‌بینی‌نشده کل UI را قفل نکند */
function wrap(
  fn: (arg: never) => unknown
): (event: unknown, ...args: unknown[]) => Promise<ApiResult<unknown>> {
  return async (_event: unknown, ...args: unknown[]): Promise<ApiResult<unknown>> => {
    try {
      return (await fn(args[0] as never)) as ApiResult<unknown>
    } catch (err) {
      const e = err as Error & { hint?: string }
      logRepo.add({ level: 'error', category: 'ipc', message: e.message })
      return { ok: false, error: e.message, hint: e.hint }
    }
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const handlers: { [K in keyof IpcApi]: (arg: never) => unknown } = {
    /* ═══════════════ حساب‌ها ═══════════════ */

    listAccounts: () => ok(accountsRepo.all()),

    connectGraphAccount: async () => {
      const res = await connectInstagramAccount(getWindow() ?? undefined)
      const account = accountsRepo.upsert({
        ig_user_id: res.igUserId,
        username: res.username,
        name: res.name ?? null,
        profile_picture_url: res.profilePicture ?? null,
        engine: 'graph',
        followers_count: res.followersCount,
        follows_count: res.followsCount,
        media_count: res.mediaCount,
        token_expires_at: res.expiresAt
      })
      secureStore().setToken(account.id, res.accessToken, res.expiresAt)
      engines().graph.registerIgUserId(account.id, res.igUserId)
      accountsRepo.snapshot(account.id, res.followersCount, res.followsCount, res.mediaCount)
      logRepo.add({
        account_id: account.id,
        level: 'success',
        category: 'auth',
        message: 'حساب @' + res.username + ' با API رسمی وصل شد'
      })
      return ok(account)
    },

    /**
     * ورود ساده — مسیر پیش‌فرض برای کاربر عادی.
     *
     * برخلاف مسیر API رسمی، اینجا هیچ تنظیم قبلی لازم نیست: نه اپ متا، نه
     * App Secret، نه Redirect URI. کاربر فقط در پنجره‌ی خود اینستاگرام وارد
     * می‌شود. موتور Session اگر خاموش باشد خودکار روشن می‌شود، چون کاربر با
     * زدن این دکمه و تأیید هشدارِ کنارش، عملاً همین را خواسته است.
     */
    webLogin: async () => {
      let profile: IgProfile | null = null
      let sessionData: { cookies: Record<string, string>; userAgent: string } | null = null

      // تأیید *داخل* حلقه‌ی پنجره انجام می‌شود، نه بعد از بستنش.
      // این‌طور اگر کوکی‌های کهنه‌ای از تلاش قبلی مانده باشند، پنجره بی‌جهت
      // بسته نمی‌شود — کاربر همان‌جا ورودش را ادامه می‌دهد.
      const result = await loginWithInstagramWindow({
        parent: getWindow() ?? undefined,
        verify: async (r) => {
          const data = { cookies: r.cookies as Record<string, string>, userAgent: r.userAgent }
          try {
            profile = await engines().web.verifyAndGetProfile(data)
            sessionData = data
            return true
          } catch (e) {
            logRepo.add({
              level: 'info',
              category: 'auth',
              message: 'نشست هنوز کامل نیست، پنجره باز می‌ماند: ' + (e as Error).message.slice(0, 120)
            })
            return false
          }
        }
      })

      // نباید رخ دهد چون پنجره فقط بعد از تأیید بسته می‌شود، ولی تایپ‌ها را قطعی می‌کنیم
      const finalSession = sessionData ?? {
        cookies: result.cookies as Record<string, string>,
        userAgent: result.userAgent
      }
      const finalProfile: IgProfile = profile ?? (await engines().web.verifyAndGetProfile(finalSession))

      if (!engines().sessionEnabled) {
        engines().setSessionEnabled(true)
        logRepo.add({
          level: 'warn',
          category: 'settings',
          message: 'قابلیت‌های غیررسمی با «ورود ساده» خودکار فعال شدند'
        })
      }

      const account = accountsRepo.upsert({
        ig_user_id: finalProfile.ig_user_id,
        username: finalProfile.username,
        name: finalProfile.name ?? null,
        profile_picture_url: finalProfile.profile_picture_url ?? null,
        engine: 'session',
        followers_count: finalProfile.followers_count ?? 0,
        follows_count: finalProfile.follows_count ?? 0,
        media_count: finalProfile.media_count ?? 0
      })
      engines().web.attach(account.id, finalSession)
      accountsRepo.snapshot(
        account.id,
        finalProfile.followers_count ?? 0,
        finalProfile.follows_count ?? 0,
        finalProfile.media_count ?? 0
      )
      logRepo.add({
        account_id: account.id,
        level: 'success',
        category: 'auth',
        message: 'حساب @' + finalProfile.username + ' با ورود ساده وصل شد'
      })
      return ok(account)
    },

    clearWebLogin: async () => {
      await clearWebLoginSession()
      return ok()
    },

    /**
     * اتصال با کد نشست — مسیری که نه به فیسبوک وابسته است و نه به شبکه‌ی داخل اپ.
     * کاربر در مرورگر خودش (که از قبل وارد است) یک مقدار را کپی می‌کند.
     */
    connectWithSessionId: async (p: { sessionid: string }) => {
      const parsed = parseSessionId(p.sessionid)
      const userAgent = defaultUserAgent()
      const cookies = await buildCookiesFromSessionId(parsed, userAgent)
      const sessionData = { cookies, userAgent }

      const profile = await engines().web.verifyAndGetProfile(sessionData)

      if (!engines().sessionEnabled) {
        engines().setSessionEnabled(true)
      }

      const account = accountsRepo.upsert({
        ig_user_id: profile.ig_user_id,
        username: profile.username,
        name: profile.name ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
        engine: 'session',
        followers_count: profile.followers_count ?? 0,
        follows_count: profile.follows_count ?? 0,
        media_count: profile.media_count ?? 0
      })
      engines().web.attach(account.id, sessionData)
      accountsRepo.snapshot(
        account.id,
        profile.followers_count ?? 0,
        profile.follows_count ?? 0,
        profile.media_count ?? 0
      )
      logRepo.add({
        account_id: account.id,
        level: 'success',
        category: 'auth',
        message: 'حساب @' + profile.username + ' با کد نشست وصل شد'
      })
      return ok(account)
    },

    sessionLogin: async (p: { username: string; password: string }) => {
      if (!engines().sessionEnabled) {
        return fail(
          'موتور Session خاموش است',
          'از تنظیمات > موتور پیشرفته آن را روشن کنید (ریسک‌ها را بخوانید)'
        )
      }
      const res = await engines().session.login(p.username, p.password)
      if (!res.ok) {
        return ok({
          status: res.challenge.kind === 'two_factor' ? ('two_factor' as const) : ('checkpoint' as const),
          message: res.challenge.message
        })
      }
      const account = accountsRepo.upsert({
        ig_user_id: res.profile.ig_user_id,
        username: res.profile.username,
        name: res.profile.name ?? null,
        profile_picture_url: res.profile.profile_picture_url ?? null,
        engine: 'session'
      })
      engines().session.attachSession(account.id, res.serialized, res.profile.ig_user_id)
      logRepo.add({
        account_id: account.id,
        level: 'success',
        category: 'auth',
        message: 'حساب @' + res.profile.username + ' با موتور Session وصل شد'
      })
      return ok({ status: 'connected' as const, message: 'وصل شد', account })
    },

    sessionTwoFactor: async (p: { username: string; code: string }) => {
      const res = await engines().session.submitTwoFactor(p.username, p.code)
      const account = accountsRepo.upsert({
        ig_user_id: res.profile.ig_user_id,
        username: res.profile.username,
        name: res.profile.name ?? null,
        profile_picture_url: res.profile.profile_picture_url ?? null,
        engine: 'session'
      })
      engines().session.attachSession(account.id, res.serialized, res.profile.ig_user_id)
      return ok(account)
    },

    removeAccount: (p: { accountId: number }) => {
      secureStore().clearToken(p.accountId)
      secureStore().clearSession(p.accountId)
      secureStore().clearWebSession(p.accountId)
      engines().session.logout(p.accountId)
      engines().web.detach(p.accountId)
      accountsRepo.remove(p.accountId)
      return ok()
    },

    refreshAccount: async (p: { accountId: number }) => {
      const acc = accountsRepo.byId(p.accountId)
      if (!acc) return fail('حساب پیدا نشد')

      if (acc.engine === 'graph') {
        const token = secureStore().getToken(p.accountId)
        if (!token) return fail('توکنی ذخیره نشده — دوباره وصل شوید')
        const r = await refreshLongLivedToken(token)
        secureStore().setToken(p.accountId, r.token, r.expiresAt)
      }

      const engine = engines().pick(p.accountId, 'read_media')
      const profile = await engine.getProfile(p.accountId)
      const updated = accountsRepo.upsert({
        ig_user_id: profile.ig_user_id,
        username: profile.username,
        name: profile.name ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
        engine: acc.engine,
        followers_count: profile.followers_count ?? 0,
        follows_count: profile.follows_count ?? 0,
        media_count: profile.media_count ?? 0,
        token_expires_at: secureStore().getTokenExpiry(p.accountId)
      })
      accountsRepo.snapshot(
        updated.id,
        profile.followers_count ?? 0,
        profile.follows_count ?? 0,
        profile.media_count ?? 0
      )
      return ok(updated)
    },

    /* ═══════════════ داشبورد ═══════════════ */

    dashboard: (p: { accountId: number }) => {
      const account = accountsRepo.byId(p.accountId) ?? null
      return ok({
        account,
        totals: mediaRepo.totals(p.accountId),
        today: {
          dmSent: messagesRepo.sentToday(p.accountId),
          commentsHandled: countersRepo.get(p.accountId, 'comment_reply')
        },
        counters: countersRepo.todayAll(p.accountId),
        safety: safetyGate.status(p.accountId),
        queue: { pending: jobsRepo.pendingCount(p.accountId), running: jobQueue.isRunning },
        growth: accountsRepo.growth(p.accountId, 30),
        engines: engines().status(p.accountId),
        webhook: webhookServer.stats,
        pollers: pollerScheduler.isRunning
      })
    },

    /* ═══════════════ قوانین ═══════════════ */

    listRules: (p: { accountId: number }) => ok(rulesRepo.byAccount(p.accountId)),

    saveRule: (p: { rule: Parameters<IpcApi['saveRule']>[0]['rule'] }) => {
      const r = p.rule
      if (r.id) {
        const updated = rulesRepo.update(r.id, r)
        if (!updated) return fail('قانون پیدا نشد')
        return ok(updated)
      }
      if (!r.name || !r.trigger_type) return fail('نام و نوع تریگر لازم است')
      return ok(
        rulesRepo.create({
          ...r,
          account_id: r.account_id,
          name: r.name,
          trigger_type: r.trigger_type
        })
      )
    },

    deleteRule: (p: { ruleId: number }) => {
      rulesRepo.remove(p.ruleId)
      return ok()
    },

    toggleRule: (p: { ruleId: number; enabled: boolean }) => {
      const updated = rulesRepo.update(p.ruleId, { enabled: p.enabled })
      return updated ? ok(updated) : fail('قانون پیدا نشد')
    },

    /**
     * تست قانون بدون ارسال چیزی.
     * این قابلیت را عمدا اضافه کردم: بدون آن، تنها راه فهمیدن اینکه قانون
     * کار می‌کند یا نه، ارسال واقعی دایرکت به یک آدم واقعی است.
     */
    testRule: (p: { ruleId: number; text: string }) => {
      const rule = rulesRepo.byId(p.ruleId)
      if (!rule) return fail('قانون پیدا نشد')

      const match = findMatchingRule([rule], p.text, undefined)
      const vars = templateVarsFrom({
        accountId: rule.account_id,
        userIgId: 'test_user',
        username: 'نام_کاربری_نمونه',
        fullName: 'نام نمونه',
        postCaption: 'کپشن نمونه‌ی پست',
        postLink: 'https://instagram.com/p/EXAMPLE',
        rawText: p.text
      })

      return ok({
        matched: !!match,
        reason: match?.reason ?? 'تطبیق نیافت — کلیدواژه‌ها و حالت تطبیق را بررسی کنید',
        preview: rule.actions
          .filter((a) => a.text)
          .map((a) => (a.type === 'send_dm' ? 'دایرکت: ' : 'پاسخ کامنت: ') + buildMessage(a.text!, vars))
      })
    },

    /* ═══════════════ مدیا ═══════════════ */

    listMedia: (p: { accountId: number; limit?: number }) => ok(mediaRepo.list(p.accountId, p.limit ?? 50)),

    syncMedia: async (p: { accountId: number }) => {
      const r = await pollMedia(p.accountId)
      return r.ok ? ok({ total: r.total, newPosts: r.newPosts, message: r.message }) : fail(r.message)
    },

    /* ═══════════════ مخاطبان ═══════════════ */

    listContacts: (p: { accountId: number; audience?: string; limit?: number }) =>
      ok(
        contactsRepo.list(p.accountId, { audience: p.audience, limit: p.limit ?? 300 }).map((c) => ({
          ig_user_id: c.ig_user_id,
          username: c.username,
          full_name: c.full_name,
          profile_pic: c.profile_pic,
          is_follower: c.is_follower,
          is_following: c.is_following,
          tags: c.tags,
          last_inbound_at: c.last_inbound_at,
          welcomed_at: c.welcomed_at
        }))
      ),

    syncFollowers: async (p: { accountId: number }) => {
      const r = await pollFollowers(p.accountId)
      return r.ok
        ? ok({ total: r.total, newCount: r.newCount, welcomed: r.welcomed, message: r.message })
        : fail(r.message, 'برای لیست فالوورها موتور Session لازم است')
    },

    syncFollowing: async (p: { accountId: number }) => {
      const r = await syncFollowing(p.accountId)
      return r.ok ? ok({ total: r.total, message: r.message }) : fail(r.message)
    },

    audienceCount: (p: { accountId: number; filter: Parameters<IpcApi['audienceCount']>[0]['filter'] }) =>
      ok(resolveAudience(p.accountId, p.filter).length),

    /* ═══════════════ برادکست ═══════════════ */

    listBroadcasts: (p: { accountId: number }) => ok(broadcastsRepo.list(p.accountId)),

    createBroadcast: (p: {
      accountId: number
      name: string
      message: string
      filter: Parameters<IpcApi['createBroadcast']>[0]['filter']
    }) =>
      ok(
        broadcastsRepo.create({
          account_id: p.accountId,
          name: p.name,
          message: p.message,
          filter_json: JSON.stringify(p.filter)
        })
      ),

    startBroadcast: (p: { broadcastId: number }) => {
      const r = startBc(p.broadcastId)
      return r.ok ? ok({ total: r.total, message: r.message }) : fail(r.message)
    },

    pauseBroadcast: (p: { broadcastId: number }) => {
      pauseBc(p.broadcastId)
      return ok()
    },

    resumeBroadcast: (p: { broadcastId: number }) => {
      resumeBc(p.broadcastId)
      return ok()
    },

    /* ═══════════════ صف ═══════════════ */

    listJobs: (p: { limit?: number }) => ok(jobsRepo.list(p.limit ?? 100)),

    cancelPendingJobs: () => ok(jobsRepo.cancelPending()),

    /* ═══════════════ لاگ ═══════════════ */

    listLogs: (p: { limit?: number; accountId?: number }) => ok(logRepo.list(p.limit ?? 200, p.accountId)),

    clearLogs: () => {
      logRepo.prune(0)
      return ok()
    },

    /* ═══════════════ تنظیمات ═══════════════ */

    getSafety: () => ok(settingsRepo.getSafety()),

    setSafety: (p: { settings: Partial<ReturnType<typeof settingsRepo.getSafety>> }) =>
      ok(settingsRepo.setSafety(p.settings)),

    getMetaApp: () => {
      const cfg = secureStore().getMetaApp()
      // App Secret را کامل برنمی‌گردانیم؛ فقط نشان می‌دهیم که تنظیم شده
      return ok({
        appId: cfg.appId,
        appSecret: cfg.appSecret ? '••••••••' + cfg.appSecret.slice(-4) : undefined,
        redirectUri: cfg.redirectUri,
        webhookVerifyToken: cfg.webhookVerifyToken
      })
    },

    setMetaApp: (p: { config: { appId?: string; appSecret?: string; redirectUri?: string; webhookVerifyToken?: string } }) => {
      const cfg = { ...p.config }
      // اگر کاربر مقدار ماسک‌شده را دست نزده، مقدار واقعی را بازنویسی نکن
      if (cfg.appSecret?.startsWith('••••')) delete cfg.appSecret
      secureStore().setMetaApp(cfg)
      return ok()
    },

    getSessionEngineEnabled: () =>
      ok({ enabled: engines().sessionEnabled, libraryAvailable: SessionEngine.isAvailable() }),

    setSessionEngineEnabled: (p: { enabled: boolean }) => {
      engines().setSessionEnabled(p.enabled)
      logRepo.add({
        level: p.enabled ? 'warn' : 'info',
        category: 'settings',
        message: p.enabled
          ? 'موتور Session روشن شد — قابلیت‌های غیررسمی فعال شدند'
          : 'موتور Session خاموش شد'
      })
      return ok()
    },

    /* ═══════════════ سیستم ═══════════════ */

    startWebhook: async (p: { port: number }) => {
      const r = await startWebhookFromSettings(p.port)
      return r.ok ? ok({ message: r.message }) : fail(r.message)
    },

    stopWebhook: () => {
      webhookServer.stop()
      return ok()
    },

    setPollers: (p: { enabled: boolean }) => {
      if (p.enabled) pollerScheduler.start()
      else pollerScheduler.stop()
      return ok()
    },

    setKillSwitch: (p: { enabled: boolean }) => {
      settingsRepo.setSafety({ killSwitch: p.enabled })
      if (p.enabled) {
        const cancelled = jobsRepo.cancelPending()
        logRepo.add({
          level: 'warn',
          category: 'safety',
          message: 'کلید قطع اضطراری فعال شد — ' + cancelled + ' کار در انتظار لغو شد'
        })
      } else {
        logRepo.add({ level: 'info', category: 'safety', message: 'کلید قطع اضطراری خاموش شد' })
      }
      return ok()
    },

    openExternal: async (p: { url: string }) => {
      // فقط http/https — جلوگیری از اجرای پروتکل‌های خطرناک مثل file: یا اسکیم‌های سیستمی
      if (!/^https?:\/\//i.test(p.url)) return fail('فقط آدرس‌های http/https مجاز است')
      await shell.openExternal(p.url)
      return ok()
    },

    appInfo: () =>
      ok({
        version: app.getVersion(),
        userData: app.getPath('userData'),
        encryptionAvailable: secureStore().encryptionAvailable
      })
  }

  for (const channel of IPC_CHANNELS) {
    ipcMain.handle(channel, wrap(handlers[channel]))
  }
}

/**
 * بررسی روزانه‌ی انقضای توکن.
 * توکن بلندمدت ۶۰ روزه است ولی اگر منقضی شود، کاربر باید کل OAuth را از نو
 * طی کند. پس وقتی کمتر از ۱۰ روز مانده، خودکار تازه‌اش می‌کنیم.
 */
export async function refreshExpiringTokens(): Promise<void> {
  for (const acc of accountsRepo.all()) {
    if (acc.engine !== 'graph') continue
    const expiry = secureStore().getTokenExpiry(acc.id)
    if (!expiry) continue
    if (expiry - Date.now() > TOKEN_REFRESH_THRESHOLD_MS) continue

    try {
      const token = secureStore().getToken(acc.id)
      if (!token) continue
      const r = await refreshLongLivedToken(token)
      secureStore().setToken(acc.id, r.token, r.expiresAt)
      logRepo.add({
        account_id: acc.id,
        level: 'success',
        category: 'auth',
        message: 'توکن @' + acc.username + ' تازه شد (تا ' + new Date(r.expiresAt).toLocaleDateString('fa-IR') + ')'
      })
    } catch (e) {
      accountsRepo.setStatus(acc.id, 'expired', (e as Error).message)
      logRepo.add({
        account_id: acc.id,
        level: 'error',
        category: 'auth',
        message: 'تازه‌سازی توکن @' + acc.username + ' ناموفق بود — باید دوباره وصل شوید'
      })
    }
  }
}
