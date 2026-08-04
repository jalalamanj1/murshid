/**
 * Google Sheets Metadata Service
 * Manages file metadata rows in the Google Drive Sheet.
 *
 * Sheet columns:
 *   A: File ID   B: File Name   C: Uploaded By   D: School
 *   E: Category   F: Description   G: Upload Date   H: File Size   I: MIME Type
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_ID = '151WDP18t9s3nFUdmQ6XkViXTlilmsYmzzUewJkdQEc4';
const SHEET_RANGE = 'Sheet1';

// ── Types ────────────────────────────────────────────────────────────

export interface FileMetadata {
  fileId: string;      // A — Google Drive File ID
  fileName: string;    // B
  uploadedBy: string;  // C
  school: string;      // D
  category: string;    // E
  description: string; // F
  uploadDate: string;  // G
  fileSize: string;    // H
  mimeType: string;    // I
}

const EMPTY_META: FileMetadata = {
  fileId: '', fileName: '', uploadedBy: '', school: '',
  category: '', description: '', uploadDate: '', fileSize: '', mimeType: '',
};

// ── API Helpers ──────────────────────────────────────────────────────

async function sheetsRequest<T = any>(
  accessToken: string,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    },
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const msg = errBody?.error?.message || `${resp.status}`;
    throw new Error(`Sheets API: ${msg}`);
  }

  if (resp.status === 204) return null as T;
  const text = await resp.text();
  if (!text) return null as T;
  return JSON.parse(text);
}

function rowToMeta(row: any[]): FileMetadata {
  return {
    fileId: row[0] || '',
    fileName: row[1] || '',
    uploadedBy: row[2] || '',
    school: row[3] || '',
    category: row[4] || '',
    description: row[5] || '',
    uploadDate: row[6] || '',
    fileSize: row[7] || '',
    mimeType: row[8] || '',
  };
}

function metaToRow(m: FileMetadata): any[] {
  return [m.fileId, m.fileName, m.uploadedBy, m.school, m.category, m.description, m.uploadDate, m.fileSize, m.mimeType];
}

// ── Read all metadata rows ───────────────────────────────────────────

export async function readAllMetadata(accessToken: string): Promise<FileMetadata[]> {
  const range = `${SHEET_RANGE}!A2:I`;
  const url = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const data = await sheetsRequest<{ values?: any[][] }>(accessToken, url);
  if (!data.values) return [];
  return data.values.filter(r => r[0]).map(rowToMeta);
}

// ── Append one metadata row ──────────────────────────────────────────

export async function appendMetadata(
  accessToken: string,
  meta: FileMetadata
): Promise<void> {
  const range = `${SHEET_RANGE}!A1:I`;
  const url = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await sheetsRequest(accessToken, url, {
    method: 'POST',
    body: JSON.stringify({ values: [metaToRow(meta)] }),
  });
}

// ── Find row index by File ID ────────────────────────────────────────

async function findRowIndex(
  accessToken: string,
  fileId: string
): Promise<number> {
  const metas = await readAllMetadata(accessToken);
  return metas.findIndex(m => m.fileId === fileId);
}

// ── Update a row by File ID ──────────────────────────────────────────

export async function updateMetadata(
  accessToken: string,
  fileId: string,
  updates: Partial<FileMetadata>
): Promise<void> {
  const metas = await readAllMetadata(accessToken);
  const idx = metas.findIndex(m => m.fileId === fileId);
  if (idx === -1) return;

  const updated = { ...metas[idx], ...updates };
  const rowNum = idx + 2; // row 1 = header, data starts row 2
  const range = `${SHEET_RANGE}!A${rowNum}:I${rowNum}`;
  const url = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await sheetsRequest(accessToken, url, {
    method: 'PUT',
    body: JSON.stringify({ values: [metaToRow(updated)] }),
  });
}

// ── Delete a row by File ID ──────────────────────────────────────────

export async function deleteMetadata(
  accessToken: string,
  fileId: string
): Promise<void> {
  const metas = await readAllMetadata(accessToken);
  const idx = metas.findIndex(m => m.fileId === fileId);
  if (idx === -1) return;

  const rowNum = idx + 2;
  const url = `${SHEETS_API}/v2/spreadsheets/${SHEET_ID}:batchUpdate`;
  await sheetsRequest(accessToken, url, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: rowNum - 1,  // 0-indexed
            endIndex: rowNum,        // exclusive
          },
        },
      }],
    }),
  });
}

// ── Search metadata ──────────────────────────────────────────────────

export function filterMetadata(
  metas: FileMetadata[],
  query: string
): FileMetadata[] {
  if (!query.trim()) return metas;
  const q = query.toLowerCase();
  return metas.filter(m =>
    m.fileName.toLowerCase().includes(q) ||
    m.uploadedBy.toLowerCase().includes(q) ||
    m.school.toLowerCase().includes(q) ||
    m.category.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q)
  );
}
