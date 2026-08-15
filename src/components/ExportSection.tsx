import { useState } from 'react';
import { FileText, Loader2, AlertTriangle, Table } from 'lucide-react';
import { isExcludedField, FIELD_LABELS } from '../lib/exportFields';
import { toArabicDigits } from '../lib/format';

interface ExportSectionProps {
  recordType: string;       // e.g. 'health-record', 'study-case'
  recordLabel: string;      // e.g. 'السجلات الصحية'
  records: any[];           // Array of saved records
  hasTemplate?: boolean;    // Whether a template file exists
  enrich?: (record: any) => any; // Optional: join related data (e.g. student) before export
}

export default function ExportSection({ recordType, recordLabel, records, hasTemplate = true, enrich }: ExportSectionProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExportDocx = async () => {
    setExporting(true);
    setError('');
    try {
      const electron = (window as any).electronAPI;
      if (!electron || !electron.exportDocx) {
        setError('التصدير متاح فقط في تطبيق Electron.');
        setExporting(false);
        return;
      }
      const exportRecords = enrich ? records.map(r => enrich(r)) : records;
      const res = await electron.exportDocx(recordType, exportRecords);
      if (res.ok) {
        // Decode base64 and trigger download
        const byteChars = atob(res.buffer);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNums);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || `${recordType}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(res.error || 'فشل التصدير');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setExporting(false);
    }
  };

  // Arabic column labels + excluded fields are centralized in src/lib/exportFields.
  const handleExportXlsx = async () => {
    setError('');
    try {
      const XLSX = await import('xlsx');
      const exportRecords = enrich ? records.map(r => enrich(r)) : records;
      if (exportRecords.length === 0) {
        setError('لا توجد سجلات للتصدير.');
        return;
      }

      // Collect primitive user-facing fields across records, preserving order.
      const colOrder: string[] = [];
      const seen = new Set<string>();
      for (const rec of exportRecords) {
        for (const k of Object.keys(rec)) {
          if (isExcludedField(k)) continue; // skip internal/system fields
          const v = (rec as any)[k];
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            if (!seen.has(k)) { seen.add(k); colOrder.push(k); }
          }
        }
      }
      // Put key user-facing identifiers first, then the rest.
      const priority = ['recordNumber', 'caseNumber', 'sessionNumber', 'studentName', 'grade', 'section'];
      colOrder.sort((a, b) => {
        const ia = priority.indexOf(a), ib = priority.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return 0;
      });

      const headers = colOrder.map(k => FIELD_LABELS[k] || k);
      const rows = exportRecords.map(rec =>
        colOrder.map(k => {
          const v = (rec as any)[k];
          if (Array.isArray(v)) return v.join('، ');
          return v ?? '';
        })
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      // RTL + readable column widths
      ws['!dir'] = 'rtl';
      ws['!cols'] = colOrder.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, recordLabel.slice(0, 28) || recordType);
      XLSX.writeFile(wb, `${recordType}.xlsx`);
    } catch (err: any) {
      setError(err.message || 'فشل تصدير Excel');
    }
  };

  return (
    <div className="card bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-300">
            تصدير {recordLabel}
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {records.length > 0
              ? `${toArabicDigits(records.length)} سجل/سجلات للتصدير`
              : 'لا توجد سجلات متاحة للتصدير'}
          </p>
        </div>

        {records.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDocx}
              disabled={exporting || !hasTemplate}
              className="bg-office-blue hover:bg-office-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
              title={!hasTemplate ? 'لم يتم رفع قالب المستند بعد' : 'تصدير بصيغة Word'}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>تصدير DOCX</span>
            </button>
            <button
              onClick={handleExportXlsx}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Table className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
            ليست هناك سجلات متاحة للتصدير
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">{error}</span>
        </div>
      )}
    </div>
  );
}
