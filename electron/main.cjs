const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

const isDev = !app.isPackaged;

// Custom protocol that serves files from the bundled dist/ over fetch()-able
// URLs. Chromium's fetch() rejects file:// URLs, which breaks onnxruntime-web
// (Whisper) inside the packaged asar. murshid-res:// lets the renderer fetch
// the .mjs/.wasm runtime binaries it needs.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'murshid-res',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

// Keep Chromium and all native Electron surfaces in the application's light theme.
nativeTheme.themeSource = 'light';

let mainWindow;

// ── Update Manager ────────────────────────────────────────────────────
const updateManager = require('./update-manager.cjs');

// ── Application-wide Zoom ─────────────────────────────────────────────
const zoom = require('./zoom.cjs');

// ── AI service (Voice Entry: OpenCode Go API) ─────────────────────────
const aiService = require('./aiService.cjs');

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
    fullscreen: true,
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

  // Always launch in full screen mode (no title bar, no taskbar, no window
  // chrome). Re-asserted once the window is ready so the state is applied even
  // if it was lost while the window was still hidden.
  mainWindow.setFullScreen(true);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow.isDestroyed()) mainWindow.setFullScreen(true);
    mainWindow.show();
  });

  // F11 toggles full screen so the app can be left with window chrome back.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11') return;
    event.preventDefault();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });



  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // ── Serve dist/ over murshid-res:// (fetchable wasm/mjs for Whisper) ──
  const DIST_DIR = path.join(__dirname, '..', 'dist');
  protocol.handle('murshid-res', (request) => {
    try {
      const u = new URL(request.url);
      const rel = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      const filePath = path.resolve(DIST_DIR, rel);
      if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
        return new Response('Forbidden', { status: 403 });
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === '.wasm' ? 'application/wasm' :
        ext === '.mjs' || ext === '.js' ? 'text/javascript' :
        ext === '.json' ? 'application/json' :
        ext === '.css' ? 'text/css' :
        ext === '.ttf' ? 'font/ttf' :
        ext === '.png' ? 'image/png' :
        ext === '.ico' ? 'image/x-icon' :
        'application/octet-stream';
      return net.fetch(url.pathToFileURL(filePath).toString())
        .then((r) => {
          const headers = new Headers(r.headers);
          headers.set('content-type', mime);
          return new Response(r.body, { status: r.status, headers });
        })
        .catch(() => new Response('Not found', { status: 404 }));
    } catch {
      return new Response('Bad request', { status: 400 });
    }
  });

  // Allow microphone capture for the Voice Entry feature (Whisper runs in the
  // renderer, so getUserMedia must not be blocked by Electron's default policy).
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem');
  });

  // ── AI service IPC (Voice Entry) ────────────────────────────────────
  aiService.init(ipcMain);

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
  // Single pass so that already-escaped text (e.g. "&amp;#33;") is not decoded twice.
  return String(str).replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (_match, entity) => {
      const key = entity.toLowerCase();
      if (key === 'amp') return '&';
      if (key === 'lt') return '<';
      if (key === 'gt') return '>';
      if (key === 'quot') return '"';
      if (key === 'apos') return "'";
      if (key === 'nbsp') return '\u00a0';
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
      return String.fromCharCode(Number(key.slice(1)));
    }
  );
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

