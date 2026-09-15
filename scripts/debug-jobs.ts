import { rmSync, existsSync } from 'node:fs'
import { initDb, getDb, closeDb, now } from '../src/core/db/index'

const DB = './scratch-dbg.sqlite'
for (const f of [DB, DB + '-wal', DB + '-shm']) if (existsSync(f)) rmSync(f)
initDb(DB)
const db = getDb()

function tryInsert(label: string, payload: unknown, runAt: number, dedupe: string | null): void {
  const t = now()
  try {
    const info = db
      .prepare(
        'INSERT INTO jobs(account_id, kind, payload, status, run_at, max_attempts, dedupe_key, created_at, updated_at) VALUES(?,?,?,\'pending\',?,?,?,?,?)'
      )
      .run(1, 'send_dm', JSON.stringify(payload ?? {}), runAt, 3, dedupe, t, t)
    console.log(label + ' -> OK id=' + info.lastInsertRowid)
  } catch (e) {
    console.log(label + ' -> ERROR: ' + (e as Error).message)
  }
}

tryInsert('A dedupe=dm:u1', { to: 'u1' }, now(), 'dm:u1')
tryInsert('B dedupe=dm:u1 (تکراری)', { to: 'u1' }, now(), 'dm:u1')
tryInsert('C dedupe=null', { to: 'u4' }, now(), null)
tryInsert('D dedupe=null future', undefined, now() + 600000, null)

const rows = db.prepare('SELECT id, run_at, dedupe_key, payload FROM jobs').all()
console.log('rows:', JSON.stringify(rows, null, 1))
const idx = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='jobs'").all()
console.log('indexes:', JSON.stringify(idx, null, 1))
closeDb()
for (const f of [DB, DB + '-wal', DB + '-shm']) if (existsSync(f)) rmSync(f)
