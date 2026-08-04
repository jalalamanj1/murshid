import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Download, Loader2, AlertTriangle, CheckCircle, ArrowUpCircle } from 'lucide-react';

type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'up-to-date' }
  | { type: 'available'; version: string }
  | { type: 'downloading'; percent: number; bytesPerSecond?: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string };

export default function UpdateSettingsView() {
  const [status, setStatus] = useState<UpdateStatus>({ type: 'idle' });
  const [isElectron, setIsElectron] = useState(false);
  const electronRef = useRef<any>(null);

  useEffect(() => {
    const e = (window as any).electronAPI;
    if (e?.onUpdateStatus) {
      setIsElectron(true);
      electronRef.current = e;
      e.onUpdateStatus((data: any) => {
        switch (data.status) {
          case 'checking':
            setStatus({ type: 'checking' });
            break;
          case 'up-to-date':
            setStatus({ type: 'up-to-date' });
            break;
          case 'available':
            setStatus({ type: 'available', version: data.version });
            break;
          case 'downloaded':
            setStatus({ type: 'downloaded', version: data.version });
            break;
          case 'progress':
            setStatus(s => s.type === 'downloading'
              ? { ...s, percent: data.percent }
              : { type: 'downloading', percent: data.percent });
            break;
          case 'error':
            setStatus({ type: 'error', message: data.error });
            break;
        }
      });
    }
  }, []);

  const handleCheck = useCallback(async () => {
    const e = electronRef.current;
    if (!e?.checkUpdate) return;
    setStatus({ type: 'checking' });
    try {
      await e.checkUpdate();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'فشل الاتصال' });
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const e = electronRef.current;
    if (!e?.installUpdate) return;
    setStatus({ type: 'idle' });
    try {
      await e.installUpdate();
    } catch {}
  }, []);

  const progressBar = status.type === 'downloading' && (
    <div className="space-y-1.5">
      <div className="w-full h-2 bg-divider-color rounded-full overflow-hidden">
        <div
          className="h-full bg-office-blue rounded-full transition-all duration-300"
          style={{ width: `${status.percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>{status.percent}%</span>
        {status.bytesPerSecond && (
          <span>{Math.round(status.bytesPerSecond / 1024)} KB/s</span>
        )}
      </div>
    </div>
  );

  const statusIcon = () => {
    switch (status.type) {
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-amber-500" />;
      case 'up-to-date':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'available':
      case 'downloading':
      case 'downloaded':
        return <Download className="w-5 h-5 text-office-blue" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default:
        return <ArrowUpCircle className="w-5 h-5 text-muted" />;
    }
  };

  const statusText = () => {
    switch (status.type) {
      case 'checking':
        return 'جاري التحقق من وجود تحديثات...';
      case 'up-to-date':
        return 'البرنامج مُحدَّث إلى آخر إصدار.';
      case 'available':
        return `يتوفر إصدار ${status.version}. جاري التحميل...`;
      case 'downloading':
        return `جاري تحميل التحديث (${status.percent}%)`;
      case 'downloaded':
        return `تم تحميل الإصدار ${status.version}. انقر على زر التثبيت لإكمال التحديث.`;
      case 'error':
        return `خطأ: ${status.message}`;
      default:
        return 'لم يتم التحقق من التحديثات بعد.';
    }
  };

  if (!isElectron) {
    return (
      <div className="card border border-border-color rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-main">
          <ArrowUpCircle className="w-4 h-4" />
          <span>تحديثات البرنامج</span>
        </div>
        <p className="text-[11px] text-muted">ميزة التحديث التلقائي متاحة فقط في تطبيق المرشد (مرشد).</p>
      </div>
    );
  }

  return (
    <div className="card border border-border-color rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4 text-office-blue" />
          <h4 className="text-xs font-black text-main">تحديثات البرنامج</h4>
        </div>
        <button
          onClick={handleCheck}
          disabled={status.type === 'checking' || status.type === 'downloading'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-office-blue/10 text-office-blue border border-office-blue/20 hover:bg-office-blue/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status.type === 'checking' ? 'animate-spin' : ''}`} />
          <span>التحقق من التحديثات</span>
        </button>
      </div>

      <div className="flex items-start gap-3 bg-bg-hover rounded-lg p-3 border border-divider-color">
        <div className="mt-0.5 shrink-0">{statusIcon()}</div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[11px] text-muted leading-relaxed">{statusText()}</p>
          {progressBar}
          {status.type === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تثبيت التحديث وإعادة التشغيل</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
