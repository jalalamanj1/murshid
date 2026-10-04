/** Shared Arabic day helpers used by the daily activity record and AI extraction. */

export const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Local 'YYYY-MM-DD' for today — avoids toISOString()'s UTC off-by-one at night. */
export function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Arabic day name for a 'YYYY-MM-DD' string, parsed as local time (not UTC). */
export function dayFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return DAY_NAMES[d.getDay()];
}