import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { fetchAnnouncements } from '@/data/api';
import { useAnnouncementNotifications } from '@/notifications/useAnnouncementNotifications';
import { Announcement, Course, CourseTrack } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Filter = 'all' | 'pinned';

const AUDIENCE_COLOR: Record<string, { bg: string; text: string }> = {
  all: { bg: colors.primaryLight, text: colors.primary },
  students: { bg: colors.accentLight, text: colors.accent },
  staff: { bg: colors.purpleLight, text: colors.purple },
};

const TRACK_OPTIONS: { value: CourseTrack; label: string; emoji: string }[] = [
  { value: 'cybersecurity', label: 'Cybersecurity', emoji: '🔐' },
  { value: 'ai', label: 'AI & ML', emoji: '🤖' },
  { value: 'data', label: 'Data', emoji: '📊' },
  { value: 'cloud', label: 'Cloud', emoji: '☁️' },
  { value: 'network', label: 'Network', emoji: '🌐' },
  { value: 'software', label: 'Software', emoji: '💻' },
];

const TRACK_COLORS: Record<CourseTrack, string> = {
  cybersecurity: '#DC2626',
  ai: '#7C3AED',
  data: '#0EA5E9',
  cloud: '#10B981',
  network: '#F97316',
  software: '#6366F1',
};

// ---------------------------------------------------------------------------
// Announcement card
// ---------------------------------------------------------------------------

function AnnouncementCard({ item, index }: { item: Announcement; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 360, delay: index * 70, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: index * 70, useNativeDriver: true, damping: 16, stiffness: 110 }),
    ]).start();
  }, []);

  const audienceStyle = AUDIENCE_COLOR[item.audience] ?? AUDIENCE_COLOR.all;
  const relativeTime = (() => {
    const diff = Date.now() - new Date(item.postedAt).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
  })();

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.9}>
        <View style={[styles.card, item.pinned && styles.cardPinned]}>
          {item.pinned && (
            <View style={styles.pinnedStrip}>
              <Text style={styles.pinnedStripText}>📌  Pinned</Text>
            </View>
          )}
          <View style={styles.cardBody}>
            <View style={styles.cardMeta}>
              <View style={[styles.audienceChip, { backgroundColor: audienceStyle.bg }]}>
                <Text style={[styles.audienceText, { color: audienceStyle.text }]}>
                  {item.audience === 'all' ? 'Everyone' : item.audience}
                </Text>
              </View>
              <Text style={styles.timeText}>{relativeTime}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {expanded && <Text style={styles.cardBody2}>{item.body}</Text>}
            {!expanded && (
              <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>
            )}
            {item.author && (
              <Text style={styles.authorText}>— {item.author}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Course card
// ---------------------------------------------------------------------------

function CourseCard({ course, index }: { course: Course; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 360, delay: index * 70, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: index * 70, useNativeDriver: true, damping: 16, stiffness: 110 }),
    ]).start();
  }, []);

  const trackColor = TRACK_COLORS[course.track] ?? colors.primary;
  const spotsLeft = course.spotsRemaining;
  const isFull = spotsLeft <= 0;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <View style={[styles.courseCard, { borderLeftColor: trackColor }]}>
        <View style={styles.courseHeader}>
          <View style={[styles.trackChip, { backgroundColor: trackColor + '18' }]}>
            <Text style={[styles.trackChipText, { color: trackColor }]}>
              {TRACK_OPTIONS.find((t) => t.value === course.track)?.emoji ?? '📚'}{' '}
              {TRACK_OPTIONS.find((t) => t.value === course.track)?.label ?? course.track}
            </Text>
          </View>
          <Text style={styles.courseProvider}>{course.provider}</Text>
        </View>
        <Text style={styles.courseTitle}>{course.title}</Text>
        <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
        <View style={styles.courseMeta}>
          <Text style={styles.courseDate}>📅 {course.startDate} → {course.endDate}</Text>
          <Text style={[styles.courseSpots, isFull && { color: colors.error }]}>
            {isFull ? '⛔ Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
          </Text>
        </View>
        {!isFull && (
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: trackColor }]}
            onPress={() => Alert.alert('Application sent!', `You've applied for "${course.title}".`)}
          >
            <Text style={styles.applyBtnText}>Apply →</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Staff FAB speed-dial
// ---------------------------------------------------------------------------

