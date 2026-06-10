# Red Alpha Companion — Operational Roadmap

> **Audience: an AI coding agent (e.g. a future Claude/Cowork session).**
> This document is the single source of truth for taking the app from a mock-data
> prototype to a production system. Work top-to-bottom. Each phase is self-contained,
> lists the exact files to touch, atomic tasks, and machine-checkable acceptance criteria.
> Do not start a later phase until the earlier phase's acceptance criteria pass.

---

## 0. Operating conventions (read first, every session)

These are hard rules for editing this repo. Violating them causes silent corruption.

1. **File writes (Windows host):** The host is Windows; the IDE Edit/Write tools append
   null bytes and truncate `.tsx` files. **Always write files via bash heredoc**:
   ```bash
   cat > "/path/to/file.tsx" << 'EOF'
   ...content...
   EOF
   ```
   For surgical edits use a Python `str.replace` script run through bash. Verify each
   replacement count before writing (assert exactly N matches).
2. **Type check after every change** (filter out known Linux-mount false positives):
   ```bash
   npx tsc --noEmit 2>&1 | grep -v "TS7016\|TS2307.*react-native\|TS2307.*expo\|TS2307.*@react-navigation\|TS2307.*safe-area" | grep "error TS"
   ```
   Empty output = pass.
3. **Never commit secrets.** All keys live in environment / `app.json > expo.extra`,
   never hard-coded. `EXPO_PUBLIC_*` vars are safe for client; service-role keys are NOT
   and must never ship in the app bundle.
4. **The integration seam is small. Do not rewrite UI to add a backend.** Three files
   isolate all I/O:
   - `src/data/api.ts` — read endpoints (currently return mock data via `delay()`).
   - `src/data/profileApi.ts` — profile/placement writes + CV upload (already dual-mode:
     Supabase when configured, local fallback otherwise).
   - `src/auth/AuthContext.tsx` — authentication (Azure AD wired, demo fallback).
   Keep every exported **function signature identical**; only swap the implementation.
5. **Platform guards:** web-only code is gated by `Platform.OS === 'web'`. The staff
   web dashboard lives entirely in `src/navigation/StaffWebPortal.tsx`.

---

## 1. Current state (as of this writing)

- **Frontend:** React Native + Expo SDK 54, TypeScript, React Navigation. Runs on iOS,
  Android, and Web.
- **Data:** 100% mock (`src/data/mockData.ts`). `api.ts` returns it with a simulated delay.
- **Auth:** `AuthContext` supports Microsoft (Azure AD via `expo-auth-session`) and demo
  logins. Falls back to demo when `azureAdClientId` is unset.
- **Persistence:** `profileApi.ts` already speaks Supabase when `isSupabaseConfigured`
  (see `src/lib/supabase.ts`); otherwise uses `expo-secure-store` / `localStorage`.
- **Supabase schema:** a starter `supabase-schema.sql` exists at repo root.
- **Staff web portal:** full dashboard (Students, Dashboard, Growth, News) with charts,
  filters, expandable rows, CV download, cross-tab navigation. All driven by mock data.

**Definition of "operational":** real authenticated users; data persisted in a real
backend; staff edits durable and multi-device; student grades from Moodle; CVs stored
securely; bond/placement alerts delivered; deployable web + mobile builds.

---

## 2. Configuration inventory

All config flows through `app.json > expo.extra` and `process.env` (`EXPO_PUBLIC_*`).

| Key | Where | Purpose | Status |
|-----|-------|---------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | env | Supabase project URL | to set |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | env | Supabase anon key (client-safe) | to set |
| `azureAdClientId` | `expo.extra` | Microsoft Entra app client id | placeholder |
| `azureAdTenantId` | `expo.extra` | Entra tenant id | placeholder |
| `moodleBaseUrl` | `expo.extra` | Moodle web-service endpoint | placeholder |
| `moodleApiToken` | `expo.extra` | Moodle token — **move server-side** | placeholder |
| `apiBaseUrl` | `expo.extra` | optional REST backend base | unused |

> Verify `src/lib/supabase.ts` exposes `isSupabaseConfigured` and `getSupabaseClient()`.
> If missing, create it before Phase 3.

