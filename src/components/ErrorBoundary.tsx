import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';

interface State { hasError: boolean; message?: string }

/**
 * Catches render-time crashes anywhere below it and shows a recoverable
 * fallback instead of a blank white screen. Wrap the whole app in App.tsx.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message ?? 'An unexpected error occurred.' };
  }
  componentDidCatch(err: any, info: any) {
    // Hook a real logger (Sentry / LogRocket) here before launch.
    console.error('[ErrorBoundary]', err, info);
  }
  reset = () => {
    this.setState({ hasError: false, message: undefined });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Something went wrong</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 22, maxWidth: 440, lineHeight: 20 }}>
          {this.state.message}
        </Text>
        <TouchableOpacity onPress={this.reset} style={{ backgroundColor: '#DC2626', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
