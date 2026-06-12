// sharepoint-upload — Supabase Edge Function (Deno)
//
// Uploads a file to SharePoint via Microsoft Graph and returns its webUrl.
// The Graph credentials NEVER reach the client app.
//
// Secrets to set (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
//   SP_TENANT_ID      — Entra directory (tenant) ID
//   SP_CLIENT_ID      — app registration with Graph *application* permission
//                       Sites.Selected (granted on the target site) or Sites.ReadWrite.All
//   SP_CLIENT_SECRET  — client secret for that app
//   SP_SITE_ID        — Graph site id. Find it:
//                       GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{site-path}
//   SP_BASE_FOLDER    — optional root folder in the site's default drive (default "RedAlphaCompanion")
//
// Deploy: supabase functions deploy sharepoint-upload
//
// Request (POST, authenticated with the user's Supabase JWT):
//   { kind: 'cv'|'jd'|'performance-report'|'syllabus', ownerId, filename, mimeType, contentBase64 }
// Response: { url } or { error }

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TENANT = Deno.env.get("SP_TENANT_ID") ?? "";
const CLIENT_ID = Deno.env.get("SP_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("SP_CLIENT_SECRET") ?? "";
const SITE_ID = Deno.env.get("SP_SITE_ID") ?? "";
const BASE = (Deno.env.get("SP_BASE_FOLDER") ?? "RedAlphaCompanion").replace(/^\/+|\/+$/g, "");

const KINDS = new Set(["cv", "jd", "performance-report", "syllabus"]);
const MAX_BYTES = 25 * 1024 * 1024; // Graph simple-PUT limit is 250MB; sessions used above 4MB anyway

// CORS: restrict to the deployed app origin(s). Set ALLOWED_ORIGINS as a
// comma-separated secret (e.g. "https://dartsg.github.io,http://localhost:8081").
// Unset = "*" so nothing breaks before configuration.
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED.length === 0 ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
let cors: Record<string, string> = {};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function graphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Graph auth failed: ${data.error_description ?? res.status}`);
  return data.access_token;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SITE_ID) {
    return json({ error: "SharePoint is not configured yet (SP_* secrets missing)." }, 503);
  }

  // --- authenticate the caller -------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "Not signed in." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { kind, ownerId, filename, mimeType, contentBase64 } = body ?? {};
  if (!KINDS.has(kind) || !ownerId || !filename || !contentBase64) return json({ error: "Missing fields" }, 400);

  // --- authorize: students may only upload their own CV; staff anything ---
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const email = (user.email ?? "").toLowerCase();
  const { data: staffRow } = await admin
    .from("staff_members").select("id").eq("status", "active").ilike("email", email).maybeSingle();
  const isStaff = Boolean(staffRow);
  if (!isStaff && !(kind === "cv" && ownerId === user.id)) return json({ error: "Not allowed." }, 403);

  const bytes = b64ToBytes(String(contentBase64));
  if (bytes.byteLength > MAX_BYTES) return json({ error: "File too large (25MB max)." }, 413);

  // --- upload to SharePoint ----------------------------------------------
  try {
    const token = await graphToken();
    const safeName = String(filename).replace(/[\\/:*?"<>|#%]/g, "_").slice(-120);
    const safeOwner = String(ownerId).replace(/[^A-Za-z0-9_.@-]/g, "_");
    const path = `${BASE}/${kind}/${safeOwner}/${Date.now()}_${safeName}`;
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/root:/${path
      .split("/").map(encodeURIComponent).join("/")}:/content`;

    let res = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": mimeType ?? "application/octet-stream" },
      body: bytes,
    });
    let item = await res.json();

    // Files >4MB need an upload session
    if (res.status === 413 || item?.error?.code === "invalidRequest" && bytes.byteLength > 4 * 1024 * 1024) {
      const sessUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/root:/${path
        .split("/").map(encodeURIComponent).join("/")}:/createUploadSession`;
      const sess = await (await fetch(sessUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
      })).json();
      if (!sess.uploadUrl) throw new Error(sess?.error?.message ?? "Could not create upload session");
      const CHUNK = 5 * 1024 * 1024;
      let last: any = null;
      for (let off = 0; off < bytes.byteLength; off += CHUNK) {
        const end = Math.min(off + CHUNK, bytes.byteLength);
        const r = await fetch(sess.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Length": String(end - off),
            "Content-Range": `bytes ${off}-${end - 1}/${bytes.byteLength}`,
          },
          body: bytes.slice(off, end),
        });
        last = await r.json();
        if (!r.ok) throw new Error(last?.error?.message ?? `Chunk upload failed (${r.status})`);
      }
      item = last;
    } else if (!res.ok) {
      throw new Error(item?.error?.message ?? `Upload failed (${res.status})`);
    }

    if (!item?.webUrl) throw new Error("Upload succeeded but no webUrl returned.");
    return json({ url: item.webUrl, id: item.id, name: item.name });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
