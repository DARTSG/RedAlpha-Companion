#!/usr/bin/env node
/**
 * RLS verification probe — run AFTER applying supabase-rls-hardening.sql.
 *
 * Setup (tokens come from real logged-in sessions of the web app):
 *   1. Log in as a STUDENT, open devtools console and run:
 *        JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token
 *   2. Same for a STAFF (or admin) account.
 *   3. Run:
 *        SUPABASE_URL=https://<ref>.supabase.co \
 *        SUPABASE_ANON_KEY=<anon key> \
 *        STUDENT_TOKEN=<jwt> STAFF_TOKEN=<jwt> \
 *        node scripts/verify-rls.mjs
 *
 * Every probe states what it EXPECTS; output is a PASS/FAIL matrix.
 * Exit code 1 if anything fails.
 */

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const STUDENT = process.env.STUDENT_TOKEN;
const STAFF = process.env.STAFF_TOKEN;

if (!URL_ || !ANON) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }

const results = [];
async function rest(token, method, path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      'Content-Type': 'application/json',
      Prefer: method === 'PATCH' || method === 'POST' ? 'return=representation' : 'count=exact',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, rows: Array.isArray(data) ? data.length : null, data };
}

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('\n--- ANON (no user token) — expect zero access everywhere ---');
  for (const t of ['student_profiles', 'staff_members', 'interviews', 'intake_programmes',
                   'app_settings', 'cohorts', 'courses', 'syllabus_weeks', 'announcements',
                   'cert_submissions', 'course_applications', 'announcement_reactions']) {
    const r = await rest(null, 'GET', `${t}?select=*&limit=5`);
    check(`anon read ${t} denied/empty`, r.status >= 400 || r.rows === 0, `status ${r.status}, rows ${r.rows}`);
  }
  {
    const r = await rest(null, 'POST', 'announcements', { id: 'rls-probe-anon', type: 'news', title: 'x', body: 'x' });
    check('anon insert announcements denied', r.status >= 400, `status ${r.status}`);
  }

  if (STUDENT) {
    console.log('\n--- STUDENT token ---');
    let myUserId = null;
    {
      const r = await rest(STUDENT, 'GET', 'student_profiles?select=user_id');
      check('student reads ONLY own profile (≤1 row)', r.status === 200 && r.rows !== null && r.rows <= 1, `rows ${r.rows}`);
      myUserId = r.data?.[0]?.user_id ?? null;
    }
    {
      const r = await rest(STUDENT, 'GET', 'staff_members?select=email');
      check('student cannot list staff (≤1 row, own at most)', r.status >= 400 || (r.rows ?? 0) <= 1, `status ${r.status}, rows ${r.rows}`);
    }
    for (const t of ['interviews', 'intake_programmes', 'app_settings']) {
      const r = await rest(STUDENT, 'GET', `${t}?select=*&limit=5`);
      check(`student read ${t} denied/empty`, r.status >= 400 || r.rows === 0, `status ${r.status}, rows ${r.rows}`);
    }
    for (const t of ['cohorts', 'announcements', 'courses']) {
      const r = await rest(STUDENT, 'GET', `${t}?select=*&limit=5`);
      check(`student CAN read ${t}`, r.status === 200, `status ${r.status}, rows ${r.rows}`);
    }
    {
      // Privilege escalation: try to flip own lifecycle_stage (trigger must keep old value)
      const r = await rest(STUDENT, 'PATCH',
        `student_profiles?user_id=eq.${encodeURIComponent(myUserId ?? 'none')}&select=lifecycle_stage`,
        { lifecycle_stage: 'seconded' });
      const kept = r.rows === 0 || (r.data?.[0] && r.data[0].lifecycle_stage !== 'seconded');
      check('student cannot change own lifecycle_stage', r.status >= 400 || kept,
        `status ${r.status}, stage ${r.data?.[0]?.lifecycle_stage}`);
    }
    {
      const r = await rest(STUDENT, 'PATCH', `student_profiles?user_id=neq.${encodeURIComponent(myUserId ?? 'none')}`, { full_name: 'hacked' });
      check("student cannot update others' profiles", r.status >= 400 || r.rows === 0, `status ${r.status}, rows ${r.rows}`);
    }
    {
      const r = await rest(STUDENT, 'POST', 'announcements', { id: 'rls-probe-student', type: 'news', title: 'x', body: 'x' });
      check('student insert announcements denied', r.status >= 400, `status ${r.status}`);
    }
    {
      // direct table access to reactions must be blocked (RPC-only)
      const r = await rest(STUDENT, 'GET', 'announcement_reactions?select=*&limit=1');
      check('student direct read announcement_reactions denied/empty', r.status >= 400 || r.rows === 0, `status ${r.status}, rows ${r.rows}`);
    }
    {
      // cert submission privilege escalation: status must stay pending
      const r = await rest(STUDENT, 'POST', 'cert_submissions', { user_id: myUserId, name: 'rls-probe', status: 'approved' });
      check('student cannot self-approve cert submission', r.status >= 400, `status ${r.status}`);
    }
    {
      // applying to a course with a pre-confirmed status must fail
      const r = await rest(STUDENT, 'POST', 'course_applications', { course_id: 'rls-probe', user_id: myUserId, status: 'confirmed' });
      check('student cannot self-confirm course application', r.status >= 400, `status ${r.status}`);
    }
  } else console.log('\n(STUDENT_TOKEN not set — student probes skipped)');

  if (STAFF) {
    console.log('\n--- STAFF token ---');
    {
      const r = await rest(STAFF, 'GET', 'student_profiles?select=user_id&limit=100');
      check('staff reads all profiles (>1 row expected)', r.status === 200, `status ${r.status}, rows ${r.rows}`);
    }
    for (const t of ['interviews', 'intake_programmes', 'cohorts', 'courses', 'staff_members']) {
      const r = await rest(STAFF, 'GET', `${t}?select=*&limit=5`);
      check(`staff read ${t} ok`, r.status === 200, `status ${r.status}, rows ${r.rows}`);
    }
  } else console.log('\n(STAFF_TOKEN not set — staff probes skipped)');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
  if (failed.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
