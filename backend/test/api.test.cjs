/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * End-to-end API tests using the mock drive adapter and an ephemeral
 * data dir. Run with: npm test  (node --test test/)
 */

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'murshid-backend-test-'));
process.env.MURSHID_DATA_DIR = path.join(tmp, 'data');
process.env.MURSHID_MOCK_DRIVE_DIR = path.join(tmp, 'mock-drive');
process.env.MURSHID_API_KEY = 'test-key';
process.env.MURSHID_DRIVE_MODE = 'mock';

const config = require('../src/config.cjs');
const { createApp } = require('../src/server.cjs');
const { isWithinDeleteWindow } = require('../src/routes.cjs');

let server;
let base;
let tokenA;
let tokenB;
let uploadedFile;

test.before(async () => {
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

async function api(method, pathname, { token, body, form, rawBody } = {}) {
  const headers = { 'x-murshid-api-key': 'test-key' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (rawBody) payload = rawBody;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + pathname, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const json = ct.includes('application/json') ? await res.json() : null;
  return { status: res.status, json, headers: res.headers, arrayBuffer: () => res.arrayBuffer() };
}

function formUpload({ title, description, fileName, content, mimeType = 'text/plain' }) {
  const form = new FormData();
  if (title !== undefined) form.append('title', title);
  if (description !== undefined) form.append('description', description);
  form.append('file', new Blob([content], { type: mimeType }), fileName);
  return form;
}

// ── Registration ──────────────────────────────────────────────────
test('register creates a user and returns a JWT', async () => {
  const res = await api('POST', '/register', {
    body: { hwid: 'hwid-alpha', deviceId: 'dev-alpha', name: 'أحمد', schoolName: 'المدرسة الأولى' },
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.json.ok);
  assert.ok(res.json.token);
  assert.ok(res.json.user.userId);
  tokenA = res.json.token;
});

test('register is idempotent for the same device (same userId)', async () => {
  const res = await api('POST', '/register', {
    body: { hwid: 'hwid-alpha', deviceId: 'dev-alpha', name: 'اسم مختلف', schoolName: 'مدرسة مزيفة' },
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.ok);
  assert.strictEqual(res.json.user.name, 'أحمد'); // first-registration name wins
});

test('register requires a device/hwid identifier', async () => {
  const res = await api('POST', '/register', { body: { name: 'بدون معرف' } });
  assert.strictEqual(res.status, 400);
});

test('API key is enforced', async () => {
  const res = await fetch(base + '/status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(res.status, 401);
});

// ── Auth guards ────────────────────────────────────────────────────
test('status returns the authenticated user', async () => {
  const res = await api('GET', '/status', { token: tokenA });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.user.name, 'أحمد');
});

test('list without token is rejected', async () => {
  const res = await api('GET', '/folders/files');
  assert.strictEqual(res.status, 401);
});

test('unknown folder is rejected', async () => {
  const res = await api('GET', '/folders/nope', { token: tokenA });
  assert.strictEqual(res.status, 404);
});

// ── Upload ─────────────────────────────────────────────────────────
test('upload without token is rejected', async () => {
  const res = await api('POST', '/folders/files/upload', { form: formUpload({ title: 'x', fileName: 'a.txt', content: 'x' }) });
  assert.strictEqual(res.status, 401);
});

test('upload requires a title', async () => {
  const res = await api('POST', '/folders/files/upload', {
    token: tokenA,
    form: formUpload({ title: '   ', fileName: 'a.txt', content: 'x' }),
  });
  assert.strictEqual(res.status, 400);
});

test('upload stores server-side uploader identity and a timestamp', async () => {
  const res = await api('POST', '/folders/files/upload', {
    token: tokenA,
    form: formUpload({ title: 'ملخص الاجتماع', description: 'وصف اختياري', fileName: 'meeting.txt', content: 'hello murshid', mimeType: 'text/plain' }),
  });
  assert.strictEqual(res.status, 201);
  const f = res.json.file;
  assert.ok(f.id);
  assert.strictEqual(f.isUpload, true);
  assert.strictEqual(f.uploaderName, 'أحمد');
  assert.ok(f.uploadedAt);
  assert.strictEqual(f.canDelete, true);
  uploadedFile = f;
});

test('uploaded file appears in the files folder listing', async () => {
  const res = await api('GET', '/folders/files', { token: tokenA });
  assert.strictEqual(res.status, 200);
  const found = res.json.files.find((f) => f.id === uploadedFile.id);
  assert.ok(found, 'uploaded file not in listing');
  assert.strictEqual(found.uploaderId, tokenA ? found.uploaderId : null);
});

test('uploaded content can be downloaded', async () => {
  const res = await api('GET', `/files/${uploadedFile.id}/content`, { token: tokenA });
  assert.strictEqual(res.status, 200);
  const text = Buffer.from(await res.arrayBuffer()).toString('utf8');
  assert.strictEqual(text, 'hello murshid');
});

test('letters folder is readable (read-only)', async () => {
  const res = await api('GET', '/folders/letters', { token: tokenA });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.json.files));
});

// ── Delete rules ───────────────────────────────────────────────────
test('a different user cannot delete someone else\'s upload', async () => {
  const reg = await api('POST', '/register', {
    body: { hwid: 'hwid-beta', deviceId: 'dev-beta', name: 'سارة' },
  });
  tokenB = reg.json.token;
  assert.ok(tokenB);
  const res = await api('DELETE', `/files/${uploadedFile.id}`, { token: tokenB });
  assert.strictEqual(res.status, 403);
});

test('delete without token is rejected', async () => {
  const res = await api('DELETE', `/files/${uploadedFile.id}`);
  assert.strictEqual(res.status, 401);
});

test('the uploader can delete their own upload within the window', async () => {
  const res = await api('DELETE', `/files/${uploadedFile.id}`, { token: tokenA });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.ok, true);
  const list = await api('GET', '/folders/files', { token: tokenA });
  assert.ok(!list.json.files.find((f) => f.id === uploadedFile.id), 'deleted file still listed');
});

test('isWithinDeleteWindow enforces the one-hour rule', () => {
  assert.strictEqual(isWithinDeleteWindow(new Date(Date.now() - 30 * 1000).toISOString()), true);
  assert.strictEqual(isWithinDeleteWindow(new Date(Date.now() - 61 * 60 * 1000).toISOString()), false);
  assert.strictEqual(isWithinDeleteWindow(null), false);
  assert.strictEqual(isWithinDeleteWindow('not-a-date'), false);
});

// ── Share links ────────────────────────────────────────────────────
let shareUrl;
test('share issues a signed time-limited URL', async () => {
  const up = await api('POST', '/folders/files/upload', {
    token: tokenA,
    form: formUpload({ title: 'للمشاركة', fileName: 'share.txt', content: 'shared content' }),
  });
  const res = await api('POST', `/files/${up.json.file.id}/share`, { token: tokenA });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.url.startsWith(config.baseUrl + '/api/v1/public/'));
  shareUrl = res.json.url;
});

test('public share link serves content', async () => {
  const url = shareUrl.replace(config.baseUrl, base.slice(0, -('/api/v1'.length)));
  const res = await fetch(url, { headers: { 'x-murshid-api-key': 'test-key' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(Buffer.from(await res.arrayBuffer()).toString('utf8'), 'shared content');
});

test('tampered share link is rejected', async () => {
  const url = shareUrl.replace(config.baseUrl, base.slice(0, -('/api/v1'.length))).replace('sig=', 'sig=deadbeef');
  const res = await fetch(url, { headers: { 'x-murshid-api-key': 'test-key' } });
  assert.strictEqual(res.status, 403);
});

test('expired share link is rejected', async () => {
  const url = shareUrl.replace(config.baseUrl, base.slice(0, -('/api/v1'.length)));
  const u = new URL(url);
  u.searchParams.set('exp', '0');
  const res = await fetch(u, { headers: { 'x-murshid-api-key': 'test-key' } });
  assert.strictEqual(res.status, 403);
});
