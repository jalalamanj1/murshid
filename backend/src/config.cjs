/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Murshid backend configuration.
 *
 * The owner's Google Drive credentials live ONLY here (server-side),
 * never inside the Electron desktop application.
 */

const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {}

const dataDir = process.env.MURSHID_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DEFAULT_LETTERS_FOLDER = '1U5Fows578m6t9WJNe0HNWYG2m0D6HiDO';
const DEFAULT_FILES_FOLDER = '1pNFVBUHEr0pRlo2w2b_r-JIGHdFJYo8I';

const driveMode =
  process.env.MURSHID_DRIVE_MODE ||
  (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    ? 'service-account'
    : process.env.GOOGLE_OAUTH_REFRESH_TOKEN
      ? 'oauth'
      : 'mock');

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  // Shared secret between the desktop app and this backend. Required in production.
  apiKey: process.env.MURSHID_API_KEY || '',
  jwtSecret: process.env.MURSHID_JWT_SECRET || '',
  // Public base URL used to build share links (no trailing slash).
  baseUrl: (process.env.MURSHID_BASE_URL || `http://localhost:${process.env.PORT || '8080'}`).replace(/\/+$/, ''),
  folders: {
    letters: process.env.MURSHID_DRIVE_FOLDER_LETTERS || DEFAULT_LETTERS_FOLDER,
    files: process.env.MURSHID_DRIVE_FOLDER_FILES || DEFAULT_FILES_FOLDER,
  },
  driveMode,
  // A user may delete their own upload only for this window (milliseconds).
  deleteWindowMs: parseInt(process.env.MURSHID_DELETE_WINDOW_MS || (60 * 60 * 1000).toString(), 10),
  // Share links are valid for this long.
  shareTtlMs: parseInt(process.env.MURSHID_SHARE_TTL_MS || (24 * 60 * 60 * 1000).toString(), 10),
  maxUploadBytes: parseInt(process.env.MURSHID_MAX_UPLOAD_BYTES || (50 * 1024 * 1024).toString(), 10),
  dataDir,
  // Local-disk mock used only for tests / when no Google credentials are configured.
  mockDriveDir: process.env.MURSHID_MOCK_DRIVE_DIR || path.join(dataDir, 'mock-drive'),
  serviceAccount: {
    json: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
    jsonBase64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || '',
    path: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '',
  },
  oauth: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
  },
};

if (config.driveMode === 'mock') {
  console.warn('[murshid-backend] WARNING: running in MOCK drive mode (no Google credentials configured).');
}

module.exports = config;
