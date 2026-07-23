/**
 * Session Manager — AI chat session persistence.
 *
 * Each session has:
 *   id, title, createdAt, updatedAt, messages[]
 *
 * Each message has:
 *   role (user|assistant), content, timestamp
 *
 * Sessions are persisted as a single JSON file on disk.
 * Auto-saves after every mutation.
 * Loads automatically when the module is first used.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────

function generateId() {
  return crypto.randomUUID();
}

function timestamp() {
  return new Date().toISOString();
}

// ── Storage ──────────────────────────────────────────────────────────

function getDataDir() {
  // In packaged mode, use Electron's userData directory.
  // In dev mode, use a data/ folder next to the electron/ directory.
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'murshid-sessions');
  } catch {
    // Fallback for testing without Electron
    return path.join(__dirname, '..', 'data', 'sessions');
  }
}

function getFilePath() {
  return path.join(getDataDir(), 'ai-sessions.json');
}

let cachedSessions = null;

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadFromDisk() {
  if (cachedSessions) return cachedSessions;
  const filePath = getFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedSessions = parsed.sessions || [];
      return cachedSessions;
    }
  } catch (err) {
    console.error('[Sessions] Failed to load:', err.message);
  }
  cachedSessions = [];
  return cachedSessions;
}

function saveToDisk(sessions) {
  ensureDataDir();
  const filePath = getFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify({ sessions }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Sessions] Failed to save:', err.message);
  }
}

function touchSave(sessions) {
  cachedSessions = sessions;
  saveToDisk(sessions);
}

// ── CRUD ─────────────────────────────────────────────────────────────

function createSession(title) {
  const sessions = loadFromDisk();
  const now = timestamp();
  const session = {
    id: generateId(),
    title: title || 'جلسة جديدة',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions.unshift(session);
  touchSave(sessions);
  return session;
}

function deleteSession(id) {
  const sessions = loadFromDisk();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return false;
  sessions.splice(idx, 1);
  touchSave(sessions);
  return true;
}

function renameSession(id, newTitle) {
  const sessions = loadFromDisk();
  const session = sessions.find(s => s.id === id);
  if (!session) return null;
  session.title = newTitle;
  session.updatedAt = timestamp();
  touchSave(sessions);
  return session;
}

function getSession(id) {
  const sessions = loadFromDisk();
  return sessions.find(s => s.id === id) || null;
}

function listSessions() {
  const sessions = loadFromDisk();
  // Return metadata only (no message bodies) for listing efficiency
  return sessions.map(s => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messages.length,
    lastMessage: s.messages.length > 0 ? s.messages[s.messages.length - 1].content.slice(0, 80) : '',
  }));
}

function appendMessage(sessionId, role, content) {
  if (!role || !content) throw new Error('role and content are required.');
  const sessions = loadFromDisk();
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return null;

  const msg = {
    role,
    content,
    timestamp: timestamp(),
  };
  session.messages.push(msg);
  session.updatedAt = timestamp();

  // Auto-title: derive title from the first user message
  if (session.messages.length === 1 && role === 'user') {
    session.title = content.length > 50 ? content.slice(0, 50) + '…' : content;
  }

  touchSave(sessions);
  return msg;
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
  createSession,
  deleteSession,
  renameSession,
  getSession,
  listSessions,
  appendMessage,
};
