/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backup Service
 * Handles: ZIP creation, AES-256-GCM encryption, local backup download,
 * restore from backup, backup settings persistence.
 */

import JSZip from 'jszip';
import {
  BackupSettings,
  BackupHistoryEntry,
  Student,
  CounselingRecord,
  WordTemplate,
  GeneratedDocument,
  StudentAttachment,
  CounselorProfile,
  AppSettings,
} from '../types';

// ── Storage Keys ─────────────────────────────────────────────────────
const BACKUP_SETTINGS_KEY = 'murshid_backup_settings';
const GOOGLE_DRIVE_KEY = 'murshid_google_drive';

// ── All localStorage keys we back up ────────────────────────────────
const DATA_KEYS = {
  profile: 'murshid_profile',
  students: 'murshid_students',
  records: 'murshid_records',
  settings: 'murshid_settings',
  templates: 'murshid_templates',
  documents: 'murshid_documents',
  attachments: 'murshid_attachments',
  customFiles: 'murshid_custom_files',
  backupSettings: 'murshid_backup_settings',
  googleDrive: 'murshid_google_drive',
};

// ── Default backup settings ─────────────────────────────────────────
const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  localFolder: '',
  maxLocalBackups: 10,
  deleteOldBackups: true,
  compressBackups: true,
  includeAttachments: true,
  includeTemplates: true,
  includeSettings: true,
  autoBackupDaily: true,
  autoBackupWeekly: false,
  autoBackupMonthly: false,
  autoCloudBackup: true,
  encryptionEnabled: false,
  backupPassword: '',
  backupHistory: [],
};

// ── Helpers ──────────────────────────────────────────────────────────

