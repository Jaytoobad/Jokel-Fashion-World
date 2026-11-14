-- Jokel Fashion World: initial schema. Review before applying (supabase db push).
create type public.app_role as enum ('admin', 'staff');
create type public.application_status as enum ('draft', 'submitted', 'under_review', 'accepted', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table public.programmes (
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
create trigger programmes_updated before update on public.programmes for each row execute function public.set_updated_at();
create index programmes_published_idx on public.programmes (sort_order) where published;

create table public.gallery_items (
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
create index gallery_published_idx on public.gallery_items (collection, sort_order) where published;

create table public.achievements (
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
create index achievements_published_idx on public.achievements (sort_order) where published and verified;

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.enquiries (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 254),
  enquiry_type text not null check (enquiry_type in ('admissions', 'business', 'general')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('JFW-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  programme_id bigint references public.programmes (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  date_of_birth date,
  address text,
  education_background text,
  additional_info text,
  status public.application_status not null default 'draft',
  fee_received boolean not null default false, -- fees are paid in person; staff tick this when received
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger applications_updated before update on public.applications for each row execute function public.set_updated_at();
create index applications_programme_idx on public.applications (programme_id);
create index applications_status_idx on public.applications (status);

alter table public.profiles enable row level security;
alter table public.programmes enable row level security;
alter table public.gallery_items enable row level security;
alter table public.achievements enable row level security;
alter table public.site_settings enable row level security;
alter table public.enquiries enable row level security;
alter table public.applications enable row level security;

-- Public reads: published content only.
create policy programmes_public_read on public.programmes for select to anon, authenticated using (published);
create policy gallery_public_read on public.gallery_items for select to anon, authenticated using (published);
create policy achievements_public_read on public.achievements for select to anon, authenticated using (published and verified);
create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);

-- Staff manage content.
create policy programmes_admin on public.programmes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gallery_admin on public.gallery_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy achievements_admin on public.achievements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin on public.site_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy applications_admin on public.applications for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enquiries_admin on public.enquiries for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enquiries_public_insert on public.enquiries for insert to anon, authenticated with check (status = 'new');
create policy profiles_self_read on public.profiles for select to authenticated using (id = (select auth.uid()));
-- Create the first admin manually: insert into public.profiles (id, full_name, role) values ('<auth user uuid>', 'Name', 'admin');
-- Role changes are not exposed to clients on purpose.

insert into storage.buckets (id, name, public) values ('site-images', 'site-images', true), ('application-documents', 'application-documents', false) on conflict do nothing;
create policy site_images_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'site-images' and (select public.is_admin())) with check (bucket_id = 'site-images' and (select public.is_admin()));
create policy application_docs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'application-documents' and (select public.is_admin()));
