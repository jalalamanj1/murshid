#!/usr/bin/env node
// Safe release publisher for Murshid.
//
// Guarantees that the exe, blockmap and latest.yml on the GitHub release
// all come from ONE single build, and verifies the sha512 in latest.yml
// matches the exe actually served, so the auto-updater can never hit a
// "sha512 checksum mismatch".
//
// Usage:  npm run release   (or: node scripts/publish-release.cjs)
// Requires: git, npm, gh CLI authenticated (see: gh auth status)

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');
const REPO = 'jalalamanj1/Murshid-Releases';
const TARGET_BRANCH = 'master';

const { version } = require(path.join(ROOT, 'package.json'));
const TAG = `v${version}`;
const EXE = `murshid-${version}-win-x64.exe`;
const BLOCKMAP = `${EXE}.blockmap`;
const LATEST_YML = 'latest.yml';

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function sha256Hex(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fail(msg) {
  console.error(`\n[release] FAILED: ${msg}`);
  process.exit(1);
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) fail(`artifact missing: ${filePath}`);
}

function readLatestYmlSha512(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const values = lines
    .filter((l) => l.startsWith('sha512:'))
    .map((l) => l.slice('sha512:'.length).trim());
  if (values.length !== 2 || values[0] !== values[1]) {
    fail(`latest.yml is malformed or inconsistent (sha512 entries: ${JSON.stringify(values)})`);
  }
  return values[0];
}

function releaseExists() {
  try {
    execSync(`gh release view ${TAG} --repo ${REPO}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ── 0. Preflight ──────────────────────────────────────────────────────
console.log(`[release] Building & publishing Murshid v${version} to ${REPO}`);
try {
  execSync('gh auth status', { stdio: 'pipe' });
} catch {
  fail('gh CLI is not authenticated. Run: gh auth login');
}

// ── 1. One clean build (exe + blockmap + latest.yml from the SAME run) ─
sh('npm run build');
sh('npx electron-builder --win');

const exePath = path.join(RELEASE_DIR, EXE);
const blockmapPath = path.join(RELEASE_DIR, BLOCKMAP);
const latestYmlPath = path.join(RELEASE_DIR, LATEST_YML);
assertFile(exePath);
assertFile(blockmapPath);
assertFile(latestYmlPath);

// ── 2. Local consistency check BEFORE upload ─────────────────────────
const localSha512 = sha512Base64(exePath);
const ymlSha512 = readLatestYmlSha512(latestYmlPath);
console.log(`[release] exe sha512:       ${localSha512}`);
console.log(`[release] latest.yml sha512: ${ymlSha512}`);
if (localSha512 !== ymlSha512) {
  fail(`local exe sha512 does NOT match latest.yml. Refusing to upload.`);
}

// ── 3. Ensure the GitHub release/tag exists ──────────────────────────
if (releaseExists()) {
  console.log(`[release] release ${TAG} already exists - reusing it`);
} else {
  console.log(`[release] creating release ${TAG}`);
  sh(`gh release create ${TAG} --repo ${REPO} --target ${TARGET_BRANCH} --title "${version}" --notes "النسخة ${version}"`);
}

// ── 4. Upload (clobber, in case of re-runs) ──────────────────────────
sh(`gh release upload ${TAG} "${exePath}" "${blockmapPath}" "${latestYmlPath}" --repo ${REPO} --clobber`);

// ── 5. Verify what is actually served ────────────────────────────────
const verifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'murshid-verify-'));
try {
  sh(`gh release download ${TAG} --repo ${REPO} --clobber --dir "${verifyDir}"`, { stdio: 'pipe' });

  const dlExe = path.join(verifyDir, EXE);
  const dlYml = path.join(verifyDir, LATEST_YML);
  const dlBlockmap = path.join(verifyDir, BLOCKMAP);
  assertFile(dlExe);
  assertFile(dlYml);
  assertFile(dlBlockmap);

  const dlSha512 = sha512Base64(dlExe);
  const dlYmlSha = readLatestYmlSha512(dlYml); // served latest.yml must match served exe

  if (dlYmlSha !== dlSha512 || dlYmlSha !== localSha512) {
    fail(`checksum mismatch AFTER upload: latest.yml=${dlYmlSha}, exe=${dlSha512}`);
  }

  const dlBlockmapHex = sha256Hex(dlBlockmap);
  const localBlockmapHex = sha256Hex(blockmapPath);
  if (dlBlockmapHex !== localBlockmapHex) {
    fail(`served blockmap does not match uploaded blockmap`);
  }

  console.log(`[release] VERIFIED: latest.yml sha512 matches the served exe and blockmap.`);
  console.log(`[release] Release: https://github.com/${REPO}/releases/tag/${TAG}`);
} finally {
  fs.rmSync(verifyDir, { recursive: true, force: true });
}
