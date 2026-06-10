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
  PlacementRecord,
  StaffMember,
  StaffRole,
  StudentLifecycleStage,
  SyllabusWeek,
} from '@/types';
import { mockAnnouncements, mockCohorts, mockCourses } from './mockData';

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
};

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

export function getMembers(): StaffMember[] {
  return read<StaffMember[] | null>(K.members, null) ?? MEMBERS_SEED;
}
export function saveMember(m: StaffMember): StaffMember[] {
  const list = getMembers().slice();
  const i = list.findIndex((x) => x.id === m.id);
  if (i >= 0) list[i] = m; else list.push(m);
  write(K.members, list);
  return list;
}
export function deleteMember(id: string): StaffMember[] {
  const list = getMembers().filter((m) => m.id !== id);
  write(K.members, list);
  return list;
}
export function inviteMember(email: string, role: StaffRole, name?: string): StaffMember[] {
  const clean = email.trim().toLowerCase();
  const existing = getMembers().find((m) => m.email.toLowerCase() === clean);
  if (existing) return saveMember({ ...existing, role });
  return saveMember({ id: `m-${Date.now()}`, name: name?.trim() || clean.split('@')[0], email: clean, role, status: 'invited', invitedAt: new Date().toISOString() });
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
