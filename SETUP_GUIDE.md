# Bootcamp Companion — Setup & Integration Guide

This is a working prototype of a single codebase (React Native + Expo) that runs on
**iOS, Android, and the web**. It currently runs on realistic mock data so you can
explore every screen immediately. This guide covers: running it, replacing mock data
with your real systems, and getting it onto phones / the web.

---

## 1. Running the app

You'll need [Node.js](https://nodejs.org) (LTS) installed on your computer.

```bash
cd bootcamp-companion        # the folder containing this file
npm install                  # first time only — installs dependencies
npx expo start               # starts the dev server
```

This opens a QR code in your terminal/browser:

- **On your phone**: install the free "Expo Go" app (App Store / Play Store), then scan the QR code.
- **In a browser**: press `w` in the terminal, or run `npm run web`.
- **iOS Simulator / Android Emulator**: press `i` or `a` (requires Xcode / Android Studio installed).

On first launch, tap **"Continue as demo student"** or **"Continue as demo staff"** to explore
both sides of the app without setting up Microsoft sign-in yet.

---

## 2. Connecting "Sign in with Microsoft" (Azure AD / Entra ID)

The app already has a working Microsoft sign-in screen — it just needs two values from
your organization's Microsoft 365 admin.

**Ask your IT/Microsoft 365 admin to:**

1. Go to **Azure Portal → Microsoft Entra ID → App registrations → New registration**
2. Name it something like "Bootcamp Companion"
3. Under **Supported account types**, choose "Accounts in this organizational directory only"
   (or "any organizational directory" if students/staff might be on different tenants)
4. Under **Redirect URI**, add a **Web** platform redirect URI. For Expo apps this is typically:
   - For testing in Expo Go: `https://auth.expo.io/@your-expo-username/bootcamp-companion`
   - For a published app: `bootcampcompanion://auth` (the custom scheme already set in `app.json`)
   - For the web build: your deployed web URL + `/auth` (e.g. `https://app.yourbootcamp.sg/auth`)
5. Under **API permissions**, add Microsoft Graph **delegated** permissions: `openid`, `profile`,
   `email`, `User.Read`
6. Copy the **Application (client) ID** and **Directory (tenant) ID**

**Then, in `app.json`**, replace the placeholder values:

```json
"extra": {
  "azureAdClientId": "paste-the-application-client-id-here",
  "azureAdTenantId": "paste-the-directory-tenant-id-here"
}
```

That's it — the "Sign in with Microsoft" button will start working, and signed-in users'
names/emails will come from their real Microsoft 365 accounts (`src/auth/AuthContext.tsx`).

**Staff vs. student detection:** right now the app guesses the role from the email address
(anything containing `@staff.`, `@team.`, or starting with `staff@` is treated as staff — see
`inferRoleFromEmail` in `src/auth/AuthContext.tsx`). Once you have a real backend, you'll likely
want to instead look the signed-in user up in your student/staff database, or use Azure AD
group membership / app roles. Either is a small change to that one function.

---

## 3. Connecting to Moodle (scores & statistics)

**Ask your Moodle administrator to:**

1. Go to **Site administration → Server → Web services → External services**, and enable
   web services + REST protocol
2. Create (or use an existing) service that exposes these functions at minimum:
   - `core_grades_get_grades` or `gradereport_user_get_grade_items` (grades)
   - `core_completion_get_activities_completion_status` (activity completion)
   - `core_user_get_users_by_field` (to map a Microsoft email to a Moodle user ID)
3. Generate a **web service token** for a dedicated service account (not a personal account)
4. Share the Moodle base URL and token with whoever sets up the backend (see step 4 below)

**Important:** never put this token directly in the mobile app — anyone could extract it from
the app binary and access all your Moodle data. It belongs on a server (your backend), which
the app talks to instead. That's why `app.json` has placeholders for it but the API layer
(`src/data/api.ts`) is written to call *your backend*, not Moodle directly.

