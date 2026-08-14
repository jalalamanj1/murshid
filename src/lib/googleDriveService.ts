/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Drive Service
 * Handles: OAuth2 implicit flow, token refresh, folder creation,
 * file upload, file listing, file download, account info.
 *
 * Uses Google's OAuth 2.0 for client-side apps (implicit grant).
 * The client ID must be created in Google Cloud Console for a
 * "Web application" with the correct redirect origin.
 */

import { GoogleDriveAccount, GoogleDriveTokens } from '../types';

// ── Configuration ────────────────────────────────────────────────────
// Replace with your own Google Cloud Console OAuth2 credentials.
// Create at: https://console.cloud.google.com/apis/credentials
// Enable "Google Drive API" in the project first.
const CLIENT_ID = '580475588026-196m9aepjuhh325nkaffdchrlqnqb5ul.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const MURSHID_FOLDER_NAME = 'Murshid Backups';
const STORAGE_KEY = 'murshid_google_drive';

// ── Persistence ──────────────────────────────────────────────────────

function loadAccount(): GoogleDriveAccount {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { connected: false };
  try {
    return JSON.parse(raw);
  } catch {
    return { connected: false };
  }
}

function saveAccount(account: GoogleDriveAccount): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export function getGoogleDriveAccount(): GoogleDriveAccount {
  return loadAccount();
}

// ── OAuth2 Flow ──────────────────────────────────────────────────────
// Uses IPC-based localhost loopback when running in Electron (file://),
// falling back to redirect-based flow for browser/dev environments.

let _ipcAuthInProgress = false;

/**
 * Initiate OAuth2 authentication.
 * In Electron: calls main process local server handler.
 * In browser: returns the auth URL for redirect-based flow.
 */
export async function initiateAuth(): Promise<GoogleDriveTokens | null> {
  const electron = (window as any).electronAPI;

  // In Electron with file:// origin, use IPC localhost loopback
  if (electron && electron.driveAuth && window.location.origin === 'file://') {
    if (_ipcAuthInProgress) return null;
    _ipcAuthInProgress = true;
    try {
      const res = await electron.driveAuth();
      if (res.ok && res.tokens) {
        const { access_token, refresh_token, expires_in } = res.tokens;
        return {
          access_token,
          refresh_token,
          token_type: 'Bearer',
          expires_in,
          expiry_date: Date.now() + expires_in * 1000,
          scope: SCOPES,
        };
      }
      throw new Error(res.error || 'فشل تسجيل الدخول إلى Google.');
    } finally {
      _ipcAuthInProgress = false;
    }
  }

  // Fallback: redirect-based flow (browser / dev server)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    prompt: 'consent',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return null; // Page will navigate away
}

/**
 * Handle the OAuth redirect on page load (redirect-based flow).
 * Reads tokens from the URL hash fragment.
 */
export function handleOAuthRedirect(): GoogleDriveTokens | null {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  const tokenType = params.get('token_type') || 'Bearer';
  const scope = params.get('scope') || '';
  const refreshToken = params.get('refresh_token') || undefined;

  if (!accessToken) return null;

  const tokens: GoogleDriveTokens = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_in: expiresIn,
    expiry_date: Date.now() + expiresIn * 1000,
    scope,
  };

  // Clear the hash from URL
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

  return tokens;
}

async function refreshAccessToken(account: GoogleDriveAccount): Promise<GoogleDriveAccount> {
  if (!account.tokens?.refresh_token) {
    throw new Error('انتهت صلاحية التوكن. الرجاء إعادة الربط.');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: account.tokens.refresh_token,
    grant_type: 'refresh_token',
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`فشل تجديد التوكن: ${err}`);
  }

  const data = await resp.json();
  account.tokens = {
    ...account.tokens,
    access_token: data.access_token,
    expires_in: data.expires_in,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
  saveAccount(account);
  return account;
}

async function getValidAccessToken(account: GoogleDriveAccount): Promise<string> {
  if (!account.tokens) throw new Error('لم يتم الربط بعد.');
  if (Date.now() < account.tokens.expiry_date - 60000) {
    return account.tokens.access_token;
  }
  // Try refresh
  const refreshed = await refreshAccessToken(account);
  return refreshed.tokens!.access_token;
}

// ── API Helpers ──────────────────────────────────────────────────────

