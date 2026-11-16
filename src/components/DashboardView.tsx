/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Compass,
  ExternalLink,
  Heart,
  HeartHandshake,
  School,
  Users,
} from 'lucide-react';
import {
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
}

/**
 * The official counseling registers. This table is the dashboard's single
 * source of truth and mirrors the existing record types — nothing is added or
 * removed here, only rendered more compactly.
 */
const RECORD_TYPES_INFO: {
  type: RecordType;
  name: string;
  shortName: string;
  icon: typeof Heart;
  desc: string;
  color: string;
}[] = [
  {
    type: 'HEALTH_STATUS',
    name: 'سجل الحالة الصحية',
    shortName: 'الحالة الصحية',
    icon: Heart,
    desc: 'رصد الحالات الصحية ومتابعة العلاج المدرسي.',
    color: 'channel-rose',
  },
  {
    type: 'SPECIAL_CASES',
    name: 'سجل الحالات الخاصة',
    shortName: 'الحالات الخاصة',
    icon: AlertCircle,
    desc: 'متابعة ذوي الاحتياجات الخاصة والحالات الحرجة.',
    color: 'channel-purple',
  },
  {
    type: 'GROUP_INDIVIDUAL',
    name: 'سجل الإرشاد الجمعي والفردي',
    shortName: 'الإرشاد الجماعي والفردي',
    icon: Users,
    desc: 'توثيق جلسات الدعم والاستشارات الفردية والجماعية.',
    color: 'channel-amber',
  },
  {
    type: 'BEREAVED_STUDENTS',
    name: 'سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)',
    shortName: 'الطلبة الفاقدين',
    icon: HeartHandshake,
    desc: 'رعاية الأيتام وفاقدي المعيل ودعمهم المتكامل.',
    color: 'channel-cyan',
  },
  {
    type: 'CASE_STUDY',
    name: 'سجل دراسة الحالة',
    shortName: 'دراسة الحالة',
    icon: BookOpen,
    desc: 'دراسة معمقة للظواهر السلوكية المعقدة.',
    color: 'channel-blue',
  },
  {
    type: 'HEALTH_KEY_GUIDE',
    name: 'سجل الدليل (المفتاح) لدراسة الحالة',
    shortName: 'الدليل (المفتاح) الدراسي',
    icon: Compass,
    desc: 'دليل تصنيف الأمراض وتوصيات المتابعة الوقائية.',
    color: 'channel-emerald',
  },
  {
    type: 'DAILY_ACTIVITY_PLAN',
    name: 'سجل النشاط اليومي',
    shortName: 'النشاط اليومي',
    icon: ClipboardList,
    desc: 'خطة النشاط الإرشادي وتدوين اليوميات التنفيذية.',
    color: 'channel-amber',
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

export default function DashboardView({
  profile,
  students,
  onNavigate,
  onOpenRecordsForType,
}: DashboardViewProps) {
  // ── Summary statistics ────────────────────────────────────────────────
  // Only three figures are surfaced: the academic year, the total number of
  // students, and the number of distinct classes. No gender or teacher split.
  const totalStudents = students.length;
  const totalClasses = new Set(
    students.map((s) => (s.classGrade || '').trim()).filter(Boolean)
  ).size;
  const yearLabel = academicYear(profile.academicYear);

  const visibleChannels = TELEGRAM_CHANNELS.slice(0, 6);

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {/* ── Summary statistics: exactly three equal cards ─────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card !p-5 flex items-center gap-4">
          <div className="p-3.5 bg-primary-bg text-primary rounded-2xl shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted font-bold">العام الدراسي</p>
            <p className="text-2xl font-extrabold text-main mt-1 tracking-tight">
              {toLatinDigits(yearLabel)}
            </p>
          </div>
        </div>

        <div className="card !p-5 flex items-center gap-4">
          <div className="p-3.5 bg-primary-bg text-primary rounded-2xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted font-bold">إجمالي الطلبة</p>
            <p className="text-2xl font-extrabold text-main mt-1 tracking-tight">
              {toLatinDigits(totalStudents)}
            </p>
          </div>
        </div>

        <div className="card !p-5 flex items-center gap-4">
          <div className="p-3.5 bg-primary-bg text-primary rounded-2xl shrink-0">
            <School className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted font-bold">عدد الصفوف</p>
            <p className="text-2xl font-extrabold text-main mt-1 tracking-tight">
              {toLatinDigits(totalClasses)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Three equal information cards ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Card 1 — Counseling records (green/pastel accents): work & action */}
        <div className="card !p-0 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-divider-color">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-[#16A34A] text-white rounded-xl shrink-0">
                <ClipboardList className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-main leading-snug">
                  سجلات المرشد التربوي
                </h3>
                <p className="text-[10px] text-muted mt-1 leading-relaxed">
                  الوصول السريع إلى سجلات الإرشاد وحفظ البيانات
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('RECORDS')}
              className="flex items-center gap-1 text-[10px] font-bold text-success hover:opacity-80 shrink-0"
            >
              عرض جميع السجلات
              <ArrowLeft className="w-3 h-3" />
            </button>
          </div>

          <ul className="flex-1 flex flex-col gap-1.5 p-5 pt-4">
            {RECORD_TYPES_INFO.map((item) => (
              <li key={item.type}>
                <button
                  type="button"
                  onClick={() => onOpenRecordsForType?.(item.type)}
                  title={item.name}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-border-color hover:border-primary-border hover:bg-hover text-right"
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.color}`}
                  >
                    <item.icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-main truncate">
                      {item.shortName}
                    </span>
                    <span className="block text-[9px] text-muted truncate mt-0.5">{item.desc}</span>
                  </span>
                  <ArrowLeft className="w-3.5 h-3.5 text-muted shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* Card 2 — Telegram channels (blue accent): resource discovery */}
        <div className="card !p-0 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-divider-color">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-[#229ED9] text-white rounded-xl shrink-0">
                <TelegramGlyph className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-main leading-snug">
                  قنوات تيليغرام مفيدة للمرشد التربوي
                </h3>
                <p className="text-[10px] text-muted mt-1 leading-relaxed">
                  مصادر مختارة تساعدك في عملك الإرشادي والتربوي
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between gap-4 p-5 pt-4">
            <ul className="space-y-2">
              {visibleChannels.map((chan) => (
                <li key={chan.id}>
                  <a
                    href={chan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border-color hover:border-primary-border hover:bg-hover"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${chan.color}`}
                    >
                      {chan.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-main truncate">{chan.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted" dir="ltr">
                          {chan.username}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${chan.color}`}>
                          {chan.tag}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted shrink-0" />
                  </a>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => onNavigate('SETTINGS')}
              className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary-hover self-start"
            >
              عرض جميع القنوات
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

