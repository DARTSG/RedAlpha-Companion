import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchCohorts } from '@/data/api';
import { Cohort } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

function CohortCard({
  cohort,
  selected,
  index,
  onPress,
}: {
  cohort: Cohort;
  selected: boolean;
  index: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 80,
      useNativeDriver: true,
      damping: 14,
      stiffness: 100,
    }).start();
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
    onPress();
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (iso?: string) => {
    if (!iso || iso === 'TBD') return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };
  const startLabel = fmt(cohort.startDate);
  const endLabel = fmt(cohort.endDate);
  const dateRange = startLabel && endLabel ? `${startLabel} – ${endLabel}`
    : startLabel ? `Starts ${startLabel}`
    : 'Dates to be confirmed';
  const shortCode = cohort.name.match(/\d+/)?.[0] ?? cohort.name.slice(0, 2).toUpperCase();

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }] }}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1}>
        <View
          style={[
            styles.cohortCard,
            selected && { borderColor: cohort.color, borderWidth: 2.5 },
          ]}
        >
          {/* Color accent bar */}
          <View style={[styles.accentBar, { backgroundColor: cohort.color }]} />

          <View style={styles.cohortCardBody}>
            <View style={styles.cohortCardLeft}>
              <View style={[styles.cohortDot, { backgroundColor: cohort.color + '22', borderColor: cohort.color + '55' }]}>
                <Text style={[styles.cohortDotText, { color: cohort.color }]}>
                  {shortCode}
                </Text>
              </View>
            </View>

            <View style={styles.cohortCardMid}>
              <Text style={styles.cohortName}>{cohort.name}</Text>
              <Text style={styles.cohortTrack}>{cohort.track}</Text>
              <Text style={styles.cohortDate}>{dateRange}</Text>

              <View style={styles.cohortMeta}>
                {cohort.studentCount > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: cohort.color + '18' }]}>
                    <Text style={[styles.metaChipText, { color: cohort.color }]}>
                      {cohort.studentCount} students
                    </Text>
                  </View>
                )}
                {cohort.active && (
                  <View style={[styles.metaChip, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.metaChipText, { color: colors.accent }]}>Active</Text>
                  </View>
                )}
              </View>
            </View>

            {selected && (
              <View style={[styles.checkCircle, { backgroundColor: cohort.color }]}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>✓</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CohortPickerScreen() {
  const { user, accessToken, selectCohort } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchCohorts(accessToken).then((all) => {
      // Only cohorts a new student can join: active, and not already finished.
      const today = new Date().toISOString().slice(0, 10);
      const open = all.filter((c) => {
        if (!c.active) return false;
        const end = c.endDate && c.endDate !== 'TBD' ? c.endDate : null;
        return !end || end >= today;
      });
      const sorted = [...(open.length ? open : all)].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
      setCohorts(sorted);
    });
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.timing(btnAnim, { toValue: 1, duration: 400, delay: 600, useNativeDriver: true }).start();
  }, []);

  async function handleConfirm() {
    if (!selectedId || confirming) return;
    setConfirming(true);
    await selectCohort(selectedId);
    // RootNavigator will react to cohortId change automatically
  }

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
        ]}
      >
        <Text style={styles.greeting}>Hey {firstName}! 👋</Text>
        <Text style={styles.heading}>Which cohort are you in?</Text>
        <Text style={styles.sub}>Choose your Red Alpha cohort so we can show you the right schedule, syllabus, and updates.</Text>
      </Animated.View>

      {/* Cohort cards */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {cohorts.map((cohort, i) => (
          <CohortCard
            key={cohort.id}
            cohort={cohort}
            selected={selectedId === cohort.id}
            index={i}
            onPress={() => setSelectedId(cohort.id)}
          />
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirm button */}
      <Animated.View style={[styles.bottomBar, { opacity: btnAnim }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, !selectedId && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedId || confirming}
          activeOpacity={0.84}
        >
          <Text style={styles.confirmBtnText}>
            {confirming ? 'Confirming…' : selectedId ? 'Confirm cohort →' : 'Select a cohort'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.headerBg,
  },
  greeting: { ...typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  heading: { ...typography.headline2, color: '#FFF', marginBottom: spacing.sm },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.72)', lineHeight: 22 },

  list: { padding: spacing.lg, gap: spacing.md },

  cohortCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadow.sm,
  },
  accentBar: { height: 4 },
  cohortCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cohortCardLeft: {},
  cohortDot: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cohortDotText: { fontSize: 18, fontWeight: '800' },
  cohortCardMid: { flex: 1 },
  cohortName: { ...typography.heading, color: colors.textPrimary, marginBottom: 2 },
  cohortTrack: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 4 },
  cohortDate: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  cohortMeta: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  metaChipText: { fontSize: 11, fontWeight: '600' },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadow.md,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadow.sm,
  },
  confirmBtnDisabled: { backgroundColor: colors.border },
  confirmBtnText: { ...typography.heading, color: '#FFF' },
});
