/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Redesigned Murshid settings window.
 */

import { useState } from 'react';
import {
  Settings,
  Palette,
  Moon,
  Sun,
  FolderOpen,
  HardDrive,
  Lock,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Loader2,
  Info,
  RefreshCw,
  ExternalLink,
  Upload,
} from 'lucide-react';
import type { CounselorProfile, Student } from '../types';
import { Theme } from '../lib/theme';
import UpdateSettingsView from './UpdateSettingsView';
import RecordsImportModal from './RecordsImportModal';
import type { RecordImportResult } from '../lib/recordFileImport';
import {
  isAppLockEnabled,
  enableAppLock,
  changeAppLock,
  disableAppLock,
  validatePasscode,
} from '../lib/appLock';

interface SettingsViewProps {
  profile: CounselorProfile;
  appVersion: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  saveFolder: string;
  onPickSaveFolder: () => void;
  students?: Student[];
  onImportRecords?: (result: RecordImportResult) => number | void;
}

type LockMessage = { type: 'success' | 'error'; text: string } | null;

export default function SettingsView({
  profile,
  appVersion,
  theme,
  onThemeChange,
  saveFolder,
  onPickSaveFolder,
  students = [],
  onImportRecords,
}: SettingsViewProps) {
  const [showRecordsImport, setShowRecordsImport] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(() => isAppLockEnabled());
  const [lockCurrent, setLockCurrent] = useState('');
  const [lockNext, setLockNext] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMessage, setLockMessage] = useState<LockMessage>(null);

  const clearLockFields = () => {
    setLockCurrent('');
    setLockNext('');
    setLockConfirm('');
  };

  const fail = (text: string) => setLockMessage({ type: 'error', text });

  const handleEnableLock = async () => {
    const validation = validatePasscode(lockNext);
    if (validation) return fail(validation);
    if (lockNext !== lockConfirm) return fail('كلمتا القفل غير متطابقتين.');
    try {
      setLockBusy(true);
      await enableAppLock(lockNext);
      setLockEnabled(true);
      clearLockFields();
      setLockMessage({ type: 'success', text: 'تم تفعيل قفل التطبيق. سيُطلب عند الفتح القادم.' });
    } catch (err: any) {
      fail(err?.message || 'تعذر تفعيل القفل.');
    } finally {
      setLockBusy(false);
    }
  };

  const handleChangeLock = async () => {
    const validation = validatePasscode(lockNext);
    if (validation) return fail(validation);
    if (lockNext !== lockConfirm) return fail('كلمتا القفل غير متطابقتين.');
    try {
      setLockBusy(true);
      const ok = await changeAppLock(lockCurrent, lockNext);
      if (!ok) return fail('كلمة القفل الحالية غير صحيحة.');
      clearLockFields();
      setLockMessage({ type: 'success', text: 'تم تغيير كلمة القفل.' });
    } catch (err: any) {
      fail(err?.message || 'تعذر تغيير كلمة القفل.');
    } finally {
      setLockBusy(false);
    }
  };

  const handleDisableLock = async () => {
    try {
      setLockBusy(true);
      const ok = await disableAppLock(lockCurrent);
      if (!ok) return fail('كلمة القفل الحالية غير صحيحة.');
      setLockEnabled(false);
      clearLockFields();
      setLockMessage({ type: 'success', text: 'تم تعطيل قفل التطبيق.' });
    } catch (err: any) {
      fail(err?.message || 'تعذر تعطيل القفل.');
    } finally {
      setLockBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="card flex items-center gap-3">
        <div className="rounded-xl bg-primary-bg p-2.5 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-main">إعدادات النظام</h2>
          <p className="text-[11px] text-muted">المظهر، مجلد الحفظ، استيراد السجلات، قفل التطبيق والتحديثات.</p>
        </div>
      </div>

      {/* Records import */}
      {onImportRecords && (
        <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary-bg p-2.5 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-main">استيراد سجلات من ملفات</h3>
              <p className="mt-0.5 text-[10.5px] text-muted">
                ارفع ملف DOCX أو Excel لكل سجل إرشادي، ويعبئ التطبيق السجل بالبيانات المتعرّف عليها.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRecordsImport(true)}
            className="btn-primary flex shrink-0 items-center gap-1.5"
          >
            <Upload className="h-4 w-4" />
            فتح نافذة الاستيراد
          </button>
        </div>
      )}

      {showRecordsImport && onImportRecords && (
        <RecordsImportModal
          students={students}
          onClose={() => setShowRecordsImport(false)}
          onImport={(result) => {
            onImportRecords(result);
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Appearance */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 border-b border-divider-color pb-3">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-main">مظهر البرنامج</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onThemeChange('light')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary-bg text-primary'
                  : 'border-border-color bg-card-elevated text-secondary hover:bg-hover'
              }`}
            >
              <Sun className="h-4 w-4" />
              فاتح
            </button>
            <button
              onClick={() => onThemeChange('dark')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary-bg text-primary'
                  : 'border-border-color bg-card-elevated text-secondary hover:bg-hover'
              }`}
            >
              <Moon className="h-4 w-4" />
              داكن
            </button>
          </div>
          <p className="text-[10px] text-muted">يُحفظ اختيار المظهر تلقائياً ويُطبَّق عند كل تشغيل.</p>
        </div>

        {/* Save folder */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 border-b border-divider-color pb-3">
            <HardDrive className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-main">مجلد حفظ السجلات</h3>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border-color bg-card-elevated px-3 py-2.5">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted" />
            <span className="truncate font-mono text-[11px] font-bold text-secondary" title={saveFolder}>
              {saveFolder || 'سطح المكتب \\ سجلات مرشد (الافتراضي)'}
            </span>
          </div>
          <button
            onClick={onPickSaveFolder}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-card-elevated px-4 py-2.5 text-xs font-bold text-secondary transition-colors hover:bg-hover"
          >
            <FolderOpen className="h-4 w-4" />
            تغيير المجلد
          </button>
          <p className="text-[10px] text-muted">تُحفظ جميع السجلات المصدّرة والنسخ الاحتياطية في هذا المسار.</p>
        </div>
      </div>

      {/* App lock */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider-color pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-main">قفل التطبيق</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
              lockEnabled
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/40'
                : 'bg-card-elevated text-muted ring-border-color'
            }`}
          >
            {lockEnabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {lockEnabled ? 'مفعّل' : 'غير مفعّل'}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          عند التفعيل، لن يُفتح مُرْشِد إلا بكلمة القفل التي تحددها. يمكن أن تكون أرقاماً أو حروفاً أو كليهما.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {lockEnabled && (
            <div>
              <label className="form-label !mb-1.5">كلمة القفل الحالية</label>
              <input
                type="password"
                value={lockCurrent}
                onChange={(e) => setLockCurrent(e.target.value)}
                placeholder="••••••"
                autoComplete="off"
                className="form-input"
              />
            </div>
          )}
          <div>
            <label className="form-label !mb-1.5">
              {lockEnabled ? 'كلمة القفل الجديدة' : 'كلمة القفل'}
            </label>
            <input
              type="password"
              value={lockNext}
              onChange={(e) => setLockNext(e.target.value)}
              placeholder="4 أحرف على الأقل"
              autoComplete="new-password"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label !mb-1.5">تأكيد كلمة القفل</label>
            <input
              type="password"
              value={lockConfirm}
              onChange={(e) => setLockConfirm(e.target.value)}
              placeholder="أعد كتابة كلمة القفل"
              autoComplete="new-password"
              className="form-input"
            />
          </div>
        </div>

        {lockMessage && (
          <div
            className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold ${
              lockMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400'
            }`}
          >
            {lockMessage.text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {lockEnabled ? (
            <>
              <button
                onClick={handleChangeLock}
                disabled={lockBusy}
                className="btn-primary flex items-center gap-2 !px-4 !py-2.5 text-xs disabled:opacity-60"
              >
                {lockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                تغيير كلمة القفل
              </button>
              <button
                onClick={handleDisableLock}
                disabled={lockBusy}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400"
              >
                <ShieldOff className="h-4 w-4" />
                تعطيل القفل
              </button>
            </>
          ) : (
            <button
              onClick={handleEnableLock}
              disabled={lockBusy}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {lockBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              تفعيل قفل التطبيق
            </button>
          )}
          <p className="text-[10px] text-muted">لا تنسَ كلمة القفل — لا يمكن استعادتها.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Updates */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 border-b border-divider-color pb-3">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-main">التحديثات</h3>
          </div>
          <UpdateSettingsView />
        </div>

        {/* About */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 border-b border-divider-color pb-3">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-main">حول النظام</h3>
          </div>
          <div className="space-y-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-secondary">اسم النظام</span>
              <span className="font-bold text-primary">Murshid — مرشد</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-secondary">الإصدار</span>
              <span className="font-mono font-bold text-main">v{appVersion}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-secondary">المدرسة</span>
              <span className="truncate font-bold text-main">{profile.schoolName || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-secondary">المطور</span>
              <a
                href="https://jalalamanj.online"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-bold text-primary hover:opacity-80"
              >
                Jalal Amanj
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
