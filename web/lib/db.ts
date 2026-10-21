import postgres from 'postgres'
import { hashPassword } from './crypto'

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
    // آدرس‌های Neon پارامترهای libpq مثل channel_binding دارند که این کتابخانه
    // به‌عنوان تنظیم سرور می‌فرستد و Postgres ردشان می‌کند؛ SSL را خودمان تعیین می‌کنیم
    const u = new URL(url)
    const sslmode = u.searchParams.get('sslmode')
    for (const k of ['channel_binding', 'sslmode', 'sslrootcert', 'options']) u.searchParams.delete(k)
    client = postgres(u.toString(), {
      max: 3,
      idle_timeout: 20,
      prepare: false,
      // «already exists, skipping» در هر بار مهاجرت؛ فقط شلوغی لاگ است
      onnotice: () => {},
      ssl:
        process.env.DATABASE_SSL === 'disable' || sslmode === 'disable'
          ? false
          : sslmode && sslmode !== 'prefer'
            ? 'require'
            : 'prefer'
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
  await migrateV2(sql)
  await seedReviewer(sql)
}

/**
 * نسخه‌ی ۲: مخاطبان (CRM)، فرم و گفت‌وگوی چندمرحله‌ای، ویترین محصولات،
 * قانون‌های پیشرفته (پست خاص، شرط فالو، دکمه‌ها، عکس، یک‌بار برای هر نفر) و
 * تنظیمات هر پیج (هوش مصنوعی، فیلتر کامنت، منوی سریع). همه افزایشی‌اند تا
 * دیتابیس‌های نسخه‌ی قبل بدون از دست رفتن داده ارتقا پیدا کنند.
 */
async function migrateV2(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    alter table dx_rules add column if not exists name text;
    alter table dx_rules add column if not exists media_id text;
    alter table dx_rules add column if not exists follow_gate text;
    alter table dx_rules add column if not exists buttons jsonb;
    alter table dx_rules add column if not exists quick_replies text;
    alter table dx_rules add column if not exists image_url text;
    alter table dx_rules add column if not exists once_per_user boolean not null default false;
    alter table dx_rules add column if not exists questions jsonb;
    alter table dx_rules add column if not exists done_text text;
    alter table dx_rules add column if not exists tag text;
    alter table dx_events add column if not exists rule_id bigint;
    alter table dx_ig_accounts add column if not exists settings jsonb not null default '{}';
    create table if not exists dx_contacts (
      id bigserial primary key,
      ig_account_id bigint not null references dx_ig_accounts(id) on delete cascade,
      igsid text not null,
      username text,
      name text,
      phone text,
      email text,
      tags text[] not null default '{}',
      answers jsonb not null default '{}',
      interactions integer not null default 0,
      first_seen timestamptz not null default now(),
      last_seen timestamptz not null default now(),
      last_dm_at timestamptz,
      unique (ig_account_id, igsid)
    );
    create index if not exists dx_contacts_seen on dx_contacts (ig_account_id, last_seen desc);
    create table if not exists dx_rule_sends (
      rule_id bigint not null references dx_rules(id) on delete cascade,
      contact_id bigint not null references dx_contacts(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (rule_id, contact_id)
    );
    create table if not exists dx_convos (
      contact_id bigint primary key references dx_contacts(id) on delete cascade,
      rule_id bigint not null references dx_rules(id) on delete cascade,
      step integer not null default 0,
      expires_at timestamptz not null
    );
    create table if not exists dx_products (
      id bigserial primary key,
      user_id bigint not null references dx_users(id) on delete cascade,
      ig_account_id bigint not null references dx_ig_accounts(id) on delete cascade,
      title text not null,
      subtitle text,
      price text,
      image_url text,
      url text,
      sort integer not null default 0,
      created_at timestamptz not null default now()
    );
  `)
}

/**
 * حساب تست برای بازبین متا (App Review): از روی REVIEWER_USERNAME و
 * REVIEWER_PASSWORD ساخته یا به‌روز می‌شود و همیشه دست‌کم ۳۰ روز اشتراک دارد،
 * تا بازبین بدون پرداخت کل جریان را ببیند.
 */
async function seedReviewer(sql: postgres.Sql): Promise<void> {
  const username = (process.env.REVIEWER_USERNAME ?? '').trim().toLowerCase()
  const password = process.env.REVIEWER_PASSWORD ?? ''
  if (!username || password.length < 8) return
  await sql`
    insert into dx_users (username, pass_hash, sub_until)
    values (${username}, ${await hashPassword(password)}, now() + interval '30 days')
    on conflict (username) do update set
      pass_hash = excluded.pass_hash,
      sub_until = greatest(dx_users.sub_until, now() + interval '30 days')`
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
  settings: AccountSettings
}

export type Trigger = 'comment' | 'dm' | 'story' | 'mention' | 'first_dm'

export interface LinkButton {
  title: string
  url: string
}

export interface Question {
  /** name / phone / email در ستون‌های خودشان ذخیره می‌شوند؛ بقیه در answers */
  key: string
  ask: string
}

export interface RuleRow {
  id: string
  ig_account_id: string
  name: string | null
  trigger: Trigger
  keywords: string
  reply: string
  public_reply: string | null
  button_title: string | null
  button_url: string | null
  buttons: LinkButton[] | null
  quick_replies: string | null
  image_url: string | null
  media_id: string | null
  follow_gate: string | null
  once_per_user: boolean
  questions: Question[] | null
  done_text: string | null
  tag: string | null
  enabled: boolean
  hits: number
}

export interface ContactRow {
  id: string
  ig_account_id: string
  igsid: string
  username: string | null
  name: string | null
  phone: string | null
  email: string | null
  tags: string[]
  answers: Record<string, string>
  interactions: number
  first_seen: Date
  last_seen: Date
  last_dm_at: Date | null
}

export interface ProductRow {
  id: string
  ig_account_id: string
  title: string
  subtitle: string | null
  price: string | null
  image_url: string | null
  url: string | null
  sort: number
}

/** تنظیمات هر پیج — در ستون jsonb */
export interface AccountSettings {
  ai?: { enabled?: boolean; provider?: string; baseUrl?: string; model?: string; keyEnc?: string; prompt?: string }
  moderation?: { enabled?: boolean; words?: string }
  catalog?: { keywords?: string; intro?: string; button?: string }
  iceBreakers?: string[]
}
