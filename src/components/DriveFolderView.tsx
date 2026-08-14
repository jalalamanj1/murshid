/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DriveFolderView - Murshid owner Google Drive folders via the backend.
 *
 *   letters (مخاطبات التربية)  -> READ ONLY
 *   files   (الملفات)          -> READ + UPLOAD + OWN-UPLOAD DELETE
 *
 * All uploads/deletes are enforced server-side (identity, title, and the
 * one-hour delete window live on the backend, never in this client).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  File,
  RefreshCw,
  Loader2,
  Download,
  Upload,
  Trash2,
  Eye,
  Share2,
  X,
  Search,
  LayoutGrid,
  List,
  Cloud,
  CloudOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  FileArchive,
  Image,
  FileText,
  FileSpreadsheet,
  Send,
  Link2,
} from 'lucide-react';
import { CounselorProfile } from '../types';

// ── Types ────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string | null;
  modifiedTime: string | null;
  isFolder: boolean;
  isUpload: boolean;
  uploaderId?: string;
  uploaderName?: string;
  uploadedAt?: string;
  canDelete?: boolean;
}

interface DriveFolderViewProps {
  folderKey: 'letters' | 'files';
  title: string;
  subtitle: string;
  description: string;
  readOnly?: boolean;
  profile: CounselorProfile;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isImage(mime: string) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

function isPdf(mime: string) {
  return mime === 'application/pdf';
}

function isText(mime: string) {
  return typeof mime === 'string' && (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript' || mime === 'application/xml');
}

function isDoc(mime: string) {
  return typeof mime === 'string' && (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function isSheet(mime: string) {
  return typeof mime === 'string' && (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

function extName(file: DriveFile): string {
  const parts = (file.name || '').split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function FileTypeIcon({ file }: { file: DriveFile }) {
  if (isImage(file.mimeType)) return <Image className="w-4 h-4" />;
  if (isPdf(file.mimeType)) return <FileText className="w-4 h-4" />;
  if (isSheet(file.mimeType)) return <FileSpreadsheet className="w-4 h-4" />;
  if (isDoc(file.mimeType)) return <FileText className="w-4 h-4" />;
  if (file.mimeType === 'application/vnd.google-apps.folder') return <FolderOpen className="w-4 h-4" />;
  if (String(file.mimeType).startsWith('application/vnd.google-apps.')) return <FileText className="w-4 h-4" />;
  return <FileArchive className="w-4 h-4" />;
}

// ── Component ────────────────────────────────────────────────────────

export default function DriveFolderView({ folderKey, title, subtitle, description, readOnly, profile }: DriveFolderViewProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedUser, setConnectedUser] = useState<string>('');

  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewData, setPreviewData] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');

  const [shareFile, setShareFile] = useState<DriveFile | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const api = () => (window as any).electronAPI?.driveFolder;

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async (append = false) => {
    const e = api();
    if (!e) {
      setError('بيئة سطح المكتب غير متوفرة.');
      setLoading(false);
      return;
    }
    if (!append) setLoading(true);
    setError('');
    try {
      const res = await e.list(folderKey);
      if (!res.ok) throw new Error(res.error || 'فشل تحميل الملفات.');
      setFiles(prev => append ? [...prev, ...(res.files || [])] : (res.files || []));
      setNextPageToken(res.nextPageToken || null);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل الملفات.');
      addToast('error', err.message || 'تعذر تحميل الملفات.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [folderKey, addToast]);

  // Register identity + load folder on mount
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const e = api();
      if (!e) {
        setConnected(false);
        return;
      }
      try {
        const st = await e.status(profile);
        if (cancelled) return;
        if (st.ok) {
          setConnected(true);
          setConnectedUser(st.user?.name || '');
        } else {
          setConnected(false);
          addToast('warning', st.error || 'تعذر الاتصال بخادم مرشد.');
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    boot();
    refresh();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Preview ────────────────────────────────────────────────────────
  const openPreview = async (file: DriveFile) => {
    setPreviewFile(file);
    setPreviewData(null);
    setPreviewText('');
    if (isImage(file.mimeType) || isPdf(file.mimeType) || isText(file.mimeType)) {
      setPreviewLoading(true);
      try {
        const res = await api().preview(file.id);
        if (!res.ok) throw new Error(res.error || 'تعذر عرض المعاينة.');
        if (isText(res.mimeType || file.mimeType)) {
          const text = decodeURIComponent(escape(atob(res.base64)));
          setPreviewText(text);
        } else {
          setPreviewData({ base64: res.base64, mimeType: res.mimeType || file.mimeType, name: res.name || file.name });
        }
      } catch (err: any) {
        addToast('error', err.message || 'تعذر عرض المعاينة.');
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  // ── Download ───────────────────────────────────────────────────────
  const handleDownload = async (file: DriveFile) => {
    setDownloadingId(file.id);
    try {
      const saveFolder = localStorage.getItem('murshid_save_folder') || '';
      const res = await api().download(file.id, saveFolder);
      if (!res.ok) throw new Error(res.error || 'فشل تنزيل الملف.');
      addToast('success', 'تم تنزيل الملف: ' + (res.filePath || ''));
    } catch (err: any) {
      addToast('error', err.message || 'فشل تنزيل الملف.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────
  const handleShare = async (file: DriveFile) => {
    setShareFile(file);
    setShareUrl('');
    setShareLoading(true);
    try {
      const res = await api().share(file.id);
      if (!res.ok) throw new Error(res.error || 'فشل إنشاء رابط المشاركة.');
      setShareUrl(res.url);
    } catch (err: any) {
      addToast('error', err.message || 'فشل إنشاء رابط المشاركة.');
      setShareFile(null);
    } finally {
      setShareLoading(false);
    }
  };

  const shareVia = (channel: 'email' | 'telegram' | 'whatsapp') => {
    if (!shareFile || !shareUrl) return;
    const text = `ملف: ${shareFile.name}`;
    const full = `${text} - ${shareUrl}`;
    let target = shareUrl;
    if (channel === 'email') target = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(full)}`;
    if (channel === 'telegram') target = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    if (channel === 'whatsapp') target = `https://wa.me/?text=${encodeURIComponent(full)}`;
    (window as any).electronAPI?.openExternal?.(target).catch(() => {});
  };

  // ── Delete own upload ──────────────────────────────────────────────
  const handleDelete = async (file: DriveFile) => {
    if (!window.confirm(`حذف الملف «${file.name}»؟ لا يمكن الحذف بعد مرور ساعة من الرفع.`)) return;
    setDeletingId(file.id);
    try {
      const res = await api().delete(file.id);
      if (!res.ok) throw new Error(res.error || 'فشل حذف الملف.');
      setFiles(prev => prev.filter(f => f.id !== file.id));
      addToast('success', 'تم حذف الملف بنجاح.');
    } catch (err: any) {
      addToast('error', err.message || 'فشل حذف الملف.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Upload (files tab only) ────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result as string;
      resolve(r ? r.split(',')[1] || '' : '');
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف.'));
    reader.readAsDataURL(file);
  });

  const submitUpload = async () => {
    if (!uploadTitle.trim()) {
      addToast('warning', 'العنوان مطلوب.');
      return;
    }
    if (!uploadFile) {
      addToast('warning', 'الرجاء اختيار ملف للرفع.');
      return;
    }
    setUploading(true);
    setUploadProgress('جاري قراءة الملف...');
    try {
      const base64 = await fileToBase64(uploadFile);
      setUploadProgress('جاري الرفع إلى السحابة...');
      const res = await api().upload(folderKey, {
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        fileName: uploadFile.name,
        mimeType: uploadFile.type || 'application/octet-stream',
        base64,
      });
      if (!res.ok) throw new Error(res.error || 'فشل رفع الملف.');
      addToast('success', 'تم رفع الملف بنجاح.');
      setUploadOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      refresh();
    } catch (err: any) {
      addToast('error', err.message || 'فشل رفع الملف.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const filtered = files.filter(f => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (f.name || '').toLowerCase().includes(q) || (f.uploaderName || '').toLowerCase().includes(q);
  });

  const canUpload = !readOnly && connected;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Toasts */}
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

      {/* Header */}
      <div className="card bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <FolderOpen className="w-5 h-5 text-office-blue dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${
            connected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40'
              : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
          }`}>
            {connected ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
            <span>{connected ? (connectedUser || 'متصل') : 'غير متصل'}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{description}</p>
        {connectedUser && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">المساهم: {connectedUser}</p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الملفات..."
            className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-9 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
          />
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${view === 'list' ? 'bg-office-blue text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="عرض قائمة"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${view === 'grid' ? 'bg-office-blue text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="عرض شبكة"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => refresh()}
          disabled={loading}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>

        {canUpload && (
          <button
            onClick={() => setUploadOpen(true)}
            className="bg-office-blue hover:bg-office-hover text-white px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>رفع ملف</span>
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-office-blue dark:text-blue-400 animate-spin" />
        </div>
      ) : error && files.length === 0 ? (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">{error}</p>
          <button
            onClick={() => refresh()}
            className="mx-auto bg-office-blue hover:bg-office-hover text-white px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">
            {search ? 'لا توجد نتائج مطابقة.' : 'لا توجد ملفات في هذا المجلد بعد.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(file => (
            <div key={file.id} className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-office-blue/40 dark:hover:border-blue-700 p-3 flex flex-col gap-2 transition-all hover:shadow-sm cursor-pointer" onClick={() => openPreview(file)}>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400">
                  <FileTypeIcon file={file} />
                </div>
                <span className="text-[9px] font-mono text-slate-400 uppercase">{extName(file) || 'ملف'}</span>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-2 break-all">{file.name}</p>
                <p className="text-[9px] text-slate-400 mt-1">{fmtSize(file.size)}</p>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9px] text-slate-400">{fmtDate(file.createdTime)}</span>
                {file.canDelete && (
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">قابل للحذف</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">الملف</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">الحجم</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">التاريخ</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">المساهم</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 shrink-0">
                          <FileTypeIcon file={file} />
                        </div>
                        <button
                          onClick={() => openPreview(file)}
                          className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-office-blue dark:hover:text-blue-400 transition-colors cursor-pointer text-right break-all"
                        >
                          {file.name}
                        </button>
                        {file.canDelete && (
                          <span className="shrink-0 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">قابل للحذف</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{fmtSize(file.size)}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(file.createdTime)}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{file.uploaderName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openPreview(file)}
                          title="معاينة"
                          className="p-1.5 text-slate-400 hover:text-office-blue dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file.id}
                          title="تنزيل"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {downloadingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleShare(file)}
                          title="مشاركة"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        {file.canDelete && (
                          <button
                            onClick={() => handleDelete(file)}
                            disabled={deletingId === file.id}
                            title="حذف (ملفاتك فقط، خلال ساعة)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {nextPageToken && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => { setLoadingMore(true); refresh(true); }}
            disabled={loadingMore}
            className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 hover:border-office-blue/40 text-slate-600 dark:text-slate-400 px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>تحميل المزيد</span>
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { if (!uploading) { setUploadOpen(false); setUploadTitle(''); setUploadDescription(''); setUploadFile(null); } }}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-office-blue dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">رفع ملف إلى «{title}»</h3>
              </div>
              <button onClick={() => { setUploadOpen(false); setUploadTitle(''); setUploadDescription(''); setUploadFile(null); }} disabled={uploading} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                العنوان <span className="text-rose-500">*</span>
              </label>
              <input
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="مثال: تقرير اجتماع الإرشاد"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">الوصف (اختياري)</label>
              <textarea
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                rows={2}
                placeholder="وصف مختصر للملف..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">الملف</label>
              <input
                ref={uploadInputRef}
                type="file"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-[11px] text-slate-600 dark:text-slate-400 file:ml-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-office-blue file:text-white hover:file:bg-office-hover file:cursor-pointer"
              />
              {uploadFile && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                  <File className="w-4 h-4 text-office-blue dark:text-blue-400" />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold truncate">{uploadFile.name}</span>
                  <span className="text-[10px] text-slate-400 mr-auto">{fmtSize(uploadFile.size)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-100 dark:border-blue-900/40">
              <Info className="w-3.5 h-3.5 text-office-blue dark:text-blue-400 shrink-0" />
              <p className="text-[10px] text-office-blue dark:text-blue-400 leading-relaxed">
                ستُضاف هويتك (الاسم المسجَّل) تلقائياً. يمكنك حذف ملفك خلال ساعة واحدة فقط من الرفع.
              </p>
            </div>

            {uploading && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-office-blue dark:text-blue-400 animate-spin" />
                  <span className="text-[11px] font-bold text-office-blue dark:text-blue-400">{uploadProgress}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={submitUpload}
                disabled={uploading}
                className="flex-1 bg-office-blue hover:bg-office-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploading ? uploadProgress : 'رفع الملف'}</span>
              </button>
              <button
                onClick={() => { setUploadOpen(false); setUploadTitle(''); setUploadDescription(''); setUploadFile(null); }}
                disabled={uploading}
                className="px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 shrink-0">
                  <FileTypeIcon file={previewFile} />
                </div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{previewFile.name}</h3>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtSize(previewFile.size)}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(previewFile)}
                  disabled={downloadingId === previewFile.id}
                  title="تنزيل"
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {downloadingId === previewFile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleShare(previewFile)}
                  title="مشاركة"
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => setPreviewFile(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto min-h-0 bg-slate-50 dark:bg-slate-950/40 p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-office-blue dark:text-blue-400 animate-spin" />
                </div>
              ) : previewText ? (
                <pre className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{previewText}</pre>
              ) : previewData ? (
                isPdf(previewData.mimeType) ? (
                  <iframe
                    title="معاينة PDF"
                    src={`data:application/pdf;base64,${previewData.base64}`}
                    className="w-full h-full min-h-[50vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                  />
                ) : (
                  <img
                    src={`data:${previewData.mimeType};base64,${previewData.base64}`}
                    alt={previewData.name}
                    className="max-w-full max-h-[70vh] mx-auto rounded-xl shadow-sm"
                  />
                )
              ) : (
                <div className="text-center py-16 space-y-3">
                  <FileArchive className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">معاينة غير مدعومة لهذا النوع من الملفات.</p>
                  <p className="text-[10px] text-slate-400">يمكنك تنزيل الملف وعرضه على جهازك.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShareFile(null)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-office-blue dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">مشاركة «{shareFile.name}»</h3>
              </div>
              <button onClick={() => setShareFile(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {shareLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-office-blue dark:text-blue-400 animate-spin" />
              </div>
            ) : shareUrl ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">رابط المشاركة (صالح 24 ساعة)</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      dir="ltr"
                      value={shareUrl}
                      onFocus={e => e.target.select()}
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[10px] text-slate-600 dark:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => shareVia('email')}
                    className="flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-office-blue/40 rounded-xl p-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    البريد
                  </button>
                  <button
                    onClick={() => shareVia('telegram')}
                    className="flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-office-blue/40 rounded-xl p-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    تيليجرام
                  </button>
                  <button
                    onClick={() => shareVia('whatsapp')}
                    className="flex flex-col items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 text-[10px] font-bold text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    واتساب
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-100 dark:border-blue-900/40">
                  <Link2 className="w-3.5 h-3.5 text-office-blue dark:text-blue-400 shrink-0" />
                  <p className="text-[10px] text-office-blue dark:text-blue-400">من يستلم الرابط يمكنه معاينة الملف دون الحاجة إلى حساب.</p>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">فشل إنشاء رابط المشاركة.</div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShareFile(null)}
                className="px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
