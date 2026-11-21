/**
 * Public GitHub repository sync for the app's reference libraries.
 *
 * Three public repositories feed three tabs (letters, files, covers). Every
 * five seconds the main process checks the repository's commit feed (the Atom
 * feed, which does not consume the GitHub API quota). When the latest commit
 * changes, the file tree is fetched once, new/changed files are downloaded
 * for offline use, and files removed upstream are deleted locally.
 */

const { app, shell, BrowserWindow, dialog, net } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const { fillDocxBuffer } = require('./docx-fill.cjs');

const OWNER = 'jalalamanj1';

const REPOS = {
  files: { owner: OWNER, repo: 'murshidfiles', branch: 'main', label: 'الملفات' },
  letters: { owner: OWNER, repo: 'murshidletters', branch: 'main', label: 'مخاطبات التربية' },
  covers: { owner: OWNER, repo: 'murshidcovers', branch: 'main', label: 'أغلفة السجلات' },
};

const POLL_INTERVAL_MS = 5000;
const BACKOFF_MS = 60 * 1000;
const IGNORED = /(^|\/)(\.|~|Thumbs\.db$)/i;

let _mainWindow = null;
let _state = null;
let _statePath = null;
let _cacheRoot = null;
let _timer = null;
let _syncing = false;
let _backoffUntil = 0;
const _emptyPollGate = {};

/** Transient connectivity failures must never look like repository errors. */
function isOfflineError(message) {
  return /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|socket hang up|network error/i.test(
    String(message || '')
  );
}

function offlineNow() {
  try {
    return typeof net?.isOnline === 'function' && !net.isOnline();
  } catch {
    return false;
  }
}

function paths() {
  if (_statePath) return { statePath: _statePath, cacheRoot: _cacheRoot };
  const base = app.getPath('userData');
  _statePath = path.join(base, 'repo-state.json');
  _cacheRoot = path.join(base, 'repo-cache');
  fs.mkdirSync(_cacheRoot, { recursive: true });
  return { statePath: _statePath, cacheRoot: _cacheRoot };
}

function loadState() {
  if (_state) return _state;
  try {
    _state = JSON.parse(fs.readFileSync(paths().statePath, 'utf8'));
  } catch {
    _state = {};
  }
  return _state;
}

function saveState() {
  try {
    fs.writeFileSync(paths().statePath, JSON.stringify(_state));
  } catch (err) {
    console.error('[repos] could not save state:', err.message);
  }
}

function request(url, { json = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Murshid-App',
          Accept: json ? 'application/vnd.github+json' : '*/*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(res.headers.location, { json }).then(resolve, reject);
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('انتهت مهلة الاتصال')));
  });
}

async function latestCommit(repo) {
  for (const branch of [repo.branch, 'master']) {
    const res = await request(`https://github.com/${repo.owner}/${repo.repo}/commits/${branch}.atom`);
    if (res.status === 200) {
      const match = res.body.match(/Grit::Commit\/([0-9a-f]{40})/);
      if (match) return { branch, sha: match[1] };
      return { branch, sha: null };
    }
    if (res.status === 404) continue;
    if (res.status === 403 || res.status === 429) throw new Error('تم تجاوز حد الطلبات مؤقتاً');
  }
  return { branch: repo.branch, sha: null };
}

