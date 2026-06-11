/**
 * managementApi — staff write operations (cohorts, courses/upskilling, weekly
 * syllabus, and student placement history).
 *
 * Demo mode: persists to localStorage (web) so edits survive reloads.
 * Integration point: replace the read/write helpers with Supabase queries —
 * keep every exported signature identical (see OPERATIONAL_ROADMAP.md).
 */

import {
  Announcement,
  Cohort,
  Course,
  IntakeProgramme,
  InterviewRecord,
  PlacementRecord,
  StaffMember,
  StaffRole,
  StudentLifecycleStage,
  SyllabusWeek,
} from '@/types';
import { mockAnnouncements, mockCohorts, mockCourses } from './mockData';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase';

const LS: Storage | null = typeof window !== 'undefined' ? window.localStorage : null;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = LS?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try { LS?.setItem(key, JSON.stringify(value)); } catch {}
}

const K = {
  cohorts: 'ra.mgmt.cohorts.v1',
  courses: 'ra.mgmt.courses.v1',
  syllabus: (cohortId: string) => `ra.mgmt.syllabus.v1.${cohortId}`,
  placements: 'ra.mgmt.placements.v1',
  announcements: 'ra.mgmt.announcements.v1',
  members: 'ra.mgmt.members.v1',
  interviews: 'ra.mgmt.interviews.v1',
  intake: 'ra.mgmt.intake.v1',
};

export function newId(): string {
  return (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

function mapCohort(r: any): Cohort {
  return { id: String(r.id), name: r.name, moodleName: r.moodle_name ?? undefined, track: r.track ?? '', startDate: r.start_date ?? '', endDate: r.end_date ?? '', studentCount: r.student_count ?? 0, color: r.color ?? '#6366F1', active: r.active ?? true };
}
export async function getCohorts(): Promise<Cohort[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { const { data, error } = await sb.from('cohorts').select('*').order('name', { ascending: true }); if (!error && Array.isArray(data)) return data.map(mapCohort); }
    return [];
  }
  return read<Cohort[] | null>(K.cohorts, null) ?? mockCohorts;
}
export async function saveCohort(c: Cohort): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('cohorts').upsert({ id: c.id, name: c.name, moodle_name: c.moodleName ?? null, track: c.track, start_date: c.startDate, end_date: c.endDate, student_count: c.studentCount, color: c.color, active: c.active }); return; }
  }
  const list = (read<Cohort[] | null>(K.cohorts, null) ?? mockCohorts).slice();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  write(K.cohorts, list);
}
export async function deleteCohort(id: string): Promise<void> {
  if (isSupabaseConfigured) { const sb = getSupabaseClient(); if (sb) { await sb.from('cohorts').delete().eq('id', id); return; } }
  write(K.cohorts, (read<Cohort[] | null>(K.cohorts, null) ?? mockCohorts).filter((c) => c.id !== id));
}

// ---------------------------------------------------------------------------
// Courses (upskilling)
// ---------------------------------------------------------------------------

function mapCourse(r: any): Course {
  return { id: String(r.id), title: r.title, provider: r.provider ?? '', track: r.track, description: r.description ?? '', startDate: r.start_date ?? '', endDate: r.end_date ?? '', spotsTotal: r.spots_total ?? 0, spotsRemaining: r.spots_remaining ?? 0, status: r.status ?? 'open', color: r.color ?? '#6366F1' };
}
export async function getCourses(): Promise<Course[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { const { data, error } = await sb.from('courses').select('*').order('created_at', { ascending: false }); if (!error && Array.isArray(data)) return data.map(mapCourse); }
    return [];
  }
  return read<Course[] | null>(K.courses, null) ?? mockCourses;
}
export async function saveCourse(c: Course): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('courses').upsert({ id: c.id, title: c.title, provider: c.provider, track: c.track, description: c.description, start_date: c.startDate, end_date: c.endDate, spots_total: c.spotsTotal, spots_remaining: c.spotsRemaining, status: c.status, color: c.color }); return; }
  }
  const list = (read<Course[] | null>(K.courses, null) ?? mockCourses).slice();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  write(K.courses, list);
}
export async function deleteCourse(id: string): Promise<void> {
  if (isSupabaseConfigured) { const sb = getSupabaseClient(); if (sb) { await sb.from('courses').delete().eq('id', id); return; } }
  write(K.courses, (read<Course[] | null>(K.courses, null) ?? mockCourses).filter((c) => c.id !== id));
}

