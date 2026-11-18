-- Jokel Fashion World: security migration
-- Adds login attempt tracking and account lockout tables for brute-force protection.

-- Login attempts: tracks failed/successful login attempts per IP and email
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null, -- hashed IP or hashed email
  attempt_type text not null check (attempt_type in ('ip', 'email', 'success', 'failure')),
  window_start timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identifier, attempt_type, window_start)
);
create index login_attempts_window_idx on login_attempts (window_start);
create index login_attempts_identifier_idx on login_attempts (identifier);

-- Login lockouts: temporary lockouts after too many failed attempts
create table if not exists login_lockouts (
  id bigint generated always as identity primary key,
  identifier text not null, -- hashed IP or hashed email
  lock_type text not null check (lock_type in ('ip', 'email')),
  lock_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identifier, lock_type)
);
create index login_lockouts_unlock_idx on login_lockouts (lock_until);
