-- ============================================================================
-- Red Alpha Companion — RLS HARDENING MIGRATION
-- Run once in Supabase Dashboard → SQL Editor. Idempotent: safe to re-run.
--
-- Replaces every interim using(true) policy with owner / staff / admin rules.
-- MUST be applied BEFORE importing real PII into student_profiles.
--
-- ⚠️ STEP 0 — make sure you keep admin access. This upserts your own admin
-- row so the new policies recognise you. Edit the email if needed.
-- ============================================================================

-- ============================================================================
-- 0.5  Ensure every table exists (no-ops where already created). This makes
--      the migration runnable even if parts of supabase-schema.sql were never
--      applied (e.g. announcements).
-- ============================================================================

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null unique,
  role text not null default 'staff' check (role in ('admin','staff')),
  status text not null default 'invited' check (status in ('active','invited')),
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  full_name text not null,
  email text not null,
  date_of_birth date,
  cohort_id text,
  cohort_name text,
  cv_url text,
  cv_filename text,
  lifecycle_stage text default 'on-course',
  placement_company text,
  placement_role text,
  reporting_officer text,
  ro_email text,
  bond_end_date text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.student_profiles
  add column if not exists account_manager      text,
  add column if not exists contact_no           text,
  add column if not exists personal_email       text,
  add column if not exists date_joined          text,
  add column if not exists ccp_grant            text,
  add column if not exists model                text,
  add column if not exists bond_months          int,
  add column if not exists bond_mode            text default 'accumulative',
  add column if not exists placement_start_date text,
  add column if not exists placements           jsonb default '[]'::jsonb,
  add column if not exists certifications       jsonb default '[]'::jsonb;

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

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id text primary key, name text not null, moodle_name text, track text,
  start_date text, end_date text, student_count int default 0, color text,
  active boolean default true, created_at timestamptz default now()
);

create table if not exists public.courses (
  id text primary key, title text not null, provider text, track text, description text,
  start_date text, end_date text, spots_total int default 0, spots_remaining int default 0,
  status text default 'open', color text, created_at timestamptz default now()
);

create table if not exists public.syllabus_weeks (
  id uuid primary key default gen_random_uuid(), cohort_id text not null,
  week_number int not null, title text, topics text
);

create table if not exists public.announcements (
  id text primary key,
  type text, title text, body text,
  posted_at timestamptz default now(),
  audience text, pinned boolean default false, author text,
  achiever_name text, achiever_cohort text, certification_name text, cert_provider text,
  created_at timestamptz not null default now()
);

-- STEP 0 (now that tables surely exist): keep your own admin access.
insert into public.staff_members (name, email, role, status)
values ('Ron', 'ron_martziano@dart.com.sg', 'admin', 'active')
on conflict (email) do update set role = 'admin', status = 'active';

-- ============================================================================
-- 1. Helper functions
-- ============================================================================

-- Staff = active row in staff_members (role staff OR admin).
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.staff_members
    where lower(email) = lower(auth.jwt() ->> 'email')
      and status = 'active'
  );
$$;

-- Admin = active admin row. (Fix: previously didn't require status='active'.)
create or replace function public.is_staff_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.staff_members
    where lower(email) = lower(auth.jwt() ->> 'email')
      and role = 'admin'
      and status = 'active'
  );
$$;

-- True only for a real signed-in user. NOTE: `auth.jwt() is not null` is TRUE
-- even for anon-key requests (the anon key is itself a JWT), so never use it.
create or replace function public.is_authenticated()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated';
$$;

-- Self-service activation: an invited member flips their OWN row to active on
-- first real sign-in. Replaces the client-side upsert (which admin-only write
-- policies would now reject).
create or replace function public.activate_membership()
returns void language sql security definer set search_path = public as $$
  update public.staff_members
     set status = 'active'
   where lower(email) = lower(auth.jwt() ->> 'email')
     and status = 'invited';
$$;
revoke all on function public.activate_membership() from public, anon;
grant execute on function public.activate_membership() to authenticated;

