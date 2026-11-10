import { BrowserWindow, Menu, Tray, app, dialog, nativeImage, shell } from 'electron'
import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { closeDb, initDb } from '../core/db/index'
import { accountsRepo, logRepo, settingsRepo } from '../core/db/repos'
import { engines, initEngines } from '../core/engine'
import { registerJobHandlers } from '../core/automations'
import { jobQueue } from '../core/queue/job-queue'
import { pollerScheduler } from '../core/pollers'
import { PUSH_EVENTS } from '../shared/ipc'
import { refreshExpiringTokens, registerIpc } from './ipc'
import { secureStore } from './secure-store'
import { setAiKeyProvider } from '../core/ai/reply'
import { startWebhookFromSettings, webhookServer } from './webhook-server'
import { checkLicense } from './license'
import { setAutomationAllowed } from './automation-gate'

/**
 * اسم اپ از «IG Auto Suite» به «Directino» عوض شد و Electron پوشه‌ی داده را از
 * روی اسم می‌سازد. اگر پوشه‌ی قدیمی هست، همان را نگه می‌داریم تا حساب‌ها،
 * قانون‌ها و توکن‌های کاربر بعد از به‌روزرسانی سر جایشان باشند.
 */
const legacyUserData = join(app.getPath('appData'), 'IG Auto Suite')
if (existsSync(legacyUserData)) app.setPath('userData', legacyUserData)

/**
 * گزارش راه‌اندازی در یک فایل متنی ساده. وقتی اپ روی کامپیوتر کاربر باز
 * نمی‌شود، دیتابیس و پنجره در دسترس نیستند؛ این فایل تنها راه فهمیدن این است
 * که راه‌اندازی تا کجا رسید.
 */
function step(msg: string): void {
  try {
    appendFileSync(join(app.getPath('userData'), 'startup.log'), new Date().toISOString() + '  ' + msg + '\n')
  } catch {
    /* نوشتن گزارش هم نباید اپ را بخواباند */
  }
}
process.on('uncaughtException', (e) => step('uncaughtException: ' + (e?.stack ?? String(e))))
process.on('unhandledRejection', (e) => step('unhandledRejection: ' + String((e as Error)?.stack ?? e)))

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
/** پنجره‌ی اول ساخته شده؛ قبل از آن IPC آماده نیست و پنجره‌ی دوم نباید ساخته شود */
let booted = false

