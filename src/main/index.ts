import { BrowserWindow, Menu, Tray, app, dialog, nativeImage, shell } from 'electron'
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
import { startWebhookFromSettings, webhookServer } from './webhook-server'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
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
    title: 'IG Auto Suite',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

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
  // آیکن ساده‌ی درون‌خطی تا نیازی به فایل دارایی نباشد
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVR42mNgYGD4z4AH/GcgAxCjABPjAxOjAxPjAxPjAxPjAxPjAxPjAxPjAxPjAxPjAxPjAxMDAwMAKZ4K0RFF2rEAAAAASUVORK5CYII='
  )
  tray = new Tray(icon)
  tray.setToolTip('IG Auto Suite')
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

async function bootstrap(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'data', 'igsuite.sqlite')

  try {
    initDb(dbPath)
  } catch (e) {
    dialog.showErrorBox(
      'خطا در باز کردن دیتابیس',
      'مسیر: ' + dbPath + '\n\n' + (e as Error).message +
        '\n\nاگر اپ قبلا ناگهانی بسته شده، دوباره اجرا کنید؛ قفل کهنه خودکار پاک می‌شود.'
    )
    app.quit()
    return
  }

  // موتورها به انبار رمزنگاری‌شده وصل می‌شوند
  initEngines({
    tokenProvider: (accountId) => secureStore().getToken(accountId),
    sessionStore: {
      load: (accountId) => secureStore().getSession(accountId),
      save: (accountId, s) => secureStore().setSession(accountId, s),
      clear: (accountId) => secureStore().clearSession(accountId)
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

  registerJobHandlers()
  jobQueue.start(5000)

  // شناسه‌ی اینستاگرام حساب‌های موجود را در موتور رسمی ثبت کن تا مسیر
  // /{ig-user-id}/messages بعد از ری‌استارت هم کار کند
  for (const acc of accountsRepo.all()) {
    if (acc.engine === 'graph') {
      engines().graph.registerIgUserId(acc.id, acc.ig_user_id)
    }
  }

  // نظرسنجی و وبهوک اگر کاربر قبلا روشنشان کرده بود
  if (settingsRepo.get<boolean>('pollersEnabled', true)) {
    pollerScheduler.start()
  }
  if (settingsRepo.get<boolean>('webhookEnabled', false)) {
    const port = settingsRepo.get<number>('webhookPort', 8787)
    await startWebhookFromSettings(port)
  }

  // تازه‌سازی توکن: یک بار در شروع و بعد روزانه
  void refreshExpiringTokens()
  setInterval(() => void refreshExpiringTokens(), 24 * 60 * 60 * 1000)

  // نگه‌داری لاگ‌ها تا بی‌نهایت بزرگ نشوند
  setInterval(() => logRepo.prune(45), 6 * 60 * 60 * 1000)

  logRepo.add({ level: 'info', category: 'app', message: 'اپ راه‌اندازی شد' })
}

app.whenReady().then(async () => {
  await bootstrap()
  registerIpc(() => mainWindow)
  mainWindow = createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  jobQueue.stop()
  pollerScheduler.stop()
  webhookServer.stop()
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