---

## 3. Phased plan

### Phase 1 — Supabase backend (data persistence foundation)
**Goal:** a live database matching the app's types, with row-level security.

**Files:** `supabase-schema.sql`, `src/lib/supabase.ts`, `.env` / `app.json`.

**Tasks:**
1. Create a Supabase project; set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Review `supabase-schema.sql` against `src/types/index.ts`. Ensure tables:
   `student_profiles` (matches columns used in `profileApi.ts`: `user_id, full_name,
   email, date_of_birth, cohort_id, cohort_name, lifecycle_stage, placement_company,
   placement_role, reporting_officer, ro_email, bond_end_date, cv_url, cv_filename,
   created_at, updated_at`), `cohorts`, `certifications` (FK `student_id`), `announcements`,
   `cohort_growth`.
3. Add RLS policies: students read/write **only their own** `student_profiles` row;
   staff (role claim) read/write all. Certifications readable by owner + staff.
4. Seed `cohorts`, `announcements`, `cohort_growth`, and a few `student_profiles` from
   `mockData.ts` so the UI has content immediately.

**Acceptance:** `isSupabaseConfigured === true` at runtime; a manual insert via the
Supabase dashboard appears when the relevant `getAllStudents` path is exercised; RLS
blocks cross-user reads (verify with two tokens).

---

### Phase 2 — Authentication (real identities + roles)
**Goal:** Microsoft sign-in returns a real user with a correct `role`.

**Files:** `src/auth/AuthContext.tsx`, `app.json`.

**Tasks:**
1. Register an Entra app; set `azureAdClientId` / `azureAdTenantId`. Add redirect URIs
   for web and the `bootcampcompanion://auth` scheme.
2. After token exchange, fetch the user profile (Microsoft Graph `/me`) and map to
   `AuthenticatedUser`. Replace the email-regex role inference (`inferRoleFromEmail`)
   with an authoritative source: Entra group/app-role claim, or a `staff` allowlist
   table in Supabase.
3. Persist session (already via `SESSION_STORAGE_KEY`); ensure `accessToken` is the
   token used for Supabase RLS (configure Supabase third-party auth / JWT, or exchange
   for a Supabase session).

**Acceptance:** signing in with a staff account routes to `StaffWebPortal` (web) /
`StaffTabs` (mobile); a student account routes to the student flow; `user.role` is set
from a trusted claim, not the email pattern.

---

### Phase 3 — Wire read endpoints to Supabase
**Goal:** `api.ts` returns live data; delete reliance on `mockData` at runtime.

**Files:** `src/data/api.ts` only (signatures unchanged).

**Tasks (per function, keep return types identical):**
1. `fetchStaffStudentRoster` → query `student_profiles` + join `certifications`. (Note:
   `getAllStudents` in `profileApi.ts` already implements the Supabase query shape; reuse it.)
2. `fetchCohortGrowth` → query `cohort_growth` ordered by year.
3. `fetchAnnouncements` → query `announcements` ordered by `posted_at desc`.
4. `fetchStudentStats` → derive per-logged-in-student from profile + certifications.
5. `fetchCohorts` → query `cohorts`.
6. Keep `delay()` only as a dev toggle; gate real vs mock on `isSupabaseConfigured`.

**Acceptance:** with Supabase configured, every staff tab renders DB data; with it unset,
the app still runs on mocks (no regressions). `tsc` clean.

---

### Phase 4 — CV vault (secure file storage)
**Goal:** real CV upload/download, replacing the demo placeholder generator.

**Files:** `src/data/profileApi.ts` (already has `uploadCV` for Supabase storage),
`src/navigation/StaffWebPortal.tsx` (`downloadCV`), `src/screens/student/*` upload UI.

**Tasks:**
1. Create a private Supabase storage bucket `cvs` with RLS (owner write; staff read).
2. Confirm `uploadCV` path + signed-URL logic; wire student onboarding/profile upload to it.
3. In `StaffWebPortal.downloadCV`, when `s.cvUrl` is present, open the signed URL; remove
   the generated-text fallback once real CVs exist (keep behind `isSupabaseConfigured`).
