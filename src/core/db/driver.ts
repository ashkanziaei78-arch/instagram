/**
 * آداپتور دیتابیس.
 *
 * چرا این فایل وجود دارد؟
 * ابتدا از better-sqlite3 استفاده می‌کردیم، اما آن یک ماژول بومی (native) است و روی
 * ویندوزِ بدون Visual Studio Build Tools — یا با دسترسی محدود به اینترنت برای دانلود
 * هدرهای Node — کامپایل نمی‌شود. node-sqlite3-wasm همان SQLite است که به WebAssembly
 * کامپایل شده: صفر کامپایل بومی، نصب فقط از npm، اجرا روی هر ویندوز/مک/لینوکس.
 *
 * هزینه‌اش: API کمی متفاوت است. این فایل آن تفاوت را می‌پوشاند و سطحی
 * سازگار با better-sqlite3 می‌سازد تا بقیه‌ی کد (repos.ts) دست‌نخورده بماند.
 * اگر روزی خواستید به better-sqlite3 برگردید، فقط همین فایل عوض می‌شود.
 */
import { Database as WasmDatabase } from 'node-sqlite3-wasm'
import type { Statement as WasmStatement } from 'node-sqlite3-wasm'
import { existsSync, rmSync, statSync } from 'node:fs'

type Primitive = string | number | bigint | boolean | Uint8Array | null | undefined

export interface RunInfo {
  changes: number
  lastInsertRowid: number | bigint
}

export interface PreparedStatement {
  get<T = unknown>(...params: Primitive[] | [Record<string, Primitive>]): T | undefined
  all<T = unknown>(...params: Primitive[] | [Record<string, Primitive>]): T[]
  run(...params: Primitive[] | [Record<string, Primitive>]): RunInfo
}

export interface DbHandle {
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  pragma(statement: string, opts?: { simple?: boolean }): unknown
  transaction<T>(fn: () => T): () => T
  close(): void
  readonly raw: WasmDatabase
}

/**
 * تبدیل آرگومان‌های سبک better-sqlite3 به شکلی که node-sqlite3-wasm می‌فهمد.
 *
 * better-sqlite3 هر دو حالت را می‌پذیرد:
 *   stmt.run(1, 'a')            → پارامترهای موقعیتی ?
 *   stmt.run({ id: 1 })         → پارامترهای نام‌دار @id
 *
 * node-sqlite3-wasm آرایه یا آبجکت می‌خواهد، و کلیدهای نام‌دار باید پیشوند داشته باشند.
 */
function normalizeParams(
  params: Primitive[] | [Record<string, Primitive>]
): Primitive[] | Record<string, Primitive> | undefined {
  if (params.length === 0) return undefined

  const first = params[0]
  const isNamedObject =
    params.length === 1 &&
    first !== null &&
    typeof first === 'object' &&
    !(first instanceof Uint8Array)

  if (isNamedObject) {
    const out: Record<string, Primitive> = {}
    for (const [k, v] of Object.entries(first as Record<string, Primitive>)) {
      // SQL ما از سبک @name استفاده می‌کند؛ اگر پیشوند نبود اضافه می‌کنیم
      const key = k.startsWith('@') || k.startsWith(':') || k.startsWith('$') ? k : '@' + k
      out[key] = v === undefined ? null : v
    }
    return out
  }

  return (params as Primitive[]).map((p) => (p === undefined ? null : p))
}

/**
 * node-sqlite3-wasm برای قفل‌گذاری یک *دایرکتوری* به نام «<db>.lock» می‌سازد
 * (mkdir اتمیک است، پس mutex ارزانی می‌شود). این دایرکتوری هنگام نوشتن ساخته و
 * بعدش پاک می‌شود — اما اگر پروسه وسط نوشتن بمیرد (کرش، قطع برق، Task Manager)
 * باقی می‌ماند و از آن به بعد هر نوشتنی با «database is locked» شکست می‌خورد.
 *
 * چون اپ ما با app.requestSingleInstanceLock() فقط یک نمونه اجرا می‌کند، هر قفلی
 * که هنگام راه‌اندازی وجود داشته باشد قطعا کهنه است و پاک‌کردنش بی‌خطر است.
 */
function clearStaleLock(filePath: string): boolean {
  const lockPath = filePath + '.lock'
  try {
    if (existsSync(lockPath) && statSync(lockPath).isDirectory()) {
      rmSync(lockPath, { recursive: true, force: true })
      return true
    }
  } catch {
    /* اگر پاک نشد، بگذار خطای اصلی SQLite خودش را نشان دهد */
  }
  return false
}

