/**
 * Record file import.
 *
 * Reads a DOCX or Excel file and turns its label/value content into one of the
 * counselling record types. Files are not assumed to follow a fixed template:
 * every recognized Arabic label is mapped to the matching record field, and
 * missing fields fall back to safe defaults so a record is never left invalid.
 */

import JSZip from 'jszip';
import { readExcel, normalizeHeader } from './excelImporter';
import type {
  CaseStudy,
  CounselingRecord,
  CounselingSession,
  HealthRecord,
  ParentLossRecord,
  RecordType,
  SpecialCaseCategory,
  SpecialCaseRecord,
  Student,
} from '../types';

export type RecordImportKind =
  | 'health'
  | 'parentLoss'
  | 'caseStudy'
  | 'session'
  | 'specialCase'
  | 'counseling';

export type LabelMap = Record<string, string>;

export interface RecordImportResult {
  kind: RecordImportKind;
  records: Array<
    | HealthRecord
    | ParentLossRecord
    | CaseStudy
    | CounselingSession
    | SpecialCaseRecord
    | CounselingRecord
  >;
  recognized: number;
  totalFields: number;
  warnings: string[];
}

const uid = () => `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

// ── Parsing ──────────────────────────────────────────────────────────

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Extract the document's paragraphs and table cells as plain text lines. */
async function readDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('الملف ليس مستند Word صالح.');
  let xml = await doc.async('string');
  xml = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n');
  const text = decodeXmlEntities(xml.replace(/<[^>]+>/g, ''));
  return text;
}

/** Turn "label: value" lines (or tab-separated table rows) into a map. */
function textToLabelMap(text: string): LabelMap {
  const map: LabelMap = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t+/g, '\t').trim();
    if (!line) continue;

    const colon = line.indexOf(':');
    if (colon > 0) {
      const label = clean(line.slice(0, colon));
      const value = clean(line.slice(colon + 1));
      if (label) map[label] = value;
      continue;
    }

    const cells = line.split('\t').map(clean).filter(Boolean);
    for (let i = 0; i < cells.length - 1; i += 2) {
      map[cells[i]] = cells[i + 1];
    }
  }
  return map;
}

/** Read any supported file into one label map per record. */
export async function parseRecordFile(file: File): Promise<LabelMap[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    return [textToLabelMap(await readDocxText(file))];
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const data = await readExcel(file);
    const headers = data.headers.map(clean).filter(Boolean);
    if (headers.length === 0) throw new Error('لم يتم العثور على أعمدة في الملف.');

    // A two-column sheet is usually one record written as label/value rows.
    if (headers.length === 2 && data.rows.length > 2) {
      const map: LabelMap = {};
      for (const row of data.rows) {
        const values = Object.values(row);
        const label = clean(values[0]);
        if (label) map[label] = clean(values[1]);
      }
      return [map];
    }

    return data.rows.map((row) => {
      const map: LabelMap = {};
      for (const [label, value] of Object.entries(row)) map[clean(label)] = clean(value);
      return map;
    });
  }

  throw new Error('صيغة الملف غير مدعومة. استخدم DOCX أو XLSX.');
}

// ── Field mapping ────────────────────────────────────────────────────

type FieldSpec = { key: string; labels: string[] };

function readFields(map: LabelMap, specs: FieldSpec[]): { values: Record<string, string>; recognized: number } {
  const normalized = new Map<string, string>();
  for (const [label, value] of Object.entries(map)) {
    normalized.set(normalizeHeader(label), value);
  }

  const values: Record<string, string> = {};
  let recognized = 0;
  for (const spec of specs) {
    let value = '';
    for (const label of spec.labels) {
      const found = normalized.get(normalizeHeader(label));
      if (found !== undefined && found !== '') {
        value = found;
        break;
      }
    }
    values[spec.key] = value;
    if (value) recognized += 1;
  }
  return { values, recognized };
}

function findStudent(students: Student[], name: string): Student | undefined {
  const needle = normalizeHeader(name);
  if (!needle) return undefined;
  return students.find((s) => normalizeHeader(s.fullName) === needle);
}

const STUDENT_FIELDS: FieldSpec[] = [
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب', 'الاسم', 'اسم الطالبة'] },
  { key: 'grade', labels: ['الصف', 'المرحلة', 'الصف الدراسي'] },
  { key: 'section', labels: ['الشعبة', 'القسم', 'الصف / الشعبة'] },
  { key: 'guardianPhone', labels: ['هاتف ولي الأمر', 'رقم هاتف ولي الأمر', 'هاتف الأب', 'الهاتف', 'رقم الهاتف'] },
  { key: 'address', labels: ['العنوان', 'عنوان السكن', 'السكن'] },
];

const HEALTH_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'diseaseType', labels: ['نوع المرض', 'المرض', 'الحالة الصحية'] },
  { key: 'diseaseTypeOther', labels: ['أخرى', 'مرض آخر'] },
  { key: 'diseaseDescription', labels: ['مدى تطور المرض وتأثيره على الطالب', 'وصف المرض', 'تفاصيل المرض', 'تأثير المرض'] },
  { key: 'procedures', labels: ['الإجراءات المتخذة', 'الإجراءات', 'الإجراء المتخذ'] },
];

const PARENT_LOSS_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'lossType', labels: ['نوع الفقدان', 'الفقدان'] },
  { key: 'lossTypeOther', labels: ['أخرى', 'فقدان آخر'] },
  { key: 'livesWith', labels: ['يعيش مع', 'الطالب يعيش مع'] },
  { key: 'livesWithOther', labels: ['أخرى (يعيش مع)'] },
  { key: 'guardianName', labels: ['اسم ولي الأمر', 'ولي الأمر'] },
  { key: 'guardianPhoneField', labels: ['رقم الهاتف', 'هاتف ولي الأمر'] },
  { key: 'academicLevelBeforeLoss', labels: ['المستوى العلمي قبل الفقدان'] },
  { key: 'academicLevelAfterLoss', labels: ['المستوى العلمي بعد الفقدان'] },
  { key: 'studentBehavior', labels: ['سلوك الطالب ومواظبته', 'سلوك الطالب', 'المواظبة'] },
  { key: 'additionalNotes', labels: ['ملاحظات إضافية', 'ملاحظات'] },
];

const SESSION_SPECS: FieldSpec[] = [
  { key: 'sessionNumber', labels: ['رقم الجلسة', 'تسلسل الجلسة'] },
  { key: 'sessionTitle', labels: ['عنوان الجلسة الإرشادية', 'عنوان الجلسة'] },
  { key: 'generalObjective', labels: ['الهدف العام'] },
  { key: 'specificObjectives', labels: ['الأهداف الخاصة', 'الأهداف'] },
  { key: 'activitiesStrategies', labels: ['الأنشطة والاستراتيجيات الإرشادية', 'الأنشطة', 'الاستراتيجيات'] },
  { key: 'beneficiary', labels: ['المستفيد من الجلسة الإرشادية', 'المستفيد'] },
  { key: 'beneficiaryOther', labels: ['أخرى'] },
  { key: 'sessionDate', labels: ['تاريخ الجلسة', 'التاريخ'] },
  { key: 'activity', labels: ['النشاط'] },
  { key: 'evaluation', labels: ['التقويم والمتابعة', 'التقويم'] },
];

const CASE_STUDY_SPECS: FieldSpec[] = [
  { key: 'caseNumber', labels: ['رقم الحالة', 'رقم دراسة الحالة'] },
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب'] },
  { key: 'referralSource', labels: ['مصدر الإحالة', 'جهة الإحالة'] },
  { key: 'caseDate', labels: ['تاريخ الحالة', 'التاريخ'] },
  { key: 'caseTypes', labels: ['نوع الحالة', 'أنواع الحالة', 'المشكلة'] },
  { key: 'familyCount', labels: ['عدد أفراد الأسرة'] },
  { key: 'siblingsCount', labels: ['عدد الإخوة'] },
  { key: 'birthOrder', labels: ['ترتيب الطالب بين إخوته', 'الترتيب بين الإخوة'] },
  { key: 'livesWith', labels: ['يعيش الطالب مع', 'يعيش مع'] },
  { key: 'studentCode', labels: ['رمز الطالب'] },
  { key: 'parentCode', labels: ['رمز ولي الأمر'] },
  { key: 'fatherJobTitle', labels: ['مهنة الأب'] },
  { key: 'sessionsTaken', labels: ['عدد الجلسات', 'عدد الجلسات التي استغرقتها الحالة'] },
];

const SPECIAL_CASE_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'talentType', labels: ['نوع التفوق أو الموهبة', 'نوع الموهبة', 'الموهبة'] },
  { key: 'talentTypeOther', labels: ['أخرى (الموهبة)'] },
  { key: 'counselorServices', labels: ['الخدمات التي قدمها المرشد التربوي', 'الخدمات المقدمة'] },
  { key: 'careerGuidance', labels: ['التوجيه المهني'] },
  { key: 'studentProblems', labels: ['المشكلات التي يعاني منها الطالب', 'المشكلات'] },
  { key: 'peerBehavior', labels: ['السلوك التوافقي للطالب مع أقرانه', 'السلوك مع الأقران'] },
  { key: 'delayType', labels: ['نوع التأخر'] },
  { key: 'delayTypeOther', labels: ['أخرى (التأخر)'] },
  { key: 'delayReason', labels: ['سبب التأخر'] },
  { key: 'absenceType', labels: ['نوع الغياب'] },
  { key: 'absenceDays', labels: ['عدد أيام الغياب'] },
  { key: 'procedures', labels: ['الإجراءات', 'الإجراءات المتخذة'] },
  { key: 'evaluation', labels: ['التقويم والمتابعة', 'التقويم'] },
];

const COUNSELING_SPECS: FieldSpec[] = [
  { key: 'title', labels: ['عنوان التدوين', 'العنوان', 'الموضوع'] },
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب'] },
  { key: 'date', labels: ['التاريخ', 'تاريخ التدوين'] },
  { key: 'description', labels: ['تفاصيل الحالة أو الموقف الإرشادي', 'الوصف', 'تفاصيل الحالة', 'الموقف'] },
  { key: 'actionTaken', labels: ['الإجراء الإرشادي المتخذ من قبل المرشد', 'الإجراء المتخذ', 'الإجراء'] },
  { key: 'recommendations', labels: ['التوصيات والمتابعة', 'التوصيات'] },
];

// ── Record builders ──────────────────────────────────────────────────

export function buildRecords(
  kind: RecordImportKind,
  maps: LabelMap[],
  options: { students: Student[]; category?: SpecialCaseCategory; recordType?: RecordType }
): RecordImportResult {
  const specs =
    kind === 'health' ? HEALTH_SPECS
    : kind === 'parentLoss' ? PARENT_LOSS_SPECS
    : kind === 'session' ? SESSION_SPECS
    : kind === 'caseStudy' ? CASE_STUDY_SPECS
    : kind === 'specialCase' ? SPECIAL_CASE_SPECS
    : COUNSELING_SPECS;

  const records: RecordImportResult['records'] = [];
  let recognized = 0;
  let totalFields = 0;
  const warnings: string[] = [];
  const stamp = Date.now();

  maps.forEach((map, index) => {
    const { values, recognized: hits } = readFields(map, specs);
    recognized += hits;
    totalFields += specs.length;

    const student = findStudent(options.students, values.studentName || '');
    const studentId = student?.id || '';
    const studentName = student?.fullName || values.studentName || `سجل مستورد ${index + 1}`;
    const grade = student?.classGrade || values.grade || '';
    const section = student?.section || values.section || '';
    const guardianPhone = values.guardianPhone || '';
    const address = values.address || '';
    const createdAt = nowIso();
    const suffix = `${stamp}_${index + 1}`;

    if (!student && values.studentName) {
      warnings.push(`لم يتم العثور على الطالب "${values.studentName}" في قائمة الطلبة — تم حفظ الاسم كما ورد.`);
    }

    switch (kind) {
      case 'health':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `HR-IMP-${suffix}`,
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          address,
          diseaseType: values.diseaseType || '',
          diseaseTypeOther: values.diseaseTypeOther || '',
          diseaseDescription: values.diseaseDescription || '',
          procedures: values.procedures || '',
          createdAt,
          updatedAt: createdAt,
        } as HealthRecord);
        break;

      case 'parentLoss':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `PL-IMP-${suffix}`,
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          address,
          lossType: values.lossType || '',
          lossTypeOther: values.lossTypeOther || '',
          livesWith: values.livesWith || '',
          livesWithOther: values.livesWithOther || '',
          guardianName: values.guardianName || '',
          guardianPhoneField: values.guardianPhoneField || guardianPhone,
          academicLevelBeforeLoss: values.academicLevelBeforeLoss || '',
          academicLevelAfterLoss: values.academicLevelAfterLoss || '',
          studentBehavior: values.studentBehavior || '',
          additionalNotes: values.additionalNotes || '',
          createdAt,
          updatedAt: createdAt,
        } as ParentLossRecord);
        break;

      case 'session':
        records.push({
          id: uid(),
          sessionNumber: values.sessionNumber || `GN-IMP-${suffix}`,
          sessionTitle: values.sessionTitle || '',
          generalObjective: values.generalObjective || '',
          specificObjectives: values.specificObjectives || '',
          activitiesStrategies: values.activitiesStrategies || '',
          beneficiary: values.beneficiary || '',
          beneficiaryOther: values.beneficiaryOther || '',
          sessionDate: values.sessionDate || '',
          activity: values.activity || '',
          evaluation: values.evaluation || '',
          createdAt,
          updatedAt: createdAt,
        } as CounselingSession);
        break;

      case 'caseStudy':
        records.push({
          id: uid(),
          caseNumber: values.caseNumber || `CS-IMP-${suffix}`,
          studentId,
          studentName,
          createdAt,
          updatedAt: createdAt,
          referralSource: values.referralSource || '',
          caseDate: values.caseDate || '',
          caseDay: '',
          caseTypes: values.caseTypes ? values.caseTypes.split(/[،,؛;]+/).map(clean).filter(Boolean) : [],
          familyCount: values.familyCount || '',
          siblingsCount: values.siblingsCount || '',
          birthOrder: values.birthOrder || '',
          livesWith: values.livesWith || '',
          reviews: [],
          treatmentGoals: [],
          followUps: [],
          closure: {
            closed: false,
            closedDate: '',
            outcome: 'OTHER',
            closingNotes: '',
          },
          studentCode: values.studentCode || '',
          parentCode: values.parentCode || '',
          fatherJobTitle: values.fatherJobTitle || '',
          sessionsTaken: values.sessionsTaken || '',
          status: 'OPEN',
          totalSessions: Number(values.sessionsTaken) || 0,
        } as CaseStudy);
        break;

      case 'specialCase':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `SC-IMP-${suffix}`,
          category: options.category || 'GIFTED_TALENTED',
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          studentIds: student ? [student.id] : [],
          studentNames: [studentName],
          address,
          talentType: values.talentType || '',
          talentTypeOther: values.talentTypeOther || '',
          counselorServices: values.counselorServices || '',
          careerGuidance: values.careerGuidance || '',
          studentProblems: values.studentProblems || '',
          peerBehavior: values.peerBehavior || '',
          delayType: values.delayType || '',
          delayTypeOther: values.delayTypeOther || '',
          delayReason: values.delayReason || '',
          absenceType: values.absenceType || '',
          absenceDays: Number(values.absenceDays) || 0,
          procedures: values.procedures || '',
          evaluation: values.evaluation || '',
          createdAt,
          updatedAt: createdAt,
        } as SpecialCaseRecord);
        break;

      case 'counseling':
      default:
        records.push({
          id: uid(),
          studentId,
          studentName,
          recordType: options.recordType || ('DAILY_ACTIVITY_PLAN' as RecordType),
          date: values.date || new Date().toISOString().slice(0, 10),
          title: values.title || `تدوين مستورد ${index + 1}`,
          description: values.description || '',
          actionTaken: values.actionTaken || '',
          recommendations: values.recommendations || '',
          status: 'ONGOING',
          updatedAt: createdAt,
        } as CounselingRecord);
        break;
    }
  });

  return { kind, records, recognized, totalFields, warnings };
}
