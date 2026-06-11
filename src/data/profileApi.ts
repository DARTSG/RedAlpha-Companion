/**
 * Student profile + placement API.
 *
 * Works in two modes:
 *   • Demo / local — uses expo-secure-store per device, mock students for staff view
 *   • Supabase     — full persistence once EXPO_PUBLIC_SUPABASE_URL is set
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { PlacementInfo, PlacementRecord, StaffStudentRecord, StudentLifecycleStage, StudentProfile } from '@/types';
import { mockStaffStudents } from './mockData';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase';

const PROFILE_KEY_PREFIX = 'ra.profile.v1.';
const PLACEMENT_KEY_PREFIX = 'ra.placement.v1.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function profileKey(userId: string) { return `${PROFILE_KEY_PREFIX}${userId}`; }
function placementKey(studentId: string) { return `${PLACEMENT_KEY_PREFIX}${studentId}`; }

/** SecureStore is not available on web — fall back to localStorage */
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

// ---------------------------------------------------------------------------
// Student profile
// ---------------------------------------------------------------------------

export async function saveStudentProfile(profile: StudentProfile): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    const { error } = await sb.from('student_profiles').upsert({
      user_id: profile.userId,
      full_name: profile.fullName,
      email: profile.email,
      date_of_birth: profile.dateOfBirth,
      cohort_id: profile.cohortId,
      cohort_name: profile.cohortName,
      cv_url: profile.cvUrl ?? null,
      cv_filename: profile.cvFilename ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    return;
  }
  // Local fallback
  await secureSet(profileKey(profile.userId), JSON.stringify(profile));
}

export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return {
      userId: data.user_id,
      fullName: data.full_name,
      email: data.email,
      dateOfBirth: data.date_of_birth,
      cohortId: data.cohort_id,
      cohortName: data.cohort_name,
      cvUrl: data.cv_url,
      cvFilename: data.cv_filename,
      completedAt: data.created_at,
    };
  }
  // Local fallback
  const raw = await secureGet(profileKey(userId));
  return raw ? JSON.parse(raw) : null;
}

export async function deleteStudentProfile(userId: string): Promise<void> {
  await secureDelete(profileKey(userId));
}

// ---------------------------------------------------------------------------
// CV upload
// ---------------------------------------------------------------------------

/**
 * Uploads a CV file. Returns the accessible URL/URI for the CV.
 * - Supabase mode: uploads to 'cvs' bucket, returns signed URL
 * - Demo mode: returns the local file URI (stored in profile)
 */
export async function uploadCV(
  userId: string,
  fileUri: string,
  filename: string,
  mimeType: string = 'application/pdf'
): Promise<string> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();

    // Read file as base64 on native, as ArrayBuffer on web
    let fileData: any;
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      fileData = await response.arrayBuffer();
    } else {
      const FileSystem = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
      // Convert base64 to Uint8Array
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      fileData = bytes;
    }

    const path = `${userId}/${Date.now()}_${filename}`;
    const { data, error } = await sb.storage
      .from('cvs')
      .upload(path, fileData, { contentType: mimeType, upsert: true });
    if (error) throw new Error(error.message);

    // Return a signed URL valid for 1 year
    const { data: urlData } = await sb.storage
      .from('cvs')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return urlData?.signedUrl ?? fileUri;
  }
  // Demo mode — store local URI as the "URL"
  return fileUri;
}

// ---------------------------------------------------------------------------
// Staff: all students
// ---------------------------------------------------------------------------

/**
 * Returns all student profiles for staff management view.
 * Supabase mode: full query with optional filters.
 * Demo mode: mock students merged with any locally saved placement edits.
 */
