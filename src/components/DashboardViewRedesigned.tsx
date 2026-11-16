/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Home (dashboard) window.
 * Editorial layout: page heading, a single divided figures strip, the register
 * index, and a narrow column of references.
 */

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Compass,
  ExternalLink,
  FilePlus2,
  Heart,
  HeartHandshake,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  ActiveModule,
  CounselorProfile,
  CounselingRecord,
  RecordType,
  Student,
} from '../types';
import { academicYear, toLatinDigits } from '../lib/format';
import { TELEGRAM_CHANNELS } from '../lib/telegramChannels';

interface DashboardViewProps {
  profile: CounselorProfile;
  students: Student[];
  records: CounselingRecord[];
  onNavigate: (module: ActiveModule) => void;
  onQuickAddStudent?: () => void;
  onQuickAddRecord?: () => void;
  onAddRecord?: (newRecord: CounselingRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  onClearStudentsAndCases?: () => void;
  onOpenRecordsForType?: (recordType: RecordType) => void;
  onCreateRecordForType?: (recordType: RecordType) => void;
  recordCounts?: Partial<Record<RecordType, number>>;
}

const RECORD_TYPES_INFO: {
  type: RecordType;
  shortName: string;
  desc: string;
  icon: typeof Heart;
  tone: string;
  soft: string;
}[] = [
  {
    type: 'HEALTH_STATUS',
    shortName: 'سجل الحالة الصحية',
    desc: 'رصد الحالات الصحية ومتابعة العلاج المدرسي.',
    icon: Heart,
    tone: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-50 dark:bg-rose-950/40',
  },
  {
    type: 'SPECIAL_CASES',
    shortName: 'سجل الحالات الخاصة',
    desc: 'متابعة ذوي الاحتياجات الخاصة والحالات الحرجة.',
    icon: AlertCircle,
    tone: 'text-violet-600 dark:text-violet-400',
    soft: 'bg-violet-50 dark:bg-violet-950/40',
  },
  {
    type: 'GROUP_INDIVIDUAL',
    shortName: 'سجل الإرشاد الجماعي والفردي',
    desc: 'توثيق جلسات الدعم والاستشارات الفردية والجماعية.',
    icon: Users,
    tone: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    type: 'BEREAVED_STUDENTS',
    shortName: 'سجل الطلبة الفاقدين',
    desc: 'رعاية الأيتام وفاقدي المعيل ودعمهم المتكامل.',
    icon: HeartHandshake,
    tone: 'text-cyan-600 dark:text-cyan-400',
    soft: 'bg-cyan-50 dark:bg-cyan-950/40',
  },
  {
    type: 'CASE_STUDY',
    shortName: 'سجل دراسة الحالة',
    desc: 'دراسة معمقة للظواهر السلوكية المعقدة.',
    icon: BookOpen,
    tone: 'text-blue-600 dark:text-blue-400',
    soft: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    type: 'HEALTH_KEY_GUIDE',
    shortName: 'سجل الدليل (المفتاح)',
    desc: 'دليل تصنيف الأمراض وتوصيات المتابعة الوقائية.',
    icon: Compass,
    tone: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    type: 'DAILY_ACTIVITY_PLAN',
    shortName: 'سجل النشاط اليومي',
    desc: 'خطة النشاط الإرشادي وتدوين اليوميات التنفيذية.',
    icon: ClipboardList,
    tone: 'text-orange-600 dark:text-orange-400',
    soft: 'bg-orange-50 dark:bg-orange-950/40',
  },
];

const TELEGRAM_GLYPH_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42' +
  '-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35' +
  '-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02' +
  '-1.98 1.25-5.59 3.69-.53.36-1 .54-1.42.53-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03' +
  '-.24.37-.49 1.02-.74 4-1.74 6.67-2.88 8-3.43 3.81-1.57 4.6-1.84 5.12-1.85.11 0 .37.03.54.17' +
  '.14.12.18.28.2.45-.02.07-.02.2-.04.28z';

function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d={TELEGRAM_GLYPH_PATH} />
    </svg>
  );
}