-- ============================================================================
-- 2. student_profiles  (THE critical table — will hold PII)
--    Students: own row; staff-managed columns locked by trigger.
--    Staff: read/insert/update all. Admin: delete.
-- ============================================================================

alter table public.student_profiles enable row level security;

drop policy if exists "Students can insert their own profile" on public.student_profiles;
drop policy if exists "Students can update their own profile" on public.student_profiles;
drop policy if exists "Students can read their own profile"   on public.student_profiles;
drop policy if exists "Staff can read all profiles"           on public.student_profiles;
drop policy if exists "Staff can update all profiles"         on public.student_profiles;
drop policy if exists "Staff can insert profiles"             on public.student_profiles;
drop policy if exists "sp own read"     on public.student_profiles;
drop policy if exists "sp own insert"   on public.student_profiles;
drop policy if exists "sp own update"   on public.student_profiles;
drop policy if exists "sp staff read"   on public.student_profiles;
drop policy if exists "sp staff insert" on public.student_profiles;
drop policy if exists "sp staff update" on public.student_profiles;
drop policy if exists "sp admin delete" on public.student_profiles;

create policy "sp own read" on public.student_profiles for select
  using ((select auth.uid())::text = user_id);
create policy "sp own insert" on public.student_profiles for insert
  with check ((select auth.uid())::text = user_id);
create policy "sp own update" on public.student_profiles for update
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);
create policy "sp staff read" on public.student_profiles for select
  using ((select public.is_staff()));
create policy "sp staff insert" on public.student_profiles for insert
  with check ((select public.is_staff()));
create policy "sp staff update" on public.student_profiles for update
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy "sp admin delete" on public.student_profiles for delete
  using ((select public.is_staff_admin()));

-- Column guard: non-staff (i.e. the student) may edit only their own *safe*
-- fields (name, DOB, cohort, CV). Staff-managed fields silently keep their
-- old values on UPDATE and are forced to defaults on INSERT.
create or replace function public.guard_student_profile_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select public.is_staff()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.lifecycle_stage      := 'on-course';
    new.placement_company    := null;
    new.placement_role       := null;
    new.placement_start_date := null;
    new.reporting_officer    := null;
    new.ro_email             := null;
    new.bond_months          := null;
    new.bond_mode            := 'accumulative';
    new.bond_end_date        := null;
    new.ccp_grant            := null;
    new.account_manager      := null;
    new.date_joined          := null;
    new.placements           := '[]'::jsonb;
    new.certifications       := '[]'::jsonb;
    return new;
  end if;
  -- UPDATE by a student: staff-managed columns are immutable
  new.user_id              := old.user_id;
  new.lifecycle_stage      := old.lifecycle_stage;
  new.placement_company    := old.placement_company;
  new.placement_role       := old.placement_role;
  new.placement_start_date := old.placement_start_date;
  new.reporting_officer    := old.reporting_officer;
  new.ro_email             := old.ro_email;
  new.bond_months          := old.bond_months;
  new.bond_mode            := old.bond_mode;
  new.bond_end_date        := old.bond_end_date;
  new.ccp_grant            := old.ccp_grant;
  new.account_manager      := old.account_manager;
  new.date_joined          := old.date_joined;
  new.placements           := old.placements;
  new.certifications       := old.certifications;
  return new;
end $$;

drop trigger if exists trg_guard_student_profile_write on public.student_profiles;
create trigger trg_guard_student_profile_write
  before insert or update on public.student_profiles
  for each row execute function public.guard_student_profile_write();

-- ============================================================================
-- 3. staff_members — self-read (role resolution at login) + staff read all;
--    writes admin-only. Drops ALL interim permissive policies.
-- ============================================================================

alter table public.staff_members enable row level security;

drop policy if exists "members readable"           on public.staff_members;
drop policy if exists "members insertable"         on public.staff_members;
drop policy if exists "members updatable"          on public.staff_members;
drop policy if exists "members deletable"          on public.staff_members;
drop policy if exists "members read (signed in)"   on public.staff_members;
drop policy if exists "members write (admin only)" on public.staff_members;
drop policy if exists "members write (admin)"      on public.staff_members;
drop policy if exists "members self read"          on public.staff_members;
drop policy if exists "members staff read"         on public.staff_members;
drop policy if exists "members admin write"        on public.staff_members;

