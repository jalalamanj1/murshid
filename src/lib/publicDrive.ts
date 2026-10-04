/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public Google Drive folder client for the Murshid folder tabs.
 *
 * The مخاطبات التربية and ملفات folders are PUBLIC folders owned by the
 * app owner. Their contents are displayed WITHOUT any user Google login,
 * using Google's public "embedded folder view" page and public download
 * URLs. No OAuth, no backend, and no access to the user's own Drive.
 * This is completely separate from Google Login / Online Backup.
 */

export const DRIVE_FOLDERS: Record<'letters' | 'files', string> = {
  letters: '1U5Fows578m6t9WJNe0HNWYG2m0D6HiDO',
  files: '1pNFVBUHEr0pRlo2w2b_r-JIGHdFJYo8I',
};

export interface PublicDriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnail: string;
  modified: string;
  isFolder: boolean;
  isImage: boolean;
  isPdf: boolean;
  isText: boolean;
  isGoogleNative: boolean;
}

function normalize(file: any): PublicDriveFile {
  const mime: string = file.mimeType || '';
  const isFolder = mime === 'application/vnd.google-apps.folder';
  return {
    id: file.id,
    name: file.name || '',
    mimeType: mime,
    thumbnail: file.thumbnail || '',
    modified: file.modified || '',
    isFolder,
    isImage: !isFolder && mime.startsWith('image/'),
    isPdf: mime === 'application/pdf',
    isText: mime.startsWith('text/') || mime === 'application/json',
    isGoogleNative: mime.startsWith('application/vnd.google-apps.'),
  };
}

// ── List public folder contents (no auth) ────────────────────────────

export async function listPublicFolder(folderId: string): Promise<PublicDriveFile[]> {
  const electron = (window as any).electronAPI;
  if (!electron?.drivePublic?.list) {
    throw new Error('بيئة سطح المكتب غير متوفرة.');
  }
  const res = await electron.drivePublic.list(folderId);
  if (!res.ok) throw new Error(res.error || 'فشل تحميل الملفات.');
  return (res.files || []).map(normalize);
}

// ── Public URLs (no auth needed) ─────────────────────────────────────

/**
 * Reliable direct-image URL for a public Drive file.
 *
 * Google's `uc?id=...&export=view` endpoint does NOT work as an <img src>
 * inside Electron — it redirects to drive.usercontent.google.com, which
 * serves an HTML page (virus-scan confirmation / cookie-gated) instead of
 * raw image bytes, so the image renders broken. The `thumbnail?id=` endpoint
 * redirects to a real image host (lh3.googleusercontent.com) and returns the
 * actual image content with a proper image MIME type; it works without any
 * login or cookies and supports PNG/JPG/GIF/WebP (SVG is rasterized safely).
 */
export function publicThumbnailUrl(file: PublicDriveFile, size = 1600): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w${size}`;
}

/**
 * Preview URL for a file:
 *  - images -> direct thumbnail image URL (reliable inside Electron)
 *  - everything else -> Google's embeddable file preview page
 */
export function publicPreviewUrl(file: PublicDriveFile): string {
  if (file.isImage) {
    return publicThumbnailUrl(file, 2048);
  }
  return `https://drive.google.com/file/d/${file.id}/preview`;
}

/**
 * Whether a file has a usable in-app preview (images render directly;
 * PDFs, text files and Google-native docs open in Google's preview page).
 * Other types (docx, xlsx, zip, etc.) show a fallback instead of a broken
 * preview page.
 */
export function isPreviewable(file: PublicDriveFile): boolean {
  return file.isImage || file.isPdf || file.isText || file.isGoogleNative;
}

export function publicShareUrl(file: PublicDriveFile): string {
  return `https://drive.google.com/file/d/${file.id}/view`;
}

export function publicDownloadUrl(file: PublicDriveFile): string {
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
}

// ── Download via the main process (writes to the save folder) ────────

export async function downloadPublicFile(file: PublicDriveFile, folderPath: string): Promise<{ filePath?: string; viaBrowser: boolean }> {
  const electron = (window as any).electronAPI;
  if (!electron?.drivePublic?.download) {
    throw new Error('بيئة سطح المكتب غير متوفرة.');
  }
  const res = await electron.drivePublic.download(file.id, file.name, folderPath);
  if (res?.needsBrowser) {
    return { viaBrowser: true };
  }
  if (!res?.ok) throw new Error(res?.error || 'فشل تنزيل الملف.');
  return { filePath: res.filePath, viaBrowser: false };
}

// ── Upload / delete for the shared files folder ──────────────────────
//
// Uploading is anonymous: no Google login, no OAuth, no token. The Drive REST
// API has no anonymous write, so the file is POSTed from the Electron main
// process to a Google Apps Script web app that runs with the folder owner's
// authority (see google-apps-script/drive-upload/). The uploader's name is
// required and the endpoint records it in the resulting file name, which is
// the only field a login-free folder listing can display.
//
// Deleting your own recent uploads still needs a Drive token (drive.file
// scope), so that path stays authenticated and is only reachable when an
// account was linked by an earlier version of the app.

