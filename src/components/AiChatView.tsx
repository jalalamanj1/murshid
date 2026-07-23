import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';

const HISTORY_KEY = 'murshid_ai_history';
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const all: (ChatMessage & { ts: number })[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    const recent = all.filter(m => m.ts > cutoff);
    if (recent.length !== all.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(recent));
    return recent.map(m => ({ role: m.role, content: m.content }));
  } catch { return []; }
}
function saveMessage(msg: ChatMessage) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const all: any[] = raw ? JSON.parse(raw) : [];
    all.push({ ...msg, ts: Date.now() });
    const cutoff = Date.now() - MAX_AGE_MS;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all.filter((m: any) => m.ts > cutoff)));
  } catch {}
}

const WELCOME: ChatMessage = { role: 'assistant', content: '🤖 Murshid AI\n\nأرسل أمراً مثل:\n"جلسة إرشاد جمعي لطلبة الصف الرابع حول النظافة الشخصية"\n"كم عدد الطلاب؟"\n"ابحث عن طالب اسمه أحمد"' };

// ── Storage helpers ──
const readArr = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const readObj = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const write = (k: string, d: any) => { localStorage.setItem(k, JSON.stringify(d)); try { window.dispatchEvent(new Event('murshid-data-changed')); } catch {} };

const normalize = (s: string) => s.toLowerCase()
  .replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[ًٌٍَُِّْ]/g, '');

// ── Qwen extraction prompt (ultra-short, single purpose) ──
const EXTRACT_PROMPT = `Extract activity, place, topic from the Arabic sentence.
Return ONLY valid JSON: {"a":"...","p":"...","t":"..."}
a = activity type only (e.g. جلسة إرشاد جمعي, محاضرة, زيارة)
p = place/location only (e.g. الصف الرابع, مختبر الحاسوب)
t = topic/subject only (e.g. النظافة الشخصية, الأمن السيبراني)
Never put activity in place. Never put place in activity. Never add explanations.`;

// ── Summary generation prompt (focused, single paragraph) ──
const SUMMARY_PROMPT = `Write ONE professional Arabic sentence (30-80 words) for an official school counseling record.
Topic: `;

