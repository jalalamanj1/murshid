/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

  // Digital clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Iraqi digital date and time
  const timeString = time.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = time.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Map module to descriptive Arabic title
  const getModuleTitle = (mod: ActiveModule) => {
    switch (mod) {
      case 'DASHBOARD': return 'لوحة التحكم الرئيسية';
      case 'STUDENTS': return 'إدارة شؤون الطلاب الرقمية';
      case 'RECORDS': return 'السجلات الارشادية';
      case 'TEMPLATES': return 'أغلفة سجلات الإرشاد';
      case 'PT_DRIVE': return 'Pandara Drive';
      case 'OFFICIAL_LETTERS': return 'مخاطبات رسمية';


      case 'BACKUP': return 'النسخ الاحتياطي ومزامنة السحاب';
      case 'SETTINGS': return 'إعدادات النظام المكتبي';
      default: return 'مرشد';
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-office-bg dark:bg-[#0f172a] overflow-hidden font-sans antialiased" dir="rtl">
      {/* Inner Window Work Area (Sidebar + Content Area) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Right Sidebar (RTL Sidebar) - Classic Premium Windows Forms Sidebar styled in Sleek Interface */}
        <div className="w-64 bg-sidebar-bg dark:bg-[#1e293b] text-slate-700 dark:text-slate-300 border-l border-border-color dark:border-slate-800 flex flex-col justify-between shrink-0">
            <div className="py-4 space-y-1">
              <div className="px-4 pb-4 border-b border-border-color dark:border-slate-800 mb-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-office-blue/10 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 border border-office-blue/20 dark:border-blue-900/40 flex items-center justify-center text-xs font-bold shrink-0">
                  {profile.fullName.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{profile.fullName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">المرشد التربوي للمدرسة</p>
                </div>
              </div>

              {/* Sidebar Navigation Items */}
              <nav className="space-y-0.5 px-2">
                {[
                  { id: 'DASHBOARD', name: 'الرئيسية ولوحة التحكم', icon: Home },
                  { id: 'STUDENTS', name: 'إدارة الطلاب ومتابعتهم', icon: Users },
                  { id: 'RECORDS', name: 'السجلات الارشادية', icon: FileBox },
                  { id: 'TEMPLATES', name: 'أغلفة سجلات الإرشاد', icon: FileText },
                  { id: 'PT_DRIVE', name: 'Pandara Drive', icon: Monitor },
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
                      className={`w-full text-right flex items-center gap-3 px-4 py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-blue-50/70 dark:bg-slate-800 text-office-blue dark:text-blue-400 border-r-4 border-office-blue dark:border-blue-500 shadow-sm' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-office-blue' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Panel inside Sidebar */}
            <div className="p-4 border-t border-border-color dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                <span>تطوير: Pandara Tech</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
                  متصل محلياً
                </span>
              </div>
            </div>
          </div>

          {/* Primary View Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-office-bg dark:bg-[#0f172a]">
            {/* View Header with breadcrumbs and stats */}
            <header className="h-14 bg-white dark:bg-[#1e293b] border-b border-border-color dark:border-slate-800 px-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 bg-office-blue dark:bg-blue-500 rounded-full"></div>
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">{getModuleTitle(activeModule)}</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-400 font-sans">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dateString}</span>
                </div>
              </div>
            </header>

            {/* Active Component Display Stage */}
            <main className="flex-1 overflow-y-auto p-6 min-h-0 bg-[#F8F9FA] dark:bg-[#0f172a]">
              {children}
            </main>
          </div>
        </div>
      </div>
  );
}