function StaffFAB({
  onAnnouncement,
  onCourse,
}: {
  onAnnouncement: () => void;
  onCourse: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function toggle() {
    const toValue = open ? 0 : 1;
    Animated.spring(anim, { toValue, useNativeDriver: false, damping: 15, stiffness: 200 }).start();
    setOpen(!open);
  }

  const option1Y = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const option2Y = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] });
  const optionOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  return (
    <View style={fabStyles.container} pointerEvents="box-none">
      {/* Option 2: Add Course */}
      <Animated.View style={[fabStyles.option, { transform: [{ translateY: option2Y }], opacity: optionOpacity }]}>
        <TouchableOpacity
          style={[fabStyles.optionBtn, { backgroundColor: colors.purple }]}
          onPress={() => { setOpen(false); anim.setValue(0); onCourse(); }}
        >
          <Text style={fabStyles.optionIcon}>🚀</Text>
          <Text style={fabStyles.optionLabel}>Add Upskilling</Text>
        </TouchableOpacity>
      </Animated.View>
      {/* Option 1: Post Announcement */}
      <Animated.View style={[fabStyles.option, { transform: [{ translateY: option1Y }], opacity: optionOpacity }]}>
        <TouchableOpacity
          style={[fabStyles.optionBtn, { backgroundColor: colors.primary }]}
          onPress={() => { setOpen(false); anim.setValue(0); onAnnouncement(); }}
        >
          <Text style={fabStyles.optionIcon}>📢</Text>
          <Text style={fabStyles.optionLabel}>Announcement</Text>
        </TouchableOpacity>
      </Animated.View>
      {/* Main FAB */}
      <TouchableOpacity style={fabStyles.fab} onPress={toggle} activeOpacity={0.9}>
        <Animated.Text style={[fabStyles.fabIcon, {
          transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }],
        }]}>
          +
        </Animated.Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Announcement modal (staff)
// ---------------------------------------------------------------------------

