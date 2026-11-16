/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backup & Restore view: manual backup, restore, and automatic backup schedule.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  FolderOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  FileArchive,
  CalendarClock,
  HardDrive,
  X,
} from 'lucide-react';
import type { AutoBackupFrequency, BackupSettings } from '../types';
import {
  loadBackupSettings,
  saveBackupSettings,
  createLocalBackup,
  restoreFromFile,
} from '../lib/backupService';
import { toLatinDigits } from '../lib/format';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const FREQUENCY_OPTIONS: { value: AutoBackupFrequency; label: string }[] = [
  { value: 'off', label: 'معطّل' },
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
];

export default function BackupSyncView() {
  const [settings, setSettings] = useState<BackupSettings>(loadBackupSettings());
  const [defaultFolder, setDefaultFolder] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const refreshSettings = useCallback(() => {
    setSettings(loadBackupSettings());
  }, []);

  useEffect(() => {
    const electron = (window as any).electronAPI;
    electron
      ?.getDefaultBackupFolder?.()
      .then((res: any) => {
        if (res?.ok && res.folder) setDefaultFolder(res.folder);
      })
      .catch(() => {});

    const onUpdated = () => refreshSettings();
    window.addEventListener('murshid-backup-updated', onUpdated);
    return () => window.removeEventListener('murshid-backup-updated', onUpdated);
  }, [refreshSettings]);

  const effectiveFolder = settings.localFolder?.trim() || defaultFolder;

  const updateSettings = (patch: Partial<BackupSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveBackupSettings(next);
  };

  const handleBackupNow = async () => {
    setIsWorking(true);
    setProgress('');
    try {
      let folder = settings.localFolder?.trim() || defaultFolder;
      if (!folder) {
        const res = await (window as any).electronAPI?.getDefaultBackupFolder?.();
        if (res?.ok && res.folder) {
          folder = res.folder;
          setDefaultFolder(res.folder);
        }
      }
      if (!folder) {
        addToast('error', 'تعذر تحديد مجلد النسخ الاحتياطي.');
        return;
      }
      await createLocalBackup(settings, folder, setProgress);
      refreshSettings();
      addToast('success', 'تم إنشاء النسخة الاحتياطية بنجاح.');
    } catch (err: any) {
      addToast('error', 'فشل النسخ الاحتياطي: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setIsWorking(false);
      setProgress('');
    }
  };

  const handlePickFolder = async () => {
    try {
      const electron = (window as any).electronAPI;
      if (electron?.pickFolder) {
        const result = await electron.pickFolder();
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
      addToast('error', 'تعذر اختيار المجلد.');
    }
  };

  const executeRestore = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    try {
      await restoreFromFile(restoreFile, restorePassword || undefined, setProgress);
      addToast('success', 'تمت الاستعادة بنجاح.');
    } catch (err: any) {
      addToast('error', err?.message || 'فشلت الاستعادة.');
    } finally {
      setIsRestoring(false);
    }
  };

  const closeRestore = () => {
    if (isRestoring) return;
    setShowRestore(false);
    setRestoreFile(null);
    setRestorePassword('');
    setProgress('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'لم يتم بعد';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'لم يتم بعد';
    return toLatinDigits(
      date.toLocaleString('ar-IQ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const frequencyLabel =
    FREQUENCY_OPTIONS.find((o) => o.value === (settings.autoBackupFrequency || 'off'))?.label || 'معطّل';

  const restoreIsEncrypted = !!restoreFile?.name.includes('_encrypted');

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Toasts */}
      <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm animate-fade-in ${
              t.type === 'success'
                ? 'bg-emerald-600'
                : t.type === 'error'
                ? 'bg-rose-600'
                : t.type === 'warning'
                ? 'bg-amber-500'
                : 'bg-blue-600'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : t.type === 'error' ? (
              <XCircle className="h-4 w-4" />
            ) : t.type === 'warning' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="card flex items-center gap-3">
        <div className="rounded-xl bg-primary-bg p-2.5 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-main">النسخ الاحتياطي</h2>
          <p className="text-[11px] text-muted">احفظ بياناتك واستعدها، مع نسخ احتياطي تلقائي حسب جدول تحدده.</p>
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-main">نسخ احتياطي الآن</h3>
              <p className="text-[10px] text-muted">إنشاء نسخة كاملة من بياناتك وحفظها في المجلد المحدد.</p>
            </div>
          </div>
          <button
            onClick={handleBackupNow}
            disabled={isWorking}
            className="btn-primary flex w-full items-center justify-center gap-2 !py-2.5 text-xs disabled:opacity-60"
          >
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isWorking ? progress || 'جاري النسخ...' : 'نسخ احتياطي الآن'}
          </button>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-office-blue dark:bg-blue-950/40 dark:text-blue-400">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-main">استعادة النسخة الاحتياطية</h3>
              <p className="text-[10px] text-muted">استعادة البيانات من ملف نسخة احتياطية سابق.</p>
            </div>
          </div>
          <button
            onClick={() => setShowRestore(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-card-elevated px-4 py-2.5 text-xs font-bold text-secondary transition-colors hover:bg-hover"
          >
            <Upload className="h-4 w-4" />
            استعادة النسخة الاحتياطية
          </button>
        </div>
      </div>

      {/* Automatic backup settings */}
      <div className="card space-y-5">
        <div className="flex items-center gap-2 border-b border-divider-color pb-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-black text-main">إعدادات النسخ الاحتياطي التلقائي</h3>
          <span className="mr-auto rounded-md bg-primary-bg px-2 py-0.5 text-[10px] font-bold text-primary">
            {frequencyLabel}
          </span>
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <span className="form-label !mb-0">التكرار</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FREQUENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  updateSettings({ autoBackupFrequency: option.value });
                  addToast('success', 'تم حفظ إعدادات النسخ التلقائي.');
                }}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                  (settings.autoBackupFrequency || 'off') === option.value
                    ? 'border-primary bg-primary-bg text-primary'
                    : 'border-border-color bg-card-elevated text-secondary hover:bg-hover'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Folder */}
        <div className="space-y-2">
          <span className="form-label !mb-0">مجلد الحفظ</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-color bg-card-elevated px-3 py-2.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate font-mono text-[11px] font-bold text-secondary" title={effectiveFolder}>
                {effectiveFolder || 'المجلد الافتراضي (سطح المكتب)'}
              </span>
              {!settings.localFolder && (
                <span className="mr-auto shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  افتراضي
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handlePickFolder}
              className="flex items-center justify-center gap-2 rounded-xl border border-border-color bg-card-elevated px-4 py-2.5 text-xs font-bold text-secondary transition-colors hover:bg-hover"
            >
              <FolderOpen className="h-4 w-4" />
              اختيار مجلد
            </button>
          </div>
        </div>

        {/* Last backup */}
        <div className="flex items-center justify-between rounded-xl border border-border-color bg-card-elevated px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted" />
            <span className="text-[11px] font-bold text-secondary">آخر نسخة احتياطية</span>
          </div>
          <span className="text-[11px] font-black text-main">{formatDate(settings.lastLocalBackup)}</span>
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <HardDrive className="h-3.5 w-3.5" />
          يتم إنشاء النسخة تلقائياً عند فتح البرنامج إذا حان موعد الجدول المحدد.
        </p>
      </div>

      {/* Restore modal */}
      {showRestore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeRestore}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-border-color bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black text-main">استعادة النسخة الاحتياطية</h3>
              </div>
              <button onClick={closeRestore} className="text-muted transition-colors hover:text-main">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              سيتم استبدال البيانات الحالية بالبيانات الموجودة في النسخة الاحتياطية. يُنصح بأخذ نسخة احتياطية أولاً.
            </p>

            <div className="space-y-2">
              <label className="form-label !mb-0">ملف النسخة الاحتياطية (.zip)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-secondary file:ml-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-primary-hover"
              />
              {restoreFile && (
                <div className="flex items-center gap-2 rounded-lg border border-border-color bg-card-elevated p-2">
                  <FileArchive className="h-4 w-4 text-primary" />
                  <span className="truncate text-[11px] font-bold text-secondary">{restoreFile.name}</span>
                </div>
              )}
            </div>

            {restoreIsEncrypted && (
              <div className="space-y-1.5">
                <label className="form-label !mb-0">كلمة مرور النسخة</label>
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="form-input"
                />
              </div>
            )}

            {isRestoring && progress && (
              <div className="flex items-center gap-2 rounded-xl border border-primary-border bg-primary-bg p-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-[11px] font-bold text-primary">{progress}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={executeRestore}
                disabled={!restoreFile || isRestoring}
                className="btn-primary flex flex-1 items-center justify-center gap-2 !py-2.5 text-xs disabled:opacity-60"
              >
                {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isRestoring ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
              </button>
              <button
                onClick={closeRestore}
                disabled={isRestoring}
                className="rounded-xl bg-card-elevated px-4 py-2.5 text-xs font-bold text-secondary transition-colors hover:bg-hover disabled:opacity-60"
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
