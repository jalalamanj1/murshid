/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Edit,
  MapPin,
  Activity,
  PlusCircle,
  Compass,
  Sparkles,
  ChevronLeft,
  Printer,
  Table,
  Loader2,
  AlertTriangle,
  X,
  Mic
} from 'lucide-react';
import { isExcludedField, FIELD_LABELS } from '../lib/exportFields';
import { academicYear, toLatinDigits } from '../lib/format';
import { localTodayISO, dayFromDate } from '../lib/dateUtils';
import { CounselingRecord, RecordType, Student, DailyActivityItem, CounselorProfile } from '../types';
import VoiceEntryModal from './VoiceEntryModal';
import { DailyActivityDraft } from '../lib/dailyActivityExtract';

interface RecordsListViewProps {
  recordType: RecordType;
  recordTypeName: string;
  records: CounselingRecord[];
  students: Student[];
  profile: CounselorProfile;
  onAddRecord: (newRecord: CounselingRecord) => void;
  onUpdateRecord?: (updatedRecord: CounselingRecord) => void;
  onDeleteRecord: (id: string) => void;
  onBack: () => void;
}

// Custom Auto-Expanding Textarea Component
const AutoExpandingTextArea = ({ 
  value, 
  onChange, 
  placeholder,
  required = false,
  className = ''
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string;
  required?: boolean;
  className?: string;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      rows={2}
      className={`${className} outline-none`}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  );
};

