/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DriveFolderView - Murshid PUBLIC Google Drive folders.
 *
 *   letters (مخاطبات التربية)  -> READ ONLY
 *   files   (ملفات)            -> READ + upload own files
 *
 * Both folders are public and owned by the app owner. Their contents are
 * displayed WITHOUT any user Google login (via Google's public folder
 * view). Uploading to the ملفات folder reuses the SAME Google login as
 * Online Backup (drive.file scope only, no extra scopes). Only the
 * uploading account can delete its own file and only within 1 hour.
 */

import React, { useState, useCallback } from 'react';
import {
  FolderOpen,
  File,
  RefreshCw,
  Loader2,
  Download,
  Eye,
  Share2,
  X,
  Search,
  LayoutGrid,
  List,
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
  Upload,
  Trash2,
  User,
  Clock,
} from 'lucide-react';
import {
  DRIVE_FOLDERS,
  PublicDriveFile as DriveFile,
  listPublicFolder,
  publicPreviewUrl,
  publicThumbnailUrl,
  publicShareUrl,
  isPreviewable,
  downloadPublicFile,
  getDriveAccessToken,
  connectDriveAccount,
  uploadSharedFile,
  listOwnUploads,
  deleteSharedFile,
  timeAgo,
  OwnUpload,
} from '../lib/publicDrive';
import { loadProfile } from '../lib/storage';

interface DriveFolderViewProps {
  folderKey: 'letters' | 'files';
  title: string;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function extName(file: DriveFile): string {
  const parts = (file.name || '').split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function FileTypeIcon({ file }: { file: DriveFile }) {
  if (file.isImage) return <Image className="w-4 h-4" />;
  if (file.isPdf) return <FileText className="w-4 h-4" />;
  if (file.mimeType.includes('sheet') || file.mimeType.includes('excel')) return <FileSpreadsheet className="w-4 h-4" />;
  if (file.mimeType.includes('word') || file.isGoogleNative) return <FileText className="w-4 h-4" />;
  if (file.isFolder) return <FolderOpen className="w-4 h-4" />;
  return <FileArchive className="w-4 h-4" />;
}

/** Image thumbnail with automatic fallback to the file-type icon. */
function FileThumb({ file }: { file: DriveFile }) {
  const [failed, setFailed] = React.useState(false);
  if (!file.isImage || failed) {
    return (
      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400">
        <FileTypeIcon file={file} />
      </div>
    );
  }
  return (
    <img
      src={publicThumbnailUrl(file, 400)}
      alt={file.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-14 h-14 rounded-lg object-cover bg-slate-100 dark:bg-slate-900"
    />
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function DriveFolderView({ folderKey, title }: DriveFolderViewProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const [shareFile, setShareFile] = useState<DriveFile | null>(null);
  const [shareUrl, setShareUrl] = useState('');

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── Upload state (files tab only) ─────────────────────────────────
  const [ownUploads, setOwnUploads] = useState<Record<string, OwnUpload>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isFilesTab = folderKey === 'files';

  // 1 hour in ms — the only window in which the uploader may delete its own file.
  const OWN_DELETE_WINDOW_MS = 60 * 60 * 1000;

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listPublicFolder(DRIVE_FOLDERS[folderKey]);
      setFiles(items);
      // On the files tab, also load which files the logged-in account
      // uploaded itself (only those are deletable, within 1 hour).
      if (isFilesTab) {
        try {
          const own = await listOwnUploads(DRIVE_FOLDERS[folderKey]);
          const map: Record<string, OwnUpload> = {};
          own.forEach(o => { map[o.id] = o; });
          setOwnUploads(map);
        } catch {
          setOwnUploads({});
        }
      } else {
        setOwnUploads({});
      }
    } catch (err: any) {
      const msg = err.message || 'تعذر تحميل الملفات.';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
    }
  }, [folderKey, isFilesTab, addToast]);

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderKey]);

  // ── Preview ────────────────────────────────────────────────────────
  const [previewImgFailed, setPreviewImgFailed] = useState(false);

