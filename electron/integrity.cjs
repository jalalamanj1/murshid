/**
 * Integrity & HWID Ban system.
 *
 * On startup, verifies critical file integrity.
 * If files are tampered with, the app self-destructs (stops working)
 * and stores a HWID ban locally to prevent re-use.
 *
 * HWID is derived from stable system identifiers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const BAN_FILE = 'murshid_banned_hwid';
const INTEGRITY_FILE = 'integrity.json';

/**
 * Generate a device HWID.
 */
function getHwid() {
  const raw = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Get the path to the ban file (stored in userData).
 */
function getBanPath(userDataPath) {
  return path.join(userDataPath, BAN_FILE);
}

/**
 * Get the path to the integrity manifest (inside app.asar).
 */
function getIntegrityManifestPath() {
  // In dev mode, use project root; in production, use asar root
  const base = process.resourcesPath || path.join(__dirname, '..');
  return path.join(base, 'integrity.json');
}

/**
 * Compute SHA256 hash of a file.
 */
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

/**
 * Check if this device is banned.
 */
function isBanned(userDataPath) {
  const banPath = getBanPath(userDataPath);
  if (!fs.existsSync(banPath)) return false;
  try {
    const banned = fs.readFileSync(banPath, 'utf8').trim();
    return banned === getHwid();
  } catch {
    return false;
  }
}

/**
 * Ban this device by storing the HWID.
 */
function banDevice(userDataPath) {
  const banPath = getBanPath(userDataPath);
  try {
    const dir = path.dirname(banPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(banPath, getHwid(), 'utf8');
  } catch {}
}

/**
 * Verify the integrity of the application by checking
 * the integrity manifest against actual file hashes.
 *
 * Returns { valid: boolean, error?: string }
 */
async function verifyIntegrity(userDataPath) {
  // First check if device is already banned
  if (isBanned(userDataPath)) {
    return { valid: false, error: 'تم حظر هذا الجهاز بسبب التلاعب بملفات البرنامج.' };
  }

  // In dev mode, skip integrity check
  if (!process.resourcesPath || process.env.NODE_ENV === 'development') {
    return { valid: true };
  }

  // Load integrity manifest
  const manifestPath = getIntegrityManifestPath();
  if (!fs.existsSync(manifestPath)) {
    // No manifest yet — allow but warn
    return { valid: true };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const entry of manifest.files) {
      const filePath = path.join(process.resourcesPath, entry.path);
      if (!fs.existsSync(filePath)) {
        banDevice(userDataPath);
        return { valid: false, error: 'ملف تالف: ' + entry.path };
      }
      const actualHash = await hashFile(filePath);
      if (actualHash !== entry.hash) {
        banDevice(userDataPath);
        return { valid: false, error: 'تم التلاعب بالملف: ' + entry.path };
      }
    }
    return { valid: true };
  } catch (err) {
    banDevice(userDataPath);
    return { valid: false, error: 'فشل التحقق من سلامة البرنامج: ' + err.message };
  }
}

module.exports = { getHwid, isBanned, banDevice, verifyIntegrity, hashFile };
