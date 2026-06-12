// Shared domain types for the Red Alpha Companion app.

export type UserRole = 'student' | 'staff' | 'admin';

// Staff-side member account (admins + staff). Managed in the Users admin page.
export type StaffRole = 'admin' | 'staff';
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'invited';
  invitedAt?: string;
}

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Cohort {
  id: string;
  name: string;           // e.g. "Cohort 14"
  moodleName?: string;    // exact cohort/course name as it appears in Moodle
  track: string;          // e.g. "Cybersecurity"
  startDate: string;
  endDate: string;
  studentCount: number;
  color: string;
  active: boolean;
}

export interface ScheduleSession {
  id: string;
  title: string;
  facilitator: string;
  startsAt: string;
  endsAt: string;
  location: string;
  type: 'lecture' | 'workshop' | 'assessment' | 'mentoring' | 'company-visit';
}

export interface ScheduleWeek {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  sessions: ScheduleSession[];
}

// Editable weekly syllabus entry attached to a cohort.
export interface SyllabusWeek {
  weekNumber: number;
  title: string;
  topics: string;   // free text; comma or newline separated
}

export interface MoodleCourseScore {
  courseId: string;
  courseName: string;
  grade: number;
  passingGrade: number;
  lastUpdated: string;
  completedActivities: number;
  totalActivities: number;
}

// ---------------------------------------------------------------------------
// Community feed types
// ---------------------------------------------------------------------------

export type AnnouncementType = 'achievement' | 'event' | 'update';

export interface Reaction {
  emoji: string;
  label: string;
  count: number;
}

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  postedAt: string;
  audience: 'all' | 'students' | 'staff';
  pinned?: boolean;
  author: string;
  // Achievement-specific fields
  achieverName?: string;
  achieverCohort?: string;
  certificationName?: string;
  certProvider?: string;
  reactions?: Reaction[];
}

// ---------------------------------------------------------------------------
// Upskilling / courses
// ---------------------------------------------------------------------------

export type CourseTrack = 'cybersecurity' | 'ai' | 'data' | 'cloud' | 'network' | 'software';
export type CourseStatus = 'open' | 'closing-soon' | 'closed' | 'applied' | 'confirmed';

export interface Course {
  id: string;
  title: string;
  provider: string;
  track: CourseTrack;
  description: string;
  startDate: string;    // ISO date
  endDate: string;
  spotsTotal: number;
  spotsRemaining: number;
  status: CourseStatus;
  color: string;        // Track accent color
}

// ---------------------------------------------------------------------------
// Student stats & certifications
// ---------------------------------------------------------------------------

export interface Certification {
  id: string;
  name: string;
  provider: string;
  earnedAt: string;
  expiresAt?: string;
  credentialUrl?: string;
  badgeUrl?: string;
  track: CourseTrack;
  /** false = student-reported, awaiting staff verification. undefined/true = verified. */
  verified?: boolean;
}

/** An upskilling course a trainee has taken (staff-recorded). */
export interface UpskillingTaken {
  id: string;
  title: string;
  provider?: string;
  track?: string;
  completedAt?: string;   // ISO date
}

/** Year-on-year performance report (file lives on SharePoint; we store the URL). */
export interface PerformanceReport {
  year: number;
  url: string;
  filename?: string;
  uploadedAt?: string;
}

export type StudentLifecycleStage =
  | 'on-course'
  | 'job-hunting'
  | 'on-placement'
  | 'bond-completed'
  | 'extended'        // post-bond extension to complete the placement opportunity (PO)
  | 'withdrawn';

export interface StudentStats {
  studentId: string;
  bootcampStartDate: string;
  bootcampEndDate: string;
  currentWeek: number;
  totalWeeks: number;
  certifications: Certification[];
  totalCerts: number;
  recentCert?: Certification;
  lifecycleStage?: StudentLifecycleStage;
  // Placement info (populated by staff)
  placementCompany?: string;
  placementRole?: string;
  reportingOfficer?: string;
  bondEndDate?: string;
  // Bond progress (computed from placements; served time pauses on bench)
  bondMonths?: number;
  bondMode?: 'accumulative' | 'end_date';
  bondServedMonths?: number;
}

