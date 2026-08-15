const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

const isDev = !app.isPackaged;

// Keep Chromium and all native Electron surfaces in the application's light theme.
nativeTheme.themeSource = 'light';

let mainWindow;

// ── Update Manager ────────────────────────────────────────────────────
const updateManager = require('./update-manager.cjs');

// ── Application-wide Zoom ─────────────────────────────────────────────
const zoom = require('./zoom.cjs');

// ── Integrity Check ───────────────────────────────────────────────────
const { verifyIntegrity, isBanned, banDevice, getHwid } = require('./integrity.cjs');

/**
 * Show a blocking "Banned / Tampered" screen and exit.
 */
function showBlockScreen(reason) {
  const win = new BrowserWindow({
    width: 600, height: 400,
    resizable: false, closable: false,
    frame: true, title: 'مرشد - خطأ',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.setMenu(null);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;background:#0f172a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;direction:rtl}
.container{text-align:center;max-width:420px}
.icon{font-size:64px;margin-bottom:16px}
h1{font-size:20px;margin-bottom:8px}
p{font-size:13px;color:#94a3b8;margin-bottom:20px;line-height:1.7}
.error-box{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;font-size:11px;color:#f87171;margin-bottom:16px;text-align:right}
.hwid{font-size:9px;color:#475569;word-break:break-all}
</style></head>
<body>
<div class="container">
<div class="icon">🚫</div>
<h1>تم حظر هذا الجهاز</h1>
<div class="error-box">${reason}</div>
<p>للاستفسار، يرجى الاتصال بالدعم الفني:<br><bdi dir="ltr">0770 075 8915</bdi></p>
<div class="hwid">HWID: ${getHwid()}</div>
</div></body></html>`)}`);
  win.on('closed', () => app.quit());
  // Prevent any navigation away
  win.on('will-navigate', (e) => e.preventDefault());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'مرشد - المرشد التربوي العراقي',
    icon: path.join(__dirname, '..', 'public', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    backgroundColor: '#0B0E15',
    show: false,
  });

  const loadDist = process.env.ELECTRON_LOAD_DIST === '1' || process.argv.includes('--dist');
  if (isDev && !loadDist) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Application-wide zoom (Ctrl+Plus/Minus/0 and Ctrl+wheel)
  zoom.install(mainWindow);

  // Always launch in fullscreen (maximized) mode.
  mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });



  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // ── Integrity Check ────────────────────────────────────────────
  const userDataPath = app.getPath('userData');
  const integrityResult = await verifyIntegrity(userDataPath);
  if (!integrityResult.valid) {
    showBlockScreen(integrityResult.error || 'تم اكتشاف تلاعب بملفات البرنامج.');
    return;
  }

  // ── Update Check (production only) ─────────────────────────────
  if (!isDev) {
    try {
      const updateWin = new BrowserWindow({
        width: 500, height: 350, show: false, resizable: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      mainWindow = updateWin;
      updateManager.setWindow(updateWin);
      updateManager.startStartupCheck();
      const shouldContinue = await updateManager.waitForCheck(20000);
      if (!shouldContinue) return;
      if (!updateWin.isDestroyed()) updateWin.close();
    } catch (err) {
      console.error('[Startup] Update error:', err.message);
    }
  }

  // Initialize template registry
  const { templateRegistry } = require('./template-registry.cjs');
  const regResult = templateRegistry.initialize();
  if (regResult.missing.length > 0) {
    console.log('[Registry] Templates missing:', regResult.missing.join(', '));
  }
  console.log(`[Registry] ${regResult.loaded} templates loaded`);

  createWindow();
  updateManager.setWindow(mainWindow);

  // ── Record Cover Service IPC ───────────────────────────────────────────
  const { RecordCoverService } = require('./RecordCoverService.cjs');
  const coverService = new RecordCoverService();

  ipcMain.handle('cover:list-models', async () => {
    try {
      return { ok: true, models: coverService.listModels() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('cover:get-preview', async (_event, modelId) => {
    try {
      const previewPath = coverService.getPreviewPath(modelId);
      if (!previewPath) return { ok: false, error: 'لا توجد صورة معاينة لهذا النموذج.' };
      const buf = fs.readFileSync(previewPath);
      const ext = path.extname(previewPath).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return { ok: true, base64: buf.toString('base64'), mime };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('cover:generate', async (_event, modelId, title) => {
    try {
      let school_name = '', academic_year = '', counselor_name = '', counselorGender = '';
      try {
        const raw = await mainWindow.webContents.executeJavaScript(
          'localStorage.getItem("murshid_profile")'
        );
        if (raw) {
          const prof = JSON.parse(raw);
          school_name = prof.schoolName || '';
          const rawYear = prof.academicYear || '';
          const parts = rawYear.split('-');
          academic_year = parts.length === 2 ? parts.reverse().join('-') : rawYear;
          counselor_name = prof.fullName || '';
          counselorGender = prof.counselorGender || '';
        }
      } catch {}

      const title = counselorGender === 'FEMALE'
        ? 'المرشدة التربوية'
        : counselorGender === 'MALE'
          ? 'المرشد التربوي'
          : 'نموذج';
      const values = { school_name, academic_year, title, counselor_name };

      const fillResult = await coverService.fillCover(modelId, values);
      if (!fillResult.ok) return { ok: false, error: fillResult.error };

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `نموذج.docx`,
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      fs.writeFileSync(filePath, fillResult.buffer);
      return { ok: true, docxPath: filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });



});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: Save file dialog
ipcMain.handle('dialog:save', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result;
});

// IPC: Open file dialog
ipcMain.handle('dialog:open', async (_event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result;
});

// IPC: Pick folder dialog
ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result;
});

// ── Local Backup IPC ─────────────────────────────────────────────────
// The default local backup folder is "Murshid Backups" on the Desktop.
// The renderer builds the encrypted ZIP (JSZip + Web Crypto) and sends
// it here as base64; the main process owns all filesystem writes.
ipcMain.handle('backup:get-default-folder', async () => {
  try {
    return { ok: true, folder: path.join(app.getPath('desktop'), 'Murshid Backups') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('backup:write-local', async (_event, folderPath, fileName, base64) => {
  try {
    if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
      return { ok: false, error: 'مسار مجلد النسخ الاحتياطي غير صالح.' };
    }
    if (!fileName || typeof fileName !== 'string' || !base64 || typeof base64 !== 'string') {
      return { ok: false, error: 'بيانات النسخة الاحتياطية غير صالحة.' };
    }
    const safeName = path.basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_') || 'backup.zip';
    fs.mkdirSync(folderPath, { recursive: true });
    if (fs.existsSync(folderPath) && !fs.statSync(folderPath).isDirectory()) {
      return { ok: false, error: 'المسار المحدد ليس مجلداً.' };
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) return { ok: false, error: 'الملف المحفوظ فارغ.' };

    // No accidental overwrite: if the target exists, pick a unique name.
    let filePath = path.join(folderPath, safeName);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      const ext = path.extname(safeName);
      const stem = safeName.slice(0, -ext.length || safeName.length);
      filePath = path.join(folderPath, `${stem} (${counter})${ext}`);
      counter += 1;
    }

    // Atomic write: temp file in the same directory, then rename.
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, filePath);
    return { ok: true, filePath, size: buffer.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Public Google Drive Folders ──────────────────────────────────────
// The مخاطبات التربية and ملفات folders are PUBLIC folders owned by the
// app owner. Their contents are read without any user login via Google's
// public "embedded folder view" page (works for folders shared with
// "anyone with the link"). No OAuth, no backend, no access to the user's
// own Drive. This is completely separate from Google Login / Online
// Backup (drive:auth above).

function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseEmbeddedFolderView(html) {
  const files = [];
  const blocks = String(html).split('<div class="flip-entry"').slice(1);
  for (const block of blocks) {
    const idMatch = block.match(/id="entry-([^"]+)"/);
    if (!idMatch) continue;
    const mimeMatch = block.match(/drive-thirdparty\.googleusercontent\.com\/16\/type\/([^"]+)/);
    const titleMatch = block.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/);
    const modMatch = block.match(/flip-entry-last-modified"><div>([\s\S]*?)<\/div>/);
    const thumbMatch = block.match(/flip-entry-thumb"><img src="([^"]+)"/);
    files.push({
      id: idMatch[1],
      name: decodeHtmlEntities(titleMatch ? titleMatch[1] : ''),
      mimeType: mimeMatch ? mimeMatch[1] : '',
      thumbnail: thumbMatch ? thumbMatch[1] : '',
      modified: modMatch ? modMatch[1].trim() : '',
    });
  }
  return files;
}

ipcMain.handle('drive-public:list', async (_event, folderId) => {
  try {
    if (!folderId || typeof folderId !== 'string') {
      return { ok: false, error: 'معرّف المجلد غير صالح.' };
    }
    const resp = await fetch(
      `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`,
      { redirect: 'follow' }
    );
    if (!resp.ok) return { ok: false, error: `فشل جلب المجلد العام (${resp.status}).` };
    const html = await resp.text();
    const files = parseEmbeddedFolderView(html);
    if (files.length === 0 && /need access|access denied|you need permission/i.test(html)) {
      return { ok: false, error: 'هذا المجلد غير متاح كمجموعة عامة (تحقق من إعدادات المشاركة).' };
    }
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('drive-public:download', async (_event, fileId, fileName, folderPath) => {
  try {
    if (!fileId || typeof fileId !== 'string') {
      return { ok: false, error: 'معرّف الملف غير صالح.' };
    }
    const resp = await fetch(
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`,
      { redirect: 'follow' }
    );
    if (!resp.ok) return { ok: false, error: `فشل تنزيل الملف (${resp.status}).` };
    const ctype = resp.headers.get('content-type') || '';
    if (ctype.startsWith('text/html')) {
      return { ok: false, needsBrowser: true };
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length === 0) return { ok: false, error: 'الملف المحمَّل فارغ.' };
    const safeName = path.basename(fileName || 'file').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_') || 'file';
    const dir = (folderPath && typeof folderPath === 'string' && folderPath.trim())
      ? folderPath.trim()
      : app.getPath('downloads');
    fs.mkdirSync(dir, { recursive: true });
    let filePath = path.join(dir, safeName);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      const ext = path.extname(safeName);
      const stem = safeName.slice(0, -ext.length || safeName.length);
      filePath = path.join(dir, `${stem} (${counter})${ext}`);
      counter += 1;
    }
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, filePath);
    return { ok: true, filePath, size: buffer.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: Open external URL
ipcMain.handle('shell:openExternal', async (_event, url) => {
  await shell.openExternal(url);
});

// ── Voice Service IPC ──────────────────────────────────────────────

// ── Template Manager IPC ─────────────────────────────────────────────
const { templateManager } = require('./template-manager.cjs');

ipcMain.handle('template:list', async () => {
  return { ok: true, templates: templateManager.listTemplates() };
});

ipcMain.handle('template:load', async (_event, recordType) => {
  const template = templateManager.loadTemplate(recordType);
  if (!template) return { ok: false, error: `Template not found for ${recordType}.` };
  return { ok: true, template: { recordType: template.recordType, fileName: template.fileName, size: template.buffer.length } };
});

ipcMain.handle('template:generate', async (_event, recordType, values) => {
  try {
    const result = templateManager.generate(recordType, values || {});
    if (!result) return { ok: false, error: `Template not found for ${recordType}.` };
    return { ok: true, buffer: result.buffer.toString('base64'), fileName: result.fileName };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('template:validate', async (_event, recordType) => {
  const validation = templateManager.validate(recordType);
  return { ok: true, ...validation };
});

// ── Export Service IPC ───────────────────────────────────────────────
const { exportService } = require('./ExportService.cjs');

  ipcMain.handle('export:docx', async (_event, recordType, records) => {
    try {
      const result = await exportService.exportDocx(recordType, records);
      if (!result) return { ok: false, error: 'No records to export or template not found.' };
      return { ok: true, buffer: result.buffer.toString('base64'), fileName: result.fileName };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('export:special-docx', async (_event, category, record) => {
    try {
      const result = await exportService.exportSpecialCaseDocx(category, record);
      if (!result) return { ok: false, error: 'No records to export or template not found.' };
      return { ok: true, buffer: result.buffer.toString('base64'), fileName: result.fileName };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Save an arbitrary file (base64 buffer) chosen by the user via a save dialog.
  ipcMain.handle('export:save-file', async (_event, fileName, base64) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Google Drive OAuth ─────────────────────────────────────────────
  // Uses a local HTTP server to handle the OAuth redirect, since Google
  // rejects file:// redirect URIs. The redirect URI must be registered in
  // Google Cloud Console for this OAuth client (http://localhost:3000).
  // Requested scopes are the MINIMUM set: user identity (openid + email +
  // profile) and drive.file (create/manage Murshid's own backup files only).
  // No broad Drive access, no Sheets, no other Google services.
  const CLIENT_ID = '580475588026-196m9aepjuhh325nkaffdchrlqnqb5ul.apps.googleusercontent.com';
  const CLIENT_SECRET = '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';
  const OAUTH_PORT = 3000;
  const OAUTH_REDIRECT = `http://localhost:${OAUTH_PORT}`;
  const OAUTH_SCOPES = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';

  ipcMain.handle('drive:auth', async () => {
    let server;
    try {
      // Start a temporary HTTP server to catch the OAuth redirect.
      // The port is deterministic (3000) because the redirect URI must
      // match exactly what is registered for this OAuth client in Google
      // Cloud Console. A random fallback port would produce a
      // redirect_uri_mismatch error for a Web Application client.
      server = await new Promise((resolve, reject) => {
        const s = http.createServer();
        s.on('error', (err) => reject(err));
        s.listen(OAUTH_PORT, 'localhost', () => resolve(s));
      });
      const redirectUri = OAUTH_REDIRECT;

      // Build the authorization URL
      const authParams = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

      // Log auth details
      console.log('[Drive Auth] OAuth client type: Web Application (has client_secret)');
      console.log('[Drive Auth] client_id:', CLIENT_ID);
      console.log('[Drive Auth] redirect_uri:', redirectUri);
      console.log('[Drive Auth] scopes:', OAUTH_SCOPES);
      console.log('[Drive Auth] authorization URL:', authUrl);

      // Open the auth URL in the default browser
      await shell.openExternal(authUrl);

      // Wait for the callback on the local server
      const authCode = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          server.close();
          reject(new Error('انتهت مهلة تسجيل الدخول إلى Google.'));
        }, 120000); // 2-minute timeout

        server.on('request', (req, res) => {
          const parsed = url.parse(req.url || '', true);
          const code = parsed.query?.code;
          const error = parsed.query?.error;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body dir="rtl"><h2>تم تسجيل الدخول بنجاح! يمكنك إغلاق هذه النافذة.</h2></body></html>');
            clearTimeout(timeout);
            resolve(code);
          } else if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body dir="rtl"><h2>خطأ في تسجيل الدخول: ${error}</h2></body></html>`);
            clearTimeout(timeout);
            reject(new Error(`رفض Google الإذن: ${error}`));
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad request');
          }
        });
      });

      // Close the server
      server.close();

      // Exchange the auth code for tokens
      console.log('[Drive Auth] Exchanging code for tokens...');
      const tokenParams = new URLSearchParams({
        code: authCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        console.error('[Drive Auth] Token exchange failed:', tokenResp.status, JSON.stringify(tokenData));
        return { ok: false, error: `فشل الحصول على رمز الدخول: ${tokenData.error_description || tokenData.error || tokenResp.status}` };
      }

      console.log('[Drive Auth] Token exchange succeeded');

      // Get user info
      let email = '', name = '';
      try {
        const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userResp.ok) {
          const userInfo = await userResp.json();
          email = userInfo.email || '';
          name = userInfo.name || '';
        }
      } catch {}

      return {
        ok: true,
        tokens: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          expires_in: tokenData.expires_in || 3600,
          email,
          name,
        },
      };
    } catch (err) {
      if (server) try { server.close(); } catch {}
      console.error('[Drive Auth] Error:', err.message);
      return { ok: false, error: err.message };
    }
  });
// ── Update IPC ────────────────────────────────────────────────────
ipcMain.handle('update:check', async () => {
  try {
    updateManager.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('update:install', async () => {
  try {
    updateManager.installUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:version', () => app.getVersion());

const sessionManager = require('./session-manager.cjs');

ipcMain.handle('session:create', async (_event, title) => {
  try {
    return { ok: true, session: sessionManager.createSession(title) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('session:delete', async (_event, id) => {
  try {
    const deleted = sessionManager.deleteSession(id);
    return { ok: true, deleted };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('session:rename', async (_event, id, title) => {
  try {
    const session = sessionManager.renameSession(id, title);
    if (!session) return { ok: false, error: 'Session not found.' };
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('session:get', async (_event, id) => {
  try {
    const session = sessionManager.getSession(id);
    if (!session) return { ok: false, error: 'Session not found.' };
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('session:list', async () => {
  try {
    const sessions = sessionManager.listSessions();
    return { ok: true, sessions };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('session:append', async (_event, sessionId, role, content) => {
  try {
    const msg = sessionManager.appendMessage(sessionId, role, content);
    if (!msg) return { ok: false, error: 'Session not found.' };
    return { ok: true, message: msg };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
