import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import { getAllStudents, updatePlacementInfo } from '@/data/profileApi';
import { PlacementInfo, StaffStudentRecord, StudentLifecycleStage } from '@/types';
import { colors, radius, shadow, spacing, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STAGE_CONFIG: Record<StudentLifecycleStage, { label: string; color: string; bg: string; dot: string }> = {
  'on-course':      { label: 'On Course',      color: colors.purple,  bg: colors.purpleLight,  dot: '🟣' },
  'job-hunting':    { label: 'Job Hunting',     color: colors.warning, bg: colors.warningLight, dot: '🟡' },
  'on-placement':   { label: 'On Placement',    color: colors.accent,  bg: colors.accentLight,  dot: '🟢' },
  'bond-completed': { label: 'Bond Complete',   color: '#6366F1',      bg: '#EEF2FF',           dot: '🔵' },
  'withdrawn':      { label: 'Withdrawn',       color: colors.error,   bg: colors.errorLight,   dot: '🔴' },
};

// ---------------------------------------------------------------------------
// Placement Edit Modal
// ---------------------------------------------------------------------------

function PlacementEditModal({
  student,
  onClose,
  onSave,
}: {
  student: StaffStudentRecord;
  onClose: () => void;
  onSave: (studentId: string, info: PlacementInfo) => Promise<void>;
}) {
  const [stage, setStage] = useState<StudentLifecycleStage>(student.stage);
  const [company, setCompany] = useState(student.placementCompany ?? '');
  const [role, setRole] = useState(student.placementRole ?? '');
  const [ro, setRo] = useState(student.reportingOfficer ?? '');
  const [roEmail, setRoEmail] = useState(student.roEmail ?? '');
  const [bondEnd, setBondEnd] = useState(student.bondEndDate ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(student.studentId, { stage, placementCompany: company, placementRole: role, reportingOfficer: ro, roEmail, bondEndDate: bondEnd });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={em.safe} edges={['top', 'bottom']}>
        <View style={em.header}>
          <TouchableOpacity onPress={onClose} style={em.cancelBtn}>
            <Text style={em.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={em.headerTitle} numberOfLines={1}>{student.name}</Text>
          <TouchableOpacity onPress={handleSave} style={em.saveBtn} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={em.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={em.scroll} contentContainerStyle={em.content} keyboardShouldPersistTaps="handled">
          {/* Student info summary */}
          <View style={em.summaryCard}>
            <Text style={em.summaryName}>{student.name}</Text>
            <Text style={em.summaryMeta}>{student.cohortName}  ·  {student.email}</Text>
            {student.dateOfBirth && <Text style={em.summaryMeta}>DOB: {student.dateOfBirth}</Text>}
          </View>

          {/* Stage */}
          <Text style={em.sectionLabel}>Lifecycle Stage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={em.stageRow}>
            {(Object.keys(STAGE_CONFIG) as StudentLifecycleStage[]).map((s) => {
              const cfg = STAGE_CONFIG[s];
              return (
                <TouchableOpacity
                  key={s}
                  style={[em.stageChip, stage === s && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                  onPress={() => setStage(s)}
                >
                  <Text style={[em.stageChipText, stage === s && { color: cfg.color }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <EField label="Placement Company">
            <TextInput style={em.input} value={company} onChangeText={setCompany} placeholder="e.g. Grab, Shopee" placeholderTextColor={colors.textTertiary} />
          </EField>
          <EField label="Role / Job Title">
            <TextInput style={em.input} value={role} onChangeText={setRole} placeholder="e.g. Junior Software Engineer" placeholderTextColor={colors.textTertiary} />
          </EField>
          <EField label="Reporting Officer">
            <TextInput style={em.input} value={ro} onChangeText={setRo} placeholder="e.g. CPT Lim Wei Ming" placeholderTextColor={colors.textTertiary} />
          </EField>
          <EField label="RO Email">
            <TextInput style={em.input} value={roEmail} onChangeText={setRoEmail} placeholder="ro@company.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
          </EField>
          <EField label="RA Bond End Date" hint="YYYY-MM-DD">
            <TextInput style={em.input} value={bondEnd} onChangeText={setBondEnd} placeholder="2029-03-10" placeholderTextColor={colors.textTertiary} keyboardType="numbers-and-punctuation" maxLength={10} />
          </EField>

          {/* CV link */}
          {student.cvUrl && (
            <TouchableOpacity style={em.cvBtn} onPress={() => Linking.openURL(student.cvUrl!)}>
              <Text style={em.cvBtnText}>📄 View / Download CV</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={em.field}>
      <View style={em.labelRow}>
        <Text style={em.label}>{label}</Text>
        {hint && <Text style={em.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const em = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.heading, color: colors.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  cancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelText: { ...typography.body, color: colors.textSecondary },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.lg, borderRadius: radius.full, minWidth: 64, alignItems: 'center' },
  saveText: { ...typography.bodySmall, color: '#FFF', fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxxl * 2 },
  summaryCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderLight },
  summaryName: { ...typography.heading, color: colors.textPrimary, marginBottom: 4 },
  summaryMeta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  stageRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.md },
  stageChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stageChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  field: { gap: 6, marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textTertiary },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, ...typography.body, color: colors.textPrimary },
  cvBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  cvBtnText: { ...typography.body, color: colors.primary, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Stage chip (shared by both views)
// ---------------------------------------------------------------------------

function StageBadge({ stage }: { stage: StudentLifecycleStage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <View style={[tb.stageBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[tb.stageBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Web table view
// ---------------------------------------------------------------------------

const COL = { name: 160, email: 190, dob: 96, cohort: 110, stage: 130, role: 150, ro: 160, bond: 100, actions: 110 };
const TOTAL_WIDTH = Object.values(COL).reduce((a, b) => a + b, 0);

function TableView({
  students,
  onEdit,
}: {
  students: StaffStudentRecord[];
  onEdit: (s: StaffStudentRecord) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ minWidth: TOTAL_WIDTH }}>
        {/* Header row */}
        <View style={tb.headerRow}>
          <ColHead w={COL.name}>Name</ColHead>
          <ColHead w={COL.email}>Email</ColHead>
          <ColHead w={COL.dob}>DOB</ColHead>
          <ColHead w={COL.cohort}>Cohort</ColHead>
          <ColHead w={COL.stage}>Stage</ColHead>
          <ColHead w={COL.role}>Role</ColHead>
          <ColHead w={COL.ro}>Report. Officer</ColHead>
          <ColHead w={COL.bond}>Bond End</ColHead>
          <ColHead w={COL.actions}>Actions</ColHead>
        </View>
        {/* Data rows */}
        {students.map((s, i) => (
          <View key={s.studentId} style={[tb.dataRow, i % 2 === 0 && tb.dataRowAlt]}>
            <ColCell w={COL.name} bold>{s.name}</ColCell>
            <ColCell w={COL.email} muted>{s.email}</ColCell>
            <ColCell w={COL.dob} muted>{s.dateOfBirth ?? '—'}</ColCell>
            <ColCell w={COL.cohort}>{s.cohortName}</ColCell>
            <View style={[tb.cell, { width: COL.stage }]}>
              <StageBadge stage={s.stage} />
            </View>
            <ColCell w={COL.role} muted>{s.placementRole ?? '—'}</ColCell>
            <ColCell w={COL.ro} muted>{s.reportingOfficer ?? '—'}</ColCell>
            <ColCell w={COL.bond} muted>{s.bondEndDate ?? '—'}</ColCell>
            <View style={[tb.cell, { width: COL.actions, flexDirection: 'row', gap: 6 }]}>
              {s.cvUrl && (
                <TouchableOpacity style={tb.actionBtn} onPress={() => Linking.openURL(s.cvUrl!)}>
                  <Text style={tb.actionBtnText}>📄 CV</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[tb.actionBtn, tb.editBtn]} onPress={() => onEdit(s)}>
                <Text style={tb.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ColHead({ w, children }: { w: number; children: string }) {
  return <View style={[tb.headerCell, { width: w }]}><Text style={tb.headerCellText}>{children}</Text></View>;
}

function ColCell({ w, children, bold, muted }: { w: number; children?: string | null; bold?: boolean; muted?: boolean }) {
  return (
    <View style={[tb.cell, { width: w }]}>
      <Text style={[tb.cellText, bold && tb.cellBold, muted && tb.cellMuted]} numberOfLines={1}>
        {children ?? '—'}
      </Text>
    </View>
  );
}

const tb = StyleSheet.create({
  headerRow: { flexDirection: 'row', backgroundColor: colors.headerBg, paddingVertical: 10 },
  headerCell: { paddingHorizontal: 10, justifyContent: 'center' },
  headerCellText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dataRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingVertical: 10, backgroundColor: colors.surface },
  dataRowAlt: { backgroundColor: colors.surfaceAlt },
  cell: { paddingHorizontal: 10, justifyContent: 'center' },
  cellText: { ...typography.bodySmall, color: colors.textPrimary },
  cellBold: { fontWeight: '600' },
  cellMuted: { color: colors.textSecondary },
  stageBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  stageBadgeText: { fontSize: 11, fontWeight: '700' },
  actionBtn: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionBtnText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  editBtn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  editBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Mobile card view
// ---------------------------------------------------------------------------

function StudentCard({
  student,
  index,
  onEdit,
}: {
  student: StaffStudentRecord;
  index: number;
  onEdit: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  const [showCerts, setShowCerts] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, delay: index * 50, useNativeDriver: true, damping: 18, stiffness: 120 }),
    ]).start();
  }, []);

  const cfg = STAGE_CONFIG[student.stage];
  const hasCerts = student.certifications && student.certifications.length > 0;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      <View style={mc.card}>
        <View style={mc.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={mc.name}>{student.name}</Text>
            <Text style={mc.meta}>{student.cohortName}  ·  {student.email}</Text>
          </View>
          <StageBadge stage={student.stage} />
        </View>

        {(student.placementRole || student.placementCompany) && (
          <View style={mc.row}>
            <Text style={mc.rowLabel}>Role</Text>
            <Text style={mc.rowValue}>{[student.placementRole, student.placementCompany].filter(Boolean).join(' @ ')}</Text>
          </View>
        )}
        {student.reportingOfficer && (
          <View style={mc.row}>
            <Text style={mc.rowLabel}>R.O.</Text>
            <Text style={mc.rowValue}>{student.reportingOfficer}</Text>
          </View>
        )}
        {student.bondEndDate && (
          <View style={mc.row}>
            <Text style={mc.rowLabel}>Bond ends</Text>
            <Text style={mc.rowValue}>{student.bondEndDate}</Text>
          </View>
        )}

        {/* Certs accordion */}
        <TouchableOpacity
          style={mc.certsToggle}
          onPress={() => setShowCerts((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={mc.certsToggleLabel}>
            🏅 {hasCerts ? `${student.certifications.length} Certification${student.certifications.length !== 1 ? 's' : ''}` : 'No certifications'}
          </Text>
          <Text style={mc.certsToggleChevron}>{showCerts ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showCerts && hasCerts && (
          <View style={mc.certsBody}>
            {student.certifications.map((c) => (
              <View key={c.id} style={mc.certRow}>
                <View style={mc.certDot} />
                <View style={{ flex: 1 }}>
                  <Text style={mc.certName}>{c.name}</Text>
                  <Text style={mc.certMeta}>{c.provider}{c.earnedAt ? `  ·  ${c.earnedAt}` : '  ·  In progress'}</Text>
                </View>
                {c.earnedAt && (
                  <View style={mc.certBadge}>
                    <Text style={mc.certBadgeText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={mc.footer}>
          {student.cvUrl ? (
            <TouchableOpacity style={mc.cvBtn} onPress={() => Linking.openURL(student.cvUrl!)}>
              <Text style={mc.cvBtnText}>📄 CV</Text>
            </TouchableOpacity>
          ) : <View />}
          <TouchableOpacity style={mc.editBtn} onPress={onEdit}>
            <Text style={mc.editBtnText}>Edit placement →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const mc = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.lg, ...shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  name: { ...typography.heading, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  rowLabel: { ...typography.bodySmall, color: colors.textTertiary, width: 72 },
  rowValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
  certsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingBottom: 2 },
  certsToggleLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  certsToggleChevron: { fontSize: 10, color: colors.textTertiary },
  certsBody: { marginTop: spacing.sm, gap: spacing.sm },
  certRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  certDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 5 },
  certName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  certMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  certBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  certBadgeText: { fontSize: 10, color: '#059669', fontWeight: '700' },
  cvBtn: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  cvBtnText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  editBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
});

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const ALL_STAGES: Array<{ key: StudentLifecycleStage | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'on-placement', label: '🟢 Placed' },
  { key: 'on-course', label: '🟣 On Course' },
  { key: 'job-hunting', label: '🟡 Hunting' },
  { key: 'bond-completed', label: '🔵 Bonded' },
  { key: 'withdrawn', label: '🔴 Withdrawn' },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function StudentManagementScreen() {
  const { accessToken } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [students, setStudents] = useState<StaffStudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<StaffStudentRecord | null>(null);
  const [search, setSearch] = useState('');
  const [cohortFilters, setCohortFilters] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<StudentLifecycleStage | 'all'>('all');

  useEffect(() => { loadStudents(); }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await getAllStudents(accessToken);
      setStudents(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlacement(studentId: string, info: PlacementInfo) {
    await updatePlacementInfo(studentId, info);
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, stage: info.stage, placementCompany: info.placementCompany, placementRole: info.placementRole, reportingOfficer: info.reportingOfficer, roEmail: info.roEmail, bondEndDate: info.bondEndDate }
          : s
      )
    );
  }

  // Unique cohort names for filter
  const cohortOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.cohortName));
    return Array.from(set).sort();
  }, [students]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s) => {
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchCohort = cohortFilters.size === 0 || cohortFilters.has(s.cohortName);
      const matchStage = stageFilter === 'all' || s.stage === stageFilter;
      return matchSearch && matchCohort && matchStage;
    });
  }, [students, search, cohortFilters, stageFilter]);

  return (
    <SafeAreaView style={ms.safe} edges={['top']}>
      {/* Header */}
      <View style={ms.header}>
        <Text style={ms.headerTitle}>Student Management</Text>
        <Text style={ms.headerSub}>{students.length} students · {filtered.length} shown</Text>
      </View>

      {/* Filter bar */}
      <View style={ms.filterBar}>
        {/* Search */}
        <View style={ms.searchBox}>
          <Text style={ms.searchIcon}>🔍</Text>
          <TextInput
            style={ms.searchInput}
            placeholder="Search name or email..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Stage filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.chipRow}>
          {ALL_STAGES.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[ms.chip, stageFilter === opt.key && ms.chipActive]}
              onPress={() => setStageFilter(opt.key as any)}
            >
              <Text style={[ms.chipText, stageFilter === opt.key && ms.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          {/* Cohort filter */}
          <View style={ms.divider} />
          {cohortOptions.map((c) => (
            <TouchableOpacity
              key={c}
              style={[ms.chip, cohortFilters.has(c) && ms.chipActive]}
              onPress={() => {
                setCohortFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has(c)) next.delete(c);
                  else next.add(c);
                  return next;
                });
              }}
            >
              <Text style={[ms.chipText, cohortFilters.has(c) && ms.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={ms.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={ms.center}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={ms.emptyText}>No students match your filters</Text>
        </View>
      ) : isWeb ? (
        /* ── Web: table ── */
        <ScrollView style={ms.tableScroll} showsVerticalScrollIndicator>
          <TableView students={filtered} onEdit={setEditTarget} />
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      ) : (
        /* ── Mobile: card list ── */
        <ScrollView
          style={ms.scroll}
          contentContainerStyle={ms.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((s, i) => (
            <StudentCard key={s.studentId} student={s} index={i} onEdit={() => setEditTarget(s)} />
          ))}
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      )}

      {/* Edit modal */}
      {editTarget && (
        <PlacementEditModal
          student={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSavePlacement}
        />
      )}
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary },

  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: { ...typography.headline2, color: '#FFF' },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  filterBar: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },

  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: 2 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radius.full, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  divider: { width: 1, backgroundColor: colors.borderLight, marginHorizontal: spacing.xs, alignSelf: 'stretch' },

  tableScroll: { flex: 1 },
  scroll: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
});
