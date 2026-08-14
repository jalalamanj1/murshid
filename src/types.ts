/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppFlowStage = 'SPLASH' | 'ACTIVATION' | 'REGISTRATION' | 'MAIN';

export type ActiveModule =
  | 'DASHBOARD'
  | 'STUDENTS'
  | 'RECORDS'
  | 'TEMPLATES'
  | 'BACKUP'
  | 'SETTINGS';

export interface LicenseInfo {
  isActivated: boolean;
  licenseType?: string;
  activatedAt?: string;
  activatedTo?: string;
}

export interface CounselorProfile {
  fullName: string;
  schoolName: string;
  province: string;
  academicYear: string;
  schoolType: 'PRIMARY' | 'MIDDLE' | 'HIGH' | 'SECONDARY' | 'KINDERGARTEN';
  counselorGender?: 'MALE' | 'FEMALE';
  isRegistered: boolean;
}

// Student Data Model — 30 fields matching the official registration form
export interface Student {
  id: string;
  fullName: string;
  classGrade: string;
  birthDate: string;
  nationalId?: string;
  siblingOrder?: string;
  address: string;
  fatherName?: string;
  fatherAlive?: string;
  fatherEducation?: string;
  fatherJob?: string;
  fatherPhone?: string;
  fatherDeathInfo?: string;
  motherName?: string;
  motherAlive?: string;
  motherEducation?: string;
  motherJob?: string;
  motherPhone?: string;
  motherDeathInfo?: string;
  livesWith?: string;
  altPhone?: string;
  housingType?: string;
  isEmployed?: string;
  employmentDetails?: string;
  chronicDisease?: string;
  diseaseDetails?: string;
  seesSpecialist?: string;
  specialistDetails?: string;
  mentalState?: string;
  academicDelay?: string;
  talents?: string;
  createdAt: string;
}

// Define the 9 official records representing the Iraqi School Counselor Workflow
export type RecordType =
  | 'HEALTH_STATUS' // سجل الحالة الصحية
  | 'SPECIAL_CASES' // سجل الحالات الخاصة
  | 'GROUP_INDIVIDUAL' // سجل الإرشاد الجمعي والفردي
  | 'BEREAVED_STUDENTS' // سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)
  | 'CASE_STUDY' // سجل دراسة الحالة
  | 'HEALTH_KEY_GUIDE' // سجل الدليل (المفتاح) لدراسة الحالة
  | 'DAILY_ACTIVITY_PLAN'; // سجل النشاط اليومي والخطة

export interface DailyActivityItem {
  id: string;
  activity: string;
  location: string;
  details: string;
  displayOrder: number;
}

export interface CounselingRecord {
  id: string;
  studentId?: string; // Optional (some records are individual, others group/general)
  studentName?: string; // Denormalized for easy listing
  recordType: RecordType;
  date: string;
  title: string;
  description: string; // تفاصيل الحالة أو الموقف الإرشادي
  actionTaken: string; // الإجراء الإرشادي المتخذ من قبل المرشد
  recommendations: string; // التوصيات والمتابعة
  status: 'COMPLETED' | 'ONGOING' | 'ARCHIVED';
  updatedAt: string;
  day?: string; // For DAILY_ACTIVITY_PLAN
  activities?: DailyActivityItem[]; // For DAILY_ACTIVITY_PLAN
}

export interface WordTemplate {
  id: string;
  name: string; // اسم النموذج الرسمي (مثال: استمارة بحث حالة فردية)
  description: string;
  placeholders: string[]; // الكلمات الدلالية المستبدلة (مثال: {اسم_الطالب}، {الصف}...)
  content: string; // HTML format or markdown structure representing the template document
  category: 'MINISTRY' | 'INTERNAL' | 'PARENTS';
}

export interface GeneratedDocument {
  id: string;
  studentId: string;
  studentName: string;
  templateId: string;
  templateName: string;
  content: string; // Customised content generated with placeholders filled in
  createdAt: string;
}