async function driveRequest(
  account: GoogleDriveAccount,
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getValidAccessToken(account);
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (resp.status === 401) {
    // Token expired, try refresh once
    const refreshed = await refreshAccessToken(account);
    const newToken = refreshed.tokens!.access_token;
    const resp2 = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        ...options.headers as Record<string, string>,
      },
    });
    if (!resp2.ok) throw new Error(`خطأ في Google Drive: ${resp2.status}`);
    return resp2.json();
  }

  if (resp.status === 403) {
    throw new Error('ليس لديك صلاحية كافية. تحقق من مساحة التخزين المتاحة.');
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`خطأ في Google Drive: ${resp.status} - ${errText}`);
  }

  // For 204 No Content (delete)
  if (resp.status === 204) return null;
  return resp.json();
}

// ── Connect / Disconnect ─────────────────────────────────────────────

export async function connectAccount(tokens: GoogleDriveTokens): Promise<GoogleDriveAccount> {
  const resp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let email = 'مستخدم Google';
  if (resp.ok) {
    const info = await resp.json();
    email = info.email || email;
  }

  const account: GoogleDriveAccount = {
    connected: true,
    email,
    tokens,
    folderId: undefined,
  };

  // Ensure Murshid Backups folder exists
  account.folderId = await ensureMurshidFolder(account);
  saveAccount(account);
  return account;
}

export function disconnectAccount(): void {
  const account = loadAccount();
  if (account.tokens?.access_token) {
    // Revoke token (best effort)
    fetch(`https://oauth2.googleapis.com/revoke?token=${account.tokens.access_token}`, {
      method: 'POST',
    }).catch(() => {});
  }
  localStorage.removeItem(STORAGE_KEY);
}

// ── Folder Management ────────────────────────────────────────────────

async function ensureMurshidFolder(account: GoogleDriveAccount): Promise<string> {
  // Search for existing folder
  const q = `name='${MURSHID_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const result = await driveRequest(account, `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);

  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }

  // Create folder
  const metadata = {
    name: MURSHID_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const created = await driveRequest(account, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });

  return created.id;
}

// ── Upload Backup ────────────────────────────────────────────────────

export async function uploadBackup(
  account: GoogleDriveAccount,
  blob: Blob,
  fileName: string,
  onProgress?: (msg: string) => void
): Promise<{ id: string; name: string }> {
  if (!account.folderId) {
    account.folderId = await ensureMurshidFolder(account);
    saveAccount(account);
  }

  onProgress?.('جاري رفع الملف إلى Google Drive...');

  const metadata = {
    name: fileName,
    parents: [account.folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const token = await getValidAccessToken(account);

  const resp = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`فشل الرفع: ${resp.status} - ${errText}`);
  }

  const data = await resp.json();
  onProgress?.('تم الرفع بنجاح!');
  return { id: data.id, name: data.name };
}

// ── List Backups ─────────────────────────────────────────────────────

export interface CloudBackupFile {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

export async function listBackups(account: GoogleDriveAccount): Promise<CloudBackupFile[]> {
  if (!account.folderId) return [];

  const q = `'${account.folderId}' in parents and trashed=false and name contains 'Murshid_Backup_'`;
  const result = await driveRequest(
    account,
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`
  );

  if (!result.files) return [];

  return result.files.map((f: any) => ({
    id: f.id,
    name: f.name,
    size: formatSize(parseInt(f.size || '0', 10)),
    createdTime: f.createdTime,
  }));
}

// ── Download Backup ──────────────────────────────────────────────────

export async function downloadBackup(
  account: GoogleDriveAccount,
  fileId: string,
  onProgress?: (msg: string) => void
): Promise<ArrayBuffer> {
  onProgress?.('جاري تحميل النسخة الاحتياطية من Google Drive...');
  const token = await getValidAccessToken(account);

  const resp = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) throw new Error(`فشل التحميل: ${resp.status}`);

  const blob = await resp.blob();
  return blob.arrayBuffer();
}

// ── Delete Backup ────────────────────────────────────────────────────

export async function deleteBackup(
  account: GoogleDriveAccount,
  fileId: string
): Promise<void> {
  await driveRequest(account, `${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
  });
}

// ── Storage Usage ────────────────────────────────────────────────────

export async function getStorageUsage(
  account: GoogleDriveAccount
): Promise<{ used: string; total: string } | null> {
  try {
    const result = await driveRequest(
      account,
      `${DRIVE_API}/about?fields=storageQuota(usage,limit)`
    );
    const quota = result.storageQuota;
    return {
      used: formatSize(parseInt(quota.usage || '0', 10)),
      total: quota.limit === '-1' ? 'غير محدود' : formatSize(parseInt(quota.limit || '0', 10)),
    };
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
