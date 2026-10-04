import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Save, Plug, Eye, EyeOff, Sparkles } from 'lucide-react';

interface AiConfigState {
  configured: boolean;
  model: string;
  baseUrl: string;
  canPersistKey?: boolean;
}

export default function AiSettingsCard() {
  const [config, setConfig] = useState<AiConfigState | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const refresh = useCallback(async () => {
    const electron = (window as any).electronAPI;
    if (!electron?.ai?.config) return;
    try {
      const res = await electron.ai.config();
      if (res?.ok) {
        setConfig({ configured: res.configured, model: res.model, baseUrl: res.baseUrl });
        setModel(res.model);
        setBaseUrl(res.baseUrl);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSaveKey = async () => {
    const electron = (window as any).electronAPI;
    if (!electron?.ai?.setKey) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await electron.ai.setKey(apiKey);
      if (res?.ok) {
        setApiKey('');
        setResult({ ok: true, message: 'تم حفظ المفتاح.' });
        await refresh();
      } else {
        setResult({ ok: false, message: res?.error || 'فشل الحفظ.' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'فشل الحفظ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModel = async () => {
    const electron = (window as any).electronAPI;
    if (!electron?.ai?.setModel || !electron.ai.setBaseUrl) return;
    setSaving(true);
    setResult(null);
    try {
      if (model.trim()) await electron.ai.setModel(model.trim());
      if (baseUrl.trim()) await electron.ai.setBaseUrl(baseUrl.trim());
      setResult({ ok: true, message: 'تم حفظ الإعدادات المتقدمة.' });
      await refresh();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'فشل الحفظ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const electron = (window as any).electronAPI;
    if (!electron?.ai?.test) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await electron.ai.test();
      if (res?.ok) {
        setResult({ ok: true, message: `الاتصال يعمل بنجاح — نموذج ردّ: «${(res.sample || '').trim()}»` });
      } else {
        setResult({ ok: false, message: res?.error || 'فشل الاتصال.' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'فشل الاتصال.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 max-w-lg">
      <h4 className="text-xs font-bold text-main">الإدخال الصوتي الذكي (الذكاء الاصطناعي)</h4>
      <div className="bg-card rounded-xl p-4 border border-border-color space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-office-blue" />
          <span className="text-xs font-bold text-main">OpenCode Go API</span>
          {config && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {config.configured ? 'مُهيّأ' : 'غير مُهيّأ'}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted leading-relaxed">
          يُستخدم هذا المفتاح لتحويل الكلام الصوتي إلى سجل نشاط يومي. يُحفظ مشفّراً بنظام التشغيل ولا يظهر لأي جهة أخرى.
          احصل على المفتاح من <span className="font-bold">opencode.ai/auth</span>.
        </p>

        {config && config.canPersistKey === false && (
          <div className="flex items-start gap-2 text-[10px] font-bold rounded-lg px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>تشفير النظام غير متوفر على هذا الجهاز، لذا لا يمكن حفظ المفتاح محلياً. عيّن متغير البيئة OPENCODE_API_KEY وأعد تشغيل البرنامج.</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-main block">مفتاح API</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..." dir="ltr"
                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-office-blue pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={saving || !apiKey.trim()}
              className="bg-office-blue hover:bg-office-hover disabled:opacity-50 text-white px-4 py-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              حفظ
            </button>
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={testing || !config?.configured}
          className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-xs font-black py-2 px-4 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
          {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
        </button>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] font-bold text-office-blue dark:text-blue-400 cursor-pointer underline-offset-2"
        >
          {showAdvanced ? 'إخفاء الإعدادات المتقدمة' : 'الإعدادات المتقدمة (النموذج والرابط)'}
        </button>

        {showAdvanced && (
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-main block">اسم النموذج (Model)</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="mimo-v2.6-flash" dir="ltr"
                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-office-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-main block">رابط الخدمة (Base URL)</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://opencode.ai/zen/go/v1" dir="ltr"
                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-office-blue"
              />
            </div>
            <button
              onClick={handleSaveModel}
              disabled={saving}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              حفظ المتقدم
            </button>
          </div>
        )}

        {result && (
          <div className={`flex items-center gap-2 text-[11px] font-bold rounded-lg px-3 py-2 ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}