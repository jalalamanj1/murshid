/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  UserPlus, 
  FilePlus, 
  FolderSync, 
  HeartHandshake, 
  AlertTriangle,
  BookOpen,
  User,
  Award,
  TrendingDown,
  Heart,
  MessageSquare,
  Compass,
  Zap,
  ClipboardList,
  X,
  Trash2,
  Calendar,
  Plus,
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import { Student, CounselingRecord, CounselorProfile, RecordType, DailyActivityItem } from '../types';
import { academicYear } from '../lib/format';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface DashboardViewProps {
  profile: CounselorProfile;
  students: Student[];
  records: CounselingRecord[];
  onNavigate: (module: string) => void;
  onQuickAddStudent?: () => void;
  onQuickAddRecord?: () => void;
  onAddRecord?: (newRecord: CounselingRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  onClearStudentsAndCases?: () => void;
  onOpenRecordsForType?: (recordType: RecordType) => void;
}

export default function DashboardView({ 
  profile, 
  students, 
  records, 
  onNavigate,
  onQuickAddStudent,
  onQuickAddRecord,
  onAddRecord,
  onDeleteRecord,
  onClearStudentsAndCases,
  onOpenRecordsForType
}: DashboardViewProps) {
  
  // Calculate stats
  const totalStudents = students.length;
  const activeRecords = records.filter(r => r.status === 'ONGOING').length;
  const completedRecords = records.filter(r => r.status === 'COMPLETED').length;

  // State for the 9 records modal form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RecordType | null>(null);

  // Form input states
  const [title, setTitle] = useState('');
  const [studentId, setStudentId] = useState('');
  const [customStudentName, setCustomStudentName] = useState('');
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [status, setStatus] = useState<'COMPLETED' | 'ONGOING' | 'ARCHIVED'>('ONGOING');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Specialized State for DAILY_ACTIVITY_PLAN (سجل النشاط اليومي)
  const [day, setDay] = useState('');
  const [activities, setActivities] = useState<DailyActivityItem[]>([
    { id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }
  ]);

  // To-Do List State (persisted in localStorage, starts empty)
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('murshid_todos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newTodoText, setNewTodoText] = useState('');
  const [todoFilter, setTodoFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');



  const saveTodos = (updatedTodos: TodoItem[]) => {
    setTodos(updatedTodos);
    localStorage.setItem('murshid_todos', JSON.stringify(updatedTodos));
    // Sync to bot's file so deletions/additions/toggles persist across both
    const api = (window as any).electronAPI;
    if (api?.telegram?.syncTodos) {
      api.telegram.syncTodos(updatedTodos);
    }
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTask: TodoItem = {
      id: 'todo_' + Date.now(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: new Date().toLocaleDateString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
    };

    saveTodos([newTask, ...todos]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id: string) => {
    const updated = todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    saveTodos(updated);
  };

  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter(todo => todo.id !== id);
    saveTodos(updated);
  };

  const filteredTodos = todos.filter(todo => {
    if (todoFilter === 'ACTIVE') return !todo.completed;
    if (todoFilter === 'COMPLETED') return todo.completed;
    return true;
  });

  // Information about the 9 official records/registers
  const recordTypesInfo = [
    {
      type: 'HEALTH_STATUS' as const,
      name: 'سجل الحالة الصحية',
      icon: Heart,
      desc: 'رصد وتوثيق الحالات الصحية والأمراض المزمنة للطلاب ومتابعة العلاج المدرسي بالتفصيل.',
      color: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
    },
    {
      type: 'SPECIAL_CASES' as const,
      name: 'سجل الحالات الخاصة',
      icon: AlertCircle,
      desc: 'متابعة شؤون الطلاب من ذوي الاحتياجات الخاصة أو الحالات الاجتماعية والمعيشية الحرجة.',
      color: 'bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200'
    },
    {
      type: 'GROUP_INDIVIDUAL' as const,
      name: 'سجل الإرشاد الجمعي والفردي',
      icon: Users,
      desc: 'توثيق جلسات الدعم والاستشارات الفردية والجماعية للطلاب لتحسين التكيف والتحصيل والتربية.',
      color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
    },
    {
      type: 'BEREAVED_STUDENTS' as const,
      name: 'سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)',
      icon: HeartHandshake,
      desc: 'رعاية شؤون الطلاب الأيتام وفاقدي المعيل وتقديم الدعم النفسي والاجتماعي والمادي المتكامل لهم.',
      color: 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
    },
    {
      type: 'CASE_STUDY' as const,
      name: 'سجل دراسة الحالة',
      icon: BookOpen,
      desc: 'دراسة معمقة وبحث تفصيلي متكامل للحالات السلوكية المستعصية والظواهر السلوكية المعقدة.',
      color: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200'
    },
    {
      type: 'HEALTH_KEY_GUIDE' as const,
      name: 'سجل الدليل (المفتاح) لدراسة الحالة',
      icon: Compass,
      desc: 'دليل تصنيف وفك ترميز الأمراض وتوصيات المتابعة الوقائية لجميع الفئات والمراحل الدراسية.',
      color: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200'
    },
    {
      type: 'DAILY_ACTIVITY_PLAN' as const,
      name: 'سجل النشاط اليومي',
      icon: ClipboardList,
      desc: 'توزيع وتنظيم خطة النشاط الإرشادي السنوي والشهري وتدوين اليوميات التنفيذية للعمل الإرشادي.',
      color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
    }
  ];

  // Open modal handler
  const handleOpenForm = (type: RecordType) => {
    setSelectedType(type);
    setTitle('');
    setDescription('');
    setActionTaken('');
    setRecommendations('');
    setStudentId('');
    setCustomStudentName('');
    setStatus('ONGOING');
    
    // Auto detect today's date and Arabic day name
    const today = new Date();
    const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = daysArabic[today.getDay()];
    
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateStr = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${dateStr}`;
    
    setDate(formattedDate);
    
    // Reset specialized daily activity plan states
    if (type === 'DAILY_ACTIVITY_PLAN') {
      setDay(dayName);
      const blankActs = Array.from({ length: 10 }, (_, i) => ({
        id: `act_blank_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        activity: '',
        location: '',
        details: '',
        displayOrder: i
      }));
      setActivities(blankActs);
    } else {
      setDay('');
      setActivities([
        { id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }
      ]);
    }
    
    setIsFormOpen(true);
  };

  // Auto detect today's date and Arabic day name
  const handleAutoFill = () => {
    const today = new Date();
    const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = daysArabic[today.getDay()];
    
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const dateStr = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${dateStr}`;

    setDay(dayName);
    setDate(formattedDate);
  };

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

  // Submit record handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedType === 'DAILY_ACTIVITY_PLAN') {
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
        `النشاط (${idx + 1}): ${act.activity.trim() || 'غير مححدد'}\nالمكان: ${act.location.trim() || 'غير محدد'}\nالتفاصيل: ${act.details.trim() || 'بدون تفاصيل'}`
      ).join('\n\n--------------------------------\n\n');

      // Create activity array with normalized displayOrder
      const normalizedActivities = validActivities.map((act, idx) => ({
        ...act,
        activity: act.activity.trim(),
        location: act.location.trim(),
        details: act.details.trim(),
        displayOrder: idx
      }));

      const newRecord: CounselingRecord = {
        id: 'rec_' + Date.now(),
        recordType: 'DAILY_ACTIVITY_PLAN',
        date,
        day,
        title: `سجل النشاط اليومي - ${day}`,
        description: formattedDescription,
        actionTaken: 'تم تدوين الأنشطة بنجاح في السجل اليومي للمرشد.',
        recommendations: 'متابعة تنفيذ الأنشطة اليومية المقررة وتحقيق أهداف الإرشاد.',
        status: 'COMPLETED',
        updatedAt: new Date().toISOString(),
        activities: normalizedActivities
      };

      if (onAddRecord) {
        onAddRecord(newRecord);
      }

      // Reset form states
      setDay('');
      setActivities([{ id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }]);
      setIsFormOpen(false);
      return;
    }

    if (!title || !description || !actionTaken || !recommendations) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    let resolvedStudentName = '';
    const isGeneralRecord = selectedType === 'DAILY_ACTIVITY_PLAN' || selectedType === 'HEALTH_KEY_GUIDE';

    if (isGeneralRecord) {
      resolvedStudentName = selectedType === 'DAILY_ACTIVITY_PLAN' ? 'عام / الخطة والنشاط اليومي' : 'عام / الدليل (المفتاح) لدراسة الحالة';
    } else {
      if (studentId === 'CUSTOM' || !studentId) {
        resolvedStudentName = customStudentName || 'طالب غير مسجل';
      } else {
        const student = students.find(s => s.id === studentId);
        resolvedStudentName = student ? student.fullName : 'طالب غير مسجل';
      }
    }

    const newRecord: CounselingRecord = {
      id: 'rec_' + Date.now(),
      studentId: isGeneralRecord ? undefined : (studentId === 'CUSTOM' ? undefined : studentId),
      studentName: resolvedStudentName,
      recordType: selectedType!,
      date,
      title,
      description,
      actionTaken,
      recommendations,
      status,
      updatedAt: new Date().toISOString()
    };

    if (onAddRecord) {
      onAddRecord(newRecord);
    }
    
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
      {/* TOP SECTION: Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-office-blue transition-colors">
          <div className="p-3 bg-blue-50 text-office-blue rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">إجمالي الطلاب</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalStudents}</h3>
          </div>
        </div>

        {/* Academic Year */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-office-blue transition-colors">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">العام الدراسي</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">{academicYear(profile.academicYear)}</h3>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: Records (left) + Telegram Channels (right) */}
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT: 9 Ministerial Buttons Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black text-slate-900 tracking-wider">
                سجلات المرشد التربوي
              </h3>
              <p className="text-[11px] text-slate-500">
                انقر فوق أي سجل لفتح استمارة تدوين وحفظ البيانات مباشرة في الأرشيف
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {recordTypesInfo.map((item) => (
              <button 
                key={item.type}
                onClick={() => {
                  if (onOpenRecordsForType) {
                    onOpenRecordsForType(item.type);
                  }
                }}
                className="flex flex-col items-start p-3 bg-slate-100 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-office-blue dark:hover:border-blue-500 shadow-sm hover:shadow-md rounded-xl transition-all text-right group cursor-pointer min-h-[92px] justify-between"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={`p-1.5 rounded-lg transition-colors group-hover:bg-office-blue group-hover:text-white ${item.color.split(' ')[0]} ${item.color.split(' ')[2] || ''}`}>
                    <item.icon className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-office-blue dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                    {item.name}
                  </span>
                </div>
                  <span className="text-[9px] font-black text-white bg-office-blue group-hover:bg-office-hover mt-2.5 flex items-center gap-1 self-end px-2.5 py-1 rounded-lg shadow-xs">
                  تدوين جديد +
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Telegram Channels */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-[#0088cc] rounded-lg">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.98 1.25-5.59 3.69-.53.36-1 .54-1.42.53-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.74 4-1.74 6.67-2.88 8-3.43 3.81-1.57 4.6-1.84 5.12-1.85.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.2-.04.28z"/></svg>
              </div>
              <h3 className="text-xs font-extrabold text-slate-900">قنوات تيليغرام مفيدة للمرشد التربوي</h3>
            </div>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-bold">6 مصادر متميزة</span>
          </div>
          <div className="space-y-3">
            {[
              {title:'موسوعة الإدارة المدرسية',username:'@almadrase',url:'https://t.me/almadrase',color:'bg-emerald-50 text-emerald-700 border-emerald-100',letter:'م'},
              {title:'بصمة مرشد',username:'@b8a8b',url:'https://t.me/b8a8b',color:'bg-amber-50 text-amber-700 border-amber-100',letter:'ب'},
              {title:'مكتبة علم النفس',username:'@psychology95',url:'https://t.me/psychology95',color:'bg-indigo-50 text-indigo-700 border-indigo-100',letter:'ك'},
              {title:'حقيبة المقاييس النفسية',username:'@Psychological_measurement_bag',url:'https://t.me/Psychological_measurement_bag',color:'bg-rose-50 text-rose-700 border-rose-100',letter:'ح'},
              {title:'كتب علم النفس',username:'@eilmanafss',url:'https://t.me/eilmanafss',color:'bg-cyan-50 text-cyan-700 border-cyan-100',letter:'ت'},
              {title:'كروب الارشاد التربوي العام',username:'@alarshad_altarbawii',url:'https://t.me/alarshad_altarbawii',color:'bg-purple-50 text-purple-700 border-purple-100',letter:'ك'},
            ].map((chan, idx) => (
              <a key={idx} href={chan.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition-all shadow-xs hover:shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${chan.color}`}>{chan.letter}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">{chan.title}</p>
                    <p className="text-[9px] text-slate-400">{chan.username}</p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${chan.color}`}>متابعة</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 9 Records Modal Form */}
      {isFormOpen && selectedType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-office-blue rounded-lg">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    تدوين استمارة جديدة في:
                  </h4>
                  <span className="text-[11px] text-office-blue font-bold">
                    {recordTypesInfo.find(r => r.type === selectedType)?.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-right">
              {selectedType === 'DAILY_ACTIVITY_PLAN' ? (
                /* =========================================
                    SPECIALIZED DAILY ACTIVITY PLAN FORM
                   ========================================= */
                <div className="space-y-4 text-right" dir="rtl">
                  <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-[#1e293b] shadow-xs">
                    {/* Top yellow ledger header block */}
                    <div className="grid grid-cols-2 bg-[#fef3c7] dark:bg-amber-950/20 border-b border-slate-300 dark:border-slate-700 text-xs font-black p-3 text-slate-900 dark:text-slate-200 gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[13px] text-amber-900 dark:text-amber-400">اليوم:</span>
                        <select 
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          required
                          className="bg-transparent border-b border-dashed border-amber-400 dark:border-amber-700 text-slate-900 dark:text-slate-100 font-bold outline-none px-2 py-0.5 focus:border-office-blue text-xs w-full max-w-[150px] cursor-pointer"
                        >
                          <option value="" className="bg-white dark:bg-[#1e293b]">-- اختر اليوم --</option>
                          {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(d => (
                            <option key={d} value={d} className="bg-white dark:bg-[#1e293b]">{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 justify-end sm:justify-start">
                        <span className="font-extrabold text-[13px] text-amber-900 dark:text-amber-400">التاريخ:</span>
                        <input 
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="bg-transparent border-b border-dashed border-amber-400 dark:border-amber-700 text-slate-900 dark:text-slate-100 font-black outline-none px-2 py-0.5 focus:border-office-blue text-xs font-mono w-full max-w-[160px]"
                        />
                        <button 
                          type="button"
                          onClick={handleAutoFill}
                          className="p-1 text-office-blue dark:text-blue-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded-full transition-colors cursor-pointer"
                          title="تعبئة تلقائية لليوم والتاريخ الحالي"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Main Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-center border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-[#e0f2fe] dark:bg-blue-950/20 border-b border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 font-extrabold text-xs">
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
                    STANDARD GENERAL RECORD FORM
                   ========================================= */
                <div className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">موضوع التدوين / عنوان الحالة <span className="text-rose-500">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="مثال: علاج صعوبة القراءة، تدني الدرجات في الفيزياء، ..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">تاريخ التدوين <span className="text-rose-500">*</span></label>
                    <input 
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none font-mono text-right"
                    />
                  </div>

                  {/* Student Selector */}
                  {selectedType !== 'DAILY_ACTIVITY_PLAN' && selectedType !== 'HEALTH_KEY_GUIDE' && (
                    <div className="space-y-3 p-3 bg-slate-50 border border-slate-150 rounded-lg">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 block">الطالب المعني <span className="text-rose-500">*</span></label>
                        <select
                          value={studentId}
                          onChange={(e) => {
                            setStudentId(e.target.value);
                            if (e.target.value !== 'CUSTOM') {
                              setCustomStudentName('');
                            }
                          }}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none"
                        >
                          <option value="">-- اختر طالباً مسجلاً --</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.fullName} ({s.classGrade})</option>
                          ))}
                          <option value="CUSTOM">-- طالب غير مدرج بقائمة التسجيل (كتابة يدوية) --</option>
                        </select>
                      </div>

                      {(studentId === 'CUSTOM' || students.length === 0) && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 block">اسم الطالب (كتابة يدوية) <span className="text-rose-500">*</span></label>
                          <input 
                            type="text"
                            required
                            placeholder="اكتب اسم الطالب الثلاثي هنا"
                            value={customStudentName}
                            onChange={(e) => setCustomStudentName(e.target.value)}
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description / Problem */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">تفاصيل الموقف / السلوك / المشكلة <span className="text-rose-500">*</span></label>
                    <textarea 
                      required
                      rows={3}
                      placeholder={
                        selectedType === 'ACADEMIC_TRACKING' ? 'صف مستويات الطلاب، ومظاهر التفوق أو التراجع الدراسي وتوصيات العلاج والتحسين...' :
                        selectedType === 'HEALTH_STATUS' ? 'اكتب التشخيص الطبي، والأعراض المرصودة، وتوصيات الرعاية الصحية للطالب...' :
                        'اكتب وصفاً مفصلاً للحالة السلوكية أو الموقف الاجتماعي أو التربوي للطالب...'
                      }
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none resize-none"
                    />
                  </div>

                  {/* Action Taken */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">الإجراء الإرشادي المتخذ والتدابير المنفذة <span className="text-rose-500">*</span></label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="اكتب الجلسات، التوجيهات، الاتصالات، أو المتابعات التي أجريتها..."
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none resize-none"
                    />
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">التوصيات وخطوات المتابعة المستقبلية <span className="text-rose-500">*</span></label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="التوصيات الخاصة بإدارة المدرسة، المعلمين، أو أولياء الأمور لمتابعة التحسن..."
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none resize-none"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">حالة ملف المتابعة <span className="text-rose-500">*</span></label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-office-blue focus:border-office-blue outline-none"
                    >
                      <option value="ONGOING">قيد المتابعة النشطة (ONGOING)</option>
                      <option value="COMPLETED">مكتملة ومغلقة (COMPLETED)</option>
                      <option value="ARCHIVED">مؤرشفة للرجوع إليها لاحقاً (ARCHIVED)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedType === 'DAILY_ACTIVITY_PLAN') {
                      setDay('');
                      setActivities([{ id: 'act_1', activity: '', location: '', details: '', displayOrder: 0 }]);
                    } else {
                      setTitle('');
                      setDescription('');
                      setActionTaken('');
                      setRecommendations('');
                      setStudentId('');
                      setCustomStudentName('');
                      setStatus('ONGOING');
                    }
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold py-2 px-3.5 rounded-lg text-xs cursor-pointer transition-colors shadow-xs"
                  title="تصفير الحقول للبدء مجدداً"
                >
                  مسح الاستمارة
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="bg-office-blue hover:bg-office-hover text-white font-bold py-2 px-5 rounded-lg text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    حفظ وتدوين السجل
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