/**
 * قفل تک‌نمونه.
 *
 * چرا حیاتی است: دو نمونه‌ی اپ یعنی دو صف کار روی یک دیتابیس، یعنی هر دایرکت
 * دو بار ارسال می‌شود. علاوه بر آن، درایور SQLite ما با یک نویسنده طراحی شده.
 * پس نمونه‌ی دوم اجازه‌ی اجرا نمی‌گیرد و فقط پنجره‌ی نمونه‌ی اول را جلو می‌آورد.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // اگر پنجره به هر دلیل ساخته نشده بود، همین حالا بساز؛ وگرنه دوبار کلیک روی
    // آیکن هیچ اثری نداشت و اپ «باز نمی‌شد»
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (booted) mainWindow = createWindow()
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f17',
    title: 'Directino',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    step('window ready-to-show')
    win.show()
  })
  // اگر صفحه به هر دلیل (مثلا مشکل کارت گرافیک) هرگز ready-to-show نداد، پنجره
  // نامرئی می‌ماند؛ بعد از چند ثانیه به‌هرحال نشانش بده
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      step('window not shown after 6s — forcing show')
      win.show()
    }
  }, 6000)
  win.webContents.on('render-process-gone', (_e, d) => step('renderer gone: ' + d.reason + ' code=' + d.exitCode))
  win.webContents.on('did-fail-load', (_e, code, desc) => step('page failed to load: ' + code + ' ' + desc))

  // لینک‌های خارجی در مرورگر سیستم باز شوند، نه داخل اپ
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // بستن پنجره اپ را نمی‌بندد؛ به سینی سیستم می‌رود تا اتوماسیون‌ها بچرخند
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createTray(): void {
  // نشان دایرکتینو، درون‌خطی تا نیازی به فایل دارایی نباشد
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,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'
  )
  tray = new Tray(icon)
  tray.setToolTip('Directino')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'نمایش پنجره', click: () => mainWindow?.show() },
      { type: 'separator' },
      {
        label: 'توقف اضطراری همه‌ی اتوماسیون‌ها',
        click: () => {
          settingsRepo.setSafety({ killSwitch: true })
          logRepo.add({
            level: 'warn',
            category: 'safety',
            message: 'کلید قطع اضطراری از سینی سیستم فعال شد'
          })
          mainWindow?.webContents.send(PUSH_EVENTS.activity)
        }
      },
      { type: 'separator' },
      {
        label: 'خروج کامل',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => mainWindow?.show())
}

/** false یعنی دیتابیس باز نشد و اپ باید بسته شود */
async function bootstrap(): Promise<boolean> {
  const dbPath = join(app.getPath('userData'), 'data', 'igsuite.sqlite')

  try {
    step('opening database ' + dbPath)
    initDb(dbPath)
    step('database open')
  } catch (e) {
    step('database error: ' + (e as Error).message)
    dialog.showErrorBox(
      'خطا در باز کردن دیتابیس',
      'مسیر: ' + dbPath + '\n\n' + (e as Error).message +
        '\n\nاگر اپ قبلا ناگهانی بسته شده، دوباره اجرا کنید؛ قفل کهنه خودکار پاک می‌شود.'
    )
    return false
  }

  // موتورها به انبار رمزنگاری‌شده وصل می‌شوند
  initEngines({
    tokenProvider: (accountId) => secureStore().getToken(accountId),
    sessionStore: {
      load: (accountId) => secureStore().getSession(accountId),
      save: (accountId, s) => secureStore().setSession(accountId, s),
      clear: (accountId) => secureStore().clearSession(accountId)
    },
    webSessionStore: {
      load: (accountId, origin) => secureStore().getWebSession(accountId, origin),
      save: (accountId, origin, s) => secureStore().setWebSession(accountId, origin, s),
      clear: (accountId, origin) => secureStore().clearWebSession(accountId, origin)
    }
  })

  if (!secureStore().encryptionAvailable) {
    logRepo.add({
      level: 'warn',
      category: 'security',
      message:
        'رمزنگاری سیستم‌عامل در دسترس نیست — اعتبارنامه‌ها بدون رمز ذخیره می‌شوند. ' +
        'روی ویندوز معمولا یعنی اپ در محیطی بدون دسترسی DPAPI اجرا شده.'
    })
  }

  step('engines ready')
  registerJobHandlers()

  setAiKeyProvider((provider) => secureStore().getAiKey(provider))

  // نسخه‌های قبلی یک حساب را که با دو روش وصل می‌شد دو ردیف جدا ثبت می‌کردند
  // (هر روش شناسه‌ی متفاوتی برمی‌گرداند). اینجا یکی‌شان می‌کنیم: ردیفی که API
  // رسمی دارد اصلی می‌ماند و اعتبارنامه‌های دیگری به آن منتقل می‌شود.
  for (const group of accountsRepo.duplicateGroups()) {
    const target = group.find((a) => secureStore().getToken(a.id)) ?? group[0]
    for (const other of group) {
      if (other.id === target.id) continue
      secureStore().moveAccount(other.id, target.id)
      accountsRepo.mergeInto(target, other)
      logRepo.add({
        account_id: target.id,
        level: 'info',
        category: 'auth',
        message: 'دو ردیف تکراری @' + target.username + ' یکی شدند'
      })
    }
  }

  // شناسه‌ی اینستاگرام حساب‌های موجود را در موتور رسمی ثبت کن تا مسیر
  // /{ig-user-id}/messages بعد از ری‌استارت هم کار کند
  for (const acc of accountsRepo.all()) {
    if (acc.engine === 'graph') {
      engines().graph.registerIgUserId(acc.id, acc.ig_user_id)
    }
  }

  return true
}

