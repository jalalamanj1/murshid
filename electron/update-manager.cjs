const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// ── Updater hardening ────────────────────────────────────────────────
// Differential updates need the *previous* release's .blockmap to be present
// on GitHub; when it is missing or not yet available the updater 404s. Full
// downloads are far more robust for this app, so we always take the full file.
autoUpdater.disableDifferentialDownload = true;
autoUpdater.disableWebInstaller = true;
autoUpdater.autoDownload = false; // downloads are driven (and retried) below

const DOWNLOAD_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;      // grace period before the forced update
const DEFER_MS = 6 * 60 * 60 * 1000;      // do not nag again for 6 hours
const ENFORCE_INTERVAL_MS = 60 * 1000;    // deadline check
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // background re-check

let _mainWindow = null;
let _checkDone = false;
let _updateAvailable = false;
let _eventsRegistered = false;
let _downloading = false;
let _downloaded = false;
let _forcePrompt = false;
let _state = null;
let _statePath = null;
let _enforceTimer = null;

function statePath() {
  if (_statePath) return _statePath;
  try {
    _statePath = path.join(app.getPath('userData'), 'pending-update.json');
  } catch {
    _statePath = path.join(process.cwd(), 'pending-update.json');
  }
  return _statePath;
}

function loadState() {
  if (_state) return _state;
  try {
    _state = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    _state = null;
  }
  return _state;
}

function saveState() {
  if (!_state) return;
  try {
    fs.writeFileSync(statePath(), JSON.stringify(_state));
  } catch (err) {
    console.error('[Update] Could not save pending update state:', err.message);
  }
}

function clearState() {
  _state = null;
  try {
    fs.unlinkSync(statePath());
  } catch {}
}

/** True when the stored update is the version that is already running. */
function stateIsCurrent(state) {
  try {
    return Boolean(state?.version) && state.version === app.getVersion();
  } catch {
    return false;
  }
}

function deadlineOf(state) {
  return state && state.firstSeenAt ? state.firstSeenAt + DAY_MS : 0;
}

function sendUpdateAvailable(version) {
  const state = loadState();
  const deadline = deadlineOf(state);
  const dismissedUntil = state?.dismissedUntil || 0;
  const installRequested = Boolean(state?.installRequested);
  const shouldPrompt = _forcePrompt || installRequested || Date.now() >= dismissedUntil;

  if (!shouldPrompt) return;
  sendToRenderer('update:status', {
    status: _downloaded ? 'downloaded' : 'available',
    version,
    deadline,
  });
}

/**
 * Download the update, retrying on failure. GitHub occasionally serves a 404
 * for a release asset for a short while right after a release is published;
 * a few retries turn that transient error into a successful update.
 */
async function downloadWithRetry() {
  _downloading = true;
  let lastErr = null;
  try {
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        await autoUpdater.downloadUpdate();
        return true;
      } catch (err) {
        lastErr = err;
        console.error(`[Update] Download attempt ${attempt}/${DOWNLOAD_ATTEMPTS} failed: ${err.message}`);
        if (attempt < DOWNLOAD_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    throw lastErr;
  } finally {
    _downloading = false;
  }
}

function surfaceUpdateError(message) {
  _checkDone = true;
  sendToRenderer('update:error', { error: message });
}

/** Install when downloaded and either requested now or past the 24h deadline. */
function maybeInstall(force = false) {
  const state = loadState();
  if (stateIsCurrent(state)) {
    clearState();
    return false;
  }
  if (!_downloaded) return false;
  const expired = state ? Date.now() >= deadlineOf(state) : true;
  if (force || state?.installRequested || expired) {
    console.log('[Update] Installing update and restarting…');
    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        console.error('[Update] quitAndInstall failed:', err.message);
      }
    }, 400);
    return true;
  }
  return false;
}

/** Runs once a minute: forces the update when the grace period is over. */
function enforceDeadline() {
  const state = loadState();
  if (!state || !state.version) return;
  if (stateIsCurrent(state)) {
    clearState();
    return;
  }

  if (Date.now() < deadlineOf(state)) return;

  if (_downloaded) {
    maybeInstall(true);
  } else if (!_downloading) {
    // The user kept the app open past the 24h window: fetch it now so the
    // forced install can complete as soon as the download ends.
    autoUpdater.checkForUpdates().catch(() => {});
  }
}