export interface StudentAttachment {
  id: string;
  studentId: string;
  studentName: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadDate: string;
  comments?: string;
  dataUrl?: string; // Simulated blob storage for the file in JSON
}

export interface AppSettings {
  saveFolder: string;
  autoBackupEnabled: boolean;
  backupIntervalMinutes: number;
  googleDriveLinked: boolean;
  googleDriveAccountEmail?: string;
  appColorTheme: string; // Light theme color variations
}

// ── Backup & Sync Types ──────────────────────────────────────────────

export type BackupDestination = 'LOCAL' | 'GOOGLE_DRIVE';

export interface BackupHistoryEntry {
  id: string;
  date: string; // ISO
  type: BackupDestination;
  size: string; // human-readable e.g. "4.2 MB"
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  fileName: string;
  errorMessage?: string;
}

export interface BackupSettings {
  localFolder: string;
  maxLocalBackups: number;
  deleteOldBackups: boolean;
  compressBackups: boolean;
  includeAttachments: boolean;
  includeTemplates: boolean;
  includeSettings: boolean;
  autoBackupDaily: boolean;
  autoBackupWeekly: boolean;
  autoBackupMonthly: boolean;
  autoCloudBackup: boolean;
  encryptionEnabled: boolean;
  backupPassword: string;
  lastLocalBackup?: string; // ISO
  lastCloudBackup?: string; // ISO
  backupHistory: BackupHistoryEntry[];
}

export interface GoogleDriveTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  expiry_date: number;
  scope: string;
}

export interface GoogleDriveAccount {
  connected: boolean;
  email?: string;
  tokens?: GoogleDriveTokens;
  folderId?: string; // "Murshid Backups" folder ID
}

// ── Counseling Session Types (Individual & Group) ────────────────────

export interface CounselingSession {
  id: string;
  sessionNumber: string; // GN-000001

  // Form fields
  sessionTitle: string;          // عنوان الجلسة الإرشادية
  generalObjective: string;      // الهدف العام
  specificObjectives: string;    // الأهداف الخاصة
  activitiesStrategies: string;  // الأنشطة والاستراتيجيات الإرشادية
  beneficiary: string;           // المستفيد من الجلسة الإرشادية
  beneficiaryOther: string;      // أخرى (نص إضافي)
  sessionDate: string;           // تاريخ الجلسة
  activity: string;              // النشاط
  evaluation: string;            // التقويم والمتابعة

  createdAt: string;
  updatedAt: string;
}

// ── Special Cases Types ─────────────────────────────────────────────

export type SpecialCaseCategory = 'GIFTED_TALENTED' | 'ACADEMIC_DELAYED' | 'ABSENT';

export const SPECIAL_CASE_CATEGORY_LABELS: Record<SpecialCaseCategory, string> = {
  GIFTED_TALENTED: 'المتفوقون والموهوبون',
  ACADEMIC_DELAYED: 'المتأخرون دراسياً',
  ABSENT: 'الغائبون',
};

export interface SpecialCaseRecord {
  id: string;
  recordNumber: string; // SC-000001
  category: SpecialCaseCategory;

  // Student fields (auto-filled from database)
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  guardianPhone: string;

  // Multi-student support (GIFTED_TALENTED can include several students in one record)
  studentIds?: string[];
  studentNames?: string[];

  // Gifted/Talented form fields
  address: string;
  talentType: string;          // نوع التفوق أو الموهبة
  talentTypeOther: string;     // أخرى (نص إضافي)
  counselorServices: string;   // الخدمات التي قدمها المرشد التربوي
  careerGuidance: string;      // التوجيه المهني
  studentProblems: string;     // المشكلات التي يعاني منها الطالب
  peerBehavior: string;        // السلوك التوافقي للطالب مع أقرانه

  // Academic Delay form fields
  delayType: string;           // نوع التأخر
  delayTypeOther: string;      // أخرى (نص إضافي)
  delayReason: string;         // سبب التأخر

  // Absent form fields
  absenceType: string;         // نوع الغياب (هروب، تأخر عن الدوام، غياب بعذر، غياب بدون عذر)
  absenceDays: number;         // عدد أيام الغياب

