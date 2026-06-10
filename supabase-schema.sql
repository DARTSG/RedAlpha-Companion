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
-- SECURE member policies — apply ONLY AFTER Supabase Third-Party Auth (Entra) is
-- enabled AND you've confirmed sign-in + data loading works. This replaces the
-- interim permissive policies above and restricts WRITES to admins (identified by
-- the email claim in the Entra ID token). Uncomment and run as one block.
-- ===========================================================================
-- drop policy if exists "members readable"  on public.staff_members;
-- drop policy if exists "members insertable" on public.staff_members;
-- drop policy if exists "members updatable"  on public.staff_members;
-- drop policy if exists "members deletable"  on public.staff_members;
--
-- create policy "members read (signed in)" on public.staff_members for select
--   using (auth.jwt() is not null);
--
-- create policy "members write (admin only)" on public.staff_members for all
--   using (exists (select 1 from public.staff_members me
--                  where lower(me.email) = lower(auth.jwt() ->> 'email') and me.role = 'admin'))
--   with check (exists (select 1 from public.staff_members me
--                  where lower(me.email) = lower(auth.jwt() ->> 'email') and me.role = 'admin'));