// ---------------------------------------------------------------------------
// Weekly syllabus (per cohort)
// ---------------------------------------------------------------------------

export async function getSyllabus(cohortId: string): Promise<SyllabusWeek[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { const { data, error } = await sb.from('syllabus_weeks').select('*').eq('cohort_id', cohortId).order('week_number', { ascending: true }); if (!error && Array.isArray(data)) return data.map((r: any) => ({ weekNumber: r.week_number, title: r.title ?? '', topics: r.topics ?? '' })); }
  }
  return read<SyllabusWeek[]>(K.syllabus(cohortId), []);
}
export async function saveSyllabus(cohortId: string, weeks: SyllabusWeek[]): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('syllabus_weeks').delete().eq('cohort_id', cohortId);
      if (weeks.length) await sb.from('syllabus_weeks').insert(weeks.map((w) => ({ cohort_id: cohortId, week_number: w.weekNumber, title: w.title, topics: w.topics })));
      return;
    }
  }
  write(K.syllabus(cohortId), weeks);
}

// ---------------------------------------------------------------------------
// Student placement overrides (history + bond), keyed by studentId
// ---------------------------------------------------------------------------

export interface PlacementOverride {
  stage?: StudentLifecycleStage;
  bondMonths?: number;
  placements?: PlacementRecord[];
  // profile edits
  cohortName?: string;
  dateOfBirth?: string;
  accountManager?: string;
  contactNo?: string;
  personalEmail?: string;
  dateJoined?: string;
  ccpGrant?: 'yes' | 'completed' | 'no';
  // legacy convenience mirror of the active placement
  placementCompany?: string;
  placementRole?: string;
  reportingOfficer?: string;
  roEmail?: string;
  bondEndDate?: string;
}

export function getPlacementOverrides(): Record<string, PlacementOverride> {
  return read<Record<string, PlacementOverride>>(K.placements, {});
}
export function savePlacement(studentId: string, o: PlacementOverride): void {
  const all = getPlacementOverrides();
  all[studentId] = o;
  write(K.placements, all);
}

// ---------------------------------------------------------------------------
// Announcements (news + community)
// ---------------------------------------------------------------------------

function mapAnnouncement(r: any): Announcement {
  return { id: String(r.id), type: r.type, title: r.title, body: r.body ?? '', postedAt: r.posted_at ?? new Date().toISOString(), audience: r.audience ?? 'all', pinned: r.pinned ?? undefined, author: r.author ?? undefined, achieverName: r.achiever_name ?? undefined, achieverCohort: r.achiever_cohort ?? undefined, certificationName: r.certification_name ?? undefined, certProvider: r.cert_provider ?? undefined, reactions: Array.isArray(r.reactions) && r.reactions.length ? r.reactions : undefined };
}

/** Students praise an achievement post (RLS-safe RPC; staff-only writes stay intact). */
export async function reactToAnnouncement(id: string, emoji: string, label: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  try { await sb.rpc('react_to_announcement', { p_id: id, p_emoji: emoji, p_label: label }); } catch {}
}
export async function getAnnouncements(): Promise<Announcement[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { const { data, error } = await sb.from('announcements').select('*').order('posted_at', { ascending: false }); if (!error && Array.isArray(data)) return data.map(mapAnnouncement); }
    return [];
  }
  return read<Announcement[] | null>(K.announcements, null) ?? mockAnnouncements;
}
export async function saveAnnouncement(a: Announcement): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('announcements').upsert({ id: a.id, type: a.type, title: a.title, body: a.body, posted_at: a.postedAt, audience: a.audience, pinned: a.pinned ?? false, author: a.author ?? null, achiever_name: a.achieverName ?? null, achiever_cohort: a.achieverCohort ?? null, certification_name: a.certificationName ?? null, cert_provider: a.certProvider ?? null }); return; }
  }
  const list = (read<Announcement[] | null>(K.announcements, null) ?? mockAnnouncements).slice();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a; else list.unshift(a);
  write(K.announcements, list);
}
export async function deleteAnnouncement(id: string): Promise<void> {
  if (isSupabaseConfigured) { const sb = getSupabaseClient(); if (sb) { await sb.from('announcements').delete().eq('id', id); return; } }
  write(K.announcements, (read<Announcement[] | null>(K.announcements, null) ?? mockAnnouncements).filter((a) => a.id !== id));
}

