/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BackupSyncView - Local backup module.
 * Local backup, auto-backup schedules, encryption, history, restore, and settings.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  HardDrive,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  FolderOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Lock,
  Unlock,
  Settings2,
  History,
  Trash2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  FileArchive,
  KeyRound,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  BackupSettings,
  BackupHistoryEntry,
} from '../types';
import {
  loadBackupSettings,
  saveBackupSettings,
  createLocalBackup,
  restoreFromFile,
  restoreFromBuffer,
  estimateBackupSize,
} from '../lib/backupService';
import { toLatinDigits } from '../lib/format';

// ── Types ────────────────────────────────────────────────────────────

interface BackupSyncViewProps {
  onNavigateToStudents?: () => void;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// ── Component ────────────────────────────────────────────────────────

export default function BackupSyncView({ onNavigateToStudents }: BackupSyncViewProps) {
  // ── State ──────────────────────────────────────────────────────
  const [settings, setSettings] = useState<BackupSettings>(loadBackupSettings());
  const [defaultFolder, setDefaultFolder] = useState('');

  const [localProgress, setLocalProgress] = useState('');
  const [isLocalWorking, setIsLocalWorking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [estimatedSize, setEstimatedSize] = useState('...');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast helper ──────────────────────────────────────────────
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Estimate size ─────────────────────────────────────────────
  useEffect(() => {
    estimateBackupSize(settings).then(setEstimatedSize).catch(() => setEstimatedSize('غير معروف'));
  }, [settings]);

  // ── Default backup folder (Desktop\Murshid Backups) ──────────
  useEffect(() => {
    const e = (window as any).electronAPI;
    if (e?.getDefaultBackupFolder) {
      e.getDefaultBackupFolder()
        .then((res: any) => {
          if (res?.ok && res.folder) setDefaultFolder(res.folder);
        })
        .catch(() => {});
    }
  }, []);

  // Effective folder: user choice, or the default when none chosen
  const effectiveFolder = settings.localFolder?.trim() || defaultFolder;

  // ── Save settings helper ──────────────────────────────────────
  const updateSettings = (patch: Partial<BackupSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveBackupSettings(next);
  };

  // ── Local backup ──────────────────────────────────────────────
  const handleLocalBackup = async () => {
    setIsLocalWorking(true);
    setLocalProgress('');
    try {
      let folder = settings.localFolder?.trim() || defaultFolder;
      if (!folder) {
        // Default folder info may still be loading — fetch it on demand.
        const e = (window as any).electronAPI;
        const res = await e?.getDefaultBackupFolder?.();
        if (res?.ok && res.folder) {
          folder = res.folder;
          setDefaultFolder(res.folder);
        }
      }
      if (!folder) {
        addToast('error', 'تعذر تحديد مجلد النسخ الاحتياطي.');
        return;
      }
      await createLocalBackup(settings, folder, setLocalProgress);
      setSettings(loadBackupSettings()); // reload to get updated history
      addToast('success', 'تم النسخ الاحتياطي المحلي بنجاح!');
    } catch (err: any) {
      addToast('error', 'فشلت العملية: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsLocalWorking(false);
    }
  };

  // ── Local folder picker (native directory dialog) ──────────────
  const handlePickLocalFolder = async () => {
    try {
      const e = (window as any).electronAPI;
      if (e?.pickFolder) {
        const result = await e.pickFolder();
        if (result?.canceled) return;
        if (result?.filePaths?.[0]) {
          updateSettings({ localFolder: result.filePaths[0] });
          addToast('success', 'تم تحديث مجلد النسخ الاحتياطي.');
        }
      } else {
        const folder = prompt('أدخل مسار مجلد النسخ الاحتياطي:', settings.localFolder);
        if (folder && folder.trim()) {
          updateSettings({ localFolder: folder.trim() });
          addToast('success', 'تم تحديث مجلد النسخ الاحتياطي.');
        }
      }
    } catch {
      addToast('error', 'تعذر اختيار مجلد النسخ الاحتياطي.');
    }
  };

  const handleResetLocalFolder = () => {
    updateSettings({ localFolder: '' });
    addToast('success', 'تم استعادة المجلد الافتراضي.');
  };

  // ── Local restore ─────────────────────────────────────────────
  const handleLocalRestore = () => {
    setShowRestoreModal(true);
  };

  const executeLocalRestore = async () => {
    if (!selectedRestoreFile) {
      addToast('warning', 'الرجاء اختيار ملف النسخة الاحتياطية.');
      return;
    }
    setIsRestoring(true);
    try {
      await restoreFromFile(
        selectedRestoreFile,
        restorePassword || undefined,
        (msg) => setLocalProgress(msg)
      );
      addToast('success', 'تمت الاستعادة بنجاح!');
    } catch (err: any) {
      addToast('error', err.message || 'فشلت الاستعادة');
      setIsRestoring(false);
    }
  };

  // ── Format date helper ────────────────────────────────────────
  const fmtDate = (iso?: string) => {
    if (!iso) return 'لم يتم بعد';
    const d = new Date(iso);
    return toLatinDigits(d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* ── Toasts ─────────────────────────────────────────────── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white backdrop-blur-sm animate-fade-in ${
              t.type === 'success' ? 'bg-emerald-600' :
              t.type === 'error' ? 'bg-rose-600' :
              t.type === 'warning' ? 'bg-amber-500' :
              'bg-blue-600'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
             t.type === 'error' ? <XCircle className="w-4 h-4" /> :
             t.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
             <Info className="w-4 h-4" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <Database className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">النسخ الاحتياطي والمزامنة</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">حماية بيانات الطلاب من الفقدان بالنسخ المحلي أو السحابي المشفر.</p>
          </div>
        </div>
      </div>

      {/* ── Local Backup Section ───────────────────────────────── */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <HardDrive className="w-4 h-4 text-office-blue dark:text-blue-400" />
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">النسخ الاحتياطي المحلي</h3>
        </div>

        {/* Info row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#F8F6F0] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">مجلد النسخ الاحتياطي</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono break-all">{effectiveFolder || 'سطح المكتب\\Murshid Backups'}</span>
          </div>
          <div className="bg-[#F8F6F0] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">آخر نسخة احتياطية</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{fmtDate(settings.lastLocalBackup)}</span>
          </div>
          <div className="bg-[#F8F6F0] rounded-xl p-3 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">عدد النسخ المحفوظة</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{toLatinDigits(settings.backupHistory.filter(h => h.type === 'LOCAL').length)}</span>
          </div>
        </div>

        {/* Folder display + change */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#F8F6F0] rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-800">
            <FolderOpen className="w-3.5 h-3.5 text-slate-400 inline ml-2" />
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">{effectiveFolder || 'سطح المكتب\\Murshid Backups'}</span>
            {!settings.localFolder && (
              <span className="mr-2 text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">الافتراضي</span>
            )}
          </div>
          <button
            onClick={handlePickLocalFolder}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>اختيار مجلد</span>
          </button>
          {settings.localFolder && (
            <button
              onClick={handleResetLocalFolder}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>الافتراضي</span>
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLocalBackup}
            disabled={isLocalWorking}
            className="bg-office-blue hover:bg-office-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {isLocalWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isLocalWorking ? localProgress || 'جاري...' : 'نسخ احتياطي الآن'}</span>
          </button>
          <button
            onClick={handleLocalRestore}
            disabled={isRestoring}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>استعادة نسخة احتياطية</span>
          </button>
          <div className="bg-blue-50 dark:bg-blue-950/30 text-office-blue dark:text-blue-400 px-3 py-2 text-[10px] font-bold rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            <span>حجم النسخة المقدّر: {estimatedSize}</span>
          </div>
        </div>
      </div>

      {/* ── Automatic Backups ──────────────────────────────────── */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Clock className="w-4 h-4 text-office-blue dark:text-blue-400" />
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">النسخ الاحتياطي التلقائي</h3>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => updateSettings({ autoBackupDaily: !settings.autoBackupDaily })}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
              settings.autoBackupDaily
                ? 'bg-office-blue/10 dark:bg-blue-950/40 border-office-blue/30 dark:border-blue-800 text-office-blue dark:text-blue-400'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {settings.autoBackupDaily ? <ToggleRight className="w-4 h-4 shrink-0" /> : <ToggleLeft className="w-4 h-4 shrink-0" />}
            <HardDrive className="w-3.5 h-3.5" />
            <span>نسخ احتياطي محلي تلقائي (يومي)</span>
          </button>
          <p className="text-[10px] text-slate-400">النسخ المحلي يتم عند فتح التطبيق.</p>
        </div>
      </div>

      {/* ── Backup History ─────────────────────────────────────── */}
      <div className="card bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-office-blue dark:text-blue-400" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-100">سجل النسخ الاحتياطية</span>
            <span className="px-2 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/50 text-office-blue dark:text-blue-400 rounded-md font-mono font-black border border-blue-100 dark:border-blue-900/40">
              {toLatinDigits(settings.backupHistory.length)}
            </span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showHistory && (
          <div className="border-t border-slate-100 dark:border-slate-800">
            {settings.backupHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                لا توجد نسخ احتياطية مسجلة بعد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">التاريخ</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">النوع</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">الوجهة</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">الحجم</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {settings.backupHistory.slice(0, 20).map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-2.5 text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {fmtDate(entry.date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            entry.type === 'LOCAL'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-office-blue dark:text-blue-400 border border-blue-100 dark:border-blue-900/40'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40'
                          }`}>
                            {entry.type === 'LOCAL' ? <HardDrive className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                            {entry.type === 'LOCAL' ? 'محلي' : 'سحابي'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {entry.fileName}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                          {toLatinDigits(entry.size)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            entry.status === 'SUCCESS'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                              : entry.status === 'FAILED'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                          }`}>
                            {entry.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> :
                             entry.status === 'FAILED' ? <XCircle className="w-3 h-3" /> :
                             <Loader2 className="w-3 h-3 animate-spin" />}
                            {entry.status === 'SUCCESS' ? 'نجح' : entry.status === 'FAILED' ? 'فشل' : 'جاري...'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Restore from Local Modal ───────────────────────────── */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowRestoreModal(false); setSelectedRestoreFile(null); setRestorePassword(''); }}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-office-blue dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">استعادة نسخة احتياطية</h3>
              </div>
              <button onClick={() => { setShowRestoreModal(false); setSelectedRestoreFile(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              سيؤدي هذا إلى استبدال جميع البيانات الحالية بالبيانات المحفوظة في النسخة الاحتياطية. يُنصح بعمل نسخة احتياطية أولاً.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">اختر ملف النسخة الاحتياطية (.zip):</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={e => setSelectedRestoreFile(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-slate-600 dark:text-slate-400 file:ml-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-office-blue file:text-white hover:file:bg-office-hover file:cursor-pointer"
              />
              {selectedRestoreFile && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                  <FileArchive className="w-4 h-4 text-office-blue dark:text-blue-400" />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">{selectedRestoreFile.name}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">كلمة مرور التشفير (إن وُجدت):</label>
              <input
                type="password"
                value={restorePassword}
                onChange={e => setRestorePassword(e.target.value)}
                placeholder="اتركه فارغاً إذا لم يكن مشفرراً"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
              />
            </div>

            {isRestoring && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-office-blue dark:text-blue-400 animate-spin" />
                  <span className="text-[11px] font-bold text-office-blue dark:text-blue-400">{localProgress}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={executeLocalRestore}
                disabled={!selectedRestoreFile || isRestoring}
                className="flex-1 bg-office-blue hover:bg-office-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{isRestoring ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}</span>
              </button>
              <button
                onClick={() => { setShowRestoreModal(false); setSelectedRestoreFile(null); setRestorePassword(''); }}
                disabled={isRestoring}
                className="px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