export async function getAllStudents(_accessToken: string | null): Promise<StaffStudentRecord[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('student_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any): StaffStudentRecord => ({
      studentId: row.user_id,
      name: row.full_name,
      email: row.email,
      personalEmail: row.personal_email ?? undefined,
      contactNo: row.contact_no ?? undefined,
      cohortName: row.cohort_name,
      stage: row.lifecycle_stage ?? 'on-course',
      model: row.model ?? undefined,
      dateOfBirth: row.date_of_birth ?? undefined,
      dateJoined: row.date_joined ?? undefined,
      accountManager: row.account_manager ?? undefined,
      ccpGrant: row.ccp_grant ?? undefined,
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
      cvUrl: row.cv_url ?? undefined,
      cvFilename: row.cv_filename ?? undefined,
      bondMonths: row.bond_months ?? undefined,
      bondMode: row.bond_mode ?? undefined,
      bondEndDate: row.bond_end_date ?? undefined,
      placementCompany: row.placement_company ?? undefined,
      placementRole: row.placement_role ?? undefined,
      placementStartDate: row.placement_start_date ?? undefined,
      reportingOfficer: row.reporting_officer ?? undefined,
      roEmail: row.ro_email ?? undefined,
      placements: Array.isArray(row.placements) ? row.placements : undefined,
    }));
  }

  // Demo mode: merge mock students with any locally saved placement edits
  const enriched = await Promise.all(
    mockStaffStudents.map(async (student) => {
      const raw = await secureGet(placementKey(student.studentId));
      if (!raw) return student;
      const saved: PlacementInfo = JSON.parse(raw);
      return {
        ...student,
        stage: saved.stage ?? student.stage,
        placementCompany: saved.placementCompany ?? student.placementCompany,
        placementRole: saved.placementRole ?? student.placementRole,
        reportingOfficer: saved.reportingOfficer ?? student.reportingOfficer,
        roEmail: saved.roEmail ?? student.roEmail,
        bondEndDate: saved.bondEndDate ?? student.bondEndDate,
      };
    })
  );
  return enriched;
}

// ---------------------------------------------------------------------------
// Staff: update placement info
// ---------------------------------------------------------------------------

export async function updatePlacementInfo(
  studentId: string,
  info: PlacementInfo
): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabaseClient();
    const { error } = await sb
      .from('student_profiles')
      .update({
        lifecycle_stage: info.stage,
        placement_company: info.placementCompany ?? null,
        placement_role: info.placementRole ?? null,
        reporting_officer: info.reportingOfficer ?? null,
        ro_email: info.roEmail ?? null,
        bond_end_date: info.bondEndDate ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', studentId);
    if (error) throw new Error(error.message);
    return;
  }
  // Demo mode — save per-student placement info locally
  await secureSet(placementKey(studentId), JSON.stringify(info));
}

// ---------------------------------------------------------------------------
// Staff: full student record edit (Supabase). No-op in demo (handled locally).
// ---------------------------------------------------------------------------

export interface StudentEdit {
  stage: StudentLifecycleStage;
  cohortName?: string;
  dateOfBirth?: string;
  accountManager?: string;
  contactNo?: string;
  personalEmail?: string;
  dateJoined?: string;
  ccpGrant?: 'yes' | 'completed' | 'no';
  bondMonths?: number;
  bondMode?: 'accumulative' | 'end_date';
  placements?: PlacementRecord[];
  placementCompany?: string;
  placementRole?: string;
  reportingOfficer?: string;
  roEmail?: string;
  bondEndDate?: string;
}

export async function updateStudentRecord(studentId: string, p: StudentEdit): Promise<void> {
  if (!isSupabaseConfigured) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.from('student_profiles').update({
    lifecycle_stage: p.stage,
    cohort_name: p.cohortName ?? null,
    date_of_birth: p.dateOfBirth ?? null,
    account_manager: p.accountManager ?? null,
    contact_no: p.contactNo ?? null,
    personal_email: p.personalEmail ?? null,
    date_joined: p.dateJoined ?? null,
    ccp_grant: p.ccpGrant ?? null,
    bond_months: p.bondMonths ?? null,
    bond_mode: p.bondMode ?? null,
    placements: p.placements ?? [],
    placement_company: p.placementCompany ?? null,
    placement_role: p.placementRole ?? null,
    reporting_officer: p.reportingOfficer ?? null,
    ro_email: p.roEmail ?? null,
    bond_end_date: p.bondEndDate ?? null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', studentId);
  if (error) throw new Error(error.message);
}
