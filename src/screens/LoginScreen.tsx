import React, { useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, shadow, spacing, typography } from '@/theme';

const RA_BG = '#0F172A';
const RA_RED = '#DC2626';

function RedAlphaLogo({ size = 48 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[logo.outer, { borderBottomColor: RA_RED, borderLeftWidth: size * 0.45, borderRightWidth: size * 0.45, borderBottomWidth: size * 0.8 }]} />
      <View style={[logo.inner, { borderBottomColor: RA_BG, borderLeftWidth: size * 0.28, borderRightWidth: size * 0.28, borderBottomWidth: size * 0.5, bottom: size * 0.08 }]} />
      <View style={[logo.bar, { width: size * 0.32, height: size * 0.075, bottom: size * 0.27, backgroundColor: RA_RED }]} />
    </View>
  );
}

const logo = StyleSheet.create({
  outer: { position: 'absolute', width: 0, height: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent', bottom: 0 },
  inner: { position: 'absolute', width: 0, height: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  bar: { position: 'absolute', borderRadius: 2 },
});

export function LoginScreen() {
  const { signInWithMicrosoft, signInWithDemoAccount, isAzureConfigured, authError, isAuthenticating } = useAuth();
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => { if (authError) shake(); }, [authError]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 0, delay: 200, useNativeDriver: true, damping: 18, stiffness: 120 }),
    ]).start();
  }, []);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleMicrosoft() {
    signInWithMicrosoft();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>

          {/* ── Brand hero ── */}
          <View style={styles.hero}>
            <View style={styles.blob1} />
            <View style={styles.blob2} />
            <View style={styles.logoBubble}>
              <RedAlphaLogo size={44} />
            </View>
            <Text style={styles.brandName}>RED ALPHA</Text>
            <Text style={styles.appName}>Companion</Text>
            <Text style={styles.tagline}>Your bootcamp, in your pocket</Text>
          </View>

          {/* ── Sign-in card ── */}
          <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardAnim }, { translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Welcome back 👋</Text>
            <Text style={styles.cardSub}>Sign in with your Red Alpha Microsoft account to continue.</Text>

            {/* Microsoft button */}
            <TouchableOpacity
              style={[styles.msBtn, !isAzureConfigured && styles.msBtnDisabled]}
              onPress={handleMicrosoft}
              disabled={!isAzureConfigured || isAuthenticating}
              activeOpacity={0.82}
            >
              <View style={styles.msGrid}>
                <View style={[styles.msSquare, { backgroundColor: '#F25022' }]} />
                <View style={[styles.msSquare, { backgroundColor: '#7FBA00' }]} />
                <View style={[styles.msSquare, { backgroundColor: '#00A4EF' }]} />
                <View style={[styles.msSquare, { backgroundColor: '#FFB900' }]} />
              </View>
              <Text style={styles.msBtnText}>{isAuthenticating ? 'Signing in…' : 'Continue with Microsoft'}</Text>
            </TouchableOpacity>

            {!isAzureConfigured && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Azure AD not configured yet — use demo accounts below to explore.
                </Text>
              </View>
            )}

            {authError ? <Text style={styles.error}>{authError}</Text> : null}

            {/* Demo accounts only exist before the real backend is configured */}
            {!isAzureConfigured && (<>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or try a demo</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoBtn, { borderColor: colors.primary }]}
                onPress={() => signInWithDemoAccount('student')}
                activeOpacity={0.8}
              >
                <Text style={styles.demoEmoji}>🎓</Text>
                <Text style={[styles.demoBtnLabel, { color: colors.primary }]}>Student</Text>
                <Text style={styles.demoHint}>Student view</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, { borderColor: colors.purple }]}
                onPress={() => signInWithDemoAccount('staff')}
                activeOpacity={0.8}
              >
                <Text style={styles.demoEmoji}>👔</Text>
                <Text style={[styles.demoBtnLabel, { color: colors.purple }]}>Staff</Text>
                <Text style={styles.demoHint}>Staff portal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoBtn, { borderColor: colors.gold }]}
                onPress={() => signInWithDemoAccount('admin')}
                activeOpacity={0.8}
              >
                <Text style={styles.demoEmoji}>🛡️</Text>
                <Text style={[styles.demoBtnLabel, { color: colors.gold }]}>Admin</Text>
                <Text style={styles.demoHint}>Full control</Text>
              </TouchableOpacity>
            </View>
            </>)}

            <Text style={styles.footer}>Red Alpha Bootcamp · Singapore</Text>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RA_BG },
  scroll: { flexGrow: 1 },

  // Hero
  hero: {
    backgroundColor: RA_BG,
    paddingTop: spacing.huge + spacing.xl,
    paddingBottom: spacing.huge,
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(220,38,38,0.07)', top: -80, right: -60,
  },
  blob2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(220,38,38,0.05)', bottom: 0, left: -50,
  },
  logoBubble: {
    width: 80, height: 80, borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  brandName: {
    fontSize: 13, fontWeight: '800', letterSpacing: 4,
    color: RA_RED, marginBottom: 6,
  },
  appName: {
    fontSize: 36, fontWeight: '800', color: '#FFF',
    letterSpacing: -1, marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body, color: 'rgba(255,255,255,0.40)',
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    margin: spacing.lg,
    padding: spacing.xl,
    ...shadow.md,
  },
  cardTitle: {
    fontSize: 22, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.5, marginBottom: spacing.xs,
  },
  cardSub: {
    ...typography.bodySmall, color: colors.textSecondary,
    lineHeight: 20, marginBottom: spacing.xl,
  },

  // Microsoft button
  msBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.headerBg,
    borderRadius: radius.md, paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg, gap: spacing.md,
    marginBottom: spacing.md,
  },
  msBtnDisabled: { opacity: 0.7 },
  msGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 20, height: 20, gap: 2 },
  msSquare: { width: 9, height: 9 },
  msBtnText: { ...typography.body, color: '#FFF', fontWeight: '700', flex: 1 },

  // Notice + error
  notice: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  noticeText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  error: { ...typography.bodySmall, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  dividerLabel: { ...typography.caption, color: colors.textTertiary, fontWeight: '600' },

  // Demo buttons
  demoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  demoBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md + 4,
    borderRadius: radius.md, borderWidth: 1.5,
    backgroundColor: colors.surface, gap: 4,
  },
  demoEmoji: { fontSize: 26 },
  demoBtnLabel: { ...typography.heading, fontWeight: '700' },
  demoHint: { ...typography.caption, color: colors.textTertiary },

  footer: {
    ...typography.caption, color: colors.textTertiary,
    textAlign: 'center',
  },
});
