import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Variant = 'primary' | 'accent' | 'warning' | 'error' | 'purple' | 'neutral' | 'orange';

interface Props {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
}

const variantMap: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: colors.primaryLight, text: colors.primary },
  accent: { bg: colors.accentLight, text: colors.accent },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  purple: { bg: colors.purpleLight, text: colors.purple },
  orange: { bg: colors.orangeLight, text: colors.orange },
  neutral: { bg: colors.borderLight, text: colors.textSecondary },
};

export function Badge({ label, variant = 'neutral', size = 'md' }: Props) {
  const { bg, text } = variantMap[variant];
  return (
    <View style={[styles.base, { backgroundColor: bg }, size === 'sm' && styles.sm]}>
      <Text style={[styles.text, { color: text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '600' },
  textSm: { fontSize: 10 },
});