---

## 4. The backend (the missing piece)

Right now, all data (schedule, scores, announcements, stats, staff dashboards) comes from
`src/data/mockData.ts`. To go live, you need a small backend that:

- Validates the Microsoft access token the app sends (e.g., calls Microsoft Graph `/me`)
- Looks up the matching student/staff record in your database
- Calls Moodle's web service API (using the server-side token from step 3) and returns
  normalized JSON in the shapes already defined in `src/types/index.ts`
- Lets staff post announcements, record placement/certification info, etc.
- Optionally sends push notifications via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)
  when new announcements are posted

**Keeping this simple:** you don't need to build a backend from scratch. Managed options that
get you a database + API + auth helpers quickly, with minimal ops overhead:

- **Supabase** (Postgres + auto-generated APIs + auth) — generous free tier, popular with small teams
- **Firebase** (Firestore + Cloud Functions) — good if you want Google's ecosystem
- A lightweight custom API (e.g. Node/Express or Python/FastAPI) on a host like Railway, Render,
  or Fly.io, talking to a Postgres database

Whichever you choose, **only one file needs to change** once it exists: `src/data/api.ts`.
Each function there is already shaped like a real API call (commented-out examples included);
swap the mock-data line for a real `fetch(...)` to your backend and the rest of the app — every
screen, loading state, and chart — keeps working unchanged.

---

## 5. Push notifications for announcements

The notification plumbing is already wired up in `src/notifications/useAnnouncementNotifications.ts`:

- It requests notification permission and registers an Expo push token on launch
- It fires a local notification whenever a newly-pinned announcement appears (so you can demo
  the full experience right now, using only mock data)

To send **real** push notifications when staff post announcements:

1. Have the app send the registered Expo push token to your backend (store it against the user)
2. Have your backend call the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)
   whenever a new announcement is created

No changes are needed to the screens — real pushes will simply arrive via the same channel.

---

## 6. Publishing to app stores & the web

This is the stage that requires developer accounts and signing — typically a one-time setup:

- **iOS**: requires an [Apple Developer Program](https://developer.apple.com/programs/) membership (paid, ~US$99/yr)
- **Android**: requires a [Google Play Console](https://play.google.com/console/) account (one-time ~US$25 fee)
- **Web**: no special account needed — `npx expo export --platform web` produces a static site
  you can host anywhere (Vercel, Netlify, Cloudflare Pages, your own server)

[Expo Application Services (EAS)](https://docs.expo.dev/eas/) (`eas build`, `eas submit`) handles
building signed binaries and submitting them to both stores from the same codebase, without
needing a Mac for iOS builds. Their free tier covers light usage; paid plans remove queue waits.

---

## 7. Where things live (quick reference)

| What | File |
|---|---|
| App-wide colors, spacing, fonts | `src/theme.ts` |
| Mock data (replace via step 4) | `src/data/mockData.ts` |
| API layer — the ONE file to change for real data | `src/data/api.ts` |
| Microsoft sign-in & session handling | `src/auth/AuthContext.tsx` |
| Login screen | `src/screens/LoginScreen.tsx` |
| Student screens | `src/screens/student/` |
| Staff screens | `src/screens/staff/` |
| Tab navigation (role-based) | `src/navigation/RootNavigator.tsx` |
| Push notification logic | `src/notifications/useAnnouncementNotifications.ts` |
| Branding / config (app name, icons, Azure/Moodle keys) | `app.json` |

---

## 8. Suggested next steps

1. Run the app locally and click through both the student and staff demo accounts
2. Get the Azure AD client ID + tenant ID from your IT admin (step 2) and test real sign-in
3. Get a Moodle web service token from your Moodle admin (step 3)
4. Pick a backend approach (step 4) — Supabase is the fastest path for a small team
5. Replace placeholder branding (colors in `theme.ts`, name/icons in `app.json`)
6. Once happy, set up EAS (step 6) to get it onto phones and published to app stores
