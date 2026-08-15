import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet, X, CheckCircle, Sparkles, AlertCircle, ArrowRight,
} from 'lucide-react';
import {
  FormFieldDef, ImportMapping, ImportSummary,
  readExcel, matchHeaders, buildImportSummary, importData,
  ExcelData, MatchResult,
} from '../lib/excelImporter';
import { toLatinDigits } from '../lib/format';

// ── Props ─────────────────────────────────────────────────────────────

interface ImportWizardProps<T> {
  /** Call when user picks a file — returns parsed Excel data */
  formFields: FormFieldDef[];
  fieldKeys: (keyof T)[];
  factory: () => T;
  onImport: (items: T[]) => void;
  onClose: () => void;
  /** Optional per-field value transforms applied after mapping (e.g. class grade conversion) */
  transforms?: Record<string, (val: string) => string>;
}

type Step = 'upload' | 'mapping' | 'summary' | 'importing' | 'done';

// ── Component ─────────────────────────────────────────────────────────

export default function ImportWizard<T>({
  formFields,
  fieldKeys,
  factory,
  onImport,
  onClose,
  transforms,
}: ImportWizardProps<T>) {
  const [step, setStep] = useState<Step>('upload');
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [fileName, setFileName] = useState('');

  // ── File handler ──────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const data = await readExcel(file);
      setExcelData(data);
      const match = matchHeaders(data.headers, formFields);
      setMatchResult(match);
      setMapping(match.matches);
      setStep('mapping');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل قراءة الملف');
    }
    e.target.value = '';
  };

  // ── Auto-map remaining ────────────────────────────────────────────
  const handleAutoMap = () => {
    if (!excelData) return;
    const match = matchHeaders(excelData.headers, formFields);
    setMatchResult(match);
    setMapping(prev => ({ ...prev, ...match.matches }));
  };

  // ── Update single mapping ─────────────────────────────────────────
  const setMappingFor = (header: string, value: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (!value || value === 'ignore') delete next[header];
      else next[header] = value;
      return next;
    });
  };

  // ── Summary ───────────────────────────────────────────────────────
  const summary = useMemo<ImportSummary | null>(() => {
    if (!excelData) return null;
    return buildImportSummary(excelData.headers, formFields, mapping);
  }, [excelData, formFields, mapping]);

  // ── Execute import ────────────────────────────────────────────────
  const handleImport = () => {
    if (!excelData) return;
    setStep('importing');
    setTotal(excelData.rows.length);
    setProgress(0);

    // Simulate progress then import
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= excelData.rows.length) {
        clearInterval(interval);
        const result = importData(excelData.rows, mapping, factory, fieldKeys, transforms);
        if (result.items.length > 0) {
          onImport(result.items);
        }
        setProgress(result.items.length);
        setStep('done');
      } else {
        setProgress(idx + 1);
        idx++;
      }
    }, 20);
  };

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">

        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            استيراد من Excel
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <div className="text-center py-12 space-y-4">
              <FileSpreadsheet className="w-16 h-16 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">اختر ملف Excel لاستيراد البيانات</p>
              <label className="inline-block bg-office-blue hover:bg-office-hover text-white font-black px-6 py-3 rounded-lg text-xs cursor-pointer shadow-sm transition-colors">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                اختيار ملف
              </label>
            </div>
          )}

          {/* ── Mapping step ── */}
          {step === 'mapping' && excelData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 font-mono">{fileName} — {toLatinDigits(excelData.rows.length)} صف، {toLatinDigits(excelData.headers.length)} عمود</p>
                <button onClick={handleAutoMap} className="text-[11px] text-office-blue hover:underline font-bold flex items-center gap-1 cursor-pointer">
                  <Sparkles className="w-3.5 h-3.5" />
                  كشف تلقائي
                </button>
              </div>

              {matchResult?.warnings && matchResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  {matchResult.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-700 flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}</p>
                  ))}
                </div>
              )}

              {/* Mapped columns */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {excelData.headers.map(header => {
                  const mapped = mapping[header];
                  const field = formFields.find(f => f.key === mapped);
                  const isUnmatched = !mapped;
                  return (
                    <div key={header} className={`flex items-center gap-3 p-2 rounded-lg border ${isUnmatched ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 dark:bg-[#0f172a] border-slate-200 dark:border-slate-800'}`}>
                      <span className={`text-xs font-bold w-1/3 truncate ${isUnmatched ? 'text-rose-700' : 'text-slate-700 dark:text-slate-300'}`} title={header}>{header}</span>
                      <span className="text-slate-400 shrink-0">←</span>
                      <select value={mapped || ''} onChange={e => setMappingFor(header, e.target.value)}
                        className={`flex-1 bg-card border rounded-lg px-2 py-1.5 text-xs outline-none ${isUnmatched ? 'border-rose-300' : 'border-slate-200 dark:border-slate-800'}`}>
                        <option value="">{isUnmatched ? '-- عمود غير مرتبط --' : '-- إلغاء الربط --'}</option>
                        <option value="ignore">تجاهل هذا العمود</option>
                        <optgroup label="حقول النموذج">
                          {formFields.map(f => (
                            <option key={f.key} value={f.key} selected={mapped === f.key}>
                              {f.label} {f.required ? '*' : ''}
                            </option>
                          ))}
                        </optgroup>
                        <option value="custom">إنشاء حقل جديد...</option>
                      </select>
                      {mapped === 'custom' && (
                        <input type="text" placeholder="اسم الحقل" value={customNames[header] || ''}
                          onChange={e => setCustomNames(p => ({ ...p, [header]: e.target.value }))}
                          className="w-28 bg-card border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <button onClick={onClose} className="bg-bg-hover hover:bg-border-color text-main font-bold px-4 py-2 rounded-lg text-xs cursor-pointer">إلغاء</button>
                <button onClick={() => setStep('summary')}
                  className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs cursor-pointer shadow-sm">
                  مراجعة summary ←
                </button>
              </div>
            </div>
          )}

          {/* ── Summary step ── */}
          {step === 'summary' && summary && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-black text-blue-800">ملخص الاستيراد</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-blue-600">إجمالي الأعمدة:</span><span className="font-bold text-blue-800">{toLatinDigits(summary.totalColumns)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">مرتبطة تلقائياً:</span><span className="font-bold text-emerald-600">{toLatinDigits(summary.autoMatched)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">مرتبطة يدوياً:</span><span className="font-bold text-amber-600">{toLatinDigits(summary.manuallyMapped)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">غير مرتبطة:</span><span className="font-bold text-rose-600">{toLatinDigits(summary.unmatched.length)}</span></div>
                </div>
              </div>

              {summary.unmatched.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-rose-700 mb-1">الأعمدة التالية غير موجودة في النموذج الحالي:</p>
                  <ul className="text-[11px] text-rose-600 space-y-0.5">
                    {summary.unmatched.map(h => <li key={h} className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />{h}</li>)}
                  </ul>
                  <button onClick={() => setStep('mapping')} className="text-[11px] text-office-blue hover:underline font-bold mt-2 cursor-pointer">ربطها يدوياً</button>
                </div>
              )}

              {summary.missingRequired.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-amber-700 mb-1">الحقول المطلوبة المفقودة من الملف:</p>
                  <ul className="text-[11px] text-amber-600 space-y-0.5">
                    {summary.missingRequired.map(f => <li key={f.key} className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />{f.label}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex justify-between gap-2">
                <button onClick={() => setStep('mapping')} className="bg-bg-hover hover:bg-border-color text-main font-bold px-4 py-2 rounded-lg text-xs cursor-pointer">رجوع</button>
                <button onClick={handleImport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-lg text-xs cursor-pointer shadow-sm">
                  {summary.missingRequired.length > 0 ? 'متابعة بدون هذه الحقول' : 'تأكيد الاستيراد'}
                </button>
              </div>
            </div>
          )}

          {/* ── Importing step ── */}
          {step === 'importing' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-office-blue/10 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 border-2 border-office-blue border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-bold text-slate-600">جاري الاستيراد...</p>
              <div className="w-full bg-card rounded-full h-2 max-w-md mx-auto">
                <div className="bg-office-blue h-2 rounded-full transition-all duration-200" style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-slate-400">{toLatinDigits(progress)} / {toLatinDigits(total)}</p>
            </div>
          )}

          {/* ── Done step ── */}
          {step === 'done' && (
            <div className="text-center py-12 space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <p className="text-sm font-black text-emerald-700">✅ تم استيراد {toLatinDigits(progress)} طالب بنجاح!</p>
              <button onClick={onClose} className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs cursor-pointer shadow-sm">إغلاق</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