// ── Telegram Public Channel Preview ──────────────────────────────────────
// Reads the newest public post of a channel from Telegram's own public web
// preview (https://t.me/s/<username>). No bot token, API id or secret is used
// or stored here, and nothing about this handler is exposed to the network
// beyond that single public preview URL.
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

  // ── Anonymous Drive upload ────────────────────────────────────────
  // Uploading to the public الملفات folder needs a credential holder, and the
  // Drive REST API has no anonymous write. So uploads go through a Google Apps
  // Script web app deployed as "Execute as: Me / Who has access: Anyone" —
  // see google-apps-script/drive-upload/README.md for the one-time setup.
  // Callers never see a Google login prompt.
  //
  // The endpoint is a bearer capability: anyone with the URL can upload.
  // That is the intended behaviour. Request bodies stay under the ~50MB
  // Apps Script ceiling (base64 inflates ~33%, hence the 20MB file cap).
  const DRIVE_UPLOAD_ENDPOINT =
    process.env.MURSHID_DRIVE_UPLOAD_URL || '';
  const DRIVE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
  const DRIVE_UPLOAD_TIMEOUT_MS = 120000;
  // Extension allow-list, not a mime prefix match. A prefix check such as
  // "application/" would happily accept application/x-msdownload, and this
  // folder is world-readable — an uploaded .html/.svg/.exe served from a Google
  // domain is a phishing and stored-XSS vector for whoever opens the link.
  // Extension is the reliable signal anyway: Windows reports an empty type for
  // many document formats, which would otherwise arrive as octet-stream.
  const DRIVE_UPLOAD_ALLOWED_EXT = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx',
    'odt', 'ods', 'odp', 'rtf', 'txt',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic',
    'zip',
  ]);
  const DRIVE_UPLOAD_BLOCKED_MIME = new RegExp(
    '^(text/html|application/xhtml|image/svg|application/(x-)?javascript' +
    '|application/x-msdownload|application/x-msdos-program' +
    '|application/vnd\\.microsoft\\.portable-executable|application/x-?(sh|shellscript)' +
    '|application/x-?(executable|dosexec)|application/java-archive)$',
    'i'
  );
  const driveUploadExt = (name) => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  };

  const isDriveUploadConfigured = () =>
    typeof DRIVE_UPLOAD_ENDPOINT === 'string' &&
    /^https:\/\/script\.google(usercontent)?\.com\/macros\/s\/[^\/]+\/exec\/?$/.test(
      DRIVE_UPLOAD_ENDPOINT.trim()
    );

  ipcMain.handle('drive-public:upload-config', async () => {
    if (!isDriveUploadConfigured()) {
      return {
        ok: false,
        configured: false,
        error: 'رفع الملفات غير مُعدّ بعد. يجب نشر خدمة الرفع على Google Apps Script.',
      };
    }
    try {
      const resp = await fetch(DRIVE_UPLOAD_ENDPOINT, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.ok) {
        return { ok: false, configured: false, error: `تعذر الوصول لخدمة الرفع (${resp.status}).` };
      }
      return {
        ok: true,
        configured: true,
        maxBytes: typeof body.maxBytes === 'number' ? body.maxBytes : DRIVE_UPLOAD_MAX_BYTES,
      };
    } catch (err) {
      return { ok: false, configured: false, error: err.message };
    }
  });

  ipcMain.handle('drive-public:upload', async (_event, payload) => {
    try {
      if (!isDriveUploadConfigured()) {
        return {
          ok: false,
          error: 'رفع الملفات غير مُعدّ بعد. يجب نشر خدمة الرفع على Google Apps Script.',
        };
      }
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'بيانات الرفع غير صالحة.' };
      }

      const uploaderName = String(payload.uploaderName || '').trim();
      if (!uploaderName) {
        return { ok: false, error: 'يرجى إدخال اسم الرافع.' };
      }
      if (uploaderName.length > 80) {
        return { ok: false, error: 'اسم الرافع طويل جداً.' };
      }

      const fileName = String(payload.fileName || '').trim();
      if (!fileName || fileName.length > 200) {
        return { ok: false, error: 'اسم الملف غير صالح.' };
      }

      const mimeType = String(payload.mimeType || 'application/octet-stream');
      const ext = driveUploadExt(fileName);
      if (!DRIVE_UPLOAD_ALLOWED_EXT.has(ext)) {
        return { ok: false, error: `نوع الملف غير مدعوم${ext ? ` (.${ext})` : ''}.` };
      }
      if (DRIVE_UPLOAD_BLOCKED_MIME.test(mimeType)) {
        return { ok: false, error: `نوع الملف غير مدعوم (${mimeType}).` };
      }

      const dataBase64 = String(payload.dataBase64 || '');
      if (!dataBase64) return { ok: false, error: 'ملف فارغ.' };

      // base64 -> bytes, validated against the real decoded length.
      let bytes;
      try {
        bytes = Buffer.from(dataBase64, 'base64');
      } catch {
        return { ok: false, error: 'تعذر قراءة محتوى الملف.' };
      }
      if (bytes.length === 0) return { ok: false, error: 'الملف فارغ.' };
      if (bytes.length > DRIVE_UPLOAD_MAX_BYTES) {
        return {
          ok: false,
          error: `حجم الملف يتجاوز ${Math.floor(DRIVE_UPLOAD_MAX_BYTES / 1048576)} ميغابايت.`,
        };
      }

      const resp = await fetch(DRIVE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          mimeType,
          dataBase64,
          uploaderName,
          title: String(payload.title || ''),
          description: String(payload.description || ''),
          key: String(payload.key || ''),
        }),
        redirect: 'follow',
        signal: AbortSignal.timeout(DRIVE_UPLOAD_TIMEOUT_MS),
      });

      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.ok) {
        return {
          ok: false,
          error: body?.error
            ? `فشل الرفع: ${body.error}`
            : `فشل الرفع (${resp.status}).`,
        };
      }
      return { ok: true, id: body.id, name: body.name, size: body.size };
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
    let authWindow;
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

      // Log auth details (client_id/redirect/scopes are public; the client
      // secret is never logged).
      console.log('[Drive Auth] OAuth client type: Web Application (has client_secret)');
      console.log('[Drive Auth] redirect_uri:', redirectUri);
      console.log('[Drive Auth] scopes:', OAUTH_SCOPES);

      // Open the auth flow in a dedicated Electron window instead of the
      // system browser. Google redirects back to http://localhost:3000/
      // with ?code=... — we detect that callback here and close the window
      // automatically, so the user is never left stuck on a localhost page.
      authWindow = new BrowserWindow({
        width: 520,
        height: 680,
        autoHideMenuBar: true,
        title: 'تسجيل الدخول إلى Google',
        backgroundColor: '#ffffff',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      authWindow.setMenu(null);
      authWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

      // Wait for the callback. It is observed from BOTH the auth window's
      // navigation and the local server's request — whichever fires first
      // settles the promise, and the other path is ignored.
      const callbackPromise = new Promise((resolve, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
          finish(false, new Error('انتهت مهلة تسجيل الدخول إلى Google.'));
        }, 120000); // 2-minute timeout

        const finish = (ok, value) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          if (ok) resolve(value);
          else reject(value);
        };

        const isCallbackUrl = (navUrl) => {
          if (!navUrl) return false;
          try {
            return (url.parse(navUrl).host || '').toLowerCase() === `localhost:${OAUTH_PORT}`;
          } catch {
            return false;
          }
        };

        const handleCallbackUrl = (navUrl) => {
          if (!isCallbackUrl(navUrl)) return;
          const parsed = url.parse(navUrl, true);
          const code = parsed.query && parsed.query.code;
          const error = parsed.query && parsed.query.error;
          if (error) {
            finish(false, new Error(`رفض Google الإذن: ${error}`));
          } else if (code) {
            finish(true, code);
          }
        };

        authWindow.webContents.on('will-redirect', (_e, navUrl) => handleCallbackUrl(navUrl));
        authWindow.webContents.on('did-redirect-navigation', (_e, navUrl) => handleCallbackUrl(navUrl));
        authWindow.webContents.on('will-navigate', (_e, navUrl) => handleCallbackUrl(navUrl));
        authWindow.webContents.on('did-navigate', (_e, navUrl) => handleCallbackUrl(navUrl));
        authWindow.webContents.on('did-fail-load', (_e, errorCode) => {
          // ERR_ABORTED (-3) fires when we close the window right after a
          // successful callback — ignore it. Anything else is a real failure.
          if (errorCode === -3) return;
          finish(false, new Error('تعذر فتح صفحة تسجيل الدخول إلى Google.'));
        });

        // User closed the auth window manually → treat as cancellation.
        authWindow.on('closed', () => {
          finish(false, new Error('تم إغلاق نافذة تسجيل الدخول.'));
        });

        // Fallback: the local server also observes the callback.
        server.on('request', (req, res) => {
          const parsed = url.parse(req.url || '', true);
          const code = parsed.query && parsed.query.code;
          const error = parsed.query && parsed.query.error;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body dir="rtl"><h2>تم تسجيل الدخول بنجاح! يمكنك إغلاق هذه النافذة.</h2></body></html>');
            finish(true, code);
          } else if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body dir="rtl"><h2>خطأ في تسجيل الدخول: ${error}</h2></body></html>`);
            finish(false, new Error(`رفض Google الإذن: ${error}`));
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad request');
          }
        });
      });

      // Load the Google sign-in page. Not awaited: the callback promise
      // drives completion so we can close the window the moment Google
      // redirects back to the localhost callback.
      authWindow.loadURL(authUrl).catch(() => {});

      const authCode = await callbackPromise;

      // Successful callback — close the OAuth window automatically.
      if (authWindow && !authWindow.isDestroyed()) authWindow.destroy();
      authWindow = null;

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
      console.error('[Drive Auth] Error:', err.message);
      return { ok: false, error: err.message };
    } finally {
      if (server) try { server.close(); } catch {}
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.destroy();
        authWindow = null;
      }
      // Restore/focus the main Murshid window so the user is always
      // returned to the application after the OAuth flow ends.
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
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

/**
 * Window controls for the custom header buttons. The app starts full screen, so
 * these are the only affordances for minimizing or quitting it.
 */
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

/**
 * Read-only reader for a Telegram PUBLIC channel web page.
 *
 * Runs here in the main process, not in the renderer, so no CORS workaround,
 * no scraping in the page, and no credentials are involved — this is not the
 * Bot API. A short TTL cache absorbs repeated visibility refreshes without
 * tightening the renderer's own polling interval.
 */
const publicChannel = require('./telegram-public-channel.cjs');
const PUBLIC_CHANNEL_TTL_MS = 10000;
const publicChannelCache = new Map();

ipcMain.handle('telegram:public-channel', async (_event, username) => {
  const key = String(username || '').trim().toLowerCase();
  const cached = publicChannelCache.get(key);
  if (cached && Date.now() - cached.at < PUBLIC_CHANNEL_TTL_MS) return cached.snapshot;

  try {
    const snapshot = await publicChannel.readPublicChannel(username);
    publicChannelCache.set(key, { at: Date.now(), snapshot });
    return snapshot;
  } catch (err) {
    // Surface the reason to the renderer so it can show an honest failure
    // state instead of silently presenting an old snapshot as current.
    return { channel: key, source: null, fetchedAt: null, posts: [], error: err.message };
  }
});

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
