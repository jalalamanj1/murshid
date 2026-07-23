import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Download, FileText, Search, Loader2, AlertTriangle, CheckCircle,
  File, Image, FileSpreadsheet, ChevronDown, X, Eye, FolderOpen,
} from 'lucide-react';

const ROOT_FOLDER_ID = '1U5Fows578m6t9WJNe0HNWYG2m0D6HiDO';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_STORAGE = 'murshid_gdrive_token';
const SAVE_DIR = 'Documents/Murshid/Official Letters';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  thumbnailLink?: string;
  hasThumbnail?: boolean;
  description?: string;
}

type SortField = 'createdTime' | 'name';
type SortDir = 'asc' | 'desc';

function loadToken(): string | null {
  const raw = localStorage.getItem(TOKEN_STORAGE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data.access_token || null;
  } catch { return null; }
}

function saveToken(tokens: any) {
  localStorage.setItem(TOKEN_STORAGE, JSON.stringify(tokens));
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet;
  if (mime.includes('pdf')) return FileText;
  if (mime.includes('word') || mime.includes('document')) return FileText;
  return File;
}

function getFileColor(mime: string) {
  if (mime.startsWith('image/')) return 'text-pink-600 bg-pink-50 dark:bg-pink-950/30';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
  if (mime.includes('pdf')) return 'text-rose-600 bg-rose-50 dark:bg-rose-950/30';
  if (mime.includes('word') || mime.includes('document')) return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30';
  return 'text-slate-600 bg-slate-50 dark:bg-slate-800';
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function OfficialLettersView() {
  const [token, setToken] = useState<string | null>(loadToken);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [toast, setToast] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-show toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 1200);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const electron = (window as any).electronAPI;
      if (electron?.driveAuth) {
        const res = await electron.driveAuth();
        if (res.ok) {
          saveToken(res.tokens);
          setToken(res.tokens.access_token);
        } else {
          setError(res.error || 'فشل الاتصال بـ Google Drive.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال.');
    } finally {
      setConnecting(false);
    }
  };

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      let all: DriveFile[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${ROOT_FOLDER_ID}' in parents and trashed=false`,
          fields: 'files(id,name,mimeType,size,createdTime,thumbnailLink,hasThumbnail,description),nextPageToken',
          pageSize: '200',
          orderBy: 'createdTime desc',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const resp = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 401) {
          setToken(null);
          setLoading(false);
          return;
        }
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(err);
        }
        const data = await resp.json();
        all = [...all, ...(data.files || [])];
        pageToken = data.nextPageToken;
      } while (pageToken);
      setFiles(all);
    } catch (err: any) {
      setError('تعذر الاتصال بالمجلد السحابي.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchFiles();
    else setLoading(false);
  }, [token, fetchFiles]);

  // Filter + Sort
  const filtered = files.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q);
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name, 'ar');
    else if (sortField === 'createdTime') cmp = (a.createdTime || '').localeCompare(b.createdTime || '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const openFile = (file: DriveFile) => {
    const url = `https://drive.google.com/file/d/${file.id}/preview`;
    window.open(url, '_blank');
  };

  const handleDownload = async (file: DriveFile) => {
    if (!token) return;
    try {
      const electron = (window as any).electronAPI;
      if (electron?.saveFile) {
        const resp = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error('فشل التحميل');
        const blob = await resp.blob();
        const base64 = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
        const res = await electron.saveFile(file.name, base64);
        if (res && res.ok) {
          setToast('تم تنزيل الملف بنجاح');
        }
      } else {
        // Fallback: direct download link
        window.open(`https://drive.google.com/uc?export=download&id=${file.id}`, '_blank');
        setToast('تم تنزيل الملف بنجاح');
      }
    } catch {
      setError('تعذر تنزيل الملف.');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
    setUploadDescription('');
    setShowUpload(true);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!token || !uploadFile) return;
    setUploading(true);
    setError('');
    try {
      const ext = uploadFile.name.includes('.') ? uploadFile.name.substring(uploadFile.name.lastIndexOf('.')) : '';
      if (!uploadTitle.trim()) { setUploading(false); setError('يرجى إدخال عنوان الملف.'); return; }
      if (!uploadDescription.trim()) { setUploading(false); setError('يرجى إدخال وصف الملف.'); return; }

      const newName = uploadTitle.trim() + ext;

      const metadata = { name: newName, description: uploadDescription.trim(), parents: [ROOT_FOLDER_ID] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', uploadFile);

      const resp = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err);
      }

      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setToast('تم رفع الملف بنجاح');
      fetchFiles();
    } catch {
      setError('فشل رفع الملف.');
    } finally {
      setUploading(false);
    }
  };

  // Not connected
  if (!token) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 max-w-md w-full text-center space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">الاتصال بالمجلد السحابي</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            قم بتسجيل الدخول إلى Google Drive للوصول إلى مخاطباتك الرسمية.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-office-blue hover:bg-office-hover disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 mx-auto"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>تسجيل الدخول إلى Google</span>
          </button>
          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">مخاطبات رسمية</h2>
            <p className="text-[10px] text-slate-400">{files.length} ملف</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم..."
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-office-blue w-48"
            />
          </div>

          {/* Upload */}
          <button
            onClick={handleUploadClick}
            className="bg-office-blue hover:bg-office-hover text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>رفع ملف</span>
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-slate-500 font-bold">ترتيب:</span>
        <button onClick={() => { if (sortField === 'createdTime') setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortField('createdTime'); setSortDir('desc'); } }}
          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${sortField === 'createdTime' ? 'bg-office-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          الأحدث
        </button>
        <button onClick={() => { if (sortField === 'createdTime') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('createdTime'); setSortDir('asc'); } }}
          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${sortField === 'createdTime' && sortDir === 'asc' ? 'bg-office-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          الأقدم
        </button>
        <button onClick={() => { if (sortField === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('name'); setSortDir('asc'); } }}
          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${sortField === 'name' ? 'bg-office-blue text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          الاسم
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{error}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-400">
          {search ? 'لا توجد نتائج مطابقة.' : 'لا توجد ملفات في هذا المجلد.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(file => {
            const Icon = getFileIcon(file.mimeType);
            const color = getFileColor(file.mimeType);
            return (
              <div key={file.id} onClick={() => setSelectedFile(file)} className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all overflow-hidden group cursor-pointer">
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden relative">
                  {file.hasThumbnail && file.thumbnailLink ? (
                    <img src={file.thumbnailLink} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`p-4 rounded-2xl ${color}`}>
                      <Icon className="w-10 h-10" />
                    </div>
                  )}
                  {/* Hover actions overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); openFile(file); }}
                      className="bg-white/90 hover:bg-white text-slate-800 p-2 rounded-lg transition-colors cursor-pointer" title="عرض">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                      className="bg-white/90 hover:bg-white text-slate-800 p-2 rounded-lg transition-colors cursor-pointer" title="تحميل">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 space-y-1">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                    {file.name}
                  </p>
                  {file.createdTime && (
                    <p className="text-[9px] text-slate-400">{formatDate(file.createdTime)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      {showUpload && uploadFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowUpload(false); setUploadFile(null); }}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-[380px] p-5 space-y-4"
            onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">رفع ملف</h3>
              <button onClick={() => { setShowUpload(false); setUploadFile(null); }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">الملف المحدد: {uploadFile.name}</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">عنوان الملف <span className="text-rose-500">*</span></label>
                <input type="text" value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="أدخل عنوان الملف..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-office-blue"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">وصف الملف <span className="text-rose-500">*</span></label>
                <textarea value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  placeholder="أدخل وصفاً للملف..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-office-blue resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowUpload(false); setUploadFile(null); }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer">
                إلغاء
              </button>
              <button onClick={handleUploadSubmit} disabled={uploading || !uploadTitle.trim() || !uploadDescription.trim()}
                className="flex-1 bg-office-blue hover:bg-office-hover disabled:opacity-60 text-white py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>رفع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedFile(null)}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-[480px] max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()} dir="rtl">
            {/* Preview Image */}
            <div className="bg-slate-100 dark:bg-slate-900 h-52 flex items-center justify-center overflow-hidden">
              {selectedFile.hasThumbnail && selectedFile.thumbnailLink ? (
                <img src={selectedFile.thumbnailLink} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className={`p-6 rounded-2xl ${getFileColor(selectedFile.mimeType)}`}>
                  {React.createElement(getFileIcon(selectedFile.mimeType), { className: 'w-16 h-16' })}
                </div>
              )}
            </div>
            {/* Info */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex-1 break-words">
                  {selectedFile.name}
                </h3>
                <button onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold min-w-[70px]">نوع الملف:</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedFile.mimeType}</span>
                </div>
                {selectedFile.size && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold min-w-[70px]">الحجم:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedFile.size}</span>
                  </div>
                )}
                {selectedFile.createdTime && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold min-w-[70px]">تاريخ الرفع:</span>
                    <span className="text-slate-700 dark:text-slate-300">{formatDate(selectedFile.createdTime)}</span>
                  </div>
                )}
                {selectedFile.description && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-bold text-xs block mb-1">الوصف:</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedFile.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { openFile(selectedFile); setSelectedFile(null); }}
                  className="flex-1 bg-office-blue hover:bg-office-hover text-white py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer">
                  عرض الملف
                </button>
                <button onClick={() => { handleDownload(selectedFile); setSelectedFile(null); }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  تحميل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 px-8 py-6 flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
