/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local-disk mock Drive adapter. Used for tests and when no Google
 * credentials are configured (MURSHID_DRIVE_MODE=mock). Never used in
 * production deployments that configure real credentials.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileDir(mockRoot, folderId, fileId) {
  return ensureDir(path.join(mockRoot, folderId, fileId));
}

function metaPath(mockRoot, folderId, fileId) {
  return path.join(fileDir(mockRoot, folderId, fileId), 'meta.json');
}

function contentPath(mockRoot, folderId, fileId) {
  return path.join(fileDir(mockRoot, folderId, fileId), 'content.bin');
}

function readMeta(mockRoot, folderId, fileId) {
  try {
    return JSON.parse(fs.readFileSync(metaPath(mockRoot, folderId, fileId), 'utf8'));
  } catch {
    return null;
  }
}

function build(config) {
  const mockRoot = ensureDir(config.mockDriveDir);

  return {
    mode: 'mock',

    async listFolder(folderId, { pageToken, pageSize }) {
      const dir = path.join(mockRoot, folderId);
      if (!fs.existsSync(dir)) return { files: [], nextPageToken: null };
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => readMeta(mockRoot, folderId, e.name))
        .filter(Boolean)
        .sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));

      const start = pageToken ? parseInt(pageToken, 10) : 0;
      const page = entries.slice(start, start + pageSize);
      const nextPageToken = start + pageSize < entries.length ? String(start + pageSize) : null;
      return { files: page, nextPageToken };
    },

    async getFile(fileId) {
      for (const folderId of fs.readdirSync(mockRoot)) {
        const meta = readMeta(mockRoot, folderId, fileId);
        if (meta) return meta;
      }
      const err = new Error('File not found in mock drive.');
      err.status = 404;
      throw err;
    },

    async readContent(fileId, { exportPdf } = {}) {
      const meta = await this.getFile(fileId);
      const folderId = meta.parents && meta.parents[0];
      const buf = fs.readFileSync(contentPath(mockRoot, folderId, fileId));
      if (exportPdf && String(meta.mimeType).startsWith('application/vnd.google-apps.')) {
        return { buffer: Buffer.from('%PDF-mock-export'), mimeType: 'application/pdf', name: `${meta.name}.pdf` };
      }
      return { buffer: buf, mimeType: meta.mimeType, name: meta.name };
    },

    async uploadFile({ folderId, name, mimeType, buffer, appProperties }) {
      const fileId = 'mock_' + crypto.randomBytes(8).toString('hex');
      const now = new Date().toISOString();
      const meta = {
        id: fileId,
        name,
        mimeType,
        size: buffer.length,
        createdTime: now,
        modifiedTime: now,
        parents: [folderId],
        appProperties,
        isFolder: false,
      };
      fs.writeFileSync(metaPath(mockRoot, folderId, fileId), JSON.stringify(meta, null, 2));
      fs.writeFileSync(contentPath(mockRoot, folderId, fileId), buffer);
      return meta;
    },

    async deleteFile(fileId) {
      for (const folderId of fs.readdirSync(mockRoot)) {
        if (readMeta(mockRoot, folderId, fileId)) {
          fs.rmSync(path.join(mockRoot, folderId, fileId), { recursive: true, force: true });
          return;
        }
      }
      const err = new Error('File not found in mock drive.');
      err.status = 404;
      throw err;
    },
  };
}

module.exports = { build };
