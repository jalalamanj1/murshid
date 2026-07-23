/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SpecialCaseListView — Cards list + detail view for Special Cases.
 * Handles GIFTED_TALENTED and ACADEMIC_DELAYED categories.
 * Supports PDF and Excel export per record.
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Trash2, Edit3, Search, User,
  GraduationCap, Sparkles, AlertCircle, FileText, Download, X, UserX, FilePlus,
} from 'lucide-react';
import { SpecialCaseRecord, SpecialCaseCategory, SPECIAL_CASE_CATEGORY_LABELS, Student } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface Props {
  records: SpecialCaseRecord[];
  students: Student[];
  onEdit: (r: SpecialCaseRecord) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  // When provided, the view is scoped to a single category (export + filter locked to it).
  category?: SpecialCaseCategory;
  onNew?: (category: SpecialCaseCategory) => void;
}

export default function SpecialCaseListView({ records, students, onEdit, onDelete, onBack, category, onNew }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | SpecialCaseCategory>(category || 'ALL');
  const [showGeneralExport, setShowGeneralExport] = useState(false);

  const selected = useMemo(() => records.find(r => r.id === selectedId) || null, [records, selectedId]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterCategory !== 'ALL' && r.category !== filterCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.recordNumber.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q) ||
        r.talentType.toLowerCase().includes(q) ||
        r.delayType.toLowerCase().includes(q) ||
        r.delayReason.toLowerCase().includes(q) ||
        r.absenceType.toLowerCase().includes(q) ||
        String(r.absenceDays).includes(q)
      );
    });
  }, [records, search, filterCategory]);

  const handleExportExcel = (r: SpecialCaseRecord) => {
    import('xlsx').then(XLSX => {
      const baseData: Record<string, string> = {
        'رقم السجل': r.recordNumber,
        'الفئة': SPECIAL_CASE_CATEGORY_LABELS[r.category],
        'اسم الطالب': r.studentName,
        'الصف': r.grade,
        'الشعبة': r.section,
      };

      let categoryData: Record<string, string> = {};
      if (r.category === 'GIFTED_TALENTED') {
        categoryData = {
          'هاتف ولي الأمر': r.guardianPhone,
          'العنوان': r.address,
          'نوع التفوق أو الموهبة': r.talentType === 'أخرى' ? r.talentTypeOther : r.talentType,
          'الخدمات التي قدمها المرشد التربوي': r.counselorServices,
          'التوجيه المهني': r.careerGuidance,
          'المشكلات': r.studentProblems,
          'السلوك التوافقي': r.peerBehavior,
        };
      } else if (r.category === 'ACADEMIC_DELAYED') {
        categoryData = {
          'نوع التأخر': r.delayType === 'أخرى' ? r.delayTypeOther : r.delayType,
          'سبب التأخر': r.delayReason,
        };
      } else if (r.category === 'ABSENT') {
        categoryData = {
          'نوع الغياب': r.absenceType,
          'عدد أيام الغياب': String(r.absenceDays),
        };
      }

      const sharedData = {
        'الإجراءات': r.procedures,
        'التقويم والمتابعة': r.evaluation,
      };

      const data = { ...baseData, ...categoryData, ...sharedData };
      const ws = XLSX.utils.json_to_sheet([data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'سجل حالة خاصة');
      XLSX.writeFile(wb, `${r.recordNumber}_${r.studentName}.xlsx`);
    });
  };

  // Helper: get the type badge text for a record
  const getTypeBadge = (r: SpecialCaseRecord): string => {
    if (r.category === 'GIFTED_TALENTED') {
      return r.talentType === 'أخرى' ? r.talentTypeOther : r.talentType;
    }
    if (r.category === 'ACADEMIC_DELAYED') {
      return r.delayType === 'أخرى' ? r.delayTypeOther : r.delayType;
    }
    if (r.category === 'ABSENT') {
      return r.absenceType;
    }
    return '';
  };

  const handleExportDocx = async (r: SpecialCaseRecord) => {
    try {
      const electron = (window as any).electronAPI;
      if (!electron || !electron.exportSpecialDocx) {
        alert('التصدير بصيغة Word متاح فقط في تطبيق Electron.');
        return;
      }

      // GIFTED_TALENTED with multiple students → one section per student (page breaks).
      if (r.category === 'GIFTED_TALENTED' && r.studentIds && r.studentIds.length > 1) {
        if (!electron.exportDocx) {
          alert('التصدير بصيغة Word متاح فقط في تطبيق Electron.');
          return;
        }
        const records = r.studentIds.map((sid, i) => {
          const st = students.find(s => s.id === sid);
          return {
            ...r,
            studentId: sid,
            studentName: r.studentNames?.[i] || st?.fullName || '',
            grade: st?.classGrade || '',
            section: st?.section || '',
            guardianPhone: st?.parentPhone || '',
          };
        });
        const res = await electron.exportDocx('special-gifted', records);
        if (res.ok) {
          downloadDocx(res, r.recordNumber);
        } else {
          alert(res.error || 'فشل تصدير Word');
        }
        return;
      }

      const res = await electron.exportSpecialDocx(r.category, r);
      if (res.ok) {
        downloadDocx(res, r.recordNumber);
      } else {
        alert(res.error || 'فشل تصدير Word');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ');
    }
  };

  const downloadDocx = (res: { buffer: string; fileName?: string }, fallbackName: string) => {
    const byteChars = atob(res.buffer);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName || `${fallbackName}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // General export: all records of a chosen category in one DOCX (page breaks between records).
  const handleExportCategory = async (category: SpecialCaseCategory) => {
    try {
      const electron = (window as any).electronAPI;
      if (!electron || !electron.exportDocx) {
        alert('التصدير بصيغة Word متاح فقط في تطبيق Electron.');
        return;
      }
      const templateId =
        category === 'GIFTED_TALENTED' ? 'special-gifted'
          : category === 'ACADEMIC_DELAYED' ? 'special-delayed'
            : 'special-absent';

      const catRecords = records.filter(r => r.category === category);
      if (catRecords.length === 0) {
        alert('لا توجد سجلات ضمن هذه الفئة للتصدير.');
        return;
      }

      const docsRecords: any[] = [];
      for (const r of catRecords) {
        if (category === 'GIFTED_TALENTED' && r.studentIds && r.studentIds.length > 1) {
          r.studentIds.forEach((sid, i) => {
            const st = students.find(s => s.id === sid);
            docsRecords.push({
              ...r,
              studentId: sid,
              studentName: r.studentNames?.[i] || st?.fullName || '',
              grade: st?.classGrade || '',
              section: st?.section || '',
              guardianPhone: st?.parentPhone || '',
            });
          });
        } else {
          docsRecords.push(r);
        }
      }

      const res = await electron.exportDocx(templateId, docsRecords);
      if (res.ok) {
        downloadDocx(res, `سجل-${SPECIAL_CASE_CATEGORY_LABELS[category]}`);
      } else {
        alert(res.error || 'فشل تصدير Word');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ');
    }
  };

  // ── Detail View ──────────────────────────────────────────────
  if (selected) {
    const isGifted = selected.category === 'GIFTED_TALENTED';
    const isDelayed = selected.category === 'ACADEMIC_DELAYED';
    const isAbsent = selected.category === 'ABSENT';
    const DetailIcon = isGifted ? Sparkles : isAbsent ? UserX : AlertCircle;

    return (
      <div className="space-y-4 animate-fade-in" dir="rtl">
        {/* Header */}
        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedId(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <GraduationCap className="w-5 h-5 text-office-blue dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                السجل {selected.recordNumber}
              </h2>
              <p className="text-[11px] text-slate-400">{selected.studentName} — {SPECIAL_CASE_CATEGORY_LABELS[selected.category]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExportDocx(selected)}
              className="bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              <span>تصدير DOCX</span>
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
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">معلومات السجل</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'رقم السجل', value: selected.recordNumber },
              { label: 'الفئة', value: SPECIAL_CASE_CATEGORY_LABELS[selected.category] },
              { label: 'اسم الطالب', value: selected.studentName },
              { label: 'الصف', value: selected.grade },
              { label: 'الشعبة', value: selected.section },
              ...(isGifted ? [
                { label: 'هاتف ولي الأمر', value: selected.guardianPhone },
                { label: 'نوع التفوق/الموهبة', value: selected.talentType === 'أخرى' ? selected.talentTypeOther : selected.talentType },
              ] : []),
              ...(isDelayed ? [
                { label: 'نوع التأخر', value: selected.delayType === 'أخرى' ? selected.delayTypeOther : selected.delayType },
              ] : []),
              ...(isAbsent ? [
                { label: 'نوع الغياب', value: selected.absenceType },
                { label: 'عدد أيام الغياب', value: String(selected.absenceDays) },
              ] : []),
              { label: 'تاريخ الإنشاء', value: fmtDate(selected.createdAt) },
            ].map(item => (
              <div key={item.label}>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">{item.label}</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Sections — GIFTED_TALENTED */}
        {isGifted && [
          { label: 'العنوان', value: selected.address },
          { label: 'الخدمات التي قدمها المرشد التربوي', value: selected.counselorServices },
          { label: 'التوجيه المهني الذي يتلاءم مع التفوق أو الموهبة', value: selected.careerGuidance },
          { label: 'المشكلات التي يعاني منها الطالب', value: selected.studentProblems },
          { label: 'السلوك التوافقي للطالب مع أقرانه', value: selected.peerBehavior },
        ].filter(s => s.value).map(section => (
          <div key={section.label} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-office-blue dark:text-blue-400" />
              {section.label}
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{section.value}</p>
          </div>
        ))}

        {/* Detail Sections — ACADEMIC_DELAYED */}
        {isDelayed && [
          { label: 'سبب التأخر', value: selected.delayReason },
        ].filter(s => s.value).map(section => (
          <div key={section.label} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              {section.label}
            </h3>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{section.value}</p>
          </div>
        ))}

        {/* Shared Sections */}
        {[
          { label: 'الإجراءات', value: selected.procedures },
          { label: 'التقويم والمتابعة', value: selected.evaluation },
        ].filter(s => s.value).map(section => (
          <div key={section.label} className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <DetailIcon className={`w-4 h-4 ${isGifted ? 'text-office-blue dark:text-blue-400' : 'text-amber-500'}`} />
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
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <GraduationCap className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">سجل الحالات الخاصة</h2>
            <p className="text-[11px] text-slate-400">{filtered.length} سجل مسجل</p>
          </div>

          {/* Export + New actions */}
          <div className="flex items-center gap-2 mr-auto">
            {category ? (
              <>
                {onNew && (
                  <button onClick={() => onNew(category)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer shadow-sm">
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>تدوين سجل جديد</span>
                  </button>
                )}
                <button onClick={() => handleExportCategory(category)}
                  className="flex items-center gap-1.5 bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer shadow-sm">
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير {SPECIAL_CASE_CATEGORY_LABELS[category]}</span>
                </button>
              </>
            ) : (
              <div className="relative">
                <button onClick={() => setShowGeneralExport(v => !v)}
                  className="flex items-center gap-1.5 bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer shadow-sm">
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير عام</span>
                </button>
                {showGeneralExport && (
                  <div className="absolute left-0 mt-2 w-44 bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-30 overflow-hidden animate-fade-in">
                    {(['GIFTED_TALENTED', 'ACADEMIC_DELAYED', 'ABSENT'] as const).map(c => (
                      <button key={c} onClick={() => { setShowGeneralExport(false); handleExportCategory(c); }}
                        className="w-full text-right px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0">
                        سجل {SPECIAL_CASE_CATEGORY_LABELS[c]} كامل
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم السجل، الصف، النوع..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
        </div>
        {!category && (
          <div className="flex gap-1.5">
            {(['ALL', 'GIFTED_TALENTED', 'ACADEMIC_DELAYED', 'ABSENT'] as const).map(f => (
              <button key={f} onClick={() => setFilterCategory(f)}
                className={`px-3 py-2 text-[11px] font-bold rounded-xl border transition-all cursor-pointer ${
                  filterCategory === f
                    ? 'bg-office-blue/10 dark:bg-blue-950/40 border-office-blue/30 dark:border-blue-800 text-office-blue dark:text-blue-400'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}>
                {f === 'ALL' ? 'الكل' : SPECIAL_CASE_CATEGORY_LABELS[f]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center">
          <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {search ? 'لا توجد نتائج مطابقة للبحث.' : 'لا توجد سجلات في هذا القسم بعد. استخدم زر "تدوين سجل جديد" لإضافة سجل.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(r => {
            const typeBadge = getTypeBadge(r);
            const isGifted = r.category === 'GIFTED_TALENTED';
            const isAbsent = r.category === 'ABSENT';
            return (
              <div key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-office-blue/30 dark:hover:border-blue-800 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40 font-mono">
                      {r.recordNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                      {SPECIAL_CASE_CATEGORY_LABELS[r.category]}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{fmtDate(r.createdAt)}</span>
                </div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-office-blue dark:group-hover:text-blue-400 transition-colors mb-1">
                  {r.studentName}
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
                    {r.grade} — {r.section}
                  </span>
                  {typeBadge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${
                      isGifted
                        ? 'text-office-blue dark:text-blue-400 bg-office-blue/5 dark:bg-blue-950/30 border-office-blue/10 dark:border-blue-900/30'
                        : isAbsent
                          ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30'
                          : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30'
                    }`}>
                      {typeBadge}
                    </span>
                  )}
                  {isAbsent && r.absenceDays > 0 && (
                    <span className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900/30">
                      {r.absenceDays} يوم
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">{r.guardianPhone}</span>
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
