/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drive adapter factory + shared file normalization.
 *
 * Two real adapters use the OWNER's Google credentials (service account or
 * OAuth refresh token), held only server-side:
 *   - service-account.cjs
 *   - oauth.cjs
 * A local-disk mock adapter (mock.cjs) exists for tests and for running
 * without Google credentials. It is never used in production by default.
 */

const fs = require('fs');

function isGoogleNative(mimeType) {
  return typeof mimeType === 'string' && mimeType.startsWith('application/vnd.google-apps.');
}

/** Normalize a Drive API file object into our stable shape. */
function normalizeFile(raw) {
  return {
    id: raw.id,
    name: raw.name || 'ملف',
    mimeType: raw.mimeType || 'application/octet-stream',
    size: raw.size ? parseInt(raw.size, 10) : 0,
    createdTime: raw.createdTime || raw.modifiedTime || null,
    modifiedTime: raw.modifiedTime || raw.createdTime || null,
    parents: Array.isArray(raw.parents) ? raw.parents : [],
    appProperties: raw.appProperties || {},
    isFolder: (raw.mimeType || '') === 'application/vnd.google-apps.folder',
  };
}

function buildAdapter(config) {
  switch (config.driveMode) {
    case 'service-account':
      return require('./service-account.cjs').build(config);
    case 'oauth':
      return require('./oauth.cjs').build(config);
    case 'mock':
    default:
      return require('./mock.cjs').build(config);
  }
}

module.exports = { buildAdapter, normalizeFile, isGoogleNative };
