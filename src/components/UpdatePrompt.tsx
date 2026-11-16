/**
 * Global update notice.
 *
 * Shown when an update is published: the user can install immediately or
 * postpone, but the update becomes mandatory 24 hours after it was first seen.
 * The main process enforces that deadline even if the app is restarted.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowUpCircle, Download, Clock, Loader2 } from 'lucide-react';
import { toLatinDigits } from '../lib/format';

interface PromptState {
  version: string;
  deadline: number;
  downloaded: boolean;
  installing: boolean;
}

function remainingLabel(deadline: number): string {
  const remaining = Math.max(0, deadline - Date.now());
  if (remaining <= 0) return 'انتهت مهلة التأجيل';
  const totalMinutes = Math.ceil(remaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${toLatinDigits(hours)} ساعة و${toLatinDigits(minutes)} دقيقة`;
  return `${toLatinDigits(minutes)} دقيقة`;
}

export default function UpdatePrompt() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [, setTick] = useState(0);
  const dismissed = useRef(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getUpdateState) return;

    let mounted = true;

    const show = (version: string, deadline: number, downloaded: boolean) => {
      if (!mounted || dismissed.current) return;
      setPrompt({ version, deadline, downloaded, installing: false });
    };

    api.onUpdateStatus?.((data: any) => {
      if (!mounted) return;
      switch (data.status) {
        case 'available':
          show(data.version, data.deadline || Date.now() + 24 * 60 * 60 * 1000, false);
          break;
        case 'downloaded':
          show(data.version, data.deadline || Date.now() + 24 * 60 * 60 * 1000, true);
          break;
        default:
          break;
      }
    });

    api.getUpdateState()
      .then((state: any) => {
        if (!mounted || !state || state.status === 'none' || !state.shouldPrompt) return;
        show(state.version, state.deadline, state.status === 'downloaded');
      })
      .catch(() => {});

    const ticker = window.setInterval(() => setTick((value) => value + 1), 30000);

    return () => {
      mounted = false;
      window.clearInterval(ticker);
    };
  }, []);

  if (!prompt) return null;

  const expired = prompt.deadline > 0 && Date.now() >= prompt.deadline;

  const handleNow = async () => {
    const api = (window as any).electronAPI;
    setPrompt((current) => (current ? { ...current, installing: true } : current));
    try {
      await api?.installUpdate?.();
    } catch {
      setPrompt((current) => (current ? { ...current, installing: false } : current));
    }
  };

  const handleLater = async () => {
    const api = (window as any).electronAPI;
    dismissed.current = true;
    setPrompt(null);
    try {
      await api?.deferUpdate?.();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border-color bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-divider-color px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-bg text-primary">
            <ArrowUpCircle className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-black text-main">تحديث جديد متوفر</h2>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
              الإصدار <span className="font-mono font-bold text-sec" dir="ltr">{prompt.version}</span> جاهز
              للتثبيت. يمكنك تأجيله لتنظيم عملك، وسيُثبَّت تلقائياً بعد 24 ساعة.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border-color bg-card-elevated px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-sec">
              <Clock className="h-3.5 w-3.5 text-muted" />
              الوقت المتبقي قبل التثبيت الإجباري
            </span>
            <span className={`num text-[11px] font-black ${expired ? 'text-danger' : 'text-main'}`}>
              {prompt.installing ? 'جارٍ التجهيز' : remainingLabel(prompt.deadline)}
            </span>
          </div>

          {prompt.downloaded ? (
            <p className="text-[10px] leading-relaxed text-muted">
              تم تنزيل التحديث بالكامل. عند التثبيت سيُغلق التطبيق ثم يُعاد فتحه على الإصدار الجديد.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[10px] leading-relaxed text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              يتم تنزيل التحديث في الخلفية، ويمكنك متابعة عملك.
            </p>
          )}

          {expired && (
            <p className="rounded-[8px] border border-danger/30 bg-danger-bg px-3 py-2 text-[10px] font-bold leading-relaxed text-danger">
              انتهت مدة التأجيل — سيبدأ التثبيت تلقائياً الآن. احفظ عملك.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-divider-color px-5 py-3.5">
          <button
            type="button"
            onClick={handleNow}
            disabled={prompt.installing}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 disabled:opacity-70"
          >
            {prompt.installing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {prompt.installing ? 'جارٍ تثبيت التحديث…' : 'تحديث الآن'}
          </button>
          <button
            type="button"
            onClick={handleLater}
            disabled={expired || prompt.installing}
            className="btn-secondary flex-1 disabled:opacity-40"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
