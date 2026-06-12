import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { ProfileScreen } from './ProfileScreen';
import { fetchAnnouncements, fetchCohorts, fetchMoodleScores, fetchStudentStats } from '@/data/api';
import { Cohort } from '@/types';
import { Announcement, MoodleCourseScore, StudentStats } from '@/types';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { colors, radius, shadow, spacing, typography } from '@/theme';

function useEntrance(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, damping: 16, stiffness: 120 }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

/** My Placement & Bond — shown to trainees on placement / extension / bench. */
function PlacementBondCard({ stats }: { stats: StudentStats }) {
  const onPlacement = stats.lifecycleStage === 'on-placement' || stats.lifecycleStage === 'extended';
  const onBench = stats.lifecycleStage === 'job-hunting';
  if (!onPlacement && !onBench) return null;

  const served = stats.bondServedMonths ?? 0;
  const required = stats.bondMonths ?? 36;
  const fixed = stats.bondMode === 'end_date';
  let pct = 0;
  let leftLabel = '';
  if (fixed && stats.bondEndDate) {
    const total = required * 30.44;
    const daysLeft = Math.max(0, (new Date(stats.bondEndDate).getTime() - Date.now()) / 86400000);
    pct = Math.min(1, Math.max(0, 1 - daysLeft / total));
    leftLabel = daysLeft <= 0 ? 'Bond completed 🎉' : `${Math.ceil(daysLeft / 30.44)} months to go · ends ${stats.bondEndDate}`;
  } else {
    pct = Math.min(1, served / required);
    const left = Math.max(0, required - served);
    leftLabel = left <= 0 ? 'Bond completed 🎉' : `${left.toFixed(1)} months to go`;
  }

  return (
    <Card elevated style={pb.card}>
      <View style={pb.headRow}>
        <Text style={pb.emoji}>{onPlacement ? '💼' : '🧭'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={pb.title}>{onPlacement ? 'My Placement' : 'Between placements'}</Text>
          {onPlacement && stats.placementCompany ? (
            <Text style={pb.sub}>{[stats.placementRole, stats.placementCompany].filter(Boolean).join(' @ ')}</Text>
          ) : (
            <Text style={pb.sub}>{onBench ? 'The Red Alpha team is matching you with your next role' : ''}</Text>
          )}
        </View>
        {stats.lifecycleStage === 'extended' && (
          <View style={pb.extTag}><Text style={pb.extTagText}>Extended</Text></View>
        )}
      </View>

      {onPlacement && stats.reportingOfficer ? (
        <View style={pb.roRow}>
          <Text style={pb.roLabel}>Reporting officer</Text>
          <Text style={pb.roValue}>{stats.reportingOfficer}</Text>
        </View>
      ) : null}

      <View style={pb.bondRow}>
        <Text style={pb.bondLabel}>Bond progress</Text>
        <Text style={pb.bondValue}>{served.toFixed(1)} / {required} mo</Text>
      </View>
      <ProgressBar progress={pct} color={pct >= 1 ? colors.accent : colors.primary} height={8} />
      <Text style={pb.bondLeft}>{leftLabel}</Text>
      {!fixed && onBench ? (
        <Text style={pb.pauseNote}>⏸ Your bond clock pauses while on the bench — it resumes when your next placement starts.</Text>
      ) : null}
    </Card>
  );
}

const pb = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 28 },
  title: { ...typography.heading, color: colors.textPrimary },
  sub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  extTag: { backgroundColor: '#ECFDFF', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  extTagText: { fontSize: 11, fontWeight: '700', color: '#0E7090' },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  roLabel: { ...typography.caption, color: colors.textTertiary },
  roValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  bondRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  bondLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  bondValue: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700' },
  bondLeft: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  pauseNote: { ...typography.caption, color: colors.textSecondary, backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.xs, lineHeight: 18 },
});

function SectionLabel({ title }: { title: string }) {
  return <Text style={sStyles.sectionLabel}>{title}</Text>;
}