// ---------------------------------------------------------------------------
// Staff members (admin + staff) — user management
// ---------------------------------------------------------------------------

const MEMBERS_SEED: StaffMember[] = [
  { id: 'm-admin', name: 'Demo Admin', email: 'demo.admin@staff.bootcamp.sg', role: 'admin', status: 'active' },
  { id: 'm-staff1', name: 'Demo Staff Member', email: 'demo.staff@staff.bootcamp.sg', role: 'staff', status: 'active' },
  { id: 'm-staff2', name: 'Vivian Ng', email: 'vivian.ng@staff.bootcamp.sg', role: 'staff', status: 'active' },
];

function mapMemberRow(r: any): StaffMember {
  return { id: String(r.id), name: r.name ?? '', email: r.email, role: r.role, status: r.status, invitedAt: r.invited_at ?? undefined };
}

/** Read members from Supabase when configured, else from local storage / seed. */
export async function fetchMembers(): Promise<StaffMember[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('staff_members').select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) return data.map(mapMemberRow);
    }
    return [];
  }
  return read<StaffMember[] | null>(K.members, null) ?? MEMBERS_SEED;
}

export async function upsertMember(m: StaffMember): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('staff_members').upsert(
        { name: m.name, email: m.email.toLowerCase(), role: m.role, status: m.status, invited_at: m.invitedAt ?? null },
        { onConflict: 'email' }
      );
      return;
    }
  }
  const list = (read<StaffMember[] | null>(K.members, null) ?? MEMBERS_SEED).slice();
  const i = list.findIndex((x) => x.id === m.id || x.email.toLowerCase() === m.email.toLowerCase());
  if (i >= 0) list[i] = m; else list.push(m);
  write(K.members, list);
}

export async function removeMember(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('staff_members').delete().eq('id', id); return; }
  }
  const list = (read<StaffMember[] | null>(K.members, null) ?? MEMBERS_SEED).filter((m) => m.id !== id);
  write(K.members, list);
}

/** RPC: an invited member activates their OWN row on first real sign-in.
 *  (Admin-only write policies reject a direct upsert, so this goes through a
 *  SECURITY DEFINER function — see supabase-rls-hardening.sql.) */
export async function activateMyMembership(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  try { await sb.rpc('activate_membership'); } catch {}
}

/** Returns false when the current user's token is rejected by the backend
 *  (e.g. an account outside the organization). True when reads succeed or when
 *  Supabase isn't configured (demo mode). */
export async function verifyBackendAccess(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const sb = getSupabaseClient();
  if (!sb) return true;
  const { error } = await sb.from('staff_members').select('id').limit(1);
  return !error;
}

export async function inviteMemberAsync(email: string, role: StaffRole, name?: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const existing = (await fetchMembers()).find((m) => m.email.toLowerCase() === clean);
  if (existing) { await upsertMember({ ...existing, role }); return; }
  await upsertMember({ id: `m-${Date.now()}`, name: name?.trim() || clean.split('@')[0], email: clean, role, status: 'invited', invitedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// App settings (key/value) — e.g. the intake target
// ---------------------------------------------------------------------------

export async function getSetting(key: string, fallback: string): Promise<string> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('app_settings').select('value').eq('key', key).maybeSingle();
      if (!error && data && data.value != null) return data.value;
    }
  }
  return read<string | null>('ra.mgmt.setting.' + key, null) ?? fallback;
}
export async function setSetting(key: string, value: string): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('app_settings').upsert({ key, value }); return; }
  }
  write('ra.mgmt.setting.' + key, value);
}
export async function getIntakeTarget(): Promise<number> { return Number(await getSetting('intake_target', '250')) || 250; }
export async function setIntakeTarget(n: number): Promise<void> { await setSetting('intake_target', String(n)); }

