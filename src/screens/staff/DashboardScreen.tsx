import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchCohortGrowth, fetchStaffStudentRoster } from '@/data/api';
import { CohortGrowthPoint, StaffStudentRecord, StudentLifecycleStage } from '@/types';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { colors, radius, spacing, typography } from '@/theme';

const STAGE_CONFIG: Record<StudentLifecycleStage, { label: string; color: string; icon: string }> = {
  'on-course': { label: 'On Course', color: colors.primary, icon: '📚' },
  'job-hunting': { label: 'Job Hunting', color: colors.warning, icon: '🔍' },
  'on-placement': { label: 'On Placement', color: colors.accent, icon: '💼' },
  'bond-completed': { label: 'Bond Complete', color: colors.purple, icon: '🏅' },
  extended: { label: 'Extended', color: '#06AED4', icon: '⏩' },
  withdrawn: { label: 'Withdrawn', color: colors.error, icon: '⛔' },
};

function StatBlock({ label, value, icon, color, index }: {
  label: string; value: number; icon: string; color: string; index: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, delay: index * 80, useNativeDriver: true, damping: 14, stiffness: 100 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.statBlock, { opacity: anim, transform: [{ scale }] }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

function CohortBar({ name, count, max, color, index }: {
  name: string; count: number; max: number; color: string; index: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 80, useNativeDriver: true }),
      Animated.timing(widthAnim, {
        toValue: max > 0 ? count / max : 0,
        duration: 600,
        delay: index * 80 + 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.cohortRow, { opacity: fadeAnim }]}>
      <View style={[styles.cohortColorDot, { backgroundColor: color }]} />
      <Text style={styles.cohortBarName}>{name}</Text>
      <View style={styles.cohortBarTrack}>
        <Animated.View
          style={[
            styles.cohortBarFill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.cohortBarCount, { color }]}>{count}</Text>
    </Animated.View>
  );
}

const COHORT_COLORS = [colors.primary, colors.purple, colors.accent, colors.warning, colors.orange];

export function DashboardScreen() {
  const { user, accessToken, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of the demo account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  const [growth, setGrowth] = useState<CohortGrowthPoint[]>([]);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Promise.all([
      fetchStaffStudentRoster(accessToken),
      fetchCohortGrowth(accessToken),
    ]).then(([s, g]) => {
      setStudents(s);
      setGrowth(g);
    });
  }, []);

  if (!students) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
       
        </View>
      </SafeAreaView>
    );
  }

  const totalStudents = students.length;
  const stageCounts = Object.keys(STAGE_CONFIG).reduce((acc, key) => {
    acc[key as StudentLifecycleStage] = students.filter((s) => s.stage === key).length;
    return acc;
  }, {} as Record<StudentLifecycleStage, number>);

  const cohortMap = students.reduce((acc, s) => {
    acc[s.cohortName] = (acc[s.cohortName] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const cohortEntries = Object.entries(cohortMap).sort((a, b) => b[1] - a[1]);
  const maxCohortCount = Math.max(...cohortEntries.map(([, c]) => c), 1);

  const placedPct = totalStudents > 0
    ? Math.round((stageCounts['on-placement'] + stageCounts['bond-completed']) / totalStudents * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreeting}>Staff Portal</Text>
          <Text style={styles.headerName}>Welcome back, {user?.displayName?.split(' ')[0] ?? 'there'} 👋</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Stage stats grid */}
        <Text style={styles.sectionTitle}>Student Overview</Text>
        <View style={styles.statsGrid}>
          {(Object.keys(STAGE_CONFIG) as StudentLifecycleStage[]).map((stage, i) => {
            const cfg = STAGE_CONFIG[stage];
            return (
              <StatBlock
                key={stage}
                label={cfg.label}
                value={stageCounts[stage]}
                icon={cfg.icon}
                color={cfg.color}
                index={i}
              />
            );
          })}
        </View>

        {/* Placement rate */}
        <Card elevated style={styles.placementCard}>
          <View style={styles.placementRow}>
            <View>
              <Text style={styles.placementLabel}>Placement Rate</Text>
              <Text style={styles.placementSub}>{stageCounts['on-placement'] + stageCounts['bond-completed']} of {totalStudents} students placed</Text>
            </View>
            <Text style={styles.placementPct}>{placedPct}%</Text>
          </View>
          <View style={styles.placementTrack}>
            <View style={[styles.placementFill, { width: `${placedPct}%` as any }]} />
          </View>
        </Card>

        {/* Cohort breakdown */}
        <Text style={styles.sectionTitle}>By Cohort</Text>
        <Card elevated>
          {cohortEntries.map(([name, count], i) => (
            <CohortBar
              key={name}
              name={name}
              count={count}
              max={maxCohortCount}
              color={COHORT_COLORS[i % COHORT_COLORS.length]}
              index={i}
            />
          ))}
        </Card>

        {/* Recent students */}
        <Text style={styles.sectionTitle}>Recent Students</Text>
        <Card elevated>
          {students.slice(0, 5).map((s, i) => {
            const cfg = STAGE_CONFIG[s.stage];
            return (
              <View key={s.studentId} style={[styles.recentRow, i < 4 && styles.recentRowBorder]}>
                <Avatar name={s.name} size={38} color={COHORT_COLORS[i % COHORT_COLORS.length]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName}>{s.name}</Text>
                  <Text style={styles.recentCohort}>{s.cohortName}</Text>
                </View>
                <View style={[styles.stageChip, { backgroundColor: cfg.color + '18' }]}>
                  <Text style={[styles.stageChipText, { color: cfg.color }]}>{cfg.icon} {cfg.label}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerGreeting: { ...typography.caption, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  headerName: { ...typography.headline2, color: '#FFF' },
  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  signOutText: { ...typography.caption, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { ...typography.heading, color: colors.textPrimary, marginTop: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    width: '30%',
    flexGrow: 1,
    gap: 4,
  },
  statIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  placementCard: { gap: spacing.sm },
  placementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placementLabel: { ...typography.heading, color: colors.textPrimary },
  placementSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  placementPct: { fontSize: 32, fontWeight: '700', color: colors.accent, letterSpacing: -1 },
  placementTrack: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' },
  placementFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  cohortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  cohortColorDot: { width: 8, height: 8, borderRadius: 4 },
  cohortBarName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', width: 90 },
  cohortBarTrack: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  cohortBarFill: { height: '100%', borderRadius: 3 },
  cohortBarCount: { ...typography.bodySmall, fontWeight: '700', width: 24, textAlign: 'right' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recentName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  recentCohort: { ...typography.caption, color: colors.textSecondary },
  stageChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  stageChipText: { ...typography.caption, fontWeight: '700' },
});
