import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

interface CoverModel {
  id: string;
  name: string;
  docxPath: string;
  previewPath: string | null;
}

interface PreviewData {
  base64: string;
  mime: string;
}

export default function RecordCoversView() {
  const [models, setModels] = useState<CoverModel[]>([]);
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-hide success toast after 1.2 seconds
  const successTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (showSuccess) {
      successTimer.current = setTimeout(() => setShowSuccess(false), 1200);
      return () => clearTimeout(successTimer.current);
    }
  }, [showSuccess]);

  const electron = (window as any).electronAPI;

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setError('');
    try {
      if (!electron || !electron.cover) {
        setError('هذه الميزة متاحة فقط في تطبيق المرشد.');
        setLoading(false);
        return;
      }
      const res = await electron.cover.listModels();
      if (res.ok) {
        setModels(res.models);
        // Load previews concurrently
        for (const model of res.models) {
          loadPreview(model.id);
        }
      } else {
        setError(res.error || 'فشل تحميل النماذج.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (modelId: string) => {
    try {
      const res = await electron.cover.getPreview(modelId);
      if (res && res.ok) {
        setPreviews(prev => ({ ...prev, [modelId]: { base64: res.base64, mime: res.mime } }));
      }
    } catch {}
  };

  const handleDownload = async (modelId: string) => {
    if (!electron) return;
    setGeneratingId(modelId);
    setError('');
    setShowSuccess(false);
    try {
      const res = await electron.cover.generate(modelId);
      if (res.ok) {
        setShowSuccess(true);
      } else if (res.canceled) {
        // User cancelled the save dialog — just reset
      } else {
        setError(res.error || 'فشل إنشاء المستند.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ.');
    } finally {
      setGeneratingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Error */}
      {error && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{error}</span>
        </div>
      )}

      {/* Model Grid — 2 cols desktop, 1 col mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {models.map(model => (
          <div key={model.id} className="card justify-self-center bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden w-fit">
            {/* Preview Image */}
            <div className="bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
              {previews[model.id] ? (
                <img
                  src={`data:${previews[model.id].mime};base64,${previews[model.id].base64}`}
                  alt=""
                  className="w-56 h-auto object-contain"
                />
              ) : (
                <div className="w-56 h-64 text-[10px] text-slate-400 flex items-center justify-center">...</div>
              )}
            </div>

            {/* Download Button — same width as preview image */}
            <button
              onClick={() => handleDownload(model.id)}
              disabled={generatingId === model.id}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 text-[11px] font-bold flex items-center justify-center gap-2 rounded-none transition-colors cursor-pointer"
            >
              {generatingId === model.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>تحميل DOCX</span>
            </button>
          </div>
        ))}
      </div>

      {models.length === 0 && !loading && (
        <div className="text-center py-16 text-xs text-slate-400">
          لا توجد نماذج أغلفة متاحة.
        </div>
      )}

      {/* Success Toast Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 px-8 py-6 flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">تم حفظ الملف بنجاح</span>
          </div>
        </div>
      )}
    </div>
  );
}
