# Red Alpha Companion — Security Review (pre-integration)

Static review of the current client-only build. Many real attack surfaces only exist once
the backend is connected, so this also defines the **pen-test plan to run post-integration**.

## Severity legend: 🔴 critical · 🟠 high · 🟡 medium · 🟢 info

## Findings (current code)

🔴 **Moodle API token exposed in client config.**
`app.json > expo.extra.moodleApiToken` ships inside the app bundle and is readable by anyone.
Fix before any real token is used: remove it; call Moodle only from a server/Edge Function
(roadmap Phase 5). Treat the placeholder as already-burned.

🟠 **Role is inferred from email pattern.**
`AuthContext.inferRoleFromEmail` decides staff vs student by regex. A user who controls their
email/display could escalate. Replace with an authoritative claim (Entra group/app-role) or a
server-side staff allowlist before launch.

🟠 **No backend authorization yet.**
All data is local/mock. The entire security model will rest on Supabase **Row Level Security**.
Acceptance: every table has RLS ON with explicit policies; verify with two different user
tokens that cross-user reads/writes are denied.

🟡 **Client-side persistence of records (localStorage).**
`managementApi`/`profileApi` store roster/placement edits in browser storage for the demo.
It's not sensitive mock data, but on shared machines it persists. Once Supabase is wired,
this becomes a cache only; clear it on sign-out.

🟢 **SVG injection surface — mitigated.**
Charts/icons build SVG strings, but all dynamic values are passed through
`encodeURIComponent` into `data:` URIs and rendered via `<Image>`, not `dangerouslySetInnerHTML`.
No user-supplied HTML is rendered. Keep it that way (don't interpolate raw user text into SVG).

🟢 **CV download is a local Blob** in demo mode (no network), safe. Post-integration it should
open a short-lived Supabase **signed URL**, never a public bucket URL.

🟢 **Secrets hygiene.** `.env.example` added; only `EXPO_PUBLIC_*` values may reach the client.
Service-role / Moodle keys must be EAS secrets or server-side only.

## Hardening to add before launch
- **Content Security Policy** on the web host (restrict `script-src`, allow `fonts.googleapis.com`/
  `fonts.gstatic.com` and Supabase origins; `img-src 'self' data:` for the SVG/data URIs).
- **HTTPS/HSTS** (automatic on EAS Hosting / Netlify).
- **Dependency audit**: `npm audit --production` in CI; patch highs before release.
- **Error logging**: wire Sentry in `src/components/ErrorBoundary.tsx` (currently console only).
- **Supabase**: SSL enforcement, network restrictions, account MFA, rate limiting on auth.

## Pen-test plan (run AFTER the backend is connected)
1. **AuthZ / RLS**: with a student token, attempt to read/update another student's row and any
   staff-only table (placements of others, all announcements write). Expect 403/empty.
2. **Privilege escalation**: try to flip own `role`/`lifecycle_stage` via direct REST calls.
3. **Storage**: attempt to fetch another user's CV by guessing the path without a signed URL.
4. **JWT handling**: tampered/expired token replay; confirm rejection.
5. **Injection**: SQLi attempts through filter params (Supabase parameterizes, but verify any
   custom Edge Function); XSS via announcement title/body (confirm rendered as text).
6. **Moodle proxy**: confirm the token never appears in network traffic or the JS bundle
   (`grep` the built `dist/`), and the function validates the caller.
7. **Rate limiting / abuse**: hammer auth + write endpoints; confirm throttling.

Use OWASP ZAP/Burp against the deployed URL for an automated pass, then the manual cases above.

Sources:
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://supabase.com/docs/guides/auth/oauth-server/token-security
