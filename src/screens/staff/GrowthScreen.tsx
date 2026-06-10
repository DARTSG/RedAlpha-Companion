import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchCohortGrowth } from '@/data/api';
import { CohortGrowthPoint } from '@/types';
import { Card } from '@/components/Card';
import { colors, radius, spacing, typography } from '@/theme';

const CHART_HEIGHT = 160;

/**
 * Dependency-free vertical bar chart built from plain Views.
 * Avoids react-native-svg / react-native-chart-kit (known Hermes/DOMRect crash).
 */
function SimpleBarChart(props: { labels: string[]; values: number[]; color: string }) {
  const { labels, values, color } = props;
  const max = Math.max(...values, 1);
  const anims = useRef(values.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      anims.map((a, i) =>
        Animated.spring(a, {
          toValue: Math.max((values[i] / max) * 100, 4),
          useNativeDriver: false,
          damping: 14,
          stiffness: 80,
        })
      )
    ).start();
  }, []);

  return (
    <View style={chartStyles.row}>
      {values.map(function (value, idx) {
        return (
          <View key={idx} style={chartStyles.column}>
            <Text style={chartStyles.value}>{value}</Text>
            <View style={chartStyles.track}>
              <Animated.View
                style={[
                  chartStyles.bar,
                  {
                    height: anims[idx].interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Text style={chartStyles.label}>{labels[idx]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, marginTop: spacing.md, gap: spacing.sm },
  column: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  value: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
  track: {
    width: '70%',
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: { width: '100%', borderRadius: 6 },
  label: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs, fontWeight: '600' },
});

export function GrowthScreen() {
  const { accessToken } = useAuth();
  const [growth, setGrowth] = useState<CohortGrowthPoint[] | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchCohortGrowth(accessToken).then(setGrowth);
  }, []);

  if (!growth) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const placedRatios = growth
    .filter((g) => g.graduated > 0)
    .map((g) => ({ cohort: g.cohortName, rate: Math.round((g.placed / g.graduated) * 100) }));

  const overallEnrolled = growth.reduce((sum, g) => sum + g.enrolled, 0);
  const overallGraduated = growth.reduce((sum, g) => sum + g.graduated, 0);
  const overallPlaced = growth.reduce((sum, g) => sum + g.placed, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Animated.View style={{ opacity: headerAnim }}>
          <Text style={styles.headerTitle}>Growth & Outcomes</Text>
          <Text style={styles.headerSub}>Across {growth.length} cohorts</Text>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Enrollment chart */}
        <Card elevated>
          <Text style={styles.cardTitle}>Enrollment by Cohort</Text>
          <SimpleBarChart
            labels={growth.map((g) => g.cohortName.replace('Cohort ', 'C'))}
            values={growth.map((g) => g.enrolled)}
            color={colors.primary}
          />
        </Card>

        {/* Totals */}
        <Card elevated>
          <Text style={styles.cardTitle}>Lifetime Totals</Text>
          <View style={styles.totalsRow}>
            <TotalStat label="Enrolled" value={overallEnrolled} color={colors.primary} />
            <View style={styles.totalDivider} />
            <TotalStat label="Graduated" value={overallGraduated} color={colors.purple} />
            <View style={styles.totalDivider} />
            <TotalStat label="Placed" value={overallPlaced} color={colors.accent} />
          </View>
        </Card>

        {/* Placement rate */}
        {placedRatios.length > 0 && (
          <Card elevated>
            <Text style={styles.cardTitle}>Placement Rate</Text>
            <Text style={styles.cardSub}>% of graduates who secured a placement</Text>

            {placedRatios.map((r, i) => (
              <View key={r.cohort} style={styles.rateRow}>
                <Text style={styles.rateCohort}>{r.cohort}</Text>
                <View style={styles.rateTrack}>
                  <View style={[styles.rateFill, { width: `${r.rate}%` as any }]} />
                </View>
                <Text style={[styles.rateValue, { color: r.rate >= 70 ? colors.accent : colors.warning }]}>
                  {r.rate}%
                </Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TotalStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.totalStat}>
      <Text style={[styles.totalValue, { color }]}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerTitle: { ...typography.headline2, color: '#FFF' },
  headerSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  totalsRow: { flexDirection: 'row', alignItems: 'center' },
  totalStat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  totalValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  totalLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  totalDivider: { width: 1, height: 40, backgroundColor: colors.borderLight },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rateCohort: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', width: 80 },
  rateTrack: { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  rateFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  rateValue: { ...typography.bodySmall, fontWeight: '700', width: 36, textAlign: 'right' },
});
