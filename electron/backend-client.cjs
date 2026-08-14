/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Murshid backend API client for the Electron main process.
 *
 * All requests carry the shared API key plus a per-machine JWT issued by
 * the backend. The JWT is stored in the OS-protected safeStorage when
 * available (fallback: a 0600 file in userData). Tokens and keys are
 * never exposed to the renderer.
 */

const path = require('path');
const fs = require('fs');
const { app, safeStorage } = require('electron');

const BASE_URL = (process.env.MURSHID_BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const API_KEY = process.env.MURSHID_API_KEY || '';

function tokenFile() {
  return path.join(app.getPath('userData'), 'murshid-backend-token.bin');
}

function loadToken() {
  try {
    if (!fs.existsSync(tokenFile())) return '';
    const buf = fs.readFileSync(tokenFile());
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf);
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

function saveToken(token) {
  try {
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token)
      : Buffer.from(token, 'utf8');
    fs.writeFileSync(tokenFile(), data, { mode: 0o600 });
  } catch {}
}

function clearToken() {
  try {
    fs.rmSync(tokenFile(), { force: true });
  } catch {}
}

let token = '';
let tokenLoaded = false;
let profile = { fullName: '', schoolName: '', province: '' };

// safeStorage is only usable after the app is ready, so the token is
// loaded lazily on the first API call (which happens after ready).
function ensureTokenLoaded() {
  if (!tokenLoaded) {
    tokenLoaded = true;
    token = loadToken();
  }
}

function setProfile(p) {
  if (p && typeof p === 'object') {
    profile = {
      fullName: String(p.fullName || '').trim(),
      schoolName: String(p.schoolName || '').trim(),
      province: String(p.province || '').trim(),
    };
  }
}

async function request(method, urlPath, { json, form, raw } = {}) {
  const headers = {};
  if (API_KEY) headers['x-murshid-api-key'] = API_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (form) {
    body = form;
  } else if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (raw) {
    headers['Content-Type'] = 'application/octet-stream';
    body = raw;
  }

  let res;
  try {
    res = await fetch(BASE_URL + urlPath, { method, headers, body });
  } catch (err) {
    const e = new Error('تعذر الاتصال بخادم مرشد. تأكد من تشغيل الخادم ومن اتصال الإنترنت.');
    e.status = 0;
    throw e;
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const e = new Error(data.error || `HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return data;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const disposition = res.headers.get('content-disposition') || '';
  const name = decodeDispositionName(disposition);
  return { buffer, mimeType: ct || 'application/octet-stream', name, disposition };
}

function decodeDispositionName(disposition) {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition || '');
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return '';
}

async function ensureRegistered() {
  ensureTokenLoaded();
  if (token) return;
  const hwid = require('./integrity.cjs').getHwid();
  const res = await request('POST', '/api/v1/register', {
    json: {
      hwid,
      deviceId: hwid,
      name: profile.fullName,
      schoolName: profile.schoolName,
      province: profile.province,
    },
  });
  if (!res.token) throw new Error('لم يتلقَّ البرنامج رمز الجلسة من الخادم.');
  token = res.token;
  saveToken(token);
}

const client = {
  setProfile,
  setTokenForTesting(t) {
    token = t;
  },

  async status() {
    await ensureRegistered();
    const res = await request('GET', '/api/v1/status');
    return res.user;
  },

  async listFolder(folderKey) {
    await ensureRegistered();
    return request('GET', `/api/v1/folders/${encodeURIComponent(folderKey)}`);
  },

  async getContent(fileId, { disposition = 'inline', preview = false } = {}) {
    await ensureRegistered();
    const q = new URLSearchParams({ disposition });
    if (preview) q.set('preview', '1');
    return request('GET', `/api/v1/files/${encodeURIComponent(fileId)}/content?${q.toString()}`);
  },

  async upload(folderKey, { title, description, fileName, mimeType, buffer }) {
    await ensureRegistered();
    const form = new FormData();
    form.append('title', String(title || ''));
    if (description) form.append('description', String(description));
    form.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileName);
    return request('POST', `/api/v1/folders/${encodeURIComponent(folderKey)}/upload`, { form });
  },

  async deleteFile(fileId) {
    await ensureRegistered();
    return request('DELETE', `/api/v1/files/${encodeURIComponent(fileId)}`);
  },

  async share(fileId) {
    await ensureRegistered();
    return request('POST', `/api/v1/files/${encodeURIComponent(fileId)}/share`);
  },
};

module.exports = { client, setProfile };
