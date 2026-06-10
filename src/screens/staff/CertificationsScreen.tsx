import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchStaffStudentRoster } from '@/data/api';
import { StaffStudentRecord } from '@/types';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { colors, radius, shadow, spacing, typography } from '@/theme';

const CERT_STATUS_VARIANT: Record<string, 'accent' | 'primary' | 'neutral'> = {
  completed: 'accent',
  'in-progress': 'primary',
  'not-started': 'neutral',
};

const STAGE_COLORS: Record<string, string> = {
  'on-course': colors.primary,
  'job-hunting': colors.warning,
  'on-placement': colors.accent,
  'bond-completed': colors.purple,
  withdrawn: colors.error,
};

const AVATAR_COLORS = [colors.primary, colors.purple, colors.accent, colors.warning, colors.orange];

function StudentCard({ student, index }: { student: StaffStudentRecord; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 350, delay: Math.min(index, 8) * 50, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: Math.min(index, 8) * 50, useNativeDriver: true, damping: 16, stiffness: 110 }),
    ]).start();
  }, []);

  const stageColor = STAGE_COLORS[student.stage] ?? colors.textSecondary;
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const completedCerts = student.certifications.filter((c) => (c as any).status === 'completed').length;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.9}>
        <View style={styles.studentCard}>
          <View style={styles.cardRow}>
            <Avatar name={student.name} size={46} color={avatarColor} />
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentMeta}>{student.cohortName}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.stageChip, { backgroundColor: stageColor + '18' }]}>
                  <Text style={[styles.stageChipText, { color: stageColor }]}>
                    {student.stage.replace('-', ' ')}
                  </Text>
                </View>
                {completedCerts > 0 && (
                  <View style={styles.certCountChip}>
                    <Text style={styles.certCountText}>✅ {completedCerts} cert{completedCerts !== 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.expandArrow}>{expanded ? '▲' : '▼'}</Text>
          </View>

          {expanded && student.certifications.length > 0 && (
            <View style={styles.certList}>
              {student.certifications.map((c) => (
                <View key={c.id} style={styles.certItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certName}>{c.name}</Text>
                    <Text style={styles.certIssuer}>{c.provider}</Text>
                  </View>
                  <Badge
                    label={c.earnedAt ? 'completed' : 'in progress'}
                    variant={c.earnedAt ? 'accent' : 'primary'}
                    size="sm"
                  />
                </View>
              ))}
            </View>
          )}

          {expanded && student.certifications.length === 0 && (
            <View style={styles.noCerts}>
              <Text style={styles.noCertsText}>No certifications yet</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CertificationsScreen() {
  const { accessToken } = useAuth();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffStudentRoster(accessToken).then(setStudents);
  }, []);

  const cohorts = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.cohortName))).sort();
  }, [students]);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      const matchesQuery = !query || s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.certifications.some((c) => c.name.toLowerCase().includes(query.toLowerCase()));
      const matchesCohort = !selectedCohort || s.cohortName === selectedCohort;
      return matchesQuery && matchesCohort;
    });
  }, [students, query, selectedCohort]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Certifications</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search students or certifications..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {/* Cohort filter */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCohort && styles.filterChipActive]}
            onPress={() => setSelectedCohort(null)}
          >
            <Text style={[styles.filterChipText, !selectedCohort && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {cohorts.map((cohort) => (
            <TouchableOpacity
              key={cohort}
              style={[styles.filterChip, selectedCohort === cohort && styles.filterChipActive]}
              onPress={() => setSelectedCohort(cohort === selectedCohort ? null : cohort)}
            >
              <Text style={[styles.filterChipText, selectedCohort === cohort && styles.filterChipTextActive]}>
                {cohort}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!students ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.countLabel}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''} ·{' '}
            {filtered.reduce((sum, s) => sum + s.certifications.length, 0)} certifications
          </Text>
          {filtered.map((student, i) => (
            <StudentCard key={student.studentId} student={student} index={i} />
          ))}
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.headline2,
    color: '#FFF',
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: '#FFF',
    paddingVertical: spacing.sm + 2,
  },
  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.xs,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.label, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  countLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  studentName: { ...typography.heading, color: colors.textPrimary },
  studentMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  stageChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  stageChipText: { ...typography.caption, fontWeight: '700', textTransform: 'capitalize' },
  certCountChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
  },
  certCountText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  expandArrow: { fontSize: 10, color: colors.textTertiary },
  certList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  certName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  certIssuer: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  noCerts: { padding: spacing.md, alignItems: 'center' },
  noCertsText: { ...typography.bodySmall, color: colors.textTertiary },
});
