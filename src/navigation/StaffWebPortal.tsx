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
import { updatePlacementInfo } from '@/data/profileApi';
import * as mgmt from '@/data/managementApi';
import {
  Announcement,
  AnnouncementType,
  Cohort,
  CohortGrowthPoint,
  Course,
  CourseTrack,
  PlacementRecord,
  StaffMember,
  StaffRole,
  StaffStudentRecord,
  StudentLifecycleStage,
  SyllabusWeek,
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
  withdrawn:        { label: 'Withdrawn',    fg: '#475467', bg: '#F2F4F7', dot: '#98A2B3' },
};

const NEWS_CFG: Record<AnnouncementType, { label: string; icon: string; fg: string; bg: string; bar: string }> = {
  achievement: { label: 'Achievement', icon: 'trophy',   fg: C.amber,  bg: C.amberSoft,  bar: C.amberDot },
  event:       { label: 'Event',       icon: 'calendar', fg: C.blue,   bg: C.blueSoft,   bar: C.blueDot },
  update:      { label: 'Update',      icon: 'info',     fg: C.violet, bg: C.violetSoft, bar: C.violetDot },
};

// Cross-tab navigation (click a stat -> jump to a filtered tab)
type StudentFilter = { stage?: StudentLifecycleStage; cohort?: string } | null;
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

