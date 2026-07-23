/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CounselingSessionFormView — 8-field counseling session form (create / edit).
 * Fields: session title, general objective, specific objectives,
 * activities/strategies, beneficiary dropdown, date, activity, evaluation.
 */

import { useState } from 'react';
import {
  ArrowRight, Save, FilePlus, MessageCircle, XCircle, AlertTriangle, Calendar, ListChecks,
} from 'lucide-react';
import { CounselingSession } from '../types';
import { getNextSessionNumber } from '../lib/storage';

const BENEFICIARY_OPTIONS = [
  'صف دراسي',
  'شعبة دراسية',
  'طلاب محددون (قائمة)',
  'طالب فردي',
  'ولي أمر',
  'معلم',
  'أخرى',
];

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TODAY = new Date().toISOString().split('T')[0];

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7); }

function dayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  return ARABIC_DAYS[new Date(dateStr).getDay()];
}

interface Props {
  existing?: CounselingSession;
  onSave: (s: CounselingSession) => void;
  onSaveAndNew: (s: CounselingSession) => void;
  onCancel: () => void;
}

export default function CounselingSessionFormView({
  existing, onSave, onSaveAndNew, onCancel,
}: Props) {
  const isEdit = !!existing;

  const [sessionTitle, setSessionTitle] = useState(existing?.sessionTitle || '');
  const [generalObjective, setGeneralObjective] = useState(existing?.generalObjective || '');
  const [specificObjectives, setSpecificObjectives] = useState(existing?.specificObjectives || '');
  const [activitiesStrategies, setActivitiesStrategies] = useState(existing?.activitiesStrategies || '');
  const [beneficiary, setBeneficiary] = useState(existing?.beneficiary || '');
  const [beneficiaryOther, setBeneficiaryOther] = useState(existing?.beneficiaryOther || '');
  const [sessionDate, setSessionDate] = useState(existing?.sessionDate || TODAY);
  const [activity, setActivity] = useState(existing?.activity || '');
  const [evaluation, setEvaluation] = useState(existing?.evaluation || '');

  const [error, setError] = useState('');

  const buildSession = (): CounselingSession => ({
    id: existing?.id || uid(),
    sessionNumber: existing?.sessionNumber || getNextSessionNumber(),
    sessionTitle,
    generalObjective,
    specificObjectives,
    activitiesStrategies,
    beneficiary,
    beneficiaryOther,
    sessionDate,
    activity,
    evaluation,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const validate = (): boolean => {
    if (!sessionTitle.trim()) { setError('الرجاء إدخال عنوان الجلسة الإرشادية.'); return false; }
    if (!beneficiary) { setError('الرجاء تحديد المستفيد من الجلسة.'); return false; }
    if (!sessionDate) { setError('الرجاء تحديد تاريخ الجلسة.'); return false; }
    setError('');
    return true;
  };

  const handleSave = () => { if (validate()) onSave(buildSession()); };
  const handleSaveAndNew = () => { if (validate()) onSaveAndNew(buildSession()); };

  const inputCls = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue dark:focus:border-blue-500 transition-colors resize-y";
  const labelCls = "text-[10px] font-black text-slate-700 dark:text-slate-200 block mb-1";

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            {isEdit ? <ListChecks className="w-5 h-5 text-office-blue dark:text-blue-400" /> : <FilePlus className="w-5 h-5 text-office-blue dark:text-blue-400" />}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isEdit ? `تعديل الجلسة ${existing.sessionNumber}` : 'جلسة إرشادية جديدة'}
            </h2>
            {!isEdit && <p className="text-[11px] text-slate-400 dark:text-slate-500">رقم الجلسة: {getNextSessionNumber()}</p>}
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

      {/* Form Card */}
      <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">

        {/* Row 1: Session Number (readonly) + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>رقم الجلسة</label>
            <input type="text" readOnly value={existing?.sessionNumber || getNextSessionNumber()}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-office-blue dark:text-blue-400 font-mono" />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>تاريخ الجلسة</label>
            <div className="flex gap-1.5">
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
              <button onClick={() => setSessionDate(TODAY)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1.5 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-800">
                تلقائي
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>اليوم</label>
            <input type="text" readOnly value={dayOfWeek(sessionDate)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400" />
          </div>
        </div>

        {/* Row 2: Session Title */}
        <div className="space-y-1">
          <label className={labelCls}>عنوان الجلسة الإرشادية <span className="text-rose-500">*</span></label>
          <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
            placeholder="مثال: جلسة تعريفية بالخدمة الإرشادية"
            className={inputCls} />
        </div>

        {/* Row 3: Beneficiary + Other */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>المستفيد من الجلسة الإرشادية <span className="text-rose-500">*</span></label>
            <select value={beneficiary} onChange={e => { setBeneficiary(e.target.value); if (e.target.value !== 'أخرى') setBeneficiaryOther(''); }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue dark:focus:border-blue-500 transition-colors appearance-none">
              <option value="">— اختر المستفيد —</option>
              {BENEFICIARY_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {beneficiary === 'أخرى' && (
            <div className="space-y-1 animate-fade-in">
              <label className={labelCls}>حدد المستفيد (نص حر)</label>
              <input type="text" value={beneficiaryOther} onChange={e => setBeneficiaryOther(e.target.value)}
                placeholder="اكتب هنا..."
                className={inputCls} />
            </div>
          )}
        </div>

        {/* Row 4: General Objective */}
        <div className="space-y-1">
          <label className={labelCls}>الهدف العام</label>
          <textarea value={generalObjective} onChange={e => setGeneralObjective(e.target.value)}
            rows={3} placeholder="الهدف العام من الجلسة الإرشادية..."
            className={inputCls} />
        </div>

        {/* Row 5: Specific Objectives */}
        <div className="space-y-1">
          <label className={labelCls}>الأهداف الخاصة</label>
          <textarea value={specificObjectives} onChange={e => setSpecificObjectives(e.target.value)}
            rows={3} placeholder="الأهداف الفرعية والمتطلبات التفصيلية..."
            className={inputCls} />
        </div>

        {/* Row 6: Activities & Strategies */}
        <div className="space-y-1">
          <label className={labelCls}>الأنشطة والاستراتيجيات الإرشادية</label>
          <textarea value={activitiesStrategies} onChange={e => setActivitiesStrategies(e.target.value)}
            rows={4} placeholder="الأنشطة والاستراتيجيات المتبعة في الجلسة..."
            className={inputCls} />
        </div>

        {/* Row 7: Activity */}
        <div className="space-y-1">
          <label className={labelCls}>النشاط</label>
          <textarea value={activity} onChange={e => setActivity(e.target.value)}
            rows={2} placeholder="وصف النشاط المُنفّذ..."
            className={inputCls} />
        </div>

        {/* Row 8: Evaluation */}
        <div className="space-y-1">
          <label className={labelCls}>التقويم والمتابعة</label>
          <textarea value={evaluation} onChange={e => setEvaluation(e.target.value)}
            rows={2} placeholder="تقييم الجلسة وتوصيات المتابعة..."
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
            <span>حفظ وإنشاء جلسة جديدة</span>
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
