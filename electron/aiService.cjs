/**
 * Murshid AI service (main process).
 *
 * Wraps the OpenCode Go API (OpenAI-compatible chat completions) used by the
 * Voice Entry feature. The API key is read from OPENCODE_API_KEY (process env)
 * or from an OS-encrypted local config file under userData — it is NEVER
 * exposed to the renderer; the renderer only sends a transcript and receives
 * back the JSON the model produced.
 *
 * Security properties:
 *  - The key is persisted with Electron safeStorage (DPAPI on Windows), i.e.
 *    encrypted with the Windows user's credentials. It is never written in
 *    plaintext. If OS encryption is unavailable the key is NOT stored — the
 *    only remaining option is the OPENCODE_API_KEY environment variable.
 *  - The endpoint is restricted to https (no plaintext-key exfiltration).
 *  - No logging of the key or transcripts.
 *
 * Env overrides (optional):
 *   OPENCODE_API_KEY  - OpenCode Go API key (from https://opencode.ai/auth)
 *   OPENCODE_API_URL  - default https://opencode.ai/zen/go/v1
 *   OPENCODE_MODEL    - default mimo-v2.6-flash (lowest-cost Go model)
 */

const { app, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';
// Lowest-cost model on the Go plan ($0.14/$0.28 per 1M tokens, $60/mo cap,
// ~150k requests/month) — cheaper than deepseek-v4-flash and not
// region-limited like the Muse Spark Contributor models.
const DEFAULT_MODEL = 'mimo-v2.6-flash';
const REQUEST_TIMEOUT_MS = 60000;

// Stable per-app session id for the OpenCode Go gateway (required header). It
// enables prompt caching (our system prompt is identical every call, so the
// input cost drops to the cached-read rate) and correct usage routing.
const OPENCODE_SESSION_ID = crypto.randomUUID();

function configFile() {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

/**
 * Read + decrypt the stored config. A legacy plaintext `apiKey` field is still
 * accepted so an earlier build's key can be migrated, but it is only ever read
 * in memory — it is never re-written to disk in plaintext.
 */
function readStored() {
  const empty = { apiKey: '', model: '', baseUrl: '' };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch {
    return empty;
  }

  let apiKey = '';
  if (typeof data.apiKeyEnc === 'string' && data.apiKeyEnc) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(data.apiKeyEnc, 'base64'));
    } catch {
      apiKey = ''; // undecryptable (different user/machine) -> treat as unset
    }
  } else if (typeof data.apiKey === 'string' && data.apiKey) {
    apiKey = data.apiKey; // legacy plaintext from a pre-encryption build
  }

  return {
    apiKey,
    model: typeof data.model === 'string' ? data.model : '',
    baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : '',
  };
}

function canPersistKey() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Persist config. The API key is encrypted with safeStorage before writing;
 * if OS encryption is unavailable, storing a key is refused entirely (the user
 * must use the OPENCODE_API_KEY environment variable instead). Only the
 * encrypted blob (`apiKeyEnc`) is ever written — never the plaintext key.
 */
function saveStored(patch) {
  const cur = readStored();

  const out = {
    model: patch.model !== undefined ? patch.model : cur.model,
    baseUrl: patch.baseUrl !== undefined ? patch.baseUrl : cur.baseUrl,
  };

  if (patch.apiKey !== undefined) {
    if (!canPersistKey()) {
      throw new Error(
        'تشفير النظام غير متوفر على هذا الجهاز — لا يمكن حفظ المفتاح محلياً. ' +
        'عيّن OPENCODE_API_KEY كمتغير بيئة ثم أعد تشغيل البرنامج.'
      );
    }
    out.apiKeyEnc = safeStorage.encryptString(patch.apiKey).toString('base64');
  } else if (cur.apiKey) {
    // Preserve the existing key (re-encrypting from the decrypted value).
    if (!canPersistKey()) {
      throw new Error('تشفير النظام غير متوفر — تعذر حفظ الإعدادات.');
    }
    out.apiKeyEnc = safeStorage.encryptString(cur.apiKey).toString('base64');
  }

  try {
    fs.mkdirSync(path.dirname(configFile()), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(out, null, 2), { mode: 0o600 });
  } catch (err) {
    throw new Error('تعذر حفظ إعدادات الذكاء الاصطناعي: ' + err.message);
  }
  return readStored();
}

/** Migrate a legacy plaintext key (from before encryption) to an encrypted blob. */
function migrateStored() {
  try {
    const data = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    const legacyPlain = typeof data.apiKey === 'string' && data.apiKey;
    const hasEnc = typeof data.apiKeyEnc === 'string' && data.apiKeyEnc;
    if (legacyPlain && !hasEnc && canPersistKey()) {
      saveStored({ apiKey: legacyPlain });
    }
  } catch {}
}

