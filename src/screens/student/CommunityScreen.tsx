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
import { fetchAnnouncements } from '@/data/api';
import { Announcement, AnnouncementType, Reaction } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const AUTHOR_COLORS: Record<string, string> = {
  Ron: colors.primary,
  Vivian: colors.purple,
  Yoav: '#0891B2',
};

// ---------------------------------------------------------------------------
// Achievement card
// ---------------------------------------------------------------------------

function AchievementCard({ item }: { item: Announcement }) {
  const [reactions, setReactions] = useState<Reaction[]>(item.reactions ?? []);
  const [praised, setPraised] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleReact(emoji: string) {
    if (praised === emoji) return; // already reacted
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
    setReactions((prev) =>
      prev.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1 } : r))
    );
    setPraised(emoji);
  }

  return (
    <Animated.View style={[styles.achievementCard, { transform: [{ scale: scaleAnim }] }]}>
      {/* Gold top stripe */}
      <View style={styles.achievementStripe} />

      <View style={styles.achievementBody}>
        {/* Trophy + cert badge */}
        <View style={styles.achievementTop}>
          <View style={styles.trophyBubble}>
            <Text style={{ fontSize: 28 }}>🏆</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.certBadge}>
              <Text style={styles.certProvider}>{item.certProvider}</Text>
            </View>
            <Text style={styles.certName}>{item.certificationName}</Text>
          </View>
        </View>

        {/* Achiever */}
        <View style={styles.achieverRow}>
          <View style={styles.achieverAvatar}>
            <Text style={styles.achieverInitials}>{initials(item.achieverName ?? '')}</Text>
          </View>
          <View>
            <Text style={styles.achieverName}>{item.achieverName}</Text>
            <Text style={styles.achieverCohort}>{item.achieverCohort} · {timeAgo(item.postedAt)}</Text>
          </View>
        </View>

        {/* Message */}
        <Text style={styles.achievementMsg}>{item.body}</Text>

        {/* Reactions */}
        <View style={styles.reactionsRow}>
          {reactions.map((r) => (
            <TouchableOpacity
              key={r.emoji}
              onPress={() => handleReact(r.emoji)}
              style={[
                styles.reactionBtn,
                praised === r.emoji && styles.reactionBtnActive,
              ]}
              activeOpacity={0.75}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactionCount, praised === r.emoji && styles.reactionCountActive]}>
                {r.count}
              </Text>
            </TouchableOpacity>
          ))}
          {!praised && (
            <Text style={styles.praiseHint}>Tap to praise →</Text>
          )}
        </View>

        {/* Posted by */}
        <Text style={styles.postedBy}>
          Posted by <Text style={{ fontWeight: '700', color: AUTHOR_COLORS[item.author] ?? colors.textSecondary }}>{item.author}</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Event / update card
// ---------------------------------------------------------------------------

function AnnouncementCard({ item }: { item: Announcement }) {
  const [expanded, setExpanded] = useState(false);

  const typeConfig = {
    event: { label: 'Event', color: colors.primary, bg: colors.primaryLight, emoji: '📅' },
    update: { label: 'Update', color: colors.purple, bg: colors.purpleLight, emoji: '📢' },
    achievement: { label: 'Achievement', color: colors.gold, bg: colors.goldLight, emoji: '🏆' },
  };
  const cfg = typeConfig[item.type] ?? typeConfig.update;

  const needsTruncate = item.body.length > 120;
  const displayBody = expanded || !needsTruncate ? item.body : item.body.slice(0, 120) + '…';

  return (
    <TouchableOpacity
      onPress={() => needsTruncate && setExpanded(!expanded)}
      activeOpacity={needsTruncate ? 0.88 : 1}
      style={[styles.announcCard, item.pinned && styles.announcCardPinned]}
    >
      {item.pinned && (
        <View style={styles.pinnedBar}>
          <Text style={styles.pinnedText}>📌  Pinned</Text>
        </View>
      )}

      <View style={styles.announcInner}>
        {/* Type badge + time */}
        <View style={styles.announcMeta}>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={styles.typeEmoji}>{cfg.emoji}</Text>
            <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.announcTime}>{timeAgo(item.postedAt)}</Text>
        </View>

        <Text style={styles.announcTitle}>{item.title}</Text>
        <Text style={styles.announcBody}>{displayBody}</Text>

        {needsTruncate && (
          <Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
        )}

        <Text style={styles.announcAuthor}>
          By <Text style={{ fontWeight: '700', color: AUTHOR_COLORS[item.author] ?? colors.textSecondary }}>{item.author}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
      activeOpacity={0.75}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type Filter = 'all' | 'achievement' | 'event' | 'update';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'achievement', label: '🏆 Achievements' },
  { key: 'event', label: '📅 Events' },
  { key: 'update', label: '📢 Updates' },
];

