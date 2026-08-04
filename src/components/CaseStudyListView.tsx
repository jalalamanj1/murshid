/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CaseStudyListView — Cards list + detail view for Case Studies.
 * Shows all case study records with search, and opens the full
 * case study detail (read-only) or switches to edit mode.
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowRight, Plus, Trash2, Edit3, FileText, Search,
  CheckCircle2, XCircle, Clock, User, Calendar, Tag,
  Filter, ChevronDown, Printer, BookOpen, Activity,
} from 'lucide-react';
import { CaseStudy, Student, CounselorProfile } from '../types';

const PROGRESS_MAP: Record<string, string> = {
  IMPROVED_HIGH: 'تحسن كبير',
  IMPROVED_MEDIUM: 'تحسن متوسط',
  NO_CHANGE: 'بدون تغيير',
  DETERIORATED: 'تدهور',
};

const OUTCOME_MAP: Record<string, string> = {
  RESOLVED: 'تم حل المشكلة',
  PARTIAL: 'تحسن جزئي',
  REFERRAL: 'إحالة',
  CLOSED_FILE: 'إغلاق الملف',
  OTHER: 'أخرى',
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface Props {
  students: Student[];
  profile: CounselorProfile;
  caseStudies: CaseStudy[];
  onEdit: (cs: CaseStudy) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function CaseStudyListView({ students, profile, caseStudies, onEdit, onDelete, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  const selected = useMemo(() => caseStudies.find(c => c.id === selectedId) || null, [caseStudies, selectedId]);

  const filtered = useMemo(() => {
    return caseStudies.filter(cs => {
      if (filterStatus !== 'ALL' && cs.status !== filterStatus) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        cs.caseNumber.toLowerCase().includes(q) ||
        cs.studentName.toLowerCase().includes(q) ||
        cs.referralSource.toLowerCase().includes(q) ||
        cs.caseTypes.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [caseStudies, search, filterStatus]);

  // ── Detail View ──────────────────────────────────────────────
  if (selected) {
    const student = students.find(s => s.id === selected.studentId);
    const totalSessions = selected.reviews.length + selected.followUps.length;

    return (
      <div className="space-y-4 animate-fade-in" dir="rtl">
        {/* Header */}
        <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedId(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <BookOpen className="w-5 h-5 text-office-blue dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">دراسة الحالة {selected.caseNumber}</h2>
              <p className="text-[11px] text-slate-400">{selected.studentName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(selected)}
              className="bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
            <button onClick={() => { if (confirm('هل أنت متأكد من حذف هذه الحالة؟')) { onDelete(selected.id); setSelectedId(null); } }}
              className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          </div>
        </div>

        {/* Status banner */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-bold ${
          selected.status === 'OPEN'
            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-400'
            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        }`}>
          {selected.status === 'OPEN' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>الحالة: {selected.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}</span>
          {selected.status === 'CLOSED' && selected.closure.outcome && (
            <span className="mr-4">— النتيجة: {OUTCOME_MAP[selected.closure.outcome] || selected.closure.outcome}</span>
          )}
        </div>

        {/* Info Grid */}
        <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">معلومات الحالة</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'رقم الحالة', value: selected.caseNumber },
              { label: 'اسم الطالب', value: selected.studentName },
              { label: 'الصف', value: student?.classGrade || '—' },
              { label: 'الشعبة', value: student?.classGrade || '—' },
              { label: 'مصدر الإحالة', value: selected.referralSource },
              { label: 'التاريخ', value: fmtDate(selected.caseDate) },
              { label: 'اليوم', value: selected.caseDay },
              { label: 'نوع الحالة', value: selected.caseTypes.join('، ') },
              { label: 'عدد أفراد الأسرة', value: selected.familyCount || '—' },
              { label: 'عدد الإخوة', value: selected.siblingsCount || '—' },
              { label: 'ترتيب الطالب', value: selected.birthOrder || '—' },
              { label: 'يعيش مع', value: selected.livesWith || '—' },
              { label: 'عدد الجلسات', value: String(totalSessions) },
              { label: 'آخر متابعة', value: selected.lastFollowUp ? fmtDate(selected.lastFollowUp) : '—' },
              { label: 'تاريخ الإنشاء', value: fmtDate(selected.createdAt) },
              { label: 'آخر تعديل', value: fmtDate(selected.updatedAt) },
            ].map(item => (
              <div key={item.label}>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews */}
        {selected.reviews.length > 0 && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">المراجعات ({selected.reviews.length})</h3>
            {selected.reviews.map((rev, i) => (
              <div key={rev.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-black text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40">المراجعة {i + 1}</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(rev.date)} — {rev.day}</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{rev.observation || '—'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Treatment Goals */}
        {selected.treatmentGoals.length > 0 && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">البرنامج العلاجي ({selected.treatmentGoals.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400">#</th>
                    <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400">الهدف</th>
                    <th className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selected.treatmentGoals.map((g, i) => (
                    <tr key={g.id}>
                      <td className="px-3 py-2 text-[11px] text-slate-400 font-bold">{i + 1}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 font-bold">{g.goal || '—'}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 font-bold">{g.actions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Follow-ups */}
        {selected.followUps.length > 0 && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">المتابعات ({selected.followUps.length})</h3>
            {selected.followUps.map((fu, i) => (
              <div key={fu.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40">المتابعة {i + 1}</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(fu.date)} — {fu.day}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    fu.progress === 'IMPROVED_HIGH' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
                    fu.progress === 'IMPROVED_MEDIUM' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' :
                    fu.progress === 'NO_CHANGE' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                    'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                  }`}>
                    {PROGRESS_MAP[fu.progress] || fu.progress}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400">الملاحظة:</span>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{fu.observation || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400">التوصية:</span>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{fu.recommendation || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Closure */}
        {selected.closure.closed && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 pb-2 border-b border-slate-100 dark:border-slate-800">إنهاء الحالة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">تاريخ الإنهاء</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{fmtDate(selected.closure.closedDate)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">النتيجة</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{OUTCOME_MAP[selected.closure.outcome] || selected.closure.outcome}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">عدد الجلسات</span>
                <span className="text-[11px] font-bold text-office-blue dark:text-blue-400">{totalSessions}</span>
              </div>
            </div>
            {selected.closure.closingNotes && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">ملاحظات الإنهاء</span>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                  {selected.closure.closingNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <BookOpen className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">سجل دراسة الحالة</h2>
            <p className="text-[11px] text-slate-400">{filtered.length} حالة مسجلة</p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الحالة، المصدر، النوع..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'OPEN', 'CLOSED'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                filterStatus === f
                  ? 'bg-office-blue/10 dark:bg-blue-950/40 border-office-blue/30 dark:border-blue-800 text-office-blue dark:text-blue-400'
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}>
              {f === 'ALL' ? 'الكل' : f === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد دراسات حالة بعد. اضغط "تدوين سجل جديد" من لوحة التحكم.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(cs => {
            const stu = students.find(s => s.id === cs.studentId);
            return (
              <div key={cs.id}
                onClick={() => setSelectedId(cs.id)}
                className="card card-hover bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-office-blue/30 dark:hover:border-blue-800 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40 font-mono">
                      {cs.caseNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      cs.status === 'OPEN'
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40'
                    }`}>
                      {cs.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{fmtDate(cs.caseDate)}</span>
                </div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-office-blue dark:group-hover:text-blue-400 transition-colors mb-2">
                  {cs.studentName}
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                    {stu?.classGrade || '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                    {cs.referralSource}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {cs.caseTypes.slice(0, 3).map(t => (
                    <span key={t} className="text-[9px] text-office-blue dark:text-blue-400 bg-office-blue/5 dark:bg-blue-950/30 px-1.5 py-0.5 rounded border border-office-blue/10 dark:border-blue-900/30">
                      {t}
                    </span>
                  ))}
                  {cs.caseTypes.length > 3 && (
                    <span className="text-[9px] text-slate-400 px-1.5 py-0.5">+{cs.caseTypes.length - 3}</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    {cs.followUps.length} متابعة — {cs.reviews.length} مراجعة
                  </span>
                  <span className="text-[10px] font-black text-office-blue dark:text-blue-400 group-hover:underline">
                    عرض التفاصيل ←
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
