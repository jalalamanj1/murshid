/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DriveFolderAccessView — shared-folder module screen.
 *
 * The app authenticates with the MINIMUM Google scope (drive.file), which
 * only grants access to files the app itself created. Pre-existing shared
 * folders (مخاطبات التربية / ملفات) cannot be listed with this scope, so
 * this screen explains the limitation and offers to open the folder in the
 * user's default browser instead. No broader scope is requested.
 */

import React from 'react';
import {
  FolderOpen,
  ExternalLink,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface DriveFolderAccessViewProps {
  title: string;
  subtitle: string;
  folderId: string;
  description: string;
}

export default function DriveFolderAccessView({
  title,
  subtitle,
  folderId,
  description,
}: DriveFolderAccessViewProps) {
  const openInBrowser = () => {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    const e = (window as any).electronAPI;
    if (e?.openExternal) {
      e.openExternal(url).catch(() => {});
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <FolderOpen className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Limitation notice */}
      <div className="card bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-xs font-black text-amber-800 dark:text-amber-400">
              هذا المجلد السحابي غير متاح داخل التطبيق حالياً
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-500/90 leading-relaxed">
              إذن <bdi dir="ltr">drive.file</bdi> الحالي يسمح فقط بالوصول إلى الملفات التي
              ينشئها التطبيق نفسه، ولا يمكن استعراض المجلدات المشتركة الموجودة مسبقاً دون
              توسيع الصلاحيات في Google Cloud. لم يتم توسيع أي صلاحيات حفاظاً على خصوصية
              بياناتك.
            </p>
          </div>
        </div>

        {/* Folder info */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 flex gap-3">
          <Info className="w-4 h-4 text-office-blue dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-300">وصف المجلد</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={openInBrowser}
            className="bg-office-blue hover:bg-office-hover text-white px-4 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>فتح المجلد في المتصفح</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          يُفتح الرابط بحسابك في Google داخل المتصفح الافتراضي. لتفعيل الاستعراض داخل
          التطبيق، يلزم إضافة صلاحية <bdi dir="ltr">drive.readonly</bdi> إلى العميل في
          Google Cloud ثم إعادة ربط الحساب.
        </p>
      </div>
    </div>
  );
}
