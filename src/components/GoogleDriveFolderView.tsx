/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GoogleDriveFolderView — Google Drive folder browser + metadata via Google Sheets.
 * Persistent OAuth2 connection. Auto-connects on startup if token exists.
 * Uploads files to Drive and appends metadata rows to Google Sheets.
 * Displays unified view of Drive files + Sheet metadata.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Folder, File, Download, Search, RefreshCw, ChevronLeft,
  X, AlertTriangle, FolderOpen, Upload, Trash2,
  FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet, FileArchive,
  Info, Eye, Loader2, Home, Tag, User, Building2, Calendar, HardDrive,
} from 'lucide-react';
import {
  readAllMetadata, appendMetadata, deleteMetadata, updateMetadata,
  filterMetadata, FileMetadata,
} from '../lib/googleSheetsService';
import { loadProfile } from '../lib/storage';

// ── Configuration ────────────────────────────────────────────────────
const ROOT_FOLDER_ID = '1pNFVBUHEr0pRlo2w2b_r-JIGHdFJYo8I';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_STORAGE = 'murshid_gdrive_token';
const CLIENT_ID = '580475588026-dbegiao33oj4la66oqaqiritml88erfp.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = window.location.origin;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

const UPLOAD_CATEGORIES = [
  'توجيه إرشادي',
  'سجلات صحية',
  'سجلات حالات خاصة',
  'نماذج قوالب',
  'تقارير دراسات حالة',
  'نشاط يومي',
  'ملفات متنوعة',
];

// ── Types ────────────────────────────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  kind: string;
}

interface DriveFileWithMeta extends DriveFile {
  meta?: FileMetadata;
}

interface Breadcrumb {
  id: string;
  name: string;
}

type SortField = 'name' | 'mimeType' | 'size' | 'modifiedTime' | 'category' | 'uploadedBy' | 'school';
type SortDir = 'asc' | 'desc';

// ── Helpers ──────────────────────────────────────────────────────────
function formatSize(bytes: string | undefined): string {
  if (!bytes) return '—';
  const b = parseInt(bytes, 10);
  if (isNaN(b) || b === 0) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-IQ', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive') || mimeType.includes('compressed')) return FileArchive;
  if (mimeType === 'application/vnd.google-apps.folder') return Folder;
  return File;
}

function getFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.google-apps.folder': 'مجلد',
    'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/gif': 'GIF',
    'image/webp': 'WebP', 'image/svg+xml': 'SVG',
    'video/mp4': 'MP4', 'video/webm': 'WebM',
    'audio/mpeg': 'MP3', 'audio/wav': 'WAV',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.ms-powerpoint': 'PPT',
    'text/plain': 'TXT', 'text/csv': 'CSV',
    'application/zip': 'ZIP', 'application/x-rar-compressed': 'RAR',
  };
  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith('image/')) return 'صورة';
  if (mimeType.startsWith('video/')) return 'فيديو';
  if (mimeType.startsWith('audio/')) return 'صوت';
  if (mimeType.includes('google-apps')) return 'Google Docs';
  return mimeType.split('/').pop()?.toUpperCase() || 'ملف';
}

function isFolder(mimeType: string): boolean {
  return mimeType === 'application/vnd.google-apps.folder';
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'text-emerald-500 dark:text-emerald-400';
  if (mimeType.startsWith('video/')) return 'text-purple-500 dark:text-purple-400';
  if (mimeType.startsWith('audio/')) return 'text-pink-500 dark:text-pink-400';
  if (mimeType.includes('pdf')) return 'text-rose-500 dark:text-rose-400';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-600 dark:text-green-400';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'text-blue-500 dark:text-blue-400';
  if (mimeType.includes('presentation')) return 'text-amber-500 dark:text-amber-400';
  if (isFolder(mimeType)) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-slate-400 dark:text-slate-500';
}

