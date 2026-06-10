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
