import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  X,
  Sparkles,
} from 'lucide-react';
import { startRecording, VoiceRecordingError, type RecorderHandle } from '../lib/voiceEntry';
import { transcribeAudio, warmUpWhisper } from '../lib/whisper';
import {
  extractDailyActivity,
  type DailyActivityDraft,
} from '../lib/dailyActivityExtract';
import { toLatinDigits } from '../lib/format';

export type VoiceEntryPhase = 'idle' | 'listening' | 'transcribing' | 'ai' | 'review' | 'error';

interface VoiceEntryModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (draft: DailyActivityDraft) => void;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function VoiceEntryModal({ open, onClose, onApply }: VoiceEntryModalProps) {
  const [phase, setPhase] = useState<VoiceEntryPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DailyActivityDraft | null>(null);
  const [error, setError] = useState('');
  const recorderRef = useRef<RecorderHandle | null>(null);

  // Pre-warm Whisper while the modal is open so the first "Processing" is fast.
  useEffect(() => {
    if (!open) return;
    warmUpWhisper().catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (recorderRef.current) recorderRef.current.cancel();
      recorderRef.current = null;
      setPhase('idle');
      setElapsed(0);
      setTranscript('');
      setDraft(null);
      setError('');
    }
  }, [open]);

  const handleStart = async () => {
    setError('');
    setPhase('listening');
    setElapsed(0);
    try {
      const handle = await startRecording(setElapsed);
      recorderRef.current = handle;
    } catch (err) {
      setError(err instanceof VoiceRecordingError ? err.message : 'تعذر بدء التسجيل.');
      setPhase('error');
    }
  };

  const handleStop = async () => {
    const handle = recorderRef.current;
    recorderRef.current = null;
    if (!handle) return;
    try {
      setPhase('transcribing');
      const audio = await handle.stop();
      if (audio.float32.length === 0) {
        setError('لم يُلتقط أي صوت. تأكد من أن الميكروفون يعمل وأعد المحاولة.');
        setPhase('error');
        return;
      }
      const text = await transcribeAudio(audio.float32);
      if (!text) {
        setError('تعذر سماع كلام واضح. أعد المحاولة وتحدث بوضوح.');
        setPhase('error');
        return;
      }
      setTranscript(text);
      setPhase('ai');
      const result = await extractDailyActivity(text);
      setDraft(result);
      setPhase('review');
    } catch (err: any) {
      setError(err?.message || 'فشلت معالجة التسجيل.');
      setPhase('error');
    }
  };

  const handleCancelRecording = () => {
    if (recorderRef.current) recorderRef.current.cancel();
    recorderRef.current = null;
    onClose();
  };

  const handleRetry = () => {
    setError('');
    setTranscript('');
    setDraft(null);
    handleStart();
  };

  if (!open) return null;

  const isBusy = phase === 'listening' || phase === 'transcribing' || phase === 'ai';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={isBusy ? undefined : onClose}>
      <div
        className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-office-blue dark:text-blue-400" />
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">الإدخال الصوتي الذكي</h3>
          </div>
          {!isBusy && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="min-h-[200px] flex flex-col">
          {phase === 'listening' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center">
                  <Mic className="w-7 h-7" />
                </div>
              </div>
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">جارٍ الاستماع...</p>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tabular-nums" dir="ltr">
                {toLatinDigits(formatElapsed(elapsed))}
              </p>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-xs font-black rounded-xl transition-colors cursor-pointer"
              >
                <Square className="w-4 h-4" />
                إيقاف التسجيل
              </button>
            </div>
          )}

          {phase === 'transcribing' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
              <Loader2 className="w-10 h-10 text-office-blue animate-spin" />
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">جارٍ تحويل الصوت إلى نص...</p>
              <p className="text-[11px] text-slate-400">يعمل Whisper محلياً على جهازك — لا يُرسل الصوت لأي خادم.</p>
            </div>
          )}

          {phase === 'ai' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
              <Loader2 className="w-10 h-10 text-office-blue animate-spin" />
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">الذكاء الاصطناعي يحلّل المحتوى ويستخرج بيانات السجل...</p>
            </div>
          )}

          {phase === 'review' && draft && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">النص المُحوّل:</p>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {transcript}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">التاريخ:</p>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl px-3 py-2 text-[12px] font-black text-emerald-700 dark:text-emerald-400" dir="ltr">
                  {toLatinDigits(draft.date)}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">الأنشطة المستخرجة:</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {draft.activities.map((a, i) => (
                    <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 space-y-1 bg-white dark:bg-[#0f172a]">
                      <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">{a.activity || '—'}</p>
                      {a.location && <p className="text-[11px] text-slate-500 dark:text-slate-400">المكان: {a.location}</p>}
                      {a.details && <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.details}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">سيتاح لك تعديل كل هذه البيانات في الاستمارة قبل الحفظ.</p>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">{error}</p>
            </div>
          )}

          {phase === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-office-blue/10 text-office-blue flex items-center justify-center">
                <Mic className="w-7 h-7" />
              </div>
              <p className="text-xs font-black text-slate-700 dark:text-slate-200">تحدث بصورة طبيعية عن نشاط اليوم</p>
              <p className="text-[11px] text-slate-400 max-w-[340px] leading-relaxed">
                مثال: «اليوم حوالي العاشرة صباحاً قابلت أحمد في المكتب الإرشادي لأنه تغيب عن الرياضيات عدة مرات،
                ناقشنا حضوره ونصحته بالتحدث مع معلمه».
              </p>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-office-blue hover:bg-office-hover text-white px-6 py-2.5 text-xs font-black rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Mic className="w-4 h-4" />
                ابدأ التسجيل
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-2">
          {phase === 'review' && (
            <>
              <button
                onClick={() => { setDraft(null); setTranscript(''); onApply(draft); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-office-blue hover:bg-office-hover text-white py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" />
                تطبيق على الاستمارة
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة التسجيل
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-1.5 bg-office-blue hover:bg-office-hover text-white py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </>
          )}

          {phase === 'listening' && (
            <button
              onClick={handleCancelRecording}
              className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
            >
              إلغاء التسجيل
            </button>
          )}

          {isBusy && (
            <button
              onClick={onClose}
              disabled={phase === 'transcribing' || phase === 'ai'}
              className="flex-1 disabled:opacity-50 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 text-[11px] font-black rounded-xl transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>
    </div>
  );
}