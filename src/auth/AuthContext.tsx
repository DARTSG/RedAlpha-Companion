import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthenticatedUser, StaffMember, UserRole } from '@/types';
import * as mgmt from '@/data/managementApi';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

// Emails that are always admin (bootstrap before the members table is populated).
const BOOTSTRAP_ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '')
  .toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);

// If set, only these email domains may sign in (everyone else is rejected). Optional.
const ALLOWED_DOMAINS = (process.env.EXPO_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? '')
  .toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);

const isWeb = Platform.OS === 'web';
const DEMO_KEY = 'bootcamp-companion.demo.v1';
const COHORT_STORAGE_KEY = 'bootcamp-companion.cohort.v1';
const PROFILE_COMPLETE_KEY = 'bootcamp-companion.profileComplete.v1';

async function storeGet(key: string): Promise<string | null> {
  if (isWeb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}
async function storeSet(key: string, value: string): Promise<void> {
  if (isWeb) { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}
async function storeDelete(key: string): Promise<void> {
  if (isWeb) { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAzureConfigured: boolean;
  authError: string | null;
  isAuthenticating: boolean;
  cohortId: string | null;
  profileComplete: boolean;
  signInWithMicrosoft: () => Promise<void>;
  signInWithDemoAccount: (role: UserRole) => Promise<void>;
  selectCohort: (id: string) => Promise<void>;
  completeProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Microsoft sign-in is available whenever the backend is configured.
  const isAzureConfigured = isSupabaseConfigured;

  async function applySession(sb: any, session: any) {
    const u = session?.user;
    if (!u) return;
    const email = (u.email ?? u.user_metadata?.email ?? '').toLowerCase();

    if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(email.split('@')[1] ?? '')) {
      try { await sb.auth.signOut(); } catch {}
      setUser(null);
      setAccessToken(null);
      setAuthError('This Microsoft account is not authorized for Red Alpha. Please sign in with your organization account.');
      setIsAuthenticating(false);
      return;
    }

    const members = await mgmt.fetchMembers().catch(() => [] as StaffMember[]);
    const me = members.find((m) => m.email.toLowerCase() === email);
    if (me && me.status === 'invited') { try { await mgmt.upsertMember({ ...me, status: 'active' }); } catch {} }
    const role: UserRole = BOOTSTRAP_ADMIN_EMAILS.includes(email) ? 'admin' : (me ? me.role : 'student');

    const meta = u.user_metadata ?? {};
    setUser({ id: u.id, displayName: meta.full_name || meta.name || email, email, role });
    setAccessToken(session.access_token ?? null);
    setAuthError(null);
    setIsAuthenticating(false);
    await storeDelete(DEMO_KEY); // a real session supersedes any demo session
  }

  // Initialise: restore flags + Supabase session (or demo session).
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const [storedCohort, storedProfile, demoRaw] = await Promise.all([
          storeGet(COHORT_STORAGE_KEY),
          storeGet(PROFILE_COMPLETE_KEY),
          storeGet(DEMO_KEY),
        ]);
        if (storedCohort) setCohortId(storedCohort);
        if (storedProfile === 'true') setProfileComplete(true);

        const sb = getSupabaseClient();
        if (sb) {
          const { data } = await sb.auth.getSession();
          if (data?.session) {
            await applySession(sb, data.session);
          } else if (demoRaw) {
            setUser(JSON.parse(demoRaw));
          }
          const { data: listener } = sb.auth.onAuthStateChange((_event: string, session: any) => {
            if (session) applySession(sb, session);
          });
          cleanup = () => listener?.subscription?.unsubscribe?.();
        } else if (demoRaw) {
          setUser(JSON.parse(demoRaw));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
    return () => { if (cleanup) cleanup(); };
  }, []);

  async function signInWithMicrosoft() {
    setAuthError(null);
    const sb = getSupabaseClient();
    if (!sb) { setAuthError('Sign-in is not configured yet.'); return; }
    setIsAuthenticating(true);
    const redirectTo = isWeb && typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : 'bootcampcompanion://auth';
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'openid profile email', redirectTo },
    });
    if (error) { setAuthError(error.message); setIsAuthenticating(false); }
    // Web: a full-page redirect happens; the session is handled on return by applySession.
  }

  async function signInWithDemoAccount(role: UserRole) {
    const demoUser: AuthenticatedUser =
      role === 'admin'
        ? { id: 'demo-admin-1', displayName: 'Demo Admin', email: 'demo.admin@staff.bootcamp.sg', role: 'admin' }
        : role === 'staff'
        ? { id: 'demo-staff-1', displayName: 'Demo Staff Member', email: 'demo.staff@staff.bootcamp.sg', role: 'staff' }
        : { id: 'demo-student-1', displayName: 'Alex Chen', email: 'alex.chen@students.bootcamp.sg', role: 'student' };
    setUser(demoUser);
    setAccessToken(null);
    await storeSet(DEMO_KEY, JSON.stringify(demoUser));
  }

  async function selectCohort(id: string) {
    setCohortId(id);
    await storeSet(COHORT_STORAGE_KEY, id);
  }

  async function completeProfile() {
    setProfileComplete(true);
    await storeSet(PROFILE_COMPLETE_KEY, 'true');
  }

  async function signOut() {
    const sb = getSupabaseClient();
    try { if (sb) await sb.auth.signOut(); } catch {}
    setUser(null);
    setAccessToken(null);
    setCohortId(null);
    setProfileComplete(false);
    setAuthError(null);
    await storeDelete(DEMO_KEY);
    await storeDelete(COHORT_STORAGE_KEY);
    await storeDelete(PROFILE_COMPLETE_KEY);
  }

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAzureConfigured,
    authError,
    isAuthenticating,
    cohortId,
    profileComplete,
    signInWithMicrosoft,
    signInWithDemoAccount,
    selectCohort,
    completeProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