// ── Robust JSON extractor ──
function parseJSON(raw: string): any {
  if (!raw) return null;
  let s = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  // Direct parse
  try { const j = JSON.parse(s); if (j && (j.a || j.activity || j.intent)) return j; } catch {}
  // Find first valid JSON object
  const m = s.match(/\{(?:[^{}]|"[^"]*")*\}/);
  if (m) try { const j = JSON.parse(m[0]); if (j && (j.a || j.activity || j.intent)) return j; } catch {}
  // Key:value extraction
  const extract = (prefix: string) => {
    const re = new RegExp(`["']?${prefix}["']?\\s*[:=]\\s*["']([^"']+)["']`, 'i');
    const r = s.match(re);
    return r ? r[1].trim() : null;
  };
  const a = extract('a') || extract('activity');
  const p = extract('p') || extract('place');
  const t = extract('t') || extract('topic') || extract('details');
  if (a) return { a, p: p || '—', t: t || '—' };
  return null;
}

// ── JS fallback extractor (no AI, fully dynamic) ──
function fallbackExtract(text: string): { a: string; p: string; t: string } {
  let s = text.trim().replace(/^(أضف|اضف|تسجيل|سجل|دون|قيد)\s*(نشاط)?\s*(جديد)?\s*/i, '');

  // Place: after "في" (stop at topic keywords)
  let place = '';
  const fi = s.search(/\sفي\s+(?!حول|عن|بشأن|لمناقشة|بخصوص)/i);
  if (fi >= 0) {
    const after = s.slice(fi + 3).trim();
    const si = after.search(/\s+(حول|عن|بشأن|لمناقشة|بخصوص|مع)\s+/i);
    place = si > 0 ? after.slice(0, si).trim() : after.trim();
  }

  // Topic: after keywords
  let topic = '';
  const ki = s.search(/\s(حول|عن|بشأن|لمناقشة|بخصوص)\s+/i);
  if (ki >= 0) {
    const after = s.slice(ki).match(/(?:حول|عن|بشأن|لمناقشة|بخصوص)\s+(.+)/i);
    if (after) topic = after[1].trim();
  }

  // Activity: first phrase before "في" or "حول"
  let activity = s;
  const cuts = [s.search(/\sفي\s+(?!حول|عن|بشأن)/i), s.search(/\s(حول|عن|بشأن)/i)].filter(i => i > 0);
  if (cuts.length > 0 && cuts[0] > 0) activity = s.slice(0, cuts[0]).trim();
  activity = activity.replace(/^(مع|لـ?|لطلبة)\s*/i, '').trim();
  if (!activity) activity = s;

  return { a: activity, p: place, t: topic || activity };
}

// ── Generate professional summary ──
let _summaryCache: Record<string, string> = {};
async function genSummary(topic: string, activity: string): Promise<string> {
  const key = normalize(topic + '|' + activity);
  if (_summaryCache[key]) return _summaryCache[key];

  const fallback = `تم تنفيذ ${activity} تناولت ${topic} بهدف تعزيز الوعي وتحسين الممارسات التربوية لدى الطلبة.`;

  const api = (window as any).electronAPI;
  if (!api?.localai || !topic || topic === '—') { _summaryCache[key] = fallback; return fallback; }

  try {
    const res = await api.localai.chat(SUMMARY_PROMPT + topic, [{ role: 'system', content: 'أنت كاتب تقارير تربوية. اكتب فقرة مهنية قصيرة بالعربية الفصحى.' }]);
    if (res.ok && res.reply) {
      const c = res.reply.trim().replace(/^["']|["']$/g, '');
      if (c.length > 20) { _summaryCache[key] = c; return c; }
    }
  } catch {}
  _summaryCache[key] = fallback; return fallback;
}

// ── Database: ONE record per day, append activities ──
async function appendDailyActivity(activity: string, place: string, topic: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // Generate summary
  const details = await genSummary(topic || activity, activity);
  const newAct = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    activity: activity.substring(0, 150),
    location: place || '',
    details: details,
    displayOrder: 0,
  };

  // Find today's record OR create it
  const all = readArr('murshid_records');
  const todayRecord = all.find((r: any) => r.recordType === 'DAILY_ACTIVITY_PLAN' && r.date === today);

  if (todayRecord) {
    // Append to existing
    const acts = todayRecord.activities || [];
    newAct.displayOrder = acts.length;
    todayRecord.activities = [...acts, newAct];
    todayRecord.description = todayRecord.activities.map((a: any, i: number) =>
      `${i + 1}. ${a.activity}${a.location ? ' - ' + a.location : ''}`
    ).join('\n');
    todayRecord.updatedAt = new Date().toISOString();
  } else {
    // Create new today record
    const newRecord: any = {
      id: 'daily_' + today,
      recordType: 'DAILY_ACTIVITY_PLAN',
      date: today,
      day: days[new Date().getDay()],
      title: 'سجل النشاط اليومي - ' + days[new Date().getDay()],
      description: `1. ${activity}`,
      actionTaken: '', recommendations: '', status: 'ONGOING',
      activities: [newAct],
      updatedAt: new Date().toISOString(),
    };
    all.unshift(newRecord);
  }

  write('murshid_records', all);
  // Dispatch events for UI refresh
  try { window.dispatchEvent(new CustomEvent('murshid-record-added')); } catch {}

  return `✅ ${activity}\n📍 ${place || '—'}\n📝 ${details.substring(0, 120)}${details.length > 120 ? '...' : ''}`;
}

// ── Intent detection (JS-only, no AI) ──
function detectIntent(text: string): { intent: string; params: any } | null {
  const s = text.trim();

  // Activity: starts with activity keyword OR contains "أضف/تسجيل/سجل نشاط"
  if (/^(جلسة|مقابلة|زيارة|اجتماع|محاضرة|ورشة|اتصال|كشف|توجيه|لقاء|تدريب|اختبار|محادثة|ندوة|نشاط)/i.test(s)) {
    const p = fallbackExtract(s);
    return { intent: 'append_daily_activity', params: { a: p.a, p: p.p, t: p.t } };
  }
  const addMatch = s.match(/(?:أضف|اضف|تسجيل|سجل|دون|قيد)\s*(?:نشاط)?\s*(?:جديد)?\s*(.+)/i);
  if (addMatch) {
    const p = fallbackExtract(addMatch[1].trim());
    return { intent: 'append_daily_activity', params: { a: p.a, p: p.p, t: p.t } };
  }

  // Non-activity intents
  if (/^(كم|ما)\s*(عدد|هو عدد)\s*(الطلاب|الطلبة)/i.test(s)) return { intent: 'count_students', params: {} };
  const sr = s.match(/(?:ابحث|بحث|عندنا|لدينا|هل\s*لدينا|هل\s*يوجد)\s*(?:عن)?\s*(?:طالب)?\s*(?:اسمه|اسم|باسم)?\s*(.+)/i);
  if (sr) return { intent: 'search_student', params: { q: sr[1].trim() } };
  if (/أضف\s*(?:مهمة|وظيفة)/i.test(s)) {
    const m = s.match(/أضف\s*(?:مهمة|وظيفة)\s*:?\s*(.+)/i);
    return { intent: 'add_todo', params: { text: m ? m[1].trim() : s } };
  }
  if (/^(?:أظهر|اعرض|عرض|عندي|list|show)\s*(?:المهام|مهامي|todos|tasks)/i.test(s)) return { intent: 'list_todos', params: {} };
  if (/اسم\s*(?:المدرسة|المؤسسة)/i.test(s)) return { intent: 'school_info', params: {} };
  if (/^(?:إحصائيات|احصائيات)/i.test(s)) return { intent: 'statistics', params: {} };
  return null;
}

// ── Action dispatcher ──
async function dispatch(intent: string, params: any): Promise<string> {
  switch (intent) {
    case 'append_daily_activity':
      return appendDailyActivity(params.a || params.activity || 'نشاط', params.p || params.place || '', params.t || params.topic || params.details || '');

    case 'count_students':
      return `📊 ${readArr('murshid_students').length} طالب`;

    case 'search_student': {
      const q = normalize(params.q || '');
      const res = readArr('murshid_students').filter((s: any) => normalize(s.fullName || '').includes(q));
      if (res.length === 0) return '❌ لا يوجد طلاب مطابقين.';
      return res.slice(0, 8).map((s: any) => `• ${s.fullName}  ${s.classGrade || ''}`).join('\n');
    }

    case 'add_todo': {
      const all = readArr('murshid_todos');
      all.unshift({ id: 'ai_' + Date.now(), text: params.text, completed: false, createdAt: new Date().toLocaleDateString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) });
      write('murshid_todos', all);
      return '✅ تم إضافة المهمة';
    }

    case 'list_todos': {
      const all = readArr('murshid_todos');
      if (all.length === 0) return '📋 لا توجد مهام.';
      return all.slice(0, 10).map((t: any, i: number) => `${i + 1}. ${t.completed ? '✅' : '⬜'} ${t.text}`).join('\n');
    }

    case 'school_info': {
      const p = readObj('murshid_profile');
      return `🏫 ${p.schoolName || '—'}  |  👤 ${p.fullName || '—'}`;
    }

    case 'statistics':
      return `📊 طلاب: ${readArr('murshid_students').length}  |  سجلات: ${readArr('murshid_records').length}  |  مهام: ${readArr('murshid_todos').length}`;

    default:
      return '❌ أمر غير معروف.';
  }
}

// ── Component ──
export default function AiChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => { const s = loadHistory(); return s.length > 0 ? s : [WELCOME]; });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const addMsg = useCallback((m: ChatMessage) => { setMessages(prev => { saveMessage(m); return [...prev, m]; }); }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      const api = (window as any).electronAPI;
      if (!api?.localai) return;
      try { const r = await api.localai.status(); if (r?.ok && r.running) { setAiReady(true); clearInterval(poll); } } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Qwen extraction (with retry) ──
  async function extractWithQwen(text: string, retries = 2): Promise<{ a: string; p: string; t: string } | null> {
    const api = (window as any).electronAPI;
    if (!api?.localai || !aiReady) return null;
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await api.localai.chat(text, [{ role: 'system', content: EXTRACT_PROMPT }]);
        if (res.ok && res.reply) {
          const j = parseJSON(res.reply);
          if (j && j.a && j.a !== '—') return { a: j.a, p: j.p || '', t: j.t || '' };
        }
      } catch {}
    }
    return null;
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    addMsg({ role: 'user', content: msg });
    setLoading(true);

    // 1. Detect intent (always works, no AI)
    let intent = detectIntent(msg);
    let result: string;

    if (intent) {
      // 2. For activities, enhance with Qwen extraction
      if (intent.intent === 'append_daily_activity' && aiReady) {
        const ai = await extractWithQwen(msg);
        if (ai && ai.a && ai.a !== '—') {
          // Qwen succeeded — use its structured data
          intent.params = ai;
        }
      }
      // 3. Dispatch & execute
      result = await dispatch(intent.intent, intent.params);
    } else {
      // 4. Unknown — try Qwen
      if (aiReady) {
        const ai = await extractWithQwen(msg);
        if (ai && ai.a && ai.a !== '—') {
          result = await dispatch('append_daily_activity', ai);
        } else {
          result = '❌ لم أفهم الأمر. جرب:\n"جلسة إرشاد حول موضوع"\n"كم عدد الطلاب؟"';
        }
      } else {
        result = '❌ AI غير متاح. جرب أمراً مباشراً.';
      }
    }

    setLoading(false);
    addMsg({ role: 'assistant', content: result });
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-[#0f172a]" dir="rtl">
      <div className="bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl"><Sparkles className="w-5 h-5 text-white" /></div>
        <div><h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Murshid AI</h2><p className="text-[10px] text-slate-400">{aiReady ? '🟢 جاهز' : '🟡 جاري التحميل...'}</p></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            {m.role === 'assistant' && <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0 mt-1"><Bot className="w-4 h-4 text-white" /></div>}
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${m.role === 'user' ? 'bg-office-blue text-white rounded-bl-md' : 'bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-br-md shadow-xs'}`}>{m.content}</div>
            {m.role === 'user' && <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-1"><User className="w-4 h-4 text-slate-500" /></div>}
          </div>
        ))}
        {loading && <div className="flex justify-end"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        <div ref={chatEndRef} />
      </div>
      <div className="bg-white dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="اكتب أمرك هنا..." className="flex-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-office-blue" />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            className="bg-office-blue hover:bg-office-hover disabled:opacity-50 text-white px-5 py-3 rounded-xl transition-colors cursor-pointer flex items-center gap-2"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
