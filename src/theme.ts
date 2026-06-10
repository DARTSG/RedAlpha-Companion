import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// DESIGN SYSTEM — Red Alpha Companion
// Luma/Beehiiv-inspired: dark headers, clean white cards, bold typography
// Brand: Red Alpha red (#DC2626) as primary, slate-900 (#0F172A) for headers
// ---------------------------------------------------------------------------

export const colors = {
  // Backgrounds
  background: '#F3F4F6',      // Warm light grey (Beehiiv-like)
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',

  // Red Alpha brand — primary action colour
  primary: '#DC2626',
  primaryLight: '#FEF2F2',
  primaryMid: 'rgba(220,38,38,0.12)',
  primaryDark: '#B91C1C',

  // Dark header (Luma-style: near-black slate)
  headerBg: '#0F172A',
  headerSub: '#1E293B',

  // Accent (green — success/positive)
  accent: '#10B981',
  accentLight: '#ECFDF5',

  // Purple — secondary highlight
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',

  // Orange — warning / company visit
  orange: '#F97316',
  orangeLight: '#FFF7ED',

  // Gold — achievements
  gold: '#F59E0B',
  goldLight: '#FFFBEB',

  // Semantic
  error: '#DC2626',
  errorLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Tab bar
  tabBarInactive: '#9CA3AF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  headline2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
};

export const shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {},
  })!,
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 10,
    },
    android: { elevation: 5 },
    default: {},
  })!,
};
