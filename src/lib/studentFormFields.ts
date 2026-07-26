/**
 * Student Registration form field definitions.
 *
 * Labels are the EXACT official Excel template headers.
 * Matching uses strict normalized equality only — no fuzzy logic.
 *
 * For fields where the template uses a "1" suffix to distinguish
 * father vs mother (e.g. "المهنة ومكان العمل" vs "المهنة ومكان العمل1"),
 * the "1" variant is included as a keyword for the mother field.
 */
import { FormFieldDef } from './excelImporter';

export const STUDENT_FORM_FIELDS: FormFieldDef[] = [
  { key: 'fullName',          label: 'إسم الطالب الرباعي واللقب',         required: true },
  { key: 'classGrade',        label: 'الصف',                               required: true },
  { key: 'birthDate',         label: 'تاريخ الميلاد',                      required: false },
  { key: 'nationalId',        label: 'رقم البطاقة الموحدة / الجنسية',      required: false },
  { key: 'siblingOrder',      label: 'ترتيب التلميذ بين إخوانه وأخواته',   required: false },
  { key: 'address',           label: 'العنوان',                             required: false },
  { key: 'fatherName',        label: 'إسم الأب الثلاثي',                   required: false },
  { key: 'fatherAlive',       label: 'هل الأب على قيد الحياة؟',             required: false },
  { key: 'fatherEducation',   label: 'التحصيل الدراسي للأب',                required: false },
  { key: 'fatherJob',         label: 'المهنة ومكان العمل',                  required: false },
  { key: 'fatherPhone',       label: 'رقم هاتف الأب',                       required: false },
  { key: 'fatherDeathInfo',   label: 'سنة الوفاة و السبب؟',                 required: false },
  { key: 'motherName',        label: 'إسم الأم الثلاثي',                   required: false },
  { key: 'motherAlive',       label: 'هل الأم على قيد الحياة؟',             required: false },
  { key: 'motherEducation',   label: 'التحصيل الدراسي للأم',                required: false },
  { key: 'motherJob',         label: 'المهنة ومكان العمل1',                 required: false },
  { key: 'motherPhone',       label: 'رقم هاتف الأم',                       required: false },
  { key: 'motherDeathInfo',   label: 'سنة الوفاة والسبب؟',                  required: false },
  { key: 'livesWith',         label: 'يعيش الطالب مع',                      required: false },
  { key: 'altPhone',          label: 'إذا كان الطالب يعيش مع أحد آخر غير والديه يرجى إضافة رقم الهاتف', required: false },
  { key: 'housingType',       label: 'نوع السكن',                           required: false },
  { key: 'isEmployed',        label: 'هل الطالب يعمل؟',                     required: false },
  { key: 'employmentDetails', label: 'نوع العمل ومكانه؟',                    required: false },
  { key: 'chronicDisease',    label: 'هل يعاني الطالب من مرض مزمن؟',        required: false },
  { key: 'diseaseDetails',    label: 'ما هو المرض ومنذ متى؟',                required: false },
  { key: 'seesSpecialist',    label: 'هل يراجع الطالب طبيب إختصاص؟',        required: false },
  { key: 'specialistDetails', label: 'إسم الطبيب وإختصاصه الدقيق',         required: false },
  { key: 'mentalState',       label: 'ما الحالة النفسية / الجسدية التي يعاني منها الطالب؟ مثال (انطواء - انعزال - ضعف في السمع - ضعف في النظر) إن وجدت', required: false },
  { key: 'academicDelay',     label: 'هل توجد سنوات رسوب أو تأخير في الدراسة؟ يرجى ذكرها مع السبب إن وجدت', required: false },
  { key: 'talents',           label: 'هل يملك الطالب مواهب؟ يرجى ذكرها.',   required: false },
];

export const STUDENT_FIELD_KEYS: (keyof import('../types').Student)[] = [
  'fullName', 'classGrade', 'birthDate', 'nationalId', 'siblingOrder', 'address',
  'fatherName', 'fatherAlive', 'fatherEducation', 'fatherJob', 'fatherPhone', 'fatherDeathInfo',
  'motherName', 'motherAlive', 'motherEducation', 'motherJob', 'motherPhone', 'motherDeathInfo',
  'livesWith', 'altPhone', 'housingType', 'isEmployed', 'employmentDetails',
  'chronicDisease', 'diseaseDetails', 'seesSpecialist', 'specialistDetails',
  'mentalState', 'academicDelay', 'talents',
];
