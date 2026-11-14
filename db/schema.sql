-- Jokel Fashion World: initial schema for Neon (plain Postgres).
-- Run this in the Neon SQL Editor (Console → SQL Editor) or via psql.

create type application_status as enum ('submitted', 'under_review', 'accepted', 'rejected');

create table programmes (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  summary text,
  duration text,
  level text,
  requirements text,
  fee_ghs numeric(10, 2) check (fee_ghs >= 0),
  image_path text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programmes_published_idx on programmes (sort_order) where published;

create table gallery_items (
  id bigint generated always as identity primary key,
  collection text not null check (collection in ('design', 'student')),
  title text not null,
  description text,
  category text,
  student_name text,
  student_name_approved boolean not null default false,
  image_path text not null,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_published_idx on gallery_items (collection, sort_order) where published;

create table achievements (
  id bigint generated always as identity primary key,
  year text,
  title text not null,
  description text,
  category text,
  image_path text,
  verified boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index achievements_published_idx on achievements (sort_order) where published and verified;

create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table enquiries (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 254),
  enquiry_type text not null check (enquiry_type in ('admissions', 'custom_design', 'business', 'general')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('JFW-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  programme_name text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  date_of_birth date,
  address text,
  education_background text,
  additional_info text,
  status application_status not null default 'submitted',
  fee_received boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_status_idx on applications (status);
create index applications_programme_name_idx on applications (programme_name);

-- Rate limits: hashed IP (with server-side salt), route, window start, count.
-- Never stores raw IP addresses.
create table rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  route text not null check (route in ('enquiry', 'application')),
  window_start timestamptz not null,
  count integer not null default 1,
  unique (ip_hash, route, window_start)
);
create index rate_limits_window_idx on rate_limits (window_start);

-- Audit trail for admin actions on applications and enquiries
create table audit_log (
  id bigint generated always as identity primary key,
  admin_email text not null,
  target_table text not null check (target_table in ('applications', 'enquiries')),
  target_id text not null,
  field_changed text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);
create index audit_log_target_idx on audit_log (target_table, target_id);
create index audit_log_admin_idx on audit_log (admin_email);