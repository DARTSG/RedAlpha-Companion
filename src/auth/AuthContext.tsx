import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { AuthenticatedUser, StaffMember, UserRole } from '@/types';
import * as mgmt from '@/data/managementApi';
import { isSupabaseConfigured, setSupabaseAccessToken } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const AZURE_AD_CLIENT_ID = (process.env.EXPO_PUBLIC_AZURE_AD_CLIENT_ID ?? '').trim();
const AZURE_AD_TENANT_ID = (process.env.EXPO_PUBLIC_AZURE_AD_TENANT_ID ?? 'common').trim();

const isAzureConfigured = Boolean(AZURE_AD_CLIENT_ID);

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
};

const SESSION_STORAGE_KEY = 'bootcamp-companion.session.v2';
const COHORT_STORAGE_KEY = 'bootcamp-companion.cohort.v1';
const PROFILE_COMPLETE_KEY = 'bootcamp-companion.profileComplete.v1';

// ---------------------------------------------------------------------------
// Cross-platform storage (SecureStore on native, localStorage on web)
// ---------------------------------------------------------------------------
const isWeb = Platform.OS === 'web';
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

interface StoredSession {
  user: AuthenticatedUser;
  accessToken: string | null;
  supabaseToken?: string | null;
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

// Bootstrap admins: emails listed here are always admin (used for the very first
// admin before the members list / Supabase exists). Comma-separated env var.
const BOOTSTRAP_ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '')
  .toLowerCase()
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

// Role is NOT guessed from the email (staff and students share email domains).
// New sign-ins default to "student"; staff/admin come from the members backend
// (Supabase, or local fallback) or the bootstrap admin allowlist.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // On web the redirect URI is this page's own URL (so it round-trips back here).
  // On native it's the app's custom scheme.
  const redirectUri = useMemo(() => {
    if (isWeb && typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return AuthSession.makeRedirectUri({ scheme: 'bootcampcompanion', path: 'auth' });
  }, []);

  // Authorization Code + PKCE — the flow Entra "Single-page application" expects.
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AZURE_AD_CLIENT_ID || 'not-configured',
      scopes: ['openid', 'profile', 'email', 'User.Read', 'offline_access'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  useEffect(() => {
    (async () => {
      try {
        const [rawSession, storedCohort, storedProfileComplete] = await Promise.all([
          storeGet(SESSION_STORAGE_KEY),
          storeGet(COHORT_STORAGE_KEY),
          storeGet(PROFILE_COMPLETE_KEY),
        ]);
        if (rawSession) {
          const stored: StoredSession = JSON.parse(rawSession);
          setUser(stored.user);
          setAccessToken(stored.accessToken);
          setSupabaseAccessToken(stored.supabaseToken ?? null);
        }
        if (storedCohort) setCohortId(storedCohort);
        if (storedProfileComplete === 'true') setProfileComplete(true);
      } catch {
        // ignore corrupt/unavailable storage
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function persistSession(session: StoredSession | null) {
    if (session) await storeSet(SESSION_STORAGE_KEY, JSON.stringify(session));
    else await storeDelete(SESSION_STORAGE_KEY);
  }

  // Trigger the Microsoft sign-in. The result is handled by the effect below so it
  // works for both popup and redirect flows (no manual button click needed after auth).
  function signInWithMicrosoft() {
    setAuthError(null);
    if (!isAzureConfigured) { setAuthError('Microsoft sign-in is not configured.'); return Promise.resolve(); }
    setIsAuthenticating(true);
    return promptAsync().then(() => undefined);
  }

  // Handle the OAuth response automatically.
  useEffect(() => {
    if (!response) return;
    if (response.type === 'success' && response.params?.code) {
      completeMicrosoftSignIn(response.params.code).catch((e: any) => {
        setSupabaseAccessToken(null);
        setAuthError(e?.message ?? 'Sign-in failed. Please try again.');
        setIsAuthenticating(false);
      });
    } else if (response.type === 'error') {
      setAuthError(response.error?.message ?? 'Sign-in failed. Please try again.');
      setIsAuthenticating(false);
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setIsAuthenticating(false);
    }
  }, [response]);

  async function completeMicrosoftSignIn(code: string) {
    const tokenResult = await AuthSession.exchangeCodeAsync(
      { clientId: AZURE_AD_CLIENT_ID, code, redirectUri, extraParams: { code_verifier: request?.codeVerifier ?? '' } },
      discovery
    );
    const token = tokenResult.accessToken;
    if (!token) throw new Error('Sign-in failed: no access token returned.');
    const supabaseToken = tokenResult.idToken ?? null;
    setSupabaseAccessToken(supabaseToken);

    // Reject accounts the backend won't accept (e.g. outside your organization).
    if (isSupabaseConfigured) {
      const ok = await mgmt.verifyBackendAccess();
      if (!ok) throw new Error('This Microsoft account is not authorized for Red Alpha. Please sign in with your organization account.');
    }

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileResponse.ok) throw new Error('Could not load your Microsoft profile.');
    const profile = await profileResponse.json();
    const email: string = profile.mail || profile.userPrincipalName || '';

    const members = await mgmt.fetchMembers().catch(() => [] as StaffMember[]);
    const me = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (me && me.status === 'invited') { await mgmt.upsertMember({ ...me, status: 'active' }); }
    const role: UserRole = BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : (me ? me.role : 'student');

    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      displayName: profile.displayName ?? email,
      email,
      role,
    };

    setUser(authenticatedUser);
    setAccessToken(token);
    setAuthError(null);
    setIsAuthenticating(false);
    await persistSession({ user: authenticatedUser, accessToken: token, supabaseToken });
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
    setSupabaseAccessToken(null);
    await persistSession({ user: demoUser, accessToken: null, supabaseToken: null });
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
    setUser(null);
    setAccessToken(null);
    setSupabaseAccessToken(null);
    setCohortId(null);
    setProfileComplete(false);
    await persistSession(null);
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
