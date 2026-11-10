import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { openDatabase, type DbHandle } from './driver'
import { MIGRATIONS } from './schema'

let db: DbHandle | null = null

/**
 * باز کردن دیتابیس و اجرای مهاجرت‌های انجام‌نشده.
 * از PRAGMA user_version به عنوان شماره‌ی نسخه استفاده می‌کنیم — سبک‌ترین راه
 * برای versioning بدون نیاز به جدول اضافه.
 */
export function initDb(filePath: string): DbHandle {
  if (db) return db

  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  db = openDatabase(filePath)
  // نکته: journal_mode = WAL را عمدا ست نمی‌کنیم. درایور WASM آن را بی‌صدا نادیده
  // می‌گیرد (مقدار روی «delete» می‌ماند) چون VFS اش حافظه‌ی مشترک ندارد. چون اپ
  // تک‌نمونه است و همه‌ی نوشتن‌ها در فرایند main انجام می‌شود، journal پیش‌فرض کافی است.
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  const current = Number(db.pragma('user_version', { simple: true }) ?? 0)
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      try {
        db.exec('BEGIN')
        db.exec(skipExistingColumns(db, m.sql))
        db.exec('COMMIT')
        // user_version داخل تراکنش قابل تغییر نیست، پس بعد از COMMIT
        db.pragma('user_version = ' + m.version)
      } catch (e) {
        try {
          db.exec('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw new Error('مهاجرت نسخه ' + m.version + ' شکست خورد: ' + (e as Error).message)
      }
    }
  }
  return db
}

/**
 * ستون‌هایی که از قبل وجود دارند را از مهاجرت حذف می‌کند.
 *
 * چرا: SQLite برای ADD COLUMN «IF NOT EXISTS» ندارد. اگر مهاجرتی یک بار نیمه‌کاره
 * اجرا شده باشد (مثلا اپ وسط کار بسته شد و user_version ثبت نشد)، اجرای دوباره
 * با «duplicate column» شکست می‌خورد و اپ دیگر باز نمی‌شد.
 */
function skipExistingColumns(handle: DbHandle, sql: string): string {
  return sql.replace(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)[^;]*;/gi, (stmt, table: string, column: string) => {
    const cols = handle.prepare('PRAGMA table_info(' + table + ')').all<{ name: string }>()
    return cols.some((c) => c.name.toLowerCase() === column.toLowerCase()) ? '' : stmt
  })
}

export function getDb(): DbHandle {
  if (!db) throw new Error('دیتابیس هنوز initialize نشده است (initDb صدا زده نشده)')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}

export const now = (): number => Date.now()

export const todayKey = (d = new Date()): string =>
  d.getFullYear() +
  '-' +
  String(d.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(d.getDate()).padStart(2, '0')
