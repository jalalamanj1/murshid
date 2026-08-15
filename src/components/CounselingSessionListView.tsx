/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CounselingSessionListView — Cards list + detail view for Counseling Sessions.
 * Shows all counseling session records with search, and opens the full
 * session detail (read-only) or switches to edit mode.
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Plus, Trash2, Edit3, Search, Calendar,
  MessageCircle, ListChecks, ChevronDown, ChevronUp, Target, Activity,
} from 'lucide-react';
import { CounselingSession, CounselorProfile } from '../types';
import { toLatinDigits } from '../lib/format';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return toLatinDigits(new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' }));
}

interface Props {
  sessions: CounselingSession[];
  profile: CounselorProfile;
  onEdit: (s: CounselingSession) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function CounselingSessionListView({ sessions, profile, onEdit, onDelete, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selected = useMemo(() => sessions.find(s => s.id === selectedId) || null, [sessions, selectedId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s =>
      s.sessionNumber.toLowerCase().includes(q) ||
      s.sessionTitle.toLowerCase().includes(q) ||
      s.beneficiary.toLowerCase().includes(q) ||
      s.activity.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  // ── Detail View ──────────────────────────────────────────────
  if (selected) {
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
              <MessageCircle className="w-5 h-5 text-office-blue dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                الجلسة الإرشادية {selected.sessionNumber}
              </h2>
              <p className="text-[11px] text-slate-400">{selected.sessionTitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(selected)}
              className="bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
            <button onClick={() => { if (confirm('هل أنت متأكد من حذف هذه الجلسة؟')) { onDelete(selected.id); setSelectedId(null); } }}
              className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">معلومات الجلسة</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'رقم الجلسة', value: selected.sessionNumber },
              { label: 'التاريخ', value: fmtDate(selected.sessionDate) },
              { label: 'اليوم', value: new Date(selected.sessionDate).toLocaleDateString('ar-IQ', { weekday: 'long' }) },
              { label: 'المستفيد', value: selected.beneficiary === 'أخرى' ? selected.beneficiaryOther || 'أخرى' : selected.beneficiary },
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

        {/* Session Title */}
        <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-office-blue dark:text-blue-400" />
            عنوان الجلسة
          </h3>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.sessionTitle}</p>
        </div>

        {/* General Objective */}
        {selected.generalObjective && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-office-blue dark:text-blue-400" />
              الهدف العام
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.generalObjective}</p>
          </div>
        )}

        {/* Specific Objectives */}
        {selected.specificObjectives && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              الأهداف الخاصة
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.specificObjectives}</p>
          </div>
        )}

        {/* Activities & Strategies */}
        {selected.activitiesStrategies && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-office-blue dark:text-blue-400" />
              الأنشطة والاستراتيجيات الإرشادية
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.activitiesStrategies}</p>
          </div>
        )}

        {/* Activity */}
        {selected.activity && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              النشاط
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.activity}</p>
          </div>
        )}

        {/* Evaluation */}
        {selected.evaluation && (
          <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-purple-500" />
              التقويم والمتابعة
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.evaluation}</p>
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
            <MessageCircle className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">سجل الإرشاد الفردي والجماعي</h2>
            <p className="text-[11px] text-slate-400">{toLatinDigits(filtered.length)} جلسة مسجلة</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الجلسة، المستفيد، النشاط..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد جلسات إرشادية بعد. اضغط "تدوين سجل جديد" من لوحة التحكم.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => {
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id}
                className="card card-hover bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-office-blue/30 dark:hover:border-blue-800 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40 font-mono">
                      {s.sessionNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                      {s.beneficiary === 'أخرى' ? s.beneficiaryOther || 'أخرى' : s.beneficiary}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{fmtDate(s.sessionDate)}</span>
                </div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">
                  {s.sessionTitle}
                </h4>

                {/* Collapsed preview */}
                {!isExpanded && s.generalObjective && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2 mb-2">
                    {s.generalObjective}
                  </p>
                )}

                {/* Expanded preview */}
                {isExpanded && (
                  <div className="mt-3 space-y-2 animate-fade-in border-t border-slate-100 dark:border-slate-800 pt-3">
                    {s.generalObjective && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">الهدف العام:</span>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{s.generalObjective}</p>
                      </div>
                    )}
                    {s.specificObjectives && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">الأهداف الخاصة:</span>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{s.specificObjectives}</p>
                      </div>
                    )}
                    {s.activitiesStrategies && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">الأنشطة والاستراتيجيات:</span>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{s.activitiesStrategies}</p>
                      </div>
                    )}
                    {s.activity && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">النشاط:</span>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{s.activity}</p>
                      </div>
                    )}
                    {s.evaluation && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block">التقويم والمتابعة:</span>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{s.evaluation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Card footer */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex gap-1.5">
                    <button onClick={() => setSelectedId(s.id)}
                      className="text-[10px] font-black text-office-blue dark:text-blue-400 hover:underline cursor-pointer">
                      عرض التفاصيل
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button onClick={() => onEdit(s)}
                      className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-office-blue dark:hover:text-blue-400 cursor-pointer flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      تعديل
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button onClick={() => { if (confirm('هل أنت متأكد من حذف هذه الجلسة؟')) onDelete(s.id); }}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-600 cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      حذف
                    </button>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