async function remoteFiles(repo, branch, sha) {
  const res = await request(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${sha || branch}?recursive=1`,
    { json: true }
  );

  if (res.status === 409 || res.status === 404) return [];
  if (res.status === 403 || res.status === 429) throw new Error('تم تجاوز حد طلبات GitHub مؤقتاً');
  if (res.status !== 200) throw new Error(`تعذر قراءة المستودع (${res.status})`);

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error('استجابة غير صالحة من GitHub');
  }
  if (!Array.isArray(parsed.tree)) return [];

  return parsed.tree
    .filter((item) => item.type === 'blob' && item.path && !IGNORED.test(item.path))
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: item.size || 0,
      name: path.basename(item.path),
    }));
}

function localPathFor(key, relPath) {
  const normalized = path.normalize(String(relPath || '')).replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized) || normalized.includes('\0')) {
    throw new Error('مسار ملف غير صالح.');
  }
  return path.join(paths().cacheRoot, key, normalized);
}

function downloadFile(repo, sha, relPath) {
  return new Promise((resolve, reject) => {
    const target = localPathFor(
      Object.keys(REPOS).find((key) => REPOS[key].repo === repo.repo),
      relPath
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const encoded = relPath.split('/').map(encodeURIComponent).join('/');
    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${sha}/${encoded}`;

    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Murshid-App' } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`تعذر تنزيل ${relPath} (${res.statusCode})`));
          return;
        }
        const temp = `${target}.part`;
        const out = fs.createWriteStream(temp);
        res.pipe(out);
        out.on('finish', () => {
          out.close(() => {
            try {
              fs.renameSync(temp, target);
              resolve(target);
            } catch (err) {
              reject(err);
            }
          });
        });
        out.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('انتهت مهلة تنزيل الملف')));
  });
}

const ALLOWED_FILE = /\.(png|jpe?g|webp|gif|bmp|pdf|docx?|xlsx?|csv)$/i;

