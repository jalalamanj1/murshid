import React, { useState, useEffect } from 'react';
import {
  Award,
  Users,
  FileText,
  Sliders,
  Database,
  Home,
  HelpCircle,
  Clock,
  Calendar,
  AlertCircle,
  FileBox,
  Monitor,
} from 'lucide-react';
import { ActiveModule, CounselorProfile } from '../types';

interface DesktopWindowProps {
  profile: CounselorProfile;
  activeModule: ActiveModule;
  onNavigate: (module: ActiveModule) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export default function DesktopWindow({ 
  profile, 
  activeModule, 
  onNavigate, 
  onLogout,
  children,
}: DesktopWindowProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = time.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getModuleTitle = (mod: ActiveModule) => {
    switch (mod) {
      case 'DASHBOARD': return 'لوحة التحكم الرئيسية';
      case 'STUDENTS': return 'إدارة شؤون الطلاب الرقمية';
      case 'RECORDS': return 'السجلات الارشادية';
      case 'TEMPLATES': return 'أغلفة سجلات الإرشاد';
      case 'PT_DRIVE': return 'Google Drive';
      case 'OFFICIAL_LETTERS': return 'مخاطبات رسمية';
      case 'BACKUP': return 'النسخ الاحتياطي ومزامنة السحاب';
      case 'SETTINGS': return 'إعدادات النظام المكتبي';
      default: return 'مرشد';
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-office-bg overflow-hidden font-sans antialiased" dir="rtl">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-sidebar-bg text-slate-700 border-l border-border-color flex flex-col justify-between shrink-0">
          <div className="py-6 space-y-1">
            {/* Profile */}
            <div className="px-5 pb-5 border-b border-divider-color mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-bg text-primary border border-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
                {profile.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{profile.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">المرشد التربوي للمدرسة</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-0.5 px-3">
              {[
                { id: 'DASHBOARD', name: 'الرئيسية ولوحة التحكم', icon: Home },
                { id: 'STUDENTS', name: 'إدارة الطلاب ومتابعتهم', icon: Users },
                { id: 'RECORDS', name: 'السجلات الارشادية', icon: FileBox },
                { id: 'TEMPLATES', name: 'أغلفة سجلات الإرشاد', icon: FileText },
                { id: 'PT_DRIVE', name: 'Google Drive', icon: Monitor },
                { id: 'OFFICIAL_LETTERS', name: 'مخاطبات رسمية', icon: FileText },
                { id: 'BACKUP', name: 'النسخ الاحتياطي والمزامنة', icon: Database },
                { id: 'SETTINGS', name: 'إعدادات النظام المكتبي', icon: Sliders }
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id as ActiveModule)}
                    className={`w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? 'bg-[#FFF7ED] text-primary border-r-[3px] border-primary shadow-sm' 
                        : 'hover:bg-card/60 text-main hover:text-primary'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom */}
          <div className="p-5 border-t border-divider-color space-y-3">
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <span>
                تطوير:{' '}
                <a
                  href="https://instagram.com/jalalamanj1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline decoration-dotted underline-offset-2"
                >
                  Jalal Amanj
                </a>
              </span>
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
                متصل محلياً
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-office-bg">
          {/* Top Bar */}
          <header className="h-16 bg-card border-b border-border-color px-8 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <h2 className="text-base font-bold text-main">{getModuleTitle(activeModule)}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{dateString}</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-8 min-h-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
