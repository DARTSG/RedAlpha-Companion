/**
 * StaffWebPortal — professional web-only admin dashboard for Red Alpha staff.
 * Rendered exclusively when Platform.OS === 'web'.
 *
 * Self-contained: SVG line icons + charts via data URIs (no external deps),
 * Inter type scale, CSS entrance animations, count-up KPIs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import {
  fetchAnnouncements,
  fetchCohortGrowth,
  fetchStaffStudentRoster,
} from '@/data/api';
import * as DocumentPicker from 'expo-document-picker';
import { fetchCertSubmissions, reviewCertSubmission, updatePlacementInfo, updateStudentRecord } from '@/data/profileApi';
import { uploadFileToSharePoint } from '@/data/fileApi';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as mgmt from '@/data/managementApi';
import {
  Announcement,
  AnnouncementType,
  CertSubmission,
  Certification,
  Cohort,
  CohortGrowthPoint,
  Course,
  CourseTrack,
  IntakeProgramme,
  IntakeStatus,
  InterviewRecord,
  PerformanceReport,
  PlacementRecord,
  StaffMember,
  StaffRole,
  StaffStudentRecord,
  StudentLifecycleStage,
  SyllabusWeek,
  UpskillingTaken,
} from '@/types';

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const C = {
  appBg: '#F5F6F8',
  sidebar: '#101828',
  sidebarLine: 'rgba(255,255,255,0.08)',
  card: '#FFFFFF',
  border: '#E7EAEF',
  borderSoft: '#F1F3F6',
  headFill: '#FAFBFC',
  text: '#101828',
  textMid: '#475467',
  textMute: '#8893A4',
  brand: '#DC2626',
  brandSoft: '#FEF3F2',
  green: '#067647', greenSoft: '#ECFDF3', greenDot: '#17B26A',
  amber: '#B54708', amberSoft: '#FFFAEB', amberDot: '#F79009',
  violet: '#6941C6', violetSoft: '#F4F3FF', violetDot: '#7A5AF8',
  blue: '#175CD3', blueSoft: '#EFF4FF', blueDot: '#2E90FA',
  slate: '#475467', slateSoft: '#F2F4F7',
};

const LAYOUT = { sidebar: 198, header: 58, pad: 28, maxW: 1340 };

// Harmonious chart palette (kept separate from semantic stage colours)
const CHART = { indigo: '#6366F1', violet: '#8B5CF6', emerald: '#10B981', amber: '#F59E0B', sky: '#0EA5E9', teal: '#14B8A6', rose: '#F43F5E' };
const CHART_SERIES = [CHART.indigo, CHART.violet, CHART.emerald, CHART.amber, CHART.sky, CHART.teal];

const STAGE: Record<StudentLifecycleStage, { label: string; fg: string; bg: string; dot: string }> = {
  'on-course':      { label: 'On Course',    fg: '#B42318', bg: '#FEF3F2', dot: '#F04438' },
  'job-hunting':    { label: 'On Bench',     fg: '#B54708', bg: '#FFFAEB', dot: '#F79009' },
  'on-placement':   { label: 'On Placement', fg: '#067647', bg: '#ECFDF3', dot: '#17B26A' },
  'bond-completed': { label: 'Bond Done',    fg: '#6941C6', bg: '#F4F3FF', dot: '#7A5AF8' },
  extended:         { label: 'Extended',     fg: '#0E7090', bg: '#ECFDFF', dot: '#06AED4' },
  withdrawn:        { label: 'Withdrawn',    fg: '#475467', bg: '#F2F4F7', dot: '#98A2B3' },
};

const NEWS_CFG: Record<AnnouncementType, { label: string; icon: string; fg: string; bg: string; bar: string }> = {
  achievement: { label: 'Achievement', icon: 'trophy',   fg: C.amber,  bg: C.amberSoft,  bar: C.amberDot },
  event:       { label: 'Event',       icon: 'calendar', fg: C.blue,   bg: C.blueSoft,   bar: C.blueDot },
  update:      { label: 'Update',      icon: 'info',     fg: C.violet, bg: C.violetSoft, bar: C.violetDot },
};

// Cross-tab navigation (click a stat -> jump to a filtered tab)
type StudentFilter = { stages?: StudentLifecycleStage[]; cohort?: string; company?: string; programme?: string } | null;
const NavCtx = React.createContext<{ navigate: (page: string, filter?: StudentFilter) => void; studentFilter: StudentFilter }>({ navigate: () => {}, studentFilter: null });
function useNav() { return React.useContext(NavCtx); }

// ---------------------------------------------------------------------------
// Animation hooks
// ---------------------------------------------------------------------------

function useCountUp(target: number, ms = 750) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function useGrow() {
  const [g, setG] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setG(true)); return () => cancelAnimationFrame(id); }, []);
  return g;
}

// ---------------------------------------------------------------------------
// Icons (Lucide-style, rendered as SVG data URI)
// ---------------------------------------------------------------------------

const ICON_PATHS: Record<string, string> = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

function Icon({ name, size = 16, color = '#667085', sw = 1.8 }: {
  name: string; size?: number; color?: string; sw?: number;
}) {
  const inner = ICON_PATHS[name] ?? '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return <Image source={{ uri: `data:image/svg+xml,${encodeURIComponent(svg)}` }} style={{ width: size, height: size }} />;
}

// ---------------------------------------------------------------------------
// Donut + Line chart (SVG data URIs)
// ---------------------------------------------------------------------------

function Donut({ pct, size = 140, stroke = 14, color = CHART.emerald }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const cx = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#EAECF0" stroke-width="${stroke}"/>` +
    `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cx})"/></svg>`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={{ uri: `data:image/svg+xml,${encodeURIComponent(svg)}` }} style={{ width: size, height: size, position: 'absolute' }} />
      <Text style={{ fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -0.6 }}>{Math.round(pct)}%</Text>
      <Text style={{ fontSize: 11.5, color: C.textMute, marginTop: 2, fontWeight: '500' }}>placed</Text>
    </View>
  );
}

function LineChart({ data, color = CHART.indigo, height = 200 }: {
  data: { label: string; value: number }[]; color?: string; height?: number;
}) {
  const W = 640, H = height, padX = 34, padTop = 18, padBot = 30;
  const max = 100;
  const n = Math.max(1, data.length - 1);
  const stepX = (W - padX * 2) / n;
  const y = (v: number) => H - padBot - (v / max) * (H - padTop - padBot);
  const pts = data.map((d, i) => [padX + i * stepX, y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - padBot} L${pts[0][0].toFixed(1)} ${H - padBot} Z`;
  const grid = [0, 25, 50, 75, 100].map((g) =>
    `<line x1="${padX}" y1="${y(g)}" x2="${W - padX}" y2="${y(g)}" stroke="#EEF1F4" stroke-width="1"/>` +
    `<text x="${padX - 8}" y="${y(g) + 3}" font-size="10" fill="#98A2B3" text-anchor="end" font-family="Inter,sans-serif">${g}</text>`
  ).join('');
  const dots = pts.map((p, i) => `<circle class="ra-dot" style="animation-delay:${(0.6 + i * 0.12).toFixed(2)}s" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#fff" stroke="${color}" stroke-width="2.5"/>`).join('');
  const labels = data.map((d, i) => `<text x="${(padX + i * stepX).toFixed(1)}" y="${H - 8}" font-size="10.5" fill="#667085" text-anchor="middle" font-family="Inter,sans-serif">${d.label}</text>`).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.20"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>` +
    `<style>@keyframes ra-draw{to{stroke-dashoffset:0}}@keyframes ra-fade{to{opacity:1}}` +
    `.ra-line{stroke-dasharray:1600;stroke-dashoffset:1600;animation:ra-draw 1.1s cubic-bezier(.4,0,.2,1) forwards}` +
    `.ra-area{opacity:0;animation:ra-fade .8s ease .5s forwards}` +
    `.ra-dot{opacity:0;animation:ra-fade .4s ease forwards}</style></defs>` +
    grid +
    `<path class="ra-area" d="${area}" fill="url(#g)"/>` +
    `<path class="ra-line" d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    dots + labels + `</svg>`;
  return <Image source={{ uri: `data:image/svg+xml,${encodeURIComponent(svg)}` }} style={{ width: '100%', height: H }} resizeMode="contain" />;
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function StagePill({ stage, small }: { stage: StudentLifecycleStage; small?: boolean }) {
  const s = STAGE[stage] ?? STAGE['on-course'];
  return (
    <View style={[pill.root, { backgroundColor: s.bg }, small && { paddingVertical: 2 }]}>
      <View style={[pill.dot, { backgroundColor: s.dot }]} />
      <Text style={[pill.text, { color: s.fg }]} numberOfLines={1}>{s.label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 16, alignSelf: 'flex-start', flexShrink: 0 },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  text: { fontSize: 11.5, fontWeight: '600' },
});

function Card({ children, style, anim }: { children: React.ReactNode; style?: any; anim?: boolean }) {
  return <View {...({ dataSet: { card: '1', ...(anim ? { anim: 'in' } : {}) } } as any)} style={[u.card, style]}>{children}</View>;
}

function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Text style={u.cardTitle}>{children}</Text>
      {right}
    </View>
  );
}

function Avatar({ name, stage, size = 34 }: { name: string; stage?: StudentLifecycleStage; size?: number }) {
  const s = stage ? STAGE[stage] : null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: s?.bg ?? C.slateSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: s?.fg ?? C.slate }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function KpiCard({ label, value, suffix, icon, tint, soft, onPress }: {
  label: string; value: number; suffix?: string; icon: string; tint: string; soft: string; onPress?: () => void;
}) {
  const v = useCountUp(value);
  const display = suffix === '%' ? `${Math.round(v)}%` : (Number.isInteger(value) ? Math.round(v).toLocaleString() : v.toFixed(1));
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      disabled={!onPress}
      {...({ dataSet: { card: '1', anim: 'in', ...(onPress ? { btn: '1' } : {}) } } as any)}
      style={[u.card, kpi.card]}
    >
      <View style={{ flex: 1, minWidth: 0 } as any}>
        <Text style={kpi.label} numberOfLines={1}>{label}</Text>
        <Text style={kpi.value} numberOfLines={1}>{display}</Text>
      </View>
      <View style={[kpi.iconBox, { backgroundColor: soft }]}>
        <Icon name={icon} size={19} color={tint} sw={1.9} />
      </View>
      {onPress ? <View style={kpi.go}><Icon name="chevron" size={13} color={C.textMute} /></View> : null}
    </TouchableOpacity>
  );
}

const kpi = StyleSheet.create({
  card: { flex: 1, flexBasis: 0, minWidth: 158, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 12, color: C.textMute, fontWeight: '500', marginBottom: 6 },
  value: { fontSize: 25, fontWeight: '700', color: C.text, letterSpacing: -0.7 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  go: { position: 'absolute', top: 10, right: 12 },
});

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <View style={u.searchWrap}>
      <Icon name="search" size={15} color={C.textMute} />
      <TextInput style={u.searchInput as any} placeholder={placeholder} placeholderTextColor={C.textMute} value={value} onChangeText={onChange} />
    </View>
  );
}

function Loader() { return <View style={u.centered}><ActivityIndicator color={C.brand} size="large" /></View>; }

// File picking (web) + opening
async function pickFile(): Promise<{ uri: string; name: string; mimeType?: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name ?? 'file', mimeType: a.mimeType };
}
function openUrl(url?: string) { if (url && typeof window !== 'undefined') window.open(url, '_blank'); }

/** Full StudentEdit snapshot from an existing record (so partial saves don't wipe fields). */
function toStudentEdit(s: StaffStudentRecord) {
  return {
    stage: s.stage, cohortName: s.cohortName, dateOfBirth: s.dateOfBirth, accountManager: s.accountManager,
    contactNo: s.contactNo, personalEmail: s.personalEmail, dateJoined: s.dateJoined, ccpGrant: s.ccpGrant,
    bondMonths: s.bondMonths, bondMode: s.bondMode, placements: s.placements ?? [],
    placementCompany: s.placementCompany, placementRole: s.placementRole, reportingOfficer: s.reportingOfficer,
    roEmail: s.roEmail, bondEndDate: s.bondEndDate, upskilling: s.upskilling ?? [],
    performanceReports: s.performanceReports ?? [], certifications: s.certifications ?? [],
  };
}

