/**
 * LocalAIService — manages llama-server.exe + tool/function calling.
 *
 * Tools allow the AI to perform actions in the app:
 * students, records, todos, daily activities, export, stats.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getAiPath(file) {
  if (process.resourcesPath) { const p = path.join(process.resourcesPath, 'ai', file); if (fs.existsSync(p)) return p; }
  return path.join(__dirname, 'ai', file);
}

const SERVER_EXE = getAiPath('llama-server.exe');
const MODEL_PATH = getAiPath('qwen2.5-1.5b-instruct-q4_k_m.gguf');
const API_URL = 'http://127.0.0.1:8080/v1/chat/completions';

// ── Service ──────────────────────────────────────────────────────
class LocalAIService {
  constructor() {
    this._process = null;
    this._ready = false;
    this._starting = false;
    this._onReady = null;
    this._onError = null;
  }

  get isRunning() { return this._ready; }
  get isStarting() { return this._starting; }

  onReady(cb) { this._onReady = cb; }
  onError(cb) { this._onError = cb; }

  start() {
    if (this._ready || this._starting) return { ok: true };
    if (!fs.existsSync(SERVER_EXE)) return { ok: false, error: 'llama-server.exe not found.' };
    if (!fs.existsSync(MODEL_PATH)) return { ok: false, error: 'Model file not found.' };

    this._starting = true;
    console.log('[LocalAI] Starting with', path.basename(MODEL_PATH));

    try {
      this._process = spawn(SERVER_EXE, [
        '-m', MODEL_PATH, '--port', '8080', '--host', '127.0.0.1',
        '-ngl', '0', '-c', '4096', '--chat-template', 'chatml',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      this._process.stdout.on('data', () => {});
      this._process.stderr.on('data', (d) => {
        const t = d.toString();
        if (t.includes('error') || t.includes('Error')) { if (this._onError) this._onError(t.trim()); }
      });
      this._process.on('exit', (c) => { console.log('[LocalAI] Exited:', c); this._ready = false; this._starting = false; this._process = null; });

      setTimeout(() => {
        if (!this._ready && this._starting) { this._ready = true; this._starting = false; console.log('[LocalAI] Ready'); if (this._onReady) this._onReady(); }
      }, 35000);

      return { ok: true };
    } catch (err) {
      this._starting = false;
      return { ok: false, error: err.message };
    }
  }

  stop() {
    if (this._process) { this._process.kill(); this._process = null; }
    this._ready = false; this._starting = false;
    return { ok: true };
  }

  /**
   * Send a chat message with tool support.
   * If the AI requests a tool call, executes it via the tool executor
   * and sends the result back to the AI for final response.
   */
  async chat(message, history = []) {
    if (!this._ready) return { ok: false, error: 'AI not ready yet.' };

    // Allow caller to override system prompt via history; default to extraction engine
    const sysOverride = history.find(m => m.role === 'system');
    const filteredHistory = history.filter(m => m.role !== 'system');
    const messages = [
      { role: 'system', content: sysOverride ? sysOverride.content : 'أنت مستخرج معلومات. أخرج JSON فقط.' },
      ...filteredHistory.slice(-15),
      { role: 'user', content: message },
    ];

    try {
      const body = { messages, temperature: 0.0, max_tokens: 512 };
      const response = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) return { ok: false, error: 'AI error: ' + (await response.text()) };

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || '';
      return { ok: true, reply };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = LocalAIService;
