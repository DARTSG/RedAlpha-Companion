import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchCourses, fetchStudentStats } from '@/data/api';
import { applyToCourse, fetchMyApplications } from '@/data/managementApi';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Course, Certification } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

const TRACK_EMOJI: Record<string, string> = {
  cybersecurity: '🔐',
  ai: '🤖',
  data: '📊',
  cloud: '☁️',
  network: '🌐',
  software: '💻',
};



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRange(startIso: string, endIso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

// ---------------------------------------------------------------------------
// Course card (Luma-style)
// ---------------------------------------------------------------------------

function CourseCard({ course, index, myStatus, onApply }: {
  course: Course; index: number;
  myStatus?: 'pending' | 'confirmed' | 'declined';
  onApply: (course: Course) => Promise<void>;
}) {
  const initial = myStatus === 'pending' ? 'applied' : myStatus === 'confirmed' ? 'confirmed' : course.status;
  const [status, setStatus] = useState(initial);
  useEffect(() => { setStatus(initial); }, [initial]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        delay: Math.min(index, 6) * 60,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: Math.min(index, 6) * 60,
        useNativeDriver: true,
        damping: 16,
        stiffness: 110,
      }),
    ]).start();
  }, []);

  function submitApplication() {
    setStatus('applied'); // optimistic
    onApply(course).catch((e) => {
      setStatus(course.status);
      Alert.alert('Could not apply', e?.message ?? 'Please try again.');
    });
  }
  function handleApply() {
    if (status === 'applied' || status === 'confirmed') return;
    const msg = `${course.title}\n${formatDateRange(course.startDate, course.endDate)}\n\nYour application will be reviewed by the Red Alpha team.`;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      // RN Alert buttons don't fire on web
      if (window.confirm(`Apply for this course?\n\n${msg}`)) submitApplication();
      return;
    }
    Alert.alert('Apply for this course?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: submitApplication },
    ]);
  }

  const days = daysUntil(course.startDate);
  const isClosed = status === 'closed';
  const isApplied = status === 'applied' || status === 'confirmed';
  const spotsLow = course.spotsRemaining <= 5 && course.spotsRemaining > 0;

  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.courseCard, isClosed && styles.courseCardDimmed]}>
        {/* Coloured track header */}
        <View style={[styles.courseHeader, { backgroundColor: course.color }]}>
          <View style={styles.courseHeaderLeft}>
            <Text style={{ fontSize: 28 }}>{TRACK_EMOJI[course.track as string] ?? '📚'}</Text>
            <View>
              <Text style={styles.courseTrackLabel}>{course.track.toUpperCase()}</Text>
              <Text style={styles.courseProvider}>{course.provider}</Text>
            </View>
          </View>
          {/* Date chip */}
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{days > 0 ? `In ${days}d` : 'Soon'}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.courseBody}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.dateText}>{formatDateRange(course.startDate, course.endDate)} · 1 week</Text>
          </View>
          <Text style={styles.courseDesc}>{course.description}</Text>

          {/* Footer: spots + apply button */}
          <View style={styles.courseFooter}>
            <View>
              {spotsLow && !isClosed ? (
                <View style={styles.spotsLowChip}>
                  <Text style={styles.spotsLowText}>🔥 Only {course.spotsRemaining} spots left</Text>
                </View>
              ) : isClosed ? (
                <Text style={styles.spotsText}>Closed</Text>
              ) : (
                <Text style={styles.spotsText}>{course.spotsRemaining} / {course.spotsTotal} spots</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleApply}
              disabled={isClosed || isApplied}
              style={[
                styles.applyBtn,
                isApplied && styles.applyBtnApplied,
                isClosed && styles.applyBtnClosed,
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.applyBtnText, isApplied && styles.applyBtnTextApplied]}>
                {status === 'confirmed' ? '✓ Confirmed' : status === 'applied' ? '✓ Applied' : isClosed ? 'Closed' : 'Apply →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Certification tracker
// ---------------------------------------------------------------------------

const CERT_STATUS_CONFIG = {
  completed: { label: 'Completed', color: colors.accent, bg: colors.accentLight, icon: '✅' },
  'in-progress': { label: 'In Progress', color: colors.primary, bg: colors.primaryLight, icon: '⏳' },
  'not-started': { label: 'Not Started', color: colors.textTertiary, bg: colors.borderLight, icon: '○' },
};

function CertRow({ cert }: { cert: Certification }) {
  const certStatus = cert.earnedAt ? 'completed' : 'not-started';
  const cfg = CERT_STATUS_CONFIG[certStatus] ?? CERT_STATUS_CONFIG['not-started'];
  return (
    <View style={certStyles.row}>
      <Text style={{ fontSize: 16, marginRight: spacing.sm }}>{cfg.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={certStyles.certName}>{cert.name}</Text>
        <Text style={certStyles.certIssuer}>{cert.provider}</Text>
      </View>
      <View style={[certStyles.statusChip, { backgroundColor: cfg.bg }]}>
        <Text style={[certStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

const certStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  certName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  certIssuer: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  statusChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function UpskillingScreen() {
  const { accessToken, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [myApps, setMyApps] = useState<Record<string, 'pending' | 'confirmed' | 'declined'>>({});
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchCourses(accessToken).then(setCourses);
    fetchStudentStats(accessToken).then((s) => setCerts(s.certifications));
    if (user && isSupabaseConfigured) {
      fetchMyApplications(user.id).then((apps) => {
        const m: Record<string, 'pending' | 'confirmed' | 'declined'> = {};
        apps.forEach((a) => { m[a.courseId] = a.status; });
        setMyApps(m);
      }).catch(() => {});
    }
  }, []);

  async function handleApply(course: Course) {
    if (!user) return;
    await applyToCourse(course.id, user.id, user.displayName, user.email);
    setMyApps((prev) => ({ ...prev, [course.id]: 'pending' }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Dark header */}
      <View style={styles.header}>
        <Animated.View style={{ opacity: headerAnim }}>
          <Text style={styles.headerEyebrow}>RED ALPHA</Text>
          <Text style={styles.headerTitle}>Upskill</Text>
          <Text style={styles.headerSub}>1-week courses for Alphas on placement</Text>
        </Animated.View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Courses section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Courses</Text>
          <Text style={styles.sectionSub}>Apply early — spots fill fast</Text>
        </View>

        {courses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>📚</Text>
            <Text style={styles.emptyText}>No courses scheduled yet</Text>
          </View>
        ) : (
          courses.map((c, i) => <CourseCard key={c.id} course={c} index={i} myStatus={myApps[c.id]} onApply={handleApply} />)
        )}

        {/* Certifications tracker */}
        {certs.length > 0 && (
          <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
            <Text style={styles.sectionTitle}>My Certifications</Text>
            <Text style={styles.sectionSub}>Track your credential progress</Text>
          </View>
        )}
        {certs.length > 0 && (
          <View style={styles.certsCard}>
            {certs.map((c) => (
              <CertRow key={c.id} cert={c} />
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  headerTitle: { ...typography.headline2, color: '#FFF' },
  headerSub: { ...typography.bodySmall, color: colors.headerSub, marginTop: 4 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },

  sectionHeader: { marginBottom: spacing.xs },
  sectionTitle: { ...typography.title, color: colors.textPrimary },
  sectionSub: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  // Course card
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.md,
  },
  courseCardDimmed: { opacity: 0.6 },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  courseHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  courseTrackLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.75)',
  },
  courseProvider: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  datePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  datePillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  courseBody: { padding: spacing.lg, gap: spacing.sm },
  courseTitle: { ...typography.title, color: colors.textPrimary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dateIcon: { fontSize: 13 },
  dateText: { ...typography.bodySmall, color: colors.textSecondary },
  courseDesc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  courseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  spotsText: { ...typography.caption, color: colors.textTertiary },
  spotsLowChip: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  spotsLowText: { fontSize: 11, fontWeight: '700', color: colors.orange },

  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  applyBtnApplied: { backgroundColor: colors.accentLight },
  applyBtnClosed: { backgroundColor: colors.borderLight },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  applyBtnTextApplied: { color: colors.accent },

  // Certs
  certsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: spacing.huge },
  emptyText: { ...typography.body, color: colors.textTertiary },
});
