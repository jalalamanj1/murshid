/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CaseStudyFormView — 5-tab case study form (create / edit).
 * Tab 1: Case Info    Tab 2: Reviews    Tab 3: Treatment
 * Tab 4: Follow-ups   Tab 5: Closure
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Save, FilePlus,
  User, Stethoscope, ClipboardList, Activity, FolderCheck,
  Calendar, Loader2, XCircle, AlertTriangle, ChevronLeft,
} from 'lucide-react';
import {
  Student, CaseStudy, CaseReview, TreatmentGoal, CaseFollowUp,
  CaseClosure, CounselorProfile,
} from '../types';
import { getNextCaseNumber } from '../lib/storage';
import { toArabicDigits } from '../lib/format';

// ── Constants ────────────────────────────────────────────────────────
const TABS = [
  { key: 'info', label: 'معلومات الحالة', icon: User },
  { key: 'reviews', label: 'المراجعات', icon: ClipboardList },
  { key: 'treatment', label: 'البرنامج العلاجي', icon: Stethoscope },
  { key: 'followup', label: 'متابعة الحالة', icon: Activity },
  { key: 'closure', label: 'إنهاء الحالة', icon: FolderCheck },
];

const REFERRAL_SOURCES = ['المعلم', 'الإدارة', 'ولي الأمر', 'الطالب', 'المرشد', 'ذاتية', 'أخرى'];
const CASE_TYPES = [
  'ضعف دراسي', 'مشاكل سلوكية', 'تنمر', 'قلق', 'اكتئاب',
  'غياب', 'مشاكل أسرية', 'مشاكل صحية', 'صعوبات تعلم', 'أخرى',
];
const PROGRESS_OPTIONS = [
  { value: 'IMPROVED_HIGH', label: 'تحسن كبير' },
  { value: 'IMPROVED_MEDIUM', label: 'تحسن متوسط' },
  { value: 'NO_CHANGE', label: 'بدون تغيير' },
  { value: 'DETERIORATED', label: 'تدهور' },
];
const OUTCOME_OPTIONS = [
  { value: 'RESOLVED', label: 'تم حل المشكلة' },
  { value: 'PARTIAL', label: 'تحسن جزئي' },
  { value: 'REFERRAL', label: 'إحالة' },
  { value: 'CLOSED_FILE', label: 'إغلاق الملف' },
  { value: 'OTHER', label: 'أخرى' },
];

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TODAY = new Date().toISOString().split('T')[0];
const TODAY_DAY = ARABIC_DAYS[new Date().getDay()];

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7); }

function calcAge(birthDate: string): string {
  if (!birthDate) return '';
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

function dayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return ARABIC_DAYS[d.getDay()];
}

// ── Props ────────────────────────────────────────────────────────────
interface Props {
  students: Student[];
  profile: CounselorProfile;
  existingCase?: CaseStudy; // if editing
  onSave: (cs: CaseStudy) => void;
  onSaveAndNew: (cs: CaseStudy) => void;
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────
export default function CaseStudyFormView({
  students, profile, existingCase, onSave, onSaveAndNew, onCancel,
}: Props) {
  const isEdit = !!existingCase;

  // ── Tab state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);

  // ── Tab 1 — Info ─────────────────────────────────────────────
  const [studentId, setStudentId] = useState(existingCase?.studentId || '');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentDropdown, setStudentDropdown] = useState(false);
  const [referralSource, setReferralSource] = useState(existingCase?.referralSource || '');
  const [caseDate, setCaseDate] = useState(existingCase?.caseDate || TODAY);
  const [caseDay, setCaseDay] = useState(existingCase?.caseDay || TODAY_DAY);
  const [caseTypes, setCaseTypes] = useState<string[]>(existingCase?.caseTypes || []);
  const [familyCount, setFamilyCount] = useState(existingCase?.familyCount || '');
  const [siblingsCount, setSiblingsCount] = useState(existingCase?.siblingsCount || '');
  const [birthOrder, setBirthOrder] = useState(existingCase?.birthOrder || '');
  const [livesWith, setLivesWith] = useState(existingCase?.livesWith || '');
  const [studentCode, setStudentCode] = useState(existingCase?.studentCode || '');
  const [parentCode, setParentCode] = useState(existingCase?.parentCode || '');
  const [fatherJobTitle, setFatherJobTitle] = useState(existingCase?.fatherJobTitle || '');

