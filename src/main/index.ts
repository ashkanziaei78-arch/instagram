import { BrowserWindow, Menu, Tray, app, dialog, nativeImage, shell } from 'electron'
import { existsSync } from 'node:fs'
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
    title: 'Directino',
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
  // نشان دایرکتینو، درون‌خطی تا نیازی به فایل دارایی نباشد
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAMQklEQVR4nKVXZ1SU17om8eZm3XiVIsM0GAbpdTAqxQQLUYgiKCI2AggEKxZUbCAkiEdRUMkBDRorYHRUGCsH1KCgoIKKihpEkU4UQVHa8O29n7NmBtRkmfPnvGt9a38za3/v87x9by0tLS2txZ61PkGyF1lzbVuy59v9cXKJTXP2KqumnGjL+px4yxrFFsunip3mj3N+HvpQcUhSkf2r5G62Qnor56z0Zs4F6bXsQvPLmddsLmwqG5nn27D4xhCtPpH7+w+AFj7R+k8S9lVtcKBdB4Iseli4RQdbavEGUWbtiB7ahnhpCxKNm/FPo0bsE9chS1SNHGElcvkPUMAvxzV+KcoMSnBP/yoqeQXskcEZVEiOv6yyPr6/2uOMTKUfWnGfqp6/JRAie3Uz2OwNQk0blQvMmshy03qyxqSWxEqfkk2Sx2SH0e9kt/g+OSi6S44KS8lpfjHJN7hCrhhcINcNzpNbPAWp4Mm533mZ3GPeAVpncIC1GWSgWbKnt9Fhz/bybeUD+4l8lMAC++e14aYvscisgUWa1mOtSS1+MH6GzZJK7DR8iHTxPWSIbuOE4AbOCa7iksElFPH+hVLeGdznnUClQRZqDA6gXpCOJuE/2XPxDvZSnMS9FiUSSHagzXZrSWPgIYmaRNxHSCy1a6yLGNqClab1bP3QWsRLnyBRUomfDB9gr6gcWcJS5AivI49/BZcN8lHCP4s7Bifx0OAInhocRIMgHS9EqWg1TMZro814K0lgndIfaZdJDO2WruFgEodu2Q+VzxftNfsoiVXWtfVRJk2IltawjdKn2Cr5HamGD7BPXI4johtQCK/hgrAARfw83OSfwj3+cVTxs1Ar2IdmYRpaxcms3WgL7TD+gXRLowlnuhYwWwNmvhLEYjnjzJdysFgF5fB1159ukWtrwqH1PjGjravrYyX12GhcxZJU4Eb3cUBcjmOiUpwWFuGC8CKKBGdQxj+JCsFRPBEcZHXCdPaH+Cfy2mgb1228kTHpBsB0PWC1Hpx1JOtxWN7AyZa1wGYROJv5jFjP42C/DF1uq9L7CLz3wkbrxw2bDJ8hWfKQ7TaqwEHDO5CLb+KMsBCXBHkoFijYbYGcPRJkkmrBfq5BuIu9EqeAGm0HhiaCmG9gSrs1zd3DVud0ua5Z2e65wbWsrOyzpoBNNsoRCztg/z2oLIRRh2BKnebh9ZQVnv0lqiaQZPGwcbuoCqmG95nG8hs4LSpkF4X5tISv4O4IjtIqUSZeCDPQZbgfryQpaDPd2tJptflcl2PCurceieMex2UM7jeoP8btUze4KoeFcxg2F8QpkBGnAALXACgnBF/WAt57YJdFVX2q8KEq5uRXYSl3il9ILgryUcY/i2qRArVGWag23vO2wSL9SrNtWvxzt3SPuki53l+TWRVXDJ/3mWp9lKgY1OO85BYcw0BGBlA6ahao23TQMT4UE6eiIzTY692Hh60rr/4qrMUx0R2aJ7qNYvFVFBvmcLfNj1U8ssvcVT0qc2atzxHR3/URVafrS6pP+mu9a9SyVDiEgwwPIPSrmWDufmAe3iATPQmmfYveudMy3ik4MqHEOcuqtPSkaXH1v6x+kxfJzkXc8j7lABT8z18t7HtVr0Vem3VLpuwYe73P/RgTp97fNm5VEOzmgcq+I9RVBe4LOmky6NQJIP5jKQLGgAtzb3wt3/vei4B8wPmU85//GTDu0wKtMX8icScuR+fe6NRJ1y1/yCi0ib15dXyij2avJqHq/TY5KB0WtcI2GMR5NmNjpoF+Oxl02niQ2aNBgr9iNMwJLMIF3ZtmfqNWGqdxm9oquZb8fwu0NJb0S01ArrBetve7Gsu0I0+k2xqajLbhjlls5WWXePt+oqq1WC7/v27HJcWwDgcZFkDo1zNAPXzApowHZo0BDXUFXTAcdIk9hxhH9G71Wv6OQB8JzW/g05s+lywfOSqWVUmzzlYL09tbebvRrZ9KX/C3oNR8fWb54cMD3087jfUdIyKTYbUQ1D6Qoy4zwcZNBZvsCTpzNGiIC9iiL8FW2IGss+LwD3PQZNfEfsxP5JAPuOh1xek3u4ux10zOX70tOKms1z+JFr0MvBiSRp/rJrIHvBhS5Biz7l3Gx6mmnAa8dXzMDKoCtwmmdMRssDF+oBMngfq5gwW5gi78EnSVHWi0BchGU4KdxlCmOPysRj8fUsg7ZVF4Lk9QiFL9QnZfNxcPdI+iVu8X8oKfqqzX3YRS3trW3GEx7+Ktyvx+rz2ZnWiutFvUCOsQ0BFzKHPzB/PwApv2DWigG9j84WArbMFiLMA2SUG2GRHsEYIesNUQOGt5be813j1c1snnSrQV3F2dX0mdfiar0Uuh5QPjkMdbVXHRe6eDBlw+4MM+7g8M6HSMyIX19+C+DCDs6+mgEyar487mjAab7wQWaQsWba4GZ8mGoGkCDpk80BMOW9RKLklKqgp1LqFE9yy9p52NKt0juD5oCzn3+Qoo+FG5N9YeUp9w+t394fsbl5WxsAkHlc3m6KjpjI73BvP2UMWdsVAX0GXDQNdZMhovBUsSA2lCkF/0OeTwQXKHz1crKzK+VF86OA/l2gp2f/BBnP4iCoc/D+ZyvwhFvtnCVNWedK15n70D7+vhzz3Xe/bahHOwnwPq6seY+2SQyRNAZ7gBIU4MEY6MrrUB4k0Y3WrIWJoA2MdjyNIFzRH0dpb4OKsV3pDkNpYPPoeHOtns1qAUnBoYhguDw1ihTghuiMLe3p8Ub91fLf19vmFuklGPbEE17IJAnaczMsGX43y9ujBjNGjoKMotd+rGWhvQeDPGbTfrZrvEYPt4oEf0Kc7ogOQPvVsAaMr9tvH5xgfaZ/BQ5yir0c7AE50klOkvRpkgmDwzCsdj2eKU98mnGaNdIxcr4BAK4jRDiW/90TEneHXtvSJdLnw0lKs90wqA/+cS7FqUKSPyTwNf9B42vwW5LugJXSUu66Hnukvsu0ZTITnV+Fj7BB7rZbBa3V9UZYdWQQJqjBayJ8YBqLMJbqv7Lk59mlHHfUxkDGQhICNnEDLWh2LKRHTPm3Lw7eZAfxbhhN51o86/OT53GkkyfdO7y7q8s+C7qdxxk2fI1gHODQK5bNj88u5qw3cEKg2PNz0bnIUavV/YH7w0tPK3okP8I5TSdXhjuoB7axuI5q9Dd6j2tk9dPZGMDOplztNBx3kzOskDdPpYsNCvgKVOYCtswGItgGQzsJ1isD18QM4Hyx4Cckqbw1UeeordotQelWtpkrrKKKupUXs/mvRT2Ut+EtrFG9EtWY9e05WgVhEMsjC8dZnd3LIg2p1zD/odbtNAvvGiqi7H/MeCBqtarCOlK6wp3WAOmmDM6HYRpbsFjB7UZ/SYLqUKnV5c0Ybyqm1+GdCf0JpyrpXub2rR3YWX/G3sjTgBncYb0GsWBWIdASL7Hsw5EHCbQYnnTI56+DA6yZMxX3fQOW6goU6gi2WgUVagsaZg/5ACOw1BdwvADumDyfVAFToUlweDKzS79/JOpFid0HEfHMmaTXc3vuUlqyxnXdINUJqtBrFaAioLB3UJAh3jrxoqjHpPZMR3PGOzRoPNdQWbPwJsqQPYWivQH4eCJkrAdorA0vmgh/SBY0NAT+lRXNQFd8WqtKsq2kgzeT8AV8lr05/qOwUJ6DKOpj2mUYyzWsKILIxR1wBG3f0YneTNiK8Ho7PHMgSNYnTeCEaXOjIaZcvoenNGN0oZTTJkJFXA6F4eoRlDOHpCl1CFLkOuDsglYW/n7YCRKiwU/Hm8q6XbNrkIxvHgTFdSZr0EkH0PuAQA7n6Alxfg/w2g6unhTkCEI7DKFoi2VDUYIFEMlsIHftYHDukCJ3SAPNUzCDg/mMNv2iAFBm2oWKO5mOCD43i/tExLG9dtu7aWs17aSxzDu4lLYA/nPr2H85rcw00f38MFuim5+c69XOQwjltvz5GNVhxJNCPcThNCdhlRbp+IcBkGXUQubuFODy3kLtps7b1iXYASHlAwEFwB7yWeLu0j8DcX1WfLDui0ecXInntEyNq8Fzq0zZlr3zZrlkNbmJ9DW6SvrCNhxpedab4jO9N9R/Ye9HfqPOLn3K7wc27N9Xdtz/NxflPob/O67v0RC8CnymKXBNzkg93kvXrVHCdV//+xq5mqu/3ppvJfiqq+0ZflyjvjQ3pvDDvX1pauuRF9JAT/BtJ15hwqAFsfAAAAAElFTkSuQmCC'
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