const GDRIVE_STORAGE = 'murshid_google_drive';
const CLIENT_ID = '580475588026-196m9aepjuhh325nkaffdchrlqnqb5ul.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface OwnUpload {
  id: string;
  name: string;
  uploaderName: string;
  uploadedAt: string;
  description: string;
}

function readTokens(): any | null {
  const raw = localStorage.getItem(GDRIVE_STORAGE);
  if (!raw) return null;
  try {
    const acc = JSON.parse(raw);
    if (!acc?.tokens?.access_token) return null;
    return acc.tokens;
  } catch {
    return null;
  }
}

function writeTokens(tokens: any): void {
  const raw = localStorage.getItem(GDRIVE_STORAGE);
  let acc: any = {};
  if (raw) {
    try { acc = JSON.parse(raw); } catch { acc = {}; }
  }
  acc.tokens = tokens;
  localStorage.setItem(GDRIVE_STORAGE, JSON.stringify(acc));
}

async function refreshTokens(tokens: any): Promise<string> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  });
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error('انتهت صلاحية الجلسة، يرجى إعادة الاتصال.');
  const data = await resp.json();
  const next = { ...tokens, access_token: data.access_token, expires_in: data.expires_in || 3600 };
  writeTokens(next);
  return next.access_token;
}

export async function getDriveAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  const expiry = tokens.expiry_date || (Date.now() + (tokens.expires_in || 3600) * 1000);
  if (Date.now() < expiry - 60000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  try {
    return await refreshTokens(tokens);
  } catch {
    return null;
  }
}

/**
 * Whether the anonymous upload service is deployed and reachable.
 * `maxBytes` comes from the service so the UI cap follows the server.
 */
export interface UploadServiceStatus {
  configured: boolean;
  maxBytes?: number;
  error?: string;
}

export async function getUploadServiceStatus(): Promise<UploadServiceStatus> {
  const electron = (window as any).electronAPI;
  if (!electron?.drivePublic?.uploadConfig) {
    return { configured: false, error: 'بيئة سطح المكتب غير متوفرة.' };
  }
  const res = await electron.drivePublic.uploadConfig();
  return {
    configured: !!res?.ok,
    maxBytes: res?.maxBytes,
    error: res?.error,
  };
}

/** Read a File into base64 without blowing the call stack on large files. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a file into the shared files folder with no Google login.
 * Title and uploader name are both required. The endpoint renames the file to
 * "YYYY-MM-DD - uploader - title.ext" so the uploader is visible to everyone
 * browsing the folder without a Drive account.
 */
export async function uploadSharedFile(
  file: File,
  title: string,
  description: string,
  uploaderName: string
): Promise<{ id?: string; name?: string }> {
  const electron = (window as any).electronAPI;
  if (!electron?.drivePublic?.upload) {
    throw new Error('بيئة سطح المكتب غير متوفرة.');
  }
  const name = uploaderName.trim();
  if (!name) throw new Error('يرجى إدخال اسم الرافع.');
  if (!title.trim()) throw new Error('يرجى إدخال عنوان الملف.');

  const dataBase64 = await readFileAsBase64(file);
  const res = await electron.drivePublic.upload({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataBase64,
    uploaderName: name,
    title: title.trim(),
    description: description.trim(),
  });

  if (!res?.ok) {
    throw new Error(res?.error || 'فشل رفع الملف.');
  }
  return { id: res.id, name: res.name };
}

/**
 * List the files the currently logged-in account uploaded via this app
 * into the given folder (read via the drive.file-scoped token). Returns
 * an empty list when not logged in — listing stays public / login-free.
 */
export async function listOwnUploads(folderId: string): Promise<OwnUpload[]> {
  const token = await getDriveAccessToken();
  if (!token) return [];
  const q = `'${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,appProperties,createdTime,modifiedTime)&pageSize=1000&supportsAllDrives=true`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return [];
  const data = await resp.json();
  const out: OwnUpload[] = [];
  for (const f of data.files || []) {
    const props = f.appProperties || {};
    if (!props.murshidUploadedAt && !props.murshidUploaderName) continue;
    out.push({
      id: f.id,
      name: f.name || '',
      uploaderName: props.murshidUploaderName || '',
      uploadedAt: props.murshidUploadedAt || f.createdTime || '',
      description: props.murshidDescription || '',
    });
  }
  return out;
}

/**
 * Delete a file. Only succeeds for files created by this app for the
 * logged-in account (drive.file scope) — the owner's files can never be
 * deleted through this app.
 */
export async function deleteSharedFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('يرجى تسجيل الدخول إلى Google أولاً.');
  const resp = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 404) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `فشل الحذف (${resp.status}).`);
  }
}

/** Time elapsed since a date, as a short Arabic label. */
export function timeAgo(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'الآن';
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} دقيقة`;
  if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} ساعة`;
  return `قبل ${Math.floor(diff / 86_400_000)} يوم`;
}