export function CommunityScreen() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchAnnouncements(accessToken).then((all) =>
      setItems(all.filter((a) => a.audience !== 'staff'))
    );
  }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);
  const pinned = filtered.filter((i) => i.pinned);
  const rest = filtered.filter((i) => !i.pinned);
  const sorted = [...pinned, ...rest];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Dark header */}
      <View style={styles.header}>
        <Animated.View style={{ opacity: headerAnim }}>
          <Text style={styles.headerEyebrow}>RED ALPHA</Text>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSub}>Achievements, events & updates from the team</Text>
        </Animated.View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Feed */}
      <ScrollView
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
      >
        {sorted.map((item) =>
          item.type === 'achievement' ? (
            <AchievementCard key={item.id} item={item} />
          ) : (
            <AnnouncementCard key={item.id} item={item} />
          )
        )}
        {sorted.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>🔇</Text>
            <Text style={styles.emptyText}>Nothing here yet</Text>
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

  // Header
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

  // Filter
  filterBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterScroll: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },

  // Feed
  feed: { padding: spacing.lg, gap: spacing.md },

  // Achievement card
  achievementCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldLight,
    ...shadow.md,
  },
  achievementStripe: { height: 4, backgroundColor: colors.gold },
  achievementBody: { padding: spacing.lg, gap: spacing.md },
  achievementTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  trophyBubble: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: 4,
  },
  certProvider: { fontSize: 10, fontWeight: '700', color: colors.gold, letterSpacing: 0.5 },
  certName: { ...typography.heading, color: colors.textPrimary, lineHeight: 21 },
  achieverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  achieverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achieverInitials: { fontSize: 13, fontWeight: '700', color: colors.primary },
  achieverName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700' },
  achieverCohort: { ...typography.caption, color: colors.textTertiary },
  achievementMsg: { ...typography.body, color: colors.textSecondary, lineHeight: 21 },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  reactionBtnActive: {
    backgroundColor: colors.primaryMid,
    borderColor: colors.primary,
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  reactionCountActive: { color: colors.primary },
  praiseHint: { ...typography.caption, color: colors.textTertiary, marginLeft: spacing.xs },
  postedBy: { ...typography.caption, color: colors.textTertiary },

  // Announcement card
  announcCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  announcCardPinned: {
    borderColor: colors.warningLight,
    borderWidth: 1.5,
  },
  pinnedBar: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  pinnedText: { fontSize: 11, fontWeight: '700', color: colors.warning },
  announcInner: { padding: spacing.lg, gap: spacing.sm },
  announcMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  typeEmoji: { fontSize: 12 },
  typeLabel: { fontSize: 11, fontWeight: '700' },
  announcTime: { ...typography.caption, color: colors.textTertiary },
  announcTitle: { ...typography.heading, color: colors.textPrimary },
  announcBody: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  readMore: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  announcAuthor: { ...typography.caption, color: colors.textTertiary },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: spacing.huge },
  emptyText: { ...typography.body, color: colors.textTertiary },
});
