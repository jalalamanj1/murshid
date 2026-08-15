/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CaseStudyKeyGuideView — Read-only data grid for Case Study records
 * (سجل الدليل (المفتاح) لدراسة الحالة).
 * Displays all case studies with search, filters, PDF/Excel export, print.
 */

import { useState, useMemo } from 'react';
import {
  ArrowRight, Search, FileText, Download, Printer, BookOpen,
} from 'lucide-react';
import { CaseStudy, Student, CounselorProfile } from '../types';
import { academicYear, toArabicDigits } from '../lib/format';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return toArabicDigits(new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' }));
}

interface EnrichedCase {
  cs: CaseStudy;
  student: Student | undefined;
  gradeSection: string;
  reviewDate: string;
  caseTypesStr: string;
}

interface Props {
  students: Student[];
  profile: CounselorProfile;
  caseStudies: CaseStudy[];
  onOpenCaseStudy: (cs: CaseStudy) => void;
  onBack: () => void;
}

export default function CaseStudyKeyGuideView({ students, profile, caseStudies, onOpenCaseStudy, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterCaseType, setFilterCaseType] = useState('ALL');

  // Enrich case studies with student data
  const enriched = useMemo<EnrichedCase[]>(() => {
    return caseStudies.map((cs, idx) => {
      const student = students.find(s => s.id === cs.studentId);
      const gradeSection = student ? `${student.classGrade}` : '—';
      const reviewDate = cs.followUps.length > 0
        ? cs.followUps[cs.followUps.length - 1].date
        : cs.caseDate;
      const caseTypesStr = cs.caseTypes.join('، ');
      return { cs, student, gradeSection, reviewDate, caseTypesStr, seq: idx + 1 };
    });
  }, [caseStudies, students]);

  // Unique filter options
  const gradeOptions = useMemo(() => {
    const set = new Set(enriched.map(e => e.student?.classGrade).filter(Boolean));
    return ['ALL', ...Array.from(set)] as string[];
  }, [enriched]);

  const sectionOptions = useMemo(() => {
    const set = new Set(enriched.map(e => e.student?.section).filter(Boolean));
    return ['ALL', ...Array.from(set)] as string[];
  }, [enriched]);

  const caseTypeOptions = useMemo(() => {
    const set = new Set(enriched.flatMap(e => e.cs.caseTypes));
    return ['ALL', ...Array.from(set)] as string[];
  }, [enriched]);

  // Filter + Search
  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (filterGrade !== 'ALL' && e.student?.classGrade !== filterGrade) return false;
      if (filterSection !== 'ALL' && e.student?.section !== filterSection) return false;
      if (filterCaseType !== 'ALL' && !e.cs.caseTypes.includes(filterCaseType)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.cs.caseNumber.toLowerCase().includes(q) ||
        e.cs.studentName.toLowerCase().includes(q) ||
        e.gradeSection.toLowerCase().includes(q) ||
        e.caseTypesStr.toLowerCase().includes(q) ||
        e.reviewDate.includes(q)
      );
    });
  }, [enriched, search, filterGrade, filterSection, filterCaseType]);

  // Sort (keep original order)
  const sorted = filtered;

  // ── Export Excel ────────────────────────────────────────────
  const handleExportExcel = () => {
    import('xlsx').then(XLSX => {
      const data = sorted.map((e, i) => ({
        'ت': i + 1,
        'اسم الطالب': e.cs.studentName,
        'الرمز': e.cs.studentCode || '',
        'الصف والشعبة': e.gradeSection,
        'تاريخ المراجعة': fmtDate(e.reviewDate),
        'نوع الحالة': e.caseTypesStr,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'سجل الدليل المفتاحي');
      XLSX.writeFile(wb, 'CaseStudyKeyGuide.xlsx');
    });
  };

  // ── Export PDF ──────────────────────────────────────────────
  const handleExportPdf = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = 297, pageH = 210, margin = 10;
        const centerX = pageW / 2;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Case Study Key Guide', centerX, margin + 5, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${profile.schoolName} — ${academicYear(profile.academicYear)}`, centerX, margin + 10, { align: 'center' });

        const tableData = sorted.map((e, i) => [
          String(i + 1),
          e.cs.studentName,
          e.cs.studentCode || '',
          e.gradeSection,
          fmtDate(e.reviewDate),
          e.caseTypesStr,
        ]);

        (doc as any).autoTable({
          startY: margin + 15,
          head: [['#', 'Student Name', 'Case No', 'Grade / Section', 'Review Date', 'Case Type']],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 55 },
            2: { cellWidth: 28 },
            3: { cellWidth: 40 },
            4: { cellWidth: 30 },
            5: { cellWidth: 80 },
          },
          margin: { left: margin, right: margin },
        });

        doc.save('CaseStudyKeyGuide.pdf');
      });
    });
  };

  // ── Print ───────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const thCls = "text-[10px] font-black text-slate-700 dark:text-slate-200 px-3 py-2.5 text-right";
  const tdCls = "text-[11px] font-bold text-slate-700 dark:text-slate-300 px-3 py-2.5 text-right";
  const filterCls = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue appearance-none cursor-pointer";

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer">
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
            <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">سجل الدليل (المفتاح) لدراسة الحالة</h2>
            <p className="text-[11px] text-slate-400">{toArabicDigits(sorted.length)} من أصل {toArabicDigits(caseStudies.length)} سجل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /><span>طباعة</span>
          </button>
          <button onClick={handleExportPdf}
            className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /><span>PDF</span>
          </button>
          <button onClick={handleExportExcel}
            className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /><span>Excel</span>
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap gap-2 items-center print:hidden">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الرمز، الصف، الشعبة، نوع الحالة..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue" />
        </div>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className={filterCls}>
          {gradeOptions.map(g => <option key={g} value={g}>{g === 'ALL' ? 'الكل — الصف' : g}</option>)}
        </select>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className={filterCls}>
          {sectionOptions.map(s => <option key={s} value={s}>{s === 'ALL' ? 'الكل — الشعبة' : s}</option>)}
        </select>
        <select value={filterCaseType} onChange={e => setFilterCaseType(e.target.value)} className={filterCls}>
          {caseTypeOptions.map(t => <option key={t} value={t}>{t === 'ALL' ? 'الكل — نوع الحالة' : t}</option>)}
        </select>
      </div>

      {/* Data Grid */}
      <div className="card bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {search || filterGrade !== 'ALL' || filterSection !== 'ALL' || filterCaseType !== 'ALL'
                ? 'لا توجد نتائج مطابقة للبحث والفلتر.'
                : 'لا توجد سجلات دراسات حالة بعد.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {[
                    { label: 'ت', w: 'w-12' },
                    { label: 'اسم الطالب', w: '' },
                    { label: 'الرمز', w: 'w-28' },
                    { label: 'الصف والشعبة', w: 'w-36' },
                    { label: 'تاريخ المراجعة', w: 'w-32' },
                    { label: 'نوع الحالة', w: '' },
                  ].map(col => (
                    <th key={col.label}
                      className={`${thCls} ${col.w}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((e, i) => (
                  <tr key={e.cs.id}
                    onDoubleClick={() => onOpenCaseStudy(e.cs)}
                    className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer ${
                      i % 2 === 0 ? 'bg-white dark:bg-[#1e293b]' : 'bg-slate-50/50 dark:bg-slate-900/30'
                    }`}>
                    <td className={tdCls + ' w-12 text-center font-mono text-slate-400'}>{toArabicDigits(i + 1)}</td>
                    <td className={tdCls + ' font-black text-slate-800 dark:text-slate-100'}>{e.cs.studentName}</td>
                    <td className={tdCls}>
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/40 font-mono">
                        {e.cs.studentCode || '—'}
                      </span>
                    </td>
                    <td className={tdCls}>{e.gradeSection}</td>
                    <td className={tdCls + ' text-slate-500 dark:text-slate-400'}>{fmtDate(e.reviewDate)}</td>
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-1">
                        {e.cs.caseTypes.map(ct => (
                          <span key={ct} className="text-[9px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {ct}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-lg font-black">سجل الدليل (المفتاح) لدراسة الحالة</h1>
        <p className="text-xs text-slate-500">{profile.schoolName} — {academicYear(profile.academicYear)}</p>
      </div>
    </div>
  );
}
