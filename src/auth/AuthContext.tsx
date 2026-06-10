import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { AuthenticatedUser, UserRole } from '@/types';

WebBrowser.maybeCompleteAuthSession();

const config = Constants.expoConfig?.extra ?? {};
const AZURE_AD_CLIENT_ID = (config.azureAdClientId as string) ?? '';
const AZURE_AD_TENANT_ID = (config.azureAdTenantId as string) || 'common';

const isAzureConfigured =
  !!AZURE_AD_CLIENT_ID && !AZURE_AD_CLIENT_ID.startsWith('REPLACE_WITH');

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
};

const SESSION_STORAGE_KEY = 'bootcamp-companion.session.v2';
const COHORT_STORAGE_KEY = 'bootcamp-companion.cohort.v1';
const PROFILE_COMPLETE_KEY = 'bootcamp-companion.profileComplete.v1';

interface StoredSession {
  user: AuthenticatedUser;
  accessToken: string | null;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAzureConfigured: boolean;
  /** ID of the cohort the student selected on first login. null = not yet selected. */
  cohortId: string | null;
  /** Whether the student has completed the onboarding profile form. */
  profileComplete: boolean;
  signInWithMicrosoft: () => Promise<void>;
  signInWithDemoAccount: (role: UserRole) => Promise<void>;
  selectCohort: (id: string) => Promise<void>;
  completeProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function inferRoleFromEmail(email: string): UserRole {
  if (/admin@|@admin\./i.test(email)) return 'admin';
  return /@staff\.|@team\.|staff@/i.test(email) ? 'staff' : 'student';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'bootcampcompanion', path: 'auth' }),
    []
  );

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AZURE_AD_CLIENT_ID || 'not-configured',
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    discovery
  );

  // Restore session and cohort selection on launch
  useEffect(() => {
    (async () => {
      try {
        const [rawSession, storedCohort, storedProfileComplete] = await Promise.all([
          SecureStore.getItemAsync(SESSION_STORAGE_KEY),
          SecureStore.getItemAsync(COHORT_STORAGE_KEY),
          SecureStore.getItemAsync(PROFILE_COMPLETE_KEY),
        ]);
        if (rawSession) {
          const stored: StoredSession = JSON.parse(rawSession);
          setUser(stored.user);
          setAccessToken(stored.accessToken);
        }
        if (storedCohort) {
          setCohortId(storedCohort);
        }
        if (storedProfileComplete === 'true') {
          setProfileComplete(true);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function persistSession(session: StoredSession | null) {
    if (session) {
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    }
  }

  async function signInWithMicrosoft() {
    if (!isAzureConfigured) {
      throw new Error('Azure AD not configured. See SETUP_GUIDE.md.');
    }
    if (!request) return;
    const result = await promptAsync();
    if (result.type !== 'success' || !result.authentication?.accessToken) return;

    const token = result.authentication.accessToken;
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileResponse.ok) throw new Error('Could not load Microsoft profile.');
    const profile = await profileResponse.json();
    const email: string = profile.mail || profile.userPrincipalName || '';

    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      displayName: profile.displayName ?? email,
      email,
      role: inferRoleFromEmail(email),
    };

    setUser(authenticatedUser);
    setAccessToken(token);
    await persistSession({ user: authenticatedUser, accessToken: token });
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
    await persistSession({ user: demoUser, accessToken: null });
    // Cohort NOT set here — will be prompted on CohortPickerScreen
  }

  async function selectCohort(id: string) {
    setCohortId(id);
    await SecureStore.setItemAsync(COHORT_STORAGE_KEY, id);
  }

  async function completeProfile() {
    setProfileComplete(true);
    await SecureStore.setItemAsync(PROFILE_COMPLETE_KEY, 'true');
  }

  async function signOut() {
    setUser(null);
    setAccessToken(null);
    setCohortId(null);
    setProfileComplete(false);
    await persistSession(null);
    await SecureStore.deleteItemAsync(COHORT_STORAGE_KEY);
    await SecureStore.deleteItemAsync(PROFILE_COMPLETE_KEY);
  }

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAzureConfigured,
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
