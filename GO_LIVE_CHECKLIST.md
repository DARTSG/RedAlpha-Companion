# Red Alpha Companion — Go-Live Checklist

This is the short, human-facing version. The detailed, AI-executable plan is in
`OPERATIONAL_ROADMAP.md`. The app is currently **fully functional on mock/local data** —
what remains is wiring real integrations and hosting.

## What's already done (functionality)
- Staff web portal: Students (placement history, bond tracking with bench-pause, CV download,
  expandable detail), Dashboard, Growth analytics, News (post + Community/Announcements),
  Manage (cohorts + weekly syllabus + upskilling courses).
- Write operations persist locally (browser storage) via `src/data/managementApi.ts`, so the
  whole workflow is demoable today.
- Student app reads the same cohorts/courses/announcements staff create.
- Crash-safe (error boundary), responsive, animated, accessible-leaning UI.

## What YOU need to do to go operational (in order)

1. **Create a Supabase project** (~15 min)
   - Copy `.env.example` → `.env`; fill `EXPO_PUBLIC_SUPABASE_URL` and
     `EXPO_PUBLIC_SUPABASE_ANON_KEY` (use the new `sb_publishable_...` key).
   - Run the SQL in `supabase-schema.sql`; confirm tables match `src/types/index.ts`.
   - **Enable Row Level Security on every table** and add the policies (students = own row,
     staff = all). This is the #1 production requirement.
   - Turn on SSL enforcement; enable MFA on your Supabase account.

2. **Set up Microsoft sign-in** (~30 min)
   - Register an Entra (Azure AD) app; add web + `bootcampcompanion://auth` redirect URIs.
   - Put `azureAdClientId` / `azureAdTenantId` in config.
   - Decide how "staff" is determined (Entra group/role or a staff allowlist) — do NOT keep
     the current email-pattern guess for production.

3. **Move Moodle behind a server** (security-critical)
   - The Moodle API token must NOT ship in the app. Create a Supabase Edge Function that
     holds the token and returns grades. (See roadmap Phase 5.)

4. **CV storage**
   - Create a private `cvs` storage bucket with owner-write / staff-read policies.

5. **Deploy**
   - Web: `npx expo export -p web` then host `dist/` on EAS Hosting or Netlify
     (SPA redirect all routes → `/index.html`).
   - Mobile: EAS Build for iOS/Android.

6. **Before launch**
   - Run `npm audit`; add an error logger (Sentry) in `ErrorBoundary`.
   - Work through `SECURITY_REVIEW.md`.

## How we'll work
Tell me when you've created the Supabase project + keys, and I'll wire the data layer
(it's isolated to `src/data/api.ts`, `src/data/profileApi.ts`, `src/data/managementApi.ts`)
so the same UI runs on real data with no redesign.

Sources for the practices above:
- https://docs.expo.dev/deploy/web/
- https://supabase.com/docs/guides/deployment/going-into-prod
