import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  label: string;
  value: string | number;
  emoji?: string;
  color?: string;
  small?: boolean;
}

export function StatTile({ label, value, emoji, color, small }: Props) {
  return (
    <View style={[styles.tile, small && styles.tileSmall]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text style={[styles.value, color ? { color } : null, small && styles.valueSmall]}>
        {value}
      </Text>
      <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    minWidth: 80,
    flex: 1,
  },
  tileSmall: {
    padding: spacing.sm,
    minWidth: 60,
  },
  emoji: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  valueSmall: {
    fontSize: 17,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  labelSmall: {
    fontSize: 10,
  },
});
