const { autoUpdater } = require('electron-updater');
const { BrowserWindow } = require('electron');

let _mainWindow = null;
let _checkDone = false;
let _updateAvailable = false;
let _manualMode = false;
let _eventsRegistered = false;

function registerEvents() {
  if (_eventsRegistered) return;
  _eventsRegistered = true;

  autoUpdater.on('update-available', (info) => {
    _updateAvailable = true;
    console.log('[Update] New version available:', info.version);
    if (_manualMode) {
      sendToRenderer('update:status', { status: 'available', version: info.version });
      autoUpdater.downloadUpdate();
    } else {
      showForceUpdateScreen(info.version);
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Update] No updates available.');
    _checkDone = true;
    if (_manualMode) {
      sendToRenderer('update:status', { status: 'up-to-date' });
    }
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Checking for updates...');
    if (_manualMode) {
      sendToRenderer('update:status', { status: 'checking' });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    if (_manualMode) {
      sendToRenderer('update:progress', { percent: pct, bytesPerSecond: progress.bytesPerSecond, total: progress.total, transferred: progress.transferred });
    } else if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.executeJavaScript(`
        document.getElementById('update-progress').textContent = '${pct}%';
        document.getElementById('update-bar').style.width = '${pct}%';
      `).catch(() => {});
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Update] Downloaded version', info.version);
    if (_manualMode) {
      sendToRenderer('update:status', { status: 'downloaded', version: info.version });
    } else {
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[Update] Error:', err.message);
    _checkDone = true;
    if (_manualMode) {
      sendToRenderer('update:error', { error: err.message });
    } else if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.executeJavaScript(`
        document.getElementById('update-status').textContent = 'تعذر التحقق من التحديثات: ${err.message.replace(/'/g, "\\'")}';
      `).catch(() => {});
    }
  });
}

function sendToRenderer(channel, data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, data);
  }
}

function setWindow(win) {
  _mainWindow = win;
  registerEvents();
}

function checkForUpdates() {
  _manualMode = true;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Update] Manual check failed:', err.message);
    sendToRenderer('update:error', { error: err.message });
  });
}

function installUpdate() {
  autoUpdater.quitAndInstall(true, true);
}

function startStartupCheck() {
  _manualMode = false;
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Update] Check failed:', err.message);
      _checkDone = true;
    });
  }, 2000);
}

function showForceUpdateScreen(version) {
  if (!_mainWindow || _mainWindow.isDestroyed()) return;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:#0f172a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;direction:rtl}
.container{text-align:center;max-width:480px;padding:40px}
.icon{font-size:64px;margin-bottom:20px}
h1{font-size:22px;margin-bottom:8px}
p{font-size:14px;color:#94a3b8;margin-bottom:24px;line-height:1.7}
.progress-bar{width:100%;height:8px;background:#1e293b;border-radius:4px;overflow:hidden;margin-bottom:8px}
.progress-fill{height:100%;background:#3b82f6;border-radius:4px;width:0%;transition:width .3s}
.progress-text{font-size:12px;color:#64748b}
.status{font-size:11px;color:#64748b;margin-top:16px}
</style>
</head>
<body>
<div class="container">
<div class="icon">⬇️</div>
<h1>يتوفر تحديث جديد للبرنامج</h1>
<p>الإصدار ${version} متاح للتحميل. سيتم تنزيل التحديث وتثبيته تلقائياً.<br>الرجاء الانتظار حتى اكتمال العملية.</p>
<div class="progress-bar"><div id="update-bar" class="progress-fill"></div></div>
<div id="update-progress" class="progress-text">جاري التحميل...</div>
<div id="update-status" class="status"></div>
</div>
</body>
</html>`;

  _mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function isUpdateAvailable() {
  return _updateAvailable;
}

async function waitForCheck(timeoutMs = 15000) {
  const start = Date.now();
  while (!_checkDone && !_updateAvailable) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise(r => setTimeout(r, 100));
  }
  return !_updateAvailable;
}

module.exports = { setWindow, isUpdateAvailable, waitForCheck, checkForUpdates, installUpdate, startStartupCheck };
