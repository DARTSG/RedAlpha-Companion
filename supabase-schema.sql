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
