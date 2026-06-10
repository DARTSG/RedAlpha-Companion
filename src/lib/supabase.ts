/**
 * Supabase client setup for Red Alpha Companion.
 *
 * To enable real persistence:
 * 1. Create a project at https://supabase.com
 * 2. Copy your project URL and anon key
 * 3. Create a .env file in the project root with:
 *      EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 *      EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * 4. Run the SQL in supabase-schema.sql in your Supabase SQL editor
 * 5. Create a Storage bucket named "cvs" (public: false)
 * 6. Restart the dev server
 *
 * Until configured, the app runs entirely on local/mock data.
 */

// Supabase is an optional dependency — only imported when configured.
// This avoids crashes when the package isn't installed.

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Lazily created so the module doesn't crash when @supabase/supabase-js isn't installed.
let _supabase: any = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (_supabase) return _supabase;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch {
    console.warn('[Supabase] @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js');
  }
  return _supabase;
}