// ---------------------------------------------------------------------------
// Interviews (per student)
// ---------------------------------------------------------------------------

function mapInterview(r: any): InterviewRecord {
  return { id: String(r.id), studentId: r.student_id, company: r.company, role: r.role ?? undefined, date: r.date, outcome: r.outcome, notes: r.notes ?? undefined };
}
export async function fetchInterviews(studentId: string): Promise<InterviewRecord[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('interviews').select('*').eq('student_id', studentId).order('date', { ascending: false });
      if (!error && Array.isArray(data)) return data.map(mapInterview);
    }
    return [];
  }
  return read<InterviewRecord[]>(K.interviews, []).filter((i) => i.studentId === studentId);
}

/** Every interview record (used by the "interviewed for" filter). */
export async function fetchAllInterviews(): Promise<InterviewRecord[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('interviews').select('*');
      if (!error && Array.isArray(data)) return data.map(mapInterview);
    }
    return [];
  }
  return read<InterviewRecord[]>(K.interviews, []);
}
export async function saveInterview(rec: InterviewRecord): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('interviews').upsert({ id: rec.id, student_id: rec.studentId, company: rec.company, role: rec.role ?? null, date: rec.date, outcome: rec.outcome, notes: rec.notes ?? null }); return; }
  }
  const all = read<InterviewRecord[]>(K.interviews, []);
  const i = all.findIndex((x) => x.id === rec.id);
  if (i >= 0) all[i] = rec; else all.push(rec);
  write(K.interviews, all);
}
export async function deleteInterview(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('interviews').delete().eq('id', id); return; }
  }
  write(K.interviews, read<InterviewRecord[]>(K.interviews, []).filter((i) => i.id !== id));
}

// ---------------------------------------------------------------------------
// Intake / upcoming-course pipeline
// ---------------------------------------------------------------------------

function mapIntake(r: any): IntakeProgramme {
  return { id: String(r.id), quarter: r.quarter, programNumber: r.program_number, domain: r.domain, quantity: r.quantity, status: r.status, startDate: r.start_date ?? undefined, note: r.note ?? undefined, syllabusUrl: r.syllabus_url ?? undefined, syllabusFilename: r.syllabus_filename ?? undefined };
}
export async function fetchIntake(): Promise<IntakeProgramme[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('intake_programmes').select('*').order('quarter', { ascending: true });
      if (!error && Array.isArray(data)) return data.map(mapIntake);
    }
    return [];
  }
  return read<IntakeProgramme[]>(K.intake, []);
}
export async function saveIntake(rec: IntakeProgramme): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('intake_programmes').upsert({ id: rec.id, quarter: rec.quarter, program_number: rec.programNumber, domain: rec.domain, quantity: rec.quantity, status: rec.status, start_date: rec.startDate ?? null, note: rec.note ?? null, syllabus_url: rec.syllabusUrl ?? null, syllabus_filename: rec.syllabusFilename ?? null }); return; }
  }
  const all = read<IntakeProgramme[]>(K.intake, []);
  const i = all.findIndex((x) => x.id === rec.id);
  if (i >= 0) all[i] = rec; else all.push(rec);
  write(K.intake, all);
}
export async function deleteIntake(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('intake_programmes').delete().eq('id', id); return; }
  }
  write(K.intake, read<IntakeProgramme[]>(K.intake, []).filter((i) => i.id !== id));
}

// ---------------------------------------------------------------------------
// Bond helpers (served time only accrues during placements; paused on bench)
// ---------------------------------------------------------------------------

export function monthsBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
}

/** Total months served across every placement (active counts up to now). */
export function bondServedMonths(placements: PlacementRecord[] | undefined, now = Date.now()): number {
  if (!placements?.length) return 0;
  const nowISO = new Date(now).toISOString();
  return placements.reduce((sum, p) => sum + (typeof p.months === 'number' ? p.months : monthsBetween(p.startDate, p.endDate ?? nowISO)), 0);
}

export function activePlacement(placements: PlacementRecord[] | undefined): PlacementRecord | undefined {
  return placements?.find((p) => p.status === 'active' && !p.endDate);
}
