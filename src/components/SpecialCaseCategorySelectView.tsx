/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SpecialCaseCategorySelectView — 3-card category picker for Special Cases.
 * User selects one category before loading the correct form.
 */

import { useState } from 'react';
import { ArrowRight, GraduationCap, Clock, UserX, Sparkles } from 'lucide-react';
import { SpecialCaseCategory, SPECIAL_CASE_CATEGORY_LABELS } from '../types';

const CATEGORIES: { key: SpecialCaseCategory; icon: typeof GraduationCap; desc: string }[] = [
  {
    key: 'GIFTED_TALENTED',
    icon: Sparkles,
    desc: 'رصد وتوثيق الطلاب المتفوقين والموهوبين والعمل على تنمية قدراتهم واستثمار موهبتهم.',
  },
  {
    key: 'ACADEMIC_DELAYED',
    icon: Clock,
    desc: 'متابعة الطلاب المتأخرين دراسياً ووضع خطط علاجية لتحسين مستوياتهم التعليمية.',
  },
  {
    key: 'ABSENT',
    icon: UserX,
    desc: 'رصد ومتابعة الغائبين بشكل متكرر واتخاذ الإجراءات اللازمة للحد من ظاهرة الغياب.',
  },
];

interface Props {
  onSelect: (category: SpecialCaseCategory) => void;
  onCancel: () => void;
}

export default function SpecialCaseCategorySelectView({ onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<SpecialCaseCategory | null>(null);

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
          <GraduationCap className="w-5 h-5 text-office-blue dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">اختر نوع الحالة الخاصة</h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">اختر الفئة المناسبة لتوثيق الحالة</p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isSelected = selected === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelected(cat.key)}
              className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-office-blue/5 dark:bg-blue-950/20 border-office-blue dark:border-blue-500 shadow-md'
                  : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 hover:border-office-blue/40 dark:hover:border-blue-700 hover:shadow-xs'
              }`}
            >
              <div className={`p-3 rounded-xl mb-3 transition-colors ${
                isSelected
                  ? 'bg-office-blue/10 dark:bg-blue-950/40 text-office-blue dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                <Icon className="w-8 h-8" />
              </div>
              <h3 className={`text-sm font-black mb-2 transition-colors ${
                isSelected
                  ? 'text-office-blue dark:text-blue-400'
                  : 'text-slate-800 dark:text-slate-100'
              }`}>
                {SPECIAL_CASE_CATEGORY_LABELS[cat.key]}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                {cat.desc}
              </p>
              {/* Selection indicator */}
              <div className={`w-5 h-5 rounded-full border-2 mt-4 flex items-center justify-center transition-all ${
                isSelected
                  ? 'border-office-blue bg-office-blue'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-start">
        <button
          onClick={() => { if (selected) onSelect(selected); }}
          disabled={!selected}
          className={`px-6 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm ${
            selected
              ? 'bg-office-blue hover:bg-office-hover text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>التالي</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
