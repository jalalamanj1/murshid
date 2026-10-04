/**
 * AI extraction for the DAILY ACTIVITY record.
 *
 * The schema below is derived DIRECTLY from the existing application:
 *   - RecordsListView (DAILY_ACTIVITY_PLAN form) holds `date` + a table of
 *     activities, each row = { activity, location, details }.
 *   - `CounselingRecord` (src/types.ts) stores: date (YYYY-MM-DD), day
 *     (Arabic, derived from date), title (auto), description (formatted text
 *     derived from activities), activities: DailyActivityItem[].
 *
 * So the AI is only asked to produce `date` + `activities`; everything else in
 * the record is derived by the existing form on save. We never invent fields.
 */

import { DAY_NAMES } from './dateUtils';

export interface ExtractedActivity {
  activity: string;
  location: string;
  details: string;
}

export interface DailyActivityDraft {
  date: string; // YYYY-MM-DD
  activities: ExtractedActivity[];
}

export interface ExtractionContext {
  today: string; // YYYY-MM-DD
  todayDay: string; // Arabic day name for today
}

export function todayContext(): ExtractionContext {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    today: `${y}-${m}-${d}`,
    todayDay: DAY_NAMES[now.getDay()],
  };
}

/** Strip markdown code fences and surrounding prose from a model reply. */
export function extractJson(text: string): unknown {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (
    d.getFullYear() === Number(m[1]) &&
    d.getMonth() === Number(m[2]) - 1 &&
    d.getDate() === Number(m[3])
  );
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Validate the parsed model output against the real record structure.
 * Throws with a user-friendly Arabic message on any invalid input.
 */
export function validateDailyActivityDraft(raw: unknown, ctx: ExtractionContext): DailyActivityDraft {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('استجابة الذكاء الاصطناعي غير صالحة.');
  }
  const obj = raw as Record<string, unknown>;

  const allowedTop = new Set(['date', 'activities']);
  const unknownTop = Object.keys(obj).filter((k) => !allowedTop.has(k));
  if (unknownTop.length > 0) {
    throw new Error(`تحتوي الاستجابة على حقول غير موجودة في السجل: ${unknownTop.join('، ')}`);
  }

  let date = str(obj.date);
  if (!date || !isValidDate(date)) {
    // The model may have omitted/guessed the date; the form defaults to today.
    date = ctx.today;
  }

  const rawActivities = Array.isArray(obj.activities) ? obj.activities : [];
  const activities: ExtractedActivity[] = [];
  for (const item of rawActivities) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const a = item as Record<string, unknown>;
    const allowed = new Set(['activity', 'location', 'details']);
    const unknown = Object.keys(a).filter((k) => !allowed.has(k));
    if (unknown.length > 0) {
      throw new Error(`تحتوي الاستجابة على حقول غير موجودة في السجل: ${unknown.join('، ')}`);
    }
    const act: ExtractedActivity = {
      activity: str(a.activity),
      location: str(a.location),
      details: str(a.details),
    };
    if (act.activity || act.location || act.details) activities.push(act);
  }

  if (activities.length === 0) {
    throw new Error('لم يُستخرج أي نشاط من كلامك. أعد المحاولة بصيغة أوضح.');
  }
  if (activities.length > 30) activities.length = 30;

  return { date, activities };
}

/**
 * Run the full extraction pipeline: call the main-process OpenCode API and
 * validate the structured result. Returns a draft to populate the form with.
 */
export async function extractDailyActivity(transcript: string): Promise<DailyActivityDraft> {
  const ctx = todayContext();
  const electron = (window as any).electronAPI;
  if (!electron?.ai?.extractDailyActivity) {
    throw new Error('خدمة الذكاء الاصطناعي غير متوفرة في هذه البيئة.');
  }
  const res = await electron.ai.extractDailyActivity(transcript, ctx);
  if (!res?.ok) {
    throw new Error(res?.error || 'فشل معالجة النص.');
  }
  const parsed = extractJson(res.content);
  return validateDailyActivityDraft(parsed, ctx);
}