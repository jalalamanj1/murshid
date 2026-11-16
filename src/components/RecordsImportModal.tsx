/**
 * Upload a DOCX/Excel file per counselling record and fill that register.
 * Deliberately a blurred sheet with no dark overlay, per the app's design.
 */

import { useRef, useState } from 'react';
import {
  Heart,
  HeartHandshake,
  BookOpen,
  MessageCircle,
  ClipboardList,
  Sparkles,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Student, SpecialCaseCategory } from '../types';
import {
  parseRecordFile,
  buildRecords,
  type RecordImportKind,
  type RecordImportResult,
} from '../lib/recordFileImport';

interface RecordsImportModalProps {
  students: Student[];
  onClose: () => void;
  onImport: (result: RecordImportResult) => void;
}

interface SectionDef {
  kind: RecordImportKind;
  title: string;
  description: string;
  icon: typeof Heart;
  tone: string;
  soft: string;
  hasCategory?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    kind: 'health',
    title: 'سجل الحالة الصحية',
    description: 'اسم الطالب، نوع المرض، تطور المرض، الإجراءات المتخذة.',
    icon: Heart,
    tone: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-50 dark:bg-rose-950/40',
  },
  {
    kind: 'parentLoss',
    title: 'سجل الطلبة الفاقدين',
    description: 'نوع الفقدان، يعيش مع، المستوى قبل وبعد الفقدان، سلوك الطالب.',
    icon: HeartHandshake,
    tone: 'text-cyan-600 dark:text-cyan-400',
    soft: 'bg-cyan-50 dark:bg-cyan-950/40',
  },
  {
    kind: 'caseStudy',
    title: 'سجل دراسة الحالة',
    description: 'مصدر الإحالة، نوع الحالة، أفراد الأسرة، رمز الطالب وولي الأمر.',
    icon: BookOpen,
    tone: 'text-blue-600 dark:text-blue-400',
    soft: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    kind: 'session',
    title: 'سجل الإرشاد الفردي والجماعي',
    description: 'عنوان الجلسة، الأهداف، الأنشطة والاستراتيجيات، التقويم.',
    icon: MessageCircle,
    tone: 'text-violet-600 dark:text-violet-400',
    soft: 'bg-violet-50 dark:bg-violet-950/40',
  },
  {
    kind: 'counseling',
    title: 'سجل النشاط اليومي والتدوينات',
    description: 'العنوان، التفاصيل، الإجراء المتخذ، التوصيات.',
    icon: ClipboardList,
    tone: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    kind: 'specialCase',
    title: 'سجل الحالات الخاصة',
    description: 'اختر فئة الحالة ثم ارفع الملف: الموهبة، التأخر الدراسي أو الغياب.',
    icon: Sparkles,
    tone: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-50 dark:bg-emerald-950/40',
    hasCategory: true,
  },
];

interface SectionState {
  fileName?: string;
  busy?: boolean;
  error?: string;
  result?: RecordImportResult;
  imported?: number;
  category?: SpecialCaseCategory;
}

export default function RecordsImportModal({ students, onClose, onImport }: RecordsImportModalProps) {
  const [states, setStates] = useState<Record<string, SectionState>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const patch = (kind: string, next: Partial<SectionState>) =>
    setStates((prev) => ({ ...prev, [kind]: { ...prev[kind], ...next } }));

  const handleFile = async (kind: RecordImportKind, file: File | undefined, category?: SpecialCaseCategory) => {
    if (!file) return;
    patch(kind, { fileName: file.name, busy: true, error: undefined, result: undefined, imported: undefined });
    try {
      const maps = await parseRecordFile(file);
      const result = buildRecords(kind, maps, { students, category });
      patch(kind, { busy: false, result });
    } catch (err) {
      patch(kind, { busy: false, error: err instanceof Error ? err.message : 'تعذر قراءة الملف.' });
    }
  };

  const confirmImport = (kind: RecordImportKind) => {
    const state = states[kind];
    if (!state?.result) return;
    onImport(state.result);
    patch(kind, { imported: state.result.records.length, result: undefined, fileName: undefined });
    const input = inputs.current[kind];
    if (input) input.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[16px] border border-border-color bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-divider-color px-6 py-4">
          <div>
            <h2 className="text-sm font-black text-main">استيراد سجلات الإرشاد من ملفات</h2>
            <p className="mt-0.5 text-[10.5px] text-muted">
              DOCX أو Excel — يقرأ التطبيق تسميات الحقول ويعبئ السجل المحدد تلقائياً.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-main"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const state = states[section.kind] || {};
            return (
              <section
                key={section.kind}
                className="rounded-[12px] border border-border-color bg-card px-4 py-3.5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${section.soft} ${section.tone}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[12px] font-black text-main">{section.title}</h3>
                    <p className="mt-0.5 text-[10px] text-muted">{section.description}</p>

                    {section.hasCategory && (
                      <select
                        value={state.category || 'GIFTED_TALENTED'}
                        onChange={(e) => {
                          const category = e.target.value as SpecialCaseCategory;
                          patch(section.kind, { category, result: undefined, imported: undefined });
                        }}
                        className="mt-2 w-full max-w-[240px] rounded-[8px] border border-input-border bg-input-bg px-2 py-1.5 text-[10.5px] font-bold text-main"
                      >
                        <option value="GIFTED_TALENTED">المتفوقون والموهوبون</option>
                        <option value="ACADEMIC_DELAYED">المتأخرون دراسياً</option>
                        <option value="ABSENT">الغائبون</option>
                      </select>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <input
                      ref={(el) => { inputs.current[section.kind] = el; }}
                      type="file"
                      accept=".docx,.xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => handleFile(section.kind, e.target.files?.[0], state.category)}
                    />
                    <button
                      type="button"
                      onClick={() => inputs.current[section.kind]?.click()}
                      className="flex items-center gap-1.5 rounded-[8px] border border-border-color bg-card px-3 py-1.5 text-[10.5px] font-bold text-sec transition-colors hover:border-primary-border hover:text-primary"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      اختيار ملف
                    </button>

                    {state.result && state.result.records.length > 0 && (
                      <button
                        type="button"
                        onClick={() => confirmImport(section.kind)}
                        className="btn-primary !px-3 !py-1.5 !text-[10.5px]"
                      >
                        استيراد {state.result.records.length} سجل
                      </button>
                    )}
                  </div>
                </div>

                {/* Status line */}
                <div className="mt-2 space-y-1">
                  {state.busy && (
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" /> يتم تحليل الملف…
                    </p>
                  )}
                  {state.error && (
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-danger">
                      <AlertCircle className="h-3 w-3" /> {state.error}
                    </p>
                  )}
                  {state.fileName && !state.busy && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span className="font-mono text-[9.5px]" dir="ltr">{state.fileName}</span>
                      {state.result && (
                        <span className="text-sec">
                          {state.result.records.length} سجل · حقول متعرّف عليها {state.result.recognized} من {state.result.totalFields}
                        </span>
                      )}
                    </p>
                  )}
                  {state.result?.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-[9.5px] text-warning">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                    </p>
                  ))}
                  {state.imported !== undefined && (
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-success">
                      <CheckCircle2 className="h-3 w-3" /> تمت إضافة {state.imported} سجل إلى السجل المحدد.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-divider-color px-6 py-3 text-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary !px-4 !py-2 !text-[11px]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
