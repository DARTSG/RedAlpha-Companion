-- ============================================================================
-- Red Alpha Companion — FEATURE MIGRATION (run AFTER supabase-rls-hardening.sql)
-- Adds: upskilling + performance reports columns, intake syllabus columns,
-- cert_submissions table, and updates the student column-guard trigger.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.student_profiles
  add column if not exists upskilling          jsonb default '[]'::jsonb,
  add column if not exists performance_reports jsonb default '[]'::jsonb;

alter table public.intake_programmes
  add column if not exists syllabus_url      text,
  add column if not exists syllabus_filename text;

-- ----------------------------------------------------------------------------
-- cert_submissions: students self-report certs; staff verify before they show
-- ----------------------------------------------------------------------------
create table if not exists public.cert_submissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  name       text not null,
  provider   text,
  earned_at  text,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.cert_submissions enable row level security;

drop policy if exists "certsub own read"    on public.cert_submissions;
drop policy if exists "certsub own insert"  on public.cert_submissions;
drop policy if exists "certsub staff all"   on public.cert_submissions;

create policy "certsub own read" on public.cert_submissions for select
  using ((select auth.uid())::text = user_id);
create policy "certsub own insert" on public.cert_submissions for insert
  with check ((select auth.uid())::text = user_id and status = 'pending');
create policy "certsub staff all" on public.cert_submissions for all
  using ((select public.is_staff())) with check ((select public.is_staff()));

revoke select, insert, update, delete on public.cert_submissions from anon;

-- ----------------------------------------------------------------------------
-- Column guard: include the new staff-managed columns
-- ----------------------------------------------------------------------------
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
    new.upskilling           := '[]'::jsonb;
    new.performance_reports  := '[]'::jsonb;
    return new;
  end if;
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
  new.upskilling           := old.upskilling;
  new.performance_reports  := old.performance_reports;
  return new;
end $$;
