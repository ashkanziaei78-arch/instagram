import postgres from 'postgres'

/**
 * Postgres با جدول‌هایی که پیشوند dx_ دارند.
 *
 * چرا پیشوند و نه schema جدا: پولرهای Supabase در حالت transaction پارامتر
 * search_path را نگه نمی‌دارند. با پیشوند، همین دیتابیس را می‌شود کنار جدول‌های
 * دیگر گذاشت بدون اینکه چیزی قاطی شود.
 */
let client: postgres.Sql | null = null
let ready: Promise<void> | null = null

export const hasDb = (): boolean => !!process.env.DATABASE_URL

export class NoDbError extends Error {
  constructor() {
    super('دیتابیس وصل نیست — DATABASE_URL را در تنظیمات هاست بگذارید')
  }
}

export async function db(): Promise<postgres.Sql> {
  const url = process.env.DATABASE_URL
  if (!url) throw new NoDbError()
  if (!client) {
    client = postgres(url, {
      max: 3,
      idle_timeout: 20,
      prepare: false,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : 'prefer'
    })
  }
  if (!ready) {
    ready = migrate(client).catch((e) => {
      ready = null
      throw e
    })
  }
  await ready
  return client
}

async function migrate(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    create table if not exists dx_users (
      id bigserial primary key,
      username text not null unique,
      pass_hash text not null,
      is_admin boolean not null default false,
      sub_until timestamptz,
      created_at timestamptz not null default now()
    );
    create table if not exists dx_payments (
      id bigserial primary key,
      user_id bigint not null references dx_users(id) on delete cascade,
      plan text not null,
      amount integer not null,
      authority text unique,
      status text not null default 'pending',
      ref_id text,
      created_at timestamptz not null default now(),
      verified_at timestamptz
    );
    create table if not exists dx_ig_accounts (
      id bigserial primary key,
      user_id bigint not null references dx_users(id) on delete cascade,
      ig_user_id text not null unique,
      username text not null,
      token_enc text not null,
      token_expires_at timestamptz,
      webhook_ok boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists dx_rules (
      id bigserial primary key,
      user_id bigint not null references dx_users(id) on delete cascade,
      ig_account_id bigint not null references dx_ig_accounts(id) on delete cascade,
      trigger text not null,
      keywords text not null default '',
      reply text not null,
      public_reply text,
      button_title text,
      button_url text,
      enabled boolean not null default true,
      hits integer not null default 0,
      created_at timestamptz not null default now()
    );
    create table if not exists dx_events (
      id bigserial primary key,
      user_id bigint not null references dx_users(id) on delete cascade,
      ig_account_id bigint references dx_ig_accounts(id) on delete set null,
      kind text not null,
      ok boolean not null default true,
      detail text not null default '',
      created_at timestamptz not null default now()
    );
    create index if not exists dx_events_user on dx_events (user_id, created_at desc);
    create table if not exists dx_oauth_states (
      state text primary key,
      user_id bigint references dx_users(id) on delete cascade,
      nonce text,
      created_at timestamptz not null default now()
    );
    create table if not exists dx_desktop_claims (
      nonce text primary key,
      payload text not null,
      created_at timestamptz not null default now()
    );
    create table if not exists dx_processed (
      id text primary key,
      created_at timestamptz not null default now()
    );
  `)
}

export interface UserRow {
  id: string
  username: string
  is_admin: boolean
  sub_until: Date | null
  created_at: Date
}

export interface IgAccountRow {
  id: string
  user_id: string
  ig_user_id: string
  username: string
  token_enc: string
  token_expires_at: Date | null
  webhook_ok: boolean
}

export interface RuleRow {
  id: string
  ig_account_id: string
  trigger: 'comment' | 'dm' | 'story'
  keywords: string
  reply: string
  public_reply: string | null
  button_title: string | null
  button_url: string | null
  enabled: boolean
  hits: number
}
