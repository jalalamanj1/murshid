/**
 * Centralized list of internal/system fields that must NEVER appear in
 * end-user Excel (or other) exports. These are database keys, UUIDs,
 * timestamps and app-only metadata — not meaningful to the user.
 *
 * To exclude a new internal field later, just add its key here.
 * Every exporter imports FIELD_LABELS/EXCLUDED_EXPORT_FIELDS so the
 * exclusion applies automatically across all record types.
 */

export const EXCLUDED_EXPORT_FIELDS: string[] = [
  // Primary keys / internal identifiers
  'id',
  'studentId',
  'studentIds',
  'templateId',
  'recordType',
  // Timestamps (internal metadata)
  'createdAt',
  'updatedAt',
  // "Other" free-text fallbacks that duplicate the chosen value in exports
  'livesWithOther',
  'lossTypeOther',
  // Any other app-only metadata
  'created_at',
  'updated_at',
];

const EXCLUDED_SET = new Set(EXCLUDED_EXPORT_FIELDS);

/** True if the field key is an internal/system field that must be excluded. */
export function isExcludedField(key: string): boolean {
  if (EXCLUDED_SET.has(key)) return true;
  // Heuristic: anything that looks like an internal UUID / system key.
  if (/^(__|_|\$)/.test(key)) return true;
  return false;
}

/**
 * Arabic column labels for common user-facing fields.
 * Add new entries here so exporters get friendly headers automatically.
 */
export const FIELD_LABELS: Record<string, string> = {
  recordNumber: 'رقم السجل',
  caseNumber: 'رقم الحالة',
  sessionNumber: 'رقم الجلسة',
  studentName: 'اسم الطالب',
  studentCode: 'رمز الطالب',
  parentCode: 'رمز ولي الأمر',
  fatherJobTitle: 'مهنة الأب',
  sessionsTaken: 'عدد الجلسات المنفذة',
  totalSessions: 'إجمالي الجلسات',
  lastFollowUp: 'آخر متابعة',
  dateofbirth: 'تاريخ الميلاد',
  status: 'الحالة',
  grade: 'الصف',
  section: 'الشعبة',
  guardianPhone: 'هاتف ولي الأمر',
  referralSource: 'مصدر الإحالة',
  caseDate: 'تاريخ الحالة',
  caseDay: 'يوم التسجيل',
  familyCount: 'عدد أفراد الأسرة',
  siblingsCount: 'عدد الإخوة',
  birthOrder: 'الترتيب بين الإخوة',
  livesWith: 'السكن مع',
  address: 'العنوان',
  diseaseType: 'نوع المرض',
  diseaseTypeOther: 'نوع المرض (أخرى)',
  diseaseDescription: 'وصف المرض',
  lossType: 'نوع الفقد',
  guardianName: 'اسم الوصي',
  guardianPhoneField: 'هاتف الوصي',
  academicLevelBeforeLoss: 'المستوى قبل الفقد',
  academicLevelAfterLoss: 'المستوى بعد الفقد',
  studentBehavior: 'سلوك الطالب',
  additionalNotes: 'ملاحظات إضافية',
  sessionTitle: 'عنوان الجلسة',
  generalObjective: 'الهدف العام',
  specificObjectives: 'الأهداف الخاصة',
  activitiesStrategies: 'الأنشطة والاستراتيجيات',
  beneficiary: 'المستفيد',
  beneficiaryOther: 'المستفيد (أخرى)',
  sessionDate: 'تاريخ الجلسة',
  activity: 'النشاط',
  evaluation: 'التقويم والمتابعة',
  talentType: 'نوع التفوق أو الموهبة',
  talentTypeOther: 'نوع التفوق (أخرى)',
  counselorServices: 'خدمات المرشد',
  careerGuidance: 'التوجيه المهني',
  studentProblems: 'المشكلات',
  peerBehavior: 'السلوك التوافقي',
  delayType: 'نوع التأخر',
  delayTypeOther: 'نوع التأخر (أخرى)',
  delayReason: 'سبب التأخر',
  absenceType: 'نوع الغياب',
  absenceDays: 'عدد أيام الغياب',
  procedures: 'الإجراءات',
  category: 'الفئة',
};