function getFileBg(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'bg-emerald-50 dark:bg-emerald-950/30';
  if (mimeType.startsWith('video/')) return 'bg-purple-50 dark:bg-purple-950/30';
  if (mimeType.startsWith('audio/')) return 'bg-pink-50 dark:bg-pink-950/30';
  if (mimeType.includes('pdf')) return 'bg-rose-50 dark:bg-rose-950/30';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'bg-green-50 dark:bg-green-950/30';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'bg-blue-50 dark:bg-blue-950/30';
  if (mimeType.includes('presentation')) return 'bg-amber-50 dark:bg-amber-950/30';
  if (isFolder(mimeType)) return 'bg-yellow-50 dark:bg-yellow-950/30';
  return 'bg-slate-50 dark:bg-slate-900/50';
}

// ── Token persistence ────────────────────────────────────────────────
interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expiry: number;
  email?: string;
  name?: string;
}

function loadStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAccessToken(): string | null {
  const stored = loadStoredToken();
  if (!stored) return null;
  // If not expired, return access token directly
  if (stored.expiry && Date.now() < stored.expiry - 60000) {
    return stored.access_token;
  }
  // Has refresh token — will be refreshed on mount, return current token as fallback
  if (stored.refresh_token) return stored.access_token;
  // Expired and no refresh token — clear
  localStorage.removeItem(TOKEN_STORAGE);
  return null;
}

function saveTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  email?: string;
  name?: string;
}): void {
  const existing = loadStoredToken();
  const expiresIn = data.expires_in || 3600;
  const stored: StoredToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || existing?.refresh_token,
    expiry: Date.now() + expiresIn * 1000,
    email: data.email || existing?.email,
    name: data.name || existing?.name,
  };
  localStorage.setItem(TOKEN_STORAGE, JSON.stringify(stored));
}

function clearTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE);
}

// ── Token refresh ────────────────────────────────────────────────────
async function refreshAccessToken(): Promise<string | null> {
  const stored = loadStoredToken();
  if (!stored?.refresh_token) return null;

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: stored.refresh_token,
      grant_type: 'refresh_token',
    });

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      // Refresh token revoked or invalid — clear everything
      clearTokens();
      return null;
    }

    const data = await resp.json();
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token, // Google may return new one
      expires_in: data.expires_in,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

async function exchangeCodeForTokens(code: string): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      console.error('Token exchange failed:', resp.status);
      return false;
    }

    const data = await resp.json();
    // Fetch user info
    let email: string | undefined;
    let name: string | undefined;
    try {
      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userResp.ok) {
        const userInfo = await userResp.json();
        email = userInfo.email;
        name = userInfo.name;
      }
    } catch { /* non-fatal */ }

    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      email,
      name,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Component ────────────────────────────────────────────────────────
