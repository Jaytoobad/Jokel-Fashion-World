-- Admin users table for DB-backed authentication
create table admin_users (
  id bigint generated always as identity primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_users_email_idx on admin_users (email);