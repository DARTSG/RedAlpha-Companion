import * as mgmt from './managementApi';
import {
  Announcement,
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
  return delay(mgmt.getCohorts());
}

// ---- Student endpoints -----------------------------------------------------

export async function fetchScheduleWeeks(_accessToken: string | null): Promise<ScheduleWeek[]> {
  return delay(mockScheduleWeeks);
}

export async function fetchMoodleScores(_accessToken: string | null): Promise<MoodleCourseScore[]> {
  return delay(mockMoodleScores);
}

export async function fetchAnnouncements(_accessToken: string | null): Promise<Announcement[]> {
  return delay(mgmt.getAnnouncements());
}

export async function fetchStudentStats(_accessToken: string | null): Promise<StudentStats> {
  return delay(mockStudentStats);
}

export async function fetchCourses(_accessToken: string | null): Promise<Course[]> {
  return delay(mgmt.getCourses());
}

// ---- Staff endpoints -------------------------------------------------------

export async function fetchStaffStudentRoster(_accessToken: string | null): Promise<StaffStudentRecord[]> {
  return delay(mockStaffStudents);
}

export async function fetchCohortGrowth(_accessToken: string | null): Promise<CohortGrowthPoint[]> {
  return delay(mockGrowth);
}
