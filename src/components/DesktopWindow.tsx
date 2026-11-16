/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Application shell.
 *
 * Layout: a fixed right-hand rail (RTL start) carrying brand, section
 * navigation and the counselor identity, with a quiet top bar for date/time
 * and window controls. Content sits on the paper-coloured canvas and is
 * constrained to a readable measure.
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
import { ActiveModule, CounselorProfile } from '../types';
import { toLatinDigits } from '../lib/format';

interface DesktopWindowProps {
  activeModule: ActiveModule;
  onNavigate: (module: ActiveModule) => void;
  onLogout?: () => void;
  profile?: CounselorProfile | null;
  children: React.ReactNode;
}

interface NavItem {
  id: ActiveModule;
  name: string;
  icon: LucideIcon;
}

/** Single source of truth for the application navigation. */
const NAV_ITEMS: NavItem[] = [
  { id: 'DASHBOARD', name: 'لوحة التحكم', icon: Home },
  { id: 'STUDENTS', name: 'إدارة الطلبة', icon: Users },
  { id: 'RECORDS', name: 'السجلات الإرشادية', icon: FileBox },
  { id: 'TEMPLATES', name: 'أغلفة السجلات', icon: FileText },
  { id: 'DRIVE_LETTERS', name: 'مخاطبات التربية', icon: FileText },
  { id: 'DRIVE_FILES', name: 'الملفات', icon: FolderOpen },
  { id: 'BACKUP', name: 'النسخ الاحتياطي', icon: Database },
  { id: 'SETTINGS', name: 'الإعدادات', icon: Sliders },
];

export default function DesktopWindow({
  activeModule,
  onNavigate,
  profile,
  children,
}: DesktopWindowProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = toLatinDigits(
    time.toLocaleTimeString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  );
  const dateString = toLatinDigits(
    time.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  );

  const initials =
    (profile?.fullName || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('') || 'م';

  return (
    <div
      className="w-screen h-screen flex bg-main-bg text-main font-sans antialiased overflow-hidden"
      dir="rtl"
    >
      {/* ── Right rail: brand, sections, identity ─────────────────────── */}
      <aside className="w-[246px] shrink-0 flex flex-col bg-sidebar-bg border-l border-border-color">
        <div className="flex items-center gap-3 px-5 h-[76px] shrink-0 border-b border-divider-color">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-primary text-[17px] font-black leading-none text-white shadow-xs">
            م
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-black leading-tight text-main">مرشد</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="التنقل الرئيسي">
          <p className="px-3 pb-2.5 text-[9.5px] font-black text-muted">الأقسام</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isActive = activeModule === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-start transition-colors ${
                      isActive
                        ? 'bg-primary-bg text-primary'
                        : 'text-sec hover:bg-hover hover:text-main'
                    }`}
                  >
                    <IconComp
                      className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-primary' : 'text-muted group-hover:text-main'}`}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <span className={`truncate text-[12px] ${isActive ? 'font-black' : 'font-semibold'}`}>
                      {item.name}
                    </span>
                    {isActive && (
                      <span className="absolute inset-y-2 -right-3 w-[2.5px] rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-divider-color p-3">
          {profile?.isRegistered && (
            <div className="mb-3 flex items-center gap-2.5 rounded-[10px] border border-border-color bg-card px-2.5 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-bg text-[10px] font-black text-primary">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-main">
                  {profile.fullName}
                </span>
                <span className="block truncate text-[9px] text-muted">{profile.schoolName}</span>
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Working area ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border-color bg-main-bg px-6">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{dateString}</span>
          </div>

          <div className="ms-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 text-[11px] font-bold text-sec sm:flex">
              <Clock className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
              <span className="num" dir="ltr">{timeString}</span>
            </div>
            <span className="hidden h-4 w-px bg-divider-color sm:block" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (window as any).electronAPI?.minimizeWindow?.()}
                aria-label="تصغير النافذة"
                title="تصغير النافذة"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-main active:scale-95"
              >
                <Minus className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => (window as any).electronAPI?.closeWindow?.()}
                aria-label="إغلاق التطبيق"
                title="إغلاق التطبيق"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-bg hover:text-danger active:scale-95"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-7 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
