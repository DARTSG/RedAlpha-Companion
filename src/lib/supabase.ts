/**
 * Supabase client setup for Red Alpha Companion.
 *
 * Auth model: users sign in with Microsoft Entra (see AuthContext). After sign-in we
 * register the Entra **ID token** here via setSupabaseAccessToken(). The Supabase client
 * then sends that token on every request, so Row Level Security can identify the user
 * (Supabase "Third-Party Auth" must be configured to trust your Entra tenant — see
 * supabase-schema.sql / the setup steps). When no user token is set (e.g. demo logins),
 * requests use the public anon key.
 *
 * Until EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set, the app runs on local/mock data.
 */

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// The current user's Entra ID token (null when signed out / demo).
let _accessToken: string | null = null;
export function setSupabaseAccessToken(token: string | null) {
  _accessToken = token;
}

let _supabase: any = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (_supabase) return _supabase;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // Third-Party Auth: send the Entra ID token when present, else fall back to anon.
      accessToken: async () => _accessToken ?? SUPABASE_ANON_KEY,
    });
  } catch {
    console.warn('[Supabase] @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js');
  }
  return _supabase;
}