function registerEvents() {
  if (_eventsRegistered) return;
  _eventsRegistered = true;

  autoUpdater.on('update-available', (info) => {
    _updateAvailable = true;
    _checkDone = true;
    console.log('[Update] New version available:', info.version);

    const state = loadState();
    if (!state || state.version !== info.version) {
      _state = {
        version: info.version,
        firstSeenAt: Date.now(),
        installRequested: false,
        dismissedUntil: 0,
      };
      saveState();
    }

    sendUpdateAvailable(info.version);
    downloadWithRetry().catch((err) => surfaceUpdateError(err.message));
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Update] No updates available.');
    _checkDone = true;
    clearState();
    sendToRenderer('update:status', { status: 'up-to-date' });
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Checking for updates...');
    sendToRenderer('update:status', { status: 'checking' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Update] Downloaded version', info.version);
    _downloaded = true;
    const state = loadState();
    if (state) {
      state.downloadedAt = Date.now();
      saveState();
    }
    sendToRenderer('update:status', {
      status: 'downloaded',
      version: info.version,
      deadline: deadlineOf(state),
    });
    maybeInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('[Update] Error:', err.message);
    // While downloadWithRetry is running, failures are retried there; only
    // surface an error once every attempt has been exhausted.
    if (_downloading) return;
    surfaceUpdateError(err.message);
  });
}

function sendToRenderer(channel, data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, data);
  }
}

function setWindow(win) {
  _mainWindow = win;
  loadState();
  registerEvents();
  if (!_enforceTimer) {
    _enforceTimer = setInterval(enforceDeadline, ENFORCE_INTERVAL_MS);
  }
}

function getUpdateState() {
  const state = loadState();
  if (!state || !state.version || stateIsCurrent(state)) {
    if (state) clearState();
    return { status: 'none' };
  }
  return {
    status: _downloaded ? 'downloaded' : _updateAvailable ? 'available' : 'pending',
    version: state.version,
    deadline: deadlineOf(state),
    installRequested: Boolean(state.installRequested),
    shouldPrompt:
      Boolean(state.installRequested) ||
      Date.now() >= (state.dismissedUntil || 0),
  };
}

/** Manual check from Settings: always show the prompt if an update is found. */
function checkForUpdates() {
  _forcePrompt = true;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Update] Manual check failed:', err.message);
    sendToRenderer('update:error', { error: err.message });
  });
}

/** "تحديث الآن": install as soon as the download is ready. */
function installUpdate() {
  const state = loadState();
  if (state) {
    state.installRequested = true;
    state.dismissedUntil = 0;
    saveState();
  }
  if (_downloaded) {
    maybeInstall(true);
    return;
  }
  if (!_downloading) {
    downloadWithRetry().catch((err) => surfaceUpdateError(err.message));
  }
}

/** "لاحقاً": hide the prompt, but the 24h deadline keeps running. */
function deferUpdate() {
  const state = loadState();
  if (!state) return { ok: true };
  const deadline = deadlineOf(state);
  state.dismissedUntil = Math.min(deadline, Date.now() + DEFER_MS);
  saveState();
  return { ok: true, deadline };
}

function isUpdateAvailable() {
  return _updateAvailable;
}

async function waitForCheck(timeoutMs = 15000) {
  const start = Date.now();
  while (!_checkDone && !_updateAvailable) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !_updateAvailable;
}

function startStartupCheck() {
  const state = loadState();

  // If a previous run was already past the grace period, do not wait 2 seconds.
  const expired = state ? Date.now() >= deadlineOf(state) : false;

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Update] Check failed:', err.message);
      _checkDone = true;
    });
  }, expired ? 500 : 2000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);

  if (!_enforceTimer) {
    _enforceTimer = setInterval(enforceDeadline, ENFORCE_INTERVAL_MS);
  }
}

module.exports = {
  setWindow,
  isUpdateAvailable,
  waitForCheck,
  checkForUpdates,
  installUpdate,
  deferUpdate,
  getUpdateState,
  startStartupCheck,
};
