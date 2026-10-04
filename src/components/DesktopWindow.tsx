/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  Sliders,
  Database,
  Home,
  Clock,
  Calendar,
  FileBox,
  FolderOpen,
  Minus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ActiveModule } from '../types';
import { toLatinDigits } from '../lib/format';

interface DesktopWindowProps {
  activeModule: ActiveModule;
  onNavigate: (module: ActiveModule) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: ActiveModule;
  name: string;
  icon: LucideIcon;
}

/** Single source of truth for the application navigation. */
const NAV_ITEMS: NavItem[] = [
  { id: 'DASHBOARD', name: 'الرئيسية ولوحة التحكم', icon: Home },
  { id: 'STUDENTS', name: 'إدارة الطلاب ومتابعتهم', icon: Users },
  { id: 'RECORDS', name: 'السجلات الارشادية', icon: FileBox },
  { id: 'TEMPLATES', name: 'أغلفة سجلات الإرشاد', icon: FileText },
  { id: 'BACKUP', name: 'النسخ الاحتياطي والمزامنة', icon: Database },
  { id: 'DRIVE_LETTERS', name: 'مخاطبات التربية', icon: FileText },
  { id: 'DRIVE_FILES', name: 'الملفات', icon: FolderOpen },
  { id: 'SETTINGS', name: 'إعدادات النظام المكتبي', icon: Sliders },
];

export default function DesktopWindow({ 
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

  const timeString = toLatinDigits(time.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  const dateString = toLatinDigits(time.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

  return (
    <div className="w-screen h-screen flex flex-col bg-office-bg overflow-hidden font-sans antialiased" dir="rtl">
      <div className="flex-1 flex flex-col overflow-hidden bg-main-bg min-h-0">
        {/* ── Unified application header ───────────────────────────────
            DOM order is user → nav → date/time: the container is RTL, so the
            first child renders on the physical RIGHT and the last on the
            LEFT. This yields the requested LEFT/CENTER/RIGHT composition. */}
        <header className="h-[76px] shrink-0 bg-sidebar-bg border-b border-border-color px-5 xl:px-8 flex items-center gap-4">
          {/* RIGHT — window controls. The application runs full screen, so these
              are the only way to minimize or quit it. */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => (window as any).electronAPI?.closeWindow?.()}
              aria-label="إغلاق التطبيق"
              title="إغلاق التطبيق"
              className="w-9 h-9 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.95] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => (window as any).electronAPI?.minimizeWindow?.()}
              aria-label="تصغير النافذة"
              title="تصغير النافذة"
              className="w-9 h-9 rounded-lg text-muted hover:text-main hover:bg-hover active:scale-[0.95] flex items-center justify-center cursor-pointer transition-colors"
            >
              <Minus className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </div>

          {/* CENTER — icon-only navigation.
              dir="ltr" scopes the toolbar to a left-to-right icon order while the
              surrounding application shell stays RTL. No tab titles are rendered:
              the current section is conveyed by the icon highlight alone, which also
              keeps every button the same width so switching tabs never shifts layout. */}
          <nav
            className="flex-1 min-w-0 self-stretch flex items-center overflow-x-auto overflow-y-hidden nav-scroll"
            aria-label="التنقل الرئيسي"
            dir="ltr"
          >
            <div className="flex items-center gap-1.5 w-max mx-auto px-1">
              {NAV_ITEMS.map((item) => {
                const IconComp = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-label={item.name}
                    title={item.name}
                    aria-current={isActive ? 'page' : undefined}
                    className="nav-item group flex h-10 w-10 shrink-0 items-center justify-center rounded-full cursor-pointer active:scale-[0.97] hover:bg-hover"
                  >
                    <IconComp
                      className={`nav-item-icon w-[19px] h-[19px] shrink-0 ${
                        isActive ? 'text-primary scale-110' : 'text-muted group-hover:text-primary'
                      }`}
                      strokeWidth={isActive ? 2.5 : 1.9}
                    />
                  </button>
                );
              })}
            </div>
          </nav>

          {/* LEFT — date and time */}
          <div className="flex items-center gap-3 xl:gap-4 text-secondary shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap hidden xl:inline">{dateString}</span>
            </div>
            <span className="w-px h-4 bg-divider-color shrink-0 hidden xl:block" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap hidden lg:inline">{timeString}</span>
            </div>
          </div>
        </header>

        {/* Page Content — scrolls beneath the fixed header */}
        <main className="flex-1 overflow-y-auto p-5 xl:p-7 min-h-0">
          {children}
        </main>

        <footer className="shrink-0 h-8 bg-sidebar-bg border-t border-divider-color flex items-center justify-center text-[10px] text-muted">
          تطوير:{' '}
          <a
            href="https://jalalamanj.online"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-primary underline decoration-dotted underline-offset-2"
          >
            Jalal Amanj
          </a>
        </footer>
      </div>
    </div>
  );
}