  // ── Tab 2 — Reviews ──────────────────────────────────────────
  const [reviews, setReviews] = useState<CaseReview[]>(
    existingCase?.reviews?.length
      ? existingCase.reviews
      : [{ id: uid(), date: TODAY, day: TODAY_DAY, observation: '' }]
  );

  // ── Tab 3 — Treatment ────────────────────────────────────────
  const [goals, setGoals] = useState<TreatmentGoal[]>(
    existingCase?.treatmentGoals?.length
      ? existingCase.treatmentGoals
      : [{ id: uid(), goal: '', actions: '' }]
  );

  // ── Tab 4 — Follow-ups ───────────────────────────────────────
  const [followUps, setFollowUps] = useState<CaseFollowUp[]>(
    existingCase?.followUps || []
  );

  // ── Tab 5 — Closure ──────────────────────────────────────────
  const [closed, setClosed] = useState(existingCase?.closure?.closed || false);
  const [closedDate, setClosedDate] = useState(existingCase?.closure?.closedDate || TODAY);
  const [outcome, setOutcome] = useState(existingCase?.closure?.outcome || 'RESOLVED');
  const [closingNotes, setClosingNotes] = useState(existingCase?.closure?.closingNotes || '');
  const [sessionsTaken, setSessionsTaken] = useState(existingCase?.sessionsTaken || '');

