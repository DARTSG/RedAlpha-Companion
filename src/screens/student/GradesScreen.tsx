import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchMoodleScores } from '@/data/api';
import { MoodleCourseScore } from '@/types';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Badge } from '@/components/Badge';
import { colors, radius, spacing, typography } from '@/theme';

function GradeCard({ score, index }: { score: MoodleCourseScore; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 380, delay: index * 90, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: index * 90, useNativeDriver: true, damping: 16, stiffness: 110 }),
    ]).start();
  }, []);

  const isPassed = score.grade >= score.passingGrade;
  const isStarted = score.grade > 0;
  const activityPct = score.totalActivities > 0 ? score.completedActivities / score.totalActivities : 0;
  const gradeColor = !isStarted ? colors.textTertiary : isPassed ? colors.accent : colors.error;
  const badgeVariant: 'neutral' | 'accent' | 'error' = !isStarted ? 'neutral' : isPassed ? 'accent' : 'error';
  const badgeLabel = !isStarted ? 'Not started' : isPassed ? 'Passed' : 'Below passing';

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <Card elevated style={styles.gradeCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.gradeCircle, { borderColor: gradeColor }]}>
            <Text style={[styles.gradeNum, { color: gradeColor }]}>
              {isStarted ? `${score.grade}` : '—'}
            </Text>
            {isStarted && <Text style={styles.gradePercent}>%</Text>}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.courseName}>{score.courseName}</Text>
            <Badge label={badgeLabel} variant={badgeVariant} size="sm" />
            <Text style={styles.lastUpdated}>
              Updated {new Date(score.lastUpdated).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Grade</Text>
            <Text style={[styles.progressValue, { color: gradeColor }]}>
              {isStarted ? `${score.grade} / 100` : 'Not attempted'}
            </Text>
          </View>
          <ProgressBar progress={score.grade / 100} color={gradeColor} height={7} />

          <View style={[styles.progressRow, { marginTop: spacing.sm }]}>
            <Text style={styles.progressLabel}>Activities completed</Text>
            <Text style={styles.progressValue}>{score.completedActivities} / {score.totalActivities}</Text>
          </View>
          <ProgressBar progress={activityPct} color={colors.primary} height={7} />
          <Text style={styles.passingNote}>Passing grade: {score.passingGrade}%</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

export function GradesScreen() {
  const { accessToken } = useAuth();
  const [scores, setScores] = useState<MoodleCourseScore[] | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchMoodleScores(accessToken).then(setScores);
  }, []);

  if (!scores) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const passed = scores.filter((s) => s.grade >= s.passingGrade && s.grade > 0).length;
  const avgGrade = scores.filter((s) => s.grade > 0).length > 0
    ? Math.round(scores.filter((s) => s.grade > 0).reduce((sum, s) => sum + s.grade, 0) / scores.filter((s) => s.grade > 0).length)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <Text style={styles.headerTitle}>My Grades</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{passed}/{scores.length}</Text>
            <Text style={styles.summaryLabel}>Passed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: avgGrade >= 60 ? colors.accent : colors.error }]}>
              {avgGrade > 0 ? `${avgGrade}%` : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Avg grade</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{scores.length}</Text>
            <Text style={styles.summaryLabel}>Modules</Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {scores.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: spacing.md }}>📊</Text>
            <Text style={styles.emptyTitle}>No grades yet</Text>
            <Text style={styles.emptyText}>
              Your grades sync from Moodle. They'll appear here once your modules begin.
            </Text>
          </View>
        ) : scores.map((score, i) => (
          <GradeCard key={score.courseId} score={score} index={i} />
        ))}
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
  },
  headerTitle: { ...typography.headline2, color: '#FFF', marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...typography.headline2, color: '#FFF' },
  summaryLabel: { ...typography.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  scroll: { flex: 1 },
  content: { padding: spacing.lg },
  gradeCard: { marginBottom: spacing.sm, gap: spacing.md },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  gradeCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  gradeNum: { fontSize: 20, fontWeight: '700' },
  gradePercent: { fontSize: 10, color: colors.textTertiary, alignSelf: 'flex-end', marginBottom: 6 },
  cardRight: { flex: 1, gap: 4 },
  courseName: { ...typography.heading, color: colors.textPrimary },
  lastUpdated: { ...typography.caption, color: colors.textTertiary },
  progressSection: { gap: spacing.xs },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...typography.caption, color: colors.textSecondary },
  progressValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  passingNote: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xxl },
  emptyTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs },
  emptyText: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});
