// moodle-grades — Supabase Edge Function (Deno)
//
// Returns the signed-in student's Moodle course grades. The Moodle token
// lives ONLY here (never in the app bundle).
//
// Secrets to set:
//   MOODLE_BASE_URL       — e.g. https://moodle.redalphacyber.com
//   MOODLE_TOKEN          — web-service token (see _docs/MOODLE_SETUP.md)
//   MOODLE_PASSING_GRADE  — optional, default 50
//
// Deploy: supabase functions deploy moodle-grades
// Response: { scores: MoodleCourseScore[] } or { error }

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BASE = (Deno.env.get("MOODLE_BASE_URL") ?? "").replace(/\/+$/, "");
const TOKEN = Deno.env.get("MOODLE_TOKEN") ?? "";
const PASSING = Number(Deno.env.get("MOODLE_PASSING_GRADE") ?? "50") || 50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function moodle(wsfunction: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ wstoken: TOKEN, wsfunction, moodlewsrestformat: "json", ...params });
  const res = await fetch(`${BASE}/webservice/rest/server.php?${qs}`);
  const data = await res.json();
  if (data?.exception) throw new Error(`${wsfunction}: ${data.message ?? data.errorcode}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!BASE || !TOKEN) return json({ error: "Moodle is not configured yet (MOODLE_* secrets missing).", scores: [] }, 200);

  // Identify the caller from their Supabase session
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: u, error: uerr } = await sb.auth.getUser();
  const email = u?.user?.email?.toLowerCase();
  if (uerr || !email) return json({ error: "Not signed in." }, 401);

  try {
    // 1. Moodle user id by email
    const users = await moodle("core_user_get_users_by_field", { field: "email", "values[0]": email });
    const moodleUser = Array.isArray(users) ? users[0] : undefined;
    if (!moodleUser?.id) return json({ scores: [], note: `No Moodle account found for ${email}.` });

    const uid = String(moodleUser.id);

    // 2. Enrolled courses (names + completion progress where enabled)
    const courses = await moodle("core_enrol_get_users_courses", { userid: uid });

    // 3. Overview grades per course
    let gradeByCourse: Record<string, number | null> = {};
    try {
      const overview = await moodle("gradereport_overview_get_course_grades", { userid: uid });
      for (const g of overview?.grades ?? []) {
        const n = parseFloat(String(g.grade).replace(/[^\d.]/g, ""));
        gradeByCourse[String(g.courseid)] = Number.isFinite(n) ? n : null;
      }
    } catch { /* report may be disabled; grades stay null */ }

    const scores = (Array.isArray(courses) ? courses : []).map((c: any) => ({
      courseId: String(c.id),
      courseName: c.fullname ?? c.shortname ?? `Course ${c.id}`,
      grade: gradeByCourse[String(c.id)] ?? 0,
      passingGrade: PASSING,
      lastUpdated: new Date((c.lastaccess ? c.lastaccess * 1000 : Date.now())).toISOString(),
      completedActivities: typeof c.progress === "number" ? Math.round(c.progress) : 0,
      totalActivities: typeof c.progress === "number" ? 100 : 0, // progress is a %, shown as n/100
    }));

    return json({ scores });
  } catch (e) {
    return json({ error: (e as Error).message, scores: [] }, 200);
  }
});
