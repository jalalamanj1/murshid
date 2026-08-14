/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Murshid backend API routes.
 *
 *   مخاطبات التربية (letters)  -> READ ONLY
 *   ملفات (files)              -> READ + UPLOAD + OWN-UPLOAD DELETE (within 1 hour)
 *
 * All folder mutations require an authenticated Murshid user (JWT) and the
 * shared API key. All rule enforcement happens HERE, server-side.
 */

const express = require('express');
const multer = require('multer');
const { hmacSign, hmacVerify } = require('./crypto.cjs');

const ONE_HOUR_MS = 60 * 60 * 1000;

function isWithinDeleteWindow(uploadedAt, now = Date.now()) {
  if (!uploadedAt) return false;
  const t = new Date(uploadedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= ONE_HOUR_MS;
}

function createRouter({ config, adapter, users, jwt }) {
  const router = express.Router();

  // ── Shared API key ────────────────────────────────────────────────
  router.use((req, res, next) => {
    if (!config.apiKey) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Backend is not configured with an API key.' });
      }
      return next(); // dev/mock only
    }
    const key = req.get('x-murshid-api-key');
    if (!key || key !== config.apiKey) {
      return res.status(401).json({ error: 'Invalid or missing API key.' });
    }
    next();
  });

  // ── Auth helpers ──────────────────────────────────────────────────
  function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(config, token);
    if (!payload) return res.status(401).json({ error: 'جلسة غير صالحة. يرجى إعادة تسجيل الدخول.' });
    const user = users.getUserById(config.dataDir, payload.sub);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود.' });
    req.user = user;
    next();
  }

  function folderIdFor(key) {
    if (key === 'letters') return config.folders.letters;
    if (key === 'files') return config.folders.files;
    return null;
  }

  function folderKeyForFile(file) {
    if (file.parents && file.parents.includes(config.folders.letters)) return 'letters';
    if (file.parents && file.parents.includes(config.folders.files)) return 'files';
    return null;
  }

  function toFileDto(raw, user) {
    const ap = raw.appProperties || {};
    const isUpload = !!ap.murshidUploaderId;
    const uploadedAt = ap.murshidUploadedAt || null;
    const own = isUpload && ap.murshidUploaderId === user.userId;
    const withinWindow = own && isWithinDeleteWindow(uploadedAt);
    return {
      id: raw.id,
      name: raw.name,
      mimeType: raw.mimeType,
      size: raw.size || 0,
      createdTime: raw.createdTime || null,
      modifiedTime: raw.modifiedTime || null,
      isFolder: raw.isFolder || false,
      isUpload,
      uploaderId: isUpload ? ap.murshidUploaderId : undefined,
      uploaderName: isUpload ? ap.murshidUploaderName : undefined,
      uploadedAt,
      canDelete: withinWindow,
    };
  }

  // ── Register a Murshid device/user ────────────────────────────────
  router.post('/register', (req, res) => {
    const { hwid, deviceId, name, schoolName, province } = req.body || {};
    if (!hwid && !deviceId) {
      return res.status(400).json({ error: 'معرف الجهاز مطلوب.' });
    }
    const { user, created } = users.getOrCreateUser(config.dataDir, {
      hwid,
      deviceId,
      name: name || '',
      schoolName: schoolName || '',
      province: province || '',
    });
    const token = jwt.sign(config, user);
    res.status(created ? 201 : 200).json({
      ok: true,
      created,
      token,
      user: { userId: user.userId, name: user.name, schoolName: user.schoolName, province: user.province },
    });
  });

  // ── Authenticated status ──────────────────────────────────────────
  router.get('/status', requireAuth, (req, res) => {
    res.json({ ok: true, user: { userId: req.user.userId, name: req.user.name, schoolName: req.user.schoolName, province: req.user.province } });
  });

  // ── List folder contents (paginated) ──────────────────────────────
  router.get('/folders/:folderKey', requireAuth, async (req, res, next) => {
    try {
      const folderId = folderIdFor(req.params.folderKey);
      if (!folderId) return res.status(404).json({ error: 'مجلد غير معروف.' });
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10) || 50, 1), 100);
      const pageToken = req.query.pageToken || null;
      const { files, nextPageToken } = await adapter.listFolder(folderId, { pageToken, pageSize });
      res.json({
        ok: true,
        folderKey: req.params.folderKey,
        files: files.map((f) => toFileDto(f, req.user)),
        nextPageToken,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── File metadata ─────────────────────────────────────────────────
  router.get('/files/:id/meta', requireAuth, async (req, res, next) => {
    try {
      const raw = await adapter.getFile(req.params.id);
      if (!folderKeyForFile(raw)) return res.status(403).json({ error: 'الملف ليس ضمن مجلدات مرشد.' });
      res.json({ ok: true, file: toFileDto(raw, req.user) });
    } catch (err) {
      next(err);
    }
  });

  // ── File content (preview / download) ─────────────────────────────
  router.get('/files/:id/content', requireAuth, async (req, res, next) => {
    try {
      const raw = await adapter.getFile(req.params.id);
      if (!folderKeyForFile(raw)) return res.status(403).json({ error: 'الملف ليس ضمن مجلدات مرشد.' });
      const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline';
      const exportPdf = req.query.preview === '1';
      const { buffer, mimeType, name } = await adapter.readContent(req.params.id, { exportPdf });
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  // ── Upload (files folder only) ────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes },
  });

  router.post('/folders/files/upload', requireAuth, upload.single('file'), async (req, res, next) => {
    try {
      const folderId = config.folders.files;
      const title = String(req.body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'العنوان مطلوب.' });
      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ error: 'الملف المرفوع فارغ أو غير صالح.' });
      }
      const description = String(req.body.description || '').trim();
      const originalName = req.file.originalname || 'ملف';
      const uploadedAt = new Date().toISOString();
      const appProperties = {
        murshidUploaderId: req.user.userId,
        murshidUploaderName: req.user.name,
        murshidUploadedAt: uploadedAt,
        murshidOriginalName: originalName,
      };
      const uploaded = await adapter.uploadFile({
        folderId,
        name: originalName,
        mimeType: req.file.mimetype || 'application/octet-stream',
        buffer: req.file.buffer,
        appProperties,
      });
      const meta = {
        uploaderId: req.user.userId,
        uploaderName: req.user.name,
        uploadedAt,
        title,
        description,
        originalName,
        folderKey: 'files',
      };
      require('./meta.cjs').setMeta(config.dataDir, uploaded.id, meta);
      res.status(201).json({ ok: true, file: toFileDto(uploaded, req.user) });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف يتجاوز الحد المسموح.' : `خطأ في الرفع: ${err.message}`;
        return res.status(400).json({ error: msg });
      }
      next(err);
    }
  });

  // ── Delete own upload within one hour (files folder only) ─────────
  router.delete('/files/:id', requireAuth, async (req, res, next) => {
    try {
      const raw = await adapter.getFile(req.params.id);
      const folderKey = folderKeyForFile(raw);
      if (folderKey !== 'files') {
        return res.status(403).json({ error: 'لا يمكن حذف الملفات من هذا المجلد.' });
      }
      const ap = raw.appProperties || {};
      const uploaderId = ap.murshidUploaderId;
      if (!uploaderId) {
        return res.status(403).json({ error: 'لا يمكن حذف ملفات الجهة المالكة أو الإدارة.' });
      }
      if (uploaderId !== req.user.userId) {
        return res.status(403).json({ error: 'يمكنك حذف ملفاتك أنت فقط.' });
      }
      if (!isWithinDeleteWindow(ap.murshidUploadedAt)) {
        return res.status(409).json({ error: 'انتهت مهلة الحذف (ساعة واحدة من الرفع).' });
      }
      await adapter.deleteFile(req.params.id);
      require('./meta.cjs').deleteMeta(config.dataDir, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Share: issue a time-limited controlled access link ────────────
  router.post('/files/:id/share', requireAuth, async (req, res, next) => {
    try {
      const raw = await adapter.getFile(req.params.id);
      if (!folderKeyForFile(raw)) return res.status(403).json({ error: 'الملف ليس ضمن مجلدات مرشد.' });
      const secret = jwt.getSecret(config);
      const exp = Date.now() + config.shareTtlMs;
      const sig = hmacSign(secret, `${req.params.id}:${exp}`);
      const url = `${config.baseUrl}/api/v1/public/${req.params.id}?sig=${sig}&exp=${exp}`;
      res.json({ ok: true, url });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createRouter, isWithinDeleteWindow };
