/**
 * Repository library tab (مخاطبات التربية / الملفات / أغلفة السجلات).
 *
 * Files are mirrored from a public GitHub repository by the main process and
 * kept on disk for offline use. Cards show an inline preview (image, PDF, or a
 * companion preview image for Word covers) and open/save/print actions.
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
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Printer,
  Search,
  Send,
} from 'lucide-react';
import { toLatinDigits } from '../lib/format';

type RepoKey = 'letters' | 'files' | 'covers';

interface RepoFile {
  path: string;
  name: string;
  size: number;
  sha: string;
  local: boolean;
  /** Metadata from library.json (letters repository). */
  title?: string;
  description?: string;
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

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase();
}

function isImage(name: string): boolean {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extensionOf(name));
}

function isPdf(name: string): boolean {
  return extensionOf(name) === 'pdf';
}

function FileIcon({ name }: { name: string }) {
  const ext = extensionOf(name);
  if (isImage(name)) return <ImageIcon className="h-7 w-7" />;
  if (ext === 'pdf') return <FileText className="h-7 w-7" />;
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="h-7 w-7" />;
  if (['docx', 'doc'].includes(ext)) return <FileText className="h-7 w-7" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className="h-7 w-7" />;
  return <FileText className="h-7 w-7" />;
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${toLatinDigits(bytes)} بايت`;
  if (bytes < 1024 * 1024) return `${toLatinDigits(Math.round(bytes / 1024))} ك.ب`;
  return `${toLatinDigits((bytes / (1024 * 1024)).toFixed(1))} م.ب`;
}

function fileUrl(key: string, relPath: string): string {
  return `murshid-repo://${key}/${relPath.split('/').map(encodeURIComponent).join('/')}`;
}

