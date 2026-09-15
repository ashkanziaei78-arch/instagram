/**
 * نصب دستی باینری Electron.
 *
 * چرا این اسکریپت لازم است؟
 * `npm install` تلاش می‌کند باینری ۱۱۵ مگابایتی Electron را از GitHub Releases
 * دانلود کند. روی خیلی از شبکه‌ها (از جمله همان شبکه‌ای که این پروژه رویش ساخته
 * شد) این دانلود نیمه‌کاره قطع می‌شود و npm بی‌صدا رد می‌شود — بعد اپ با پیام
 * «Electron failed to install correctly» بالا نمی‌آید.
 *
 * این اسکریپت همان دانلود را با تلاش مجدد، نمایش پیشرفت، و چند آدرس جایگزین
 * انجام می‌دهد و در جای درست باز می‌کند.
 *
 * اجرا:  npm run fix:electron
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const ELECTRON_DIR = join(ROOT, 'node_modules', 'electron')
const DIST_DIR = join(ELECTRON_DIR, 'dist')

function log(msg) {
  console.log('[electron] ' + msg)
}

function detectPlatform() {
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : process.arch
  return { platform, arch }
}

function getVersion() {
  const pkgPath = join(ELECTRON_DIR, 'package.json')
  if (!existsSync(pkgPath)) {
    console.error('[electron] پوشه‌ی node_modules/electron وجود ندارد. اول npm install را اجرا کنید.')
    process.exit(1)
  }
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version
}

/** اگر باینری از قبل سالم نصب است، کاری نکن */
function alreadyInstalled() {
  const exe = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app' : 'electron'
  const target = join(DIST_DIR, exe)
  if (!existsSync(target)) return false
  try {
    // فایل باید حجم معقولی داشته باشد؛ دانلود نیمه‌کاره فایل چندکیلوبایتی می‌گذارد
    const size = statSync(target).size
    return process.platform === 'darwin' ? true : size > 1_000_000
  } catch {
    return false
  }
}

function mirrors(version, platform, arch) {
  const file = `electron-v${version}-${platform}-${arch}.zip`
  return [
    `https://github.com/electron/electron/releases/download/v${version}/${file}`,
    `https://npmmirror.com/mirrors/electron/${version}/${file}`,
    `https://cdn.npmmirror.com/binaries/electron/${version}/${file}`
  ]
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error('HTTP ' + res.status)

  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  let lastPrint = 0

  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength
      const now = Date.now()
      if (total > 0 && now - lastPrint > 1000) {
        lastPrint = now
        const pct = Math.round((received / total) * 100)
        process.stdout.write('\r[electron] دانلود: ' + pct + '%  (' + Math.round(received / 1e6) + ' از ' + Math.round(total / 1e6) + ' مگابایت)')
      }
      controller.enqueue(chunk)
    }
  })

  await pipeline(res.body.pipeThrough(progress), createWriteStream(dest))
  process.stdout.write('\n')

  const size = statSync(dest).size
  if (total > 0 && size !== total) {
    throw new Error('دانلود نیمه‌کاره ماند (' + size + ' از ' + total + ' بایت)')
  }
  if (size < 10_000_000) {
    throw new Error('فایل دانلودشده خیلی کوچک است (' + size + ' بایت) — احتمالا صفحه‌ی خطا گرفته‌ایم')
  }
  return size
}

function extract(zipPath) {
  if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true, force: true })
  mkdirSync(DIST_DIR, { recursive: true })

  log('باز کردن آرشیو…')
  if (process.platform === 'win32') {
    // PowerShell روی همه‌ی ویندوزهای پشتیبانی‌شده موجود است
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${DIST_DIR}" -Force`],
      { stdio: 'inherit' }
    )
  } else {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', DIST_DIR], { stdio: 'inherit' })
  }
}

function writePathFile() {
  const exe =
    process.platform === 'win32' ? 'electron.exe'
      : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron'
        : 'electron'
  // بدون خط جدید! Electron محتوای این فایل را عیناً به مسیر اضافه می‌کند و
  // یک \n اضافه باعث خطای ENOENT می‌شود.
  writeFileSync(join(ELECTRON_DIR, 'path.txt'), exe, { encoding: 'utf8' })
  return exe
}

async function main() {
  const version = getVersion()
  const { platform, arch } = detectPlatform()
  log('نسخه ' + version + ' برای ' + platform + '-' + arch)

  if (alreadyInstalled() && !process.argv.includes('--force')) {
    log('باینری از قبل نصب است. برای نصب مجدد --force بدهید.')
    return
  }

  const zipPath = join(tmpdir(), `electron-v${version}-${platform}-${arch}.zip`)
  const urls = mirrors(version, platform, arch)

  let lastError = null
  for (const url of urls) {
    log('تلاش از ' + new URL(url).host)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const size = await download(url, zipPath)
        log('دانلود کامل شد (' + Math.round(size / 1e6) + ' مگابایت)')
        extract(zipPath)
        const exe = writePathFile()
        rmSync(zipPath, { force: true })
        if (!existsSync(join(DIST_DIR, exe.split('/')[0]))) {
          throw new Error('بعد از باز کردن آرشیو، فایل اجرایی پیدا نشد')
        }
        log('✓ نصب شد. حالا npm run dev را اجرا کنید.')
        return
      } catch (e) {
        lastError = e
        log('تلاش ' + attempt + ' ناموفق: ' + e.message)
        rmSync(zipPath, { force: true })
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
      }
    }
  }

  console.error('\n[electron] همه‌ی آدرس‌ها ناموفق بودند. آخرین خطا: ' + lastError?.message)
  console.error('\nراه‌حل دستی:')
  console.error('  ۱. این فایل را با مرورگر یا دانلود‌منیجر بگیرید:')
  console.error('     ' + urls[0])
  console.error('  ۲. محتوایش را در این پوشه باز کنید:')
  console.error('     ' + DIST_DIR)
  console.error('  ۳. یک فایل path.txt در node_modules/electron بسازید که فقط این را داشته باشد (بدون خط جدید):')
  console.error('     ' + (platform === 'win32' ? 'electron.exe' : 'electron'))
  process.exit(1)
}

main().catch((e) => {
  console.error('[electron] خطای غیرمنتظره: ' + e.message)
  process.exit(1)
})
