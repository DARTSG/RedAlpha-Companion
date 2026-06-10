# Red Alpha Companion — This Week's Plan (action-ordered)

Your plan is solid and the order is right. Below it's broken into **(a) things you can start
RIGHT NOW** (accounts + portals — these have lead time) and **(b) the wiring I do after.**

## Roles (built today — try it now)
Three roles now exist: **Admin / Staff / Student**.
- Sign in screen has a new **Admin** demo button.
- **Admin** sees a new **Users** tab: invite people by email, set each as Admin or Staff,
  mark invites as joined, remove people. Admin decides who is admin/staff.
- **Staff** see the whole staff portal and can control students (stage, **cohort**, **DOB**,
  placements, bond, CV download). They do NOT see the Users tab.
- **Student** see the student side only.
Invites + roles persist locally for the demo; once Microsoft auth + Supabase are wired,
"accept invite" becomes real (they join when they sign in with that email).

---

## ⏩ Do these NOW (long lead time, all yours)

1. **Create the Supabase project** → copy Project URL + publishable key into `.env`
   (template in `.env.example`). 10 min. This unblocks all data wiring.
2. **Register the Microsoft Entra app** (steps below). 20 min.
3. **Create a GitHub repo** and push this code (`.gitignore` already excludes `node_modules`;
   add `.env`). 10 min.
4. **Create the store/build accounts** (approval takes days, so start early):
   - Expo account at expo.dev (free) — for EAS builds.
   - Apple Developer Program ($99/yr) — required for iOS.
   - Google Play Developer ($25 once) — required for Android.

When #1 and #2 are done, send me the keys/IDs and I'll do the wiring.

---

## 1. Microsoft (Entra ID) auth — step by step
1. portal.azure.com → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it `Red Alpha Companion`. Account type: **Single tenant** (just your org) is simplest.
3. **Redirect URIs**:
   - Platform **Single-page application (SPA)**: add `http://localhost:8081` (dev) and your
     hosted web URL (e.g. `https://<you>.github.io/red-alpha/`).
   - Platform **Mobile and desktop**: add `bootcampcompanion://auth`.
4. Copy the **Application (client) ID** and **Directory (tenant) ID**.
5. **API permissions** → Microsoft Graph → Delegated → `openid`, `profile`, `email`,
   `User.Read` → **Grant admin consent**.
6. **Roles** (so Admin/Staff is trustworthy): App registration → **App roles** → create
   `Admin` and `Staff`; then Enterprise applications → your app → **Users and groups** →
   assign people to a role. (Alternatively use security groups.)
7. Put `azureAdClientId` + `azureAdTenantId` in config and tell me.
8. **I then finish**: token exchange, fetch `/me`, and map the **roles claim → app role**
   (replacing the email-pattern guess). Also wire the Supabase session so RLS works.

## 2. Moodle — (you'll send the breakdown)
Reminder: the Moodle token must live **server-side** (Supabase Edge Function), never in the
app. When you send the API details I'll build the function + connect the Grades screen.

## 3. Testing
After auth + data are live: I run type-check + workflow tests, then we test all three roles
end to end (invite → accept → permissions). Plus the pen-test plan in `SECURITY_REVIEW.md`.

## 4. Hosting + cert via GitHub — my take
**Yes, GitHub works well for the web app**, and the cert is automatic:
- **GitHub Pages** hosts the static web export for free, with **auto HTTPS/cert** and custom
  domains. Good fit since the backend is Supabase (Pages only serves the frontend).
- Steps: set `expo.web.output: "single"`; add a GitHub Action that runs
  `npx expo export -p web` and publishes `dist/`; copy `index.html` → `404.html` for SPA
  routing; Settings → Pages → deploy from the Action. Point the Entra redirect URI + Supabase
  allowed URLs at the Pages URL.
- Caveat: GitHub hosts only the **web** app. The **mobile apps are not** hosted on GitHub —
  they go through EAS Build → App Store / Play Store (see #5).
- Alternatives (Vercel / Netlify / EAS Hosting) handle SPA redirects with zero config and are
  also free-tier — any is fine. I'd start with GitHub Pages to keep everything in one place,
  and I can set up the Action for you.

## 5. Android & iOS apps (EAS)
1. `npm i -g eas-cli` → `eas login`.
2. `eas build:configure`.
3. Android test build: `eas build -p android --profile preview` (installable APK).
4. iOS build: `eas build -p ios` (needs the Apple Developer account).
5. Store submit: `eas submit -p android` / `eas submit -p ios`.
The same codebase builds web + iOS + Android — no separate rewrite.

## 6. Final QA + Pen test
Work through `SECURITY_REVIEW.md` (RLS checks, role escalation, storage access, Moodle proxy
secrecy), run an automated OWASP ZAP pass on the deployed URL, fix findings.

## 7. Done?
Essentially yes. "Operational" = Supabase wired (Phase 1–4 of `OPERATIONAL_ROADMAP.md`) +
Microsoft auth + Moodle proxy + deployed. After that it's maintenance and feature iteration.

### Fastest path: do the 4 "NOW" items above; ping me after Supabase + Entra are created.