4. Persist `cv_url` / `cv_filename` on `student_profiles`.

**Acceptance:** a student uploads a PDF; staff downloads the exact file via signed URL;
direct bucket access without a token is denied.

---

### Phase 5 — Moodle grades integration
**Goal:** real grade data in the student Grades screen and grade analytics.

**Files:** new `supabase/functions/moodle-sync` (Edge Function) or a server proxy;
`src/data/api.ts` (`fetchMoodleScores`).

**Tasks:**
1. **Do not call Moodle from the client** (token must stay server-side). Create a
   Supabase Edge Function that holds `moodleApiToken`, calls Moodle web services
   (`core_grades_*`), and returns normalized `MoodleCourseScore[]`.
2. Point `fetchMoodleScores` at the Edge Function.
3. (Optional) cache results in a `moodle_scores` table for trend analytics.

**Acceptance:** Grades screen shows real scores; the Moodle token never appears in the
client bundle (grep the web build to confirm).

---

### Phase 6 — Notifications & bond/placement alerts
**Goal:** automated alerts at 90/30/7 days before `bond_end_date`.

**Files:** new Supabase scheduled function; `expo-notifications` (already a plugin);
optionally a "Needs Attention" deep link in `StaffWebPortal`.

**Tasks:**
1. Scheduled (cron) Edge Function: daily scan `student_profiles` for upcoming bond ends;
   send push (Expo push tokens) and/or email to staff + student.
2. Store device push tokens on login.
3. Surface the same data in-app (the dashboard "Needs Attention" card already computes
   bond-ending ≤180 days — reuse the logic server-side).

**Acceptance:** a record with `bond_end_date` 7 days out triggers exactly one alert.

---

### Phase 7 — New product features (build on the live backend)
Prioritized; each needs a table + UI. Keep the `api.ts`/`profileApi.ts` seam pattern.

1. **Job application tracker** — table `job_applications` (`student_id, company, role,
   applied_on, status`). Student logs apps; staff get a pipeline view (new card/tab).
2. **Interview feedback log** — table `interview_notes` (`student_id, company, date,
   author, notes`). Staff-only.
3. **Targeted announcements** — extend `announcements` with `target_stage` / `target_cohort`;
   filter in `fetchAnnouncements` by the viewer.
4. **Grade trend analytics** — time-series from cached Moodle scores.
5. **Sortable + CSV-export tables** in `StaffWebPortal` (client-only; no backend needed).

**Acceptance per feature:** data persists; RLS correct; `tsc` clean; UI matches the
existing design tokens in `StaffWebPortal.tsx` (palette `C`, `Card`, `KpiCard`, `Icon`).

---

### Phase 8 — Testing, CI, deployment
**Tasks:**
1. Add unit tests for `api.ts` / `profileApi.ts` mappers (mock the Supabase client).
2. Add a smoke test that renders each staff page with seeded data (catches hook-order
   regressions like the one fixed in `WebDashboard`).
3. CI: run `tsc --noEmit` + tests on PR.
4. Web deploy: `npx expo export -p web` → host the static `dist/`. Mobile: EAS Build.
5. Move `moodleApiToken` out of `app.json` into server-side secrets before any release.

**Acceptance:** green CI; a deployed web URL loads the portal against the live backend.

---

## 4. Data model quick reference
Authoritative types live in `src/types/index.ts`. Key entities and their DB tables:
`StaffStudentRecord`/`StudentProfile` → `student_profiles`; `Certification` →
`certifications`; `Announcement` → `announcements`; `CohortGrowthPoint` → `cohort_growth`;
`Cohort` → `cohorts`; `MoodleCourseScore` → Moodle (proxied). When adding fields, update
the type first, then the DB column, then the mapper in `api.ts`/`profileApi.ts`.

## 5. Sequence summary (dependency order)
Phase 1 (DB) → Phase 2 (Auth) → Phase 3 (reads) → Phase 4 (CV) → Phase 5 (Moodle) →
Phase 6 (alerts) → Phase 7 (features) → Phase 8 (ship). Phases 4–7 can parallelize after
3 is stable.