  // Shared fields (used by all categories)
  procedures: string;          // الإجراءات
  evaluation: string;          // التقويم والمتابعة

  createdAt: string;
  updatedAt: string;
}

// ── Case Study Types ─────────────────────────────────────────────────

export interface CaseReview {
  id: string;
  date: string;
  day: string;
  observation: string;
}

export interface TreatmentGoal {
  id: string;
  goal: string;
  actions: string;
}

export interface CaseFollowUp {
  id: string;
  date: string;
  day: string;
  observation: string;
  recommendation: string;
  progress: 'IMPROVED_HIGH' | 'IMPROVED_MEDIUM' | 'NO_CHANGE' | 'DETERIORATED';
}

export interface CaseClosure {
  closed: boolean;
  closedDate: string;
  outcome: 'RESOLVED' | 'PARTIAL' | 'REFERRAL' | 'CLOSED_FILE' | 'OTHER';
  closingNotes: string;
}

export interface CaseStudy {
  id: string;
  caseNumber: string; // CS-000001
  studentId: string;
  studentName: string;
  createdAt: string;
  updatedAt: string;

  // Tab 1 - Case Info
  referralSource: string; // المعلم، الإدارة، ولي الأمر، الطالب، المرشد، أخرى
  caseDate: string;
  caseDay: string;
  caseTypes: string[]; // ضعف دراسي، مشاكل سلوكية، etc.
  familyCount: string; // عدد أفراد الأسرة
  siblingsCount: string; // عدد الإخوة
  birthOrder: string; // ترتيب الطالب بين إخوته
  livesWith: string; // يعيش الطالب مع

  // Tab 2 - Reviews
  reviews: CaseReview[];

  // Tab 3 - Treatment Goals
  treatmentGoals: TreatmentGoal[];

  // Tab 4 - Follow-ups
  followUps: CaseFollowUp[];

  // Tab 5 - Closure
  closure: CaseClosure;

    // Manual entry fields
    studentCode?: string;        // رمز الطالب (يدوي)
    parentCode?: string;         // رمز ولي الأمر (يدوي)
    fatherJobTitle?: string;     // مهنة الأب (يدوي)
    sessionsTaken?: string;      // عدد الجلسات التي استغرقتها الحالة (يدوي)

    // Auto-computed
    status: 'OPEN' | 'CLOSED';
    totalSessions: number;
    lastFollowUp?: string;
  }

// ── Health Record Types ──────────────────────────────────────────────

export interface HealthRecord {
  id: string;
  recordNumber: string; // HR-000001

  // Student fields (auto-filled from database)
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  guardianPhone: string;

  // Health form fields
  address: string;                // العنوان
  diseaseType: string;            // نوع المرض
  diseaseTypeOther: string;       // أخرى (نص إضافي)
  diseaseDescription: string;     // مدى تطور المرض وتأثيره على الطالب
  procedures: string;             // الإجراءات المتخذة

  createdAt: string;
  updatedAt: string;
}

// ── Parent Loss Record Types ─────────────────────────────────────────

export interface ParentLossRecord {
  id: string;
  recordNumber: string; // PL-000001

  // Student fields (auto-filled from database)
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  guardianPhone: string;

  // Form fields
  address: string;                    // العنوان
  lossType: string;                   // نوع الفقدان
  lossTypeOther: string;              // أخرى (نص إضافي)
  livesWith: string;                  // الطالب يعيش مع
  livesWithOther: string;             // أخرى (نص إضافي)
  guardianName: string;               // اسم ولي الأمر
  guardianPhoneField: string;         // رقم الهاتف
  academicLevelBeforeLoss: string;    // المستوى العلمي قبل الفقدان
  academicLevelAfterLoss: string;     // المستوى العلمي بعد الفقدان
  studentBehavior: string;            // سلوك الطالب ومواظبته
  additionalNotes: string;            // ملاحظات إضافية

  createdAt: string;
  updatedAt: string;
}
