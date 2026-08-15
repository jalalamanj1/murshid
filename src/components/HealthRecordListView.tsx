/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HealthRecordListView — Cards list + detail view for Health Records.
 * Supports PDF and Excel export per record.
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Trash2, Edit3, Search,
  GraduationCap, Heart, FileText, Download, X,
} from 'lucide-react';
import { HealthRecord, Student } from '../types';
import { exportHealthRecordPdf } from './HealthRecordPdfExport';
import { toLatinDigits } from '../lib/format';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return toLatinDigits(new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' }));
}

interface Props {
  records: HealthRecord[];
  students: Student[];
  onEdit: (r: HealthRecord) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function HealthRecordListView({ records, students, onEdit, onDelete, onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => records.find(r => r.id === selectedId) || null, [records, selectedId]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.recordNumber.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q) ||
        r.diseaseType.toLowerCase().includes(q) ||
        r.diseaseTypeOther.toLowerCase().includes(q) ||
        fmtDate(r.createdAt).includes(q)
      );
    });
  }, [records, search]);

  const handleExportExcel = (r: HealthRecord) => {
    import('xlsx').then(XLSX => {
      const data: Record<string, string> = {
        'رقم السجل': r.recordNumber,
        'اسم الطالب': r.studentName,
        'الصف': r.grade,
        'الشعبة': r.section,
        'هاتف ولي الأمر': r.guardianPhone,
        'العنوان': r.address,
        'نوع المرض': r.diseaseType === 'أخرى' ? r.diseaseTypeOther : r.diseaseType,
        'مدى تطور المرض وتأثيره على الطالب': r.diseaseDescription,
        'الإجراءات المتخذة': r.procedures,
        'تاريخ الإنشاء': fmtDate(r.createdAt),
        'آخر تعديل': fmtDate(r.updatedAt),
      };
      const ws = XLSX.utils.json_to_sheet([data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'سجل الحالة الصحية');
      XLSX.writeFile(wb, `${r.recordNumber}_${r.studentName}.xlsx`);
    });
  };

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
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
              <GraduationCap className="w-5 h-5 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                السجل {selected.recordNumber}
              </h2>
              <p className="text-[11px] text-slate-400">{selected.studentName} — سجل الحالة الصحية</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportHealthRecordPdf(selected, students)}
              className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button onClick={() => handleExportExcel(selected)}
              className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button onClick={() => onEdit(selected)}
              className="bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
            <button onClick={() => { if (confirm('هل أنت متأكد من حذف هذا السجل؟')) { onDelete(selected.id); setSelectedId(null); } }}
              className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">معلومات السجل</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'رقم السجل', value: selected.recordNumber },
              { label: 'اسم الطالب', value: selected.studentName },
              { label: 'الصف', value: selected.grade },
              { label: 'الشعبة', value: selected.section },
              { label: 'هاتف ولي الأمر', value: selected.guardianPhone },
              { label: 'نوع المرض', value: selected.diseaseType === 'أخرى' ? selected.diseaseTypeOther : selected.diseaseType },
              { label: 'تاريخ التسجيل', value: fmtDate(selected.createdAt) },
            ].map(item => (
              <div key={item.label}>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Sections */}
        {[
          { label: 'العنوان', value: selected.address },
          { label: 'مدى تطور المرض وتأثيره على الطالب', value: selected.diseaseDescription },
          { label: 'الإجراءات المتخذة', value: selected.procedures },
        ].filter(s => s.value).map(section => (
          <div key={section.label} className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              {section.label}
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{section.value}</p>
          </div>
        ))}
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
          <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
            <Heart className="w-5 h-5 text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">سجل الحالة الصحية</h2>
            <p className="text-[11px] text-slate-400">{toLatinDigits(filtered.length)} سجل مسجل</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الصف، الشعبة، نوع المرض، التاريخ..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <Heart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد سجلات صحية بعد. اضغط "تدوين سجل جديد" من لوحة التحكم.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(r => (
            <div key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="card card-hover bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-300/50 dark:hover:border-rose-800 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-900/40 font-mono">
                    {r.recordNumber}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{fmtDate(r.createdAt)}</span>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mb-1">
                {r.studentName}
              </h4>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                  {r.grade} — {r.section}
                </span>
                {r.diseaseType && (
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/30">
                    {r.diseaseType === 'أخرى' ? r.diseaseTypeOther : r.diseaseType}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400">{r.guardianPhone}</span>
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 group-hover:underline">
                  عرض التفاصيل ←
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