function countdownDays(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------------------------------------
// Journey tracker
// ---------------------------------------------------------------------------

const JOURNEY_STAGES: Array<{ key: import('@/types').StudentLifecycleStage; label: string; emoji: string }> = [
  { key: 'on-course',      label: 'On Course',   emoji: '📚' },
  { key: 'job-hunting',    label: 'Job Hunting',  emoji: '🔍' },
  { key: 'on-placement',   label: 'Placement',    emoji: '💼' },
  { key: 'bond-completed', label: 'Bond Done',    emoji: '🏅' },
];

function JourneyTracker({ stage }: { stage: import('@/types').StudentLifecycleStage }) {
  const currentIdx = JOURNEY_STAGES.findIndex((s) => s.key === stage);
  const activeIdx = currentIdx < 0 ? 0 : currentIdx;

  return (
    <View style={jStyles.container}>
      <Text style={jStyles.title}>Your Journey</Text>
      <View style={jStyles.track}>
        {JOURNEY_STAGES.map((s, i) => {
          const isCompleted = i < activeIdx;
          const isCurrent = i === activeIdx;
          const isFuture = i > activeIdx;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <View style={[jStyles.line, isCompleted || isCurrent ? jStyles.lineActive : jStyles.lineFuture]} />
              )}
              <View style={jStyles.node}>
                <View style={[
                  jStyles.dot,
                  isCompleted && jStyles.dotCompleted,
                  isCurrent && jStyles.dotCurrent,
                  isFuture && jStyles.dotFuture,
                ]}>
                  <Text style={[jStyles.dotEmoji, isFuture && jStyles.dotEmojiFuture]}>
                    {isCompleted ? '✓' : s.emoji}
                  </Text>
                </View>
                <Text style={[jStyles.nodeLabel, isCurrent && jStyles.nodeLabelCurrent, isFuture && jStyles.nodeLabelFuture]}>
                  {s.label}
                </Text>
                {isCurrent && <View style={jStyles.currentPip} />}
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const jStyles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderLight, ...shadow.sm },
  title: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.lg },
  track: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  line: { flex: 1, height: 2, marginTop: 18, marginHorizontal: -2, zIndex: 0 },
  lineActive: { backgroundColor: colors.primary },
  lineFuture: { backgroundColor: colors.borderLight },
  node: { alignItems: 'center', zIndex: 1, width: 56 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  dotCompleted: { backgroundColor: colors.primary },
  dotCurrent: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  dotFuture: { backgroundColor: colors.borderLight },
  dotEmoji: { fontSize: 16 },
  dotEmojiFuture: { opacity: 0.4 },
  nodeLabel: { ...typography.label, color: colors.textPrimary, textAlign: 'center', fontSize: 10, fontWeight: '600' },
  nodeLabelCurrent: { color: colors.primary },
  nodeLabelFuture: { color: colors.textTertiary },
  currentPip: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 4 },
});

// ---------------------------------------------------------------------------
// Progress / Placement toggle card
// ---------------------------------------------------------------------------

type ProgressMode = 'bootcamp' | 'placement';