-- Everyone signed in can see their OWN row (needed to resolve their role).
create policy "members self read" on public.staff_members for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));
-- Active staff can see the full list (Users tab is admin-only in the UI,
-- but staff visibility of colleagues is intended).
create policy "members staff read" on public.staff_members for select
  using ((select public.is_staff()));
-- Only admins create/change/remove members (activation goes via the RPC).
create policy "members admin write" on public.staff_members for all
  using ((select public.is_staff_admin()))
  with check ((select public.is_staff_admin()));

-- ============================================================================
-- 4. Staff-only tables: interviews, intake_programmes, app_settings
-- ============================================================================

alter table public.interviews enable row level security;
drop policy if exists "interviews staff read"  on public.interviews;
drop policy if exists "interviews staff write" on public.interviews;
create policy "interviews staff read"  on public.interviews for select
  using ((select public.is_staff()));
create policy "interviews staff write" on public.interviews for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.intake_programmes enable row level security;
drop policy if exists "intake staff read"  on public.intake_programmes;
drop policy if exists "intake staff write" on public.intake_programmes;
create policy "intake staff read"  on public.intake_programmes for select
  using ((select public.is_staff()));
create policy "intake staff write" on public.intake_programmes for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.app_settings enable row level security;
drop policy if exists "settings read"  on public.app_settings;
drop policy if exists "settings write" on public.app_settings;
create policy "settings read"  on public.app_settings for select
  using ((select public.is_staff()));
create policy "settings write" on public.app_settings for all
  using ((select public.is_staff_admin())) with check ((select public.is_staff_admin()));

-- ============================================================================
-- 5. Shared-read tables: cohorts, courses, syllabus_weeks, announcements
--    Students need these (onboarding cohort pick, upskilling, syllabus, news)
--    — previous staff-only read silently broke the student app on Supabase.
-- ============================================================================

alter table public.cohorts enable row level security;
drop policy if exists "cohorts read"  on public.cohorts;
drop policy if exists "cohorts write" on public.cohorts;
create policy "cohorts read"  on public.cohorts for select
  using ((select public.is_authenticated()));
create policy "cohorts write" on public.cohorts for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.courses enable row level security;
drop policy if exists "courses read"  on public.courses;
drop policy if exists "courses write" on public.courses;
create policy "courses read"  on public.courses for select
  using ((select public.is_authenticated()));
create policy "courses write" on public.courses for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.syllabus_weeks enable row level security;
drop policy if exists "syllabus read"  on public.syllabus_weeks;
drop policy if exists "syllabus write" on public.syllabus_weeks;
create policy "syllabus read"  on public.syllabus_weeks for select
  using ((select public.is_authenticated()));
create policy "syllabus write" on public.syllabus_weeks for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.announcements enable row level security;
drop policy if exists "announcements read"  on public.announcements;
drop policy if exists "announcements write" on public.announcements;
create policy "announcements read"  on public.announcements for select
  using ((select public.is_authenticated()));
create policy "announcements write" on public.announcements for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ============================================================================
-- 6. Lock the anon role out of all app tables (defense in depth — policies
--    above already deny anon, this makes it explicit).
-- ============================================================================

revoke select, insert, update, delete on
  public.student_profiles, public.staff_members, public.interviews,
  public.intake_programmes, public.app_settings, public.cohorts,
  public.courses, public.syllabus_weeks, public.announcements
from anon;

-- ============================================================================
-- 7. Storage: cvs bucket — owner full access, staff read.
--    If this errors with "must be owner of table objects", create the same
--    two policies in Dashboard → Storage → cvs → Policies instead.
-- ============================================================================

drop policy if exists "cvs owner all"  on storage.objects;
create policy "cvs owner all" on storage.objects for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "cvs staff read" on storage.objects;
create policy "cvs staff read" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and (select public.is_staff()));

-- ============================================================================
-- Done. Verify with: node scripts/verify-rls.mjs   (see file header for setup)
-- ============================================================================
