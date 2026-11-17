/**
 * Repository library tab (مخاطبات التربية / الملفات / أغلفة السجلات).
 *
 * Files are mirrored from a public GitHub repository by the main process and
 * kept on disk for offline use. The tab refreshes automatically every five
 * seconds and reacts to push events from the sync service.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image,
  Loader2,
  Printer,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toLatinDigits } from '../lib/format';

type RepoKey = 'letters' | 'files' | 'covers';

interface RepoFile {
  path: string;
  name: string;
  size: number;
  sha: string;
  local: boolean;
}

interface RepoLibraryViewProps {
  repoKey: RepoKey;
  title: string;
  mode?: 'library' | 'covers';
  /** Values injected into cover documents before saving/printing. */
  coverValues?: Record<string, string>;
}

function extensionOf(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function FileIcon({ name }: { name: string }) {
  const ext = extensionOf(name);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <Image className="h-4 w-4" />;
  if (ext === 'pdf') return <FileText className="h-4 w-4" />;
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="h-4 w-4" />;
  if (['docx', 'doc'].includes(ext)) return <FileText className="h-4 w-4" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${toLatinDigits(bytes)} بايت`;
  if (bytes < 1024 * 1024) return `${toLatinDigits(Math.round(bytes / 1024))} ك.ب`;
  return `${toLatinDigits((bytes / (1024 * 1024)).toFixed(1))} م.ب`;
}

function formatTime(value: number | null): string {
  if (!value) return 'لم تتم المزامنة بعد';
  return new Date(value).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function RepoLibraryView({ repoKey, title, mode = 'library', coverValues }: RepoLibraryViewProps) {
  const api = (window as any).electronAPI;
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<{ path: string; action: 'open' | 'save' | 'print' } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const applyState = useCallback((state: any) => {
    if (!state) return;
    if (Array.isArray(state.files)) setFiles(state.files);
    if (state.syncedAt) setSyncedAt(state.syncedAt);
    setError(state.error || '');
  }, []);

  const load = useCallback(async (force = false) => {
    if (!api?.repo) {
      setLoading(false);
      setError('هذه الميزة متاحة فقط في تطبيق مرشد.');
      return;
    }
    if (force) setRefreshing(true);
    try {
      const state = force ? await api.repo.sync(repoKey) : await api.repo.list(repoKey);
      applyState(state);
      if (state?.ok === false) setError(state.error || 'تعذر تحميل الملفات.');
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الملفات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, repoKey, applyState]);

  useEffect(() => {
    load(false);
  }, [load]);

  // Push updates from the sync service + a light 5-second refresh as a fallback.
  useEffect(() => {
    if (!api?.repo) return;
    const off = api.repo.onUpdate?.((data: any) => {
      if (data?.key === repoKey) applyState(data);
    });
    const timer = window.setInterval(() => {
      api.repo.list(repoKey).then(applyState).catch(() => {});
    }, 5000);
    return () => {
      if (typeof off === 'function') off();
      window.clearInterval(timer);
    };
  }, [api, repoKey, applyState]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((file) => file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q));
  }, [files, search]);

  const run = async (file: RepoFile, action: 'open' | 'save' | 'print') => {
    if (!api?.repo) return;
    setBusy({ path: file.path, action });
    try {
      if (action === 'open') {
        const result = await api.repo.open(repoKey, file.path);
        if (!result?.ok) notify('error', result?.error || 'تعذر فتح الملف.');
      } else if (action === 'save') {
        const result = await api.repo.save(repoKey, file.path, file.name, mode === 'covers' ? coverValues : undefined);
        if (result?.canceled) return;
        if (!result?.ok) notify('error', result?.error || 'تعذر حفظ الملف.');
        else notify('success', `تم حفظ الملف: ${result.filePath || file.name}`);
      } else {
        const result = await api.repo.print(repoKey, file.path, mode === 'covers' ? coverValues : undefined);
        if (!result?.ok) notify('error', result?.error || 'تعذرت الطباعة.');
        else if (result.note) notify('success', result.note);
        else notify('success', 'تم إرسال الملف إلى الطابعة.');
      }
    } catch (err: any) {
      notify('error', err?.message || 'حدث خطأ.');
    } finally {
      setBusy(null);
    }
  };

  const isCovers = mode === 'covers';

  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {toast && (
        <div
          className={`fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker">مكتبة عامة · تُحدَّث تلقائياً</p>
          <h1 className="mt-1.5 text-[24px] font-black leading-tight text-main">{title}</h1>
          <p className="mt-1 text-[11px] font-semibold text-muted">
            الملفات محفوظة للاستخدام دون اتصال — تُحدَّث كل 5 ثوانٍ، وتُحذف محلياً إذا حُذفت من المستودع.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-border-color bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted">
            آخر مزامنة: <span className="num text-sec">{formatTime(syncedAt)}</span>
          </span>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-1.5 !px-3 !py-2 !text-[11px] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            مزامنة الآن
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[11px] font-bold leading-relaxed text-danger">{error}</p>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="بحث في الملفات..."
          className="form-input !pr-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-border-color bg-card px-6 py-16 text-center shadow-xs">
          <FolderOpen className="mx-auto mb-3 h-9 w-9 text-muted" />
          <p className="text-[12px] font-black text-main">
            {search ? 'لا توجد نتائج مطابقة.' : 'لا توجد ملفات في هذا المستودع بعد.'}
          </p>
          <p className="mt-1 text-[10.5px] text-muted">
            ستظهر الملفات هنا تلقائياً فور إضافتها إلى المستودع.
          </p>
        </div>
      ) : isCovers ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((file) => (
            <div
              key={file.path}
              className="flex flex-col gap-3 rounded-[14px] border border-border-color bg-card p-4 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-bg text-primary">
                  <FileIcon name={file.name} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-main" title={file.name}>{file.name}</p>
                  <p className="mt-0.5 truncate text-[9.5px] text-muted" dir="ltr">{file.path}</p>
                  <p className="mt-1 text-[9.5px] font-semibold text-muted">
                    {formatSize(file.size)} · {file.local ? 'محفوظ دون اتصال' : 'قيد التنزيل'}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => run(file, 'print')}
                  disabled={busy?.path === file.path}
                  className="btn-primary flex flex-1 items-center justify-center gap-1.5 !px-3 !py-2 !text-[10.5px] disabled:opacity-60"
                >
                  {busy?.path === file.path && busy.action === 'print'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Printer className="h-3.5 w-3.5" />}
                  طباعة
                </button>
                <button
                  type="button"
                  onClick={() => run(file, 'save')}
                  disabled={busy?.path === file.path}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-border-color bg-card px-3 py-2 text-[10.5px] font-bold text-sec transition-colors hover:bg-hover disabled:opacity-60"
                >
                  {busy?.path === file.path && busy.action === 'save'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  تنزيل Word
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <section className="overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-divider-color bg-card-elevated text-[10px] font-black text-muted">
              <tr>
                <th className="px-4 py-2.5">الملف</th>
                <th className="px-4 py-2.5">الحجم</th>
                <th className="px-4 py-2.5">الحالة</th>
                <th className="px-4 py-2.5">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((file) => (
                <tr
                  key={file.path}
                  className="border-b border-divider-color last:border-0 transition-colors hover:bg-hover"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-primary-bg text-primary">
                        <FileIcon name={file.name} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] font-bold text-main" title={file.name}>{file.name}</p>
                        <p className="truncate text-[9px] text-muted" dir="ltr">{file.path}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] font-semibold text-muted">{formatSize(file.size)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      file.local ? 'bg-primary-bg text-primary' : 'bg-hover text-muted'
                    }`}>
                      {file.local ? 'متوفر دون اتصال' : 'قيد التنزيل'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => run(file, 'open')}
                        disabled={busy?.path === file.path}
                        title="فتح الملف"
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover hover:text-main disabled:opacity-50"
                      >
                        {busy?.path === file.path && busy.action === 'open'
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <ExternalLink className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => run(file, 'save')}
                        disabled={busy?.path === file.path}
                        title="حفظ نسخة"
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover hover:text-primary disabled:opacity-50"
                      >
                        {busy?.path === file.path && busy.action === 'save'
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
