/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Plus, Trash2, Edit, FileText, Users, Upload, ChevronLeft,
  ArrowUpDown, Eye, UserPlus, AlertCircle, CheckCircle, X, RefreshCw, Filter,
  Download, FileSpreadsheet, MapPin, ArrowRight, Sparkles
} from 'lucide-react';
import { Student, CounselorProfile, CounselingRecord } from '../types';
import { GetGradesFromProfile, normalizeClassGrade, normalizeExcelDate } from '../lib/gradeService';
import { academicYear } from '../lib/format';

// Helper: display birthDate — if it's an Excel serial number string, convert it
function displayDate(val: string): string {
  if (!val) return '';
  const converted = normalizeExcelDate(val);
  return converted !== val ? converted : val;
}
import ImportWizard from './ImportWizard';
import { STUDENT_FORM_FIELDS, STUDENT_FIELD_KEYS } from '../lib/studentFormFields';

interface StudentManagementViewProps {
  students: Student[];
  records: CounselingRecord[];
  profile: CounselorProfile;
  onAddStudent: (student: Student) => void;
  onImportStudents?: (students: Student[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onResetData?: () => void;
  onOpenRecords?: () => void;
}

type SortField = 'fullName' | 'classGrade' | 'birthDate' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function StudentManagementView({
  students, records, profile, onAddStudent, onImportStudents, onUpdateStudent, onDeleteStudent, onResetData, onOpenRecords
}: StudentManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterGrade, setFilterGrade] = useState('');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [printStudent, setPrintStudent] = useState<Student | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formSiblingOrder, setFormSiblingOrder] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formFatherAlive, setFormFatherAlive] = useState('');
  const [formFatherEducation, setFormFatherEducation] = useState('');
  const [formFatherJob, setFormFatherJob] = useState('');
  const [formFatherPhone, setFormFatherPhone] = useState('');
  const [formFatherDeathInfo, setFormFatherDeathInfo] = useState('');
  const [formMotherName, setFormMotherName] = useState('');
  const [formMotherAlive, setFormMotherAlive] = useState('');
  const [formMotherEducation, setFormMotherEducation] = useState('');
  const [formMotherJob, setFormMotherJob] = useState('');
  const [formMotherPhone, setFormMotherPhone] = useState('');
  const [formMotherDeathInfo, setFormMotherDeathInfo] = useState('');
  const [formLivesWith, setFormLivesWith] = useState('');
  const [formAltPhone, setFormAltPhone] = useState('');
  const [formHousingType, setFormHousingType] = useState('');
  const [formIsEmployed, setFormIsEmployed] = useState('');
  const [formEmploymentDetails, setFormEmploymentDetails] = useState('');
  const [formChronicDisease, setFormChronicDisease] = useState('');
  const [formDiseaseDetails, setFormDiseaseDetails] = useState('');
  const [formSeesSpecialist, setFormSeesSpecialist] = useState('');
  const [formSpecialistDetails, setFormSpecialistDetails] = useState('');
  const [formMentalState, setFormMentalState] = useState('');
  const [formAcademicDelay, setFormAcademicDelay] = useState('');
  const [formTalents, setFormTalents] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (printStudent) {
      const timer = setTimeout(() => { window.print(); setPrintStudent(null); }, 150);
      return () => clearTimeout(timer);
    }
  }, [printStudent]);

  const filteredStudents = useMemo(() => {
    let result = [...students];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.fullName.toLowerCase().includes(term) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(term)) ||
        s.classGrade.toLowerCase().includes(term)
      );
    }
    if (filterGrade) result = result.filter(s => s.classGrade === filterGrade);
    result.sort((a, b) => {
      const aVal = (a[sortField] || '').toString();
      const bVal = (b[sortField] || '').toString();
      const cmp = aVal.localeCompare(bVal, 'ar');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [students, searchTerm, sortField, sortDir, filterGrade]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const resetForm = () => {
    setFormName(''); setFormGrade(''); setFormBirthDate(''); setFormNationalId('');
    setFormSiblingOrder(''); setFormAddress(''); setFormFatherName(''); setFormFatherAlive('');
    setFormFatherEducation(''); setFormFatherJob(''); setFormFatherPhone(''); setFormFatherDeathInfo('');
    setFormMotherName(''); setFormMotherAlive(''); setFormMotherEducation(''); setFormMotherJob('');
    setFormMotherPhone(''); setFormMotherDeathInfo(''); setFormLivesWith(''); setFormAltPhone('');
    setFormHousingType(''); setFormIsEmployed(''); setFormEmploymentDetails(''); setFormChronicDisease('');
    setFormDiseaseDetails(''); setFormSeesSpecialist(''); setFormSpecialistDetails(''); setFormMentalState('');
    setFormAcademicDelay(''); setFormTalents('');
  };

  const handleStartEdit = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.fullName); setFormGrade(student.classGrade); setFormBirthDate(student.birthDate);
    setFormNationalId(student.nationalId); setFormSiblingOrder(student.siblingOrder); setFormAddress(student.address);
    setFormFatherName(student.fatherName); setFormFatherAlive(student.fatherAlive);
    setFormFatherEducation(student.fatherEducation); setFormFatherJob(student.fatherJob);
    setFormFatherPhone(student.fatherPhone); setFormFatherDeathInfo(student.fatherDeathInfo);
    setFormMotherName(student.motherName); setFormMotherAlive(student.motherAlive);
    setFormMotherEducation(student.motherEducation); setFormMotherJob(student.motherJob);
    setFormMotherPhone(student.motherPhone); setFormMotherDeathInfo(student.motherDeathInfo);
    setFormLivesWith(student.livesWith); setFormAltPhone(student.altPhone); setFormHousingType(student.housingType);
    setFormIsEmployed(student.isEmployed); setFormEmploymentDetails(student.employmentDetails);
    setFormChronicDisease(student.chronicDisease); setFormDiseaseDetails(student.diseaseDetails);
    setFormSeesSpecialist(student.seesSpecialist); setFormSpecialistDetails(student.specialistDetails);
    setFormMentalState(student.mentalState); setFormAcademicDelay(student.academicDelay); setFormTalents(student.talents);
    setShowAddDialog(true);
  };

  const handleViewStudent = async (student: Student) => {
    setViewingStudent(student);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formGrade.trim()) { alert('الرجاء ملء الحقول الأساسية: الاسم، الصف.'); return; }
    const studentData: Student = {
      id: editingStudent?.id || 'std_' + Date.now(),
      createdAt: editingStudent?.createdAt || new Date().toISOString(),
      fullName: formName.trim(),
      classGrade: formGrade.trim(),
      birthDate: formBirthDate,
      nationalId: formNationalId,
      siblingOrder: formSiblingOrder,
      address: formAddress,
      fatherName: formFatherName,
      fatherAlive: formFatherAlive,
      fatherEducation: formFatherEducation,
      fatherJob: formFatherJob,
      fatherPhone: formFatherPhone,
      fatherDeathInfo: formFatherDeathInfo,
      motherName: formMotherName,
      motherAlive: formMotherAlive,
      motherEducation: formMotherEducation,
      motherJob: formMotherJob,
      motherPhone: formMotherPhone,
      motherDeathInfo: formMotherDeathInfo,
      livesWith: formLivesWith,
      altPhone: formAltPhone,
      housingType: formHousingType,
      isEmployed: formIsEmployed,
      employmentDetails: formEmploymentDetails,
      chronicDisease: formChronicDisease,
      diseaseDetails: formDiseaseDetails,
      seesSpecialist: formSeesSpecialist,
      specialistDetails: formSpecialistDetails,
      mentalState: formMentalState,
      academicDelay: formAcademicDelay,
      talents: formTalents,
    };
    if (editingStudent) onUpdateStudent(studentData);
    else onAddStudent(studentData);
    resetForm(); setEditingStudent(null); setShowAddDialog(false);
  };

  const getStudentRecordCount = (studentId: string) => records.filter(r => r.studentId === studentId).length;

  const handleImportStudents = (items: Student[]) => {
    if (onImportStudents) onImportStudents(items);
    else items.forEach(s => onAddStudent(s));
  };

  const handleExportStudentData = async (student: Student) => {
    try {
      const XLSX = await import('xlsx');
      const thinBorder = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      const studentData: Record<string, string> = {
        'اسم الطالب الرباعي واللقب': student.fullName,
        'الصف': student.classGrade,
        'تاريخ الميلاد': student.birthDate,
        'رقم البطاقة الموحدة/الجنسية': student.nationalId || '',
        'ترتيب التلميذ بين إخوانه وأخواته': student.siblingOrder || '',
        'العنوان': student.address,
        'اسم الأب الثلاثي': student.fatherName || '',
        'هل الأب على قيد الحياة': student.fatherAlive || '',
        'التحصيل الدراسي للأب': student.fatherEducation || '',
        'مهنة الأب ومكان العمل': student.fatherJob || '',
        'رقم هاتف الأب': student.fatherPhone || '',
        'سنة وسبب وفاة الأب': student.fatherDeathInfo || '',
        'اسم الأم الثلاثي': student.motherName || '',
        'هل الأم على قيد الحياة': student.motherAlive || '',
        'التحصيل الدراسي للأم': student.motherEducation || '',
        'مهنة الأم ومكان العمل': student.motherJob || '',
        'رقم هاتف الأم': student.motherPhone || '',
        'سنة وسبب وفاة الأم': student.motherDeathInfo || '',
        'يعيش الطالب مع': student.livesWith || '',
        'رقم الهاتف البديل': student.altPhone || '',
        'نوع السكن': student.housingType || '',
        'هل الطالب يعمل': student.isEmployed || '',
        'نوع العمل ومكانه': student.employmentDetails || '',
        'هل يعاني من مرض مزمن': student.chronicDisease || '',
        'ما هو المرض ومنذ متى': student.diseaseDetails || '',
        'هل يراجع طبيب اختصاص': student.seesSpecialist || '',
        'اسم الطبيب واختصاصه': student.specialistDetails || '',
        'الحالة النفسية/الجسدية': student.mentalState || '',
        'سنوات الرسوب أو التأخير': student.academicDelay || '',
        'المواهب': student.talents || '',
      };
      const headers = Object.keys(studentData);
      const values = Object.values(studentData);
      const wsData = [headers, values];
      const studentSheet = XLSX.utils.aoa_to_sheet(wsData);
      studentSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (studentSheet[ref]) studentSheet[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E40AF' } }, alignment: { horizontal: 'right', vertical: 'center', wrapText: true }, border: thinBorder };
      }
      for (let c = 0; c < values.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 1, c });
        if (studentSheet[ref]) studentSheet[ref].s = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center', wrapText: true }, border: thinBorder };
      }
      studentSheet['!rows'] = [{ hpt: 30 }, { hpt: 25 }];
      const studentRecords = records.filter(r => r.studentId === student.id);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, studentSheet, 'بيانات الطالب');
      if (studentRecords.length > 0) {
        const recordRows = studentRecords.map((r, i) => ({ 'ت': i + 1, 'العنوان': r.title, 'التاريخ': r.date, 'النوع': r.recordType, 'الوصف': r.description || '' }));
        const recHeaders = Object.keys(recordRows[0]);
        const recData = [recHeaders, ...recordRows.map(r => recHeaders.map(h => (r as any)[h] || ''))];
        const recordsSheet = XLSX.utils.aoa_to_sheet(recData);
        recordsSheet['!cols'] = recHeaders.map(() => ({ wch: 20 }));
        for (let c = 0; c < recHeaders.length; c++) {
          const ref = XLSX.utils.encode_cell({ r: 0, c });
          if (recordsSheet[ref]) recordsSheet[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: thinBorder };
        }
        XLSX.utils.book_append_sheet(wb, recordsSheet, 'السجلات');
      }
      XLSX.writeFile(wb, `student-${student.fullName}.xlsx`);
    } catch (err: any) { alert('فشل التصدير: ' + (err.message || '')); }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['الاسم الكامل', 'الصف', 'تاريخ الميلاد', 'رقم البطاقة', 'ترتيب الطالب', 'العنوان',
        'اسم الأب', 'الأب على قيد الحياة', 'تحصيل الأب', 'مهنة الأب', 'هاتف الأب', 'وفاة الأب',
        'اسم الأم', 'الأم على قيد الحياة', 'تحصيل الأم', 'مهنة الأم', 'هاتف الأم', 'وفاة الأم',
        'يعيش مع', 'هاتف بديل', 'نوع السكن', 'يعمل', 'نوع العمل', 'مرض مزمن', 'تفاصيل المرض',
        'طبيب اختصاص', 'اسم الطبيب', 'الحالة النفسية', 'التأخير الدراسي', 'المواهب'];
      const rows = filteredStudents.map(s => ({
        'الاسم الكامل': s.fullName, 'الصف': s.classGrade, 'تاريخ الميلاد': s.birthDate,
        'رقم البطاقة': s.nationalId || '', 'ترتيب الطالب': s.siblingOrder || '', 'العنوان': s.address,
        'اسم الأب': s.fatherName || '', 'الأب على قيد الحياة': s.fatherAlive || '',
        'تحصيل الأب': s.fatherEducation || '', 'مهنة الأب': s.fatherJob || '',
        'هاتف الأب': s.fatherPhone || '', 'وفاة الأب': s.fatherDeathInfo || '',
        'اسم الأم': s.motherName || '', 'الأم على قيد الحياة': s.motherAlive || '',
        'تحصيل الأم': s.motherEducation || '', 'مهنة الأم': s.motherJob || '',
        'هاتف الأم': s.motherPhone || '', 'وفاة الأم': s.motherDeathInfo || '',
        'يعيش مع': s.livesWith || '', 'هاتف بديل': s.altPhone || '', 'نوع السكن': s.housingType || '',
        'يعمل': s.isEmployed || '', 'نوع العمل': s.employmentDetails || '',
        'مرض مزمن': s.chronicDisease || '', 'تفاصيل المرض': s.diseaseDetails || '',
        'طبيب اختصاص': s.seesSpecialist || '', 'اسم الطبيب': s.specialistDetails || '',
        'الحالة النفسية': s.mentalState || '', 'التأخير الدراسي': s.academicDelay || '',
        'المواهب': s.talents || '',
      }));
      const ws: Record<string, unknown> = {};
      const thinBorder = { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } };
      const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '2D8CFF' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: false }, border: thinBorder };
      const cellStyle = { alignment: { vertical: 'center' as const, wrapText: false }, border: thinBorder };
      const colWidths: number[] = headers.map(() => 8);
      headers.forEach((h, ci) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: ci }); ws[ref] = { v: h, t: 's', s: headerStyle };
        colWidths[ci] = Math.max(colWidths[ci], Math.min(Math.max(h.length * 1.8, 12), 40));
      });
      rows.forEach((row, ri) => {
        headers.forEach((h, ci) => {
          const val = row[h] || ''; const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          ws[ref] = { v: val, t: 's', s: cellStyle }; colWidths[ci] = Math.max(colWidths[ci], Math.min(val.length * 1.5, 50));
        });
      });
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } });
      ws['!cols'] = colWidths.map(w => ({ wch: Math.ceil(w) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
      XLSX.writeFile(wb, 'قائمة_الطلاب_' + new Date().toISOString().split('T')[0] + '.xlsx');
    } catch { alert('حدث خطأ أثناء التصدير.'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-office-blue" />
            <span>إدارة شؤون الطلاب</span>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 px-2.5 py-0.5 rounded-full font-bold">{students.length} طالب</span>
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">إضافة وتعديل وحذف وطباعة واستيراد وتصدير ملفات الطلاب.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="file" ref={fileInputRef} className="hidden" />
          <button onClick={() => setShowImportWizard(true)} className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-xs font-black py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"><FileSpreadsheet className="w-4 h-4" />استيراد من Excel</button>
          <button
            onClick={() => {
              if (!onResetData) return;
              if (confirm('هل أنت متأكد من رغبتك في حذف الطلاب والحالات الافتراضية؟ (سيتم تصفير إحصائيات الطلاب والحالات المفتوحة في لوحة التحكم، مع الاحتفاظ بسجلات النشاط اليومي)')) {
                onResetData();
                alert('تمت تهيئة البيانات بنجاح وتصفير الطلاب والحالات الافتراضية.');
              }
            }}
            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-xs font-black py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Data</span>
          </button>
          <button onClick={handleExportExcel} disabled={filteredStudents.length === 0} className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 text-office-blue dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 text-xs font-black py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"><Download className="w-4 h-4" />تصدير إلى Excel</button>
          <button onClick={() => { resetForm(); setEditingStudent(null); setShowAddDialog(true); }} className="bg-office-blue hover:bg-office-hover text-white text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"><UserPlus className="w-4 h-4" />تسجيل طالب جديد</button>
        </div>
      </div>

      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="بحث بالاسم..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg pr-10 pl-3 py-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" />
          </div>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none">
            <option value="">جميع الصفوف</option>
            {GetGradesFromProfile(profile).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="card bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-[#0f172a] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('fullName')}><span className="flex items-center gap-1">اسم الطالب<ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('classGrade')}><span className="flex items-center gap-1">الصف<ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('birthDate')}><span className="flex items-center gap-1">تاريخ الميلاد<ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="p-3">السجلات</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (

                <tr><td colSpan={5} className="p-12 text-center">
                  <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{searchTerm || filterGrade ? 'لا توجد نتائج' : 'لا يوجد طالب مسجل'}</p>
                </td></tr>
              ) : filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-colors">
                  <td className="p-3">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{student.fullName}</span>
                      {student.fatherName && <span className="text-[10px] text-slate-400 dark:text-slate-500 block">أب: {student.fatherName}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{student.classGrade}</td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{displayDate(student.birthDate)}</td>
                  <td className="p-3 text-center"><span className="px-2 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 rounded-md font-mono font-black border border-blue-100 dark:border-blue-900/40">{getStudentRecordCount(student.id)}</span></td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleViewStudent(student)} className="p-1.5 text-slate-400 hover:text-office-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" title="عرض الملف"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleStartEdit(student)} className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" title="تعديل"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleExportStudentData(student)} className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" title="تصدير"><Download className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm(`حذف الطالب (${student.fullName})؟`)) onDeleteStudent(student.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserPlus className="w-5 h-5 text-office-blue" />{editingStudent ? 'تعديل بيانات الطالب' : 'تسجيل طالب جديد في النظام'}</h3>
              <button onClick={() => { setShowAddDialog(false); setEditingStudent(null); resetForm(); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">إسم الطالب الرباعي واللقب: *</label><input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الصف: *</label><input type="text" required value={formGrade} onChange={e => setFormGrade(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">تاريخ الميلاد:</label><input type="date" value={formBirthDate} onChange={e => setFormBirthDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">رقم البطاقة الموحدة / الجنسية:</label><input type="text" value={formNationalId} onChange={e => setFormNationalId(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">ترتيب التلميذ بين إخوانه وأخواته:</label><input type="text" value={formSiblingOrder} onChange={e => setFormSiblingOrder(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">العنوان:</label><input type="text" value={formAddress} onChange={e => setFormAddress(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>

              <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 pt-2 border-t border-slate-100 dark:border-slate-800">معلومات الأب</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">إسم الأب الثلاثي:</label><input type="text" value={formFatherName} onChange={e => setFormFatherName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل الأب على قيد الحياة؟</label><select value={formFatherAlive} onChange={e => setFormFatherAlive(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">التحصيل الدراسي للأب:</label><input type="text" value={formFatherEducation} onChange={e => setFormFatherEducation(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">المهنة ومكان العمل:</label><input type="text" value={formFatherJob} onChange={e => setFormFatherJob(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">رقم هاتف الأب:</label><input type="text" value={formFatherPhone} onChange={e => setFormFatherPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">سنة الوفاة و السبب؟:</label><input type="text" value={formFatherDeathInfo} onChange={e => setFormFatherDeathInfo(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              </div>

              <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 pt-2 border-t border-slate-100 dark:border-slate-800">معلومات الأم</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">إسم الأم الثلاثي:</label><input type="text" value={formMotherName} onChange={e => setFormMotherName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل الأم على قيد الحياة؟</label><select value={formMotherAlive} onChange={e => setFormMotherAlive(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">التحصيل الدراسي للأم:</label><input type="text" value={formMotherEducation} onChange={e => setFormMotherEducation(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">المهنة ومكان العمل:</label><input type="text" value={formMotherJob} onChange={e => setFormMotherJob(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">رقم هاتف الأم:</label><input type="text" value={formMotherPhone} onChange={e => setFormMotherPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">سنة الوفاة والسبب؟:</label><input type="text" value={formMotherDeathInfo} onChange={e => setFormMotherDeathInfo(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              </div>

              <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 pt-2 border-t border-slate-100 dark:border-slate-800">المعيشة والسكن</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">يعيش الطالب مع:</label><input type="text" value={formLivesWith} onChange={e => setFormLivesWith(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">إذا كان الطالب يعيش مع أحد آخر غير والديه يرجى إضافة رقم الهاتف:</label><input type="text" value={formAltPhone} onChange={e => setFormAltPhone(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">نوع السكن:</label><input type="text" value={formHousingType} onChange={e => setFormHousingType(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              </div>

              <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 pt-2 border-t border-slate-100 dark:border-slate-800">العمل والصحة</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل الطالب يعمل؟</label><select value={formIsEmployed} onChange={e => setFormIsEmployed(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">نوع العمل ومكانه؟:</label><input type="text" value={formEmploymentDetails} onChange={e => setFormEmploymentDetails(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل يعاني الطالب من مرض مزمن؟</label><select value={formChronicDisease} onChange={e => setFormChronicDisease(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">ما هو المرض ومنذ متى؟:</label><input type="text" value={formDiseaseDetails} onChange={e => setFormDiseaseDetails(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل يراجع الطالب طبيب إختصاص؟</label><select value={formSeesSpecialist} onChange={e => setFormSeesSpecialist(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">إسم الطبيب وإختصاصه الدقيق:</label><input type="text" value={formSpecialistDetails} onChange={e => setFormSpecialistDetails(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              </div>

              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">ما الحالة النفسية / الجسدية التي يعاني منها الطالب؟ مثال (انطواء - انعزال - ضعف في السمع - ضعف في النظر) إن وجدت:</label><input type="text" value={formMentalState} onChange={e => setFormMentalState(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">هل توجد سنوات رسوب أو تأخير في الدراسة؟ يرجى ذكرها مع السبب إن وجدت:</label><input type="text" value={formAcademicDelay} onChange={e => setFormAcademicDelay(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">هل يملك الطالب مواهب؟ يرجى ذكرها:</label><input type="text" value={formTalents} onChange={e => setFormTalents(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => { setShowAddDialog(false); setEditingStudent(null); resetForm(); }} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer">إلغاء</button>
                <button type="submit" className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm">{editingStudent ? 'تحديث وحفظ التعديلات' : 'حفظ الطالب في النظام'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Eye className="w-5 h-5 text-office-blue" />الملف الشخصي للطالب</h3>
              <button onClick={() => setViewingStudent(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-office-blue/10 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto border-2 border-office-blue/20">
                  <span className="text-xl font-black text-office-blue dark:text-blue-400">{viewingStudent.fullName.charAt(0)}</span>
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{viewingStudent.fullName}</h2>
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 rounded-full font-bold border border-blue-100 dark:border-blue-900/40">{viewingStudent.classGrade}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">المعلومات الشخصية</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">تاريخ الميلاد:</span><span className="font-bold text-slate-800 font-mono">{displayDate(viewingStudent.birthDate) || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">رقم البطاقة:</span><span className="font-bold text-slate-800">{viewingStudent.nationalId || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">ترتيب الطالب:</span><span className="font-bold text-slate-800">{viewingStudent.siblingOrder || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">العنوان:</span><span className="font-bold text-slate-800">{viewingStudent.address || '—'}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">معلومات الأب</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الأب:</span><span className="font-bold text-slate-800">{viewingStudent.fatherName || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">على قيد الحياة:</span><span className="font-bold text-slate-800">{viewingStudent.fatherAlive || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">التحصيل الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.fatherEducation || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">المهنة:</span><span className="font-bold text-slate-800">{viewingStudent.fatherJob || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.fatherPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">الوفاة:</span><span className="font-bold text-slate-800">{viewingStudent.fatherDeathInfo || '—'}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">معلومات الأم</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الأم:</span><span className="font-bold text-slate-800">{viewingStudent.motherName || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">على قيد الحياة:</span><span className="font-bold text-slate-800">{viewingStudent.motherAlive || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">التحصيل الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.motherEducation || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">المهنة:</span><span className="font-bold text-slate-800">{viewingStudent.motherJob || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.motherPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">الوفاة:</span><span className="font-bold text-slate-800">{viewingStudent.motherDeathInfo || '—'}</span></div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">المعيشة والسكن</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">يعيش مع:</span><span className="font-bold text-slate-800">{viewingStudent.livesWith || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف بديل:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.altPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">نوع السكن:</span><span className="font-bold text-slate-800">{viewingStudent.housingType || '—'}</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">العمل والصحة والمواهب</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between"><span className="font-bold text-slate-500">يعمل:</span><span className="font-bold text-slate-800">{viewingStudent.isEmployed || '—'}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">نوع العمل:</span><span className="font-bold text-slate-800">{viewingStudent.employmentDetails || '—'}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">مرض مزمن:</span><span className="font-bold text-slate-800">{viewingStudent.chronicDisease || '—'}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">تفاصيل المرض:</span><span className="font-bold text-slate-800">{viewingStudent.diseaseDetails || '—'}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">طبيب اختصاص:</span><span className="font-bold text-slate-800">{viewingStudent.seesSpecialist || '—'}</span></div>
                  <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الطبيب:</span><span className="font-bold text-slate-800">{viewingStudent.specialistDetails || '—'}</span></div>
                  <div className="flex justify-between col-span-2"><span className="font-bold text-slate-500">الحالة النفسية/الجسدية:</span><span className="font-bold text-slate-800">{viewingStudent.mentalState || '—'}</span></div>
                  <div className="flex justify-between col-span-2"><span className="font-bold text-slate-500">التأخير الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.academicDelay || '—'}</span></div>
                  <div className="flex justify-between col-span-2"><span className="font-bold text-slate-500">المواهب:</span><span className="font-bold text-slate-800">{viewingStudent.talents || '—'}</span></div>
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30 flex justify-between items-center">
                <p className="text-xs font-black text-blue-800 dark:text-blue-300">السجلات الإرشادية: {getStudentRecordCount(viewingStudent.id)} سجلات</p>
                {onOpenRecords && <button onClick={() => { setViewingStudent(null); onOpenRecords(); }} className="bg-office-blue hover:bg-office-hover text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1">فتح السجلات<ChevronLeft className="w-3.5 h-3.5" /></button>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setViewingStudent(null); handleStartEdit(viewingStudent); }} className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"><Edit className="w-3.5 h-3.5" />تعديل</button>
                <button onClick={() => handleExportStudentData(viewingStudent)} className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />تصدير السجلات</button>
                <button onClick={() => setViewingStudent(null)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportWizard && (
        <ImportWizard<Student>
          formFields={STUDENT_FORM_FIELDS}
          fieldKeys={STUDENT_FIELD_KEYS}
          factory={() => ({
            id: 'std_import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            fullName: '', classGrade: '', birthDate: '', nationalId: '', siblingOrder: '',
            address: '', fatherName: '', fatherAlive: '', fatherEducation: '', fatherJob: '',
            fatherPhone: '', fatherDeathInfo: '', motherName: '', motherAlive: '',
            motherEducation: '', motherJob: '', motherPhone: '', motherDeathInfo: '',
            livesWith: '', altPhone: '', housingType: '', isEmployed: '', employmentDetails: '',
            chronicDisease: '', diseaseDetails: '', seesSpecialist: '', specialistDetails: '',
            mentalState: '', academicDelay: '', talents: '', createdAt: new Date().toISOString()
          })}
          transforms={{ classGrade: normalizeClassGrade, birthDate: normalizeExcelDate }}
          onImport={handleImportStudents}
          onClose={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
}
