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
      case 'BACKUP': return 'النسخ الاحتياطي ومزامنة السحاب';
      case 'SETTINGS': return 'إعدادات النظام المكتبي';
      default: return 'مرشد';
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-office-bg overflow-hidden font-sans antialiased" dir="rtl">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[280px] bg-sidebar-bg text-slate-700 border-l border-border-color flex flex-col justify-between shrink-0">
          <div className="py-6 space-y-1">
            {/* Profile */}
            <div className="px-5 pb-5 border-b border-divider-color mb-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-bg text-primary border border-primary-border flex items-center justify-center text-sm font-bold shrink-0">
                {profile.fullName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-main truncate">{profile.fullName}</p>
                <p className="text-[10px] text-muted truncate mt-0.5">المرشد التربوي للمدرسة</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 px-3">
              {[
                { id: 'DASHBOARD', name: 'الرئيسية ولوحة التحكم', icon: Home },
                { id: 'STUDENTS', name: 'إدارة الطلاب ومتابعتهم', icon: Users },
                { id: 'RECORDS', name: 'السجلات الارشادية', icon: FileBox },
                { id: 'TEMPLATES', name: 'أغلفة سجلات الإرشاد', icon: FileText },
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
                        ? 'bg-active text-primary border-r-[3px] border-primary' 
                        : 'text-secondary hover:bg-card-elevated hover:text-primary'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted group-hover:text-primary'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom */}
          <div className="p-5 border-t border-divider-color space-y-3">
            <div className="flex justify-between items-center text-[10px] text-muted">
              <span>
                تطوير:{' '}
                <a
                  href="https://jalalamanj.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:text-primary underline decoration-dotted underline-offset-2"
                >
                  Jalal Amanj
                </a>
              </span>
              <span className="text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success block"></span>
                متصل محلياً
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-main-bg">
          {/* Top Bar */}
          <header className="h-[72px] bg-sidebar-bg border-b border-border-color px-8 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
              <h2 className="text-xl font-extrabold text-main">{getModuleTitle(activeModule)}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{dateString}</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-7 min-h-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