  const openPreview = (file: DriveFile) => {
    setPreviewFile(file);
    setPreviewImgFailed(false);
  };
  // ── Download ───────────────────────────────────────────────────────
  const handleDownload = async (file: DriveFile) => {
    setDownloadingId(file.id);
    try {
      const saveFolder = localStorage.getItem('murshid_save_folder') || '';
      const result = await downloadPublicFile(file, saveFolder);
      if (result.viaBrowser) {
        (window as any).electronAPI?.openExternal?.(`https://drive.google.com/uc?export=download&id=${file.id}`).catch(() => {});
        addToast('info', 'جاري التنزيل عبر المتصفح...');
      } else {
        addToast('success', 'تم تنزيل الملف: ' + (result.filePath || ''));
      }
    } catch (err: any) {
      addToast('error', err.message || 'فشل تنزيل الملف.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Share (public file link) ───────────────────────────────────────
  const handleShare = (file: DriveFile) => {
    setShareFile(file);
    setShareUrl(publicShareUrl(file));
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

  // ── Upload (files tab only) ────────────────────────────────────────
  const canDelete = (file: DriveFile): boolean => {
    if (!isFilesTab) return false;
    const own = ownUploads[file.id];
    if (!own?.uploadedAt) return false;
    const age = Date.now() - new Date(own.uploadedAt).getTime();
    return age >= 0 && age <= OWN_DELETE_WINDOW_MS;
  };

  const openUploadPicker = async () => {
    if (!isFilesTab) return;
    setError('');
    try {
      // Uploading needs the same Google login as Online Backup.
      const token = await getDriveAccessToken();
      if (!token) {
        await connectDriveAccount();
      }
      fileInputRef.current?.click();
    } catch (err: any) {
      addToast('error', err.message || 'تعذر الاتصال بحساب Google.');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
    setUploadDescription('');
    setShowUploadModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile || !isFilesTab) return;
    if (!uploadTitle.trim()) {
      addToast('warning', 'يرجى إدخال عنوان الملف.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const profile = loadProfile();
      await uploadSharedFile(
        uploadFile,
        uploadTitle,
        uploadDescription,
        profile?.fullName || 'مستخدم',
        DRIVE_FOLDERS.files
      );
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      addToast('success', 'تم رفع الملف بنجاح.');
      await refresh();
    } catch (err: any) {
      addToast('error', err.message || 'فشل رفع الملف.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: DriveFile) => {
    if (!canDelete(file)) {
      addToast('warning', 'يمكنك حذف ملفك خلال ساعة واحدة فقط من رفعه.');
      return;
    }
    if (!window.confirm(`هل تريد حذف «${file.name}»؟`)) return;
    setDeletingId(file.id);
    try {
      await deleteSharedFile(file.id);
      addToast('success', 'تم حذف الملف.');
      await refresh();
    } catch (err: any) {
      addToast('error', err.message || 'فشل حذف الملف.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = files.filter(f => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (f.name || '').toLowerCase().includes(q);
  });

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
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <FolderOpen className="w-5 h-5 text-office-blue dark:text-blue-400" />
          </div>
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h2>
        </div>
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

        {isFilesTab && (
          <button
            onClick={openUploadPicker}
            className="bg-office-blue hover:bg-office-hover text-white px-3 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>رفع ملف</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
        />
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
                <FileThumb file={file} />
                <div className="flex items-center gap-1">
                  {canDelete(file) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                      disabled={deletingId === file.id}
                      title="حذف (متاح خلال ساعة من الرفع)"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <span className="text-[9px] font-mono text-slate-400 uppercase">{extName(file) || 'ملف'}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-2 break-all">{file.name}</p>
                <p className="text-[9px] text-slate-400 mt-1">{file.modified}</p>
                {isFilesTab && ownUploads[file.id] && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[9px] font-bold text-office-blue dark:text-blue-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {ownUploads[file.id].uploaderName || 'أنت'}
                    </p>
                    {ownUploads[file.id].uploadedAt && (
                      <p className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(ownUploads[file.id].uploadedAt)}
                      </p>
                    )}
                  </div>
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
                  <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 dark:text-slate-400">آخر تعديل</th>
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
                        <div className="min-w-0">
                          <button
                            onClick={() => openPreview(file)}
                            className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-office-blue dark:hover:text-blue-400 transition-colors cursor-pointer text-right break-all"
                          >
                            {file.name}
                          </button>
                          {isFilesTab && ownUploads[file.id] && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold text-office-blue dark:text-blue-400 flex items-center gap-1 whitespace-nowrap">
                                <User className="w-3 h-3" />
                                {ownUploads[file.id].uploaderName || 'أنت'}
                              </span>
                              {ownUploads[file.id].uploadedAt && (
                                <span className="text-[9px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                                  <Clock className="w-3 h-3" />
                                  {timeAgo(ownUploads[file.id].uploadedAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{file.modified || '—'}</td>
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
                        {canDelete(file) && (
                          <button
                            onClick={() => handleDelete(file)}
                            disabled={deletingId === file.id}
                            title="حذف (متاح خلال ساعة من الرفع)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
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

      {/* Upload Modal */}
      {showUploadModal && uploadFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Upload className="w-5 h-5 text-office-blue dark:text-blue-400 shrink-0" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">رفع ملف</h3>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-800">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate" dir="ltr">{uploadFile.name}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  عنوان الملف <span className="text-rose-500">*</span>
                </label>
                <input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="أدخل عنوان الملف..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">وصف الملف (اختياري)</label>
                <textarea
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  placeholder="أدخل وصفاً للملف..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploading || !uploadTitle.trim()}
                className="flex-1 bg-office-blue hover:bg-office-hover text-white py-2.5 text-[11px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{uploading ? 'جاري الرفع...' : 'رفع'}</span>
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
              {previewFile.isImage && !previewImgFailed ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <img
                    key={previewFile.id}
                    src={publicPreviewUrl(previewFile)}
                    alt={previewFile.name}
                    onError={() => setPreviewImgFailed(true)}
                    className="max-w-full max-h-[70vh] mx-auto rounded-xl shadow-sm"
                  />
                </div>
              ) : isPreviewable(previewFile) ? (
                <iframe
                  title="معاينة الملف"
                  src={publicPreviewUrl(previewFile)}
                  className="w-full h-full min-h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1e293b] text-slate-300 dark:text-slate-600">
                    <FileTypeIcon file={previewFile} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 break-all px-6">{previewFile.name}</p>
                    <p className="text-[10px] text-slate-400">لا يمكن معاينة هذا النوع من الملفات داخل التطبيق.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(previewFile)}
                      disabled={downloadingId === previewFile.id}
                      className="flex items-center gap-1.5 bg-office-blue hover:bg-office-hover text-white px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {downloadingId === previewFile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      تنزيل
                    </button>
                    <button
                      onClick={() => handleShare(previewFile)}
                      className="flex items-center gap-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      مشاركة
                    </button>
                  </div>
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

            {shareUrl && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">رابط الملف</label>
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
                  <p className="text-[10px] text-office-blue dark:text-blue-400">يمكن للمستلم فتح الملف عبر الرابط.</p>
                </div>
              </>
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