/**
 * کارهایی که ممکن است منتظر شبکه بمانند. عمدا *بعد* از ساختن پنجره و جدا از
 * آن اجرا می‌شوند: قبلا اگر یکی از این‌ها گیر می‌کرد (مثلا شبکه بدون VPN)، اپ
 * در Task Manager بود ولی هیچ پنجره و آیکنی نمی‌ساخت.
 */
async function startBackground(): Promise<void> {
  // صف و نظرسنجی فقط با اشتراک فعال؛ نسخه‌ی شخصی (بدون آدرس سایت) همیشه فعال است
  const license = await checkLicense()
  setAutomationAllowed(license.active)
  setInterval(async () => {
    const l = await checkLicense()
    setAutomationAllowed(l.active)
    mainWindow?.webContents.send(PUSH_EVENTS.license)
  }, 6 * 60 * 60 * 1000)

  if (settingsRepo.get<boolean>('webhookEnabled', false)) {
    const port = settingsRepo.get<number>('webhookPort', 8787)
    const r = await Promise.race([
      startWebhookFromSettings(port),
      new Promise<{ ok: boolean; message: string }>((res) => setTimeout(() => res({ ok: false, message: 'timeout' }), 10_000))
    ])
    step('webhook: ' + r.message)
  }

  // تازه‌سازی توکن: یک بار در شروع و بعد روزانه
  void refreshExpiringTokens()
  setInterval(() => void refreshExpiringTokens(), 24 * 60 * 60 * 1000)

  // نگه‌داری لاگ‌ها تا بی‌نهایت بزرگ نشوند
  setInterval(() => logRepo.prune(45), 6 * 60 * 60 * 1000)

  logRepo.add({ level: 'info', category: 'app', message: 'اپ راه‌اندازی شد' })
  step('background tasks started')
}

app.whenReady().then(async () => {
  step('---- start v' + app.getVersion() + ' userData=' + app.getPath('userData'))
  let ok: boolean
  try {
    ok = await bootstrap()
    step('core ready: ' + ok)
  } catch (e) {
    step('core error: ' + ((e as Error).stack ?? e))
    // خطای راه‌اندازی (مثلا پورت وبهوک گرفته شده) نباید اپ را بی‌پنجره و
    // نامرئی در پس‌زمینه نگه دارد؛ پنجره باز می‌شود و خطا در گزارش می‌ماند
    ok = true
    logRepo.add({ level: 'error', category: 'app', message: 'بخشی از راه‌اندازی خطا داد: ' + (e as Error).message })
  }
  if (!ok) {
    // exit و نه quit: پروسه‌ی نیمه‌جان قفل تک‌نمونه را نگه می‌داشت و اجرای بعدی
    // بی‌صدا بسته می‌شد
    quitting = true
    app.exit(1)
    return
  }
  registerIpc(() => mainWindow)
  mainWindow = createWindow()
  booted = true
  step('window created')
  try {
    createTray()
    step('tray created')
  } catch (e) {
    step('tray error: ' + (e as Error).message)
  }
  void startBackground().catch((e) => step('background error: ' + ((e as Error).stack ?? e)))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  try {
    jobQueue.stop()
    pollerScheduler.stop()
    webhookServer.stop()
  } catch {
    /* بستن نباید خطای «A JavaScript error occurred» بدهد */
  }
  try {
    logRepo.add({ level: 'info', category: 'app', message: 'اپ بسته شد' })
  } catch {
    /* دیتابیس ممکن است قبلا بسته شده باشد */
  }
  closeDb()
})

// روی ویندوز و لینوکس، بستن همه‌ی پنجره‌ها اپ را نمی‌بندد (به سینی می‌رود)
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})
