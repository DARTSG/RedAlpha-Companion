/**
 * Supabase client for Red Alpha Companion.
 *
 * Auth: users sign in with Microsoft via Supabase's built-in **Azure provider**
 * (supabase.auth.signInWithOAuth). Supabase manages the OAuth redirect, the session,
 * and token refresh. Row Level Security can then read the user from auth.jwt().
 *
 * Until EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set, the app runs on local/mock data.
 */

import { Platform } from 'react-native';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _supabase: any = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (_supabase) return _supabase;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js');
    const isWeb = Platform.OS === 'web';
    const auth: any = {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb, // parse the OAuth redirect on web
      flowType: 'pkce',
    };
    if (!isWeb) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      auth.storage = require('@react-native-async-storage/async-storage').default;
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth });
  } catch {
    console.warn('[Supabase] @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js');
  }
  return _supabase;
}
