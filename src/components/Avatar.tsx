import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  name: string;
  size?: number;
  color?: string;
}

/** Initials-based avatar circle — no image loading dependencies. */
export function Avatar({ name, size = 40, color = colors.primary }: Props) {
  const initials = name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22' },
      ]}
    >
      <Text style={[styles.text, { color, fontSize: size * 0.36, lineHeight: size }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700', textAlign: 'center' },
});
