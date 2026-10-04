import React, { useState } from 'react';
import { User, School, Calendar, MapPin, Sparkles } from 'lucide-react';
import { CounselorProfile } from '../types';
import { saveProfile } from '../lib/storage';

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
      setError('يرجى إدخال اسمك الكامل.');
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50">
      <div 
        id="registration_form"
        className="w-[580px] bg-card rounded-2xl shadow-modal border border-border-color overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="bg-[#FFF7ED] px-5 py-3 border-b border-border-color flex items-center gap-2">
          <School className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-main">إعداد البرنامج لأول مرة - تسجيل المرشد والمدرسة</span>
        </div>

        <div className="bg-primary p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Sparkles className="w-8 h-8 text-white/90" />
            </div>
            <div>
              <h2 className="text-lg font-bold">مرحباً بك في مُرْشِد!</h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {error && (
            <div className="text-xs text-danger bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5 col-span-2">
              <label className="form-label" htmlFor="c_name">
                الاسم الكامل:
              </label>
              <input
                id="c_name"
                type="text"
                placeholder="أكتب اسمك الثلاثي الكامل..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="form-label">صفة المرشد:</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-[#FAFAFA] border border-border-color rounded-xl px-4 py-2.5 text-xs text-slate-900 flex-1 transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-[#FFF7ED]">
                  <input
                    type="radio"
                    name="counselorGender"
                    value="MALE"
                    checked={counselorGender === 'MALE'}
                    onChange={() => setCounselorGender('MALE')}
                    className="accent-primary"
                  />
                  مرشد تربوي
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-[#FAFAFA] border border-border-color rounded-xl px-4 py-2.5 text-xs text-slate-900 flex-1 transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-[#FFF7ED]">
                  <input
                    type="radio"
                    name="counselorGender"
                    value="FEMALE"
                    checked={counselorGender === 'FEMALE'}
                    onChange={() => setCounselorGender('FEMALE')}
                    className="accent-primary"
                  />
                  مرشدة تربوية
                </label>
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="form-label" htmlFor="sch_name">اسم المدرسة:</label>
              <input
                id="sch_name"
                type="text"
                placeholder="مثال: مدرسة بابل للبنين، ثانوية المعرفة للبنات..."
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="form-label" htmlFor="prov">المحافظة:</label>
              <select
                id="prov"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="form-input"
              >
                {IRAQ_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="form-label" htmlFor="sch_type">المرحلة التعليمية:</label>
              <select
                id="sch_type"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value as any)}
                className="form-input"
              >
                <option value="PRIMARY">المرحلة الابتدائية</option>
                <option value="MIDDLE">المرحلة المتوسطة</option>
                <option value="HIGH">المرحلة الإعدادية</option>
                <option value="SECONDARY">المرحلة الثانوية (متوسط + إعدادي)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="form-label" htmlFor="acad_yr">العام الدراسي الحالي:</label>
              <select
                id="acad_yr"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="form-input"
              >
                <option value="2025-2026">2025 - 2026</option>
                <option value="2026-2027">2026 - 2027</option>
                <option value="2027-2028">2027 - 2028</option>
              </select>
            </div>

            <div className="flex items-end justify-end pt-3">
              <button
                type="submit"
                className="btn-primary w-full !py-3 text-xs"
              >
                حفظ وإعداد هوية البرنامج المكتبي
              </button>
            </div>
          </div>
        </form>

        <div className="bg-[#FAFAFA] border-t border-border-color px-6 py-3 text-center text-[10px] text-muted">
          برمجة وحقوق الملكية لبرنامج مرشد ©{' '}
          <a
            href="https://jalalamanj.online"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-hover underline decoration-dotted underline-offset-2"
          >
            Jalal Amanj
          </a>
        </div>
      </div>
    </div>
  );
}
