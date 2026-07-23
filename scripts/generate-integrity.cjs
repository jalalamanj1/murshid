/**
 * Generate integrity.json manifest at build time.
 * Hashes critical files so the app can detect tampering.
 *
 * Run after vite build, before electron-builder packaging:
 *   node scripts/generate-integrity.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILES_TO_HASH = [
  'dist/index.html',
  'dist/assets/index-*.js',
  'dist/assets/index-*.css',
  'electron/main.cjs',
  'electron/preload.cjs',
  'electron/ExportService.cjs',
  'electron/template-manager.cjs',
  'electron/template-registry.cjs',
  'electron/RecordCoverService.cjs',
  'electron/integrity.cjs',
  'electron/update-manager.cjs',
  'electron/session-manager.cjs',
];

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const data = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      resolve(hash);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateManifest() {
  const entries = [];

  for (const pattern of FILES_TO_HASH) {
    // Support glob-like patterns for dist assets
    if (pattern.includes('*')) {
      const dir = path.dirname(pattern);
      const base = path.basename(pattern);
      const regex = new RegExp('^' + base.replace(/\*/g, '.*') + '$');
      const fullDir = path.join(__dirname, '..', dir);
      if (!fs.existsSync(fullDir)) continue;
      const files = fs.readdirSync(fullDir);
      for (const file of files) {
        if (regex.test(file)) {
          const filePath = path.join(fullDir, file);
          const hash = await hashFile(filePath);
          entries.push({ path: path.join(dir, file), hash });
        }
      }
    } else {
      const filePath = path.join(__dirname, '..', pattern);
      if (!fs.existsSync(filePath)) {
        console.warn('[Integrity] File not found:', pattern);
        continue;
      }
      const hash = await hashFile(filePath);
      entries.push({ path: pattern, hash });
    }
  }

  const manifest = { files: entries };
  const outPath = path.join(__dirname, '..', 'integrity.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Integrity] Manifest generated: ${entries.length} files hashed -> ${outPath}`);
}

generateManifest().catch(err => {
  console.error('[Integrity] Failed:', err.message);
  process.exit(1);
});
