-- Red Alpha Companion — Supabase Schema
-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor)

-- Student profiles table
create table if not exists student_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text unique not null,         -- auth user ID (Microsoft or demo)
  full_name           text not null,
  email               text not null,
  date_of_birth       date,
  cohort_id           text,
  cohort_name         text,
  cv_url              text,                         -- Supabase Storage signed URL
  cv_filename         text,
  -- Placement fields (managed by staff)
  lifecycle_stage     text default 'on-course',
  placement_company   text,
  placement_role      text,
  reporting_officer   text,
  ro_email            text,
  bond_end_date       date,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Row-level security: students can only read/write their own row
alter table student_profiles enable row level security;

create policy "Students can insert their own profile"
  on student_profiles for insert
  with check (auth.uid()::text = user_id);

create policy "Students can update their own profile"
  on student_profiles for update
  using (auth.uid()::text = user_id);

create policy "Students can read their own profile"
  on student_profiles for select
  using (auth.uid()::text = user_id);

-- Staff can read all profiles (add your staff role check here)
create policy "Staff can read all profiles"
  on student_profiles for select
  using (true);   -- tighten this to a staff role check in production

create policy "Staff can update all profiles"
  on student_profiles for update
  using (true);   -- tighten this to a staff role check in production

-- Storage bucket for CVs
-- Run in Storage section: create bucket named "cvs" (set to private)
-- Then add these storage policies:

-- insert { bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text }
-- select { bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text }
-- update { bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text }

-- ===========================================================================
-- staff_members — admin/staff user management (drives the "Users" tab + roles)
-- ===========================================================================
create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null unique,
  role text not null default 'staff' check (role in ('admin','staff')),
  status text not null default 'invited' check (status in ('active','invited')),
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;

-- INTERIM POLICIES — read/write permitted with the public anon key.
-- The app currently authenticates users via Microsoft Entra (NOT Supabase Auth),
-- so DB requests arrive as the anonymous role. These permissive policies make the
-- Users feature work right now. *** TIGHTEN BEFORE PUBLIC LAUNCH *** by integrating
-- Entra -> Supabase (JWT) and restricting writes to admins.
create policy "members readable"  on public.staff_members for select using (true);
create policy "members insertable" on public.staff_members for insert with check (true);
create policy "members updatable" on public.staff_members for update using (true) with check (true);
create policy "members deletable" on public.staff_members for delete using (true);


-- ===========================================================================

-- ===========================================================================
-- SECURE member policies — apply AFTER Supabase Azure (OAuth) sign-in works.
-- Uses a SECURITY DEFINER helper so the admin check does NOT recurse on the
-- same table (a policy that selects from staff_members inside a staff_members
-- policy causes "infinite recursion"). Run this whole block once.
-- ===========================================================================
create or replace function public.is_staff_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.staff_members
    where lower(email) = lower(auth.jwt() ->> 'email') and role = 'admin'
  );
$$;

drop policy if exists "members readable"          on public.staff_members;
drop policy if exists "members insertable"        on public.staff_members;
drop policy if exists "members updatable"         on public.staff_members;
drop policy if exists "members deletable"         on public.staff_members;
drop policy if exists "members read (signed in)"  on public.staff_members;
drop policy if exists "members write (admin only)" on public.staff_members;

create policy "members read (signed in)" on public.staff_members
  for select using (auth.jwt() is not null);

create policy "members write (admin)" on public.staff_members
  for all using (public.is_staff_admin()) with check (public.is_staff_admin());

-- ===========================================================================
-- Interviews + Intake pipeline (staff-managed)
-- ===========================================================================
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.staff_members
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'active');
$$;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  company text not null,
  role text,
  date date,
  outcome text not null default 'scheduled' check (outcome in ('scheduled','passed','rejected','pending')),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.interviews enable row level security;
create policy "interviews staff read"  on public.interviews for select using (public.is_staff());
create policy "interviews staff write" on public.interviews for all    using (public.is_staff()) with check (public.is_staff());

create table if not exists public.intake_programmes (
  id uuid primary key default gen_random_uuid(),
  quarter text not null,
  program_number text not null,
  domain text not null,
  quantity int not null default 0,
  status text not null default 'tbc' check (status in ('tbc','confirmed','started')),
  start_date text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.intake_programmes enable row level security;
create policy "intake staff read"  on public.intake_programmes for select using (public.is_staff());
create policy "intake staff write" on public.intake_programmes for all    using (public.is_staff()) with check (public.is_staff());

-- App settings (key/value): admin-editable config such as the intake target.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "settings read"  on public.app_settings for select using (public.is_staff());
create policy "settings write" on public.app_settings for all    using (public.is_staff_admin()) with check (public.is_staff_admin());
