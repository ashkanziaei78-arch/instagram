import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * اعتبارنامه‌ی اپ متا از یک فایل محلی، نه از مخزن.
 *
 * چرا فایل جدا و نه مقدار ثابت در کد: App Secret در گیت‌هاب اسکن می‌شود و
 * متا معمولا secretی را که عمومی شده باطل می‌کند. `.env.local` در .gitignore
 * است، پس مقدار روی کامپیوتر شما می‌ماند ولی موقع بیلد داخل فایل اجرایی
 * جاسازی می‌شود — نتیجه برای کاربر نهایی یکی است: هیچ تنظیمی نمی‌بیند.
 *
 * ترتیب اولویت: متغیر محیطی (برای CI) → `.env.local` → خالی (کاربر خودش در
 * تنظیمات وارد می‌کند).
 */
function loadEnvFile(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of ['.env.local', '.env']) {
    const file = resolve(__dirname, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!m) continue
      // اولین فایل برنده است، پس .env.local بر .env می‌چربد
      if (out[m[1]] === undefined) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return out
}

const fileEnv = loadEnvFile()
const cred = (key: string): string => process.env[key] ?? fileEnv[key] ?? ''

/**
 * این مقادیر در زمان بیلد *جایگزین متن* می‌شوند. بدون این، در نسخه‌ی بسته‌بندی‌شده
 * `process.env.IG_APP_ID` خالی است چون هیچ‌کس آن متغیر را روی دستگاه کاربر ست نکرده.
 */
const bundledCredentials = {
  'process.env.IG_APP_ID': JSON.stringify(cred('IG_APP_ID')),
  'process.env.IG_APP_SECRET': JSON.stringify(cred('IG_APP_SECRET')),
  'process.env.IG_REDIRECT_URI': JSON.stringify(cred('IG_REDIRECT_URI'))
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: bundledCredentials,
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } }
    },
    resolve: {
      alias: { '@core': resolve(__dirname, 'src/core'), '@shared': resolve(__dirname, 'src/shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } }
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()]
  }
})
