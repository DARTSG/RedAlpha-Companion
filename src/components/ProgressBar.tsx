import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius } from '@/theme';

interface Props {
  progress: number; // 0–1
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({ progress, color = '#DC2626', height = 8, animated = false }: Props) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(clampedProgress * 100)}%`,
            backgroundColor: color,
            borderRadius: height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