export function openDatabase(filePath: string): DbHandle & { staleLockCleared: boolean } {
  const staleLockCleared = clearStaleLock(filePath)
  const raw = new WasmDatabase(filePath)

  // کش کردن statement های آماده‌شده: هم سریع‌تر است، هم جلوی نشتی حافظه‌ی WASM
  // را می‌گیرد (چون هر prepare بدون finalize یک شیء در حافظه‌ی WASM باقی می‌گذارد).
  const cache = new Map<string, WasmStatement>()

  function stmtFor(sql: string): WasmStatement {
    let s = cache.get(sql)
    if (!s || s.isFinalized) {
      s = raw.prepare(sql)
      cache.set(sql, s)
    }
    return s
  }

  let txDepth = 0

  return {
    raw,
    staleLockCleared,

    prepare(sql: string): PreparedStatement {
      /**
       * چرا این wrapper لازم است؟
       * وقتی یک statement کش‌شده خطا می‌دهد (مثلا UNIQUE constraint)، در سطح
       * SQLite در وضعیت خطا «گیر» می‌کند و استفاده‌ی بعدی از همان شیء با پیام
       * «Could not reset statement prior to binding new values» شکست می‌خورد —
       * حتی اگر داده‌ی جدید کاملا درست باشد.
       *
       * پیامد واقعی: یک درج تکراری می‌توانست درج سالم بعدی را هم از بین ببرد.
       * بنابراین هر statement معیوب را از کش بیرون می‌اندازیم تا دفعه‌ی بعد
       * از نو prepare شود. (better-sqlite3 این را داخلی انجام می‌دهد.)
       */
      const guarded = <R>(fn: (s: WasmStatement) => R, params: Primitive[] | [Record<string, Primitive>]): R => {
        const stmt = stmtFor(sql)
        try {
          return fn(stmt)
        } catch (e) {
          cache.delete(sql)
          try {
            if (!stmt.isFinalized) stmt.finalize()
          } catch {
            /* اگر finalize هم شکست خورد، رهایش کن؛ GC ی WASM جمعش می‌کند */
          }
          throw e
        }
      }

      return {
        get<T>(...params: Primitive[] | [Record<string, Primitive>]): T | undefined {
          const r = guarded((s) => s.get(normalizeParams(params) as never), params)
          return (r === null ? undefined : r) as T | undefined
        },
        all<T>(...params: Primitive[] | [Record<string, Primitive>]): T[] {
          return guarded((s) => s.all(normalizeParams(params) as never), params) as T[]
        },
        run(...params: Primitive[] | [Record<string, Primitive>]): RunInfo {
          const r = guarded((s) => s.run(normalizeParams(params) as never), params)
          return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }
        }
      }
    },

    exec(sql: string): void {
      raw.exec(sql)
    },

    /**
     * شبیه‌سازی db.pragma() از better-sqlite3.
     *  - «PRAGMA x = y» → اجرا
     *  - «PRAGMA x» با simple:true → مقدار خام
     */
    pragma(statement: string, opts?: { simple?: boolean }): unknown {
      const sql = 'PRAGMA ' + statement
      if (statement.includes('=')) {
        raw.exec(sql)
        return undefined
      }
      const row = raw.get(sql)
      if (!row) return undefined
      const values = Object.values(row)
      return opts?.simple ? values[0] : row
    },

    /**
     * تراکنش تودرتو-آگاه. better-sqlite3 این را با SAVEPOINT انجام می‌دهد؛
     * ما هم همان کار را می‌کنیم چون repos.ts جایی transaction داخل transaction
     * صدا می‌زند (syncFollowers → upsert).
     */
    transaction<T>(fn: () => T): () => T {
      return (): T => {
        const isOuter = txDepth === 0
        const savepoint = 'sp_' + txDepth
        txDepth++
        try {
          raw.exec(isOuter ? 'BEGIN' : 'SAVEPOINT ' + savepoint)
          const result = fn()
          raw.exec(isOuter ? 'COMMIT' : 'RELEASE ' + savepoint)
          return result
        } catch (e) {
          try {
            raw.exec(isOuter ? 'ROLLBACK' : 'ROLLBACK TO ' + savepoint)
          } catch {
            /* اگر تراکنش از قبل بسته شده، رول‌بک خطا می‌دهد — بی‌اهمیت */
          }
          throw e
        } finally {
          txDepth--
        }
      }
    },

    close(): void {
      for (const s of cache.values()) {
        if (!s.isFinalized) s.finalize()
      }
      cache.clear()
      raw.close()
    }
  }
}