function resolveConfig() {
  const stored = readStored();
  return {
    apiKey: process.env.OPENCODE_API_KEY || stored.apiKey || '',
    baseUrl: (process.env.OPENCODE_API_URL || stored.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.OPENCODE_MODEL || stored.model || DEFAULT_MODEL,
  };
}

function publicConfig() {
  const cfg = resolveConfig();
  return {
    configured: !!cfg.apiKey,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
    usingEnvKey: !!process.env.OPENCODE_API_KEY,
    canPersistKey: canPersistKey(),
  };
}

function buildExtractionSystemPrompt(ctx) {
  return `أنت مساعد استخراج بيانات يعمل داخل برنامج "مرشد" للمرشد التربوي العراقي.
مهمتك: من كلامٍ طبيعي يُتحدث به بصوتٍ عالٍ، استخرج بيانات سجل النشاط اليومي فقط.

التاريخ المرجعي الحالي: ${ctx.today} — اليوم هو "${ctx.todayDay}".
افهم عبارات مثل: اليوم، أمس، غداً، صباح هذا اليوم، الاثنين الماضي... واحسب التاريخ الفعلي (صيغة YYYY-MM-DD) نسبةً إلى التاريخ المرجعي. إن لم يذكر المستخدم تاريخاً فاستخدم ${ctx.today}.

حقول الإخراج المسموح بها حصراً (لا تُنشئ حقولاً أخرى):
{
  "date": "YYYY-MM-DD",
  "activities": [
    { "activity": "عنوان النشاط أو اللقاء أو الجلسة", "location": "المكان إن ذُكر", "details": "التفاصيل والموضوع الذي دار فيه النشاط" }
  ]
}

القواعد الصارمة:
1. لا تُخرج أي حقول خارج "date" و "activities"، ولا حقولاً خارج "activity" و "location" و "details" داخل كل نشاط.
2. لا تخترع معلومات غير واردة. أي قيمة لم يذكرها المستخدم = سلسلة فارغة "".
3. المكان: خذ من الكلام (مثلاً "في المكتب الإرشادي"). لا تفترضه إن لم يُذكر.
4. "activity" هو عنوان مختصر للنشاط (مثال: "لقاء فردي مع الطالب أحمد"، "جلسة إرشاد جمعي").
5. "details" يتضمن ما دار: المشكلة، الحالة، ما تمت مناقشته، والنصح/الإجراء إن ذُكر.
6. إذا وردت أكثر من واقعة منفصلة أخرج أكثر من عنصر في "activities".
7. أسماء الطلبة والمعلمين تُكتب كما نطقها المستخدم، وتكون جزءاً من activity أو details وليست حقلاً مستقلاً.
8. أخرج JSON صرفاً فقط — بدون مقدمات، بدون علامات \`\`\`، بدون تعليقات.`;

}

async function chatCompletion(messages, { systemPrompt }) {
  const cfg = resolveConfig();
  if (!cfg.apiKey) {
    throw new Error('لم يُعد الذكاء الاصطناعي بعد. أضف مفتاح OpenCode من الإعدادات.');
  }
  if (!/^https:\/\/.+/.test(cfg.baseUrl)) {
    throw new Error('رابط خدمة الذكاء الاصطناعي غير آمن — يجب أن يكون https://');
  }

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'x-opencode-session': OPENCODE_SESSION_ID,
      'User-Agent': 'Murshid/1.5.1',
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      // Disable reasoning to keep token spend at the absolute minimum for this
      // simple structured-extraction task. The OpenCode Go gateway maps
      // `thinking: false` to reasoning_effort "none"; OpenAI-compatible servers
      // ignore the field if unsupported.
      thinking: false,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const raw = await resp.text().catch(() => '');
    const snippet = raw.slice(0, 300);
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('فشل المصادقة مع OpenCode — تحقق من مفتاح API.');
    }
    if (resp.status === 429) {
      throw new Error('تم تجاوز حد الاستخدام لخطة Go. حاول لاحقاً.');
    }
    throw new Error(`فشل طلب الذكاء الاصطناعي (${resp.status}). ${snippet}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('لم يعُد النموذج بنتيجة.');
  return content;
}

function init(ipc) {
  migrateStored();

  ipc.handle('ai:config', async () => {
    try {
      return { ok: true, ...publicConfig() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipc.handle('ai:set-key', async (_e, apiKey) => {
    try {
      if (typeof apiKey !== 'string' || !apiKey.trim()) {
        return { ok: false, error: 'المفتاح فارغ.' };
      }
      saveStored({ apiKey: apiKey.trim() });
      return { ok: true, ...publicConfig() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipc.handle('ai:set-model', async (_e, model) => {
    try {
      if (typeof model !== 'string' || !model.trim()) {
        return { ok: false, error: 'اسم النموذج فارغ.' };
      }
      saveStored({ model: model.trim() });
      return { ok: true, ...publicConfig() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipc.handle('ai:set-base-url', async (_e, baseUrl) => {
    try {
      // https only — never allow the key to travel over plaintext HTTP.
      if (typeof baseUrl !== 'string' || !/^https:\/\/.+/.test(baseUrl.trim())) {
        return { ok: false, error: 'رابط API غير صالح — يجب أن يكون https://' };
      }
      saveStored({ baseUrl: baseUrl.trim() });
      return { ok: true, ...publicConfig() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipc.handle('ai:extract-daily-activity', async (_e, transcript, ctx) => {
    try {
      if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        return { ok: false, error: 'النص فارغ.' };
      }
      const context = {
        today: (ctx && ctx.today) || new Date().toISOString().slice(0, 10),
        todayDay: (ctx && ctx.todayDay) || '',
      };
      const content = await chatCompletion(
        [{ role: 'user', content: transcript.trim().slice(0, 4000) }],
        { systemPrompt: buildExtractionSystemPrompt(context) }
      );
      return { ok: true, content };
    } catch (err) {
      return { ok: false, error: err.message || 'فشل معالجة الذكاء الاصطناعي.' };
    }
  });

  ipc.handle('ai:test', async () => {
    try {
      const content = await chatCompletion(
        [{ role: 'user', content: 'أجب بكلمة واحدة فقط: نعم' }],
        { systemPrompt: 'أنت مساعد يتحقق من الاتصال. أجب "نعم" فقط.' }
      );
      return { ok: true, sample: String(content).slice(0, 60) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { init, publicConfig, configFile };