export default function DashboardViewRedesigned({
  profile,
  students,
  records,
  onNavigate,
  onQuickAddStudent,
  onQuickAddRecord,
  onOpenRecordsForType,
  onCreateRecordForType,
  recordCounts,
}: DashboardViewProps) {
  const totalStudents = students.length;
  const totalClasses = new Set(
    students.map((s) => (s.classGrade || '').trim()).filter(Boolean)
  ).size;
  const yearLabel = academicYear(profile.academicYear);

  const visibleChannels = TELEGRAM_CHANNELS;

  const todayLabel = toLatinDigits(
    new Intl.DateTimeFormat('ar-IQ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  );

  const figures = [
    { label: 'إجمالي الطلبة', value: toLatinDigits(totalStudents), caption: 'طالباً مسجلاً' },
    { label: 'عدد الصفوف', value: toLatinDigits(totalClasses), caption: 'صفوف دراسية' },
    { label: 'السجلات المسجلة', value: toLatinDigits(records.length), caption: 'سجلاً موثقاً' },
    { label: 'العام الدراسي', value: toLatinDigits(yearLabel), caption: 'العام الحالي', ltr: true },
  ];

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="kicker">لوحة التحكم · {todayLabel}</p>
          <h1 className="mt-1.5 text-[26px] font-black leading-tight text-main">
            أهلاً، {profile.fullName || 'المرشد التربوي'}
          </h1>
          <p className="mt-1.5 text-[12px] font-semibold text-sec">
            {profile.schoolName || 'لم يتم تسجيل اسم المدرسة بعد'}
            <span className="mx-2 text-muted">/</span>
            <span className="font-normal text-muted">
              العام الدراسي <span dir="ltr">{toLatinDigits(yearLabel)}</span>
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onQuickAddStudent && (
            <button
              type="button"
              onClick={onQuickAddStudent}
              className="btn-primary flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" strokeWidth={2.2} />
              إضافة طالب
            </button>
          )}
          <button
            type="button"
            onClick={() => (onQuickAddRecord ? onQuickAddRecord() : onNavigate('RECORDS'))}
            className="btn-secondary flex items-center gap-1.5"
          >
            <FilePlus2 className="h-4 w-4" strokeWidth={2} />
            سجل جديد
          </button>
        </div>
      </header>

      {/* ── Figures strip ────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[14px] border border-border-color border-t-2 border-t-primary bg-border-color shadow-xs">
        <dl className="grid grid-cols-2 gap-px lg:grid-cols-4">
          {figures.map((item) => (
            <div key={item.label} className="bg-card px-5 py-4">
              <dt className="text-[10px] font-bold text-muted">{item.label}</dt>
              <dd className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="num text-[22px] font-black leading-none text-main"
                  dir={item.ltr ? 'ltr' : undefined}
                >
                  {item.value}
                </span>
                <span className="truncate text-[9.5px] font-semibold text-muted">
                  {item.caption}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Register index + references ──────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs xl:col-span-2">
          <div className="flex items-end justify-between gap-3 border-b border-divider-color px-5 py-4">
            <div>
              <h2 className="text-[14px] font-black text-main">سجلات المرشد التربوي</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                سبعة سجلات رسمية — اختر السجل لبدء المتابعة والتوثيق
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('RECORDS')}
              className="flex items-center gap-1 text-[10.5px] font-bold text-primary transition-opacity hover:opacity-75"
            >
              عرض الكل
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul>
            {RECORD_TYPES_INFO.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.type}>
                  <div
                    key={item.type}
                    onClick={() => onOpenRecordsForType?.(item.type)}
                    className="group flex cursor-pointer items-center gap-2 border-b border-divider-color px-4 py-2 transition-colors last:border-0 hover:bg-hover"
                  >
                    <span className="num w-5 shrink-0 text-[10px] font-bold text-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${item.soft} ${item.tone}`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <span className="w-[168px] shrink-0 truncate text-[11.5px] font-bold text-main">
                      {item.shortName}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
                      {item.desc}
                    </span>
                    {recordCounts?.[item.type] !== undefined && (
                      <span className="num shrink-0 rounded-md border border-border-color bg-card-elevated px-1.5 py-0.5 text-[9.5px] font-bold text-sec">
                        {toLatinDigits(recordCounts[item.type] || 0)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateRecordForType?.(item.type);
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-[8px] border border-border-color bg-card px-2.5 py-1.5 text-[10px] font-bold text-primary transition-colors hover:border-primary-border hover:bg-primary-bg"
                      title={`إضافة ${item.shortName}`}
                    >
                      <Plus className="h-3 w-3" strokeWidth={2.4} />
                      إضافة
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs">
            <div className="flex items-center gap-2 border-b border-divider-color px-4 py-3.5">
              <TelegramGlyph className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-[12px] font-black text-main">قنوات تيليغرام</h2>
              <span className="ms-auto text-[9.5px] font-semibold text-muted">
                {toLatinDigits(TELEGRAM_CHANNELS.length)} قنوات
              </span>
            </div>
            <ul className="divide-y divide-[var(--divider-color)]">
              {visibleChannels.map((chan) => (
                <li key={chan.id}>
                  <a
                    href={chan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-hover"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-color bg-hover text-[10px] font-black text-sec">
                      {chan.letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-main">
                        {chan.title}
                      </span>
                      <span className="block truncate text-[9px] text-muted" dir="ltr">
                        {chan.username}
                      </span>
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted transition-colors group-hover:text-primary" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
