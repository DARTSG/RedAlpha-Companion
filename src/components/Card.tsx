import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';

interface CardProps {
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function Card({ style, children, elevated = false, padded = true }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, padded && styles.padded, style as ViewStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  elevated: {
    borderWidth: 0,
    ...shadow.sm,
  },
  padded: {
    padding: spacing.md,
  },
});