function readLibraryMeta(key) {
  try {
    const raw = fs.readFileSync(localPathFor(key, 'library.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.files === 'object' ? parsed.files : {};
  } catch {
    return {};
  }
}

function publicState(key) {
  const entry = loadState()[key] || {};
  const meta = readLibraryMeta(key);
  const files = Object.values(entry.files || {})
    .filter((file) => file.path !== 'library.json' && ALLOWED_FILE.test(file.path))
    .map((file) => {
      const absolute = localPathFor(key, file.path);
      const info = meta[file.path] || {};
      return {
        path: file.path,
        name: file.name || path.basename(file.path),
        size: file.size || 0,
        sha: file.sha,
        local: fs.existsSync(absolute),
        title: typeof info.title === 'string' ? info.title : '',
        description: typeof info.description === 'string' ? info.description : '',
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'ar'));

  return {
    key,
    files,
    syncedAt: entry.syncedAt || null,
    commit: entry.commit || null,
    // A cached connectivity failure should never be shown as a repository error.
    error: entry.error && !isOfflineError(entry.error) ? entry.error : null,
  };
}

function broadcast(data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('repo:update', data);
  }
}

/**
 * Pure planning step: compare the remote tree with the local state.
 * Exported for tests so deletion/download decisions can be verified.
 */
function planChanges(previous, remote) {
  const prevFiles = previous?.files || {};
  const remoteMap = new Map(remote.map((file) => [file.path, file]));

  const toDownload = [];
  const added = [];
  const changed = [];

  for (const file of remote) {
    const old = prevFiles[file.path];
    if (!old || old.sha !== file.sha) {
      toDownload.push(file);
      if (!old) added.push(file.path);
      else changed.push(file.path);
    }
  }

  const removed = Object.keys(prevFiles).filter((filePath) => !remoteMap.has(filePath));

  return { toDownload, added, changed, removed, remoteMap };
}

async function syncRepo(key, { force = false } = {}) {
  const repo = REPOS[key];
  if (!repo) return null;
  if (!force && _emptyPollGate[key] && Date.now() < _emptyPollGate[key]) {
    return publicState(key);
  }

  const entry = loadState()[key] || null;
  const errorBefore = entry?.error || null;

  try {
    const { branch, sha } = await latestCommit(repo);
    // An empty repository is re-checked less often to stay polite to GitHub.
    _emptyPollGate[key] = sha ? 0 : Date.now() + 10000;
    if (!force && sha && entry && entry.commit === sha) {
      // Same commit: make sure every file is actually present on disk.
      const missingLocal = Object.values(entry.files || {}).some(
        (file) => !fs.existsSync(localPathFor(key, file.path))
      );
      if (!missingLocal) return publicState(key);
    }

    const remote = sha ? await remoteFiles(repo, branch, sha) : [];
    const { toDownload, added, changed, removed, remoteMap } = planChanges(entry, remote);

    // Delete files that no longer exist upstream.
    for (const relPath of removed) {
      try {
        fs.rmSync(localPathFor(key, relPath), { force: true });
      } catch {}
    }

    // Download new or changed files for offline use.
    const files = {};
    for (const [relPath, remoteFile] of remoteMap) {
      const old = entry?.files?.[relPath];
      const target = localPathFor(key, relPath);
      const needsDownload = !old || old.sha !== remoteFile.sha || !fs.existsSync(target);

      if (needsDownload) {
        try {
          await downloadFile(repo, sha || branch, relPath);
        } catch (err) {
          console.error(`[repos] download failed ${key}/${relPath}:`, err.message);
        }
      }

      files[relPath] = {
        ...remoteFile,
        downloadedAt: Date.now(),
      };
    }

    _state[key] = {
      commit: sha,
      branch,
      files,
      syncedAt: Date.now(),
      error: null,
    };
    saveState();

    const initial = !entry || entry.commit === undefined;
    const payload = {
      ...publicState(key),
      added,
      changed,
      removed,
      initial,
      error: null,
    };
    console.log(
      `[repos] ${key}: ${Object.keys(files).length} files, +${added.length} ~${changed.length} -${removed.length}`
    );
    broadcast(payload);
    return payload;
  } catch (err) {
    const message = err?.message || String(err);

    // No internet / DNS failure: keep the cached library, retry quietly later.
    if (offlineNow() || isOfflineError(message)) {
      _backoffUntil = Date.now() + 30000;
      _state[key] = {
        ...(entry || {}),
        error: null,
        offline: true,
        syncedAt: entry?.syncedAt || null,
      };
      saveState();
      broadcast({
        ...publicState(key),
        added: [],
        changed: [],
        removed: [],
        offline: true,
        error: null,
      });
      if (errorBefore) console.warn(`[repos] ${key}: connection lost, will retry automatically.`);
      return publicState(key);
    }

    _state[key] = {
      ...(entry || {}),
      error: message,
      syncedAt: Date.now(),
    };
    saveState();
    broadcast({ ...publicState(key), added: [], changed: [], removed: [], error: message });
    if (errorBefore !== message) {
      console.error(`[repos] ${key} sync failed:`, message);
    }
    return publicState(key);
  }
}

async function syncAll(options = {}) {
  if (_syncing) return;
  if (Date.now() < _backoffUntil) return;
  if (offlineNow()) {
    _backoffUntil = Date.now() + 15000;
    return;
  }
  _syncing = true;
  try {
    for (const key of Object.keys(REPOS)) {
      await syncRepo(key, options);
    }
  } catch (err) {
    _backoffUntil = Date.now() + BACKOFF_MS;
    console.error('[repos] sync loop failed:', err.message);
  } finally {
    _syncing = false;
  }
}

function start(mainWindow) {
  _mainWindow = mainWindow;
  loadState();
  paths();
  // Download everything already in the repositories on first run.
  syncAll({ force: false });
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => syncAll(), POLL_INTERVAL_MS);
}

function stop() {
  if (_timer) clearInterval(_timer);
  _timer = null;
}

async function openFile(key, relPath) {
  const target = localPathFor(key, relPath);
  if (!fs.existsSync(target)) return { ok: false, error: 'الملف غير متوفر محلياً بعد.' };
  const err = await shell.openPath(target);
  return err ? { ok: false, error: err } : { ok: true };
}

/**
 * For the covers library, produce a filled copy of the DOCX with the same text
 * boxes and formatting, leaving the downloaded original untouched.
 */
function filledCopy(key, relPath, values) {
  const source = localPathFor(key, relPath);
  if (key !== 'covers' || !values || !/\.docx$/i.test(relPath)) return source;
  const buffer = fs.readFileSync(source);
  const filled = fillDocxBuffer(buffer, values);
  const target = path.join(paths().cacheRoot, key, '__filled__', relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, filled);
  return target;
}

function uniqueTarget(folder, fileName) {
  const parsed = path.parse(fileName || 'ملف');
  let target = path.join(folder, `${parsed.name}${parsed.ext || ''}`);
  let index = 1;
  while (fs.existsSync(target)) {
    target = path.join(folder, `${parsed.name} (${index})${parsed.ext || ''}`);
    index += 1;
  }
  return target;
}

async function saveAs(key, relPath, suggestedName, values, targetFolder) {
  const source = filledCopy(key, relPath, values);
  if (!fs.existsSync(source)) return { ok: false, error: 'الملف غير متوفر محلياً بعد.' };

  if (targetFolder) {
    try {
      fs.mkdirSync(targetFolder, { recursive: true });
      const filePath = uniqueTarget(targetFolder, suggestedName || path.basename(source));
      fs.copyFileSync(source, filePath);
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const result = await dialog.showSaveDialog(_mainWindow, {
    defaultPath: suggestedName || path.basename(source),
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.copyFileSync(source, result.filePath);
  return { ok: true, filePath: result.filePath };
}

async function hasPrinter() {
  try {
    const printers = await _mainWindow.webContents.getPrintersAsync();
    return printers.length > 0;
  } catch {
    return false;
  }
}

const NO_PRINTER =
  'لا توجد طابعة متصلة. تحقق من توصيل الطابعة عبر USB أو Wi-Fi ثم أعد المحاولة.';

function printWithOffice(file) {
  return new Promise((resolve) => {
    const ext = path.extname(file).toLowerCase();
    const escaped = file.replace(/'/g, "''");
    const script =
      ext === '.xlsx' || ext === '.xls'
        ? `$app = New-Object -ComObject Excel.Application; $app.Visible=$false; $wb=$app.Workbooks.Open('${escaped}'); $wb.PrintOut(); $wb.Close($false); $app.Quit()`
        : `$app = New-Object -ComObject Word.Application; $app.Visible=$false; $doc=$app.Documents.Open('${escaped}', $false, $true); $doc.PrintOut(); $doc.Close(0); $app.Quit()`;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 60000 },
      (err) => {
        if (err) {
          resolve({
            ok: false,
            error: 'تعذر إرسال الملف إلى الطابعة. تأكد من تثبيت Microsoft Word/Excel أو اطبع الملف بعد فتحه.',
          });
        } else {
          resolve({ ok: true });
        }
      }
    );
  });
}

async function printFile(key, relPath, values) {
  const source = filledCopy(key, relPath, values);
  if (!fs.existsSync(source)) return { ok: false, error: 'الملف غير متوفر محلياً بعد.' };
  if (!(await hasPrinter())) return { ok: false, error: NO_PRINTER };

  const ext = path.extname(source).toLowerCase();
  if (ext === '.docx' || ext === '.doc' || ext === '.xlsx' || ext === '.xls') {
    return printWithOffice(source);
  }

  if (ext === '.pdf' || ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true },
    });
    try {
      if (ext === '.pdf') {
        await win.loadURL(pathToFileURL(source).toString());
      } else {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(
          `<html dir="rtl"><body style="margin:0;display:flex;align-items:center;justify-content:center"><img src="${pathToFileURL(source).toString()}" style="max-width:100%;max-height:100vh"/></body></html>`
        )}`;
        await win.loadURL(dataUrl);
      }
      return await new Promise((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
          win.destroy();
          resolve(success ? { ok: true } : { ok: false, error: reason || 'تعذرت الطباعة.' });
        });
      });
    } catch (err) {
      try { win.destroy(); } catch {}
      return { ok: false, error: err.message };
    }
  }

  // Unknown type: open it so the user can print from its own application.
  const openErr = await shell.openPath(source);
  return openErr
    ? { ok: false, error: openErr }
    : { ok: true, opened: true, note: 'تم فتح الملف في تطبيقه للطباعة.' };
}

module.exports = {
  REPOS,
  start,
  stop,
  syncRepo,
  syncAll,
  publicState,
  planChanges,
  openFile,
  saveAs,
  printFile,
  hasPrinter,
  resolveLocalPath: (key, relPath) => {
    if (!REPOS[key]) throw new Error('مستودع غير معروف.');
    return localPathFor(key, relPath);
  },
};
