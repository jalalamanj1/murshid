/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HealthRecordFormView — Form for Health Status Records (سجل الحالة الصحية).
 * Student picker + disease type dropdown + address + description + procedures.
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Save, FilePlus, Search, XCircle, AlertTriangle, User,
  Heart, X, Stethoscope,
} from 'lucide-react';
import { HealthRecord, Student } from '../types';
import { getNextHealthRecordNumber } from '../lib/storage';

const DISEASE_OPTIONS = [
  'السكري',
  'الربو',
  'الصرع',
  'ضعف البصر',
  'ضعف السمع',
  'أمراض القلب',
  'الحساسية',
  'إعاقة حركية',
  'مرض مزمن',
  'اضطراب نفسي',
  'أخرى',
];

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7); }

interface Props {
  students: Student[];
  existing?: HealthRecord;
  onSave: (r: HealthRecord) => void;
  onSaveAndNew: (r: HealthRecord) => void;
  onCancel: () => void;
}

export default function HealthRecordFormView({
  students, existing, onSave, onSaveAndNew, onCancel,
}: Props) {
  const isEdit = !!existing;

  // Student picker state
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentId, setStudentId] = useState(existing?.studentId || '');
  const [studentName, setStudentName] = useState(existing?.studentName || '');
  const [grade, setGrade] = useState(existing?.grade || '');
  const [section, setSection] = useState(existing?.section || '');
  const [guardianPhone, setGuardianPhone] = useState(existing?.guardianPhone || '');

  // Health form fields
  const [address, setAddress] = useState(existing?.address || '');
  const [diseaseType, setDiseaseType] = useState(existing?.diseaseType || '');
  const [diseaseTypeOther, setDiseaseTypeOther] = useState(existing?.diseaseTypeOther || '');
  const [diseaseDescription, setDiseaseDescription] = useState(existing?.diseaseDescription || '');
  const [procedures, setProcedures] = useState(existing?.procedures || '');

  const [error, setError] = useState('');

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(s =>
      s.fullName.toLowerCase().includes(q) ||
      s.classGrade.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const selectStudent = (s: Student) => {
    setStudentId(s.id);
    setStudentName(s.fullName);
    setGrade(s.classGrade);
    setSection(s.section);
    setGuardianPhone(s.parentPhone);
    setAddress(s.address || '');
    setShowStudentPicker(false);
    setStudentSearch('');
  };

  const clearStudent = () => {
    setStudentId('');
    setStudentName('');
    setGrade('');
    setSection('');
    setGuardianPhone('');
    setAddress('');
  };

  const buildRecord = (): HealthRecord => ({
    id: existing?.id || uid(),
    recordNumber: existing?.recordNumber || getNextHealthRecordNumber(),
    studentId,
    studentName,
    grade,
    section,
    guardianPhone,
    address,
    diseaseType,
    diseaseTypeOther: diseaseType === 'أخرى' ? diseaseTypeOther : '',
    diseaseDescription,
    procedures,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const validate = (): boolean => {
    if (!studentId) { setError('الرجاء اختيار الطالب من قاعدة البيانات.'); return false; }
    if (!diseaseType) { setError('الرجاء تحديد نوع المرض.'); return false; }
    setError('');
    return true;
  };

  const handleSave = () => { if (validate()) onSave(buildRecord()); };
  const handleSaveAndNew = () => { if (validate()) onSaveAndNew(buildRecord()); };

  const inputCls = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue dark:focus:border-blue-500 transition-colors resize-y";
  const labelCls = "text-[10px] font-black text-slate-700 dark:text-slate-200 block mb-1";

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
            {isEdit ? <Stethoscope className="w-5 h-5 text-rose-500 dark:text-rose-400" /> : <FilePlus className="w-5 h-5 text-rose-500 dark:text-rose-400" />}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isEdit ? `تعديل السجل ${existing.recordNumber}` : 'سجل حالة صحية جديد'}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {!isEdit && `رقم السجل: ${getNextHealthRecordNumber()} — `}
              سجل الحالة الصحية
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
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          بيانات الطالب
        </h3>

        {studentId ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between mb-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                {[
                  { label: 'اسم الطالب', value: studentName },
                  { label: 'الصف', value: grade },
                  { label: 'الشعبة', value: section },
                ].map(item => (
                  <div key={item.label}>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value || '—'}</span>
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">هاتف ولي الأمر</label>
                  <input type="text" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)}
                    placeholder="رقم الهاتف"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                </div>
              </div>
              <button onClick={clearStudent}
                className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowStudentPicker(true)}
              className="text-[10px] font-bold text-office-blue dark:text-blue-400 hover:underline cursor-pointer">
              تغيير الطالب
            </button>
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
                filteredStudents.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)}
                    className="w-full text-right p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-office-blue/40 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 block">{s.fullName}</span>
                        <span className="text-[10px] text-slate-400">{s.classGrade} — {s.section}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{s.parentPhone}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
           FORM FIELDS
          ════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          نموذج الحالة الصحية
        </h3>

        {/* Address */}
        <div className="space-y-1">
          <label className={labelCls}>العنوان</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)}
            rows={3} placeholder="عنوان الطالب بالتفصيل..."
            className={inputCls} />
        </div>

        {/* Disease Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>نوع المرض <span className="text-rose-500">*</span></label>
            <select value={diseaseType} onChange={e => { setDiseaseType(e.target.value); if (e.target.value !== 'أخرى') setDiseaseTypeOther(''); }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none">
              <option value="">— اختر النوع —</option>
              {DISEASE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {diseaseType === 'أخرى' && (
            <div className="space-y-1 animate-fade-in">
              <label className={labelCls}>حدد نوع المرض (نص حر)</label>
              <input type="text" value={diseaseTypeOther} onChange={e => setDiseaseTypeOther(e.target.value)}
                placeholder="اكتب هنا..."
                className={inputCls} />
            </div>
          )}
        </div>

        {/* Disease Description */}
        <div className="space-y-1">
          <label className={labelCls}>مدى تطور المرض وتأثيره على الطالب</label>
          <textarea value={diseaseDescription} onChange={e => setDiseaseDescription(e.target.value)}
            rows={6} placeholder="صف الحالة الصحية الحالية للطالب... (الحالة المرضية، تأثيرها على الحضور، التأثير على التعلم، المشاركة الصفية، توصيات الأطباء أو أولياء الأمور...)"
            className={inputCls} />
        </div>

        {/* Procedures */}
        <div className="space-y-1">
          <label className={labelCls}>الإجراءات المتخذة</label>
          <textarea value={procedures} onChange={e => setProcedures(e.target.value)}
            rows={6} placeholder="الإجراءات المتخذة... (إبلاغ الإدارة، التواصل مع ولي الأمر، متابعة الحالة، إحالة إلى المركز الصحي، تكييف البيئة الصفية، متابعة مع المعلمين، توصيات خاصة...)"
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