function ProgressCard({
  stats, scores, cohortColor,
}: {
  stats: StudentStats;
  scores: MoodleCourseScore[];
  cohortColor: string;
}) {
  const [mode, setMode] = useState<ProgressMode>('bootcamp');
  const hasPlacement = Boolean(stats.placementCompany || stats.bondEndDate);

  const daysLeft = countdownDays(stats.bootcampEndDate);
  const totalDays = Math.max(1, Math.ceil(
    (new Date(stats.bootcampEndDate).getTime() - new Date(stats.bootcampStartDate).getTime()) / 86400000
  ));
  const progressPct = Math.max(0, Math.min(1, 1 - daysLeft / totalDays));
  const avgGrade = scores.filter((s) => s.grade > 0).length > 0
    ? Math.round(scores.filter((s) => s.grade > 0).reduce((sum, s) => sum + s.grade, 0) / scores.filter((s) => s.grade > 0).length)
    : 0;
  const bondDaysLeft = stats.bondEndDate ? countdownDays(stats.bondEndDate) : null;

  return (
    <Card elevated style={styles.progressCard}>
      {/* Toggle pills */}
      <View style={styles.progressToggle}>
        <TouchableOpacity
          style={[styles.togglePill, mode === 'bootcamp' && styles.togglePillActive]}
          onPress={() => setMode('bootcamp')}
        >
          <Text style={[styles.toggleText, mode === 'bootcamp' && styles.toggleTextActive]}>📊 Bootcamp</Text>
        </TouchableOpacity>
        {hasPlacement && (
          <TouchableOpacity
            style={[styles.togglePill, mode === 'placement' && styles.togglePillActive]}
            onPress={() => setMode('placement')}
          >
            <Text style={[styles.toggleText, mode === 'placement' && styles.toggleTextActive]}>💼 Placement</Text>
          </TouchableOpacity>
        )}
      </View>

      {mode === 'bootcamp' ? (
        <>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Bootcamp Progress</Text>
            <Text style={styles.progressPct}>{Math.round(progressPct * 100)}%</Text>
          </View>
          <ProgressBar progress={progressPct} color={cohortColor} height={10} />
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{daysLeft}</Text>
              <Text style={styles.statLabel}>Days left</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: avgGrade >= 60 ? colors.accent : colors.error }]}>
                {avgGrade > 0 ? `${avgGrade}%` : '—'}
              </Text>
              <Text style={styles.statLabel}>Avg grade</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{scores.filter((s) => s.grade >= s.passingGrade && s.grade > 0).length}/{scores.length}</Text>
              <Text style={styles.statLabel}>Passed</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.placementRow}>
            <View style={[styles.placementIcon, { backgroundColor: colors.accentLight }]}>
              <Text style={{ fontSize: 24 }}>💼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placementCompany}>{stats.placementCompany ?? 'Company TBD'}</Text>
              <Text style={styles.placementRole}>{stats.placementRole ?? 'Role TBD'}</Text>
            </View>
          </View>
          {stats.reportingOfficer && (
            <View style={styles.placementDetail}>
              <Text style={styles.placementDetailLabel}>Reporting Officer</Text>
              <Text style={styles.placementDetailValue}>{stats.reportingOfficer}</Text>
            </View>
          )}
          {bondDaysLeft !== null && (
            <View style={styles.bondCountdown}>
              <Text style={styles.bondLabel}>Bond ends</Text>
              <Text style={[styles.bondDays, { color: bondDaysLeft > 180 ? colors.accent : colors.warning }]}>
                {bondDaysLeft} days remaining
              </Text>
              {stats.bondEndDate && (
                <Text style={styles.bondDate}>
                  {new Date(stats.bondEndDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Red Alpha team contacts
// ---------------------------------------------------------------------------

const RA_CONTACTS = [
  { name: 'Ron', role: 'Head of Training', emoji: '🎓', email: 'ron@redalpha.sg', color: '#2563EB' },
  { name: 'Vivian', role: 'Program Administrator', emoji: '📋', email: 'vivian@redalpha.sg', color: '#7C3AED' },
  { name: 'Yoav', role: 'Red Alpha Manager', emoji: '🏢', email: 'yoav@redalpha.sg', color: '#DC2626' },
];

function ContactCard({ contact }: { contact: typeof RA_CONTACTS[0] }) {
  function handleEmail() {
    Linking.openURL(`mailto:${contact.email}`).catch(() =>
      Alert.alert('Cannot open email', `You can reach ${contact.name} at ${contact.email}`)
    );
  }
  return (
    <TouchableOpacity onPress={handleEmail} activeOpacity={0.82}>
      <View style={contactStyles.card}>
        <View style={[contactStyles.avatar, { backgroundColor: contact.color + '18' }]}>
          <Text style={{ fontSize: 22 }}>{contact.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={contactStyles.name}>{contact.name}</Text>
          <Text style={contactStyles.role}>{contact.role}</Text>
        </View>
        <View style={[contactStyles.emailChip, { backgroundColor: contact.color + '12' }]}>
          <Text style={[contactStyles.emailText, { color: contact.color }]}>Email →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const contactStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avatar: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.heading, color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  emailChip: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full },
  emailText: { fontSize: 11, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function HomeScreen() {
  const { user, accessToken, cohortId, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  function handleSignOut() {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm('Sign out?')) signOut();
      return;
    }
    Alert.alert('Sign out', 'Sign out of the demo account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const [stats, setStats] = useState<StudentStats | null>(null);
  const [scores, setScores] = useState<MoodleCourseScore[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  const heroStyle = useEntrance(0);
  const statsStyle = useEntrance(120);
  const gradeStyle = useEntrance(220);
  const announcStyle = useEntrance(320);

  const [refreshing, setRefreshing] = useState(false);
  function loadAll() {
    return Promise.all([
      fetchStudentStats(accessToken),
      fetchMoodleScores(accessToken),
      fetchAnnouncements(accessToken),
      fetchCohorts(accessToken).catch(() => [] as Cohort[]),
    ]).then(([s, sc, a, cs]) => {
      setStats(s);
      setScores(sc);
      setAnnouncements(a.filter((x) => x.audience !== 'staff'));
      setCohorts(cs);
    });
  }
  useEffect(() => { loadAll(); }, []);
  function onRefresh() { setRefreshing(true); loadAll().finally(() => setRefreshing(false)); }

  const cohort = cohorts.find((c) => c.id === cohortId || c.name === cohortId) ?? cohorts.find((c) => c.active);
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';
  const topAnnouncement = announcements.find((a) => a.pinned) ?? announcements[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Hero header ── */}
      <View style={styles.hero}>
        <View style={styles.decBlob} />
        <Animated.View style={heroStyle}>
          <View style={styles.heroTop}>
            <Text style={styles.greeting}>{greetingText()}</Text>
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
          {/* Name is now tappable to open profile */}
          <TouchableOpacity onPress={() => setShowProfile(true)} activeOpacity={0.75}>
            <Text style={styles.name}>{firstName} 👋</Text>
            <Text style={styles.nameHint}>Tap to edit profile</Text>
          </TouchableOpacity>
          <View style={styles.cohortChip}>
            <View style={[styles.cohortDot, { backgroundColor: cohort?.color ?? colors.primary }]} />
            <Text style={styles.cohortLabel}>{cohort?.name ?? 'Select cohort'} · {cohort?.track ?? ''}</Text>
          </View>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* ── Progress / Placement card ── */}
        {stats && (
          <Animated.View style={statsStyle}>
            <ProgressCard stats={stats} scores={scores} cohortColor={cohort?.color ?? colors.primary} />
          </Animated.View>
        )}

        {/* ── Journey tracker ── */}
        {stats?.lifecycleStage && (
          <Animated.View style={statsStyle}>
            <JourneyTracker stage={stats.lifecycleStage} />
          </Animated.View>
        )}

        {/* ── My placement & bond ── */}
        {stats && (
          <Animated.View style={statsStyle}>
            <PlacementBondCard stats={stats} />
          </Animated.View>
        )}

        {/* ── Grades ── */}
        {scores.length > 0 && (
          <Animated.View style={gradeStyle}>
            <SectionLabel title="Modules" />
            {scores.map((score) => (
              <Card key={score.courseId} style={styles.gradeCard}>
                <View style={styles.gradeRow}>
                  <Text style={styles.gradeName} numberOfLines={1}>{score.courseName}</Text>
                  <Text style={[styles.gradeValue, { color: score.grade >= score.passingGrade ? colors.accent : colors.error }]}>
                    {score.grade > 0 ? `${score.grade}%` : '—'}
                  </Text>
                </View>
                <ProgressBar progress={score.grade / 100} color={score.grade >= score.passingGrade ? colors.accent : colors.error} height={6} />
                <Text style={styles.gradeActivities}>{score.completedActivities}/{score.totalActivities} activities</Text>
              </Card>
            ))}
          </Animated.View>
        )}

        {/* ── Latest announcement ── */}
        {topAnnouncement && (
          <Animated.View style={announcStyle}>
            <SectionLabel title="Latest" />
            <Card elevated style={styles.announcCard}>
              {topAnnouncement.pinned && (
                <View style={styles.pinBadge}><Text style={styles.pinText}>📌 Pinned</Text></View>
              )}
              <Text style={styles.announcTitle}>{topAnnouncement.title}</Text>
              <Text style={styles.announcBody} numberOfLines={3}>{topAnnouncement.body}</Text>
            </Card>
          </Animated.View>
        )}

        {/* ── Team contacts ── */}
        <Animated.View style={announcStyle}>
          <SectionLabel title="Red Alpha Team" />
          <Card elevated style={{ paddingHorizontal: spacing.md }}>
            {RA_CONTACTS.map((c) => <ContactCard key={c.name} contact={c} />)}
          </Card>
        </Animated.View>

        <View style={{ height: spacing.xxxl * 2 }} />
      </ScrollView>

      <ProfileScreen visible={showProfile} onClose={() => setShowProfile(false)} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.xs,
    overflow: 'hidden',
  },
  decBlob: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(220,38,38,0.08)', top: -60, right: -60,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  greeting: { ...typography.bodySmall, color: 'rgba(255,255,255,0.55)' },
  signOutBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  signOutText: { ...typography.caption, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  name: { ...typography.title, color: '#FFF', marginBottom: 2 },
  nameHint: { ...typography.caption, color: 'rgba(255,255,255,0.35)', marginBottom: spacing.sm },
  cohortChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: radius.full,
  },
  cohortDot: { width: 8, height: 8, borderRadius: 4 },
  cohortLabel: { ...typography.label, color: 'rgba(255,255,255,0.80)', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },

  // Progress card
  progressCard: { gap: spacing.md },
  progressToggle: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  togglePill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  togglePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { ...typography.label, color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: '#FFF' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { ...typography.heading, color: colors.textPrimary },
  progressPct: { ...typography.headline2, color: colors.primary },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.headline2, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },

  // Placement view
  placementRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  placementIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  placementCompany: { ...typography.heading, color: colors.textPrimary },
  placementRole: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  placementDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  placementDetailLabel: { ...typography.caption, color: colors.textTertiary },
  placementDetailValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  bondCountdown: {
    backgroundColor: colors.accentLight, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  bondLabel: { ...typography.caption, color: colors.textTertiary },
  bondDays: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  bondDate: { ...typography.caption, color: colors.textSecondary },

  // Grades
  gradeCard: { marginBottom: spacing.sm, gap: spacing.xs },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gradeName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  gradeValue: { ...typography.heading, fontWeight: '700' },
  gradeActivities: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  // Announcement
  announcCard: { gap: spacing.xs },
  pinBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginBottom: spacing.xs },
  pinText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  announcTitle: { ...typography.heading, color: colors.textPrimary },
  announcBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
});

const sStyles = StyleSheet.create({
  sectionLabel: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.sm },
});