function generateId(): string {
  return 'bkp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return String(bytes) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function getBackupFolderName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Murshid_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

// ── Backup Settings Persistence ─────────────────────────────────────

export function loadBackupSettings(): BackupSettings {
  const raw = localStorage.getItem(BACKUP_SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_BACKUP_SETTINGS };
  try {
    return { ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
}

export function saveBackupSettings(settings: BackupSettings): void {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
}

// ── AES-256-GCM Encryption (Web Crypto API) ─────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  // Prepend salt + iv to ciphertext
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  return result.buffer;
}

export async function decryptData(data: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  const arr = new Uint8Array(data);
  const salt = arr.slice(0, 16);
  const iv = arr.slice(16, 28);
  const ciphertext = arr.slice(28);
  const key = await deriveKey(password, salt);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

// ── Collect Backup Data ──────────────────────────────────────────────

function collectLocalStorageData(settings: BackupSettings): Record<string, string> {
  const data: Record<string, string> = {};

  // Always included
  data['database/students.json'] = localStorage.getItem(DATA_KEYS.students) || '[]';
  data['database/records.json'] = localStorage.getItem(DATA_KEYS.records) || '[]';
  data['database/profile.json'] = localStorage.getItem(DATA_KEYS.profile) || '{}';

  if (settings.includeSettings) {
    data['settings/app_settings.json'] = localStorage.getItem(DATA_KEYS.settings) || '{}';
    data['settings/backup_settings.json'] = localStorage.getItem(BACKUP_SETTINGS_KEY) || '{}';
  }

  if (settings.includeTemplates) {
    data['templates/word_templates.json'] = localStorage.getItem(DATA_KEYS.templates) || '[]';
    data['templates/generated_documents.json'] = localStorage.getItem(DATA_KEYS.documents) || '[]';
  }

  if (settings.includeAttachments) {
    data['attachments/student_attachments.json'] = localStorage.getItem(DATA_KEYS.attachments) || '[]';
  }

  data['metadata/custom_files.json'] = localStorage.getItem(DATA_KEYS.customFiles) || '[]';
  data['metadata/google_drive.json'] = localStorage.getItem(GOOGLE_DRIVE_KEY) || '{}';

  return data;
}

// ── Build ZIP from collected data ────────────────────────────────────

async function buildBackupZip(settings: BackupSettings): Promise<{ zip: JSZip; folderName: string }> {
  const zip = new JSZip();
  const folderName = getBackupFolderName();
  const folder = zip.folder(folderName);
  if (!folder) throw new Error('Failed to create backup folder in ZIP');

  const data = collectLocalStorageData(settings);

  for (const [path, content] of Object.entries(data)) {
    folder.file(path, content);
  }

  // Add manifest
  const manifest = {
    version: '2.1.0',
    createdAt: new Date().toISOString(),
    application: 'Murshid',
    contents: Object.keys(data),
  };
  folder.file('manifest.json', JSON.stringify(manifest, null, 2));

  return { zip, folderName };
}

// ── Calculate ZIP size (approximate) ─────────────────────────────────

export async function estimateBackupSize(settings: BackupSettings): Promise<string> {
  const { zip } = await buildBackupZip(settings);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return formatFileSize(blob.size);
}

// ── Local Backup ─────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result ? result.split(',')[1] || '' : '');
    };
    reader.onerror = () => reject(new Error('فشل قراءة ملف النسخة الاحتياطية.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a local backup and save it directly into `folderPath`.
 * The ZIP is built and encrypted in the renderer, then handed to the
 * main process (backup:write-local) which creates the folder if needed
 * and writes the file. Falls back to a browser download outside Electron.
 */
export async function createLocalBackup(
  settings: BackupSettings,
  folderPath: string,
  onProgress?: (msg: string) => void
): Promise<BackupHistoryEntry> {
  const entry: BackupHistoryEntry = {
    id: generateId(),
    date: new Date().toISOString(),
    type: 'LOCAL',
    size: '',
    status: 'IN_PROGRESS',
    fileName: '',
  };

  try {
    onProgress?.('جاري تجميع البيانات...');
    const { blob, fileName } = await createBackupBlob(settings);
    entry.fileName = fileName;
    entry.size = formatFileSize(blob.size);

    const electron = (window as any).electronAPI;
    if (electron?.saveLocalBackup && folderPath?.trim()) {
      onProgress?.('جاري الحفظ في المجلد...');
      const base64 = await blobToBase64(blob);
      const res = await electron.saveLocalBackup(folderPath.trim(), fileName, base64);
      if (!res?.ok) throw new Error(res?.error || 'فشل حفظ النسخة الاحتياطية في المجلد.');
      entry.status = 'SUCCESS';
      onProgress?.('تم بنجاح! تم حفظ النسخة الاحتياطية.');
    } else {
      // Fallback (browser / dev): trigger a download instead
      onProgress?.('جاري بدء التنزيل...');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      entry.status = 'SUCCESS';
      onProgress?.('تم بنجاح! تم تنزيل النسخة الاحتياطية.');
    }

    // Update settings
    settings.lastLocalBackup = new Date().toISOString();
    settings.backupHistory = [entry, ...settings.backupHistory].slice(0, 50);
    saveBackupSettings(settings);

    return entry;
  } catch (err: any) {
    entry.status = 'FAILED';
    entry.errorMessage = err?.message || 'خطأ غير معروف';
    settings.backupHistory = [entry, ...settings.backupHistory].slice(0, 50);
    saveBackupSettings(settings);
    onProgress?.('فشلت العملية: ' + entry.errorMessage);
    throw err;
  }
}

// ── Create backup as raw Blob (for Google Drive upload) ──────────────

export async function createBackupBlob(settings: BackupSettings): Promise<{ blob: Blob; fileName: string }> {
  const { zip, folderName } = await buildBackupZip(settings);
  const fileName = `${folderName}.zip`;

  let zipBlob: Blob;
  if (settings.compressBackups) {
    zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  } else {
    zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  }

  if (settings.encryptionEnabled && settings.backupPassword) {
    const arrayBuf = await zipBlob.arrayBuffer();
    const encrypted = await encryptData(arrayBuf, settings.backupPassword);
    return { blob: new Blob([encrypted], { type: 'application/octet-stream' }), fileName: `${folderName}_encrypted.zip` };
  }

  return { blob: zipBlob, fileName };
}

// ── Restore from File ────────────────────────────────────────────────

export async function restoreFromFile(
  file: File,
  password?: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.('جاري قراءة الملف...');
  let arrayBuf = await file.arrayBuffer();

  // Check if encrypted (our encrypted files start with 16-byte salt)
  const isEncrypted = file.name.includes('_encrypted');

  if (isEncrypted) {
    if (!password) {
      throw new Error('هذا الملف مشفر. الرجاء إدخال كلمة المرور لفك التشفير.');
    }
    onProgress?.('جاري فك تشفير الملف...');
    try {
      arrayBuf = await decryptData(arrayBuf, password);
    } catch {
      throw new Error('كلمة المرور غير صحيحة أو الملف تالف.');
    }
  }

  onProgress?.('جاري فتح أرشيف ZIP...');
  const zip = await JSZip.loadAsync(arrayBuf);

  // Find backup folder
  const folderNames = new Set<string>();
  zip.forEach((relativePath) => {
    const parts = relativePath.split('/');
    if (parts.length > 1 && parts[0]) folderNames.add(parts[0]);
  });
  const folders = Array.from(folderNames);
  const backupFolder = folders.find(f => f.startsWith('Murshid_Backup_')) || folders[0];
  if (!backupFolder) {
    throw new Error('الملف ليس نسخة احتياطية صالحة لبرنامج مرشد.');
  }

  const folder = zip.folder(backupFolder);
  if (!folder) throw new Error('هيكل ملف النسخة الاحتياطية غير صحيح.');

  // Validate manifest
  const manifestFile = folder.file('manifest.json');
  if (manifestFile) {
    const manifest = JSON.parse(await manifestFile.async('text'));
    if (manifest.application !== 'Murshid') {
      throw new Error('هذه النسخة الاحتياطية ليست من برنامج مرشد.');
    }
  }

  onProgress?.('جاري استعادة البيانات...');

  // Restore each file to localStorage
  const restoreKeys: [string, string][] = [
    ['database/students.json', DATA_KEYS.students],
    ['database/records.json', DATA_KEYS.records],
    ['database/profile.json', DATA_KEYS.profile],
    ['settings/app_settings.json', DATA_KEYS.settings],
    ['settings/backup_settings.json', BACKUP_SETTINGS_KEY],
    ['templates/word_templates.json', DATA_KEYS.templates],
    ['templates/generated_documents.json', DATA_KEYS.documents],
    ['attachments/student_attachments.json', DATA_KEYS.attachments],
    ['metadata/custom_files.json', DATA_KEYS.customFiles],
    ['metadata/google_drive.json', GOOGLE_DRIVE_KEY],
  ];

  for (const [zipPath, storageKey] of restoreKeys) {
    const f = folder.file(zipPath);
    if (f) {
      const content = await f.async('text');
      localStorage.setItem(storageKey, content);
    }
  }

  onProgress?.('تمت الاستعادة بنجاح! سيتم إعادة تشغيل التطبيق...');

  // Brief delay then reload
  await new Promise(resolve => setTimeout(resolve, 1500));
  window.location.reload();
}

// ── Restore from Google Drive (raw ArrayBuffer) ──────────────────────

export async function restoreFromBuffer(
  arrayBuf: ArrayBuffer,
  fileName: string,
  password?: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  const isEncrypted = fileName.includes('_encrypted');

  if (isEncrypted) {
    if (!password) {
      throw new Error('هذا الملف مشفر. الرجاء إدخال كلمة المرور لفك التشفير.');
    }
    onProgress?.('جاري فك تشفير الملف...');
    try {
      arrayBuf = await decryptData(arrayBuf, password);
    } catch {
      throw new Error('كلمة المرور غير صحيحة أو الملف تالف.');
    }
  }

  onProgress?.('جاري فتح أرشيف ZIP...');
  const zip = await JSZip.loadAsync(arrayBuf);

  const folderNames2 = new Set<string>();
  zip.forEach((relativePath) => {
    const parts = relativePath.split('/');
    if (parts.length > 1 && parts[0]) folderNames2.add(parts[0]);
  });
  const folders = Array.from(folderNames2);
  const backupFolder = folders.find(f => f.startsWith('Murshid_Backup_')) || folders[0];
  if (!backupFolder) throw new Error('الملف ليس نسخة احتياطية صالحة لبرنامج مرشد.');

  const folder = zip.folder(backupFolder);
  if (!folder) throw new Error('هيكل ملف النسخة الاحتياطية غير صحيح.');

  const manifestFile = folder.file('manifest.json');
  if (manifestFile) {
    const manifest = JSON.parse(await manifestFile.async('text'));
    if (manifest.application !== 'Murshid') {
      throw new Error('هذه النسخة الاحتياطية ليست من برنامج مرشد.');
    }
  }

  onProgress?.('جاري استعادة البيانات...');

  const restoreKeys: [string, string][] = [
    ['database/students.json', DATA_KEYS.students],
    ['database/records.json', DATA_KEYS.records],
    ['database/profile.json', DATA_KEYS.profile],
    ['settings/app_settings.json', DATA_KEYS.settings],
    ['settings/backup_settings.json', BACKUP_SETTINGS_KEY],
    ['templates/word_templates.json', DATA_KEYS.templates],
    ['templates/generated_documents.json', DATA_KEYS.documents],
    ['attachments/student_attachments.json', DATA_KEYS.attachments],
    ['metadata/custom_files.json', DATA_KEYS.customFiles],
    ['metadata/google_drive.json', GOOGLE_DRIVE_KEY],
  ];

  for (const [zipPath, storageKey] of restoreKeys) {
    const f = folder.file(zipPath);
    if (f) {
      const content = await f.async('text');
      localStorage.setItem(storageKey, content);
    }
  }

  onProgress?.('تمت الاستعادة بنجاح! سيتم إعادة تشغيل التطبيق...');
  await new Promise(resolve => setTimeout(resolve, 1500));
  window.location.reload();
}

// ── Export helpers ───────────────────────────────────────────────────
export { formatFileSize, getBackupFolderName };