function AnnouncementModal({ visible, onClose, onPost }: {
  visible: boolean;
  onClose: () => void;
  onPost: (a: Partial<Announcement>) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'students' | 'staff'>('all');
  const [pinned, setPinned] = useState(false);
  const [type, setType] = useState<'event' | 'update'>('update');

  function handlePost() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Please fill in title and body.');
      return;
    }
    onPost({ title: title.trim(), body: body.trim(), audience, pinned, type });
    setTitle(''); setBody(''); setAudience('all'); setPinned(false); setType('update');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose}><Text style={modalStyles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={modalStyles.headerTitle}>Post Announcement</Text>
            <TouchableOpacity onPress={handlePost} style={modalStyles.postBtn}>
              <Text style={modalStyles.postText}>Post</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalStyles.content} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <Text style={modalStyles.fieldLabel}>Type</Text>
            <View style={modalStyles.chipRow}>
              {(['update', 'event'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[modalStyles.chip, type === t && modalStyles.chipActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[modalStyles.chipText, type === t && modalStyles.chipTextActive]}>
                    {t === 'event' ? '📅 Event' : '📣 Update'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Title */}
            <Text style={modalStyles.fieldLabel}>Title</Text>
            <TextInput
              style={modalStyles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Announcement title..."
              placeholderTextColor={colors.textTertiary}
            />
            {/* Body */}
            <Text style={modalStyles.fieldLabel}>Message</Text>
            <TextInput
              style={[modalStyles.input, { height: 100, textAlignVertical: 'top' }]}
              value={body}
              onChangeText={setBody}
              placeholder="What would you like to share?"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            {/* Audience */}
            <Text style={modalStyles.fieldLabel}>Audience</Text>
            <View style={modalStyles.chipRow}>
              {(['all', 'students', 'staff'] as const).map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[modalStyles.chip, audience === a && modalStyles.chipActive]}
                  onPress={() => setAudience(a)}
                >
                  <Text style={[modalStyles.chipText, audience === a && modalStyles.chipTextActive]}>
                    {a === 'all' ? '🌍 Everyone' : a === 'students' ? '🎓 Students' : '👔 Staff'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Pin */}
            <TouchableOpacity
              style={[modalStyles.chip, pinned && modalStyles.chipActive, { alignSelf: 'flex-start', marginTop: spacing.sm }]}
              onPress={() => setPinned(!pinned)}
            >
              <Text style={[modalStyles.chipText, pinned && modalStyles.chipTextActive]}>📌 Pin to top</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Course modal (staff)
// ---------------------------------------------------------------------------

function CourseModal({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (c: Partial<Course>) => void;
}) {
  const [track, setTrack] = useState<CourseTrack>('cybersecurity');
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [spots, setSpots] = useState('');

  function handleAdd() {
    if (!title.trim() || !provider.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    onAdd({
      title: title.trim(), provider: provider.trim(), description: description.trim(),
      track, startDate, endDate,
      spotsTotal: parseInt(spots) || 20, spotsRemaining: parseInt(spots) || 20,
      color: TRACK_COLORS[track],
    });
    setTitle(''); setProvider(''); setDescription(''); setStartDate(''); setEndDate(''); setSpots('');
    onClose();
    Alert.alert('Course added!', `"${title}" has been posted.`);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose}><Text style={modalStyles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={modalStyles.headerTitle}>Add Course</Text>
            <TouchableOpacity onPress={handleAdd} style={[modalStyles.postBtn, { backgroundColor: colors.purple }]}>
              <Text style={modalStyles.postText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalStyles.content} keyboardShouldPersistTaps="handled">
            {/* Track */}
            <Text style={modalStyles.fieldLabel}>Track</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {TRACK_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[modalStyles.chip, track === t.value && { backgroundColor: TRACK_COLORS[t.value], borderColor: TRACK_COLORS[t.value] }]}
                    onPress={() => setTrack(t.value)}
                  >
                    <Text style={[modalStyles.chipText, track === t.value && modalStyles.chipTextActive]}>
                      {t.emoji} {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={modalStyles.fieldLabel}>Title *</Text>
            <TextInput style={modalStyles.input} value={title} onChangeText={setTitle} placeholder="Course title" placeholderTextColor={colors.textTertiary} />
            <Text style={modalStyles.fieldLabel}>Provider *</Text>
            <TextInput style={modalStyles.input} value={provider} onChangeText={setProvider} placeholder="e.g. Coursera, SANS, AWS" placeholderTextColor={colors.textTertiary} />
            <Text style={modalStyles.fieldLabel}>Description</Text>
            <TextInput style={[modalStyles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Short description..." placeholderTextColor={colors.textTertiary} multiline />
            <Text style={modalStyles.fieldLabel}>Start Date * (YYYY-MM-DD)</Text>
            <TextInput style={modalStyles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-07-01" placeholderTextColor={colors.textTertiary} />
            <Text style={modalStyles.fieldLabel}>End Date * (YYYY-MM-DD)</Text>
            <TextInput style={modalStyles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-07-05" placeholderTextColor={colors.textTertiary} />
            <Text style={modalStyles.fieldLabel}>Total Spots</Text>
            <TextInput style={modalStyles.input} value={spots} onChangeText={setSpots} placeholder="20" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function AnnouncementsScreen() {
  const { user, accessToken } = useAuth();
  const isStaff = user?.role === 'staff';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAnnModal, setShowAnnModal] = useState(false);

  useAnnouncementNotifications(announcements);

  useEffect(() => {
    fetchAnnouncements(accessToken).then((a) => {
      setAnnouncements(a);
      setLoading(false);
    });
  }, []);

  const filteredAnnouncements = filter === 'pinned'
    ? announcements.filter((a) => a.pinned)
    : announcements;

  function handlePostAnnouncement(partial: Partial<Announcement>) {
    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      type: partial.type ?? 'update',
      title: partial.title ?? '',
      body: partial.body ?? '',
      postedAt: new Date().toISOString(),
      audience: partial.audience ?? 'all',
      pinned: partial.pinned ?? false,
      author: 'Red Alpha Staff',
    };
    setAnnouncements((prev) => [newAnn, ...prev]);
  }


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News & Upskilling</Text>

      </View>

      {/* Filter chips (news only) */}
      <View style={styles.filterBar}>
          {(['all', 'pinned'] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : '📌 Pinned'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredAnnouncements.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          ) : (
            filteredAnnouncements.map((item, i) => (
              <AnnouncementCard key={item.id} item={item} index={i} />
            ))
          )}
          <View style={{ height: spacing.xxxl * 2 }} />
        </ScrollView>
      )}

      {/* Staff FAB */}
      {isStaff && (
        <StaffFAB
          onAnnouncement={() => setShowAnnModal(true)}
          onCourse={() => {}}
        />
      )}

      <AnnouncementModal
        visible={showAnnModal}
        onClose={() => setShowAnnModal(false)}
        onPost={handlePostAnnouncement}
      />

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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: { ...typography.headline2, color: '#FFF', marginBottom: spacing.md },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.md,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radius.md - 2,
  },
  tabBtnActive: { backgroundColor: '#FFF' },
  tabBtnText: { ...typography.bodySmall, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  tabBtnTextActive: { color: colors.textPrimary },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.label, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  empty: { alignItems: 'center', paddingTop: spacing.huge },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.textTertiary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardPinned: {
    borderWidth: 1.5,
    borderColor: colors.primary + '44',
  },
  pinnedStrip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pinnedStripText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  cardBody: { padding: spacing.md },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  audienceChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  audienceText: { ...typography.caption, fontWeight: '700', textTransform: 'capitalize' },
  timeText: { ...typography.caption, color: colors.textTertiary },
  cardTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs },
  cardPreview: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 18 },
  cardBody2: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  authorText: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm, fontStyle: 'italic' },
  courseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadow.sm,
  },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  trackChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  trackChipText: { ...typography.caption, fontWeight: '700' },
  courseProvider: { ...typography.caption, color: colors.textTertiary },
  courseTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs },
  courseDesc: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  courseMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  courseDate: { ...typography.caption, color: colors.textSecondary },
  courseSpots: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  applyBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  applyBtnText: { ...typography.bodySmall, color: '#FFF', fontWeight: '700' },
});

const fabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    alignItems: 'flex-end',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  fabIcon: { color: '#FFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  option: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.sm,
    ...shadow.sm,
    minWidth: 160,
    justifyContent: 'flex-end',
  },
  optionIcon: { fontSize: 16 },
  optionLabel: { ...typography.bodySmall, color: '#FFF', fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.heading, color: colors.textPrimary },
  cancel: { ...typography.body, color: colors.textSecondary },
  postBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  postText: { ...typography.bodySmall, color: '#FFF', fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  fieldLabel: { ...typography.label, color: colors.textPrimary, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    ...typography.body,
    color: colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
});
