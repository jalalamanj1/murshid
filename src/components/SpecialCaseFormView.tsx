/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SpecialCaseFormView — Multi-category form for Special Cases.
 * GIFTED_TALENTED: student picker + 9 fields (talent type, services, career, problems, peer behavior, procedures, evaluation)
 * ACADEMIC_DELAYED: student picker + 4 fields (delay type, reason, procedures, evaluation)
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Save, FilePlus, Search, XCircle, AlertTriangle, User,
  Sparkles, X, GraduationCap, AlertCircle, UserX,
} from 'lucide-react';
import { SpecialCaseRecord, SpecialCaseCategory, SPECIAL_CASE_CATEGORY_LABELS, Student } from '../types';
import { getNextSpecialCaseNumber } from '../lib/storage';
import { toArabicDigits } from '../lib/format';

const TALENT_OPTIONS = [
  'تفوق دراسي',
  'موهبة فنية',
  'موهبة رياضية',
  'موهبة أدبية',
  'موهبة علمية',
  'موهبة تقنية',
  'قيادية',
  'أخرى',
];

const DELAY_OPTIONS = [
  'تأخر دراسي عام',
  'ضعف في القراءة',
  'ضعف في الكتابة',
  'ضعف في الرياضيات',
  'صعوبات تعلم',
  'ضعف التحصيل',
  'ضعف التركيز',
  'أخرى',
];

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7); }

interface Props {
  students: Student[];
  category: SpecialCaseCategory;
  existing?: SpecialCaseRecord;
  onSave: (r: SpecialCaseRecord) => void;
  onSaveAndNew: (r: SpecialCaseRecord) => void;
  onCancel: () => void;
}

