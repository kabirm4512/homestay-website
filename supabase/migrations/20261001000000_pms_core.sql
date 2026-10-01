-- =============================================================================
-- Savera Homestay PMS: core schema (Supabase / Postgres 15+)
-- =============================================================================
-- All application data lives in the private `pms` schema. It is NOT exposed through
-- the Supabase REST API (only `public` is), and the `anon` / `authenticated` roles are
-- given no privileges on it. The Next.js server connects directly with DATABASE_URL.
--
-- Records keep the full application object in `data jsonb` (the shapes in src/types)
-- plus typed key columns that the server maintains for querying, constraints and
-- inventory checks. Safe to run more than once.
-- =============================================================================

create schema if not exists pms;

-- No access for API roles (Supabase creates these; plain Postgres may not have them)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema pms from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema pms from authenticated';
  end if;
end $$;
revoke all on schema pms from public;

-- ----------------------------------------------------------------------------
-- Key/value settings: room tariffs, seasonal calendar, CMS sections, add-on rates
-- ----------------------------------------------------------------------------
create table if not exists pms.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- ----------------------------------------------------------------------------
-- Website room categories (src/types Room)
-- ----------------------------------------------------------------------------
create table if not exists pms.room_categories (
  id          text primary key,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Physical rooms (src/types/crm PhysicalRoom). Inventory per category is derived
-- from this table.
-- ----------------------------------------------------------------------------
create table if not exists pms.physical_rooms (
  id          text primary key,
  room_number int not null unique,
  category_id text not null,               -- canonical website category id (e.g. room-cat-1)
  qr_token    text not null,               -- secret embedded in the in-room QR code
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Bookings: website requests (kind = 'web') and front-desk bookings (kind = 'crm')
-- in ONE table so availability counts both.
-- ----------------------------------------------------------------------------
create table if not exists pms.bookings (
  id                text primary key,
  kind              text not null check (kind in ('web', 'crm')),
  reference         text not null unique,
  status            text not null,
  check_in          date not null,
  check_out         date not null,
  category_ids      text[] not null default '{}',  -- one element per room booked
  physical_room_id  text,                            -- crm bookings: the assigned room
  linked_booking_id text,                            -- crm booking created from a web request
  guest_phone       text,                            -- normalised last 10 digits
  hold_expires_at   timestamptz,                     -- web requests block inventory until this time
  idempotency_key   text unique,
  data              jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint bookings_dates_valid check (check_out > check_in)
);
create index if not exists bookings_dates_idx on pms.bookings (check_in, check_out);
create index if not exists bookings_phone_idx on pms.bookings (guest_phone);
create index if not exists bookings_room_idx on pms.bookings (physical_room_id);

-- ----------------------------------------------------------------------------
-- Website inquiries
-- ----------------------------------------------------------------------------
create table if not exists pms.inquiries (
  id          text primary key,
  status      text not null default 'pending',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Other front-desk collections (folios, food orders, dispatch, housekeeping,
-- expenses, menu, transfer routes, rental vehicles, activity logs, staff alerts).
-- Row-level writes: concurrent devices no longer overwrite each other.
-- ----------------------------------------------------------------------------
create table if not exists pms.records (
  collection  text not null,
  id          text not null,
  seq         bigserial,                     -- insertion order (menus keep their order)
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (collection, id)
);
create index if not exists records_updated_idx on pms.records (collection, updated_at desc);

-- ----------------------------------------------------------------------------
-- Staff accounts (server-side authentication)
-- ----------------------------------------------------------------------------
create table if not exists pms.staff_users (
  id                    text primary key,
  email                 text not null unique,
  full_name             text not null,
  phone                 text,
  role                  text not null check (role in ('admin', 'manager', 'kitchen_staff')),
  password_hash         text not null,
  is_active             boolean not null default true,
  must_change_password  boolean not null default false,
  session_version       int not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_login_at         timestamptz
);

-- ----------------------------------------------------------------------------
-- Audit trail (every write: who, what, before, after)
-- ----------------------------------------------------------------------------
create table if not exists pms.audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  ip         text
);
create index if not exists audit_log_entity_idx on pms.audit_log (entity, entity_id, at desc);

-- ----------------------------------------------------------------------------
-- Rate limiting (works across serverless instances)
-- ----------------------------------------------------------------------------
create table if not exists pms.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  count         int not null
);

-- ----------------------------------------------------------------------------
-- Gap-free counters (booking references per month, order numbers, folio numbers)
-- ----------------------------------------------------------------------------
create table if not exists pms.counters (
  name   text primary key,
  value  bigint not null
);

-- ----------------------------------------------------------------------------
-- Uploaded files (room photos, guest ID documents). Content is kept in Supabase
-- Storage when configured; `content` is only used when no Storage is configured
-- (local development / tests).
-- ----------------------------------------------------------------------------
create table if not exists pms.files (
  id            text primary key,
  bucket        text not null,
  path          text not null,
  visibility    text not null check (visibility in ('public', 'private')),
  content_type  text not null,
  size_bytes    int not null,
  owner_kind    text,
  owner_id      text,
  content       bytea,
  created_at    timestamptz not null default now(),
  created_by    text
);

-- Server-side role used by the app (direct connection) bypasses RLS; API roles get nothing.
alter table pms.settings        enable row level security;
alter table pms.room_categories enable row level security;
alter table pms.physical_rooms  enable row level security;
alter table pms.bookings        enable row level security;
alter table pms.inquiries       enable row level security;
alter table pms.records         enable row level security;
alter table pms.staff_users     enable row level security;
alter table pms.audit_log       enable row level security;
alter table pms.rate_limits     enable row level security;
alter table pms.counters        enable row level security;
alter table pms.files           enable row level security;

-- ----------------------------------------------------------------------------
-- Lock down the legacy public tables from supabase/schema.sql and schema_crm.sql
-- (they granted full access to any signed-in Supabase user). The app no longer
-- uses them; data can be imported with scripts/import-json-store.ts.
-- ----------------------------------------------------------------------------
do $$
declare
  t   text;
  pol record;
begin
  foreach t in array array[
    'rooms', 'inquiries', 'bookings', 'cms_content', 'site_content', 'reviews',
    'staff_users', 'room_categories', 'physical_rooms', 'guests', 'guest_folios',
    'folio_charges', 'folio_payments', 'menu_categories', 'menu_items', 'food_orders',
    'food_order_items', 'transfer_routes', 'route_modifiers', 'rental_vehicles',
    'transport_requests', 'housekeeping_tasks', 'expenses', 'audit_logs'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Supabase Storage buckets (skipped automatically on plain Postgres)
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
      values ('room-photos', 'room-photos', true)
      on conflict (id) do nothing;
    insert into storage.buckets (id, name, public)
      values ('guest-documents', 'guest-documents', false)
      on conflict (id) do nothing;
  end if;
end $$;
