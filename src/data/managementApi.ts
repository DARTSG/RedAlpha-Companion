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

export function getCohorts(): Cohort[] {
  return read<Cohort[] | null>(K.cohorts, null) ?? mockCohorts;
}
export function saveCohort(c: Cohort): Cohort[] {
  const list = getCohorts().slice();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  write(K.cohorts, list);
  return list;
}
export function deleteCohort(id: string): Cohort[] {
  const list = getCohorts().filter((c) => c.id !== id);
  write(K.cohorts, list);
  return list;
}

// ---------------------------------------------------------------------------
// Courses (upskilling)
// ---------------------------------------------------------------------------

export function getCourses(): Course[] {
  return read<Course[] | null>(K.courses, null) ?? mockCourses;
}
export function saveCourse(c: Course): Course[] {
  const list = getCourses().slice();
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  write(K.courses, list);
  return list;
}
export function deleteCourse(id: string): Course[] {
  const list = getCourses().filter((c) => c.id !== id);
  write(K.courses, list);
  return list;
}

// ---------------------------------------------------------------------------
// Weekly syllabus (per cohort)
// ---------------------------------------------------------------------------

export function getSyllabus(cohortId: string): SyllabusWeek[] {
  return read<SyllabusWeek[]>(K.syllabus(cohortId), []);
}
export function saveSyllabus(cohortId: string, weeks: SyllabusWeek[]): void {
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

export function getAnnouncements(): Announcement[] {
  return read<Announcement[] | null>(K.announcements, null) ?? mockAnnouncements;
}
export function saveAnnouncement(a: Announcement): Announcement[] {
  const list = getAnnouncements().slice();
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = a; else list.unshift(a);
  write(K.announcements, list);
  return list;
}
export function deleteAnnouncement(id: string): Announcement[] {
  const list = getAnnouncements().filter((a) => a.id !== id);
  write(K.announcements, list);
  return list;
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
  }
  return read<InterviewRecord[]>(K.interviews, []).filter((i) => i.studentId === studentId);
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
  return { id: String(r.id), quarter: r.quarter, programNumber: r.program_number, domain: r.domain, quantity: r.quantity, status: r.status, startDate: r.start_date ?? undefined, note: r.note ?? undefined };
}
export async function fetchIntake(): Promise<IntakeProgramme[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from('intake_programmes').select('*').order('quarter', { ascending: true });
      if (!error && Array.isArray(data)) return data.map(mapIntake);
    }
  }
  return read<IntakeProgramme[]>(K.intake, []);
}
export async function saveIntake(rec: IntakeProgramme): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) { await sb.from('intake_programmes').upsert({ id: rec.id, quarter: rec.quarter, program_number: rec.programNumber, domain: rec.domain, quantity: rec.quantity, status: rec.status, start_date: rec.startDate ?? null, note: rec.note ?? null }); return; }
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
  return placements.reduce((sum, p) => sum + monthsBetween(p.startDate, p.endDate ?? nowISO), 0);
}

export function activePlacement(placements: PlacementRecord[] | undefined): PlacementRecord | undefined {
  return placements?.find((p) => p.status === 'active' && !p.endDate);
}
