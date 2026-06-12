import * as mgmt from './managementApi';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase';
import { getAllStudents } from './profileApi';
import {
  Announcement,
  Certification,
  Cohort,
  CohortGrowthPoint,
  Course,
  MoodleCourseScore,
  ScheduleWeek,
  StaffStudentRecord,
  StudentStats,
} from '@/types';
import {
  mockAnnouncements,
  mockCohorts,
  mockCourses,
  mockGrowth,
  mockMoodleScores,
  mockScheduleWeeks,
  mockStaffStudents,
  mockStudentStats,
} from './mockData';

// ---------------------------------------------------------------------------
// API ADAPTER LAYER — the ONE file to change when connecting to your backend.
// ---------------------------------------------------------------------------

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
const SIMULATED_NETWORK_DELAY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), SIMULATED_NETWORK_DELAY_MS));
}

// ---- Cohorts ---------------------------------------------------------------

export async function fetchCohorts(_accessToken: string | null): Promise<Cohort[]> {
  return mgmt.getCohorts();
}

// ---- Student endpoints -----------------------------------------------------

export async function fetchScheduleWeeks(_accessToken: string | null): Promise<ScheduleWeek[]> {
  return delay(mockScheduleWeeks);
}

/** Grades via the moodle-grades Edge Function (token stays server-side).
 *  Returns [] until Moodle is configured; mock data only in demo mode. */
export async function fetchMoodleScores(_accessToken: string | null): Promise<MoodleCourseScore[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb.functions.invoke('moodle-grades', { body: {} });
        if (!error && Array.isArray(data?.scores)) return data.scores as MoodleCourseScore[];
      } catch { /* not deployed yet */ }
    }
    return [];
  }
  return delay(mockMoodleScores);
}

export async function fetchAnnouncements(_accessToken: string | null): Promise<Announcement[]> {
  return mgmt.getAnnouncements();
}

/** Real stats from the signed-in student's own profile row (RLS: own-row read).
 *  Only staff-verified certifications are included. Mock in demo mode. */
export async function fetchStudentStats(_accessToken: string | null): Promise<StudentStats> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data: u } = await sb.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const { data: row } = await sb.from('student_profiles').select('*').eq('user_id', uid).maybeSingle();
          const cohorts: Cohort[] = await mgmt.getCohorts().catch(() => []);
          const co = row ? cohorts.find((c) => c.name === row.cohort_name || c.id === row.cohort_id) : undefined;
          const today = new Date().toISOString().slice(0, 10);
          const start = (co?.startDate && co.startDate !== 'TBD' ? co.startDate : row?.date_joined) || today;
          const end = (co?.endDate && co.endDate !== 'TBD' ? co.endDate : start) || start;
          const weekMs = 7 * 86400000;
          const totalWeeks = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / weekMs) || 12);
          const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((Date.now() - new Date(start).getTime()) / weekMs) || 1));
          const certs: Certification[] = (Array.isArray(row?.certifications) ? row.certifications : [])
            .filter((c: any) => c && c.verified !== false)
            .sort((a: Certification, b: Certification) => (b.earnedAt || '').localeCompare(a.earnedAt || ''));
          return {
            studentId: uid,
            bootcampStartDate: start,
            bootcampEndDate: end,
            currentWeek,
            totalWeeks,
            certifications: certs,
            totalCerts: certs.length,
            recentCert: certs[0],
            lifecycleStage: row?.lifecycle_stage ?? 'on-course',
            placementCompany: row?.placement_company ?? undefined,
            placementRole: row?.placement_role ?? undefined,
            reportingOfficer: row?.reporting_officer ?? undefined,
            bondEndDate: row?.bond_end_date ?? undefined,
            bondMonths: row?.bond_months ?? 36,
            bondMode: (row?.bond_mode as 'accumulative' | 'end_date') ?? 'accumulative',
            bondServedMonths: mgmt.bondServedMonths(Array.isArray(row?.placements) ? row.placements : []),
          };
        }
      } catch {
        // fall through to mock below only in demo; configured mode returns empty-ish stats
      }
      const today = new Date().toISOString().slice(0, 10);
      return { studentId: '', bootcampStartDate: today, bootcampEndDate: today, currentWeek: 1, totalWeeks: 1, certifications: [], totalCerts: 0, lifecycleStage: 'on-course' };
    }
  }
  return delay(mockStudentStats);
}

export async function fetchCourses(_accessToken: string | null): Promise<Course[]> {
  return mgmt.getCourses();
}

// ---- Staff endpoints -------------------------------------------------------

export async function fetchStaffStudentRoster(accessToken: string | null): Promise<StaffStudentRecord[]> {
  if (isSupabaseConfigured) return getAllStudents(accessToken);
  return delay(mockStaffStudents);
}

export async function fetchCohortGrowth(_accessToken: string | null): Promise<CohortGrowthPoint[]> {
  return delay(mockGrowth);
}