  // ── Derived student info ─────────────────────────────────────
  const selectedStudent = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);
  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.classGrade || '').toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  // ── Auto-update caseDay when caseDate changes ────────────────
  useEffect(() => { setCaseDay(dayOfWeek(caseDate)); }, [caseDate]);

  // ── Helpers ──────────────────────────────────────────────────
  const addReview = () => setReviews(prev => [...prev, { id: uid(), date: TODAY, day: TODAY_DAY, observation: '' }]);
  const removeReview = (id: string) => setReviews(prev => prev.filter(r => r.id !== id));
  const updateReview = (id: string, patch: Partial<CaseReview>) =>
    setReviews(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const addGoal = () => setGoals(prev => [...prev, { id: uid(), goal: '', actions: '' }]);
  const removeGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  const updateGoal = (id: string, patch: Partial<TreatmentGoal>) =>
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));

  const addFollowUp = () => setFollowUps(prev => [...prev, {
    id: uid(), date: TODAY, day: TODAY_DAY, observation: '', recommendation: '', progress: 'NO_CHANGE',
  }]);
  const removeFollowUp = (id: string) => setFollowUps(prev => prev.filter(f => f.id !== id));
  const updateFollowUp = (id: string, patch: Partial<CaseFollowUp>) =>
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const toggleCaseType = (t: string) =>
    setCaseTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // ── Build CaseStudy object ───────────────────────────────────
  const buildCase = (): CaseStudy => {
    const totalSessions = reviews.length + followUps.length;
    const lastFU = followUps.length > 0 ? followUps[followUps.length - 1].date : undefined;
    return {
      id: existingCase?.id || uid(),
      caseNumber: existingCase?.caseNumber || getNextCaseNumber(),
      studentId,
      studentName: selectedStudent?.fullName || '',
      createdAt: existingCase?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      referralSource,
      caseDate,
      caseDay,
      caseTypes,
      familyCount,
      siblingsCount,
      birthOrder,
      livesWith,
      studentCode,
      parentCode,
      fatherJobTitle,
      sessionsTaken,
      reviews,
      treatmentGoals: goals,
      followUps,
      closure: { closed, closedDate, outcome: outcome as CaseClosure['outcome'], closingNotes },
      status: closed ? 'CLOSED' : 'OPEN',
      totalSessions,
      lastFollowUp: lastFU,
    };
  };

  // ── Validate ─────────────────────────────────────────────────
  const [error, setError] = useState('');
  const validate = (): boolean => {
    if (!studentId) { setError('الرجاء اختيار الطالب.'); setActiveTab(0); return false; }
    if (!referralSource) { setError('الرجاء تحديد مصدر الإحالة.'); setActiveTab(0); return false; }
    if (caseTypes.length === 0) { setError('الرجاء تحديد نوع الحالة.'); setActiveTab(0); return false; }
    setError('');
    return true;
  };

  const handleSave = () => { if (validate()) onSave(buildCase()); };
  const handleSaveAndNew = () => { if (validate()) onSaveAndNew(buildCase()); };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            {isEdit ? <ClipboardList className="w-5 h-5 text-office-blue dark:text-blue-400" /> : <FilePlus className="w-5 h-5 text-office-blue dark:text-blue-400" />}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isEdit ? `تعديل الحالة ${existingCase.caseNumber}` : 'دراسة حالة جديدة'}
            </h2>
            {!isEdit && <p className="text-[11px] text-slate-400 dark:text-slate-500">رقم الحالة: {getNextCaseNumber()}</p>}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{error}</span>
          <button onClick={() => setError('')} className="mr-auto cursor-pointer"><XCircle className="w-3.5 h-3.5 text-rose-400" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="card bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  activeTab === i
                    ? 'border-office-blue text-office-blue dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* ═══ TAB 1: Case Info ═══ */}
          {activeTab === 0 && (
            <div className="space-y-5">
              {/* Student Search */}
              <div className="space-y-2 relative">
                <label className="text-xs font-black text-slate-800 dark:text-slate-100 block">البحث عن الطالب</label>
                <input
                  type="text"
                  value={studentId ? (selectedStudent ? `${selectedStudent.fullName} (${selectedStudent.classGrade} — ${selectedStudent.section})` : studentQuery) : studentQuery}
                  onFocus={() => { setStudentDropdown(true); if (studentId) setStudentQuery(selectedStudent?.fullName || ''); }}
                  onBlur={() => setTimeout(() => setStudentDropdown(false), 150)}
                  onChange={e => { setStudentQuery(e.target.value); setStudentDropdown(true); if (studentId) setStudentId(''); }}
                  placeholder="اكتب اسم الطالب أو الرمز أو الصف للبحث..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue dark:focus:border-blue-500 transition-colors"
                />
                {studentDropdown && studentMatches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
                    {studentMatches.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setStudentId(s.id); setStudentQuery(''); setStudentDropdown(false); }}
                        className="w-full text-right px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        {s.fullName} ({s.classGrade} — {s.section})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-populated student info */}
              {selectedStudent && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'الاسم', value: selectedStudent.fullName },
                    { label: 'الصف', value: selectedStudent.classGrade },
                    { label: 'الشعبة', value: selectedStudent.section },
                    { label: 'تاريخ الميلاد', value: selectedStudent.birthDate },
                    { label: 'العمر', value: toArabicDigits(calcAge(selectedStudent.birthDate)) + ' سنة' },
                    { label: 'اسم الأب', value: selectedStudent.fatherName || '—' },
                    { label: 'مهنة الأب', value: selectedStudent.parentJob || '—' },
                    { label: 'جنس الطالب', value: selectedStudent.gender === 'MALE' ? 'ذكر' : 'أنثى' },
                  ].map(item => (
                    <div key={item.label}>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Family info */}
              {selectedStudent && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'عدد أفراد الأسرة', value: familyCount, set: setFamilyCount },
                    { label: 'عدد الإخوة', value: siblingsCount, set: setSiblingsCount },
                    { label: 'ترتيب الطالب بين إخوته', value: birthOrder, set: setBirthOrder },
                    { label: 'يعيش الطالب مع', value: livesWith, set: setLivesWith },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{item.label}</label>
                      <input
                        type="text"
                        value={item.value}
                        onChange={e => item.set(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Manual codes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">رمز الطالب</label>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={e => setStudentCode(e.target.value)}
                    placeholder="أدخل رمز الطالب"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">رمز ولي الأمر</label>
                  <input
                    type="text"
                    value={parentCode}
                    onChange={e => setParentCode(e.target.value)}
                    placeholder="أدخل رمز ولي الأمر"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">مهنة الأب</label>
                  <input
                    type="text"
                    value={fatherJobTitle}
                    onChange={e => setFatherJobTitle(e.target.value)}
                    placeholder="أدخل مهنة الأب"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                  />
                </div>
              </div>

              {/* Referral + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">مصدر الإحالة</label>
                  <select
                    value={referralSource}
                    onChange={e => setReferralSource(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none"
                  >
                    <option value="">— اختر —</option>
                    {REFERRAL_SOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">التاريخ</label>
                  <div className="flex gap-1.5">
                    <input type="date" value={caseDate} onChange={e => setCaseDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                    <button onClick={() => { setCaseDate(TODAY); setCaseDay(TODAY_DAY); }}
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1.5 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-800">
                      تلقائي
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">اليوم</label>
                  <input type="text" readOnly value={caseDay}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400" />
                </div>
              </div>

              {/* Case Types */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 dark:text-slate-100 block">نوع الحالة (يمكن اختيار أكثر من واحد)</label>
                <div className="flex flex-wrap gap-2">
                  {CASE_TYPES.map(t => (
                    <button key={t} onClick={() => toggleCaseType(t)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                        caseTypes.includes(t)
                          ? 'bg-office-blue/10 dark:bg-blue-950/40 border-office-blue/30 dark:border-blue-800 text-office-blue dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 2: Reviews ═══ */}
          {activeTab === 1 && (
            <div className="space-y-4">
              {reviews.map((rev, idx) => (
                <div key={rev.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">المراجعة {toArabicDigits(idx + 1)}</span>
                    {reviews.length > 1 && (
                      <button onClick={() => removeReview(rev.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">التاريخ</label>
                      <div className="flex gap-1.5">
                        <input type="date" value={rev.date}
                          onChange={e => updateReview(rev.id, { date: e.target.value, day: dayOfWeek(e.target.value) })}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                        <button onClick={() => updateReview(rev.id, { date: TODAY, day: TODAY_DAY })}
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-1.5 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-800">
                          تلقائي
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">اليوم</label>
                      <input type="text" readOnly value={rev.day}
                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">الملاحظة</label>
                    <textarea value={rev.observation} onChange={e => updateReview(rev.id, { observation: e.target.value })}
                      rows={3} placeholder="اكتب ملاحظاتك هنا..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-y" />
                  </div>
                </div>
              ))}
              <button onClick={addReview}
                className="flex items-center gap-2 px-4 py-2 bg-office-blue/10 dark:bg-blue-950/30 hover:bg-office-blue/20 dark:hover:bg-blue-950/50 text-office-blue dark:text-blue-400 text-[11px] font-bold rounded-xl border border-office-blue/20 dark:border-blue-900/40 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مراجعة</span>
              </button>
            </div>
          )}

          {/* ═══ TAB 3: Treatment Goals ═══ */}
          {activeTab === 2 && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 w-5/12">الهدف</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 w-5/12">الإجراءات الإرشادية</th>
                      <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 w-2/12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {goals.map((g, idx) => (
                      <tr key={g.id}>
                        <td className="px-2 py-1.5">
                          <input type="text" value={g.goal} onChange={e => updateGoal(g.id, { goal: e.target.value })}
                            placeholder={`هدف ${toArabicDigits(idx + 1)}`}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={g.actions} onChange={e => updateGoal(g.id, { actions: e.target.value })}
                            placeholder="الإجراءات..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {goals.length > 1 && (
                            <button onClick={() => removeGoal(g.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={addGoal}
                className="flex items-center gap-2 px-4 py-2 bg-office-blue/10 dark:bg-blue-950/30 hover:bg-office-blue/20 dark:hover:bg-blue-950/50 text-office-blue dark:text-blue-400 text-[11px] font-bold rounded-xl border border-office-blue/20 dark:border-blue-900/40 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة هدف</span>
              </button>
            </div>
          )}

          {/* ═══ TAB 4: Follow-ups ═══ */}
          {activeTab === 3 && (
            <div className="space-y-4">
              {followUps.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">لا توجد متابعات بعد. اضغط "إضافة متابعة" للبدء.</div>
              )}
              {followUps.map((fu, idx) => (
                <div key={fu.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">المتابعة {toArabicDigits(idx + 1)}</span>
                    <button onClick={() => removeFollowUp(fu.id)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">التاريخ</label>
                      <div className="flex gap-1.5">
                        <input type="date" value={fu.date}
                          onChange={e => updateFollowUp(fu.id, { date: e.target.value, day: dayOfWeek(e.target.value) })}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                        <button onClick={() => updateFollowUp(fu.id, { date: TODAY, day: TODAY_DAY })}
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-1.5 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-800">
                          تلقائي
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">اليوم</label>
                      <input type="text" readOnly value={fu.day}
                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">التقدم</label>
                      <select value={fu.progress} onChange={e => updateFollowUp(fu.id, { progress: e.target.value as CaseFollowUp['progress'] })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none">
                        {PROGRESS_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">الملاحظة</label>
                    <textarea value={fu.observation} onChange={e => updateFollowUp(fu.id, { observation: e.target.value })}
                      rows={2} placeholder="ملاحظات المتابعة..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-y" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">التوصية</label>
                    <textarea value={fu.recommendation} onChange={e => updateFollowUp(fu.id, { recommendation: e.target.value })}
                      rows={2} placeholder="التوصيات..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-y" />
                  </div>
                </div>
              ))}
              <button onClick={addFollowUp}
                className="flex items-center gap-2 px-4 py-2 bg-office-blue/10 dark:bg-blue-950/30 hover:bg-office-blue/20 dark:hover:bg-blue-950/50 text-office-blue dark:text-blue-400 text-[11px] font-bold rounded-xl border border-office-blue/20 dark:border-blue-900/40 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة متابعة</span>
              </button>
            </div>
          )}

          {/* ═══ TAB 5: Closure ═══ */}
          {activeTab === 4 && (
            <div className="space-y-5">
              <button onClick={() => setClosed(!closed)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                  closed
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${closed ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {closed && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                <span>إنهاء الحالة</span>
              </button>

              {closed && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">تاريخ الإنهاء</label>
                      <div className="flex gap-1.5">
                        <input type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
                        <button onClick={() => setClosedDate(TODAY)}
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2 py-1.5 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-800">
                          تلقائي
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">عدد الجلسات التي استغرقتها الحالة</label>
                      <input
                        type="text"
                        value={sessionsTaken}
                        onChange={e => setSessionsTaken(e.target.value)}
                        placeholder="أدخل عدد الجلسات"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">النتيجة</label>
                      <select value={outcome} onChange={e => setOutcome(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none">
                        {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">ملاحظات الإنهاء</label>
                    <textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)}
                      rows={4} placeholder="ملاحظات النهاية..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-y" />
                  </div>
                </div>
              )}

              {!closed && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 text-center">
                  <FolderCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">الحالة مفتوحة حالياً. عند الانتهاء، قم بتفعيل "إنهاء الحالة" أعلاه.</p>
                </div>
              )}
            </div>
          )}
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
            <span>حفظ وإنشاء دراسة حالة جديدة</span>
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
