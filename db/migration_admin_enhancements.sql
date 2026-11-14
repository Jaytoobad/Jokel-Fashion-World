-- Jokel Fashion World: admin enhancements migration
-- Adds updated_at to content tables, enquiry reply tracking, and admin content management support.

-- 1. Add updated_at to content tables that lack it
alter table gallery_items add column if not exists updated_at timestamptz not null default now();
alter table achievements add column if not exists updated_at timestamptz not null default now();

-- 2. Enquiry reply tracking
alter table enquiries add column if not exists replied_at timestamptz;
alter table enquiries add column if not exists reply_subject text;
alter table enquiries add column if not exists reply_body text;

-- 3. Admin-created content flag (so we can distinguish seeded vs user-created)
alter table programmes add column if not exists created_by text;
alter table gallery_items add column if not exists created_by text;
alter table achievements add column if not exists created_by text;

-- 4. Audit log: allow target_table for content management
alter table audit_log drop constraint if exists audit_log_target_table_check;
alter table audit_log add constraint audit_log_target_table_check
  check (target_table in ('applications', 'enquiries', 'programmes', 'gallery_items', 'achievements', 'site_settings'));