/** Inline preview area: image, PDF first page, or a file-type placeholder. */
function Preview({ file, source, repoKey }: { file: RepoFile; source?: RepoFile; repoKey: RepoKey }) {
  const [failed, setFailed] = useState(false);
  const target = source || file;

  if (!failed && isImage(target.name)) {
    return (
      <img
        src={fileUrl(repoKey, target.path)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    );
  }

  if (!failed && isPdf(target.name)) {
    return (
      <div className="h-full w-full pointer-events-none bg-white">
        <iframe
          title={target.name}
          src={fileUrl(repoKey, target.path)}
          className="h-full w-full border-0"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-card-elevated text-muted">
      <FileIcon name={file.name} />
      <span className="text-[9px] font-bold uppercase">{extensionOf(file.name) || 'ملف'}</span>
    </div>
  );
}

export default function RepoLibraryView({
  repoKey,
  title,
  mode = 'library',
  coverValues,
}: RepoLibraryViewProps) {
  const api = (window as any).electronAPI;
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<{ path: string; action: 'open' | 'save' | 'print' } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [printerIssue, setPrinterIssue] = useState<RepoFile | null>(null);

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 4500);
  }, []);

  const applyState = useCallback((state: any) => {
    if (!state) return;
    if (Array.isArray(state.files)) setFiles(state.files);
    setError(state.error || '');
  }, []);

  const load = useCallback(async () => {
    if (!api?.repo) {
      setLoading(false);
      setError('هذه الميزة متاحة فقط في تطبيق مرشد.');
      return;
    }
    try {
      applyState(await api.repo.list(repoKey));
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الملفات.');
    } finally {
      setLoading(false);
    }
  }, [api, repoKey, applyState]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Preview images live in a "previews/" folder and are not listed as files.
  const previewMap = useMemo(() => {
    const map: Record<string, RepoFile> = {};
    files.forEach((file) => {
      if (file.path.startsWith('previews/') && isImage(file.name)) {
        map[baseName(file.name)] = file;
      }
    });
    return map;
  }, [files]);

  const visibleFiles = useMemo(
    () => files.filter((file) => !file.path.startsWith('previews/')),
    [files]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleFiles;
    return visibleFiles.filter(
      (file) =>
        file.path.toLowerCase().includes(query) || file.name.toLowerCase().includes(query)
    );
  }, [visibleFiles, search]);

  const run = async (file: RepoFile, action: 'open' | 'save' | 'print') => {
    if (!api?.repo) return;
    setBusy({ path: file.path, action });
    try {
      if (action === 'open') {
        const result = await api.repo.open(repoKey, file.path);
        if (!result?.ok) notify('error', result?.error || 'تعذر فتح الملف.');
      } else if (action === 'save') {
        const result = await api.repo.save(
          repoKey,
          file.path,
          file.name,
          mode === 'covers' ? coverValues : undefined
        );
        if (result?.canceled) return;
        if (!result?.ok) notify('error', result?.error || 'تعذر حفظ الملف.');
        else notify('success', `تم حفظ الملف: ${result.filePath || file.name}`);
      } else {
        const result = await api.repo.print(
          repoKey,
          file.path,
          mode === 'covers' ? coverValues : undefined
        );
        if (!result?.ok) {
          if (/طابعة/i.test(result?.error || '')) setPrinterIssue(file);
          else notify('error', result?.error || 'تعذرت الطباعة.');
        } else if (result.note) notify('success', result.note);
        else notify('success', 'تم إرسال الملف إلى الطابعة.');
      }
    } catch (err: any) {
      notify('error', err?.message || 'حدث خطأ.');
    } finally {
      setBusy(null);
    }
  };

  const isCovers = mode === 'covers';

  const shareFile = (file: RepoFile, channel: 'whatsapp' | 'telegram') => {
    const apiBridge = (window as any).electronAPI;
    const rawUrl = `https://raw.githubusercontent.com/jalalamanj1/${repoKey === 'letters' ? 'murshidletters' : 'murshidfiles'}/main/${file.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const title = file.title || file.name;
    const text = [title, file.description].filter(Boolean).join('\n');
    const target =
      channel === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(`${text}\n${rawUrl}`)}`
        : `https://t.me/share/url?url=${encodeURIComponent(rawUrl)}&text=${encodeURIComponent(text)}`;
    apiBridge?.openExternal?.(target);
  };

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

      <header>
        <h1 className="text-[24px] font-black leading-tight text-main">{title}</h1>
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

      {printerIssue && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border-color bg-card shadow-2xl">
            <div className="border-b border-divider-color px-5 py-4">
              <h3 className="text-sm font-black text-main">لا توجد طابعة متصلة</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-sec">
                لم يكتشف التطبيق أي طابعة متصلة عبر USB أو Wi-Fi. تحقق من توصيل الطابعة
                ثم اضغط «إعادة الفحص» للمحاولة مرة أخرى.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-divider-color px-5 py-3">
              <button
                type="button"
                onClick={() => setPrinterIssue(null)}
                className="btn-secondary !px-4 !py-2 !text-[11px]"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  const file = printerIssue;
                  setPrinterIssue(null);
                  if (file) void run(file, 'print');
                }}
                className="btn-primary !px-4 !py-2 !text-[11px]"
              >
                إعادة الفحص
              </button>
            </div>
          </div>
        </div>
      )}

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
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isCovers ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          {filtered.map((file) => {
            const companion = previewMap[baseName(file.name)];
            const isBusy = busy?.path === file.path;
            return (
              <div
                key={file.path}
                className="flex flex-col overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs"
              >
                <div className={`${isCovers ? 'aspect-[3/4]' : 'h-36'} w-full overflow-hidden border-b border-divider-color bg-card-elevated`}>
                  <Preview
                    file={file}
                    repoKey={repoKey}
                    source={companion || (isImage(file.name) || isPdf(file.name) ? file : undefined)}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    {!isCovers && (
                      <>
                        <p className="truncate text-[12px] font-black text-main" title={file.title || file.name}>
                          {file.title || file.name}
                        </p>
                        {file.title && file.title !== file.name && (
                          <p className="mt-0.5 truncate text-[9px] text-muted" dir="ltr">{file.name}</p>
                        )}
                        {file.description && (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-sec">
                            {file.description}
                          </p>
                        )}
                      </>
                    )}
                    <p className={`text-[9.5px] font-semibold text-muted ${isCovers ? 'text-center' : 'mt-1'}`}>
                      {formatSize(file.size)}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    {isCovers ? (
                      <>
                        <button
                          type="button"
                          onClick={() => run(file, 'print')}
                          disabled={isBusy}
                          className="btn-primary flex flex-1 items-center justify-center gap-1.5 !px-3 !py-2 !text-[10.5px] disabled:opacity-60"
                        >
                          {isBusy && busy.action === 'print'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Printer className="h-3.5 w-3.5" />}
                          طباعة
                        </button>
                        <button
                          type="button"
                          onClick={() => run(file, 'save')}
                          disabled={isBusy}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-border-color bg-card px-3 py-2 text-[10.5px] font-bold text-sec transition-colors hover:bg-hover disabled:opacity-60"
                        >
                          {isBusy && busy.action === 'save'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          تنزيل Word
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => run(file, 'open')}
                          disabled={isBusy}
                          className="btn-secondary flex flex-1 items-center justify-center gap-1.5 !px-2 !py-2 !text-[10.5px] disabled:opacity-60"
                        >
                          {isBusy && busy.action === 'open'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ExternalLink className="h-3.5 w-3.5" />}
                          فتح
                        </button>
                        <button
                          type="button"
                          onClick={() => run(file, 'save')}
                          disabled={isBusy}
                          className="btn-primary flex flex-1 items-center justify-center gap-1.5 !px-2 !py-2 !text-[10.5px] disabled:opacity-60"
                        >
                          {isBusy && busy.action === 'save'
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          تنزيل
                        </button>
                        {!isCovers && (
                          <>
                            <button
                              type="button"
                              onClick={() => shareFile(file, 'whatsapp')}
                              title="مشاركة عبر واتساب"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border-color bg-card text-[#25D366] transition-colors hover:bg-hover"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => shareFile(file, 'telegram')}
                              title="مشاركة عبر تيليجرام"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border-color bg-card text-[#229ED9] transition-colors hover:bg-hover"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