export default function GoogleDriveFolderView() {
  const [accessToken, setAccessToken] = useState<string | null>(loadAccessToken);
  const [userEmail, setUserEmail] = useState<string | undefined>(() => loadStoredToken()?.email);
  const [userName, setUserName] = useState<string | undefined>(() => loadStoredToken()?.name);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [metadataMap, setMetadataMap] = useState<Map<string, FileMetadata>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: ROOT_FOLDER_ID, name: 'Google Drive' }]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedFile, setSelectedFile] = useState<DriveFileWithMeta | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState(UPLOAD_CATEGORIES[0]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Handle OAuth2 redirect (authorization code flow) ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // Authorization code received — exchange for tokens
      exchangeCodeForTokens(code).then(ok => {
        if (ok) {
          const stored = loadStoredToken();
          if (stored) {
            setAccessToken(stored.access_token);
            setUserEmail(stored.email);
            setUserName(stored.name);
          }
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, []);

  // ── Auto-refresh on mount if token expired ────────────────────────
  useEffect(() => {
    const stored = loadStoredToken();
    if (!stored) return;

    const now = Date.now();
    const timeUntilExpiry = stored.expiry - now;

    // Token is valid and not expiring soon — use it
    if (timeUntilExpiry > 120000) {
      setAccessToken(stored.access_token);
      setUserEmail(stored.email);
      setUserName(stored.name);
      return;
    }

    // Token expired or expiring soon — try refresh
    if (stored.refresh_token) {
      refreshAccessToken().then(newToken => {
        if (newToken) {
          setAccessToken(newToken);
          const updated = loadStoredToken();
          if (updated) {
            setUserEmail(updated.email);
            setUserName(updated.name);
          }
        } else {
          clearTokens();
          setAccessToken(null);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Periodic token refresh (every 45 minutes) ────────────────────
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      const stored = loadStoredToken();
      if (!stored?.refresh_token) return;
      const timeUntilExpiry = stored.expiry - Date.now();
      // Refresh if expiring within 5 minutes
      if (timeUntilExpiry < 300000) {
        refreshAccessToken().then(newToken => {
          if (newToken) setAccessToken(newToken);
        });
      }
    }, 45 * 60 * 1000); // Check every 45 minutes

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  // ── Network status + auto-reconnect ────────────────────────────────
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      // Auto-reconnect: if we have a refresh token but no valid access token, try refresh
      const stored = loadStoredToken();
      if (stored?.refresh_token && (!accessToken || Date.now() >= (stored.expiry - 60000))) {
        refreshAccessToken().then(newToken => {
          if (newToken) {
            setAccessToken(newToken);
          }
        });
      }
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [accessToken]);

  // ── OAuth2 connect (authorization code flow via local server) ────
  const handleConnect = async () => {
    const electron = (window as any).electronAPI;
    if (electron && electron.driveAuth) {
      setError('');
      setLoading(true);
      try {
        const res = await electron.driveAuth();
        if (res.ok) {
          saveTokens(res.tokens);
          setAccessToken(res.tokens.access_token);
          setUserEmail(res.tokens.email);
          setUserName(res.tokens.name);
        } else {
          setError(res.error || 'فشل الاتصال بـ Google Drive.');
        }
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء الاتصال.');
      } finally {
        setLoading(false);
      }
    } else {
      // Fallback for non-Electron: redirect-based flow
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────
  const handleDisconnect = () => {
    if (!confirm('هل تريد تسجيل الخروج من Google Drive؟ لن يتم حذف أي ملفات.')) return;
    clearTokens();
    setAccessToken(null);
    setUserEmail(undefined);
    setUserName(undefined);
    setFiles([]);
    setMetadataMap(new Map());
    setSelectedFile(null);
    setError('');
  };

  // ── Load metadata from Google Sheets ──────────────────────────────
  const loadMetadata = useCallback(async (token: string) => {
    try {
      const metas = await readAllMetadata(token);
      const map = new Map<string, FileMetadata>();
      for (const m of metas) {
        if (m.fileId) map.set(m.fileId, m);
      }
      setMetadataMap(map);
    } catch {
      // Sheets may not be available — non-fatal
    }
  }, []);

  // ── Load files from Google Drive ──────────────────────────────────
  const loadFiles = useCallback(async (folderId: string) => {
    if (!accessToken) return;
    if (!online) {
      setError('لا يوجد اتصال بالإنترنت. تحقق من الاتصال وأعد المحاولة.');
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setFiles([]);
    setSelectedIds(new Set());

    try {
      const fields = 'files(id,name,mimeType,size,modifiedTime,parents,kind)';
      const q = `'${folderId}' in parents and trashed=false`;
      const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=name&pageSize=1000`;

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          // Try token refresh before clearing
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            setAccessToken(refreshed);
            // Retry the request with new token
            const retryResp = await fetch(url, {
              signal: controller.signal,
              headers: { Authorization: `Bearer ${refreshed}` },
            });
            if (retryResp.ok) {
              const retryData = await retryResp.json();
              const retryItems: DriveFile[] = retryData.files || [];
              const retryFolders = retryItems.filter(f => isFolder(f.mimeType));
              const retryFiles = retryItems.filter(f => !isFolder(f.mimeType));
              setFiles([...retryFolders, ...retryFiles]);
              await loadMetadata(refreshed);
              return;
            }
          }
          // Refresh failed — clear and show reconnect prompt
          clearTokens();
          setAccessToken(null);
          setFiles([]);
          setError('انتهت صلاحية الجلسة. يرجى إعادة الاتصال بـ Google Drive.');
          return;
        }
        if (resp.status === 404) {
          throw new Error('المجلد غير موجود أو لا يمكن الوصول إليه.');
        }
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `خطأ في الاتصال بـ Google Drive: ${resp.status}`);
      }

      const data = await resp.json();
      const items: DriveFile[] = data.files || [];
      const folders = items.filter(f => isFolder(f.mimeType));
      const fileItems = items.filter(f => !isFolder(f.mimeType));
      setFiles([...folders, ...fileItems]);

      // Load metadata in parallel
      await loadMetadata(accessToken);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'حدث خطأ غير متوقع أثناء تحميل الملفات.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, online, loadMetadata]);

  // ── Auto-load on mount and when folder/token changes ──────────────
  useEffect(() => {
    if (accessToken) loadFiles(currentFolderId);
  }, [currentFolderId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate into folder ──────────────────────────────────────────
  const navigateInto = (folder: DriveFile) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSearch('');
    setSelectedIds(new Set());
    setSelectedFile(null);
  };

  const navigateToBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    setCurrentFolderId(crumb.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    setSearch('');
    setSelectedIds(new Set());
    setSelectedFile(null);
  };

  // ── Sort ──────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Merged files + metadata + filtered + sorted ───────────────────
  const displayed = useMemo(() => {
    let merged: DriveFileWithMeta[] = files.map(f => ({
      ...f,
      meta: metadataMap.get(f.id),
    }));

    if (search.trim()) {
      const q = search.toLowerCase();
      merged = merged.filter(f => {
        const base = f.name.toLowerCase().includes(q) || getFileTypeLabel(f.mimeType).toLowerCase().includes(q);
        if (f.meta) {
          return base ||
            f.meta.uploadedBy.toLowerCase().includes(q) ||
            f.meta.school.toLowerCase().includes(q) ||
            f.meta.category.toLowerCase().includes(q) ||
            f.meta.description.toLowerCase().includes(q);
        }
        return base;
      });
    }

    const folders = merged.filter(f => isFolder(f.mimeType));
    const fileItems = merged.filter(f => !isFolder(f.mimeType));

    const sortFn = (a: DriveFileWithMeta, b: DriveFileWithMeta) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'ar'); break;
        case 'mimeType': cmp = getFileTypeLabel(a.mimeType).localeCompare(getFileTypeLabel(b.mimeType), 'ar'); break;
        case 'size': cmp = (parseInt(a.size || '0', 10) || 0) - (parseInt(b.size || '0', 10) || 0); break;
        case 'modifiedTime': cmp = (a.modifiedTime || '').localeCompare(b.modifiedTime || ''); break;
        case 'category': cmp = (a.meta?.category || '').localeCompare(b.meta?.category || '', 'ar'); break;
        case 'uploadedBy': cmp = (a.meta?.uploadedBy || '').localeCompare(b.meta?.uploadedBy || '', 'ar'); break;
        case 'school': cmp = (a.meta?.school || '').localeCompare(b.meta?.school || '', 'ar'); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    };

    folders.sort(sortFn);
    fileItems.sort(sortFn);
    return [...folders, ...fileItems];
  }, [files, metadataMap, search, sortField, sortDir]);

  // ── Selection ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayed.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayed.map(f => f.id)));
  };

  // ── Download ──────────────────────────────────────────────────────
  const downloadFile = async (file: DriveFile) => {
    const url = `https://drive.google.com/uc?export=download&id=${file.id}`;
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDownload = async () => {
    const selected = displayed.filter(f => selectedIds.has(f.id) && !isFolder(f.mimeType));
    if (selected.length === 0) return;
    setDownloading(true);
    try {
      if (selected.length === 1) {
        setDownloadProgress(`جاري تحميل ${selected[0].name}...`);
        await downloadFile(selected[0]);
        setDownloadProgress('تم التحميل بنجاح!');
      } else {
        for (let i = 0; i < selected.length; i++) {
          setDownloadProgress(`جاري تحميل ${i + 1}/${selected.length}: ${selected[i].name}`);
          await downloadFile(selected[i]);
          await new Promise(r => setTimeout(r, 500));
        }
        setDownloadProgress(`تم تحميل ${selected.length} ملف بنجاح!`);
      }
    } catch {
      setDownloadProgress('حدث خطأ أثناء التحميل.');
    } finally {
      setTimeout(() => { setDownloading(false); setDownloadProgress(''); }, 2000);
    }
  };

  // ── Upload ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !accessToken) return;
    setUploading(true);
    setUploadProgress('جاري رفع الملف إلى Google Drive...');
    setError('');

    try {
      // 1) Upload file to Google Drive
      const metadata = {
        name: uploadFile.name,
        parents: [ROOT_FOLDER_ID],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', uploadFile);

      const resp = await fetch(
        `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,mimeType`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        }
      );

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `فشل الرفع: ${resp.status}`);
      }

      const driveData = await resp.json();
      setUploadProgress('جاري حفظ البيانات في سجل Google Drive...');

      // 2) Append metadata to Google Sheets
      const profile = loadProfile();
      const now = new Date().toLocaleDateString('ar-IQ', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });

      const meta: FileMetadata = {
        fileId: driveData.id,
        fileName: uploadFile.name,
        uploadedBy: profile.fullName || 'غير محدد',
        school: profile.schoolName || 'غير محدد',
        category: uploadCategory,
        description: uploadDescription,
        uploadDate: now,
        fileSize: formatSize(driveData.size || String(uploadFile.size)),
        mimeType: driveData.mimeType || uploadFile.type,
      };

      await appendMetadata(accessToken, meta);

      // 3) Refresh
      await loadFiles(currentFolderId);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadDescription('');
      setUploadProgress('');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الرفع.');
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete file + metadata ────────────────────────────────────────
  const handleDeleteFile = async (file: DriveFile) => {
    if (!accessToken) return;
    if (!confirm(`هل أنت متأكد من حذف "${file.name}"؟`)) return;

    setDeleting(file.id);
    try {
      // 1) Delete from Drive
      const resp = await fetch(`${DRIVE_API}/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok && resp.status !== 404) {
        throw new Error('فشل حذف الملف من Google Drive.');
      }

      // 2) Delete from Sheets
      try {
        await deleteMetadata(accessToken, file.id);
      } catch {
        // Non-fatal
      }

      // 3) Refresh
      setSelectedFile(null);
      await loadFiles(currentFolderId);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحذف.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Rename file + metadata ────────────────────────────────────────
  const startRename = (file: DriveFileWithMeta) => {
    setRenamingId(file.id);
    setRenameValue(file.name);
  };

  const confirmRename = async (file: DriveFileWithMeta) => {
    if (!accessToken || !renameValue.trim() || renameValue === file.name) {
      setRenamingId(null);
      return;
    }

    try {
      // 1) Rename in Drive
      const resp = await fetch(`${DRIVE_API}/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      if (!resp.ok) {
        throw new Error('فشل تغيير الاسم.');
      }

      // 2) Update in Sheets
      try {
        await updateMetadata(accessToken, file.id, { fileName: renameValue.trim() });
      } catch {
        // Non-fatal
      }

      setRenamingId(null);
      await loadFiles(currentFolderId);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تغيير الاسم.');
      setRenamingId(null);
    }
  };

  // ── Open file ─────────────────────────────────────────────────────
  const openFile = (file: DriveFile) => {
    if (isFolder(file.mimeType)) { navigateInto(file); return; }
    window.open(`https://drive.google.com/file/d/${file.id}/preview`, '_blank');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300 dark:text-slate-600 ml-1">↕</span>;
    return <span className="text-office-blue dark:text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Not connected — show minimal reconnect prompt ─────────────────
  if (!accessToken) {
    return (
      <div className="space-y-4 animate-fade-in" dir="rtl">
        <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
              <FolderOpen className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Google Drive</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">استعراض وتحميل ورفع الملفات المشتركة</p>
            </div>
          </div>
        </div>
        <div className="card bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1">غير متصل بـ Google Drive</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-md mx-auto leading-relaxed">
              {error || 'يرجى الاتصال بـ Google Drive لعرض ورفع الملفات المشتركة.'}
            </p>
          </div>
          <button onClick={handleConnect}
            className="bg-office-blue hover:bg-office-hover text-white px-6 py-3 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 mx-auto shadow-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span>اتصال بـ Google Drive</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Main render (connected) ───────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header — Upload + Refresh */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <FolderOpen className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Google Drive</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {userEmail || (metadataMap.size > 0
                ? `${metadataMap.size} ملف مسجل في السجل`
                : 'استعراض ورفع وتحميل الملفات المشتركة')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowUploadModal(true)}
            className="bg-office-blue hover:bg-office-hover text-white px-4 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>رفع ملف</span>
          </button>
          <button onClick={() => loadFiles(currentFolderId)}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button onClick={handleDisconnect}
            className="bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Network warning */}
      {!online && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">لا يوجد اتصال بالإنترنت.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex-1">{error}</span>
          <button onClick={() => setError('')} className="cursor-pointer"><X className="w-3.5 h-3.5 text-rose-400" /></button>
        </div>
      )}

      {/* Download progress */}
      {downloading && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{downloadProgress}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="card bg-white dark:bg-[#1e293b] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1 overflow-x-auto">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronLeft className="w-3 h-3 text-slate-300 dark:text-slate-600" />}
            <button onClick={() => navigateToBreadcrumb(i)}
              className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                i === breadcrumbs.length - 1
                  ? 'text-office-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
              {i === 0 && <Home className="w-3.5 h-3.5 inline ml-1" />}
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الفئة أو المدرس أو المدرسة..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue transition-colors" />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{selectedIds.size} محدد</span>
            <button onClick={handleDownload}
              className="bg-office-blue hover:bg-office-hover text-white px-4 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors">
              <Download className="w-3.5 h-3.5" /><span>تحميل</span>
            </button>
          </div>
        )}
        {displayed.length > 0 && (
          <button onClick={toggleSelectAll}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors">
            <span>{selectedIds.size === displayed.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex gap-4">
        <div className="card flex-1 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-13 gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black text-slate-500 dark:text-slate-400">
            <div className="col-span-1 flex items-center justify-center">
              <input type="checkbox" checked={selectedIds.size === displayed.length && displayed.length > 0}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
            </div>
            <button onClick={() => toggleSort('name')} className="col-span-3 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              اسم الملف <SortIcon field="name" />
            </button>
            <button onClick={() => toggleSort('uploadedBy')} className="col-span-2 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              الرافع <SortIcon field="uploadedBy" />
            </button>
            <button onClick={() => toggleSort('school')} className="col-span-2 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              المدرسة <SortIcon field="school" />
            </button>
            <button onClick={() => toggleSort('category')} className="col-span-2 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              الفئة <SortIcon field="category" />
            </button>
            <button onClick={() => toggleSort('size')} className="col-span-1 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              الحجم <SortIcon field="size" />
            </button>
            <button onClick={() => toggleSort('modifiedTime')} className="col-span-2 text-right flex items-center cursor-pointer hover:text-slate-700 transition-colors">
              التعديل <SortIcon field="modifiedTime" />
            </button>
          </div>

          {loading && (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-office-blue mx-auto mb-3 animate-spin" />
              <p className="text-[11px] font-bold text-slate-400">جاري تحميل الملفات...</p>
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <div className="p-12 text-center">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-[11px] font-bold text-slate-500">{search ? 'لا توجد نتائج مطابقة للبحث.' : 'المجلد فارغ.'}</p>
            </div>
          )}

          {!loading && displayed.map(file => {
            const Icon = getFileIcon(file.mimeType);
            const colorCls = getFileColor(file.mimeType);
            const bgCls = getFileBg(file.mimeType);
            const isCurrentSelected = selectedFile?.id === file.id;
            const isRenaming = renamingId === file.id;
            const isDeleting = deleting === file.id;
            return (
              <div key={file.id}
                className={`grid grid-cols-13 gap-1 px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 items-center transition-all cursor-pointer group ${
                  isCurrentSelected ? 'bg-blue-50 dark:bg-blue-950/20 border-r-2 border-r-office-blue' : 'hover:bg-slate-50 dark:hover:bg-slate-900/30'
                }`}
                onClick={() => !isRenaming && setSelectedFile(file)}
                onDoubleClick={() => !isRenaming && openFile(file)}>
                <div className="col-span-1 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(file.id)} onChange={() => toggleSelect(file.id)}
                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                </div>
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgCls}`}>
                    <Icon className={`w-4 h-4 ${colorCls}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRename(file); if (e.key === 'Escape') setRenamingId(null); }}
                          autoFocus
                          className="flex-1 bg-white dark:bg-slate-800 border border-office-blue rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 focus:outline-none" />
                        <button onClick={() => confirmRename(file)} className="text-emerald-500 hover:text-emerald-600 cursor-pointer p-0.5">
                          <span className="text-[10px] font-bold">✓</span>
                        </button>
                        <button onClick={() => setRenamingId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5">
                          <span className="text-[10px] font-bold">✕</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-office-blue transition-colors" title={file.name}>{file.name}</p>
                        {isFolder(file.mimeType) && <p className="text-[9px] text-slate-400">انقر للدخول</p>}
                      </>
                    )}
                  </div>
                </div>
                <div className="col-span-2 truncate">
                  {file.meta?.uploadedBy ? (
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400" title={file.meta.uploadedBy}>{file.meta.uploadedBy}</span>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>
                <div className="col-span-2 truncate">
                  {file.meta?.school ? (
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400" title={file.meta.school}>{file.meta.school}</span>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>
                <div className="col-span-2 truncate">
                  {file.meta?.category ? (
                    <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md">{file.meta.category}</span>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>
                <div className="col-span-1">
                  <span className="text-[10px] font-bold text-slate-500">{isFolder(file.mimeType) ? '—' : formatSize(file.size)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400">{formatDate(file.modifiedTime)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Details panel */}
        {selectedFile && (
          <div className="card w-72 shrink-0 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-500" /> تفاصيل الملف
              </h4>
              <button onClick={() => setSelectedFile(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center py-3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 ${getFileBg(selectedFile.mimeType)}`}>
                  {(() => { const Ic = getFileIcon(selectedFile.mimeType); return <Ic className={`w-7 h-7 ${getFileColor(selectedFile.mimeType)}`} />; })()}
                </div>
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 break-all">{selectedFile.name}</p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Tag, label: 'النوع', value: getFileTypeLabel(selectedFile.mimeType) },
                  { icon: HardDrive, label: 'الحجم', value: isFolder(selectedFile.mimeType) ? 'مجلد' : formatSize(selectedFile.size) },
                  { icon: Calendar, label: 'آخر تعديل', value: formatDate(selectedFile.modifiedTime) },
                  ...(selectedFile.meta ? [
                    { icon: User, label: 'الرافع', value: selectedFile.meta.uploadedBy },
                    { icon: Building2, label: 'المدرسة', value: selectedFile.meta.school },
                    { icon: Tag, label: 'الفئة', value: selectedFile.meta.category },
                    { icon: Calendar, label: 'تاريخ الرفع', value: selectedFile.meta.uploadDate },
                    { icon: File, label: 'المعرّف', value: selectedFile.id },
                    ...(selectedFile.meta.description ? [{ icon: FileText, label: 'الوصف', value: selectedFile.meta.description }] : []),
                  ] : [
                    { icon: File, label: 'المعرّف', value: selectedFile.id },
                  ]),
                ].map(item => (
                  <div key={item.label}>
                    <span className="text-[9px] font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                      <item.icon className="w-3 h-3" />{item.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 break-all">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 pt-2">
                {isFolder(selectedFile.mimeType) ? (
                  <button onClick={() => navigateInto(selectedFile)}
                    className="w-full bg-office-blue hover:bg-office-hover text-white px-4 py-2.5 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-colors">
                    <FolderOpen className="w-3.5 h-3.5" /><span>فتح المجلد</span>
                  </button>
                ) : (
                  <>
                    <button onClick={() => openFile(selectedFile)}
                      className="w-full bg-office-blue hover:bg-office-hover text-white px-4 py-2.5 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-colors">
                      <Eye className="w-3.5 h-3.5" /><span>فتح الملف</span>
                    </button>
                    <button onClick={() => downloadFile(selectedFile)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-colors">
                      <Download className="w-3.5 h-3.5" /><span>تحميل</span>
                    </button>
                    {!isFolder(selectedFile.mimeType) && (
                      <>
                        <button onClick={() => startRename(selectedFile)}
                          className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors">
                          <File className="w-3.5 h-3.5" /><span>إعادة تسمية</span>
                        </button>
                        <button onClick={() => handleDeleteFile(selectedFile)}
                          disabled={deleting === selectedFile.id}
                          className="w-full bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 px-4 py-2.5 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                          {deleting === selectedFile.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>حذف</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[10px] text-slate-400">
          {displayed.length} عنصر{search ? ` (من أصل ${files.length})` : ''}
          {metadataMap.size > 0 && ` • ${metadataMap.size} سجل بيانات`}
        </p>
      </div>

      {/* ── Upload Modal ─────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => { if (!uploading) setShowUploadModal(false); }}>
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-office-blue" /> رفع ملف إلى Google Drive
              </h3>
              <button onClick={() => !uploading && setShowUploadModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* File picker */}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1.5">الملف</label>
                <input ref={fileInputRef} type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:border-office-blue transition-colors cursor-pointer">
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      {(() => { const Ic = getFileIcon(uploadFile.type); return <Ic className="w-5 h-5 text-office-blue" />; })()}
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">{uploadFile.name}</span>
                      <span className="text-[10px] text-slate-400">({formatSize(String(uploadFile.size))})</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-[11px] font-bold text-slate-500">انقر لاختيار ملف</p>
                    </div>
                  )}
                </button>
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1.5">الفئة</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue transition-colors cursor-pointer">
                  {UPLOAD_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1.5">الوصف <span className="text-slate-300">(اختياري)</span></label>
                <textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)}
                  placeholder="أضف وصفاً للملف..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-office-blue transition-colors resize-none" />
              </div>

              {/* Upload progress */}
              {uploading && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{uploadProgress}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button onClick={() => !uploading && setShowUploadModal(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 text-[11px] font-bold rounded-xl cursor-pointer transition-colors">
                إلغاء
              </button>
              <button onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="bg-office-blue hover:bg-office-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploading ? 'جاري الرفع...' : 'رفع'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
