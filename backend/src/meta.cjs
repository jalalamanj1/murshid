/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Backend metadata store for user uploads (title / description / original
 * filename / uploader / timestamp). Rule-critical fields (uploaderId,
 * uploadedAt) are ALSO written to the Drive file's appProperties so the
 * one-hour delete rule never depends on this store alone.
 */

const path = require('path');
const fs = require('fs');

function metaFile(dataDir) {
  return path.join(dataDir, 'files-meta.json');
}

function loadMeta(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(metaFile(dataDir), 'utf8'));
  } catch {
    return {};
  }
}

function saveMeta(dataDir, meta) {
  fs.writeFileSync(metaFile(dataDir), JSON.stringify(meta, null, 2));
}

function setMeta(dataDir, fileId, entry) {
  const meta = loadMeta(dataDir);
  meta[fileId] = entry;
  saveMeta(dataDir, meta);
  return entry;
}

function getMeta(dataDir, fileId) {
  const meta = loadMeta(dataDir);
  return meta[fileId] || null;
}

function deleteMeta(dataDir, fileId) {
  const meta = loadMeta(dataDir);
  if (meta[fileId]) {
    delete meta[fileId];
    saveMeta(dataDir, meta);
  }
}

module.exports = { loadMeta, setMeta, getMeta, deleteMeta };