function TopBar({ title, subtitle, userName }: { title: string; subtitle?: string; userName: string }) {
  return (
    <View style={tb.root}>
      <View>
        <Text style={tb.title}>{title}</Text>
        {subtitle ? <Text style={tb.sub}>{subtitle}</Text> : null}
      </View>
      <View style={tb.userChip}>
        <View style={tb.uAvatar}><Text style={tb.uAvatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
        <Text style={tb.uName} numberOfLines={1}>{userName}</Text>
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

function WebDashboard() {
  const { accessToken } = useAuth();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  useEffect(() => {
    fetchStaffStudentRoster(accessToken).then((roster) => {
      const ov = mgmt.getPlacementOverrides();
      setStudents(roster.map((s) => (ov[s.studentId] ? { ...s, ...ov[s.studentId] } : s)));
    });
  }, []);
  const nav = useNav();
  const grown = useGrow();

  const list = students ?? [];
  const total = list.length;
  const placed = list.filter((s) => s.stage === 'on-placement' || s.stage === 'bond-completed').length;
  const hunting = list.filter((s) => s.stage === 'job-hunting').length;
  const totalCerts = list.reduce((n, s) => n + s.certifications.length, 0);
  const rate = total ? Math.round((placed / total) * 100) : 0;
  const rateAnim = useCountUp(rate);

  if (!students) return <Loader />;

  const cohortMap: Record<string, number> = {};
  students.forEach((s) => { cohortMap[s.cohortName] = (cohortMap[s.cohortName] ?? 0) + 1; });
  const cohorts = Object.entries(cohortMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxC = Math.max(...cohorts.map(([, n]) => n), 1);
  const BAR = CHART_SERIES;

  // Needs attention: job hunting + bonds ending within 180 days
  const now = Date.now();
  const attention = students
    .map((s) => {
      if (s.stage === 'job-hunting') return { s, reason: 'On bench', tone: C.amber, bg: C.amberSoft };
      if (s.bondEndDate && s.stage === 'on-placement') {
        const days = Math.round((new Date(s.bondEndDate).getTime() - now) / 86400000);
        if (days >= 0 && days <= 180) return { s, reason: `Bond ends in ${days}d`, tone: C.blue, bg: C.blueSoft };
      }
      return null;
    })
    .filter(Boolean) as { s: StaffStudentRecord; reason: string; tone: string; bg: string }[];

  const companyCounts: Record<string, number> = {};
  students.forEach((s) => { if (s.placementCompany && (s.stage === 'on-placement' || s.stage === 'bond-completed')) companyCounts[s.placementCompany] = (companyCounts[s.placementCompany] ?? 0) + 1; });
  const companies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCompany = Math.max(...companies.map(([, n]) => n), 1);

  const recentCerts = students
    .flatMap((s) => s.certifications.map((c) => ({ s, c })))
    .sort((a, b) => new Date(b.c.earnedAt).getTime() - new Date(a.c.earnedAt).getTime())
    .slice(0, 5);

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Total Students" value={total} icon="users" tint={C.slate} soft={C.slateSoft} onPress={() => nav.navigate('students')} />
        <KpiCard label="Placement Rate" value={rate} suffix="%" icon="trending" tint={C.green} soft={C.greenSoft} onPress={() => nav.navigate('growth')} />
        <KpiCard label="On Bench" value={hunting} icon="search" tint={C.amber} soft={C.amberSoft} onPress={() => nav.navigate('students', { stage: 'job-hunting' })} />
        <KpiCard label="Certifications" value={totalCerts} icon="award" tint={C.violet} soft={C.violetSoft} onPress={() => nav.navigate('students')} />
      </View>

      <View style={u.colsWrap}>
        <Card style={{ flex: 1, minWidth: 240 }} anim>
          <CardTitle>Placement Rate</CardTitle>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Donut pct={rateAnim} />
            <Text style={{ fontSize: 12.5, color: C.textMute, marginTop: 14 }}>{placed} of {total} students placed</Text>
          </View>
        </Card>

        <Card style={{ flex: 1.5, minWidth: 300 }} anim>
          <CardTitle>Students by Cohort</CardTitle>
          {cohorts.map(([name, n], i) => {
            const col = BAR[i % BAR.length];
            return (
              <TouchableOpacity key={name} activeOpacity={0.7} onPress={() => nav.navigate('students', { cohort: name })} {...({ dataSet: { btn: '1' } } as any)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: C.textMid }}>{name}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{n}</Text>
                </View>
                <View style={u.track}>
                  <View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${(n / maxC) * 100}%` as any : '0%', height: '100%', backgroundColor: col, borderRadius: 4 }} />
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        <Card style={{ flex: 1.5, minWidth: 300 }} anim>
          <CardTitle right={<View style={u.countTag}><Text style={u.countTagText}>{attention.length}</Text></View>}>Needs Attention</CardTitle>
          {attention.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Icon name="trophy" size={26} color={C.greenDot} />
              <Text style={{ fontSize: 13, color: C.textMute, marginTop: 10 }}>Everyone's on track.</Text>
            </View>
          ) : attention.map(({ s, reason, tone, bg }, i) => (
            <TouchableOpacity key={s.studentId} activeOpacity={0.7} onPress={() => nav.navigate('students', { stage: s.stage })} {...({ dataSet: { btn: '1' } } as any)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }, i < attention.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <Avatar name={s.name} stage={s.stage} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{s.name}</Text>
                <Text style={{ fontSize: 11.5, color: C.textMute }}>{s.cohortName}</Text>
              </View>
              <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: tone }}>{reason}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      </View>

      <View style={[u.colsWrap, { marginTop: 16 }]}>
        <Card style={{ flex: 1, minWidth: 280 }} anim>
          <CardTitle right={<Icon name="briefcase" size={15} color={C.textMute} />}>Placements by Company</CardTitle>
          {companies.length === 0 ? <Text style={{ fontSize: 13, color: C.textMute }}>No placements yet.</Text> :
            companies.map(([name, n]) => (
              <TouchableOpacity key={name} activeOpacity={0.7} onPress={() => nav.navigate('students', { stage: 'on-placement' })} {...({ dataSet: { btn: '1' } } as any)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '500', color: C.textMid }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.green }}>{n}</Text>
                </View>
                <View style={u.track}><View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${(n / maxCompany) * 100}%` as any : '0%', height: '100%', backgroundColor: CHART.emerald, borderRadius: 4 }} /></View>
              </TouchableOpacity>
            ))}
        </Card>

        <Card style={{ flex: 1, minWidth: 280 }} anim>
          <CardTitle>Recent Certifications</CardTitle>
          {recentCerts.length === 0 ? <Text style={{ fontSize: 13, color: C.textMute }}>No certifications yet.</Text> :
            recentCerts.map(({ s, c }, i) => (
              <View key={s.studentId + c.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 }, i < recentCerts.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
                <View style={tbl.certIcon}><Icon name="award" size={14} color={C.violet} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.text }} numberOfLines={1}>{c.name}</Text>
                  <Text style={{ fontSize: 11.5, color: C.textMute }}>{s.name} · {c.earnedAt}</Text>
                </View>
              </View>
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

function StudentRow({ s, onEdit }: { s: StaffStudentRecord; onEdit: (s: StaffStudentRecord) => void }) {
  const [open, setOpen] = useState(false);
  const grown = useGrow();
  const hasCV = Boolean(s.cvFilename || s.cvUrl);
  const placements = s.placements ?? [];
  const active = mgmt.activePlacement(placements);
  const currentCompany = active?.company ?? s.placementCompany ?? null;
  const currentRole = active?.role ?? s.placementRole ?? null;
  const served = mgmt.bondServedMonths(placements);
  const bondPct = s.bondMonths ? Math.min(100, Math.round((served / s.bondMonths) * 100)) : null;
  let bondLeftLabel: string | null = null;
  let bondLeftColor: string = C.textMid;
  if (s.bondMonths && placements.length) {
    if (s.stage === 'bond-completed' || served >= s.bondMonths) { bondLeftLabel = 'Done'; bondLeftColor = C.green; }
    else if (!active) { bondLeftLabel = 'Paused'; bondLeftColor = C.amber; }
    else { const days = Math.max(0, Math.round((s.bondMonths - served) * 30.44)); bondLeftLabel = `${days}d`; bondLeftColor = days < 90 ? C.amber : C.textMid; }
  }
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.borderSoft }}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen((o) => !o)} {...({ dataSet: { row: '1' } } as any)} style={tbl.row}>
        <View style={{ width: 22, alignItems: 'center' }}>
          <View {...({ dataSet: { chevron: '1' } } as any)} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
            <Icon name="chevron" size={15} color={C.textMute} />
          </View>
        </View>
        <View style={[tbl.cell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Avatar name={s.name} stage={s.stage} size={34} />
          <View><Text style={tbl.name}>{s.name}</Text><Text style={tbl.meta}>{s.email}</Text></View>
        </View>
        <Text style={tbl.cell}>{s.cohortName}</Text>
        <View style={tbl.cell}><StagePill stage={s.stage} /></View>
        <View style={[tbl.cell, { flex: 1.6 }]}>
          {currentCompany ? (
            <View><Text style={tbl.name}>{currentRole ?? '—'}</Text><Text style={tbl.meta}>{currentCompany}</Text></View>
          ) : <Text style={tbl.meta}>—</Text>}
        </View>
        <View style={[tbl.cell, { flex: 0.7, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          {s.certifications.length > 0 ? (
            <View style={tbl.certCount}><Icon name="award" size={12} color={C.violet} /><Text style={tbl.certCountText}>{s.certifications.length}</Text></View>
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
              const st = PSTATUS[p.status];
              return (
                <View key={p.id} style={tbl.histRow}>
                  <View style={tbl.histTop}>
                    <Text style={tbl.histCompany}>{p.company}</Text>
                    <View style={[tbl.pStatus, { backgroundColor: st.bg }]}><Text style={[tbl.pStatusText, { color: st.fg }]}>{st.label}</Text></View>
                  </View>
                  <Text style={tbl.meta}>{p.role}</Text>
                  <Text style={tbl.histDates}>{p.startDate} → {p.endDate ?? 'Present'}{p.note ? `  ·  ${p.note}` : ''}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ flex: 1, minWidth: 220 } as any}>
            <Text style={tbl.panelLabel}>Bond</Text>
            {s.bondMonths && placements.length > 0 ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{served.toFixed(1)} / {s.bondMonths} mo</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: (bondPct ?? 0) >= 100 ? C.green : C.textMid }}>{bondPct}%</Text>
                </View>
                <View style={tbl.bondBar}><View {...({ dataSet: { bar: '1' } } as any)} style={{ width: grown ? `${bondPct}%` as any : '0%', height: '100%', backgroundColor: (bondPct ?? 0) >= 100 ? CHART.emerald : CHART.indigo, borderRadius: 5 }} /></View>
                <Text style={[tbl.histDates, { marginTop: 8 }]}>{s.stage === 'bond-completed' ? 'Bond completed.' : active ? 'Accruing — on placement.' : 'Paused — on bench, clock stopped.'}</Text>
              </View>
            ) : s.bondEndDate ? (
              <Detail label="Bond end" value={s.bondEndDate} />
            ) : <Text style={tbl.meta}>No bond on record.</Text>}
          </View>

          <View style={{ flex: 1, minWidth: 220 } as any}>
            <Text style={tbl.panelLabel}>Profile</Text>
            <Detail label="Date of birth" value={s.dateOfBirth ?? '—'} />
            <Detail label="Reporting officer" value={active?.reportingOfficer ?? s.reportingOfficer ?? '—'} />
            <Detail label="RO email" value={active?.roEmail ?? s.roEmail ?? '—'} />
            <Text style={tbl.panelLabel2}>Certifications</Text>
            {s.certifications.length === 0 ? <Text style={tbl.meta}>None yet.</Text> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {s.certifications.map((c) => (
                  <View key={c.id} style={{ backgroundColor: C.violetSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, color: C.violet, fontWeight: '600' }}>{c.name}</Text>
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

function WebStudents() {
  const { accessToken } = useAuth();
  const nav = useNav();
  const [students, setStudents] = useState<StaffStudentRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<StudentLifecycleStage | 'all'>(nav.studentFilter?.stage ?? 'all');
  const [cohortFilters, setCohortFilters] = useState<Set<string>>(new Set(nav.studentFilter?.cohort ? [nav.studentFilter.cohort] : []));
  const [editTarget, setEditTarget] = useState<StaffStudentRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [editStage, setEditStage] = useState<StudentLifecycleStage>('on-course');
  const [editCohort, setEditCohort] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editBondMonths, setEditBondMonths] = useState('24');
  const [editPlacements, setEditPlacements] = useState<PlacementRecord[]>([]);
  const [npCompany, setNpCompany] = useState('');
  const [npRole, setNpRole] = useState('');
  const [npRO, setNpRO] = useState('');
  const [npROEmail, setNpROEmail] = useState('');

  useEffect(() => { fetchStaffStudentRoster(accessToken).then(setStudents); }, []);

  const cohortOptions = useMemo(() => (students ? Array.from(new Set(students.map((s) => s.cohortName))).sort() : []), [students]);
  const cohortNames = useMemo(() => Array.from(new Set([...(students?.map((s) => s.cohortName) ?? []), ...mgmt.getCohorts().map((cc) => cc.name)])).sort(), [students]);
  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.toLowerCase();
    return students.filter((s) => {
      const ms = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const mst = stageFilter === 'all' || s.stage === stageFilter;
      const mc = cohortFilters.size === 0 || cohortFilters.has(s.cohortName);
      return ms && mst && mc;
    });
  }, [students, search, stageFilter, cohortFilters]);

  const today = () => new Date().toISOString().slice(0, 10);
  function openEdit(s: StaffStudentRecord) {
    setEditTarget(s); setEditStage(s.stage);
    setEditCohort(s.cohortName); setEditDob(s.dateOfBirth ?? '');
    setEditBondMonths(String(s.bondMonths ?? 24));
    const existing: PlacementRecord[] = s.placements ? [...s.placements]
      : (s.placementCompany ? [{ id: 'p-legacy', company: s.placementCompany, role: s.placementRole ?? '', reportingOfficer: s.reportingOfficer, roEmail: s.roEmail, startDate: s.placementStartDate ?? today(), status: (s.stage === 'on-placement' ? 'active' : s.stage === 'bond-completed' ? 'completed' : 'terminated') }] : []);
    setEditPlacements(existing);
    setNpCompany(''); setNpRole(''); setNpRO(''); setNpROEmail('');
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
      stage: editStage, cohortName: editCohort, dateOfBirth: editDob || undefined, bondMonths: Number(editBondMonths) || undefined, placements: editPlacements,
      placementCompany: act?.company, placementRole: act?.role,
      reportingOfficer: act?.reportingOfficer, roEmail: act?.roEmail, bondEndDate: editTarget.bondEndDate,
    };
    try {
      mgmt.savePlacement(editTarget.studentId, override);
      await updatePlacementInfo(editTarget.studentId, { stage: editStage, placementCompany: act?.company, placementRole: act?.role, reportingOfficer: act?.reportingOfficer, roEmail: act?.roEmail, bondEndDate: editTarget.bondEndDate });
      setStudents((prev) => prev?.map((s) => (s.studentId === editTarget.studentId ? { ...s, ...override } : s)) ?? null);
      setEditTarget(null);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not save.'); }
    finally { setSaving(false); }
  }

  const STAGES: Array<StudentLifecycleStage | 'all'> = ['all', 'on-course', 'job-hunting', 'on-placement', 'bond-completed', 'withdrawn'];
  if (!students) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      <View style={tbl.filterBar}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or email…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STAGES.map((s) => {
              const on = stageFilter === s;
              return (
                <TouchableOpacity key={s} onPress={() => setStageFilter(s)} style={[tbl.chip, on && tbl.chipOn]} {...({ dataSet: { btn: '1' } } as any)}>
                  <Text style={[tbl.chipText, on && tbl.chipTextOn]}>{s === 'all' ? 'All stages' : STAGE[s as StudentLifecycleStage]?.label ?? s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 0 }}>
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
        <Text style={tbl.count}>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: LAYOUT.pad }} showsVerticalScrollIndicator={false}>
        <View style={u.pageFull}>
          <Card style={{ padding: 0, overflow: 'hidden' }} anim>
            <View style={tbl.thead}>
              <View style={{ width: 22 }} />
              <Text style={[tbl.th, { flex: 2 }]}>Student</Text>
              <Text style={tbl.th}>Cohort</Text>
              <Text style={tbl.th}>Stage</Text>
              <Text style={[tbl.th, { flex: 1.6 }]}>Placement</Text>
              <Text style={[tbl.th, { flex: 0.7 }]}>Certs</Text>
              <Text style={[tbl.th, { flex: 1 }]}>Bond Left</Text>
              <Text style={[tbl.th, { flex: 1.4, textAlign: 'right' }]}>Actions</Text>
            </View>
            {filtered.map((s) => <StudentRow key={s.studentId} s={s} onEdit={openEdit} />)}
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
              <TextInput style={[em.input as any, { marginBottom: 22, maxWidth: 180 }]} value={editDob} onChangeText={setEditDob} placeholder="YYYY-MM-DD" placeholderTextColor="#C2C9D6" />

              <Text style={em.section}>Bond length (months)</Text>
              <TextInput style={[em.input as any, { marginBottom: 22, maxWidth: 140 }]} value={editBondMonths} onChangeText={setEditBondMonths} keyboardType="numeric" placeholder="24" placeholderTextColor="#C2C9D6" />

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
  panelLabel: { fontSize: 11, fontWeight: '700', color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.violetSoft, alignItems: 'center', justifyContent: 'center' },
  certName: { fontSize: 13, fontWeight: '600', color: C.text },
  cvBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, marginTop: 14 },
  cvBtnText: { fontSize: 12, fontWeight: '600', color: C.textMid },
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
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: C.text, backgroundColor: '#FCFCFD', outlineStyle: 'none' },
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
  { key: 'graduated' as const, label: 'Graduated', color: CHART.violet },
  { key: 'placed' as const, label: 'Placed', color: CHART.emerald },
];

function Funnel({ enrolled, graduated, placed }: { enrolled: number; graduated: number; placed: number }) {
  const grown = useGrow();
  const steps = [
    { label: 'Enrolled', n: enrolled, color: CHART.indigo, pct: 100 },
    { label: 'Graduated', n: graduated, color: CHART.violet, pct: enrolled ? Math.round((graduated / enrolled) * 100) : 0 },
    { label: 'Placed', n: placed, color: CHART.emerald, pct: enrolled ? Math.round((placed / enrolled) * 100) : 0 },
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
  const [growth, setGrowth] = useState<CohortGrowthPoint[]>([]);
  useEffect(() => { fetchCohortGrowth(accessToken).then(setGrowth); }, []);
  const grown = useGrow();
  if (!growth.length) return <Loader />;

  const maxVal = Math.max(...growth.flatMap((g) => [g.enrolled, g.graduated, g.placed]), 1);
  const overall = {
    enrolled: growth.reduce((s, g) => s + g.enrolled, 0),
    graduated: growth.reduce((s, g) => s + g.graduated, 0),
    placed: growth.reduce((s, g) => s + g.placed, 0),
  };
  const trend = growth.filter((g) => g.graduated > 0).map((g) => ({ label: g.cohortName.replace('Cohort ', 'C'), value: Math.round((g.placed / g.graduated) * 100) }));
  const byYear: Record<number, number> = {};
  growth.forEach((g) => { byYear[g.year] = (byYear[g.year] ?? 0) + g.enrolled; });
  const years = Object.entries(byYear).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxYear = Math.max(...years.map(([, n]) => n), 1);
  const YEAR_COL = CHART_SERIES;

  return (
    <Page>
      <View style={u.kpiRow}>
        <KpiCard label="Total Enrolled" value={overall.enrolled} icon="users" tint={C.blue} soft={C.blueSoft} onPress={() => nav.navigate('students')} />
        <KpiCard label="Graduated" value={overall.graduated} icon="cap" tint={C.violet} soft={C.violetSoft} onPress={() => nav.navigate('students')} />
        <KpiCard label="Placed" value={overall.placed} icon="briefcase" tint={C.green} soft={C.greenSoft} onPress={() => nav.navigate('students', { stage: 'on-placement' })} />
        <KpiCard label="Placement Rate" value={overall.graduated ? Math.round(overall.placed / overall.graduated * 100) : 0} suffix="%" icon="trending" tint={C.brand} soft={C.brandSoft} onPress={() => nav.navigate('dashboard')} />
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, height: 210, paddingTop: 16 }}>
            {growth.map((row) => (
              <TouchableOpacity key={row.cohortName} activeOpacity={0.7} onPress={() => nav.navigate('students', { cohort: row.cohortName })} {...({ dataSet: { btn: '1' } } as any)} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, width: '100%' }}>
                  {SERIES.map((se) => (
                    <View key={se.key} {...({ dataSet: { bar: '1' } } as any)} style={{ flex: 1, maxWidth: 16, backgroundColor: se.color, borderTopLeftRadius: 4, borderTopRightRadius: 4, height: grown ? `${(row[se.key] / maxVal) * 100}%` as any : '0%' }} />
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: C.textMute, marginTop: 8, fontWeight: '600' }}>{row.cohortName.replace('Cohort ', 'C')}</Text>
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
          <Funnel enrolled={overall.enrolled} graduated={overall.graduated} placed={overall.placed} />
        </Card>
        <Card style={{ flex: 1, minWidth: 300 }} anim>
          <CardTitle>Enrolled by Year</CardTitle>
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
        </Card>
      </View>

      <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }} anim>
        <View style={{ padding: 20, paddingBottom: 0 }}><CardTitle>Cohort Breakdown</CardTitle></View>
        <View style={tbl.thead}>
          {['Cohort', 'Year', 'Enrolled', 'Graduated', 'Placed', 'Rate'].map((col) => <Text key={col} style={tbl.th}>{col}</Text>)}
        </View>
        {growth.map((row) => {
          const rate = row.graduated > 0 ? Math.round(row.placed / row.graduated * 100) : null;
          return (
            <TouchableOpacity key={row.cohortName} activeOpacity={0.7} onPress={() => nav.navigate('students', { cohort: row.cohortName })} {...({ dataSet: { row: '1' } } as any)} style={[tbl.row, { borderBottomWidth: 1, borderBottomColor: C.borderSoft }]}>
              <Text style={[tbl.cell, { fontWeight: '600', color: C.text }]}>{row.cohortName}</Text>
              <Text style={tbl.cell}>{row.year}</Text>
              <Text style={tbl.cell}>{row.enrolled}</Text>
              <Text style={tbl.cell}>{row.graduated}</Text>
              <Text style={tbl.cell}>{row.placed}</Text>
              <View style={tbl.cell}>
                {rate !== null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, maxWidth: 70, height: 6, backgroundColor: C.borderSoft, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${rate}%` as any, height: '100%', backgroundColor: rate >= 70 ? C.greenDot : C.amberDot, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: rate >= 70 ? C.green : C.amber }}>{rate}%</Text>
                  </View>
                ) : <Text style={tbl.cell}>—</Text>}
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

  useEffect(() => { fetchAnnouncements(accessToken).then((a) => { setItems(a); setLoading(false); }); }, []);

  function openAdd() {
    setFType(tab === 'community' ? 'achievement' : 'update');
    setFTitle(''); setFBody(''); setFAudience('all'); setFPinned(false);
    setFAchiever(''); setFCohort(''); setFCert('');
    setAdding(true);
  }
  function savePost() {
    if (!fTitle.trim()) return;
    setSaving(true);
    const post: Announcement = {
      id: `a-${Date.now()}`, type: fType, title: fTitle.trim(), body: fBody.trim(),
      postedAt: new Date().toISOString(), audience: fAudience, pinned: fPinned || undefined,
      author: user?.displayName ?? 'Staff',
      ...(fType === 'achievement' ? { achieverName: fAchiever.trim() || undefined, achieverCohort: fCohort.trim() || undefined, certificationName: fCert.trim() || undefined } : {}),
    };
    mgmt.saveAnnouncement(post);
    fetchAnnouncements(accessToken).then((a) => { setItems(a); setSaving(false); setAdding(false); setTab(fType === 'achievement' ? 'community' : 'announcements'); });
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
                  <Text style={news.date}>{new Date(item.postedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
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
              <Text style={em.title}>New {fType === 'achievement' ? 'community' : 'announcement'} post</Text>
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
              <TouchableOpacity style={em.save} onPress={savePost} disabled={saving} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.saveText}>{saving ? 'Posting…' : 'Post'}</Text></TouchableOpacity>
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
  searchInput: { fontSize: 13, color: C.text, flex: 1, outlineStyle: 'none' },
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

function CohortCard({ cohort }: { cohort: Cohort }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [weeks, setWeeks] = useState<SyllabusWeek[]>([]);
  const [savedMsg, setSavedMsg] = useState(false);
  function toggle() {
    if (!open && !loaded) { setWeeks(mgmt.getSyllabus(cohort.id)); setLoaded(true); }
    setOpen((o) => !o);
  }
  function addWeek() { setWeeks((w) => [...w, { weekNumber: w.length + 1, title: '', topics: '' }]); }
  function setWeek(i: number, patch: Partial<SyllabusWeek>) { setWeeks((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x))); }
  function removeWeek(i: number) { setWeeks((w) => w.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, weekNumber: idx + 1 }))); }
  function save() { mgmt.saveSyllabus(cohort.id, weeks); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1800); }
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
            <TouchableOpacity onPress={addWeek} style={em.addBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={14} color={C.brand} /><Text style={em.addBtnText}>Add week</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} style={mst.saveBtn} {...({ dataSet: { btn: '1' } } as any)}><Text style={mst.saveBtnText}>Save syllabus</Text></TouchableOpacity>
            {savedMsg && <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>Saved</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

function WebManage() {
  const [tab, setTab] = useState<'cohorts' | 'upskilling'>('cohorts');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { setCohorts(mgmt.getCohorts()); setCourses(mgmt.getCourses()); }, [tick]);

  const [cAddOpen, setCAddOpen] = useState(false);
  const [cName, setCName] = useState(''); const [cMoodle, setCMoodle] = useState(''); const [cTrack, setCTrack] = useState('Cybersecurity');
  const [cStart, setCStart] = useState(''); const [cEnd, setCEnd] = useState('');
  function addCohort() {
    if (!cName.trim()) return;
    mgmt.saveCohort({ id: `c-${Date.now()}`, name: cName.trim(), moodleName: cMoodle.trim() || undefined, track: cTrack.trim() || 'Cybersecurity', startDate: cStart || 'TBD', endDate: cEnd || 'TBD', studentCount: 0, color: CHART_SERIES[cohorts.length % CHART_SERIES.length], active: true });
    setCName(''); setCMoodle(''); setCStart(''); setCEnd(''); setTick((t) => t + 1); setCAddOpen(false);
  }

  const [coTitle, setCoTitle] = useState(''); const [coProvider, setCoProvider] = useState('');
  const [coTrack, setCoTrack] = useState<CourseTrack>('cybersecurity');
  const [coStart, setCoStart] = useState(''); const [coEnd, setCoEnd] = useState(''); const [coSpots, setCoSpots] = useState('20');
  function addCourse() {
    if (!coTitle.trim()) return;
    const spots = Number(coSpots) || 0;
    mgmt.saveCourse({ id: `course-${Date.now()}`, title: coTitle.trim(), provider: coProvider.trim() || 'Red Alpha', track: coTrack, description: '', startDate: coStart || 'TBD', endDate: coEnd || 'TBD', spotsTotal: spots, spotsRemaining: spots, status: 'open', color: TRACK_COLOR[coTrack] });
    setCoTitle(''); setCoProvider(''); setCoStart(''); setCoEnd(''); setTick((t) => t + 1);
  }
  function removeCourse(id: string) { mgmt.deleteCourse(id); setTick((t) => t + 1); }

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
            <TouchableOpacity onPress={() => setCAddOpen(true)} style={news.newBtn} {...({ dataSet: { btn: '1' } } as any)}><Icon name="plus" size={14} color="#fff" /><Text style={news.newBtnText}>Add cohort</Text></TouchableOpacity>
          </View>
          <View style={{ gap: 10, width: '100%' }}>{cohorts.map((co) => <CohortCard key={co.id} cohort={co} />)}</View>
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
              <Text style={em.title}>Add cohort</Text>
              <TouchableOpacity onPress={() => setCAddOpen(false)} style={em.close} {...({ dataSet: { btn: '1' } } as any)}><Icon name="close" size={15} color={C.textMid} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }}>
              <Field label="Name" value={cName} onChange={setCName} ph="e.g. Cohort 16" />
              <Field label="Name on Moodle" value={cMoodle} onChange={setCMoodle} ph="exact name as it appears in Moodle" />
              <Field label="Track" value={cTrack} onChange={setCTrack} ph="e.g. Cybersecurity" />
              <Field label="Start date" value={cStart} onChange={setCStart} ph="YYYY-MM-DD" />
              <Field label="End date" value={cEnd} onChange={setCEnd} ph="YYYY-MM-DD" />
            </ScrollView>
            <View style={em.foot}>
              <TouchableOpacity style={em.cancel} onPress={() => setCAddOpen(false)} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={em.save} onPress={addCohort} {...({ dataSet: { btn: '1' } } as any)}><Text style={em.saveText}>Create cohort</Text></TouchableOpacity>
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
  function accept(m: StaffMember) { mgmt.upsertMember({ ...m, status: 'active' }).then(() => setTick((t) => t + 1)); }
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
              <View style={[tbl.cell, { flex: 1.4, flexDirection: 'row', gap: 6 }]}>
                {(['admin', 'staff'] as StaffRole[]).map((r) => (
                  <TouchableOpacity key={r} onPress={() => changeRole(m, r)} style={[mst.trackPick, m.role === r && { borderColor: r === 'admin' ? C.brand : C.blue, backgroundColor: (r === 'admin' ? C.brand : C.blue) + '18' }]} {...({ dataSet: { btn: '1' } } as any)}>
                    <Text style={[mst.trackPickText, m.role === r && { color: r === 'admin' ? C.brand : C.blue }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={tbl.cell}>
                <View style={[tbl.pStatus, { backgroundColor: m.status === 'active' ? C.greenSoft : C.amberSoft, alignSelf: 'flex-start' }]}>
                  <Text style={[tbl.pStatusText, { color: m.status === 'active' ? C.green : C.amber }]}>{m.status === 'active' ? 'Active' : 'Invited'}</Text>
                </View>
              </View>
              <View style={[tbl.cell, { flex: 1.3, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }]}>
                {m.status === 'invited' && <TouchableOpacity onPress={() => accept(m)} style={tbl.iconBtn} {...({ dataSet: { btn: '1' } } as any)}><Text style={tbl.iconBtnText}>Mark joined</Text></TouchableOpacity>}
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

const PAGES: Record<string, { title: string; subtitle: string; component: React.ComponentType }> = {
  students:  { title: 'Students',  subtitle: 'Manage student records, certifications and placement info', component: WebStudents },
  dashboard: { title: 'Dashboard', subtitle: 'Overview of cohort health and outcomes',                    component: WebDashboard },
  growth:    { title: 'Growth',    subtitle: 'Enrollment and placement trends over time',                 component: WebGrowth },
  news:      { title: 'News',      subtitle: 'Announcements posted to the community',                      component: WebNews },
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
          <TopBar title={page.title} subtitle={page.subtitle} userName={userName} />
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
