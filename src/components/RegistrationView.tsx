/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, School, Calendar, MapPin, Sparkles, BookOpen } from 'lucide-react';
import { CounselorProfile } from '../types';
import { saveProfile } from '../lib/storage';
import { GetGrades, STAGE_LABELS } from '../lib/gradeService';

interface RegistrationViewProps {
  onComplete: (profile: CounselorProfile) => void;
}

const IRAQ_PROVINCES = [
  'بغداد', 'نينوى', 'البصرة', 'ذي قار', 'بابل', 
  'الأنبار', 'النجف', 'كربلاء', 'صلاح الدين', 'كركوك', 
  'ميسان', 'المثنى', 'القادسية', 'واسط', 'ديالى', 
  'دهوك', 'أربيل', 'السليمانية'
];

export default function RegistrationView({ onComplete }: RegistrationViewProps) {
  const [fullName, setFullName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [province, setProvince] = useState('كركوك');
  const [schoolType, setSchoolType] = useState<'PRIMARY' | 'MIDDLE' | 'HIGH' | 'SECONDARY' | 'KINDERGARTEN'>('MIDDLE');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [counselorGender, setCounselorGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('يرجى إدخال اسمك الكامل واللقب لإثبات ملكية رخصة العمل.');
      return;
    }
    if (!schoolName.trim()) {
      setError('يرجى إدخال اسم المدرسة أو المؤسسة التربوية التي تعمل بها.');
      return;
    }

    const profile: CounselorProfile = {
      fullName: fullName.trim(),
      schoolName: schoolName.trim(),
      province,
      schoolType,
      academicYear,
      counselorGender,
      isRegistered: true
    };

    saveProfile(profile);
    onComplete(profile);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm z-50">
      <div 
        id="registration_form"
        className="w-[580px] bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-800"
        dir="rtl"
      >
        {/* Windows Form Title Bar Style */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-office-blue" />
            <span className="text-xs font-bold text-slate-700">إعداد البرنامج لأول مرة - تسجيل المرشد والمدرسة</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-300 block"></span>
            <span className="w-3 h-3 rounded-full bg-slate-300 block"></span>
            <span className="w-3 h-3 rounded-full bg-slate-400 block"></span>
          </div>
        </div>

        {/* Header Ribbon Banner */}
        <div className="bg-gradient-to-r from-office-blue to-office-hover p-5 text-white flex items-center gap-4">
          <div className="bg-white/15 p-2 rounded-lg">
            <Sparkles className="w-8 h-8 text-blue-100" />
          </div>
          <div>
            <h2 className="text-lg font-bold">مرحباً بك في مُرْشِد!</h2>
            <p className="text-xs text-blue-100 mt-0.5">يرجى ملء البيانات التالية بدقة لتكوين هوية وسجلات البرنامج على حاسوبك.</p>
          </div>
        </div>

        {/* Form Details */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Counselor Name */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5" htmlFor="c_name">
                <User className="w-3.5 h-3.5 text-office-blue" />
                الاسم الكامل واللقب للمرشد التربوي:
              </label>
              <input
                id="c_name"
                type="text"
                placeholder="أكتب اسمك الثلاثي الكامل واللقب..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white text-slate-900"
              />
            </div>

            {/* Counselor Gender */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-office-blue" />
                صفة المرشد:
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 flex-1">
                  <input
                    type="radio"
                    name="counselorGender"
                    value="MALE"
                    checked={counselorGender === 'MALE'}
                    onChange={() => setCounselorGender('MALE')}
                    className="accent-office-blue"
                  />
                  مرشد تربوي
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 flex-1">
                  <input
                    type="radio"
                    name="counselorGender"
                    value="FEMALE"
                    checked={counselorGender === 'FEMALE'}
                    onChange={() => setCounselorGender('FEMALE')}
                    className="accent-office-blue"
                  />
                  مرشدة تربوية
                </label>
              </div>
            </div>

            {/* School Name */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5" htmlFor="sch_name">
                <School className="w-3.5 h-3.5 text-office-blue" />
                اسم المدرسة / المؤسسة التربوية:
              </label>
              <input
                id="sch_name"
                type="text"
                placeholder="مثال: مدرسة بابل للبنين، ثانوية المعرفة للبنات..."
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white text-slate-900"
              />
            </div>

            {/* Province Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5" htmlFor="prov">
                <MapPin className="w-3.5 h-3.5 text-office-blue" />
                المحافظة (المديرية العامة للتربية):
              </label>
              <select
                id="prov"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white text-slate-900"
              >
                {IRAQ_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>

            {/* School Type Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5" htmlFor="sch_type">
                المرحلة التعليمية:
              </label>
              <select
                id="sch_type"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white text-slate-900"
              >
                <option value="PRIMARY">المرحلة الابتدائية</option>
                <option value="MIDDLE">المرحلة المتوسطة</option>
                <option value="HIGH">المرحلة الإعدادية</option>
                <option value="SECONDARY">المرحلة الثانوية (متوسط + إعدادي)</option>
              </select>
            </div>

            {/* Grade Preview */}
            <div className="col-span-2 bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-office-blue" />
                <span className="text-[11px] font-bold text-slate-700">
                  الصفوف المتاحة في {STAGE_LABELS[schoolType]}:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GetGrades(schoolType).map((grade) => (
                  <span
                    key={grade}
                    className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[10px] font-bold text-office-blue"
                  >
                    {grade}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-slate-500">
                سيتم تقييد قائمة الصفوف في جميع استمارات التسجيل والبحث والسجلات الإرشادية بهذه الصفوف تحديداً.
              </p>
            </div>

            {/* Academic Year Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5" htmlFor="acad_yr">
                <Calendar className="w-3.5 h-3.5 text-office-blue" />
                العام الدراسي الحالي:
              </label>
              <select
                id="acad_yr"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-office-blue focus:bg-white text-slate-900"
              >
                <option value="2025-2026">2025 - 2026</option>
                <option value="2026-2027">2026 - 2027</option>
                <option value="2027-2028">2027 - 2028</option>
              </select>
            </div>

            <div className="flex items-end justify-end pt-5">
              <button
                type="submit"
                className="w-full bg-office-blue hover:bg-office-hover active:bg-office-hover text-white font-bold py-2.5 px-4 rounded text-xs shadow-sm cursor-pointer transition-colors"
              >
                حفظ وإعداد هوية البرنامج المكتبي
              </button>
            </div>
          </div>
        </form>

        {/* Professional Trademark Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-center text-[10px] text-slate-400">
          برمجة وحقوق الملكية لبرنامج مرشد © Pandara Tech لإلكترونيات الأنظمة المكتبية والبرمجيات المتقدمة.
        </div>
      </div>
    </div>
  );
}