export default function SpecialCaseFormView({
  students, category, existing, onSave, onSaveAndNew, onCancel,
}: Props) {
  const isEdit = !!existing;

  // Student picker state
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  // For GIFTED_TALENTED: one record can include several students.
  const [selectedStudents, setSelectedStudents] = useState<Student[]>(
    existing?.studentIds
      ? students.filter(s => existing.studentIds!.includes(s.id))
      : (existing?.studentId ? students.filter(s => s.id === existing.studentId) : [])
  );
  const allowMultiple = category === 'GIFTED_TALENTED';

  // Derived single-student fields (first selected) for listing / other categories
  const studentId = selectedStudents[0]?.id || '';
  const studentName = selectedStudents[0]?.fullName || '';
  const grade = selectedStudents[0]?.classGrade || '';
  const section = selectedStudents[0]?.section || '';
  const guardianPhone = selectedStudents[0]?.parentPhone || '';

  // Gifted/Talented fields
  const [address, setAddress] = useState(existing?.address || '');
  const [talentType, setTalentType] = useState(existing?.talentType || '');
  const [talentTypeOther, setTalentTypeOther] = useState(existing?.talentTypeOther || '');
  const [counselorServices, setCounselorServices] = useState(existing?.counselorServices || '');
  const [careerGuidance, setCareerGuidance] = useState(existing?.careerGuidance || '');
  const [studentProblems, setStudentProblems] = useState(existing?.studentProblems || '');
  const [peerBehavior, setPeerBehavior] = useState(existing?.peerBehavior || '');

  // Academic Delay fields
  const [delayType, setDelayType] = useState(existing?.delayType || '');
  const [delayTypeOther, setDelayTypeOther] = useState(existing?.delayTypeOther || '');
  const [delayReason, setDelayReason] = useState(existing?.delayReason || '');

  // Absent fields
  const [absenceType, setAbsenceType] = useState(existing?.absenceType || '');
  const [absenceDays, setAbsenceDays] = useState<number>(existing?.absenceDays || 1);

  // Shared fields
  const [procedures, setProcedures] = useState(existing?.procedures || '');
  const [evaluation, setEvaluation] = useState(existing?.evaluation || '');

  const [error, setError] = useState('');

  // Filter students for picker
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.classGrade.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectStudent = (s: Student) => {
    if (allowMultiple) {
      if (!selectedStudents.some(x => x.id === s.id)) {
        setSelectedStudents(prev => [...prev, s]);
      }
    } else {
      setSelectedStudents([s]);
    }
    setShowStudentPicker(false);
    setStudentSearch('');
  };

  const clearStudent = () => {
    setSelectedStudents([]);
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const buildRecord = (): SpecialCaseRecord => ({
    id: existing?.id || uid(),
    recordNumber: existing?.recordNumber || getNextSpecialCaseNumber(),
    category,
    studentId,
    studentName,
    grade,
    section,
    guardianPhone,
    studentIds: allowMultiple ? selectedStudents.map(s => s.id) : (studentId ? [studentId] : []),
    studentNames: allowMultiple ? selectedStudents.map(s => s.fullName) : (studentName ? [studentName] : []),
    // Gifted fields
    address: category === 'GIFTED_TALENTED' ? address : '',
    talentType: category === 'GIFTED_TALENTED' ? talentType : '',
    talentTypeOther: category === 'GIFTED_TALENTED' ? talentTypeOther : '',
    counselorServices: category === 'GIFTED_TALENTED' ? counselorServices : '',
    careerGuidance: category === 'GIFTED_TALENTED' ? careerGuidance : '',
    studentProblems: category === 'GIFTED_TALENTED' ? studentProblems : '',
    peerBehavior: category === 'GIFTED_TALENTED' ? peerBehavior : '',
    // Academic Delay fields
    delayType: category === 'ACADEMIC_DELAYED' ? delayType : '',
    delayTypeOther: category === 'ACADEMIC_DELAYED' ? delayTypeOther : '',
    delayReason: category === 'ACADEMIC_DELAYED' ? delayReason : '',
    // Absent fields
    absenceType: category === 'ABSENT' ? absenceType : '',
    absenceDays: category === 'ABSENT' ? absenceDays : 0,
    // Shared
    procedures,
    evaluation,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const validate = (): boolean => {
    if (selectedStudents.length === 0) { setError('الرجاء اختيار طالب واحد على الأقل من قاعدة البيانات.'); return false; }
    if (category === 'GIFTED_TALENTED' && !talentType) {
      setError('الرجاء تحديد نوع التفوق أو الموهبة.'); return false;
    }
    if (category === 'ACADEMIC_DELAYED' && !delayType) {
      setError('الرجاء تحديد نوع التأخر.'); return false;
    }
    if (category === 'ABSENT' && !absenceType) {
      setError('الرجاء تحديد نوع الغياب.'); return false;
    }
    if (category === 'ABSENT' && (!absenceDays || absenceDays < 1)) {
      setError('الرجاء إدخال عدد أيام الغياب (1 على الأقل).'); return false;
    }
    setError('');
    return true;
  };

  const handleSave = () => { if (validate()) onSave(buildRecord()); };
  const handleSaveAndNew = () => { if (validate()) onSaveAndNew(buildRecord()); };

  const inputCls = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue dark:focus:border-blue-500 transition-colors resize-y";
  const labelCls = "text-[10px] font-black text-slate-700 dark:text-slate-200 block mb-1";

  const categoryLabel = SPECIAL_CASE_CATEGORY_LABELS[category];
  const FormIcon = category === 'GIFTED_TALENTED' ? Sparkles : category === 'ABSENT' ? UserX : AlertCircle;
  const formColor = category === 'GIFTED_TALENTED'
    ? 'text-office-blue dark:text-blue-400'
    : category === 'ABSENT'
      ? 'text-red-500 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-400';

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            {isEdit ? <GraduationCap className="w-5 h-5 text-office-blue dark:text-blue-400" /> : <FilePlus className="w-5 h-5 text-office-blue dark:text-blue-400" />}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isEdit ? `تعديل السجل ${existing.recordNumber}` : 'سجل حالة خاصة جديد'}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {!isEdit && `رقم السجل: ${getNextSpecialCaseNumber()} — `}
              الفئة: {categoryLabel}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{error}</span>
          <button onClick={() => setError('')} className="mr-auto cursor-pointer"><XCircle className="w-3.5 h-3.5 text-rose-400" /></button>
        </div>
      )}

      {/* Student Selection Card */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-office-blue dark:text-blue-400" />
          بيانات الطالب
        </h3>

        {selectedStudents.length > 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-2">
            {allowMultiple && (
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500">
                الطلاب المشمولون في السجل ({toArabicDigits(selectedStudents.length)})
              </p>
            )}
            <div className="space-y-2">
              {selectedStudents.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                    {[
                      { label: 'اسم الطالب', value: s.fullName },
                      { label: 'الصف', value: s.classGrade },
                      { label: 'الشعبة', value: s.section },
                    ].map(item => (
                      <div key={item.label}>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {allowMultiple ? (
                    <button onClick={() => removeStudent(s.id)}
                      className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer shrink-0" title="إزالة">
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={clearStudent}
                      className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {allowMultiple && (
              <button onClick={() => setShowStudentPicker(true)}
                className="w-full text-[10px] font-bold text-office-blue dark:text-blue-400 hover:underline cursor-pointer flex items-center justify-center gap-1">
                <Search className="w-3 h-3" /> إضافة طالب آخر
              </button>
            )}
            {!allowMultiple && (
              <button onClick={() => setShowStudentPicker(true)}
                className="text-[10px] font-bold text-office-blue dark:text-blue-400 hover:underline cursor-pointer">
                تغيير الطالب
              </button>
            )}
          </div>
        ) : (
          <button onClick={() => setShowStudentPicker(true)}
            className="w-full bg-office-blue/5 dark:bg-blue-950/20 hover:bg-office-blue/10 dark:hover:bg-blue-950/30 border-2 border-dashed border-office-blue/30 dark:border-blue-800 rounded-xl p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer">
            <Search className="w-6 h-6 text-office-blue dark:text-blue-400" />
            <span className="text-[11px] font-bold text-office-blue dark:text-blue-400">
              اضغط هنا لاختيار الطالب من قاعدة البيانات
            </span>
          </button>
        )}
      </div>

      {/* Student Picker Modal */}
      {showStudentPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh]" dir="rtl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">اختيار طالب</h4>
              <button onClick={() => { setShowStudentPicker(false); setStudentSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  placeholder="بحث بالاسم، الصف، الشعبة..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-[11px] text-slate-400">لا يوجد طلاب مطابقين</div>
              ) : (
                filteredStudents.map(s => {
                  const already = allowMultiple && selectedStudents.some(x => x.id === s.id);
                  return (
                  <button key={s.id} disabled={already} onClick={() => selectStudent(s)}
                    className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer ${
                      already
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 opacity-70 cursor-default'
                        : 'border-slate-200 dark:border-slate-800 hover:border-office-blue/40 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 block">{s.fullName}</span>
                        <span className="text-[10px] text-slate-400">{s.classGrade} — {s.section}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{already ? 'مُضاف ✓' : s.parentPhone}</span>
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
           FORM FIELDS — Category-specific
          ════════════════════════════════════════════════════════════ */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <FormIcon className={`w-4 h-4 ${formColor}`} />
          نموذج {categoryLabel}
        </h3>

        {/* ═══ GIFTED/TALENTED FIELDS ═══ */}
        {category === 'GIFTED_TALENTED' && (
          <>
            {/* Address */}
            <div className="space-y-1">
              <label className={labelCls}>العنوان</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)}
                rows={2} placeholder="عنوان الطالب..."
                className={inputCls} />
            </div>

            {/* Talent Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>نوع التفوق أو الموهبة <span className="text-rose-500">*</span></label>
                <select value={talentType} onChange={e => { setTalentType(e.target.value); if (e.target.value !== 'أخرى') setTalentTypeOther(''); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none">
                  <option value="">— اختر النوع —</option>
                  {TALENT_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {talentType === 'أخرى' && (
                <div className="space-y-1 animate-fade-in">
                  <label className={labelCls}>حدد النوع (نص حر)</label>
                  <input type="text" value={talentTypeOther} onChange={e => setTalentTypeOther(e.target.value)}
                    placeholder="اكتب هنا..."
                    className={inputCls} />
                </div>
              )}
            </div>

            {/* Counselor Services */}
            <div className="space-y-1">
              <label className={labelCls}>الخدمات التي قدمها المرشد التربوي</label>
              <textarea value={counselorServices} onChange={e => setCounselorServices(e.target.value)}
                rows={4} placeholder="الخدمات الإرشادية التي تم تقديمها للطالب..."
                className={inputCls} />
            </div>

            {/* Career Guidance */}
            <div className="space-y-1">
              <label className={labelCls}>التوجيه المهني الذي يتلاءم مع التفوق أو الموهبة</label>
              <textarea value={careerGuidance} onChange={e => setCareerGuidance(e.target.value)}
                rows={4} placeholder="التوجيه المهني المناسب..."
                className={inputCls} />
            </div>

            {/* Student Problems */}
            <div className="space-y-1">
              <label className={labelCls}>المشكلات التي يعاني منها الطالب</label>
              <textarea value={studentProblems} onChange={e => setStudentProblems(e.target.value)}
                rows={4} placeholder="أي مشكلات يواجهها الطالب..."
                className={inputCls} />
            </div>

            {/* Peer Behavior */}
            <div className="space-y-1">
              <label className={labelCls}>السلوك التوافقي للطالب مع أقرانه</label>
              <textarea value={peerBehavior} onChange={e => setPeerBehavior(e.target.value)}
                rows={4} placeholder="وصف سلوك الطالب الاجتماعي مع أقرانه..."
                className={inputCls} />
            </div>
          </>
        )}

        {/* ═══ ACADEMIC DELAY FIELDS ═══ */}
        {category === 'ACADEMIC_DELAYED' && (
          <>
            {/* Delay Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelCls}>نوع التأخر <span className="text-rose-500">*</span></label>
                <select value={delayType} onChange={e => { setDelayType(e.target.value); if (e.target.value !== 'أخرى') setDelayTypeOther(''); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none">
                  <option value="">— اختر النوع —</option>
                  {DELAY_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {delayType === 'أخرى' && (
                <div className="space-y-1 animate-fade-in">
                  <label className={labelCls}>حدد نوع التأخر (نص حر)</label>
                  <input type="text" value={delayTypeOther} onChange={e => setDelayTypeOther(e.target.value)}
                    placeholder="اكتب هنا..."
                    className={inputCls} />
                </div>
              )}
            </div>

            {/* Delay Reason */}
            <div className="space-y-1">
              <label className={labelCls}>سبب التأخر</label>
              <textarea value={delayReason} onChange={e => setDelayReason(e.target.value)}
                rows={4} placeholder="صف أسباب التأخر بالتفصيل... (ظروف أسرية، غياب متكرر، مشاكل صحية، ضعف المتابعة المنزلية، مشاكل نفسية، ضعف الدافعية...)"
                className={inputCls} />
            </div>
          </>
        )}

        {/* ═══ ABSENT FIELDS ═══ */}
        {category === 'ABSENT' && (
          <>
            {/* Absence Type — Radio buttons */}
            <div className="space-y-2">
              <label className={labelCls}>نوع الغياب <span className="text-rose-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['هروب', 'تأخر عن الدوام', 'غياب بعذر', 'غياب بدون عذر'].map(opt => (
                  <button key={opt} type="button" onClick={() => setAbsenceType(opt)}
                    className={`px-3 py-3 rounded-xl border-2 text-[11px] font-bold transition-all cursor-pointer text-center ${
                      absenceType === opt
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-700'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 mx-auto mb-1.5 flex items-center justify-center transition-all ${
                      absenceType === opt
                        ? 'border-red-500 bg-red-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {absenceType === opt && <span className="text-white text-[8px] font-black">✓</span>}
                    </div>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Absence Days */}
            <div className="space-y-1">
              <label className={labelCls}>عدد أيام الغياب <span className="text-rose-500">*</span></label>
              <input type="number" min={1} value={absenceDays} onChange={e => {
                const v = parseInt(e.target.value, 10);
                setAbsenceDays(isNaN(v) || v < 1 ? 1 : v);
              }}
                className="w-full sm:w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
            </div>
          </>
        )}

        {/* ═══ SHARED FIELDS (both categories) ═══ */}

        {/* Procedures */}
        <div className="space-y-1">
          <label className={labelCls}>الإجراءات</label>
          <textarea value={procedures} onChange={e => setProcedures(e.target.value)}
            rows={5} placeholder={
              category === 'ABSENT'
                ? 'الإجراءات المتخذة... (الاتصال بولي الأمر، مقابلة الطالب، إشعار الإدارة، زيارة منزلية، تعهد خطي، تحويل للجنة الانضباط...)'
                : category === 'ACADEMIC_DELAYED'
                  ? 'الإجراءات المتخذة... (لقاء مع الطالب، لقاء مع ولي الأمر، إحالة للإدارة، خطة علاجية، متابعة مع المعلمين...)'
                  : 'الإجراءات المتخذة...'
            }
            className={inputCls} />
        </div>

        {/* Evaluation */}
        <div className="space-y-1">
          <label className={labelCls}>التقويم والمتابعة</label>
          <textarea value={evaluation} onChange={e => setEvaluation(e.target.value)}
            rows={5} placeholder={
              category === 'ABSENT'
                ? 'المتابعة، استجابة الطالب، استجابة ولي الأمر، التقييم النهائي، التوصيات...'
                : category === 'ACADEMIC_DELAYED'
                  ? 'تقييم التقدم، المتابعة، النتائج...'
                  : 'تقييم الحالة وخطة المتابعة...'
            }
            className={inputCls} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-start">
        <button onClick={handleSave}
          className="bg-office-blue hover:bg-office-hover text-white px-5 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
          <Save className="w-3.5 h-3.5" />
          <span>حفظ</span>
        </button>
        {!isEdit && (
          <button onClick={handleSaveAndNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
            <FilePlus className="w-3.5 h-3.5" />
            <span>حفظ وإنشاء سجل جديد</span>
          </button>
        )}
        <button onClick={onCancel}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer">
          إلغاء
        </button>
      </div>
    </div>
  );
}