export default function RecordsListView({
  recordType,
  recordTypeName,
  records,
  students,
  profile,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onBack
}: RecordsListViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [printRecord, setPrintRecord] = useState<CounselingRecord | null>(null);

  useEffect(() => {
    if (printRecord) {
      const timer = setTimeout(() => {
        window.print();
        setPrintRecord(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printRecord]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleDailyDocx = async (rec: CounselingRecord) => {
    setExporting(true);
    setExportError('');
    try {
      const electron = (window as any).electronAPI;
      if (!electron || !electron.exportDocx) {
        setExportError('التصدير متاح فقط في تطبيق Electron.');
        setExporting(false);
        return;
      }
      const res = await electron.exportDocx('daily-activity', [rec]);
      if (res && res.ok) {
        const byteChars = atob(res.buffer);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || `daily-activity-${rec.day || ''}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (res) {
        setExportError(res.error || 'فشل التصدير');
      }
    } catch (err: any) {
      setExportError(err.message || 'حدث خطأ');
    } finally {
      setExporting(false);
    }
  };

  const handleDailyXlsx = async (rec: CounselingRecord) => {
    setExportError('');
    try {
      const XLSX = await import('xlsx');
      const acts = Array.isArray(rec.activities) ? rec.activities : [];
      const rows: any[][] = [
        [rec.day || '', '', rec.date || ''],                       // Row 1: day | (empty) | date
        ['النشاط', 'المكان', 'التفاصيل'],                          // Row 2: headers
        ...acts.map((a: any) => [a.activity || '', a.location || '', a.details || '']), // Row 3+: activities
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!dir'] = 'rtl';
      ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'سجل النشاط اليومي');
      XLSX.writeFile(wb, `daily-activity-${rec.day || ''}.xlsx`);
    } catch (err: any) {
      setExportError(err.message || 'فشل تصدير Excel');
    }
  };

  // Standard Form State
  const [title, setTitle] = useState('');
  const [studentId, setStudentId] = useState('');
  const [customStudentName, setCustomStudentName] = useState('');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [status, setStatus] = useState<'COMPLETED' | 'ONGOING' | 'ARCHIVED'>('ONGOING');
  const [date, setDate] = useState(localTodayISO());

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportMode, setExportMode] = useState<'all' | 'range'>('all');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Merge duplicate daily records by date on mount
  useEffect(() => {
    const dailyRecords = records.filter(r => r.recordType === 'DAILY_ACTIVITY_PLAN');
    const dateMap = new Map<string, CounselingRecord>();
    for (const rec of dailyRecords) {
      if (dateMap.has(rec.date)) {
        // Merge activities into the existing record
        const existing = dateMap.get(rec.date)!;
        const existingIds = new Set((existing.activities || []).map(a => a.id));
        const newActivities = (rec.activities || []).filter(a => !existingIds.has(a.id));
        if (newActivities.length > 0) {
          const maxOrder = (existing.activities || []).reduce((max, a) => Math.max(max, a.displayOrder || 0), -1);
          const merged = [
            ...(existing.activities || []),
            ...newActivities.map((a, i) => ({ ...a, displayOrder: maxOrder + 1 + i }))
          ];
          dateMap.set(rec.date, { ...existing, activities: merged });
        }
        // Delete the duplicate from records
        if (onUpdateRecord) onUpdateRecord({ ...rec, activities: [] }); // Mark for deletion
        if (onDeleteRecord) onDeleteRecord(rec.id);
      } else {
        dateMap.set(rec.date, rec);
      }
    }
    // Update merged records back
    const merged = Array.from(dateMap.values());
    for (const rec of merged) {
      const original = dailyRecords.find(r => r.id === rec.id);
      if (original && original.activities?.length !== rec.activities?.length) {
        if (onUpdateRecord) onUpdateRecord(rec);
      }
    }
  }, []);

  // Export daily records as DOCX using the daily-activity template
  const handleExportDocx = async () => {
    setExportingPdf(true);
    try {
      // Gather records to export
      let dailyRecords = records.filter(r => r.recordType === 'DAILY_ACTIVITY_PLAN');
      if (exportMode === 'range' && exportStartDate && exportEndDate) {
        dailyRecords = dailyRecords.filter(r => r.date >= exportStartDate && r.date <= exportEndDate);
      }
      // Sort ascending
      dailyRecords.sort((a, b) => a.date.localeCompare(b.date));
      // Filter weekends
      const weekends = new Set([5, 6]);
      dailyRecords = dailyRecords.filter(r => !weekends.has(new Date(r.date).getDay()));

      if (dailyRecords.length === 0) {
        alert('لا توجد سجلات للتصدير في المجال المحدد.');
        setExportingPdf(false);
        return;
      }

      const electron = (window as any).electronAPI;
      if (!electron?.exportDocx) {
        alert('التصدير متاح فقط في تطبيق المرشد.');
        setExportingPdf(false);
        return;
      }

      // Build the export records — each day becomes one "record" for the template system
      const exportRecords = dailyRecords.map(rec => ({
        day: rec.day || '',
        date: rec.date || '',
        activities: (rec.activities || []).map((a: any) => ({
          activity: a.activity || '',
          place: a.location || '',
          details: a.details || '',
        })),
      }));

      const result = await electron.exportDocx('daily-activity', exportRecords);
      if (result && result.ok) {
        // Decode and download
        const byteChars = atob(result.buffer);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName || `daily-activity-export.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(result?.error || 'فشل التصدير');
      }
    } catch (err: any) {
      alert('فشل التصدير: ' + (err.message || ''));
    } finally {
      setExportingPdf(false);
      setShowExportDialog(false);
    }
  };

  // Specialized State for DAILY_ACTIVITY_PLAN (سجل النشاط اليومي)
  const [day, setDay] = useState('');
  const [activities, setActivities] = useState<DailyActivityItem[]>([
    { id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }
  ]);

  // Filter records matching this type
  const filteredRecords = records.filter(rec => rec.recordType === recordType);

  // Auto detect today's date (the day name derives from the date automatically)
  const handleAutoFill = () => {
    setDate(localTodayISO());
  };

  // The day is always connected to the date: whatever date the user picks,
  // the day name fills in automatically.
  useEffect(() => {
    if (recordType === 'DAILY_ACTIVITY_PLAN') {
      setDay(dayFromDate(date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, recordType]);

  // Add another activity panel
  const handleAddActivity = () => {
    const newAct: DailyActivityItem = {
      id: 'act_' + Date.now() + Math.random().toString(36).substr(2, 5),
      activity: '',
      location: '',
      details: '',
      displayOrder: activities.length
    };
    setActivities([...activities, newAct]);
  };

  // Remove an activity panel
  const handleRemoveActivity = (id: string) => {
    if (activities.length === 1) {
      // Keep at least one, but reset it
      setActivities([{
        id: 'act_1',
        activity: '',
        location: '',
        details: '',
        displayOrder: 0
      }]);
    } else {
      setActivities(activities.filter(act => act.id !== id));
    }
  };

  // Update activity field values
  const handleUpdateActivity = (id: string, field: 'activity' | 'location' | 'details', value: string) => {
    setActivities(activities.map(act => {
      if (act.id === id) {
        return { ...act, [field]: value };
      }
      return act;
    }));
  };

  // Setup form for editing
  const handleStartEdit = (rec: CounselingRecord) => {
    setEditingRecordId(rec.id);
    setDate(rec.date);
    if (rec.recordType === 'DAILY_ACTIVITY_PLAN') {
      setDay(rec.day || '');
      if (rec.activities && rec.activities.length > 0) {
        setActivities(rec.activities);
      } else {
        setActivities([{ id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }]);
      }
    } else {
      setTitle(rec.title);
      setStudentId(rec.studentId || '');
      setCustomStudentName(rec.studentId ? '' : (rec.studentName || ''));
      setDescription(rec.description);
      setActionTaken(rec.actionTaken || '');
      setRecommendations(rec.recommendations || '');
      setStatus(rec.status);
    }
    setShowAddForm(true);
    
    // Scroll to form smoothly
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  // Cancel form
  const handleCancel = () => {
    setEditingRecordId(null);
    setShowAddForm(false);
    
    // Reset standard form fields
    setTitle('');
    setStudentId('');
    setCustomStudentName('');
    setDescription('');
    setActionTaken('');
    setRecommendations('');
    setStatus('ONGOING');
    setDate(localTodayISO());
    
    // Reset specialized fields
    setDay('');
    setActivities([{ id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }]);
  };

  // ── Voice Entry (AI) ──────────────────────────────────────────────
  const [voiceOpen, setVoiceOpen] = useState(false);

  const handleVoiceApply = (draft: DailyActivityDraft) => {
    setEditingRecordId(null);
    setDate(draft.date);
    setDay(dayFromDate(draft.date));
    setActivities(draft.activities.map((a, i) => ({
      id: 'act_voice_' + Date.now() + '_' + i,
      activity: a.activity,
      location: a.location,
      details: a.details,
      displayOrder: i,
    })));
    setVoiceOpen(false);
    setShowAddForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (recordType === 'DAILY_ACTIVITY_PLAN') {
      // Validation for Daily Activity Record
      const validActivities = activities.filter(act => 
        act.activity.trim() !== '' || 
        act.location.trim() !== '' || 
        act.details.trim() !== ''
      );

      if (!day) {
        alert('الرجاء اختيار اليوم.');
        return;
      }
      if (!date) {
        alert('الرجاء تحديد التاريخ.');
        return;
      }
      if (validActivities.length === 0) {
        alert('الرجاء تدوين نشاط واحد على الأقل قبل حفظ السجل.');
        return;
      }

      // Format description as a beautiful fallback plain text
      const formattedDescription = validActivities.map((act, idx) => 
        `النشاط (${idx + 1}): ${act.activity.trim() || 'غير محدد'}\nالمكان: ${act.location.trim() || 'غير محدد'}\nالتفاصيل: ${act.details.trim() || 'بدون تفاصيل'}`
      ).join('\n\n--------------------------------\n\n');

      // Create activity array with normalized displayOrder
      const normalizedActivities = validActivities.map((act, idx) => ({
        ...act,
        activity: act.activity.trim(),
        location: act.location.trim(),
        details: act.details.trim(),
        displayOrder: idx
      }));

      // Check if a daily record already exists for this date
      const existingRecord = records.find(r => r.recordType === 'DAILY_ACTIVITY_PLAN' && r.date === date);
      const isEditing = !!editingRecordId || !!existingRecord;

      if (existingRecord && !editingRecordId) {
        // Merge activities: append new ones to existing
        const existingActs = existingRecord.activities || [];
        const maxOrder = existingActs.reduce((max, a) => Math.max(max, a.displayOrder || 0), -1);
        const mergedActivities = [
          ...existingActs,
          ...normalizedActivities.map((a, i) => ({ ...a, displayOrder: maxOrder + 1 + i }))
        ];
        const updatedRecord: CounselingRecord = {
          ...existingRecord,
          description: mergedActivities.map((act, idx) =>
            `النشاط (${idx + 1}): ${act.activity.trim() || 'غير محدد'}\nالمكان: ${act.location.trim() || 'غير محدد'}\nالتفاصيل: ${act.details.trim() || 'بدون تفاصيل'}`
          ).join('\n\n--------------------------------\n\n'),
          updatedAt: new Date().toISOString(),
          activities: mergedActivities,
        };
        if (onUpdateRecord) onUpdateRecord(updatedRecord);
      } else {
        // Create new record or update existing edit
        const recordPayload: CounselingRecord = {
          id: isEditing ? editingRecordId! : 'rec_' + Date.now(),
          recordType: 'DAILY_ACTIVITY_PLAN',
          date,
          day,
          title: `سجل النشاط اليومي - ${day}`,
          description: formattedDescription,
          actionTaken: 'تم تدوين الأنشطة بنجاح في السجل اليومي للمرشد.',
          recommendations: 'متابعة تنفيذ الأنشطة اليومية المقررة وتحقيق أهداف الإرشاد.',
          status: 'COMPLETED',
          updatedAt: new Date().toISOString(),
          activities: normalizedActivities,
        };

        if (isEditing && onUpdateRecord) {
          onUpdateRecord(recordPayload);
        } else {
          onAddRecord(recordPayload);
        }
      }

      handleCancel();
    } else {
      // Standard Record Validation & Saving
      if (!title.trim() || !description.trim() || !actionTaken.trim() || !recommendations.trim()) {
        alert('الرجاء ملء كافة الحقول الأساسية لتوثيق السجل بنجاح.');
        return;
      }

      let selectedStudentName = '';
      if (studentId) {
        const selectedStudent = students.find(s => s.id === studentId);
        if (selectedStudent) {
          selectedStudentName = selectedStudent.fullName;
        }
      } else {
        selectedStudentName = customStudentName.trim() || 'عام / غير محدد';
      }

      const isEditing = !!editingRecordId;
      const recordPayload: CounselingRecord = {
        id: isEditing ? editingRecordId! : 'rec_' + Date.now(),
        studentId: studentId || undefined,
        studentName: selectedStudentName,
        recordType,
        date,
        title: title.trim(),
        description: description.trim(),
        actionTaken: actionTaken.trim(),
        recommendations: recommendations.trim(),
        status,
        updatedAt: new Date().toISOString()
      };

      if (isEditing && onUpdateRecord) {
        onUpdateRecord(recordPayload);
      } else {
        onAddRecord(recordPayload);
      }

      handleCancel();
    }
  };

  const isDailyActivityRecord = recordType === 'DAILY_ACTIVITY_PLAN';

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
            title="الرجوع لقائمة السجلات"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>{recordTypeName}</span>
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 px-2.5 py-0.5 rounded-full font-bold">
                {toLatinDigits(filteredRecords.length)} سجلات
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-1">
              {isDailyActivityRecord 
                ? 'توثيق الأنشطة اليومية وحفظ خطط العمل المنفذة كأنشطة متسلسلة ومتعددة في سجل واحد.'
                : 'توثيق الحالات والمواقف الإرشادية والتربوية بالتفصيل وفقاً للنماذج الرسمية لوزارة التربية.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isDailyActivityRecord && (
            <button
              onClick={() => setVoiceOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Mic className="w-4 h-4" />
              <span>إدخال صوتي</span>
            </button>
          )}
          {isDailyActivityRecord && (
            <button
              onClick={() => setShowExportDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>تصدير السجل</span>
            </button>
          )}
          <button
            onClick={() => {
              if (showAddForm) {
                handleCancel();
              } else {
                setShowAddForm(true);
              }
            }}
            className="bg-office-blue hover:bg-office-hover text-white text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer w-full sm:w-auto justify-center shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'إغلاق استمارة التدوين' : 'إضافة تدوين جديد بالسجل'}</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="card bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 animate-fade-in">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-office-blue" />
              <span>{editingRecordId ? 'تعديل السجل الحالي' : 'استمارة تدوين موقف إرشادي رسمي جديد'}</span>
            </h4>
            
            {isDailyActivityRecord && (
              <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-[#0f172a] px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 font-mono">
                C# WinForms Styled View
              </span>
            )}
          </div>

          {/* =========================================
              SPECIALIZED DAILY_ACTIVITY_PLAN FORM LAYOUT
              ========================================= */}
          {isDailyActivityRecord ? (
            <div className="space-y-4">
              <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-[#1e293b] shadow-xs">
                {/* Top yellow ledger header block */}
                <div className="grid grid-cols-2 bg-[#FFF7ED] border-b border-border-color text-xs font-black p-3 text-slate-900 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[13px] text-slate-900">اليوم:</span>
                    <span className="inline-block border-b border-dashed border-primary text-slate-900 font-bold outline-none px-2 py-0.5 text-xs w-full max-w-[150px]">
                      {day || '--'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 justify-end sm:justify-start">
                    <span className="font-extrabold text-[13px] text-slate-900">التاريخ:</span>
                    <input 
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-transparent border-b border-dashed border-primary text-slate-900 font-black outline-none px-2 py-0.5 focus:border-office-blue text-xs font-mono w-full max-w-[160px]"
                    />
                    <button 
                      type="button"
                      onClick={handleAutoFill}
                      className="p-1 text-primary hover:bg-[#FFF7ED] rounded-full transition-colors cursor-pointer"
                      title="تعبئة تلقائية لليوم والتاريخ الحالي"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-[#FFF7ED] border-b border-border-color text-slate-900 font-bold text-xs">
                        <th className="py-2.5 px-3 border-l border-slate-300 dark:border-slate-700 text-center font-extrabold text-[13px] w-[25%]">النشاط</th>
                        <th className="py-2.5 px-3 border-l border-slate-300 dark:border-slate-700 text-center font-extrabold text-[13px] w-[20%]">المكان</th>
                        <th className="py-2.5 px-3 text-center font-extrabold text-[13px] w-[55%]">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((act, idx) => (
                        <tr 
                          key={act.id} 
                          className={`${
                            idx % 2 === 0 
                              ? 'bg-white dark:bg-[#1e293b]' 
                              : 'bg-slate-50/50 dark:bg-slate-900/20'
                          } border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 transition-colors`}
                        >
                          {/* Activity Name */}
                          <td className="p-1 border-l border-slate-200 dark:border-slate-700">
                            <input 
                              type="text"
                              placeholder="أدخل عنوان النشاط..."
                              value={act.activity}
                              onChange={(e) => handleUpdateActivity(act.id, 'activity', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0f172a] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-semibold text-center border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-md"
                            />
                          </td>

                          {/* Location */}
                          <td className="p-1 border-l border-slate-200 dark:border-slate-700">
                            <input 
                              type="text"
                              placeholder="الموقع..."
                              value={act.location}
                              onChange={(e) => handleUpdateActivity(act.id, 'location', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0f172a] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-semibold text-center border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-md"
                            />
                          </td>

                          {/* Details & Delete Button */}
                          <td className="p-1 flex items-center gap-1">
                            <input 
                              type="text"
                              placeholder="مخرجات أو تفاصيل الإجراء المتخذ..."
                              value={act.details}
                              onChange={(e) => handleUpdateActivity(act.id, 'details', e.target.value)}
                              className="w-full bg-transparent px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0f172a] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-md flex-1 text-right"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveActivity(act.id)}
                              className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                              title="حذف أو تفريغ هذا الصف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add activity trigger */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-[#0f172a]/20 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 font-bold">
                  * يتم تجاهل وحذف الأسطر الفارغة تلقائياً عند حفظ السجل.
                </span>
                <button 
                  type="button"
                  onClick={handleAddActivity}
                  className="py-1.5 px-4 bg-white dark:bg-[#1e293b] hover:bg-slate-50 border border-slate-200 dark:border-slate-800 text-office-blue dark:text-blue-400 rounded-lg flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ إضافة سطر نشاط آخر</span>
                </button>
              </div>
            </div>
          ) : (
            /* =========================================
                STANDARD RECORD FORM LAYOUT
                ========================================= */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">عنوان الموقف أو الجلسة: *</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: تحسن في سلوك الطالب، انخفاض درجات..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue"
                  />
                </div>

                {/* Student Picker */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">الطالب المعني (من قاعدة البيانات):</label>
                  <select 
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      if (e.target.value) setCustomStudentName('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue"
                  >
                    <option value="">-- اختر طالب من المسجلين --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName} ({s.classGrade})</option>
                    ))}
                  </select>
                </div>

                {/* Custom Student Name if not in list */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">أو اسم الطالب (إذا لم يكن مسجلاً):</label>
                  <input 
                    type="text"
                    disabled={!!studentId}
                    placeholder="اكتب الاسم هنا..."
                    value={customStudentName}
                    onChange={(e) => setCustomStudentName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue disabled:opacity-50"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">تاريخ الإجراء / الجلسة: *</label>
                  <input 
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none font-mono"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">حالة متابعة الملف: *</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none"
                  >
                    <option value="ONGOING">قيد المتابعة والتحري</option>
                    <option value="COMPLETED">مكتملة ومغلقة بنجاح</option>
                    <option value="ARCHIVED">مؤرشفة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">تفاصيل الحالة / المشكلة السلوكية: *</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="اكتب هنا بوضوح تفاصيل المشكلة أو الدافع لهذه الجلسة..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue leading-relaxed"
                  />
                </div>

                {/* Action Taken */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">الإجراء الإرشادي المتخذ: *</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="اكتب الخطوات أو الجلسات الإرشادية التي قمت بها مع الطالب..."
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue leading-relaxed"
                  />
                </div>

                {/* Recommendations */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 block">التوصيات والمتابعة اللاحقة: *</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="ما هي توصياتك للأسرة أو الهيئة التدريسية ومواعيد المتابعة القادمة..."
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Bottom Panel */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {editingRecordId && (
              <button 
                type="button"
                onClick={() => {
                  if (confirm('هل أنت متأكد من رغبتك في حذف هذا السجل بشكل نهائي؟')) {
                    onDeleteRecord(editingRecordId);
                    handleCancel();
                  }
                }}
                className="ml-auto bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                title="حذف هذا السجل نهائياً"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف السجل</span>
              </button>
            )}
            <button 
              type="button"
              onClick={handleCancel}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button 
              type="submit"
              className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm active:scale-98"
            >
              {editingRecordId ? 'تحديث وحفظ التعديلات' : 'حفظ السجل'}
            </button>
          </div>
        </form>
      )}

      {/* Records Cards List */}
      <div className="space-y-4">
        {exportError && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">{exportError}</span>
          </div>
        )}
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3 bg-white dark:bg-[#1e293b]">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#0f172a] flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">السجل فارغ حالياً</h4>
              <p className="text-[11px] text-slate-400">
                لا توجد أي خطط أو أنشطة مسجلة في {recordTypeName} حالياً. اضغط على "إضافة تدوين جديد" للبدء بالتوثيق.
              </p>
            </div>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            if (rec.recordType === 'DAILY_ACTIVITY_PLAN') {
              // Specialized display for DAILY_ACTIVITY_PLAN cards
              const activityCount = rec.activities?.length || 0;
              return (
                <div 
                  key={rec.id} 
                  className="card card-hover border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-150 animate-fade-in"
                >
                  {/* Card Header Bar */}
                  <div className="bg-slate-50 dark:bg-[#0f172a] px-4 py-3.5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/40">
                        <Compass className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                            سجل النشاط اليومي لـ ( {rec.day || 'غير محدد'} )
                          </span>
                          <span className="bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                            {toLatinDigits(activityCount)} أنشطة منفذة
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-white dark:bg-[#0f172a] border border-slate-150 dark:border-slate-850 px-2.5 py-1 rounded-md">
                        <Calendar className="w-3.5 h-3.5 text-office-blue" />
                        <span>{rec.date}</span>
                      </div>

                      <button
                        onClick={() => handleDailyDocx(rec)}
                        disabled={exporting}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50"
                        title="تصدير بصيغة Word"
                      >
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleDailyXlsx(rec)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="تصدير بصيغة Excel"
                      >
                        <Table className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleStartEdit(rec)}
                        className="p-1.5 text-slate-400 hover:text-office-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="تعديل السجل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من رغبتك في حذف هذا السجل الإرشادي بشكل نهائي؟')) {
                            onDeleteRecord(rec.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
                        title="حذف السجل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fully Expanded Activities Container */}
                  <div className="p-5 bg-white dark:bg-[#1e293b]">
                    {/* Visual Ministerial Logbook representation */}
                    <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-[#1e293b] shadow-xs">
                      {/* Top yellow ledger header block */}
                      <div className="grid grid-cols-2 bg-[#FFF7ED] border-b border-border-color text-xs font-black p-3 text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[13px] text-slate-900">اليوم:</span>
                          <span className="font-black text-[13px] border-b border-dashed border-primary pb-0.5 px-2 text-slate-900">
                            {rec.day || 'غير محدد'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 justify-end sm:justify-start">
                          <span className="font-extrabold text-[13px] text-slate-900">التاريخ:</span>
                          <span className="font-mono font-black text-[13px] border-b border-dashed border-primary pb-0.5 px-2 text-slate-900">
                            {rec.date}
                          </span>
                        </div>
                      </div>

                      {/* Ledger Main Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse min-w-[500px]">
                          <thead>
                            <tr className="bg-[#FFF7ED] border-b border-border-color text-slate-900 font-bold text-xs">
                              <th className="py-2.5 px-3 border-l border-slate-300 dark:border-slate-700 text-center font-extrabold text-[13px] w-[25%]">النشاط</th>
                              <th className="py-2.5 px-3 border-l border-slate-300 dark:border-slate-700 text-center font-extrabold text-[13px] w-[20%]">المكان</th>
                              <th className="py-2.5 px-3 text-center font-extrabold text-[13px] w-[55%]">التفاصيل</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rec.activities && rec.activities.length > 0 ? (
                              rec.activities.map((act, index) => (
                                <tr 
                                  key={act.id || index}
                                  className={`${
                                    index % 2 === 0 
                                      ? 'bg-white dark:bg-[#1e293b]' 
                                      : 'bg-slate-50/50 dark:bg-slate-900/20'
                                  } border-b border-slate-200 dark:border-slate-700 hover:bg-sky-50/10 dark:hover:bg-sky-950/10 transition-colors`}
                                >
                                  <td className="py-3 px-3 border-l border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 leading-relaxed text-center">
                                    {act.activity || 'غير محدد'}
                                  </td>
                                  <td className="py-3 px-3 border-l border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 text-center">
                                    {act.location || 'غير محدد'}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 text-right leading-relaxed font-medium whitespace-pre-line">
                                    {act.details || 'لا توجد تفاصيل إضافية'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-6 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                                  لا توجد أنشطة مدونة في هذا السجل اليومي.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Standard display for other minister registers
            return (
              <div 
                key={rec.id} 
                className="card card-hover border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-150 animate-fade-in"
              >
                {/* Standard Card Title Header Bar */}
                <div className="bg-slate-50 dark:bg-[#0f172a] px-4 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      {rec.title}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black ${
                      rec.status === 'COMPLETED' ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                      rec.status === 'ONGOING' ? 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' :
                      'bg-slate-150 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {rec.status === 'COMPLETED' ? 'مكتملة ومغلقة' :
                       rec.status === 'ONGOING' ? 'قيد المتابعة والتحري' :
                       'مؤرشفة'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{rec.date}</span>
                    </div>

                    <button
                      onClick={() => setPrintRecord(rec)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      title="طباعة السجل (صفحة كاملة)"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleStartEdit(rec)}
                      className="p-1.5 text-slate-400 hover:text-office-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      title="تعديل السجل"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm('هل أنت متأكد من رغبتك في حذف هذا السجل الإرشادي بشكل نهائي؟')) {
                          onDeleteRecord(rec.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
                      title="حذف السجل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card Core Details List representation */}
                <div className="p-4 space-y-4">
                  {/* Associated Student Info */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <User className="w-4 h-4 text-office-blue shrink-0" />
                    <span className="font-black text-slate-500 dark:text-slate-400">الطالب المعني:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0f172a] px-3 py-1 rounded-md border border-slate-150">
                      {rec.studentName || 'عام / غير محدد'}
                    </span>
                  </div>

                  {/* Structured Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="bg-slate-50 dark:bg-[#0f172a] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-black text-office-blue dark:text-blue-400 block border-b border-slate-200 dark:border-slate-800 pb-1.5">
                        تفاصيل الموقف / المشكلة السلوكية:
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                        {rec.description}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#0f172a] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-black text-office-blue dark:text-blue-400 block border-b border-slate-200 dark:border-slate-800 pb-1.5">
                        الإجراء الإرشادي المتخذ:
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                        {rec.actionTaken}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#0f172a] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-black text-office-blue dark:text-blue-400 block border-b border-slate-200 dark:border-slate-800 pb-1.5">
                        التوصيات ومتابعة الأثر المستمرة:
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                        {rec.recommendations}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================
          PRINT CONTAINER (Visible only when print is triggered)
         ======================================================== */}
      {printRecord && (
        <div id="counseling-print-container" className="hidden print:block font-sans text-right" dir="rtl">
          {printRecord.recordType === 'DAILY_ACTIVITY_PLAN' ? (
            /* =========================================
                DAILY ACTIVITY PLAN PRINT SHEET
               ========================================= */
            <div className="w-full max-w-4xl mx-auto p-6 border-4 border-double border-slate-800 rounded-xl min-h-[290mm] flex flex-col justify-between bg-white text-black">
              <div>
                {/* Official Ministry Header */}
                <div className="grid grid-cols-3 items-center border-b-2 border-slate-800 pb-4 mb-6">
                  <div className="text-xs space-y-1 text-right font-bold text-black">
                    <p className="font-extrabold text-[14px]">جمهورية العراق</p>
                    <p>وزارة التربية</p>
                    <p>المديرية العامة لتربية {profile.province || 'كركوك'}</p>
                    <p>المدرسة: {profile.schoolName || '..........'}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-full border-2 border-slate-800 flex items-center justify-center mx-auto mb-1">
                      <Compass className="w-8 h-8 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-black text-slate-800">شعار الإرشاد التربوي</p>
                  </div>

                  <div className="text-xs space-y-1 text-left font-bold text-black">
                    <p className="font-extrabold text-[14px]">سجل النشاط اليومي للمرشد</p>
                    <p>العام الدراسي: {academicYear(profile.academicYear) || '2026-2025'}</p>
                    <p>المرشد: {profile.fullName || 'المرشد التربوي'}</p>
                    <p className="font-mono">تاريخ الطباعة: {toLatinDigits(new Date().toISOString().split('T')[0])}</p>
                  </div>
                </div>

                {/* Main Header Title */}
                <div className="text-center my-6">
                  <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-900 pb-2.5 inline-block px-12">
                    سجل النشاط اليومي التفصيلي
                  </h2>
                </div>

                {/* Day / Date Summary Table */}
                <div className="grid grid-cols-2 bg-slate-100 border-2 border-slate-800 rounded-lg p-4 text-sm font-black my-6 text-black">
                  <div>
                    <span className="text-slate-700 font-extrabold text-[14px]">اليوم الفعلي للعمل:</span>
                    <span className="mr-3 text-slate-950 text-[14px] font-black">{printRecord.day || '..........'}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-slate-700 font-extrabold text-[14px]">تاريخ تدوين النشاط:</span>
                    <span className="mr-3 text-slate-950 text-[14px] font-mono font-black">{printRecord.date}</span>
                  </div>
                </div>

                {/* Table Section */}
                <div className="mt-6 border-2 border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-200 border-b-2 border-slate-800 text-slate-950 font-extrabold text-sm">
                        <th className="py-3 px-3 border-l-2 border-slate-800 text-center font-extrabold text-[14px] w-[25%]">النشاط المنفذ</th>
                        <th className="py-3 px-3 border-l-2 border-slate-800 text-center font-extrabold text-[14px] w-[20%]">المكــــان</th>
                        <th className="py-3 px-3 text-center font-extrabold text-[14px] w-[55%]">تفاصيل المتابعة والملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printRecord.activities && printRecord.activities.length > 0 ? (
                        printRecord.activities.map((act, idx) => (
                          <tr key={act.id || idx} className="border-b border-slate-400 last:border-b-0">
                            <td className="py-3 px-3 border-l border-slate-400 text-xs font-black text-slate-900 text-center leading-relaxed">
                              {act.activity || '..........'}
                            </td>
                            <td className="py-3 px-3 border-l border-slate-400 text-xs font-bold text-slate-800 text-center">
                              {act.location || '..........'}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-900 text-right leading-relaxed font-medium whitespace-pre-line">
                              {act.details || '..........'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-12 text-sm text-slate-500 font-bold">
                            لا توجد أي أنشطة مسجلة في هذا اليوم.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures block at bottom */}
              <div className="grid grid-cols-2 text-xs font-bold mt-12 border-t-2 border-slate-800 pt-6 text-black">
                <div className="text-right space-y-2">
                  <p className="font-extrabold text-[13px]">توقيع المرشد التربوي والاجتماعي:</p>
                  <p className="text-slate-800">الاسم الثلاثي: {profile.fullName || '................................'}</p>
                  <p className="text-slate-800">التوقيع الصريح:</p>
                </div>
                <div className="text-left space-y-2">
                  <p className="font-extrabold text-[13px]">مصادقة وتوقيع مدير المدرسة:</p>
                  <p className="text-slate-800">الاسم الثلاثي: ............................................</p>
                  <p className="text-slate-800">التوقيع والختم الرسمي للمدرسة:</p>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================
                STANDARD GENERAL RECORD PRINT SHEET
               ========================================= */
            <div className="w-full max-w-4xl mx-auto p-6 border-4 border-double border-slate-800 rounded-xl min-h-[290mm] flex flex-col justify-between bg-white text-black">
              <div>
                {/* Official Ministry Header */}
                <div className="grid grid-cols-3 items-center border-b-2 border-slate-800 pb-4 mb-6">
                  <div className="text-xs space-y-1 text-right font-bold text-black">
                    <p className="font-extrabold text-[14px]">جمهورية العراق</p>
                    <p>وزارة التربية</p>
                    <p>المديرية العامة لتربية {profile.province || 'كركوك'}</p>
                    <p>المدرسة: {profile.schoolName || '..........'}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-full border-2 border-slate-800 flex items-center justify-center mx-auto mb-1">
                      <FileText className="w-8 h-8 text-slate-800" />
                    </div>
                    <p className="text-[10px] font-black text-slate-800">شعار الإرشاد التربوي</p>
                  </div>

                  <div className="text-xs space-y-1 text-left font-bold text-black">
                    <p className="font-extrabold text-[14px]">{recordTypeName}</p>
                    <p>العام الدراسي: {academicYear(profile.academicYear) || '2026-2025'}</p>
                    <p>المرشد: {profile.fullName || 'المرشد التربوي'}</p>
                    <p className="font-mono">تاريخ الطباعة: {toLatinDigits(new Date().toISOString().split('T')[0])}</p>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center my-6">
                  <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-900 pb-2.5 inline-block px-12">
                    {printRecord.title}
                  </h2>
                </div>

                {/* Student info ledger bar */}
                <div className="grid grid-cols-2 bg-slate-100 border-2 border-slate-800 rounded-lg p-4 text-sm font-black my-6 text-black">
                  <div>
                    <span className="text-slate-700 font-extrabold text-[14px]">الطالب المعني بالملف:</span>
                    <span className="mr-3 text-slate-950 text-[14px] font-black">{printRecord.studentName || 'عام / غير محدد'}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-slate-700 font-extrabold text-[14px]">حالة معالجة الملف:</span>
                    <span className="mr-3 text-slate-950 text-[14px] font-black">
                      {printRecord.status === 'COMPLETED' ? 'مكتملة ومغلقة' :
                       printRecord.status === 'ONGOING' ? 'قيد المتابعة النشطة' :
                       'مؤرشفة للرجوع'}
                    </span>
                  </div>
                </div>

                {/* Content blocks */}
                <div className="space-y-6 mt-8">
                  <div className="border-2 border-slate-800 rounded-lg p-5 bg-white space-y-2 text-black">
                    <h3 className="font-black text-slate-950 text-[14px] border-b-2 border-slate-850 pb-2">
                      أولاً: وصف تفاصيل الموقف / السلوك المرصود:
                    </h3>
                    <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-line font-medium">
                      {printRecord.description}
                    </p>
                  </div>

                  <div className="border-2 border-slate-800 rounded-lg p-5 bg-white space-y-2 text-black">
                    <h3 className="font-black text-slate-950 text-[14px] border-b-2 border-slate-850 pb-2">
                      ثانياً: الإجراءات المتخذة وجلسات الإرشاد المنفذة:
                    </h3>
                    <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-line font-medium">
                      {printRecord.actionTaken}
                    </p>
                  </div>

                  <div className="border-2 border-slate-800 rounded-lg p-5 bg-white space-y-2 text-black">
                    <h3 className="font-black text-slate-950 text-[14px] border-b-2 border-slate-850 pb-2">
                      ثالثاً: التوصيات الإرشادية ومقترحات المتابعة اللاحقة:
                    </h3>
                    <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-line font-medium">
                      {printRecord.recommendations}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signatures block at bottom */}
              <div className="grid grid-cols-2 text-xs font-bold mt-12 border-t-2 border-slate-800 pt-6 text-black">
                <div className="text-right space-y-2">
                  <p className="font-extrabold text-[13px]">توقيع المرشد التربوي والاجتماعي:</p>
                  <p className="text-slate-800">الاسم الثلاثي: {profile.fullName || '................................'}</p>
                  <p className="text-slate-800">التوقيع الصريح:</p>
                </div>
                <div className="text-left space-y-2">
                  <p className="font-extrabold text-[13px]">مصادقة وتوقيع مدير المدرسة:</p>
                  <p className="text-slate-800">الاسم الثلاثي: ............................................</p>
                  <p className="text-slate-800">التوقيع والختم الرسمي للمدرسة:</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowExportDialog(false)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-[420px] p-5 space-y-4"
            onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">تصدير سجل النشاط اليومي</h3>
              <button onClick={() => setShowExportDialog(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                <input type="radio" name="exportMode" checked={exportMode === 'all'} onChange={() => setExportMode('all')} className="accent-office-blue" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">كل السجل</p>
                  <p className="text-[10px] text-slate-400">تصدير جميع الأنشطة اليومية المسجلة</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                <input type="radio" name="exportMode" checked={exportMode === 'range'} onChange={() => setExportMode('range')} className="accent-office-blue" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">حسب التاريخ</p>
                  <p className="text-[10px] text-slate-400">اختيار مجال زمني محدد</p>
                </div>
              </label>

              {exportMode === 'range' && (
                <div className="grid grid-cols-2 gap-3 pr-7">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">من تاريخ:</label>
                    <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">إلى تاريخ:</label>
                    <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2">
                ⚠️ يتم استثناء يومي الجمعة والسبت (العطل الرسمية) تلقائياً.
              </p>
            </div>

            <button
              onClick={handleExportDocx}
              disabled={exportingPdf || (exportMode === 'range' && (!exportStartDate || !exportEndDate))}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{exportingPdf ? 'جاري التصدير...' : 'تصدير DOCX'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Voice Entry (AI) modal */}
      <VoiceEntryModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onApply={handleVoiceApply}
      />
    </div>
  );
}
