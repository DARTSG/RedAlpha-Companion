import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface PillProps {
  label: string;
  tone?: Tone;
  active?: boolean;
  onPress?: () => void;
}

const TONE: Record<Tone, string> = {
  default: colors.textSecondary,
  success: colors.accent,
  warning: colors.warning,
  danger: colors.error,
  info: colors.primary,
};

export function Pill({ label, tone = 'default', active, onPress }: PillProps) {
  const color = TONE[tone];
  const isActive = active !== undefined ? active : false;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: isActive ? colors.primary : colors.surface, borderColor: isActive ? colors.primary : colors.border },
        !onPress && { backgroundColor: color + '18', borderColor: color + '55' },
      ]}
    >
      <Text style={[
        styles.label,
        { color: isActive ? '#FFF' : (onPress ? colors.textSecondary : color) },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.label,
    fontWeight: '600',
  },
});
