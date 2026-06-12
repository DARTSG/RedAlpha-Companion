// invite-email — Supabase Edge Function (Deno)
//
// Sends an invitation email when an admin invites a staff member.
// Uses Microsoft Graph sendMail with the SAME daemon app as sharepoint-upload
// (add the Graph *application* permission Mail.Send + admin consent, and set
// SP_SENDER_UPN to the mailbox to send from, e.g. noreply@redalphacyber.com).
//
// Secrets: SP_TENANT_ID, SP_CLIENT_ID, SP_CLIENT_SECRET (shared), SP_SENDER_UPN,
//          APP_URL (e.g. https://dartsg.github.io/RedAlpha-Companion/),
//          ALLOWED_ORIGINS (optional CORS lockdown)
//
// Request (POST, admin JWT): { email, name?, role }
// Response: { sent: true } or { error }

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TENANT = Deno.env.get("SP_TENANT_ID") ?? "";
const CLIENT_ID = Deno.env.get("SP_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("SP_CLIENT_SECRET") ?? "";
const SENDER = Deno.env.get("SP_SENDER_UPN") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://dartsg.github.io/RedAlpha-Companion/";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED.length === 0 ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };
}
let cors: Record<string, string> = {};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function graphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "Graph auth failed");
  return data.access_token;
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SENDER) {
    return json({ error: "Email sending not configured yet (SP_*/SP_SENDER_UPN secrets missing)." }, 503);
  }

  // Caller must be an ACTIVE ADMIN
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const callerEmail = u?.user?.email?.toLowerCase();
  if (!callerEmail) return json({ error: "Not signed in." }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row } = await admin.from("staff_members").select("role,status").ilike("email", callerEmail).maybeSingle();
  if (!row || row.role !== "admin" || row.status !== "active") return json({ error: "Admins only." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "staff";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Invalid email" }, 400);

  try {
    const token = await graphToken();
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px">
        <h2 style="color:#DC2626">Red Alpha Companion</h2>
        <p>Hi ${escapeHtml(name || email)},</p>
        <p>You've been invited to the Red Alpha Companion staff portal as <b>${role}</b>.</p>
        <p>Sign in with your Microsoft work account — your access activates automatically on first sign-in:</p>
        <p><a href="${APP_URL}" style="background:#DC2626;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the portal</a></p>
        <p style="color:#888;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
      </div>`;
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: "You're invited to Red Alpha Companion",
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: email } }],
        },
        saveToSentItems: false,
      }),
    });
    if (res.status !== 202) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `sendMail failed (${res.status})`);
    }
    return json({ sent: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