// CV download (opens real URL if present, else generates a placeholder file)
function downloadCV(s: StaffStudentRecord) {
  if (s.cvUrl && typeof window !== 'undefined') { window.open(s.cvUrl, '_blank'); return; }
  if (typeof document === 'undefined') return;
  const base = (s.cvFilename ?? `${s.name.replace(/\s+/g, '_')}_CV.txt`).replace(/\.pdf$/i, '.txt');
  const body =
    `CURRICULUM VITAE\n================\n\n${s.name}\n${s.email}\nCohort: ${s.cohortName}\n` +
    `Stage: ${STAGE[s.stage].label}\n` +
    (s.placementCompany ? `Placement: ${s.placementRole ?? ''} @ ${s.placementCompany}\n` : '') +
    `\nCertifications:\n` +
    (s.certifications.length ? s.certifications.map((c) => `  • ${c.name} — ${c.provider} (${c.earnedAt})`).join('\n') : '  • None yet') +
    `\n`;
  const blob = new Blob([body], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = base; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const NAV = [
  { id: 'students',  label: 'Students',  icon: 'users' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'growth',    label: 'Growth',    icon: 'trending' },
  { id: 'news',      label: 'News',      icon: 'bell' },
  { id: 'intake',    label: 'Intake',    icon: 'calendar' },
  { id: 'manage',    label: 'Manage',    icon: 'settings' },
  { id: 'users',     label: 'Users',     icon: 'shield' },
];

function Sidebar({ active, onSelect, onSignOut, userName, items }: {
  active: string; onSelect: (id: string) => void; onSignOut: () => void; userName: string; items: typeof NAV;
}) {
  return (
    <View style={sb.root}>
      <View style={sb.brand}>
        <View style={sb.mark}><Text style={sb.markText}>RA</Text></View>
        <View>
          <Text style={sb.brandName}>Red Alpha</Text>
          <Text style={sb.brandSub}>Staff Portal</Text>
        </View>
      </View>
      <View style={sb.nav}>
        {items.map((item) => {
          const on = active === item.id;
          return (
            <TouchableOpacity key={item.id} {...({ dataSet: { nav: '1' } } as any)} activeOpacity={0.8} onPress={() => onSelect(item.id)} style={[sb.item, on && sb.itemOn]}>
              {on && <View style={sb.bar} />}
              <Icon name={item.icon} size={18} color={on ? '#fff' : 'rgba(255,255,255,0.55)'} sw={1.9} />
              <Text style={[sb.label, on && sb.labelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={sb.footer}>
        <View style={sb.fAvatar}><Text style={sb.fAvatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={sb.fName} numberOfLines={1}>{userName}</Text>
          <Text style={sb.fRole}>Staff</Text>
        </View>
        <TouchableOpacity onPress={onSignOut} style={sb.signOut} {...({ dataSet: { nav: '1' } } as any)}>
          <Icon name="logout" size={15} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sb = StyleSheet.create({
  root: { width: LAYOUT.sidebar, backgroundColor: C.sidebar, flexDirection: 'column' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 22 },
  mark: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  brandName: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  brandSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500', letterSpacing: 0.4, marginTop: 1 },
  nav: { flex: 1, paddingHorizontal: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 8, marginBottom: 3, position: 'relative' },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  bar: { position: 'absolute', left: -12, top: 9, bottom: 9, width: 3, backgroundColor: C.brand, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  label: { fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  labelOn: { color: '#fff', fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.sidebarLine },
  fAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  fAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fName: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  fRole: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  signOut: { padding: 7, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)' },
});

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar({ title, subtitle, userName, userEmail, userRole, onSignOut }: {
  title: string; subtitle?: string; userName: string; userEmail?: string; userRole?: string; onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={tb.root}>
      <View>
        <Text style={tb.title}>{title}</Text>
        {subtitle ? <Text style={tb.sub}>{subtitle}</Text> : null}
      </View>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity style={tb.userChip} onPress={() => setOpen((o) => !o)} {...({ dataSet: { btn: '1' } } as any)}>
          <View style={tb.uAvatar}><Text style={tb.uAvatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
          <Text style={tb.uName} numberOfLines={1}>{userName}</Text>
          <View {...({ dataSet: { chevron: '1' } } as any)} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
            <Icon name="chevron" size={13} color={C.textMute} />
          </View>
        </TouchableOpacity>
        {open && (
          <>
            <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={tb.overlay as any} />
            <View style={tb.menu} {...({ dataSet: { card: '1' } } as any)}>
              <Text style={tb.menuName}>{userName}</Text>
              {userEmail ? <Text style={tb.menuMeta}>{userEmail}</Text> : null}
              {userRole ? <View style={tb.roleTag}><Text style={tb.roleTagText}>{userRole}</Text></View> : null}
              <View style={{ height: 1, backgroundColor: C.borderSoft, marginVertical: 10 }} />
              <TouchableOpacity style={tb.menuItem} onPress={() => { setOpen(false); onSignOut(); }} {...({ dataSet: { btn: '1' } } as any)}>
                <Icon name="logout" size={15} color={C.brand} />
                <Text style={tb.menuItemText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  root: { height: LAYOUT.header, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: LAYOUT.pad, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: C.textMute, marginTop: 1, fontWeight: '500' },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 4, paddingRight: 12, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  uAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  uAvatarText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  uName: { fontSize: 13, fontWeight: '600', color: C.textMid, maxWidth: 180 },
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 } as any,
  menu: { position: 'absolute', top: 44, right: 0, minWidth: 220, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, zIndex: 50 },
  menuName: { fontSize: 13.5, fontWeight: '700', color: C.text },
  menuMeta: { fontSize: 12, color: C.textMute, marginTop: 2 },
  roleTag: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: C.slateSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  roleTagText: { fontSize: 11, fontWeight: '700', color: C.textMid, textTransform: 'capitalize' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 },
  menuItemText: { fontSize: 13, fontWeight: '600', color: C.text },
});

// ---------------------------------------------------------------------------
// Page wrapper (entrance animation, replays on tab switch via key)
// ---------------------------------------------------------------------------

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={u.scroll} contentContainerStyle={u.scrollPad} showsVerticalScrollIndicator={false}>
      <View {...({ dataSet: { anim: 'in' } } as any)} style={u.pageInner}>{children}</View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// Map the raw RA "model" status (or fall back to stage) to a dashboard category.
function trainCategory(s: StaffStudentRecord): 'seconded' | 'buyout' | 'bench' | 'training' | 'graduated' | 'terminated' | 'extended' {
  const m = (s.model ?? '').toLowerCase();
  if (s.stage === 'extended') return 'extended';
  if (m) {
    if (m.includes('exten')) return 'extended';
    if (m.includes('secondment')) return 'seconded';
    if (m.includes('buy out') || m.includes('buyout')) return 'buyout';
    if (m.includes('bench')) return 'bench';
    if (m.includes('training')) return 'training';
    if (m.includes('contract ended')) return 'graduated';
    if (m.includes('terminat') || m.includes('withdraw')) return 'terminated';
  }
  switch (s.stage) {
    case 'on-placement': return 'seconded';
    case 'job-hunting': return 'bench';
    case 'on-course': return 'training';
    case 'bond-completed': return 'graduated';
    case 'withdrawn': return 'terminated';
    default: return 'training';
  }
}

function StatusDonut({ segments, size = 190, stroke = 28 }: { segments: { label: string; value: number; color: string }[]; size?: number; stroke?: number }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const gap = 1.5;
  let acc = 0;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const len = (s.value / total) * circ;
    const vis = Math.max(0.5, len - gap);
    const arc = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-linecap="butt" stroke-dasharray="${vis.toFixed(2)} ${(circ - vis).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>`;
    acc += len;
    return arc;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#EEF1F4" stroke-width="${stroke}"/>${arcs}</svg>`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={{ uri: `data:image/svg+xml,${encodeURIComponent(svg)}` }} style={{ width: size, height: size, position: 'absolute' }} />
      <Text style={{ fontSize: 32, fontWeight: '700', color: C.text, letterSpacing: -0.6 }}>{total}</Text>
      <Text style={{ fontSize: 11.5, color: C.textMute, marginTop: 2, fontWeight: '500' }}>trainees</Text>
    </View>
  );
}

function WebDashboard() {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const nav = useNav();
  const grown = useGrow();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  const [target, setTarget] = useState(300);
  useEffect(() => {
    fetchStaffStudentRoster(accessToken).then((roster) => {
      if (isSupabaseConfigured) { setStudents(roster); return; }
      const ov = mgmt.getPlacementOverrides();
      setStudents(roster.map((s) => (ov[s.studentId] ? { ...s, ...ov[s.studentId] } : s)));
    });
  }, []);
  useEffect(() => { mgmt.getSetting('placement_target', '300').then((v) => setTarget(Number(v) || 300)).catch(() => {}); }, []);
  function editTarget() {
    if (typeof window === 'undefined') return;
    const v = window.prompt('Annual placement target:', String(target));
    if (v && !Number.isNaN(Number(v))) { const n = Number(v); mgmt.setSetting('placement_target', String(n)); setTarget(n); }
  }

  const list = students ?? [];
  const cnt = { seconded: 0, buyout: 0, bench: 0, training: 0, graduated: 0, terminated: 0, extended: 0 } as Record<string, number>;
  list.forEach((s) => { cnt[trainCategory(s)]++; });
  const total = list.length;
  const activeTrainees = cnt.seconded + cnt.bench + cnt.training + cnt.extended;
  const placementRate = activeTrainees ? Math.round(((cnt.seconded + cnt.extended) / activeTrainees) * 100) : 0;

  if (!students) return <Loader />;

  const everPlaced = (s: StaffStudentRecord) => (s.placements && s.placements.length > 0) || Boolean(s.placementCompany);
  const curCompany = (s: StaffStudentRecord) => mgmt.activePlacement(s.placements)?.company ?? s.placementCompany ?? '';
  const placements2026 = list.reduce((n, s) => n + (s.placements?.filter((p) => (p.startDate || '').startsWith('2026')).length ?? 0), 0);
  const clientCounts: Record<string, number> = {};
  list.forEach((s) => { if (trainCategory(s) === 'seconded') { const co = curCompany(s); if (co) clientCounts[co] = (clientCounts[co] ?? 0) + 1; } });
  const clients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxClient = Math.max(...clients.map(([, n]) => n), 1);
  const activeClients = Object.keys(clientCounts).length;
  const targetPct = target ? Math.round((placements2026 / target) * 100) : 0;
  const inactiveAllTime = cnt.buyout + cnt.graduated + cnt.terminated;
  const placedWithDart = list.filter((s) => curCompany(s).toLowerCase().includes('dart')).length;

  const progMap: Record<string, { size: number; placed: number }> = {};
  list.forEach((s) => {
    const mm = (s.cohortName || '').match(/^[A-Za-z]+/);
    const prog = (mm ? mm[0] : 'Other').toUpperCase();
    if (!progMap[prog]) progMap[prog] = { size: 0, placed: 0 };
    progMap[prog].size++;
    if (everPlaced(s)) progMap[prog].placed++;
  });
  const progs = Object.entries(progMap).sort((a, b) => b[1].size - a[1].size);
  const pt = progs.reduce((a, [, v]) => ({ size: a.size + v.size, placed: a.placed + v.placed }), { size: 0, placed: 0 });

  const donutSegs: { label: string; value: number; color: string; stages?: StudentLifecycleStage[] }[] = [
    { label: 'Currently Seconded', value: cnt.seconded, color: CHART.indigo, stages: ['on-placement'] },
    { label: 'Extended (post-bond)', value: cnt.extended, color: CHART.teal, stages: ['extended'] },
    { label: 'Bond Buy-Out', value: cnt.buyout, color: CHART.sky },
    { label: 'Not Yet Placed (Bench + Training)', value: cnt.bench + cnt.training, color: CHART.amber, stages: ['job-hunting', 'on-course'] },
    { label: 'Graduated / Released', value: cnt.graduated, color: CHART.emerald, stages: ['bond-completed'] },
    { label: 'Terminated', value: cnt.terminated, color: CHART.rose, stages: ['withdrawn'] },
  ];

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Active Secondment" value={cnt.seconded} icon="briefcase" tint={CHART.indigo} soft={C.blueSoft} onPress={() => nav.navigate('students', { stages: ['on-placement'] })} />
        <KpiCard label="On The Bench" value={cnt.bench} icon="search" tint={C.amber} soft={C.amberSoft} onPress={() => nav.navigate('students', { stages: ['job-hunting'] })} />
        <KpiCard label="In Training" value={cnt.training} icon="book" tint={CHART.violet} soft={C.violetSoft} onPress={() => nav.navigate('students', { stages: ['on-course'] })} />
        <KpiCard label="Total Trainees" value={total} icon="users" tint={C.slate} soft={C.slateSoft} onPress={() => nav.navigate('students')} />
      </View>
      <View style={u.kpiRow}>
        <KpiCard label="Placement Rate" value={placementRate} suffix="%" icon="trending" tint={C.green} soft={C.greenSoft} />
        <KpiCard label="2026 Placements" value={placements2026} icon="cap" tint={CHART.emerald} soft={C.greenSoft} />
        <KpiCard label="Active Clients" value={activeClients} icon="briefcase" tint={C.blue} soft={C.blueSoft} onPress={() => nav.navigate('students', { stages: ['on-placement'] })} />
        <KpiCard label={`2026 Target (${target})`} value={targetPct} suffix="%" icon="chart" tint={C.violet} soft={C.violetSoft} />
      </View>
      {isAdmin && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, marginBottom: 10 }}>
          <TouchableOpacity onPress={editTarget} style={tbl.iconBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="edit" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>Edit target</Text></TouchableOpacity>
        </View>
      )}

      <View style={u.colsWrap}>
        <Card style={{ flex: 1.1, minWidth: 340 }} anim>
          <CardTitle>Trainee Status Distribution</CardTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, flexWrap: 'wrap', paddingVertical: 8 }}>
            <StatusDonut segments={donutSegs} />
            <View style={{ flex: 1, minWidth: 200, gap: 12 } as any}>
              {donutSegs.map((seg) => (
                <TouchableOpacity
                  key={seg.label}
                  activeOpacity={seg.stages ? 0.7 : 1}
                  disabled={!seg.stages}
                  onPress={() => seg.stages && nav.navigate('students', { stages: seg.stages })}
                  {...({ dataSet: seg.stages ? { btn: '1' } : {} } as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                >
                  <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: seg.color }} />
                  <Text style={{ flex: 1, fontSize: 12.5, color: C.textMid, fontWeight: '500' }}>{seg.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text, minWidth: 28, textAlign: 'right' }}>{seg.value}</Text>
                  <Text style={{ fontSize: 11.5, color: C.textMute, fontWeight: '600', minWidth: 40, textAlign: 'right' }}>{Math.round((seg.value / (total || 1)) * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        <Card style={{ flex: 1.5, minWidth: 360, padding: 0, overflow: 'hidden' }} anim>
          <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle>Programme Breakdown</CardTitle></View>
          <View style={tbl.thead}>
            <Text style={[tbl.th, { flex: 1.6 }]}>Programme</Text>
            <Text style={[tbl.th, { textAlign: 'right' }]}>Cohort Size</Text>
            <Text style={[tbl.th, { textAlign: 'right' }]}>Placed</Text>
            <Text style={[tbl.th, { textAlign: 'right' }]}>Rate</Text>
          </View>
          {progs.map(([prog, v]) => {
            const rate = v.size ? Math.round((v.placed / v.size) * 100) : 0;
            return (
              <TouchableOpacity key={prog} activeOpacity={0.7} onPress={() => nav.navigate('students', { programme: prog })} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
                <Text style={[tbl.cell, { flex: 1.6, fontWeight: '600', color: C.text }]}>{prog}</Text>
                <Text style={[tbl.cell, { textAlign: 'right' }]}>{v.size}</Text>
                <Text style={[tbl.cell, { textAlign: 'right', color: C.blue, fontWeight: '600' }]}>{v.placed}</Text>
                <Text style={[tbl.cell, { textAlign: 'right', fontWeight: '700', color: rate >= 80 ? C.green : C.amber }]}>{rate}%</Text>
              </TouchableOpacity>
            );
          })}
          <View style={[tbl.row, { backgroundColor: C.headFill }]}>
            <Text style={[tbl.cell, { flex: 1.6, fontWeight: '700', color: C.text }]}>Total</Text>
            <Text style={[tbl.cell, { textAlign: 'right', fontWeight: '700', color: C.text }]}>{pt.size}</Text>
            <Text style={[tbl.cell, { textAlign: 'right', fontWeight: '700', color: C.text }]}>{pt.placed}</Text>
            <Text style={[tbl.cell, { textAlign: 'right', fontWeight: '700', color: C.text }]}>{pt.size ? Math.round((pt.placed / pt.size) * 100) : 0}%</Text>
          </View>
        </Card>
      </View>

      <View style={[u.colsWrap, { marginTop: 16 }]}>
        <Card style={{ flex: 1, minWidth: 300 }} anim>
          <CardTitle>Bench &amp; Pipeline Overview</CardTitle>
          {[
            { label: 'On Bench (Available)', value: cnt.bench, detail: 'Awaiting placement', color: C.amber },
            { label: 'In Training', value: cnt.training, detail: 'Current cohorts in training', color: CHART.violet },
            { label: 'Placed with DART', value: placedWithDart, detail: 'Internal deployments', color: C.blue },
            { label: 'Inactive (All Time)', value: inactiveAllTime, detail: 'Buy-out + Graduated + Terminated', color: C.textMute },
          ].map((m, i) => (
            <View key={m.label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }, i < 3 && { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: m.color, minWidth: 44 }}>{m.value}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{m.label}</Text>
                <Text style={{ fontSize: 11.5, color: C.textMute }}>{m.detail}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ flex: 1.2, minWidth: 320 }} anim>
          <CardTitle right={<View style={u.countTag}><Text style={u.countTagText}>{activeClients}</Text></View>}>Active Clients</CardTitle>
          {clients.length === 0 ? <Text style={{ fontSize: 13, color: C.textMute }}>No active secondments yet.</Text> :
            clients.map(([name, n]) => (
              <TouchableOpacity key={name} activeOpacity={0.7} onPress={() => nav.navigate('students', { company: name })} {...({ dataSet: { btn: '1' } } as any)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '500', color: C.textMid }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.green }}>{n}</Text>
                </View>
                <View style={u.track}><View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${(n / maxClient) * 100}%` as any : '0%', height: '100%', backgroundColor: CHART.emerald, borderRadius: 4 }} /></View>
              </TouchableOpacity>
            ))}
        </Card>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Students — expandable rows + CV download + edit modal
// ---------------------------------------------------------------------------

const PSTATUS: Record<PlacementRecord['status'], { label: string; fg: string; bg: string }> = {
  active: { label: 'Active', fg: C.green, bg: C.greenSoft },
  completed: { label: 'Completed', fg: C.violet, bg: C.violetSoft },
  terminated: { label: 'Let go', fg: '#B42318', bg: '#FEF3F2' },
};

const IV_OUTCOME: Record<InterviewRecord['outcome'], { label: string; fg: string; bg: string }> = {
  scheduled: { label: 'Scheduled', fg: C.blue, bg: C.blueSoft },
  pending: { label: 'Pending', fg: C.amber, bg: C.amberSoft },
  passed: { label: 'Passed', fg: C.green, bg: C.greenSoft },
  rejected: { label: 'Rejected', fg: '#B42318', bg: '#FEF3F2' },
};

const CCP_CFG: Record<'yes' | 'completed' | 'no', { label: string; fg: string; bg: string }> = {
  yes: { label: 'Yes', fg: C.green, bg: C.greenSoft },
  completed: { label: 'Completed', fg: C.blue, bg: C.blueSoft },
  no: { label: 'No', fg: C.slate, bg: C.slateSoft },
};

function StudentRow({ s, onEdit, trainingEnd, onRefresh }: { s: StaffStudentRecord; onEdit: (s: StaffStudentRecord) => void; trainingEnd?: string; onRefresh?: () => void }) {
  const [open, setOpen] = useState(false);
  const grown = useGrow();
  const hasCV = Boolean(s.cvFilename || s.cvUrl);
  const placements = s.placements ?? [];
  const active = mgmt.activePlacement(placements);
  const currentCompany = active?.company ?? s.placementCompany ?? null;
  const currentRole = active?.role ?? s.placementRole ?? null;
  const served = mgmt.bondServedMonths(placements);
  const bondMode = s.bondMode ?? 'accumulative';
  const reqMonths = s.bondMonths ?? 36;
  const bondPct = Math.min(100, Math.round((served / reqMonths) * 100));
  let bondLeftLabel: string | null = null;
  let bondLeftColor: string = C.textMid;
  if (s.stage === 'bond-completed') { bondLeftLabel = 'Done'; bondLeftColor = C.green; }
  else if (s.stage === 'extended') { bondLeftLabel = 'Extended'; bondLeftColor = STAGE.extended.fg; }
  else if (s.stage !== 'withdrawn') {
    if (bondMode === 'end_date') {
      if (s.bondEndDate) {
        const d = Math.round((new Date(s.bondEndDate).getTime() - Date.now()) / 86400000);
        if (!Number.isNaN(d)) { if (d <= 0) { bondLeftLabel = 'Done'; bondLeftColor = C.green; } else { bondLeftLabel = `${d}d`; bondLeftColor = d < 90 ? C.amber : C.textMid; } }
      }
    } else {
      const remain = reqMonths - served;
      if (remain <= 0) { bondLeftLabel = 'Done'; bondLeftColor = C.green; }
      else { bondLeftLabel = `${Math.ceil(remain)}mo`; bondLeftColor = (!active || remain < 3) ? C.amber : C.textMid; }
    }
  }
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [ivLoaded, setIvLoaded] = useState(false);
  const [ivCompany, setIvCompany] = useState('');
  const [ivRole, setIvRole] = useState('');
  const [ivDate, setIvDate] = useState('');
  const [ivOutcome, setIvOutcome] = useState<InterviewRecord['outcome']>('scheduled');
  const [ivNotes, setIvNotes] = useState('');
  const [pendingSubs, setPendingSubs] = useState<CertSubmission[]>([]);
  function loadInterviews() {
    mgmt.fetchInterviews(s.studentId).then(setInterviews).catch(() => setInterviews([]));
    fetchCertSubmissions(s.studentId, true).then(setPendingSubs).catch(() => {});
    setIvLoaded(true);
  }
  async function decideSub(sub: CertSubmission, ok: boolean) {
    try {
      if (ok) {
        const certs: Certification[] = [...(s.certifications ?? []), {
          id: sub.id, name: sub.name, provider: sub.provider ?? '', earnedAt: sub.earnedAt ?? new Date().toISOString().slice(0, 10),
          track: 'cybersecurity' as CourseTrack, verified: true,
        }];
        await updateStudentRecord(s.studentId, { ...toStudentEdit(s), certifications: certs });
      }
      await reviewCertSubmission(sub.id, ok ? 'approved' : 'rejected');
      setPendingSubs((prev) => prev.filter((x) => x.id !== sub.id));
      if (ok) onRefresh?.();
    } catch (e: any) { if (typeof window !== 'undefined') window.alert(e?.message ?? 'Failed'); }
  }
  function addInterview() {
    if (!ivCompany.trim()) return;
    const rec: InterviewRecord = { id: mgmt.newId(), studentId: s.studentId, company: ivCompany.trim(), role: ivRole.trim() || undefined, date: ivDate || new Date().toISOString().slice(0, 10), outcome: ivOutcome, notes: ivNotes.trim() || undefined };
    mgmt.saveInterview(rec).then(() => { setIvCompany(''); setIvRole(''); setIvDate(''); setIvNotes(''); setIvOutcome('scheduled'); loadInterviews(); });
  }
  function removeInterview(id: string) { mgmt.deleteInterview(id).then(loadInterviews); }
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.borderSoft }}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => { const n = !open; setOpen(n); if (n && !ivLoaded) loadInterviews(); }} {...({ dataSet: { row: '1' } } as any)} style={tbl.row}>
        <View style={{ width: 22, alignItems: 'center' }}>
          <View {...({ dataSet: { chevron: '1' } } as any)} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
            <Icon name="chevron" size={15} color={C.textMute} />
          </View>
        </View>
        <View style={[tbl.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Avatar name={s.name} stage={s.stage} size={34} />
          <View><Text style={tbl.name}>{s.name}</Text><Text style={tbl.meta}>{s.email}</Text></View>
        </View>
        <View style={tbl.cell}>
          <Text style={{ fontSize: 13, color: C.textMid }}>{s.cohortName}</Text>
          {s.stage === 'on-course' && trainingEnd ? <Text style={tbl.meta}>ends {trainingEnd}</Text> : null}
        </View>
        <View style={tbl.cell}><StagePill stage={s.stage} /></View>
        <View style={[tbl.cell, { flex: 1.6 }]}>
          {currentCompany ? (
            <View><Text style={tbl.name}>{currentRole ?? '—'}</Text><Text style={tbl.meta}>{currentCompany}</Text></View>
          ) : <Text style={tbl.meta}>—</Text>}
        </View>
        <View style={[tbl.cell, { flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }]}>
          {s.certifications.length > 0 ? (
            <>
              {s.certifications.slice(0, 3).map((c) => (
                <View key={c.id} style={[tbl.certBadge, c.verified === false && tbl.certBadgePending]}>
                  <Text style={[tbl.certBadgeText, c.verified === false && { color: C.textMute }]} numberOfLines={1}>{c.name}</Text>
                </View>
              ))}
              {s.certifications.length > 3 && <Text style={[tbl.meta, { fontWeight: '700' }]}>+{s.certifications.length - 3}</Text>}
            </>
          ) : <Text style={tbl.meta}>—</Text>}
        </View>
        <View style={[tbl.cell, { flex: 1 }]}>
          {bondLeftLabel ? <Text style={{ fontSize: 12.5, fontWeight: '600', color: bondLeftColor }}>{bondLeftLabel}</Text> : <Text style={tbl.meta}>—</Text>}
        </View>
        <View style={[tbl.cell, { flex: 1.4, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
          {hasCV && (
            <TouchableOpacity style={tbl.iconBtn} onPress={() => downloadCV(s)} {...({ dataSet: { btn: '1' } } as any)}>
              <Icon name="download" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>CV</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={tbl.iconBtn} onPress={() => onEdit(s)} {...({ dataSet: { btn: '1' } } as any)}>
            <Icon name="edit" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {open && (
        <View {...({ dataSet: { anim: 'panel' } } as any)} style={tbl.panel}>
          <View style={{ flex: 1.5, minWidth: 280 } as any}>
            <Text style={tbl.panelLabel}>Placement History</Text>
            {placements.length === 0 ? (
              <Text style={tbl.meta}>No placements recorded.</Text>
            ) : placements.map((p) => {
              const st = PSTATUS[p.status];   // (perf reports listed after history below)
              return (
                <View key={p.id} style={tbl.histRow}>
                  <View style={tbl.histTop}>
                    <Text style={tbl.histCompany}>{p.company}</Text>
                    <View style={[tbl.pStatus, { backgroundColor: st.bg }]}><Text style={[tbl.pStatusText, { color: st.fg }]}>{st.label}</Text></View>
                  </View>
                  <Text style={tbl.meta}>{p.role}</Text>
                  <Text style={tbl.histDates}>{p.startDate} → {p.endDate ?? 'Present'}{typeof p.months === 'number' ? `  ·  ${p.months}mo` : ''}{p.note ? `  ·  ${p.note}` : ''}</Text>
                  {p.jdUrl ? (
                    <TouchableOpacity onPress={() => openUrl(p.jdUrl)} {...({ dataSet: { btn: '1' } } as any)} style={{ marginTop: 3, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 11.5, color: C.blue, fontWeight: '600' }}>JD: {p.jdFilename ?? 'view'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={{ flex: 1, minWidth: 220 } as any}>
            <Text style={tbl.panelLabel}>Bond</Text>
            {bondMode === 'end_date' ? (
              s.bondEndDate ? <Detail label="Bond end (fixed)" value={s.bondEndDate} /> : <Text style={tbl.meta}>No bond date set.</Text>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{served.toFixed(1)} / {reqMonths} mo</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: bondPct >= 100 ? C.green : C.textMid }}>{bondPct}%</Text>
                </View>
                <View style={tbl.bondBar}><View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${bondPct}%` as any : '0%', height: '100%', backgroundColor: bondPct >= 100 ? CHART.emerald : CHART.indigo, borderRadius: 5 }} /></View>
                <Text style={[tbl.histDates, { marginTop: 8 }]}>{s.stage === 'bond-completed' ? 'Bond completed.' : active ? 'Accruing — on placement.' : 'Paused — on bench (accumulative bond).'}</Text>
              </View>
            )}
            <Detail label="Bond mode" value={bondMode === 'end_date' ? 'Fixed end date' : 'Accumulative (pauses on bench)'} />
            <Text style={tbl.panelLabel2}>Performance Reports</Text>
            {(s.performanceReports ?? []).length === 0 ? <Text style={tbl.meta}>None uploaded.</Text> : (s.performanceReports ?? []).map((r) => (
              <TouchableOpacity key={`${r.year}-${r.url}`} onPress={() => openUrl(r.url)} {...({ dataSet: { btn: '1' } } as any)} style={{ paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, color: C.blue, fontWeight: '600' }}>{r.year} — {r.filename ?? 'view report'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flex: 1, minWidth: 220 } as any}>
            <Text style={tbl.panelLabel}>Profile</Text>
            <Detail label="Date of birth" value={s.dateOfBirth ?? '—'} />
            {s.stage === 'on-course' ? <Detail label="Training ends" value={trainingEnd ?? '—'} /> : null}
            <Detail label="Reporting officer" value={active?.reportingOfficer ?? s.reportingOfficer ?? '—'} />
            <Detail label="RO email" value={active?.roEmail ?? s.roEmail ?? '—'} />
            <Detail label="Account manager" value={s.accountManager ?? '—'} />
            <Detail label="Contact" value={s.contactNo ?? '—'} />
            <Detail label="Personal email" value={s.personalEmail ?? '—'} />
            <Detail label="Date joined" value={s.dateJoined ?? '—'} />
            <Detail label="CCP grant" value={s.ccpGrant ? CCP_CFG[s.ccpGrant].label : '—'} />
            <Text style={tbl.panelLabel2}>Certifications</Text>
            {s.certifications.length === 0 ? <Text style={tbl.meta}>None yet.</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {s.certifications.map((c) => (
                  <View key={c.id} style={[{ backgroundColor: C.violetSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }, c.verified === false && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border }]}>
                    <Text style={[{ fontSize: 11, color: C.violet, fontWeight: '600' }, c.verified === false && { color: C.textMute }]}>{c.name}{c.verified === false ? ' (pending)' : ''}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={tbl.panelLabel2}>Upskilling Taken</Text>
            {(s.upskilling ?? []).length === 0 ? <Text style={tbl.meta}>None recorded.</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(s.upskilling ?? []).map((uc) => (
                  <View key={uc.id} style={{ backgroundColor: C.blueSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, color: C.blue, fontWeight: '600' }}>{uc.title}{uc.completedAt ? ` · ${uc.completedAt}` : ''}</Text>
                  </View>
                ))}
              </View>
            )}
            {hasCV ? (
              <TouchableOpacity style={tbl.cvBtn} onPress={() => downloadCV(s)} {...({ dataSet: { btn: '1' } } as any)}>
                <Icon name="download" size={13} color={C.textMid} />
                <Text style={tbl.cvBtnText}>Download CV</Text>
              </TouchableOpacity>
            ) : <Text style={[tbl.meta, { marginTop: 10 }]}>No CV uploaded.</Text>}
          </View>

          <View style={{ flexBasis: '100%', borderTopWidth: 1, borderTopColor: C.borderSoft, paddingTop: 14 }}>
            <Text style={tbl.panelLabel}>Interviews</Text>
            {interviews.length === 0 ? <Text style={tbl.meta}>No interviews logged yet.</Text> : (
              <View style={{ gap: 8, marginBottom: 12 }}>
                {interviews.map((iv) => {
                  const oc = IV_OUTCOME[iv.outcome];
                  return (
                    <View key={iv.id} style={tbl.ivRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={tbl.histCompany}>{iv.company}</Text>
                          <View style={[tbl.pStatus, { backgroundColor: oc.bg }]}><Text style={[tbl.pStatusText, { color: oc.fg }]}>{oc.label}</Text></View>
                        </View>
                        <Text style={tbl.meta}>{[iv.role, iv.date].filter(Boolean).join(' \u00b7 ')}{iv.notes ? `  \u2014  ${iv.notes}` : ''}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeInterview(iv.id)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={13} color="#B42318" /></TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={tbl.ivForm}>
              <TextInput style={[em.input as any, tbl.ivInput]} value={ivCompany} onChangeText={setIvCompany} placeholder="Company" placeholderTextColor="#C2C9D6" />
              <TextInput style={[em.input as any, tbl.ivInput]} value={ivRole} onChangeText={setIvRole} placeholder="Role" placeholderTextColor="#C2C9D6" />
              <TextInput style={[em.input as any, tbl.ivInput, { maxWidth: 130 }]} value={ivDate} onChangeText={setIvDate} placeholder="YYYY-MM-DD" placeholderTextColor="#C2C9D6" />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(Object.keys(IV_OUTCOME) as InterviewRecord['outcome'][]).map((o) => (
                  <TouchableOpacity key={o} onPress={() => setIvOutcome(o)} style={[tbl.ivPill, ivOutcome === o && { backgroundColor: IV_OUTCOME[o].bg, borderColor: IV_OUTCOME[o].fg }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[tbl.ivPillText, ivOutcome === o && { color: IV_OUTCOME[o].fg }]}>{IV_OUTCOME[o].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[em.input as any, tbl.ivInput, { flex: 1, minWidth: 160 }]} value={ivNotes} onChangeText={setIvNotes} placeholder="Notes (optional)" placeholderTextColor="#C2C9D6" />
              <TouchableOpacity onPress={addInterview} style={tbl.ivAddBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={13} color="#fff" /><Text style={tbl.ivAddText}>Add</Text></TouchableOpacity>
            </View>
          </View>

          {pendingSubs.length > 0 && (
            <View style={{ flexBasis: '100%', borderTopWidth: 1, borderTopColor: C.borderSoft, paddingTop: 14 }}>
              <Text style={tbl.panelLabel}>Cert Approvals Pending</Text>
              <View style={{ gap: 8 }}>
                {pendingSubs.map((sub) => (
                  <View key={sub.id} style={tbl.ivRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={tbl.histCompany}>{sub.name}</Text>
                      <Text style={tbl.meta}>{[sub.provider, sub.earnedAt].filter(Boolean).join(' \u00b7 ') || 'self-reported by student'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => decideSub(sub, true)} style={[em.smallBtn, { borderColor: C.greenDot, backgroundColor: C.greenSoft }]} {...({ dataSet: { btn: '1' } } as any)}><Text style={[em.smallBtnText, { color: C.green }]}>Verify</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => decideSub(sub, false)} style={[em.smallBtn, { borderColor: '#FECDCA', backgroundColor: '#FEF3F2' }]} {...({ dataSet: { btn: '1' } } as any)}><Text style={[em.smallBtnText, { color: '#B42318' }]}>Reject</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: 16 }}>
      <Text style={{ fontSize: 12.5, color: C.textMute }}>{label}</Text>
      <Text style={{ fontSize: 12.5, color: C.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/** Months of bond left. 0 = done, null = unknown / not applicable. */
function bondMonthsLeft(s: StaffStudentRecord): number | null {
  if (s.stage === 'bond-completed' || s.stage === 'extended') return 0;
  if (s.stage === 'withdrawn') return null;
  if ((s.bondMode ?? 'accumulative') === 'end_date') {
    if (!s.bondEndDate) return null;
    const m = (new Date(s.bondEndDate).getTime() - Date.now()) / (86400000 * 30.44);
    return Number.isNaN(m) ? null : Math.max(0, m);
  }
  return Math.max(0, (s.bondMonths ?? 36) - mgmt.bondServedMonths(s.placements));
}

const BOND_FILTERS = [
  ['any', 'Any'], ['lt3', 'Ends \u2264 3 mo'], ['lt6', 'Ends \u2264 6 mo'],
  ['lt12', 'Ends \u2264 12 mo'], ['gt12', '12+ mo left'], ['done', 'Done'],
] as const;
type BondFilter = typeof BOND_FILTERS[number][0];

function WebStudents() {
  const { accessToken } = useAuth();
  const nav = useNav();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilters, setStageFilters] = useState<Set<StudentLifecycleStage>>(new Set(nav.studentFilter?.stages ?? []));
  const [cohortFilters, setCohortFilters] = useState<Set<string>>(new Set(nav.studentFilter?.cohort ? [nav.studentFilter.cohort] : []));
  const [ccpFilter, setCcpFilter] = useState<'all' | 'yes' | 'completed' | 'no'>('all');
  const [companyFilter, setCompanyFilter] = useState(nav.studentFilter?.company ?? '');
  const [programmeFilter, setProgrammeFilter] = useState(nav.studentFilter?.programme ?? '');
  const [bondFilter, setBondFilter] = useState<BondFilter>('any');
  const [interviewedFor, setInterviewedFor] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [allIv, setAllIv] = useState<InterviewRecord[]>([]);
  const [allIvLoaded, setAllIvLoaded] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffStudentRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [editStage, setEditStage] = useState<StudentLifecycleStage>('on-course');
  const [editCohort, setEditCohort] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editAcctMgr, setEditAcctMgr] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editDateJoined, setEditDateJoined] = useState('');
  const [editCcp, setEditCcp] = useState<'yes' | 'completed' | 'no' | undefined>(undefined);
  const [editBondMonths, setEditBondMonths] = useState('36');
  const [editBondMode, setEditBondMode] = useState<'accumulative' | 'end_date'>('accumulative');
  const [editBondEnd, setEditBondEnd] = useState('');
  const [editPlacements, setEditPlacements] = useState<PlacementRecord[]>([]);
  const [npCompany, setNpCompany] = useState('');
  const [npRole, setNpRole] = useState('');
  const [npRO, setNpRO] = useState('');
  const [npROEmail, setNpROEmail] = useState('');
  const [editUpskilling, setEditUpskilling] = useState<UpskillingTaken[]>([]);
  const [editCerts, setEditCerts] = useState<Certification[]>([]);
  const [editReports, setEditReports] = useState<PerformanceReport[]>([]);
  const [newCertName, setNewCertName] = useState('');
  const [newCertProvider, setNewCertProvider] = useState('');
  const [repYear, setRepYear] = useState(String(new Date().getFullYear()));
  const [uploadBusy, setUploadBusy] = useState(false);
  const [courseObjs, setCourseObjs] = useState<Course[]>([]);
  useEffect(() => { mgmt.getCourses().then(setCourseObjs).catch(() => {}); }, []);

  useEffect(() => { fetchStaffStudentRoster(accessToken).then(setStudents); }, []);

  // Apply cross-tab navigation filters (e.g. clicking a dashboard segment).
  useEffect(() => {
    const f = nav.studentFilter;
    if (!f) return;
    setStageFilters(new Set(f.stages ?? []));
    setCohortFilters(new Set(f.cohort ? [f.cohort] : []));
    setCompanyFilter(f.company ?? '');
    setProgrammeFilter(f.programme ?? '');
  }, [nav.studentFilter]);

  // Lazy-load every interview once the advanced filters are opened.
  useEffect(() => {
    if (!moreOpen || allIvLoaded) return;
    setAllIvLoaded(true);
    mgmt.fetchAllInterviews().then(setAllIv).catch(() => {});
  }, [moreOpen, allIvLoaded]);
  const ivByStudent = useMemo(() => {
    const m: Record<string, InterviewRecord[]> = {};
    allIv.forEach((r) => { (m[r.studentId] = m[r.studentId] ?? []).push(r); });
    return m;
  }, [allIv]);

  const cohortOptions = useMemo(() => (students ? Array.from(new Set(students.map((s) => s.cohortName))).sort() : []), [students]);
  const [cohortObjs, setCohortObjs] = useState<Cohort[]>([]);
  useEffect(() => { mgmt.getCohorts().then(setCohortObjs).catch(() => {}); }, []);
  const cohortNames = useMemo(() => Array.from(new Set([...(students?.map((s) => s.cohortName) ?? []), ...cohortObjs.map((cc) => cc.name)])).sort(), [students, cohortObjs]);
  const cohortEnd = useMemo(() => {
    const m: Record<string, string> = {};
    cohortObjs.forEach((cc) => { if (cc.endDate && cc.endDate !== 'TBD') m[cc.name] = cc.endDate; });
    return m;
  }, [cohortObjs]);
  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.toLowerCase();
    const co = companyFilter.trim().toLowerCase();
    const iv = interviewedFor.trim().toLowerCase();
    return students.filter((s) => {
      const ms = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.accountManager ?? '').toLowerCase().includes(q) || (s.personalEmail ?? '').toLowerCase().includes(q) || (s.contactNo ?? '').toLowerCase().includes(q);
      const mst = stageFilters.size === 0 || stageFilters.has(s.stage);
      const mc = cohortFilters.size === 0 || cohortFilters.has(s.cohortName);
      const mccp = ccpFilter === 'all' || (s.ccpGrant ?? 'no') === ccpFilter;
      const mprog = !programmeFilter || s.cohortName.toUpperCase().startsWith(programmeFilter.toUpperCase());
      const comp = (mgmt.activePlacement(s.placements)?.company ?? s.placementCompany ?? '').toLowerCase();
      const mcomp = !co || comp.includes(co);
      let mbond = true;
      if (bondFilter !== 'any') {
        const left = bondMonthsLeft(s);
        if (left == null) mbond = false;
        else if (bondFilter === 'done') mbond = left <= 0;
        else if (bondFilter === 'lt3') mbond = left > 0 && left <= 3;
        else if (bondFilter === 'lt6') mbond = left > 0 && left <= 6;
        else if (bondFilter === 'lt12') mbond = left > 0 && left <= 12;
        else mbond = left > 12;
      }
      const miv = !iv || (ivByStudent[s.studentId] ?? []).some((r) => r.company.toLowerCase().includes(iv));
      return ms && mst && mc && mccp && mprog && mcomp && mbond && miv;
    });
  }, [students, search, stageFilters, cohortFilters, ccpFilter, programmeFilter, companyFilter, bondFilter, interviewedFor, ivByStudent]);

  const moreActiveN = (ccpFilter !== 'all' ? 1 : 0) + (bondFilter !== 'any' ? 1 : 0) + (companyFilter.trim() ? 1 : 0) + (interviewedFor.trim() ? 1 : 0) + (programmeFilter ? 1 : 0);
  const activeChips: { label: string; clear: () => void }[] = [
    ...Array.from(stageFilters).map((st) => ({ label: STAGE[st]?.label ?? st, clear: () => setStageFilters((prev) => { const n = new Set(prev); n.delete(st); return n; }) })),
    ...Array.from(cohortFilters).map((cName) => ({ label: cName, clear: () => setCohortFilters((prev) => { const n = new Set(prev); n.delete(cName); return n; }) })),
    ...(programmeFilter ? [{ label: `Programme: ${programmeFilter}`, clear: () => setProgrammeFilter('') }] : []),
    ...(ccpFilter !== 'all' ? [{ label: `CCP: ${CCP_CFG[ccpFilter].label}`, clear: () => setCcpFilter('all') }] : []),
    ...(bondFilter !== 'any' ? [{ label: `Bond: ${BOND_FILTERS.find(([k]) => k === bondFilter)?.[1]}`, clear: () => setBondFilter('any') }] : []),
    ...(companyFilter.trim() ? [{ label: `Company: ${companyFilter.trim()}`, clear: () => setCompanyFilter('') }] : []),
    ...(interviewedFor.trim() ? [{ label: `Interviewed: ${interviewedFor.trim()}`, clear: () => setInterviewedFor('') }] : []),
  ];
  function clearAllFilters() {
    setStageFilters(new Set()); setCohortFilters(new Set()); setCcpFilter('all');
    setBondFilter('any'); setCompanyFilter(''); setInterviewedFor(''); setProgrammeFilter('');
  }

  const today = () => new Date().toISOString().slice(0, 10);
  function openEdit(s: StaffStudentRecord) {
    setEditTarget(s); setEditStage(s.stage);
    setEditCohort(s.cohortName); setEditDob(s.dateOfBirth ?? '');
    setEditAcctMgr(s.accountManager ?? ''); setEditContact(s.contactNo ?? ''); setEditPersonalEmail(s.personalEmail ?? ''); setEditDateJoined(s.dateJoined ?? ''); setEditCcp(s.ccpGrant);
    setEditBondMonths(String(s.bondMonths ?? 36)); setEditBondMode(s.bondMode ?? 'accumulative'); setEditBondEnd(s.bondEndDate ?? '');
    const existing: PlacementRecord[] = s.placements ? [...s.placements]
      : (s.placementCompany ? [{ id: 'p-legacy', company: s.placementCompany, role: s.placementRole ?? '', reportingOfficer: s.reportingOfficer, roEmail: s.roEmail, startDate: s.placementStartDate ?? today(), status: (s.stage === 'on-placement' ? 'active' : s.stage === 'bond-completed' ? 'completed' : 'terminated') }] : []);
    setEditPlacements(existing);
    setNpCompany(''); setNpRole(''); setNpRO(''); setNpROEmail('');
    setEditUpskilling(s.upskilling ?? []); setEditCerts(s.certifications ?? []); setEditReports(s.performanceReports ?? []);
    setNewCertName(''); setNewCertProvider(''); setRepYear(String(new Date().getFullYear()));
  }

  async function attachJD(placementId: string) {
    if (!editTarget) return;
    const f = await pickFile(); if (!f) return;
    setUploadBusy(true);
    try {
      const { url, filename } = await uploadFileToSharePoint({ kind: 'jd', ownerId: editTarget.studentId, filename: f.name, uri: f.uri, mimeType: f.mimeType });
      setEditPlacements((prev) => prev.map((p) => (p.id === placementId ? { ...p, jdUrl: url, jdFilename: filename } : p)));
    } catch (e: any) { if (typeof window !== 'undefined') window.alert(e?.message ?? 'Upload failed'); }
    finally { setUploadBusy(false); }
  }

  async function addReport() {
    if (!editTarget) return;
    const year = Number(repYear);
    if (!year) return;
    const f = await pickFile(); if (!f) return;
    setUploadBusy(true);
    try {
      const { url, filename } = await uploadFileToSharePoint({ kind: 'performance-report', ownerId: editTarget.studentId, filename: f.name, uri: f.uri, mimeType: f.mimeType });
      setEditReports((prev) => [...prev.filter((r) => r.year !== year), { year, url, filename, uploadedAt: new Date().toISOString() }].sort((a, b) => b.year - a.year));
    } catch (e: any) { if (typeof window !== 'undefined') window.alert(e?.message ?? 'Upload failed'); }
    finally { setUploadBusy(false); }
  }

  function toggleUpskilling(co: Course) {
    setEditUpskilling((prev) => prev.some((x) => x.id === co.id)
      ? prev.filter((x) => x.id !== co.id)
      : [...prev, { id: co.id, title: co.title, provider: co.provider, track: co.track, completedAt: new Date().toISOString().slice(0, 10) }]);
  }

  function addCert() {
    if (!newCertName.trim()) return;
    setEditCerts((prev) => [...prev, { id: mgmt.newId(), name: newCertName.trim(), provider: newCertProvider.trim() || '', earnedAt: new Date().toISOString().slice(0, 10), track: 'cybersecurity', verified: true }]);
    setNewCertName(''); setNewCertProvider('');
  }
  function addPlacement() {
    if (!npCompany.trim()) return;
    const rec: PlacementRecord = { id: `p-${Date.now()}`, company: npCompany.trim(), role: npRole.trim(), reportingOfficer: npRO.trim() || undefined, roEmail: npROEmail.trim() || undefined, startDate: today(), status: 'active' };
    setEditPlacements((prev) => [rec, ...prev.map((p) => (p.status === 'active' && !p.endDate ? { ...p, endDate: today(), status: 'completed' as const } : p))]);
    setEditStage('on-placement');
    setNpCompany(''); setNpRole(''); setNpRO(''); setNpROEmail('');
  }
  function endPlacement(id: string, status: 'completed' | 'terminated') {
    setEditPlacements((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, endDate: today(), status } : p));
      if (!next.some((p) => p.status === 'active' && !p.endDate)) setEditStage('job-hunting');
      return next;
    });
  }
  async function handleSave() {
    if (!editTarget) return; setSaving(true);
    const act = editPlacements.find((p) => p.status === 'active' && !p.endDate);
    const override = {
      stage: editStage, cohortName: editCohort, dateOfBirth: editDob || undefined, accountManager: editAcctMgr || undefined, contactNo: editContact || undefined, personalEmail: editPersonalEmail || undefined, dateJoined: editDateJoined || undefined, ccpGrant: editCcp, bondMonths: Number(editBondMonths) || undefined, bondMode: editBondMode, placements: editPlacements,
      placementCompany: act?.company, placementRole: act?.role,
      reportingOfficer: act?.reportingOfficer, roEmail: act?.roEmail, bondEndDate: editBondEnd || undefined,
      upskilling: editUpskilling, performanceReports: editReports, certifications: editCerts,
    };
    try {
      if (isSupabaseConfigured) {
        await updateStudentRecord(editTarget.studentId, {
          stage: editStage, cohortName: editCohort, dateOfBirth: editDob || undefined,
          accountManager: editAcctMgr || undefined, contactNo: editContact || undefined,
          personalEmail: editPersonalEmail || undefined, dateJoined: editDateJoined || undefined,
          ccpGrant: editCcp, bondMonths: Number(editBondMonths) || undefined, bondMode: editBondMode, placements: editPlacements,
          placementCompany: act?.company, placementRole: act?.role,
          reportingOfficer: act?.reportingOfficer, roEmail: act?.roEmail, bondEndDate: editBondEnd || undefined,
          upskilling: editUpskilling, performanceReports: editReports, certifications: editCerts,
        });
      } else {
        mgmt.savePlacement(editTarget.studentId, override);
        await updatePlacementInfo(editTarget.studentId, { stage: editStage, placementCompany: act?.company, placementRole: act?.role, reportingOfficer: act?.reportingOfficer, roEmail: act?.roEmail, bondEndDate: editTarget.bondEndDate });
      }
      setStudents((prev) => prev?.map((s) => (s.studentId === editTarget.studentId ? { ...s, ...override } : s)) ?? null);
      setEditTarget(null);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not save.'); }
    finally { setSaving(false); }
  }

  const STAGE_KEYS = Object.keys(STAGE) as StudentLifecycleStage[];
  if (!students) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      <View style={tbl.filterBar}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or email…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => setStageFilters(new Set())} style={[tbl.chip, stageFilters.size === 0 && tbl.chipOn]} {...({ dataSet: { btn: '1' } } as any)}>
              <Text style={[tbl.chipText, stageFilters.size === 0 && tbl.chipTextOn]}>All stages</Text>
            </TouchableOpacity>
            {STAGE_KEYS.map((st) => {
              const on = stageFilters.has(st);
              return (
                <TouchableOpacity key={st} onPress={() => setStageFilters((prev) => { const n = new Set(prev); n.has(st) ? n.delete(st) : n.add(st); return n; })} style={[tbl.chip, on && tbl.chipOn]} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={[tbl.chipText, on && tbl.chipTextOn]}>{STAGE[st].label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0, maxWidth: 360 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {cohortOptions.map((c) => {
              const on = cohortFilters.has(c);
              return (
                <TouchableOpacity key={c} onPress={() => setCohortFilters((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; })} style={[tbl.chip, on && { backgroundColor: C.violet, borderColor: C.violet }]} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={[tbl.chipText, on && tbl.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={() => setMoreOpen((o) => !o)} style={[tbl.chip, (moreOpen || moreActiveN > 0) && { borderColor: C.text }, moreOpen && { backgroundColor: C.text }]} {...({ dataSet: { btn: '1' } } as any)}>
          <Text style={[tbl.chipText, moreOpen && tbl.chipTextOn, !moreOpen && moreActiveN > 0 && { color: C.text, fontWeight: '700' }]}>
            More filters{moreActiveN > 0 ? ` (${moreActiveN})` : ''}
          </Text>
        </TouchableOpacity>
        <Text style={tbl.count}>{filtered.length} of {students.length} trainee{students.length !== 1 ? 's' : ''}</Text>
      </View>

      {moreOpen && (
        <View {...({ dataSet: { anim: 'panel' } } as any)} style={tbl.moreBar}>
          <View style={tbl.moreGroup}>
            <Text style={tbl.moreLabel}>CCP grant</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'yes', 'completed', 'no'] as const).map((v) => {
                const on = ccpFilter === v;
                return (
                  <TouchableOpacity key={v} onPress={() => setCcpFilter(v)} style={[tbl.chip, on && { backgroundColor: C.green, borderColor: C.green }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[tbl.chipText, on && tbl.chipTextOn]}>{v === 'all' ? 'All' : CCP_CFG[v].label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={tbl.moreGroup}>
            <Text style={tbl.moreLabel}>Bond</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {BOND_FILTERS.map(([k, lab]) => {
                const on = bondFilter === k;
                return (
                  <TouchableOpacity key={k} onPress={() => setBondFilter(k)} style={[tbl.chip, on && { backgroundColor: C.blue, borderColor: C.blue }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[tbl.chipText, on && tbl.chipTextOn]}>{lab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={tbl.moreGroup}>
            <Text style={tbl.moreLabel}>Company</Text>
            <TextInput style={[em.input as any, { minWidth: 170, paddingVertical: 7 }]} value={companyFilter} onChangeText={setCompanyFilter} placeholder="e.g. ST Engineering" placeholderTextColor="#C2C9D6" />
          </View>
          <View style={tbl.moreGroup}>
            <Text style={tbl.moreLabel}>Interviewed for</Text>
            <TextInput style={[em.input as any, { minWidth: 170, paddingVertical: 7 }]} value={interviewedFor} onChangeText={setInterviewedFor} placeholder="company name" placeholderTextColor="#C2C9D6" />
          </View>
        </View>
      )}

      {activeChips.length > 0 && (
        <View style={tbl.activeBar}>
          {activeChips.map((chip) => (
            <TouchableOpacity key={chip.label} onPress={chip.clear} style={tbl.activeChip} {...({ dataSet: { btn: '1' } } as any)}>
              <Text style={tbl.activeChipText}>{chip.label}</Text>
              <Icon name="close" size={11} color={C.textMid} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={clearAllFilters} {...({ dataSet: { btn: '1' } } as any)}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.brand }}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: LAYOUT.pad }} showsVerticalScrollIndicator={false}>
        <View style={u.pageFull}>
          <Card style={{ padding: 0, overflow: 'hidden' }} anim>
            <View style={tbl.thead}>
              <View style={{ width: 22 }} />
              <Text style={[tbl.th, { flex: 2 }]}>Student</Text>
              <Text style={tbl.th}>Cohort</Text>
              <Text style={tbl.th}>Stage</Text>
              <Text style={[tbl.th, { flex: 1.6 }]}>Placement</Text>
              <Text style={[tbl.th, { flex: 1.2 }]}>Certs</Text>
              <Text style={[tbl.th, { flex: 1 }]}>Bond Left</Text>
              <Text style={[tbl.th, { flex: 1.4, textAlign: 'right' }]}>Actions</Text>
            </View>
            {filtered.map((s) => <StudentRow key={s.studentId} s={s} onEdit={openEdit} trainingEnd={cohortEnd[s.cohortName]} onRefresh={() => fetchStaffStudentRoster(accessToken).then(setStudents)} />)}
            {filtered.length === 0 && <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: C.textMute, fontSize: 13 }}>No students match your filters.</Text></View>}
          </Card>
        </View>
      </ScrollView>

      <Modal visible={Boolean(editTarget)} animationType="fade" transparent onRequestClose={() => setEditTarget(null)}>
        <View style={em.backdrop}>
          <View style={em.sheet} {...({ dataSet: { card: '1' } } as any)}>
            <View style={em.head}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {editTarget && <Avatar name={editTarget.name} stage={editStage} size={40} />}
                <View>
                  <Text style={em.title}>{editTarget?.name}</Text>
                  <Text style={em.sub}>{editTarget?.cohortName} · {editTarget?.email}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditTarget(null)} style={em.close} {...({ dataSet: { btn: '1' } } as any)}><Icon name="close" size={15} color={C.textMid} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }}>
              <Text style={em.section}>Lifecycle Stage</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                {(Object.keys(STAGE) as StudentLifecycleStage[]).map((st) => {
                  const on = editStage === st;
                  return (
                    <TouchableOpacity key={st} onPress={() => setEditStage(st)} style={[em.stage, on && { backgroundColor: STAGE[st].bg, borderColor: STAGE[st].dot }]} {...({ dataSet: { btn: '1' } } as any)}>
                      <View style={[pill.dot, { backgroundColor: STAGE[st].dot }]} />
                      <Text style={[em.stageText, on && { color: STAGE[st].fg }]}>{STAGE[st].label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={em.section}>Cohort</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {cohortNames.map((cn) => (
                  <TouchableOpacity key={cn} onPress={() => setEditCohort(cn)} style={[em.stage, editCohort === cn && { backgroundColor: C.slateSoft, borderColor: C.slate }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[em.stageText, editCohort === cn && { color: C.text }]}>{cn}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={em.fieldLabel}>Date of birth</Text>
              <TextInput style={[em.input as any, { marginBottom: 18, maxWidth: 180 }]} value={editDob} onChangeText={setEditDob} placeholder="YYYY-MM-DD" placeholderTextColor="#C2C9D6" />

              <Text style={em.section}>Profile Details</Text>
              <Field label="Account Manager" value={editAcctMgr} onChange={setEditAcctMgr} ph="e.g. Kelly Tan" />
              <Field label="Contact No" value={editContact} onChange={setEditContact} ph="+65 ..." />
              <Field label="Personal Email" value={editPersonalEmail} onChange={setEditPersonalEmail} ph="name@gmail.com" />
              <Field label="Date Joined" value={editDateJoined} onChange={setEditDateJoined} ph="YYYY-MM-DD" />
              <Text style={em.fieldLabel}>CCP Grant</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {(['yes', 'completed', 'no'] as const).map((v) => (
                  <TouchableOpacity key={v} onPress={() => setEditCcp(v)} style={[em.stage, editCcp === v && { backgroundColor: CCP_CFG[v].bg, borderColor: CCP_CFG[v].fg }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[em.stageText, editCcp === v && { color: CCP_CFG[v].fg }]}>{CCP_CFG[v].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={em.section}>Upskilling Taken</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {courseObjs.length === 0 ? <Text style={em.muted}>No courses defined yet (Manage → Upskilling).</Text> : courseObjs.map((co) => {
                  const on = editUpskilling.some((x) => x.id === co.id);
                  return (
                    <TouchableOpacity key={co.id} onPress={() => toggleUpskilling(co)} style={[em.stage, on && { backgroundColor: C.blueSoft, borderColor: C.blue }]} {...({ dataSet: { btn: '1' } } as any)}>
                      <Text style={[em.stageText, on && { color: C.blue }]}>{co.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editUpskilling.filter((x) => !courseObjs.some((co) => co.id === x.id)).map((x) => (
                <TouchableOpacity key={x.id} onPress={() => setEditUpskilling((prev) => prev.filter((y) => y.id !== x.id))} style={[em.stage, { backgroundColor: C.blueSoft, borderColor: C.blue, marginBottom: 8, alignSelf: 'flex-start' }]} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={[em.stageText, { color: C.blue }]}>{x.title}  ×</Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 14 }} />

              <Text style={em.section}>Certifications</Text>
              {editCerts.length === 0 ? <Text style={[em.muted, { marginBottom: 10 }]}>None yet.</Text> : (
                <View style={{ gap: 6, marginBottom: 10 }}>
                  {editCerts.map((c) => (
                    <View key={c.id} style={em.pCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={em.pCompany}>{c.name}{c.verified === false ? '  (pending)' : ''}</Text>
                        <Text style={em.muted}>{[c.provider, c.earnedAt].filter(Boolean).join(' · ') || '—'}</Text>
                      </View>
                      {c.verified === false && (
                        <TouchableOpacity onPress={() => setEditCerts((prev) => prev.map((x) => (x.id === c.id ? { ...x, verified: true } : x)))} style={[em.smallBtn, { borderColor: C.greenDot, backgroundColor: C.greenSoft }]} {...({ dataSet: { btn: '1' } } as any)}>
                          <Text style={[em.smallBtnText, { color: C.green }]}>Verify</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => setEditCerts((prev) => prev.filter((x) => x.id !== c.id))} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={13} color="#B42318" /></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextInput style={[em.input as any, { flex: 1, minWidth: 140 }]} value={newCertName} onChangeText={setNewCertName} placeholder="Cert name (e.g. OSCP)" placeholderTextColor="#C2C9D6" />
                <TextInput style={[em.input as any, { flex: 1, minWidth: 120 }]} value={newCertProvider} onChangeText={setNewCertProvider} placeholder="Provider" placeholderTextColor="#C2C9D6" />
                <TouchableOpacity onPress={addCert} style={em.smallBtn} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.smallBtnText}>Add</Text></TouchableOpacity>
              </View>

              <Text style={em.section}>Performance Reports (year-on-year)</Text>
              {editReports.length === 0 ? <Text style={[em.muted, { marginBottom: 10 }]}>None uploaded.</Text> : (
                <View style={{ gap: 6, marginBottom: 10 }}>
                  {editReports.map((r) => (
                    <View key={r.year} style={em.pCard}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => openUrl(r.url)} {...({ dataSet: { btn: '1' } } as any)}>
                        <Text style={em.pCompany}>{r.year}</Text>
                        <Text style={[em.muted, { color: C.blue }]}>{r.filename ?? 'view report'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditReports((prev) => prev.filter((x) => x.year !== r.year))} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={13} color="#B42318" /></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22, alignItems: 'center' }}>
                <TextInput style={[em.input as any, { maxWidth: 90 }]} value={repYear} onChangeText={setRepYear} keyboardType="numeric" placeholder="Year" placeholderTextColor="#C2C9D6" />
                <TouchableOpacity onPress={addReport} disabled={uploadBusy} style={em.smallBtn} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={em.smallBtnText}>{uploadBusy ? 'Uploading…' : 'Upload report'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={em.section}>Bond</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {([['accumulative', 'Accumulative (pauses on bench)'], ['end_date', 'Fixed end date']] as const).map(([m, lab]) => (
                  <TouchableOpacity key={m} onPress={() => setEditBondMode(m)} style={[em.stage, editBondMode === m && { backgroundColor: C.slateSoft, borderColor: C.slate }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[em.stageText, editBondMode === m && { color: C.text }]}>{lab}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {editBondMode === 'accumulative' ? (
                <View style={{ marginBottom: 22 }}>
                  <Text style={em.fieldLabel}>Required service (months)</Text>
                  <TextInput style={[em.input as any, { maxWidth: 140 }]} value={editBondMonths} onChangeText={setEditBondMonths} keyboardType="numeric" placeholder="36" placeholderTextColor="#C2C9D6" />
                </View>
              ) : (
                <View style={{ marginBottom: 22 }}>
                  <Text style={em.fieldLabel}>Bond end date</Text>
                  <TextInput style={[em.input as any, { maxWidth: 180 }]} value={editBondEnd} onChangeText={setEditBondEnd} placeholder="YYYY-MM-DD" placeholderTextColor="#C2C9D6" />
                </View>
              )}

              <Text style={em.section}>Placements</Text>
              {editPlacements.length === 0 ? <Text style={[em.muted, { marginBottom: 14 }]}>No placements yet.</Text> : (
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {editPlacements.map((p) => {
                    const st = PSTATUS[p.status];
                    const isActive = p.status === 'active' && !p.endDate;
                    return (
                      <View key={p.id} style={em.pCard}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={em.pCompany}>{p.company}</Text>
                            <View style={[tbl.pStatus, { backgroundColor: st.bg }]}><Text style={[tbl.pStatusText, { color: st.fg }]}>{st.label}</Text></View>
                          </View>
                          <Text style={em.muted}>{p.role || '—'} · {p.startDate} → {p.endDate ?? 'Present'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            {p.jdUrl ? (
                              <TouchableOpacity onPress={() => openUrl(p.jdUrl)} {...({ dataSet: { btn: '1' } } as any)}>
                                <Text style={{ fontSize: 11.5, color: C.blue, fontWeight: '600' }}>JD: {p.jdFilename ?? 'view'}</Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity onPress={() => attachJD(p.id)} disabled={uploadBusy} {...({ dataSet: { btn: '1' } } as any)}>
                              <Text style={{ fontSize: 11.5, color: C.brand, fontWeight: '600' }}>{uploadBusy ? 'Uploading…' : p.jdUrl ? 'Replace JD' : 'Attach JD'}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        {isActive && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity style={em.smallBtn} onPress={() => endPlacement(p.id, 'completed')} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.smallBtnText}>End</Text></TouchableOpacity>
                            <TouchableOpacity style={[em.smallBtn, { borderColor: '#FECDCA', backgroundColor: '#FEF3F2' }]} onPress={() => endPlacement(p.id, 'terminated')} {...({ dataSet: { btn: '1' } } as any)}><Text style={[em.smallBtnText, { color: '#B42318' }]}>Let go</Text></TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={em.section}>Add Placement</Text>
              {[
                { label: 'Company', value: npCompany, set: setNpCompany, ph: 'e.g. ST Engineering' },
                { label: 'Role', value: npRole, set: setNpRole, ph: 'e.g. Cybersecurity Analyst' },
                { label: 'Reporting Officer', value: npRO, set: setNpRO, ph: 'Full name' },
                { label: 'RO Email', value: npROEmail, set: setNpROEmail, ph: 'officer@company.com' },
              ].map((f) => (
                <View key={f.label} style={{ marginBottom: 12 }}>
                  <Text style={em.fieldLabel}>{f.label}</Text>
                  <TextInput style={em.input as any} value={f.value} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#C2C9D6" />
                </View>
              ))}
              <TouchableOpacity style={em.addBtn} onPress={addPlacement} {...({ dataSet: { btn: '1' } } as any)}>
                <Icon name="plus" size={14} color={C.brand} />
                <Text style={em.addBtnText}>Add placement</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={em.foot}>
              <TouchableOpacity style={em.cancel} onPress={() => setEditTarget(null)} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={em.save} onPress={handleSave} disabled={saving} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const tbl = StyleSheet.create({
  filterBar: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: LAYOUT.pad, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontSize: 12, fontWeight: '500', color: C.textMid },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  count: { fontSize: 12, color: C.textMute, marginLeft: 'auto' as any, flexShrink: 0 },
  thead: { flexDirection: 'row', backgroundColor: C.headFill, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { flex: 1, fontSize: 11, fontWeight: '600', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  cell: { flex: 1, fontSize: 13, color: C.textMid },
  name: { fontSize: 13.5, fontWeight: '600', color: C.text },
  meta: { fontSize: 12, color: C.textMute, marginTop: 1 },
  certCount: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.violetSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14 },
  certCountText: { fontSize: 12, fontWeight: '700', color: C.violet },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  iconBtnText: { fontSize: 12, fontWeight: '600', color: C.textMid },
  panel: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, backgroundColor: '#FBFCFE', paddingLeft: 38, paddingRight: 24, paddingVertical: 20, borderTopWidth: 1, borderTopColor: C.borderSoft },
  panelLabel2: { fontSize: 11, fontWeight: '700', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  histRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  histCompany: { fontSize: 13, fontWeight: '600', color: C.text },
  histDates: { fontSize: 11.5, color: C.textMute, marginTop: 3 },
  pStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  pStatusText: { fontSize: 10.5, fontWeight: '700' },
  bondBar: { height: 10, backgroundColor: C.borderSoft, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  ivRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  ivForm: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  ivInput: { paddingVertical: 7, minWidth: 120 },
  ivPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  ivPillText: { fontSize: 11.5, fontWeight: '600', color: C.textMid },
  ivAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.brand, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8 },
  ivAddText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  panelLabel: { fontSize: 11, fontWeight: '700', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.violetSoft, alignItems: 'center', justifyContent: 'center' },
  certName: { fontSize: 13, fontWeight: '600', color: C.text },
  cvBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, marginTop: 14 },
  cvBtnText: { fontSize: 12, fontWeight: '600', color: C.textMid },
  moreBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, paddingHorizontal: LAYOUT.pad, paddingVertical: 12, backgroundColor: '#FBFCFE', borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'flex-end' },
  moreGroup: { gap: 6 },
  moreLabel: { fontSize: 11, fontWeight: '700', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.4 },
  activeBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingHorizontal: LAYOUT.pad, paddingVertical: 8, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.slateSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  activeChipText: { fontSize: 12, fontWeight: '600', color: C.textMid },
  certBadge: { backgroundColor: C.violetSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, maxWidth: 92 },
  certBadgePending: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  certBadgeText: { fontSize: 10, fontWeight: '700', color: C.violet },
});

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.45)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: 540, maxHeight: '86%' as any, backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', flexDirection: 'column' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 22, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 16, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.textMute, marginTop: 2 },
  close: { padding: 8, borderRadius: 8, backgroundColor: C.slateSoft },
  section: { fontSize: 11, fontWeight: '700', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  stageText: { fontSize: 12, fontWeight: '600', color: C.textMid },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textMid, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.text, backgroundColor: '#FCFCFD', outlineStyle: 'none' } as any,
  foot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: C.border },
  cancel: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelText: { fontSize: 13, fontWeight: '600', color: C.textMid },
  save: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: C.brand },
  saveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  muted: { fontSize: 12.5, color: C.textMute },
  pCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  pCompany: { fontSize: 13, fontWeight: '600', color: C.text },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  smallBtnText: { fontSize: 11.5, fontWeight: '600', color: C.textMid },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: C.brand, borderStyle: 'dashed', paddingVertical: 10, borderRadius: 8, marginTop: 2 },
  addBtnText: { fontSize: 12.5, fontWeight: '700', color: C.brand },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
});

// ---------------------------------------------------------------------------
// Growth — grouped bars + trend line + table
// ---------------------------------------------------------------------------

const SERIES = [
  { key: 'enrolled' as const, label: 'Enrolled', color: CHART.indigo },
  { key: 'placed' as const, label: 'Placed', color: CHART.emerald },
  { key: 'seconded' as const, label: 'Seconded', color: CHART.violet },
];

function Funnel({ enrolled, graduated, placed, labels }: { enrolled: number; graduated: number; placed: number; labels?: [string, string, string] }) {
  const grown = useGrow();
  const L = labels ?? ['Enrolled', 'Graduated', 'Placed'];
  const steps = [
    { label: L[0], n: enrolled, color: CHART.indigo, pct: 100 },
    { label: L[1], n: graduated, color: CHART.violet, pct: enrolled ? Math.round((graduated / enrolled) * 100) : 0 },
    { label: L[2], n: placed, color: CHART.emerald, pct: enrolled ? Math.round((placed / enrolled) * 100) : 0 },
  ];
  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      {steps.map((st) => (
        <View key={st.label}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.textMid }}>{st.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{st.n} <Text style={{ color: C.textMute, fontWeight: '600' }}>· {st.pct}%</Text></Text>
          </View>
          <View style={{ height: 22, backgroundColor: C.borderSoft, borderRadius: 6, overflow: 'hidden' }}>
            <View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${st.pct}%` as any : '0%', height: '100%', backgroundColor: st.color, borderRadius: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function WebGrowth() {
  const { accessToken } = useAuth();
  const nav = useNav();
  const grown = useGrow();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  useEffect(() => {
    fetchStaffStudentRoster(accessToken).then((roster) => {
      if (isSupabaseConfigured) { setStudents(roster); return; }
      const ov = mgmt.getPlacementOverrides();
      setStudents(roster.map((s) => (ov[s.studentId] ? { ...s, ...ov[s.studentId] } : s)));
    });
  }, []);
  if (!students) return <Loader />;

  const everPlaced = (s: StaffStudentRecord) => (s.placements && s.placements.length > 0) || Boolean(s.placementCompany);
  const sc = (n: string) => n.replace(/\s+/g, '');
  type CPoint = { cohortName: string; enrolled: number; placed: number; seconded: number; year: number };
  const byCohort: Record<string, CPoint> = {};
  students.forEach((s) => {
    const k = s.cohortName || 'Other';
    if (!byCohort[k]) byCohort[k] = { cohortName: k, enrolled: 0, placed: 0, seconded: 0, year: 0 };
    byCohort[k].enrolled++;
    if (everPlaced(s)) byCohort[k].placed++;
    if (trainCategory(s) === 'seconded') byCohort[k].seconded++;
    const y = Number((s.dateJoined || '').slice(0, 4));
    if (y && (!byCohort[k].year || y < byCohort[k].year)) byCohort[k].year = y;
  });
  const points = Object.values(byCohort).sort((a, b) => (a.year - b.year) || a.cohortName.localeCompare(b.cohortName));
  const recent = points.slice(-14);
  const maxVal = Math.max(...recent.flatMap((p) => [p.enrolled, p.placed, p.seconded]), 1);
  const overall = {
    enrolled: points.reduce((s, p) => s + p.enrolled, 0),
    placed: points.reduce((s, p) => s + p.placed, 0),
    seconded: points.reduce((s, p) => s + p.seconded, 0),
  };
  const rate = overall.enrolled ? Math.round((overall.placed / overall.enrolled) * 100) : 0;
  const trend = recent.filter((p) => p.enrolled > 0).map((p) => ({ label: sc(p.cohortName), value: Math.round((p.placed / p.enrolled) * 100) }));
  const byYear: Record<number, number> = {};
  points.forEach((p) => { if (p.year) byYear[p.year] = (byYear[p.year] ?? 0) + p.enrolled; });
  const years = Object.entries(byYear).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxYear = Math.max(...years.map(([, n]) => n), 1);
  const YEAR_COL = CHART_SERIES;

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Total Enrolled" value={overall.enrolled} icon="users" tint={C.blue} soft={C.blueSoft} onPress={() => nav.navigate('students')} />
        <KpiCard label="Ever Placed" value={overall.placed} icon="briefcase" tint={C.green} soft={C.greenSoft} onPress={() => nav.navigate('students')} />
        <KpiCard label="Currently Seconded" value={overall.seconded} icon="cap" tint={C.violet} soft={C.violetSoft} onPress={() => nav.navigate('students', { stages: ['on-placement'] })} />
        <KpiCard label="Placement Rate" value={rate} suffix="%" icon="trending" tint={C.brand} soft={C.brandSoft} onPress={() => nav.navigate('dashboard')} />
      </View>

      <View style={u.colsWrap}>
        <Card style={{ flex: 1.4, minWidth: 360 }} anim>
          <CardTitle right={
            <View style={{ flexDirection: 'row', gap: 14 }}>
              {SERIES.map((se) => (
                <View key={se.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: se.color }} />
                  <Text style={{ fontSize: 11.5, color: C.textMid, fontWeight: '500' }}>{se.label}</Text>
                </View>
              ))}
            </View>
          }>Cohort Outcomes</CardTitle>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 210, paddingTop: 16 }}>
            {recent.map((row) => (
              <TouchableOpacity key={row.cohortName} activeOpacity={0.7} onPress={() => nav.navigate('students', { cohort: row.cohortName })} {...({ dataSet: { btn: '1' } } as any)} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, width: '100%' }}>
                  {SERIES.map((se) => (
                    <View key={se.key} {...({ dataSet: { bar: '1' } } as any)} style={{ flex: 1, maxWidth: 14, backgroundColor: se.color, borderTopLeftRadius: 4, borderTopRightRadius: 4, height: grown ? `${(row[se.key] / maxVal) * 100}%` as any : '0%' }} />
                  ))}
                </View>
                <Text style={{ fontSize: 10, color: C.textMute, marginTop: 8, fontWeight: '600' }} numberOfLines={1}>{sc(row.cohortName)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={{ flex: 1, minWidth: 300 }} anim>
          <CardTitle>Placement Rate Trend</CardTitle>
          <LineChart data={trend} />
        </Card>
      </View>

      <View style={[u.colsWrap, { marginTop: 16 }]}>
        <Card style={{ flex: 1, minWidth: 300 }} anim>
          <CardTitle>Outcome Funnel</CardTitle>
          <Funnel enrolled={overall.enrolled} graduated={overall.placed} placed={overall.seconded} labels={['Enrolled', 'Ever Placed', 'Currently Seconded']} />
        </Card>
        <Card style={{ flex: 1, minWidth: 300 }} anim>
          <CardTitle>Enrolled by Year</CardTitle>
          {years.length === 0 ? <Text style={{ fontSize: 13, color: C.textMute, paddingVertical: 20 }}>No join dates recorded.</Text> : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, height: 180, paddingTop: 12 }}>
            {years.map(([yr, n], i) => (
              <View key={yr} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 }}>{n}</Text>
                <View style={{ flex: 1, justifyContent: 'flex-end', width: '52%' }}>
                  <View {...({ dataSet: { bar: '1' } } as any)} style={{ width: '100%', backgroundColor: YEAR_COL[i % YEAR_COL.length], borderTopLeftRadius: 5, borderTopRightRadius: 5, height: grown ? `${(n / maxYear) * 100}%` as any : '0%' }} />
                </View>
                <Text style={{ fontSize: 11.5, color: C.textMute, marginTop: 8, fontWeight: '600' }}>{yr}</Text>
              </View>
            ))}
          </View>
          )}
        </Card>
      </View>

      <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }} anim>
        <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle>Cohort Breakdown</CardTitle></View>
        <View style={tbl.thead}>
          {['Cohort', 'Year', 'Enrolled', 'Placed', 'Seconded', 'Rate'].map((col) => <Text key={col} style={tbl.th}>{col}</Text>)}
        </View>
        {points.map((row) => {
          const r = row.enrolled ? Math.round((row.placed / row.enrolled) * 100) : 0;
          return (
            <TouchableOpacity key={row.cohortName} activeOpacity={0.7} onPress={() => nav.navigate('students', { cohort: row.cohortName })} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <Text style={[tbl.cell, { fontWeight: '600', color: C.text }]}>{row.cohortName}</Text>
              <Text style={tbl.cell}>{row.year || '—'}</Text>
              <Text style={tbl.cell}>{row.enrolled}</Text>
              <Text style={tbl.cell}>{row.placed}</Text>
              <Text style={tbl.cell}>{row.seconded}</Text>
              <View style={tbl.cell}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, maxWidth: 70, height: 6, backgroundColor: C.borderSoft, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${r}%` as any, height: '100%', backgroundColor: r >= 70 ? C.greenDot : C.amberDot, borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: r >= 70 ? C.green : C.amber }}>{r}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// News — redesigned cards by type
// ---------------------------------------------------------------------------

function WebNews() {
  const { accessToken, user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'announcements' | 'community'>('announcements');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fType, setFType] = useState<AnnouncementType>('update');
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fAudience, setFAudience] = useState<'all' | 'students' | 'staff'>('all');
  const [fPinned, setFPinned] = useState(false);
  const [fAchiever, setFAchiever] = useState('');
  const [fCohort, setFCohort] = useState('');
  const [fCert, setFCert] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { fetchAnnouncements(accessToken).then((a) => { setItems(a); setLoading(false); }); }, []);

  function openAdd() {
    setEditingId(null);
    setFType(tab === 'community' ? 'achievement' : 'update');
    setFTitle(''); setFBody(''); setFAudience('all'); setFPinned(false);
    setFAchiever(''); setFCohort(''); setFCert('');
    setAdding(true);
  }
  function openEdit(item: Announcement) {
    setEditingId(item.id);
    setFType(item.type); setFTitle(item.title); setFBody(item.body);
    setFAudience(item.audience); setFPinned(Boolean(item.pinned));
    setFAchiever(item.achieverName ?? ''); setFCohort(item.achieverCohort ?? ''); setFCert(item.certificationName ?? '');
    setAdding(true);
  }
  function deletePost(item: Announcement) {
    const ok = typeof window === 'undefined' ? true : window.confirm(`Delete "${item.title}"?`);
    if (!ok) return;
    mgmt.deleteAnnouncement(item.id).then(() => fetchAnnouncements(accessToken)).then(setItems);
  }
  function savePost() {
    if (!fTitle.trim()) return;
    setSaving(true);
    const original = editingId ? items.find((i) => i.id === editingId) : undefined;
    const post: Announcement = {
      id: editingId ?? `a-${Date.now()}`, type: fType, title: fTitle.trim(), body: fBody.trim(),
      postedAt: original?.postedAt ?? new Date().toISOString(), audience: fAudience, pinned: fPinned || undefined,
      author: original?.author ?? user?.displayName ?? 'Staff',
      ...(fType === 'achievement' ? { achieverName: fAchiever.trim() || undefined, achieverCohort: fCohort.trim() || undefined, certificationName: fCert.trim() || undefined } : {}),
    };
    mgmt.saveAnnouncement(post).then(() => fetchAnnouncements(accessToken)).then((a) => { setItems(a); setSaving(false); setAdding(false); setTab(fType === 'achievement' ? 'community' : 'announcements'); });
  }

  if (loading) return <Loader />;

  const sorted = [...items].sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))) || (new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()));
  const list = sorted.filter((i) => (tab === 'community' ? i.type === 'achievement' : i.type !== 'achievement'));
  const AUD: Array<'all' | 'students' | 'staff'> = ['all', 'students', 'staff'];
  const TYPES: AnnouncementType[] = ['update', 'event', 'achievement'];

  return (
    <Page>
      <View style={news.bar2}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['announcements', 'Announcements'], ['community', 'Community']] as const).map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={[mst.tab, tab === k && mst.tabOn]} {...({ dataSet: { btn: '1' } } as any)}>
              <Text style={[mst.tabText, tab === k && mst.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={openAdd} style={news.newBtn} {...({ dataSet: { btn: '1' } } as any)}>
          <Icon name="plus" size={14} color="#fff" /><Text style={news.newBtnText}>New post</Text>
        </TouchableOpacity>
      </View>

      <View style={news.grid}>
        {list.length === 0 ? <Text style={{ fontSize: 13, color: C.textMute, paddingVertical: 20 }}>Nothing here yet — add the first post.</Text> : list.map((item) => {
          const cfg = NEWS_CFG[item.type] ?? NEWS_CFG.update;
          return (
            <Card key={item.id} style={[news.card, item.pinned ? news.cardWide : news.cardHalf, item.pinned && { borderColor: cfg.bar }]} anim>
              <View style={[news.bar, { backgroundColor: cfg.bar }]} />
              <View style={{ flex: 1 }}>
                <View style={news.top}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <View style={[news.typeTag, { backgroundColor: cfg.bg }]}>
                      <Icon name={cfg.icon} size={12} color={cfg.fg} />
                      <Text style={[news.typeText, { color: cfg.fg }]}>{cfg.label}</Text>
                    </View>
                    {item.pinned && (
                      <View style={news.pinTag}><Icon name="pin" size={11} color={C.brand} /><Text style={news.pinText}>Pinned</Text></View>
                    )}
                    <View style={news.audTag}><Text style={news.audText}>{item.audience}</Text></View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={news.date}>{new Date(item.postedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    <TouchableOpacity onPress={() => openEdit(item)} style={news.cardAct} {...({ dataSet: { btn: '1' } } as any)}><Icon name="edit" size={13} color={C.textMid} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => deletePost(item)} style={news.cardAct} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={13} color="#B42318" /></TouchableOpacity>
                  </View>
                </View>
                <Text style={news.title}>{item.title}</Text>
                {item.type === 'achievement' && item.achieverName ? (
                  <View style={news.achieve}>
                    <Avatar name={item.achieverName} size={30} />
                    <View>
                      <Text style={news.achieveName}>{item.achieverName}{item.achieverCohort ? ` · ${item.achieverCohort}` : ''}</Text>
                      {item.certificationName ? <Text style={news.meta}>{item.certificationName}{item.certProvider ? ` — ${item.certProvider}` : ''}</Text> : null}
                    </View>
                  </View>
                ) : null}
                <Text style={news.body}>{item.body}</Text>
                <View style={news.foot}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={news.authorAvatar}><Text style={news.authorInitial}>{(item.author ?? 'R').charAt(0)}</Text></View>
                    <Text style={news.author}>{item.author ?? 'Red Alpha'}</Text>
                  </View>
                  {item.reactions && item.reactions.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {item.reactions.map((r) => (
                        <View key={r.label} style={news.reaction}><Text style={{ fontSize: 12 }}>{r.emoji}</Text><Text style={news.reactionCount}>{r.count}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <View style={em.backdrop}>
          <View style={em.sheet} {...({ dataSet: { card: '1' } } as any)}>
            <View style={em.head}>
              <Text style={em.title}>{editingId ? 'Edit post' : `New ${fType === 'achievement' ? 'community' : 'announcement'} post`}</Text>
              <TouchableOpacity onPress={() => setAdding(false)} style={em.close} {...({ dataSet: { btn: '1' } } as any)}><Icon name="close" size={15} color={C.textMid} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }}>
              <Text style={em.section}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {TYPES.map((t) => {
                  const cfg = NEWS_CFG[t]; const on = fType === t;
                  return (
                    <TouchableOpacity key={t} onPress={() => setFType(t)} style={[em.stage, on && { backgroundColor: cfg.bg, borderColor: cfg.bar }]} {...({ dataSet: { btn: '1' } } as any)}>
                      <Icon name={cfg.icon} size={12} color={cfg.fg} />
                      <Text style={[em.stageText, on && { color: cfg.fg }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={em.fieldLabel}>Title</Text>
              <TextInput style={[em.input as any, { marginBottom: 14 }]} value={fTitle} onChangeText={setFTitle} placeholder="Post title" placeholderTextColor="#C2C9D6" />
              <Text style={em.fieldLabel}>Body</Text>
              <TextInput style={[em.input as any, { marginBottom: 14, minHeight: 90, textAlignVertical: 'top' }]} value={fBody} onChangeText={setFBody} placeholder="Write your message…" placeholderTextColor="#C2C9D6" multiline />
              {fType === 'achievement' && (
                <View>
                  <Text style={em.fieldLabel}>Student name</Text>
                  <TextInput style={[em.input as any, { marginBottom: 14 }]} value={fAchiever} onChangeText={setFAchiever} placeholder="e.g. Wei Ling Tan" placeholderTextColor="#C2C9D6" />
                  <Text style={em.fieldLabel}>Cohort</Text>
                  <TextInput style={[em.input as any, { marginBottom: 14 }]} value={fCohort} onChangeText={setFCohort} placeholder="e.g. Cohort 13" placeholderTextColor="#C2C9D6" />
                  <Text style={em.fieldLabel}>Certification (optional)</Text>
                  <TextInput style={[em.input as any, { marginBottom: 14 }]} value={fCert} onChangeText={setFCert} placeholder="e.g. AWS Solutions Architect" placeholderTextColor="#C2C9D6" />
                </View>
              )}
              <Text style={em.section}>Audience</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {AUD.map((a) => (
                  <TouchableOpacity key={a} onPress={() => setFAudience(a)} style={[em.stage, fAudience === a && { backgroundColor: C.slateSoft, borderColor: C.slate }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[em.stageText, fAudience === a && { color: C.text }, { textTransform: 'capitalize' }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setFPinned((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} {...({ dataSet: { btn: '1' } } as any)}>
                <View style={[em.checkbox, fPinned && { backgroundColor: C.brand, borderColor: C.brand }]}>{fPinned && <Icon name="pin" size={11} color="#fff" />}</View>
                <Text style={{ fontSize: 13, color: C.textMid, fontWeight: '500' }}>Pin to top</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={em.foot}>
              <TouchableOpacity style={em.cancel} onPress={() => setAdding(false)} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={em.save} onPress={savePost} disabled={saving} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.saveText}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Post'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const news = StyleSheet.create({
  bar2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, width: '100%' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.brand, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  card: { flexDirection: 'row', gap: 16, paddingLeft: 0, overflow: 'hidden' },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  cardWide: { flexBasis: '100%' },
  cardHalf: { flexGrow: 1, flexBasis: '46%', minWidth: 360 },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 14 },
  typeText: { fontSize: 11, fontWeight: '700' },
  pinTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.brandSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 14 },
  pinText: { fontSize: 11, color: C.brand, fontWeight: '700' },
  audTag: { backgroundColor: C.slateSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 14 },
  audText: { fontSize: 11, color: C.textMid, fontWeight: '600', textTransform: 'capitalize' },
  date: { fontSize: 11.5, color: C.textMute },
  title: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8, letterSpacing: -0.2 },
  achieve: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.amberSoft, padding: 10, borderRadius: 10, marginBottom: 10 },
  achieveName: { fontSize: 13, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.textMute, marginTop: 1 },
  body: { fontSize: 13.5, color: C.textMid, lineHeight: 21 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderSoft },
  authorAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.slateSoft, alignItems: 'center', justifyContent: 'center' },
  authorInitial: { fontSize: 11, fontWeight: '700', color: C.slate },
  author: { fontSize: 12, fontWeight: '600', color: C.textMid },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.slateSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 14 },
  cardAct: { padding: 5, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  reactionCount: { fontSize: 11.5, fontWeight: '600', color: C.textMid },
});

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const u = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.appBg },
  scrollPad: { padding: LAYOUT.pad, paddingBottom: 44, alignItems: 'center' },
  pageInner: { width: '100%', maxWidth: LAYOUT.maxW },
  pageFull: { width: '100%' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.appBg },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  kpiRow: { flexDirection: 'row', gap: 16, marginBottom: 16, flexWrap: 'wrap', width: '100%', maxWidth: LAYOUT.maxW },
  colsWrap: { flexDirection: 'row', gap: 16, alignItems: 'stretch', flexWrap: 'wrap', width: '100%', maxWidth: LAYOUT.maxW },
  track: { height: 8, backgroundColor: '#EFF1F4', borderRadius: 4, overflow: 'hidden' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FCFCFD', borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8, minWidth: 240 },
  searchInput: { fontSize: 13, color: C.text, flex: 1, outlineStyle: 'none' } as any,
  countTag: { backgroundColor: C.amberSoft, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 12 },
  countTagText: { fontSize: 12, fontWeight: '700', color: C.amber },
});

// ---------------------------------------------------------------------------
// Page config + root
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Manage — cohorts + weekly syllabus, upskilling courses
// ---------------------------------------------------------------------------

const TRACKS: CourseTrack[] = ['cybersecurity', 'cloud', 'network', 'data', 'ai', 'software'];
const TRACK_COLOR: Record<string, string> = { cybersecurity: CHART.rose, cloud: CHART.sky, network: CHART.indigo, data: CHART.amber, ai: CHART.violet, software: CHART.teal };

function Field({ label, value, onChange, ph, numeric }: { label: string; value: string; onChange: (s: string) => void; ph?: string; numeric?: boolean }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={em.fieldLabel}>{label}</Text>
      <TextInput style={em.input as any} value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor="#C2C9D6" keyboardType={numeric ? 'numeric' : 'default'} />
    </View>
  );
}

function CohortCard({ cohort, onEdit, onDelete }: { cohort: Cohort; onEdit: (c: Cohort) => void; onDelete?: (c: Cohort) => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [weeks, setWeeks] = useState<SyllabusWeek[]>([]);
  const [savedMsg, setSavedMsg] = useState(false);
  function toggle() {
    if (!open && !loaded) { mgmt.getSyllabus(cohort.id).then(setWeeks).catch(() => setWeeks([])); setLoaded(true); }
    setOpen((o) => !o);
  }
  function addWeek() { setWeeks((w) => [...w, { weekNumber: w.length + 1, title: '', topics: '' }]); }
  function setWeek(i: number, patch: Partial<SyllabusWeek>) { setWeeks((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x))); }
  function removeWeek(i: number) { setWeeks((w) => w.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, weekNumber: idx + 1 }))); }
  function save() { mgmt.saveSyllabus(cohort.id, weeks).then(() => { setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1800); }); }
  return (
    <View style={mst.cohortCard}>
      <TouchableOpacity onPress={toggle} {...({ dataSet: { btn: '1' } } as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 9, height: 9, borderRadius: 4, backgroundColor: cohort.color }} />
        <View style={{ flex: 1 }}>
          <Text style={mst.cohortName}>{cohort.name}</Text>
          <Text style={tbl.meta}>{cohort.track} · {cohort.startDate} → {cohort.endDate}</Text>
          {cohort.moodleName ? <Text style={[tbl.meta, { color: C.violet }]}>Moodle: {cohort.moodleName}</Text> : null}
        </View>
        {cohort.active && <View style={mst.activeTag}><Text style={mst.activeTagText}>Active</Text></View>}
        <TouchableOpacity onPress={() => onEdit(cohort)} style={tbl.iconBtn} {...({ dataSet: { btn: '1' } } as any)}>
          <Icon name="edit" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>Edit</Text>
        </TouchableOpacity>
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(cohort)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}>
            <Icon name="trash" size={14} color="#B42318" />
          </TouchableOpacity>
        )}
        <View {...({ dataSet: { chevron: '1' } } as any)} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" size={15} color={C.textMute} /></View>
      </TouchableOpacity>
      {open && (
        <View {...({ dataSet: { anim: 'panel' } } as any)} style={{ marginTop: 14, gap: 10 }}>
          <Text style={em.section}>Weekly Syllabus</Text>
          {weeks.length === 0 ? <Text style={em.muted}>No weeks yet — add the first one below.</Text> : weeks.map((w, i) => (
            <View key={i} style={mst.weekRow}>
              <Text style={mst.weekNum}>W{w.weekNumber}</Text>
              <View style={{ flex: 1, gap: 8 }}>
                <TextInput style={em.input as any} value={w.title} onChangeText={(t: string) => setWeek(i, { title: t })} placeholder="Week title (e.g. Network Security)" placeholderTextColor="#C2C9D6" />
                <TextInput style={[em.input as any, { minHeight: 38 }]} value={w.topics} onChangeText={(t: string) => setWeek(i, { topics: t })} placeholder="Topics, comma separated" placeholderTextColor="#C2C9D6" multiline />
              </View>
              <TouchableOpacity onPress={() => removeWeek(i)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={14} color="#B42318" /></TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity onPress={addWeek} style={tbl.iconBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>Add week</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} style={mst.saveBtn} {...({ dataSet: { btn: '1' } } as any)}><Text style={mst.saveBtnText}>Save syllabus</Text></TouchableOpacity>
            {savedMsg && <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>Saved</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

function WebManage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'cohorts' | 'upskilling'>('cohorts');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { mgmt.getCohorts().then(setCohorts).catch(() => setCohorts([])); mgmt.getCourses().then(setCourses).catch(() => setCourses([])); }, [tick]);

  const [cAddOpen, setCAddOpen] = useState(false);
  const [cEditing, setCEditing] = useState<Cohort | null>(null);
  const [cName, setCName] = useState(''); const [cMoodle, setCMoodle] = useState(''); const [cTrack, setCTrack] = useState('Cybersecurity');
  const [cStart, setCStart] = useState(''); const [cEnd, setCEnd] = useState('');
  const [cActive, setCActive] = useState(true);
  function openAddCohort() {
    setCEditing(null); setCName(''); setCMoodle(''); setCTrack('Cybersecurity'); setCStart(''); setCEnd(''); setCActive(true);
    setCAddOpen(true);
  }
  function openEditCohort(c: Cohort) {
    setCEditing(c); setCName(c.name); setCMoodle(c.moodleName ?? ''); setCTrack(c.track || 'Cybersecurity');
    setCStart(c.startDate === 'TBD' ? '' : c.startDate); setCEnd(c.endDate === 'TBD' ? '' : c.endDate); setCActive(c.active);
    setCAddOpen(true);
  }
  function saveCohortForm() {
    if (!cName.trim()) return;
    const base = cEditing ?? { id: `c-${Date.now()}`, studentCount: 0, color: CHART_SERIES[cohorts.length % CHART_SERIES.length] } as Cohort;
    mgmt.saveCohort({ ...base, name: cName.trim(), moodleName: cMoodle.trim() || undefined, track: cTrack.trim() || 'Cybersecurity', startDate: cStart || 'TBD', endDate: cEnd || 'TBD', active: cActive })
      .then(() => { setTick((t) => t + 1); setCAddOpen(false); setCEditing(null); });
  }
  function deleteCohortConfirm(c: Cohort) {
    const ok = typeof window === 'undefined' ? true : window.confirm(`Delete ${c.name}? Its syllabus is removed too. Students stay but keep the cohort name as text.`);
    if (ok) mgmt.deleteCohort(c.id).then(() => setTick((t) => t + 1));
  }

  const [coTitle, setCoTitle] = useState(''); const [coProvider, setCoProvider] = useState('');
  const [coTrack, setCoTrack] = useState<CourseTrack>('cybersecurity');
  const [coStart, setCoStart] = useState(''); const [coEnd, setCoEnd] = useState(''); const [coSpots, setCoSpots] = useState('20');
  function addCourse() {
    if (!coTitle.trim()) return;
    const spots = Number(coSpots) || 0;
    mgmt.saveCourse({ id: `course-${Date.now()}`, title: coTitle.trim(), provider: coProvider.trim() || 'Red Alpha', track: coTrack, description: '', startDate: coStart || 'TBD', endDate: coEnd || 'TBD', spotsTotal: spots, spotsRemaining: spots, status: 'open', color: TRACK_COLOR[coTrack] })
      .then(() => { setCoTitle(''); setCoProvider(''); setCoStart(''); setCoEnd(''); setTick((t) => t + 1); });
  }
  function removeCourse(id: string) { mgmt.deleteCourse(id).then(() => setTick((t) => t + 1)); }

  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        {(['cohorts', 'upskilling'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[mst.tab, tab === t && mst.tabOn]} {...({ dataSet: { btn: '1' } } as any)}>
            <Text style={[mst.tabText, tab === t && mst.tabTextOn]}>{t === 'cohorts' ? 'Cohorts & Syllabus' : 'Upskilling'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'cohorts' ? (
        <View style={{ width: '100%' }}>
          <View style={news.bar2}>
            <Text style={u.cardTitle}>{cohorts.length} cohorts · tap one to edit its weekly syllabus</Text>
            <TouchableOpacity onPress={openAddCohort} style={news.newBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={14} color="#fff" /><Text style={news.newBtnText}>Add cohort</Text></TouchableOpacity>
          </View>
          <View style={{ gap: 10, width: '100%' }}>{cohorts.map((co) => <CohortCard key={co.id} cohort={co} onEdit={openEditCohort} onDelete={isAdmin ? deleteCohortConfirm : undefined} />)}</View>
        </View>
      ) : (
        <View style={u.colsWrap}>
          <Card style={{ flex: 2, minWidth: 360, padding: 0, overflow: 'hidden' }} anim>
            <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle right={<Text style={tbl.meta}>{courses.length} courses</Text>}>Upskilling Courses</CardTitle></View>
            <View style={tbl.thead}>
              <Text style={[tbl.th, { flex: 2 }]}>Course</Text>
              <Text style={tbl.th}>Track</Text>
              <Text style={tbl.th}>Starts</Text>
              <Text style={tbl.th}>Spots</Text>
              <Text style={[tbl.th, { flex: 0.6, textAlign: 'right' }]}> </Text>
            </View>
            {courses.map((co) => (
              <View key={co.id} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
                <View style={[tbl.cell, { flex: 2 }]}><Text style={tbl.name}>{co.title}</Text><Text style={tbl.meta}>{co.provider}</Text></View>
                <View style={tbl.cell}><View style={[mst.trackTag, { backgroundColor: (TRACK_COLOR[co.track] || C.slate) + '22' }]}><Text style={[mst.trackTagText, { color: TRACK_COLOR[co.track] || C.slate }]}>{co.track}</Text></View></View>
                <Text style={tbl.cell}>{co.startDate}</Text>
                <Text style={tbl.cell}>{co.spotsRemaining}/{co.spotsTotal}</Text>
                <View style={[tbl.cell, { flex: 0.6, alignItems: 'flex-end' }]}><TouchableOpacity onPress={() => removeCourse(co.id)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={14} color="#B42318" /></TouchableOpacity></View>
              </View>
            ))}
            {courses.length === 0 && <View style={{ padding: 30, alignItems: 'center' }}><Text style={tbl.meta}>No courses yet.</Text></View>}
          </Card>
          <Card style={{ flex: 1, minWidth: 280 }} anim>
            <CardTitle>Add Course</CardTitle>
            <Field label="Title" value={coTitle} onChange={setCoTitle} ph="e.g. Cloud Security Bootcamp" />
            <Field label="Provider" value={coProvider} onChange={setCoProvider} ph="e.g. AWS" />
            <Text style={em.fieldLabel}>Track</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {TRACKS.map((t) => (
                <TouchableOpacity key={t} onPress={() => setCoTrack(t)} style={[mst.trackPick, coTrack === t && { borderColor: TRACK_COLOR[t], backgroundColor: TRACK_COLOR[t] + '18' }]} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={[mst.trackPickText, coTrack === t && { color: TRACK_COLOR[t] }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Start date" value={coStart} onChange={setCoStart} ph="YYYY-MM-DD" />
            <Field label="End date" value={coEnd} onChange={setCoEnd} ph="YYYY-MM-DD" />
            <Field label="Total spots" value={coSpots} onChange={setCoSpots} ph="20" numeric />
            <TouchableOpacity onPress={addCourse} style={mst.primaryBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={14} color="#fff" /><Text style={mst.primaryBtnText}>Add course</Text></TouchableOpacity>
          </Card>
        </View>
      )}

      <Modal visible={cAddOpen} transparent animationType="fade" onRequestClose={() => setCAddOpen(false)}>
        <View style={em.backdrop}>
          <View style={[em.sheet, { width: 460 }]} {...({ dataSet: { card: '1' } } as any)}>
            <View style={em.head}>
              <Text style={em.title}>{cEditing ? `Edit ${cEditing.name}` : 'Add cohort'}</Text>
              <TouchableOpacity onPress={() => setCAddOpen(false)} style={em.close} {...({ dataSet: { btn: '1' } } as any)}><Icon name="close" size={15} color={C.textMid} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }}>
              <Field label="Name" value={cName} onChange={setCName} ph="e.g. Cohort 16" />
              <Field label="Name on Moodle" value={cMoodle} onChange={setCMoodle} ph="exact name as it appears in Moodle" />
              <Field label="Track" value={cTrack} onChange={setCTrack} ph="e.g. Cybersecurity" />
              <Field label="Start date" value={cStart} onChange={setCStart} ph="YYYY-MM-DD" />
              <Field label="End date" value={cEnd} onChange={setCEnd} ph="YYYY-MM-DD" />
              <TouchableOpacity onPress={() => setCActive((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }} {...({ dataSet: { btn: '1' } } as any)}>
                <View style={[em.checkbox, cActive && { backgroundColor: C.greenDot, borderColor: C.greenDot }]}>{cActive && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}</View>
                <Text style={{ fontSize: 13, color: C.textMid, fontWeight: '500' }}>Active cohort</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={em.foot}>
              <TouchableOpacity style={em.cancel} onPress={() => setCAddOpen(false)} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={em.save} onPress={saveCohortForm} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.saveText}>{cEditing ? 'Save changes' : 'Create cohort'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const mst = StyleSheet.create({
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabOn: { backgroundColor: C.text, borderColor: C.text },
  tabText: { fontSize: 13, fontWeight: '600', color: C.textMid },
  tabTextOn: { color: '#fff' },
  cohortCard: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, backgroundColor: C.card },
  cohortName: { fontSize: 14, fontWeight: '700', color: C.text },
  activeTag: { backgroundColor: C.greenSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  activeTagText: { fontSize: 10.5, fontWeight: '700', color: C.green },
  weekRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  weekNum: { fontSize: 12, fontWeight: '700', color: C.brand, width: 30, paddingTop: 10 },
  delBtn: { padding: 8, borderRadius: 7, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2' },
  saveBtn: { backgroundColor: C.text, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, justifyContent: 'center' },
  saveBtnText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.brand, paddingVertical: 11, borderRadius: 8, marginTop: 4 },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  trackTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: 'flex-start' },
  trackTagText: { fontSize: 10.5, fontWeight: '700', textTransform: 'capitalize' },
  trackPick: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  trackPickText: { fontSize: 11.5, fontWeight: '600', color: C.textMid, textTransform: 'capitalize' },
});

// ---------------------------------------------------------------------------
// Users — admin-only member management (invite, roles)
// ---------------------------------------------------------------------------

function WebUsers() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { mgmt.fetchMembers().then(setMembers).catch(() => setMembers([])); }, [tick]);
  const [iName, setIName] = useState(''); const [iEmail, setIEmail] = useState(''); const [iRole, setIRole] = useState<StaffRole>('staff');
  function invite() { if (!iEmail.trim()) return; mgmt.inviteMemberAsync(iEmail, iRole, iName).then(() => { setIName(''); setIEmail(''); setTick((t) => t + 1); }); }
  function changeRole(m: StaffMember, r: StaffRole) { mgmt.upsertMember({ ...m, role: r }).then(() => setTick((t) => t + 1)); }
  function demote(m: StaffMember) {
    const ok = typeof window === 'undefined' ? true : window.confirm(`Make ${m.name || m.email} a student? They'll lose staff access.`);
    if (ok) mgmt.removeMember(m.id).then(() => setTick((t) => t + 1));
  }
  function remove(id: string) { mgmt.removeMember(id).then(() => setTick((t) => t + 1)); }
  const adminsN = members.filter((m) => m.status === 'active' && m.role === 'admin').length;
  const staffN = members.filter((m) => m.status === 'active' && m.role === 'staff').length;
  const invitedN = members.filter((m) => m.status === 'invited').length;

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Admins" value={adminsN} icon="shield" tint={C.brand} soft={C.brandSoft} />
        <KpiCard label="Active staff" value={staffN} icon="users" tint={C.blue} soft={C.blueSoft} />
        <KpiCard label="Pending invites" value={invitedN} icon="mail" tint={C.amber} soft={C.amberSoft} />
      </View>
      <View style={u.colsWrap}>
        <Card style={{ flex: 2, minWidth: 380, padding: 0, overflow: 'hidden' }} anim>
          <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle right={<Text style={tbl.meta}>{members.length} people</Text>}>Members</CardTitle></View>
          <View style={tbl.thead}>
            <Text style={[tbl.th, { flex: 2 }]}>Member</Text>
            <Text style={[tbl.th, { flex: 1.4 }]}>Role</Text>
            <Text style={tbl.th}>Status</Text>
            <Text style={[tbl.th, { flex: 1.3, textAlign: 'right' }]}>Actions</Text>
          </View>
          {members.map((m) => (
            <View key={m.id} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <View style={[tbl.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <Avatar name={m.name} size={32} />
                <View><Text style={tbl.name}>{m.name}</Text><Text style={tbl.meta}>{m.email}</Text></View>
              </View>
              <View style={[tbl.cell, { flex: 1.4, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }]}>
                {(['admin', 'staff'] as StaffRole[]).map((r) => (
                  <TouchableOpacity key={r} onPress={() => changeRole(m, r)} style={[mst.trackPick, m.role === r && { borderColor: r === 'admin' ? C.brand : C.blue, backgroundColor: (r === 'admin' ? C.brand : C.blue) + '18' }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[mst.trackPickText, m.role === r && { color: r === 'admin' ? C.brand : C.blue }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => demote(m)} style={mst.trackPick} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={mst.trackPickText}>student</Text>
                </TouchableOpacity>
              </View>
              <View style={tbl.cell}>
                <View style={[tbl.pStatus, { backgroundColor: m.status === 'active' ? C.greenSoft : C.amberSoft, alignSelf: 'flex-start' }]}>
                  <Text style={[tbl.pStatusText, { color: m.status === 'active' ? C.green : C.amber }]}>{m.status === 'active' ? 'Active' : 'Invited'}</Text>
                </View>
              </View>
              <View style={[tbl.cell, { flex: 1.3, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }]}>
                {m.status === 'invited' && <Text style={tbl.meta}>auto-joins on first sign-in</Text>}
                <TouchableOpacity onPress={() => remove(m.id)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={14} color="#B42318" /></TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>
        <Card style={{ flex: 1, minWidth: 280 }} anim>
          <CardTitle>Invite Member</CardTitle>
          <Field label="Name (optional)" value={iName} onChange={setIName} ph="Full name" />
          <Field label="Email" value={iEmail} onChange={setIEmail} ph="person@company.com" />
          <Text style={em.fieldLabel}>Role</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['staff', 'admin'] as StaffRole[]).map((r) => (
              <TouchableOpacity key={r} onPress={() => setIRole(r)} style={[em.stage, iRole === r && { backgroundColor: C.slateSoft, borderColor: C.slate }]} {...({ dataSet: { btn: '1' } } as any)}>
                <Text style={[em.stageText, iRole === r && { color: C.text }, { textTransform: 'capitalize' }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={invite} style={mst.primaryBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="mail" size={14} color="#fff" /><Text style={mst.primaryBtnText}>Send invite</Text></TouchableOpacity>
          <Text style={[em.muted, { marginTop: 10 }]}>They join as {iRole} when they accept via Microsoft sign-in.</Text>
        </Card>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Intake — upcoming programmes / recruitment pipeline
// ---------------------------------------------------------------------------

const INTAKE_STATUS: Record<IntakeStatus, { label: string; fg: string; bg: string }> = {
  tbc: { label: 'TBC', fg: C.slate, bg: C.slateSoft },
  confirmed: { label: 'Confirmed', fg: C.blue, bg: C.blueSoft },
  started: { label: 'Started', fg: C.green, bg: C.greenSoft },
};
function WebIntake() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<IntakeProgramme[]>([]);
  const [target, setTarget] = useState(250);
  const [tick, setTick] = useState(0);
  useEffect(() => { mgmt.fetchIntake().then(setRows).catch(() => setRows([])); }, [tick]);
  useEffect(() => { mgmt.getIntakeTarget().then(setTarget).catch(() => {}); }, []);
  function editTarget() {
    if (typeof window === 'undefined') return;
    const v = window.prompt('Annual intake target (total people to plan):', String(target));
    if (v && !Number.isNaN(Number(v))) { const n = Number(v); mgmt.setIntakeTarget(n).then(() => setTarget(n)); }
  }

  const [q, setQ] = useState('Q1');
  const [prog, setProg] = useState('');
  const [domain, setDomain] = useState('CYBER');
  const [qty, setQty] = useState('10');
  const [st, setSt] = useState<IntakeStatus>('confirmed');
  const [start, setStart] = useState('');
  const [note, setNote] = useState('');

  function add() {
    if (!prog.trim()) return;
    mgmt.saveIntake({ id: mgmt.newId(), quarter: q, programNumber: prog.trim(), domain: domain.trim() || 'CYBER', quantity: Number(qty) || 0, status: st, startDate: start.trim() || undefined, note: note.trim() || undefined })
      .then(() => { setProg(''); setStart(''); setNote(''); setTick((t) => t + 1); });
  }
  function setStatus(r: IntakeProgramme, status: IntakeStatus) { mgmt.saveIntake({ ...r, status }).then(() => setTick((t) => t + 1)); }
  function remove(id: string) { mgmt.deleteIntake(id).then(() => setTick((t) => t + 1)); }
  const [sylBusy, setSylBusy] = useState<string | null>(null);
  async function attachSyllabus(r: IntakeProgramme) {
    const f = await pickFile(); if (!f) return;
    setSylBusy(r.id);
    try {
      const { url, filename } = await uploadFileToSharePoint({ kind: 'syllabus', ownerId: r.id, filename: f.name, uri: f.uri, mimeType: f.mimeType });
      await mgmt.saveIntake({ ...r, syllabusUrl: url, syllabusFilename: filename });
      setTick((t) => t + 1);
    } catch (e: any) { if (typeof window !== 'undefined') window.alert(e?.message ?? 'Upload failed'); }
    finally { setSylBusy(null); }
  }

  const started = rows.filter((r) => r.status === 'started').reduce((n, r) => n + r.quantity, 0);
  const confirmed = rows.filter((r) => r.status === 'confirmed').reduce((n, r) => n + r.quantity, 0);
  const totalPlanned = started + confirmed;
  const needToPlan = Math.max(0, target - totalPlanned);

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Started" value={started} icon="cap" tint={C.green} soft={C.greenSoft} />
        <KpiCard label="Confirmed" value={confirmed} icon="calendar" tint={C.blue} soft={C.blueSoft} />
        <KpiCard label="Total Planned" value={totalPlanned} icon="users" tint={C.slate} soft={C.slateSoft} />
        <KpiCard label={`Need to Plan (of ${target})`} value={needToPlan} icon="trending" tint={C.amber} soft={C.amberSoft} />
      </View>

      {isAdmin && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
          <TouchableOpacity onPress={editTarget} style={tbl.iconBtn} {...({ dataSet: { btn: '1' } } as any)}>
            <Icon name="edit" size={13} color={C.textMid} /><Text style={tbl.iconBtnText}>Edit target</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={u.colsWrap}>
        <Card style={{ flex: 2.4, minWidth: 420, padding: 0, overflow: 'hidden' }} anim>
          <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle right={<Text style={tbl.meta}>{rows.length} programmes</Text>}>Upcoming Programmes</CardTitle></View>
          <View style={tbl.thead}>
            <Text style={tbl.th}>Quarter</Text>
            <Text style={[tbl.th, { flex: 1.4 }]}>Program</Text>
            <Text style={tbl.th}>Domain</Text>
            <Text style={[tbl.th, { flex: 0.7 }]}>Qty</Text>
            <Text style={[tbl.th, { flex: 1.7 }]}>Status</Text>
            <Text style={[tbl.th, { flex: 1.1 }]}>Syllabus</Text>
            <Text style={[tbl.th, { flex: 0.6, textAlign: 'right' }]}> </Text>
          </View>
          {rows.length === 0 ? (
            <View style={{ padding: 28, alignItems: 'center' }}><Text style={tbl.meta}>No programmes planned yet — add one on the right.</Text></View>
          ) : rows.map((r) => (
            <View key={r.id} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <Text style={tbl.cell}>{r.quarter}</Text>
              <View style={[tbl.cell, { flex: 1.4 }]}>
                <Text style={tbl.name}>{r.programNumber}</Text>
                {(r.startDate || r.note) ? <Text style={tbl.meta}>{[r.startDate, r.note].filter(Boolean).join(' · ')}</Text> : null}
              </View>
              <Text style={tbl.cell}>{r.domain}</Text>
              <Text style={[tbl.cell, { flex: 0.7, fontWeight: '700', color: C.text }]}>{r.quantity}</Text>
              <View style={[tbl.cell, { flex: 1.7, flexDirection: 'row', gap: 5, flexWrap: 'wrap' }]}>
                {(['tbc', 'confirmed', 'started'] as IntakeStatus[]).map((s2) => (
                  <TouchableOpacity key={s2} onPress={() => setStatus(r, s2)} style={[tbl.ivPill, r.status === s2 && { backgroundColor: INTAKE_STATUS[s2].bg, borderColor: INTAKE_STATUS[s2].fg }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[tbl.ivPillText, r.status === s2 && { color: INTAKE_STATUS[s2].fg }]}>{INTAKE_STATUS[s2].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[tbl.cell, { flex: 1.1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }]}>
                {r.syllabusUrl ? (
                  <TouchableOpacity style={tbl.iconBtn} onPress={() => openUrl(r.syllabusUrl)} {...({ dataSet: { btn: '1' } } as any)}>
                    <Icon name="download" size={12} color={C.textMid} /><Text style={tbl.iconBtnText}>Download</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={tbl.iconBtn} onPress={() => attachSyllabus(r)} disabled={sylBusy === r.id} {...({ dataSet: { btn: '1' } } as any)}>
                  <Icon name="file" size={12} color={C.textMid} />
                  <Text style={tbl.iconBtnText}>{sylBusy === r.id ? 'Uploading…' : r.syllabusUrl ? 'Replace' : 'Attach'}</Text>
                </TouchableOpacity>
              </View>
              <View style={[tbl.cell, { flex: 0.6, alignItems: 'flex-end' }]}><TouchableOpacity onPress={() => remove(r.id)} style={mst.delBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="trash" size={14} color="#B42318" /></TouchableOpacity></View>
            </View>
          ))}
        </Card>

        <Card style={{ flex: 1, minWidth: 280 }} anim>
          <CardTitle>Add Programme</CardTitle>
          <Text style={em.fieldLabel}>Quarter</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['Q1', 'Q2', 'Q3', 'Q4'].map((qq) => (
              <TouchableOpacity key={qq} onPress={() => setQ(qq)} style={[mst.trackPick, q === qq && { borderColor: C.brand, backgroundColor: C.brand + '18' }]} {...({ dataSet: { btn: '1' } } as any)}>
                <Text style={[mst.trackPickText, q === qq && { color: C.brand }]}>{qq}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Program number" value={prog} onChange={setProg} ph="e.g. ASTP18" />
          <Field label="Domain" value={domain} onChange={setDomain} ph="e.g. CYBER" />
          <Field label="Quantity" value={qty} onChange={setQty} ph="10" numeric />
          <Text style={em.fieldLabel}>Status</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {(['tbc', 'confirmed', 'started'] as IntakeStatus[]).map((s2) => (
              <TouchableOpacity key={s2} onPress={() => setSt(s2)} style={[mst.trackPick, st === s2 && { borderColor: INTAKE_STATUS[s2].fg, backgroundColor: INTAKE_STATUS[s2].bg }]} {...({ dataSet: { btn: '1' } } as any)}>
                <Text style={[mst.trackPickText, st === s2 && { color: INTAKE_STATUS[s2].fg }]}>{INTAKE_STATUS[s2].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Start (optional)" value={start} onChange={setStart} ph="e.g. July or 2026-07-01" />
          <Field label="Note (optional)" value={note} onChange={setNote} ph="e.g. Recruiting" />
          <TouchableOpacity onPress={add} style={mst.primaryBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={14} color="#fff" /><Text style={mst.primaryBtnText}>Add programme</Text></TouchableOpacity>
        </Card>
      </View>
    </Page>
  );
}

const PAGES: Record<string, { title: string; subtitle: string; component: React.ComponentType }> = {
  students:  { title: 'Students',  subtitle: 'Manage student records, certifications and placement info', component: WebStudents },
  dashboard: { title: 'Dashboard', subtitle: 'Overview of cohort health and outcomes',                    component: WebDashboard },
  growth:    { title: 'Growth',    subtitle: 'Enrollment and placement trends over time',                 component: WebGrowth },
  news:      { title: 'News',      subtitle: 'Announcements posted to the community',                      component: WebNews },
  intake:    { title: 'Intake',    subtitle: 'Upcoming programmes and recruitment pipeline',               component: WebIntake },
  manage:    { title: 'Manage',    subtitle: 'Cohorts, weekly syllabus and upskilling courses',           component: WebManage },
  users:     { title: 'Users',     subtitle: 'Invite teammates and manage admin / staff access',           component: WebUsers },
};

export function StaffWebPortal() {
  const { user, signOut } = useAuth();
  const [activeId, setActiveId] = useState('students');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>(null);
  const navigate = (page: string, filter: StudentFilter = null) => { setStudentFilter(filter); setActiveId(page); };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
    meta.content = 'width=device-width, initial-scale=1';

    if (!document.getElementById('ra-inter-font')) {
      const p1 = document.createElement('link'); p1.rel = 'preconnect'; p1.href = 'https://fonts.googleapis.com'; document.head.appendChild(p1);
      const p2 = document.createElement('link'); p2.rel = 'preconnect'; p2.href = 'https://fonts.gstatic.com'; p2.crossOrigin = 'anonymous'; document.head.appendChild(p2);
      const fl = document.createElement('link'); fl.id = 'ra-inter-font'; fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(fl);
    }

    if (!document.getElementById('ra-portal-styles')) {
      const style = document.createElement('style');
      style.id = 'ra-portal-styles';
      style.textContent = `
        html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; background: ${C.appBg}; }
        body, body *, input, textarea, button {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
        }
        @keyframes raIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes raFade { from { opacity: 0; } to { opacity: 1; } }
        [data-anim="in"] { animation: raIn .4s cubic-bezier(.21,.6,.35,1) both; }
        [data-anim="panel"] { animation: raFade .25s ease both; }
        [data-card="1"] { box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05); }
        [data-bar="1"] { transition: width .7s cubic-bezier(.2,.7,.3,1), height .7s cubic-bezier(.2,.7,.3,1); }
        [data-chevron="1"] { transition: transform .22s ease; }
        [data-row="1"] { transition: background 120ms ease; }
        [data-row="1"]:hover { background: #FAFBFC; }
        [data-nav="1"] { transition: background 120ms ease; }
        [data-nav="1"]:hover { background: rgba(255,255,255,0.06); }
        [data-btn="1"] { transition: filter 120ms ease, transform 120ms ease; }
        [data-btn="1"]:hover { filter: brightness(0.97); }
        [data-btn="1"]:active { transform: scale(0.97); }
        input:focus, textarea:focus { outline: none !important; border-color: ${C.brand} !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.12) !important; }
        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-thumb { background: #D0D5DD; border-radius: 8px; border: 2px solid ${C.appBg}; }
        ::-webkit-scrollbar-thumb:hover { background: #98A2B3; }
        ::-webkit-scrollbar-track { background: transparent; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  function handleSignOut() {
    // RN's Alert.alert buttons don't fire on web, so use a native confirm there.
    const ok = typeof window === 'undefined' ? true : window.confirm('Sign out of the portal?');
    if (ok) signOut();
  }

  const isAdmin = user?.role === 'admin';
  const visibleNav = NAV.filter((n) => n.id !== 'users' || isAdmin);
  const safeId = activeId === 'users' && !isAdmin ? 'students' : activeId;
  const page = PAGES[safeId] ?? PAGES['students'];
  const PageComponent = page.component;
  const userName = user?.displayName ?? 'Staff';

  return (
    <NavCtx.Provider value={{ navigate, studentFilter }}>
      <View style={portal.root}>
        <Sidebar active={safeId} onSelect={(id) => navigate(id)} onSignOut={handleSignOut} userName={userName} items={visibleNav} />
        <View style={portal.main}>
          <TopBar title={page.title} subtitle={page.subtitle} userName={userName} userEmail={user?.email} userRole={user?.role} onSignOut={handleSignOut} />
          <PageComponent key={safeId} />
        </View>
      </View>
    </NavCtx.Provider>
  );
}

const portal = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.appBg },
  main: { flex: 1, flexDirection: 'column', overflow: 'hidden' as any },
});
