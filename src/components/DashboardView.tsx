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
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card flex items-center gap-5 hover:border-primary transition-colors">
          <div className="p-3.5 bg-[#FFF7ED] text-primary rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted font-bold">إجمالي الطلاب</p>
            <h3 className="text-3xl font-bold text-main mt-1">{totalStudents}</h3>
          </div>
        </div>
        <div className="card flex items-center gap-5 hover:border-primary transition-colors">
          <div className="p-3.5 bg-[#FFF7ED] text-primary rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted font-bold">العام الدراسي</p>
            <h3 className="text-3xl font-bold text-main mt-1">{academicYear(profile.academicYear)}</h3>
          </div>
        </div>
      </div>

      {/* Records + Telegram */}
      <div className="grid grid-cols-2 gap-6">
        {/* Records */}
        <div className="card space-y-5">
          <div className="border-b border-divider-color pb-4">
            <h3 className="text-sm font-bold text-main">سجلات المرشد التربوي</h3>
            <p className="text-xs text-muted mt-1">انقر فوق أي سجل لفتح استمارة تدوين وحفظ البيانات مباشرة في الأرشيف</p>
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
                className="flex flex-col items-start p-3 bg-card hover:bg-[#FFF7ED] border border-border-color hover:border-primary rounded-xl transition-all duration-200 text-right group cursor-pointer min-h-[92px] justify-between"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="p-1.5 rounded-lg bg-[#FFF7ED] text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <item.icon className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="text-xs font-bold text-main group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {item.name}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-white bg-primary group-hover:bg-primary-hover mt-2.5 flex items-center gap-1 self-end px-2.5 py-1 rounded-lg shadow-xs">
                  تدوين جديد +
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Telegram */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between border-b border-divider-color pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#FFF7ED] text-primary rounded-lg">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.98 1.25-5.59 3.69-.53.36-1 .54-1.42.53-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.74 4-1.74 6.67-2.88 8-3.43 3.81-1.57 4.6-1.84 5.12-1.85.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.2-.04.28z"/></svg>
              </div>
              <h3 className="text-xs font-bold text-main">قنوات تيليغرام مفيدة للمرشد التربوي</h3>
            </div>
            <span className="text-[10px] text-muted bg-bg-hover px-2.5 py-1 rounded-md font-bold">6 مصادر متميزة</span>
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
                className="flex items-center justify-between p-3 rounded-xl border border-border-color hover:border-primary hover:bg-[#FFF7ED] transition-all duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${chan.color}`}>{chan.letter}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-main truncate">{chan.title}</p>
                    <p className="text-[9px] text-muted">{chan.username}</p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${chan.color}`}>متابعة</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Records Modal */}
      {isFormOpen && selectedType && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" dir="rtl">
          <div className="bg-card rounded-2xl shadow-modal border border-border-color w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-divider-color flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFF7ED] text-primary rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-main">
                    تدوين استمارة جديدة في:
                  </h4>
                  <span className="text-[11px] text-primary font-bold">
                    {recordTypesInfo.find(r => r.type === selectedType)?.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-muted hover:text-secondary rounded-lg hover:bg-bg-hover cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-5 overflow-y-auto flex-1 text-right">
              {selectedType === 'DAILY_ACTIVITY_PLAN' ? (
                <div className="space-y-4 text-right" dir="rtl">
                  <div className="border border-border-color rounded-xl overflow-hidden bg-card shadow-xs">
                    <div className="grid grid-cols-2 bg-[#FFF7ED] border-b border-border-color text-xs font-bold p-3 text-main gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-primary">اليوم:</span>
                        <select 
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          required
                          className="bg-transparent border-b border-dashed border-primary/40 text-main font-bold outline-none px-2 py-0.5 focus:border-primary text-xs w-full max-w-[150px] cursor-pointer"
                        >
                          <option value="">-- اختر اليوم --</option>
                          {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 justify-end sm:justify-start">
                        <span className="font-bold text-[13px] text-primary">التاريخ:</span>
                        <input 
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="bg-transparent border-b border-dashed border-primary/40 text-main font-bold outline-none px-2 py-0.5 focus:border-primary text-xs font-mono w-full max-w-[160px]"
                        />
                        <button 
                          type="button"
                          onClick={handleAutoFill}
                          className="p-1 text-primary hover:bg-[#FFF7ED] rounded-full transition-colors cursor-pointer"
                          title="تعبئة تلقائية لليوم والتاريخ الحالي"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-center border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-[#FFF7ED] border-b border-border-color text-main font-bold text-xs">
                            <th className="py-2.5 px-3 border-l border-border-color text-center font-bold text-[13px] w-[25%]">النشاط</th>
                            <th className="py-2.5 px-3 border-l border-border-color text-center font-bold text-[13px] w-[20%]">المكان</th>
                            <th className="py-2.5 px-3 text-center font-bold text-[13px] w-[55%]">التفاصيل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.map((act, idx) => (
                            <tr 
                              key={act.id} 
                              className={`${
                                idx % 2 === 0 ? 'bg-card' : 'bg-[#1A1A1A]'
                              } border-b border-border-color hover:bg-card/40 transition-colors`}
                            >
                              <td className="p-1 border-l border-border-color">
                                <input 
                                  type="text"
                                  placeholder="أدخل عنوان النشاط..."
                                  value={act.activity}
                                  onChange={(e) => handleUpdateActivity(act.id, 'activity', e.target.value)}
                                  className="w-full bg-transparent px-2 py-1.5 text-xs text-main focus:bg-card outline-none placeholder:text-muted font-semibold text-center border border-transparent focus:border-border-color rounded-md"
                                />
                              </td>
                              <td className="p-1 border-l border-border-color">
                                <input 
                                  type="text"
                                  placeholder="الموقع..."
                                  value={act.location}
                                  onChange={(e) => handleUpdateActivity(act.id, 'location', e.target.value)}
                                  className="w-full bg-transparent px-2 py-1.5 text-xs text-main focus:bg-card outline-none placeholder:text-muted font-semibold text-center border border-transparent focus:border-border-color rounded-md"
                                />
                              </td>
                              <td className="p-1 flex items-center gap-1">
                                <input 
                                  type="text"
                                  placeholder="مخرجات أو تفاصيل الإجراء المتخذ..."
                                  value={act.details}
                                  onChange={(e) => handleUpdateActivity(act.id, 'details', e.target.value)}
                                  className="w-full bg-transparent px-2 py-1.5 text-xs text-main focus:bg-card outline-none placeholder:text-muted font-medium border border-transparent focus:border-border-color rounded-md flex-1 text-right"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActivity(act.id)}
                                  className="text-muted hover:text-danger p-1 rounded-md transition-colors cursor-pointer shrink-0"
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

                  <div className="flex justify-between items-center bg-[#FAFAFA] p-2.5 rounded-xl border border-border-color">
                    <span className="text-[11px] text-muted font-bold">
                      * يتم تجاهل وحذف الأسطر الفارغة تلقائياً عند حفظ السجل.
                    </span>
                    <button 
                      type="button"
                      onClick={handleAddActivity}
                      className="btn-secondary text-xs !py-1.5 !px-4"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>+ إضافة سطر نشاط آخر</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="form-label">موضوع التدوين / عنوان الحالة <span className="text-danger">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="مثال: علاج صعوبة القراءة، تدني الدرجات في الفيزياء، ..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">تاريخ التدوين <span className="text-danger">*</span></label>
                    <input 
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="form-input font-mono text-right"
                    />
                  </div>

                  {selectedType !== 'DAILY_ACTIVITY_PLAN' && selectedType !== 'HEALTH_KEY_GUIDE' && (
                    <div className="space-y-3 p-4 bg-[#FAFAFA] border border-border-color rounded-xl">
                      <div className="space-y-1.5">
                        <label className="form-label">الطالب المعني <span className="text-danger">*</span></label>
                        <select
                          value={studentId}
                          onChange={(e) => {
                            setStudentId(e.target.value);
                            if (e.target.value !== 'CUSTOM') {
                              setCustomStudentName('');
                            }
                          }}
                          className="form-input"
                        >
                          <option value="">-- اختر طالباً مسجلاً --</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>{s.fullName} ({s.classGrade})</option>
                          ))}
                          <option value="CUSTOM">-- طالب غير مدرج بقائمة التسجيل (كتابة يدوية) --</option>
                        </select>
                      </div>

                      {(studentId === 'CUSTOM' || students.length === 0) && (
                        <div className="space-y-1.5">
                          <label className="form-label">اسم الطالب (كتابة يدوية) <span className="text-danger">*</span></label>
                          <input 
                            type="text"
                            required
                            placeholder="اكتب اسم الطالب الثلاثي هنا"
                            value={customStudentName}
                            onChange={(e) => setCustomStudentName(e.target.value)}
                            className="form-input"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="form-label">تفاصيل الموقف / السلوك / المشكلة <span className="text-danger">*</span></label>
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
                      className="form-input resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">الإجراء الإرشادي المتخذ والتدابير المنفذة <span className="text-danger">*</span></label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="اكتب الجلسات، التوجيهات، الاتصالات، أو المتابعات التي أجريتها..."
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="form-input resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">التوصيات وخطوات المتابعة المستقبلية <span className="text-danger">*</span></label>
                    <textarea 
                      required
                      rows={2}
                      placeholder="التوصيات الخاصة بإدارة المدرسة، المعلمين، أو أولياء الأمور لمتابعة التحسن..."
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      className="form-input resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">حالة ملف المتابعة <span className="text-danger">*</span></label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="form-input"
                    >
                      <option value="ONGOING">قيد المتابعة النشطة</option>
                      <option value="COMPLETED">مكتملة ومغلقة</option>
                      <option value="ARCHIVED">مؤرشفة للرجوع إليها لاحقاً</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-divider-color mt-2">
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
                  className="btn-secondary text-xs !py-2 !px-3.5"
                >
                  مسح الاستمارة
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="btn-secondary text-xs !py-2 !px-4"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs !py-2 !px-5"
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