// ---------------------------------------------------------------------------
// Staff / student management
// ---------------------------------------------------------------------------

export interface PlacementRecord {
  id: string;
  company: string;
  role: string;
  reportingOfficer?: string;
  roEmail?: string;
  startDate: string;          // ISO date the placement began
  endDate?: string;           // ISO date it ended; undefined = ongoing
  status: 'active' | 'completed' | 'terminated';  // terminated = let go / fired
  months?: number;   // total months of service (authoritative when dates are messy)
  note?: string;
  jdUrl?: string;        // job description file (SharePoint URL)
  jdFilename?: string;
}

export interface StaffStudentRecord {
  studentId: string;
  name: string;
  email: string;
  cohortName: string;
  stage: StudentLifecycleStage;
  model?: string;   // raw RA status: Secondment / Bond Buy Out / Training in Progress / etc.
  certifications: Certification[];
  // Onboarding fields
  dateOfBirth?: string;
  cvUrl?: string;
  cvFilename?: string;
  // Extended profile
  accountManager?: string;
  contactNo?: string;
  personalEmail?: string;
  dateJoined?: string;
  ccpGrant?: 'yes' | 'completed' | 'no';
  // Bond: total months of service required before bond is completed.
  // Served time only accrues during active placements (paused while on bench).
  bondMonths?: number;
  bondMode?: 'accumulative' | 'end_date';  // accumulative pauses on bench; end_date = fixed date
  // Full placement history (newest first). The active one (status 'active') is current.
  placements?: PlacementRecord[];
  // Legacy convenience fields (derived from the active placement)
  placementCompany?: string;
  placementStartDate?: string;
  placementRole?: string;
  reportingOfficer?: string;
  roEmail?: string;
  bondEndDate?: string;
  upskilling?: UpskillingTaken[];
  performanceReports?: PerformanceReport[];
}

export interface InterviewRecord {
  id: string;
  studentId: string;
  company: string;
  role?: string;
  date: string;          // ISO date
  outcome: 'scheduled' | 'passed' | 'rejected' | 'pending';
  notes?: string;
}

export type IntakeStatus = 'tbc' | 'confirmed' | 'started';
export interface IntakeProgramme {
  id: string;
  quarter: string;        // e.g. "Q1"
  programNumber: string;  // e.g. "ASTP14"
  domain: string;         // e.g. "CYBER"
  quantity: number;
  status: IntakeStatus;
  startDate?: string;
  note?: string;
  syllabusUrl?: string;       // training syllabus file (SharePoint URL) to share with clients
  syllabusFilename?: string;
}

/** A student's application to an upskilling course. */
export interface CourseApplication {
  id: string;
  courseId: string;
  userId: string;
  name: string;
  email: string;
  status: 'pending' | 'confirmed' | 'declined';
  createdAt?: string;
}

/** A certification a student reports as completed; staff verify before it shows fully. */
export interface CertSubmission {
  id: string;
  userId: string;
  name: string;
  provider?: string;
  earnedAt?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface StudentProfile {
  userId: string;
  fullName: string;
  email: string;
  personalEmail?: string;
  contactNo?: string;
  dateOfBirth: string;
  cohortId: string;
  cohortName: string;
  cvUrl?: string;
  cvFilename?: string;
  completedAt: string;
}

export interface PlacementInfo {
  stage: StudentLifecycleStage;
  placementCompany?: string;
  placementRole?: string;
  reportingOfficer?: string;
  roEmail?: string;
  bondEndDate?: string;
}

// ---------------------------------------------------------------------------
// Cohort growth / analytics
// ---------------------------------------------------------------------------

export interface CohortGrowthPoint {
  cohortName: string;
  enrolled: number;
  graduated: number;
  placed: number;
  year: number;
}
