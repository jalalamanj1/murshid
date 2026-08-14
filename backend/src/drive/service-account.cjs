/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real Google Drive adapter backed by a server-side SERVICE ACCOUNT.
 * The service account must be granted access to the two owner folders.
 * Credentials are read from env / secret files — never from clients.
 */

const fs = require('fs');
const { JWT } = require('google-auth-library');
const { normalizeFile, isGoogleNative } = require('./index.cjs');

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = ['https://www.googleapis.com/auth/drive'];

function loadServiceAccount(config) {
  if (config.serviceAccount.json) return JSON.parse(config.serviceAccount.json);
  if (config.serviceAccount.jsonBase64) {
    return JSON.parse(Buffer.from(config.serviceAccount.jsonBase64, 'base64').toString('utf8'));
  }
  if (config.serviceAccount.path) {
    return JSON.parse(fs.readFileSync(config.serviceAccount.path, 'utf8'));
  }
  throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON / _JSON_B64 / _PATH is required for service-account mode.');
}

function build(config) {
  const sa = loadServiceAccount(config);
  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPE,
  });

  async function authHeaders() {
    const token = await client.getAccessToken();
    return { Authorization: `Bearer ${token.token_value}` };
  }

  async function driveJson(pathWithQuery, options) {
    const headers = await authHeaders();
    const resp = await fetch(`${DRIVE_API}${pathWithQuery}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err = new Error(`Google Drive API ${resp.status}: ${text}`);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  }

  return {
    mode: 'service-account',

    async listFolder(folderId, { pageToken, pageSize }) {
      const q = `'${folderId}' in parents and trashed=false`;
      const fields = 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,appProperties)';
      const params = new URLSearchParams({
        q,
        fields,
        pageSize: String(pageSize),
        orderBy: 'createdTime desc',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await driveJson(`/files?${params.toString()}`);
      return {
        files: (data.files || []).map(normalizeFile),
        nextPageToken: data.nextPageToken || null,
      };
    },

    async getFile(fileId) {
      const fields = 'id,name,mimeType,size,createdTime,modifiedTime,parents,appProperties';
      const data = await driveJson(`/files/${encodeURIComponent(fileId)}?fields=${fields}`);
      return normalizeFile(data);
    },

    async readContent(fileId, { exportPdf } = {}) {
      const file = await this.getFile(fileId);
      const headers = await authHeaders();
      if (isGoogleNative(file.mimeType)) {
        if (!exportPdf) {
          const err = new Error('Google-native file cannot be previewed in its native form.');
          err.status = 415;
          throw err;
        }
        const resp = await fetch(
          `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`,
          { headers }
        );
        if (!resp.ok) {
          const err = new Error(`Drive export failed: ${resp.status}`);
          err.status = resp.status;
          throw err;
        }
        const buf = Buffer.from(await resp.arrayBuffer());
        return { buffer: buf, mimeType: 'application/pdf', name: `${file.name.replace(/\.[^/.]+$/, '')}.pdf` };
      }
      const resp = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
      if (!resp.ok) {
        const err = new Error(`Drive download failed: ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      return { buffer: buf, mimeType: file.mimeType, name: file.name };
    },

    async uploadFile({ folderId, name, mimeType, buffer, appProperties }) {
      const headers = await authHeaders();
      const metadata = { name, parents: [folderId], appProperties };
      const form = new FormData();
      form.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
      );
      form.append('file', new Blob([buffer], { type: mimeType }), name);
      const resp = await fetch(
        `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,parents,appProperties`,
        {
          method: 'POST',
          headers,
          body: form,
        }
      );
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const err = new Error(`Drive upload failed: ${resp.status}: ${text}`);
        err.status = resp.status;
        throw err;
      }
      return normalizeFile(await resp.json());
    },

    async deleteFile(fileId) {
      const headers = await authHeaders();
      const resp = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok && resp.status !== 404) {
        const err = new Error(`Drive delete failed: ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
    },
  };
}

module.exports = { build };
