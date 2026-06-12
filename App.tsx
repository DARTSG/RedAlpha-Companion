import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function useWebBranding() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'Red Alpha Companion';

    // Content Security Policy (defense in depth — GitHub Pages can't set
    // response headers, so a meta tag is the available mechanism).
    // Skipped in dev: Metro needs eval/source maps.
    if (!__DEV__ && !document.getElementById('ra-csp')) {
      const csp = document.createElement('meta');
      csp.id = 'ra-csp';
      csp.httpEquiv = 'Content-Security-Policy';
      csp.content = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.supabase.co https://*.supabase.in https://login.microsoftonline.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://login.microsoftonline.com",
      ].join('; ');
      document.head.appendChild(csp);
      const referrer = document.createElement('meta');
      referrer.name = 'referrer';
      referrer.content = 'strict-origin-when-cross-origin';
      document.head.appendChild(referrer);
    }
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='14' fill='#DC2626'/>" +
      "<text x='32' y='44' font-family='Arial,Helvetica,sans-serif' font-size='30' font-weight='bold' fill='#ffffff' text-anchor='middle'>RA</text></svg>";
    const href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.querySelectorAll("link[rel~='icon']").forEach((n) => n.parentNode?.removeChild(n));
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    document.head.appendChild(link);
  }, []);
}

export default function App() {
  useWebBranding();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
