/**
 * Record file import.
 *
 * Reads a DOCX or Excel file and turns its label/value content into one of the
 * counselling record types. Files are not assumed to follow a fixed template:
 * every recognized Arabic label is mapped to the matching record field, and
 * missing fields fall back to safe defaults so a record is never left invalid.
 */

import JSZip from 'jszip';
import { readExcel, normalizeHeader } from './excelImporter';
import type {
  CaseStudy,
  CounselingRecord,
  CounselingSession,
  HealthRecord,
  ParentLossRecord,
  RecordType,
  SpecialCaseCategory,
  SpecialCaseRecord,
  Student,
} from '../types';

export type RecordImportKind =
  | 'health'
  | 'parentLoss'
  | 'caseStudy'
  | 'session'
  | 'specialCase'
  | 'counseling';

export type LabelMap = Record<string, string>;

export interface RecordImportResult {
  kind: RecordImportKind;
  records: Array<
    | HealthRecord
    | ParentLossRecord
    | CaseStudy
    | CounselingSession
    | SpecialCaseRecord
    | CounselingRecord
  >;
  recognized: number;
  totalFields: number;
  warnings: string[];
  /** Short human summary, e.g. "3 أيام · 12 نشاطاً". */
  detail?: string;
}

const uid = () => `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** A map is worth importing only when at least one value has a letter/number. */
const hasContent = (map: LabelMap) =>
  Object.values(map).some((value) => /[\p{L}\p{N}]/u.test(clean(value)));

// ── Parsing ──────────────────────────────────────────────────────────

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** A Word table, normalised to rows of cell text. */
interface DocxTable {
  rows: string[][];
}

type DocxBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'table'; table: DocxTable };

function extractRuns(xmlChunk: string): string {
  const prepared = xmlChunk.replace(/<\/w:p>/g, ' ').replace(/<w:tab[^>]*\/>/g, ' ');
  const parts: string[] = [];
  const runRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(prepared))) parts.push(decodeXmlEntities(match[1]));
  return clean(parts.join(''));
}

/**
 * Read the document body in order, keeping tables as grids and paragraphs as
 * plain text. Preserving table row/cell boundaries is what allows one row to
 * become one record (per student / per day) instead of a soup of lines.
 */
async function readDocxBlocks(file: File): Promise<DocxBlock[]> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('الملف ليس مستند Word صالح.');
  const xml = await doc.async('string');

  const blocks: DocxBlock[] = [];
  const blockRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(xml))) {
    const chunk = block[0];
    if (chunk.startsWith('<w:tbl')) {
      const rows: string[][] = [];
      const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let row: RegExpExecArray | null;
      while ((row = rowRe.exec(chunk))) {
        const cells: string[] = [];
        const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
        let cell: RegExpExecArray | null;
        while ((cell = cellRe.exec(row[0]))) cells.push(extractRuns(cell[0]));
        if (cells.some(Boolean)) rows.push(cells);
      }
      if (rows.length) blocks.push({ type: 'table', table: { rows } });
    } else {
      const text = extractRuns(chunk);
      if (text) blocks.push({ type: 'paragraph', text });
    }
  }

  if (blocks.length === 0) {
    const text = extractRuns(xml);
    if (text) blocks.push({ type: 'paragraph', text });
  }
  return blocks;
}

/** Turn "label: value" lines into a map (paragraphs without tables). */
function textToLabelMap(text: string): LabelMap {
  const map: LabelMap = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.search(/[:：]/);
    if (colon <= 0) continue;
    const label = clean(line.slice(0, colon));
    const value = clean(line.slice(colon + 1));
    if (label) map[label] = value;
  }
  return map;
}

const endsWithLabelColon = (value: string) => /[:：]\s*$/.test(value);

/**
 * Turn one table into records.
 *  · A wide header row ("اسم الطالب | الصف | ...") yields one record per row.
 *  · A two-column label/value table yields one record per table.
 */
function tableToMaps(table: DocxTable): LabelMap[] {
  const rows = table.rows.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  if (rows.length === 0) return [];

  const filled = rows[0].filter(Boolean);
  const headerish =
    filled.length >= 3 &&
    rows[0].every((cell) => !cell || !endsWithLabelColon(cell)) &&
    !rows[0].some((cell) => /^(اليوم|التاريخ)$/.test(normalizeHeader(cell.replace(/[:：]/g, ''))));

  if (headerish) {
    const headers = rows[0];
    return rows
      .slice(1)
      .map((cells) => {
        const map: LabelMap = {};
        headers.forEach((header, index) => {
          if (!header) return;
          const value = cells[index] || '';
          if (value) map[header] = value;
        });
        return map;
      })
      .filter((map) => Object.keys(map).length > 0);
  }

  const map: LabelMap = {};
  const nonEmpty = (row: string[]) =>
    row.map((cell, index) => ({ cell, index })).filter((entry) => entry.cell);

  for (let r = 0; r < rows.length; r += 1) {
    const cells = nonEmpty(rows[r]);

    for (let i = 0; i < cells.length; i += 1) {
      const { cell } = cells[i];
      const next = cells[i + 1];
      const afterNext = cells[i + 2];

      // Layout: label | ":" | value
      if (next && /^[:：]$/.test(next.cell)) {
        const label = clean(cell.replace(/[:：]\s*$/, ''));
        if (label) map[label] = afterNext ? afterNext.cell : '';
        i += afterNext ? 2 : 1;
        continue;
      }

      if (!endsWithLabelColon(cell)) {
        // Some official tables put a bare label in its own row (no colon) and
        // the value in the row directly below it.
        if (cells.length === 1) {
          const belowCells = nonEmpty(rows[r + 1] || []);
          if (
            belowCells.length === 1 &&
            !endsWithLabelColon(belowCells[0].cell) &&
            !/^[:：]$/.test(belowCells[0].cell) &&
            clean(cell).length >= 3
          ) {
            map[clean(cell)] = belowCells[0].cell;
          }
        }
        continue;
      }

      let label = clean(cell.replace(/[:：]\s*$/, ''));
      let value = '';

      if (next && !endsWithLabelColon(next.cell) && !/^[:：]$/.test(next.cell)) {
        value = next.cell;
        i += 1;
      } else if (next && endsWithLabelColon(next.cell) && afterNext && !endsWithLabelColon(afterNext.cell)) {
        // Two labels on one row, e.g. "مستوى الطالب العلمي :" "قبل الفقدان :" "value"
        label = `${label} ${clean(next.cell.replace(/[:：]\s*$/, ''))}`;
        value = afterNext.cell;
        i += 2;
      } else if (cells.length === 1) {
        // Merged-cell forms put the value on the next row.
        for (let below = r + 1; below < rows.length; below += 1) {
          const belowCells = nonEmpty(rows[below]);
          if (belowCells.length === 0) continue;
          const candidate = belowCells[0].cell;
          if (endsWithLabelColon(candidate) || /^[:：]$/.test(candidate)) break;
          value = candidate;
          break;
        }
      }

      if (label) map[label] = value;
    }
  }
  return Object.keys(map).length > 0 ? [map] : [];
}

/** One merged label map for a whole table (used for multi-table records). */
function tableToSingleMap(table: DocxTable): LabelMap {
  const merged: LabelMap = {};
  for (const map of tableToMaps(table)) Object.assign(merged, map);
  return merged;
}

const hasLabel = (map: LabelMap, names: string[]) => {
  const wanted = names.map((name) => normalizeHeader(name));
  return Object.keys(map).some((key) => wanted.includes(normalizeHeader(key)));
};

/**
 * A case study is written across many tables (identity, referral, goals,
 * follow-ups...). Group them into one record per case instead of one per table.
 * A new case starts when a table carries the student identity again.
 */
function groupCaseStudyMaps(blocks: DocxBlock[]): LabelMap[] {
  const groups: LabelMap[] = [];
  let current: LabelMap | null = null;

  for (const block of blocks) {
    if (block.type !== 'table') continue;
    const map = tableToSingleMap(block.table);
    if (Object.keys(map).length === 0) continue;

    const startsNewCase = hasLabel(map, ['رمز الطالب']);
    const hasStudent = hasLabel(map, ['اسم الطالب', 'الطالب', 'اسم الطالبة']);
    const currentHasStudent = current ? hasLabel(current, ['اسم الطالب', 'الطالب', 'اسم الطالبة']) : false;

    if (!current || startsNewCase || (hasStudent && currentHasStudent)) {
      current = {};
      groups.push(current);
    }
    for (const [label, value] of Object.entries(map)) {
      if (!current[label]) current[label] = value;
    }
  }

  return groups;
}

/** Read any supported file into one label map per record. */
export async function parseRecordFile(file: File, kind?: RecordImportKind): Promise<LabelMap[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    const blocks = await readDocxBlocks(file);
    const paragraphMap = textToLabelMap(
      blocks.filter((b) => b.type === 'paragraph').map((b) => b.text).join('\n')
    );

    // A case study spans several tables; every other register uses one table
    // per record (or one row per student).
    if (kind === 'caseStudy') {
      return groupCaseStudyMaps(blocks)
        .filter(hasContent)
        .map((map) => ({ ...paragraphMap, ...map }));
    }

    const maps: LabelMap[] = [];
    for (const block of blocks) {
      if (block.type === 'table') maps.push(...tableToMaps(block.table));
    }

    const usable = maps.filter(hasContent);
    if (usable.length > 0) return usable.map((map) => ({ ...paragraphMap, ...map }));
    return hasContent(paragraphMap) ? [paragraphMap] : [];
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const data = await readExcel(file);
    const headers = data.headers.map(clean).filter(Boolean);
    if (headers.length === 0) throw new Error('لم يتم العثور على أعمدة في الملف.');

    // A two-column sheet is usually one record written as label/value rows.
    if (headers.length === 2 && data.rows.length > 2) {
      const map: LabelMap = {};
      for (const row of data.rows) {
        const values = Object.values(row);
        const label = clean(values[0]);
        if (label) map[label] = clean(values[1]);
      }
      return hasContent(map) ? [map] : [];
    }

    return data.rows
      .map((row) => {
        const map: LabelMap = {};
        for (const [label, value] of Object.entries(row)) map[clean(label)] = clean(value);
        return map;
      })
      .filter(hasContent);
  }

  throw new Error('صيغة الملف غير مدعومة. استخدم DOCX أو XLSX.');
}

// ── Daily activity (one record per day) ──────────────────────────────

export interface ParsedDayActivity {
  activity: string;
  location: string;
  details: string;
}

export interface ParsedDay {
  day: string;
  date: string;
  activities: ParsedDayActivity[];
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function latinize(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function pad2(value: string | number): string {
  return String(value).padStart(2, '0');
}

/** Accept 2026/11/16, 16 / 11 / 2026, 16-11-2026 and Arabic digits. */
function normalizeDateValue(raw: string): string {
  const value = latinize(clean(raw))
    .replace(/\s+/g, '')
    .replace(/[.،]/g, '/')
    .replace(/-/g, '/');
  let match = value.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;

  match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    let day = Number(match[1]);
    let month = Number(match[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    return `${match[3]}-${pad2(month)}-${pad2(day)}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return '';
}

function weekdayFromDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('ar-IQ', { weekday: 'long' });
}

const WEEKDAYS = [
  'الأحد',
  'الاحد',
  'الاثنين',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الاربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

/**
 * Read a day and a date out of one piece of text.
 * Handles separate labels ("اليوم:" + value cells), combined cells
 * ("اليوم: الأحد   التاريخ: 2026/11/16"), and bare weekday/date cells.
 */
function dayAndDateFromText(text: string): { day?: string; date?: string } {
  const result: { day?: string; date?: string } = {};
  const value = clean(text);

  const labeledDay = value.match(
    /اليوم\s*[:：]?\s*(الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت)/
  );
  if (labeledDay) {
    result.day = labeledDay[1];
  } else {
    // A header cell may hold only the weekday, or the weekday next to the date.
    const weekday = WEEKDAYS.find((candidate) => value.includes(candidate));
    if (weekday) result.day = weekday;
  }

  const datePattern =
    /([0-9\u0660-\u0669]{1,4})\s*[\/\.\-]\s*([0-9\u0660-\u0669]{1,2})\s*[\/\.\-]\s*([0-9\u0660-\u0669]{1,4})/;
  const dateMatch = value.match(datePattern);
  if (dateMatch) result.date = normalizeDateValue(dateMatch[0]);

  return result;
}

/** Day/date written anywhere in a table (header cells, merged cells, values). */
function dayAndDateFromTable(table: DocxTable): { day: string; date: string } {
  let day = '';
  let date = '';
  for (const row of table.rows) {
    for (const cell of row) {
      const found = dayAndDateFromText(cell);
      if (found.day) day = found.day;
      if (found.date) date = found.date;
    }
  }
  return { day, date };
}

function dailyDaysFromTable(table: DocxTable, context: { day: string; date: string }): ParsedDay[] {
  const rows = table.rows.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  if (rows.length === 0) return [];

  let day = context.day;
  let date = context.date;

  // Day/date cells can sit above the activity header inside the same table,
  // either as label/value pairs or as one combined cell. Only rows at or above
  // the header are considered, so activity text can never override the date.
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const normalized = normalizeHeader(cell);
      return (
        normalized.includes('نشاط') ||
        normalized.includes('فعاليه') ||
        normalized.includes('فعالية')
      );
    })
  );
  if (headerRowIndex >= 0) {
    const fromHeader = dayAndDateFromTable({ rows: rows.slice(0, headerRowIndex + 1) });
    if (fromHeader.day) day = fromHeader.day;
    if (fromHeader.date) date = fromHeader.date;
  }

  for (const row of rows) {
    for (let i = 0; i < row.length; i += 1) {
      const label = normalizeHeader(row[i].replace(/[:：]/g, ''));
      if (!row[i + 1]) continue;
      if (label === 'اليوم') day = row[i + 1];
      if (label === 'التاريخ') date = normalizeDateValue(row[i + 1]) || row[i + 1];
    }
  }

  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes('نشاط'))
  );
  if (headerIndex === -1) return [];

  const header = rows[headerIndex];
  const columnOf = (words: string[]) =>
    header.findIndex((cell) => words.some((word) => normalizeHeader(cell).includes(word)));

  const activityColumn = columnOf(['نشاط', 'فعاليه', 'فعالية']);
  const locationColumn = columnOf(['مكان', 'موقع', 'قاعه', 'قاعة']);
  const detailsColumn = columnOf(['تفاصيل', 'اجراء', 'مخرج', 'ملاحظات']);
  const dayColumn = header.findIndex((cell) => normalizeHeader(cell) === 'اليوم');
  const dateColumn = header.findIndex((cell) => normalizeHeader(cell) === 'التاريخ');

  const dataRows = rows.slice(headerIndex + 1);
  const cell = (row: string[], index: number) => (index >= 0 ? row[index] || '' : '');

  // Table already has a day/date per row.
  if (dayColumn !== -1 && dateColumn !== -1) {
    return dataRows
      .map((row) => {
        const rowDay = cell(row, dayColumn) || day;
        const rowDate = normalizeDateValue(cell(row, dateColumn)) || date;
        const activity = {
          activity: cell(row, activityColumn),
          location: cell(row, locationColumn),
          details: cell(row, detailsColumn),
        };
        return { day: rowDay, date: rowDate, activities: [activity] };
      })
      .filter((entry) => entry.activities[0].activity || entry.activities[0].details);
  }

  const activities = dataRows
    .map((row) => ({
      activity: cell(row, activityColumn),
      location: cell(row, locationColumn),
      details: cell(row, detailsColumn),
    }))
    .filter((activity) => activity.activity || activity.location || activity.details);

  if (activities.length === 0) return [];
  return [{ day, date, activities }];
}

async function parseDailyExcel(file: File): Promise<ParsedDay[]> {
  const data = await readExcel(file);
  if (!data.rows.length) return [];

  const headers = Object.keys(data.rows[0]).map(clean);
  const columnOf = (words: string[]) =>
    headers.find((header) => words.some((word) => normalizeHeader(header).includes(word)));

  const dateHeader = columnOf(['تاريخ']);
  const dayHeader = columnOf(['اليوم']);
  const activityHeader = columnOf(['نشاط']);
  const locationHeader = columnOf(['مكان', 'موقع']);
  const detailsHeader = columnOf(['تفاصيل', 'اجراء']);

  if (!activityHeader) return [];

  const groups = new Map<string, ParsedDay>();
  for (const row of data.rows) {
    const date = dateHeader ? normalizeDateValue(clean(row[dateHeader])) : '';
    const day = dayHeader ? clean(row[dayHeader]) : '';
    const key = `${date}|${day}`;
    const activity = {
      activity: activityHeader ? clean(row[activityHeader]) : '',
      location: locationHeader ? clean(row[locationHeader]) : '',
      details: detailsHeader ? clean(row[detailsHeader]) : '',
    };
    if (!activity.activity && !activity.location && !activity.details) continue;

    const existing = groups.get(key);
    if (existing) existing.activities.push(activity);
    else groups.set(key, { day, date, activities: [activity] });
  }
  return Array.from(groups.values());
}

/**
 * Read a daily-activity document. Each table is interpreted on its own, so one
 * file containing several days produces several records, one per day.
 */
export async function parseDailyActivityFile(
  file: File
): Promise<{ days: ParsedDay[]; warnings: string[] }> {
  const name = file.name.toLowerCase();
  const warnings: string[] = [];
  const collected: ParsedDay[] = [];

  if (name.endsWith('.docx')) {
    const blocks = await readDocxBlocks(file);
    const context = { day: '', date: '' };

    for (const block of blocks) {
      if (block.type === 'paragraph') {
        const found = dayAndDateFromText(block.text);
        if (found.day) context.day = found.day;
        if (found.date) context.date = found.date;
        continue;
      }

      // A header table can carry the date for the activity table that follows.
      const hasActivityHeader = block.table.rows.some((row) =>
        row.some((cell) => normalizeHeader(cell).includes('نشاط'))
      );
      if (!hasActivityHeader) {
        const tableContext = dayAndDateFromTable(block.table);
        if (tableContext.day) context.day = tableContext.day;
        if (tableContext.date) context.date = tableContext.date;
      }

      collected.push(...dailyDaysFromTable(block.table, context));
    }
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    collected.push(...(await parseDailyExcel(file)));
  } else {
    throw new Error('صيغة الملف غير مدعومة. استخدم DOCX أو XLSX.');
  }

  // Merge tables/pages that describe the same day. Tables without any day or
  // date stay separate: each table is its own page/record rather than one blob.
  const merged = new Map<string, ParsedDay>();
  collected.forEach((entry, index) => {
    const hasIdentity = Boolean(entry.date || entry.day);
    const key = hasIdentity ? `${entry.date}|${entry.day}` : `table_${index}`;
    const existing = merged.get(key);
    if (existing) existing.activities.push(...entry.activities);
    else merged.set(key, { ...entry, activities: [...entry.activities] });
  });

  const missingDateWarnings = new Set<string>();
  const days = Array.from(merged.values()).map((entry) => {
    let date = normalizeDateValue(entry.date) || entry.date;
    if (!date) {
      date = new Date().toISOString().slice(0, 10);
      missingDateWarnings.add(
        `لم يُعثر على تاريخ في أحد الجداول — استُخدم تاريخ اليوم (${date}) لذلك الجدول.`
      );
    }
    const day = entry.day || weekdayFromDate(date) || 'غير محدد';
    return { day, date, activities: entry.activities };
  });

  warnings.push(...missingDateWarnings);

  if (days.length === 0) {
    warnings.push(
      'لم يتم العثور على جدول أنشطة قابل للقراءة. يجب أن يحتوي الجدول على عمود "النشاط" (والمكان/التفاصيل اختياريان).'
    );
  }

  return { days, warnings };
}

/** Build one DAILY_ACTIVITY_PLAN record per parsed day. */
export function buildDailyActivityRecords(days: ParsedDay[]): CounselingRecord[] {
  const stamp = Date.now();
  return days.map((day, index) => {
    const activities = day.activities.map((activity, order) => ({
      id: `act_imp_${stamp}_${index}_${order}`,
      activity: activity.activity,
      location: activity.location,
      details: activity.details,
      displayOrder: order,
    }));

    const description = activities
      .map(
        (activity, order) =>
          `النشاط (${order + 1}): ${activity.activity || 'غير محدد'}\n` +
          `المكان: ${activity.location || 'غير محدد'}\n` +
          `التفاصيل: ${activity.details || 'بدون تفاصيل'}`
      )
      .join('\n\n--------------------------------\n\n');

    return {
      id: `rec_imp_${stamp}_${index}`,
      recordType: 'DAILY_ACTIVITY_PLAN',
      date: day.date,
      day: day.day,
      title: `سجل النشاط اليومي - ${day.day}`,
      description,
      actionTaken: 'تم تدوين الأنشطة بنجاح في السجل اليومي للمرشد.',
      recommendations: 'متابعة تنفيذ الأنشطة اليومية المقررة وتحقيق أهداف الإرشاد.',
      status: 'COMPLETED',
      updatedAt: nowIso(),
      activities,
    } as CounselingRecord;
  });
}

// ── Field mapping ────────────────────────────────────────────────────

type FieldSpec = { key: string; labels: string[] };

function readFields(map: LabelMap, specs: FieldSpec[]): { values: Record<string, string>; recognized: number } {
  const normalized = new Map<string, string>();
  for (const [label, value] of Object.entries(map)) {
    normalized.set(normalizeHeader(label), value);
  }

  const values: Record<string, string> = {};
  let recognized = 0;
  for (const spec of specs) {
    let value = '';
    for (const label of spec.labels) {
      const found = normalized.get(normalizeHeader(label));
      if (found !== undefined && found !== '') {
        value = found;
        break;
      }
    }
    values[spec.key] = value;
    if (value) recognized += 1;
  }
  return { values, recognized };
}

function findStudent(students: Student[], name: string): Student | undefined {
  const needle = normalizeHeader(name);
  if (!needle) return undefined;
  return students.find((s) => normalizeHeader(s.fullName) === needle);
}

/** Split "الأول المتوسط - شعبة ب" into its two parts. */
function splitGradeSection(value: string): { grade: string; section: string } | null {
  const match = clean(value).match(/^(.*?)\s*[-–]\s*(?:الشعبة|شعبة)\s*([أبجA-Ca-c])\s*$/);
  if (!match) return null;
  return { grade: clean(match[1]), section: clean(match[2]) };
}

const STUDENT_FIELDS: FieldSpec[] = [
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب', 'الاسم', 'اسم الطالبة'] },
  { key: 'grade', labels: ['الصف', 'المرحلة', 'الصف الدراسي', 'الصف والشعبة'] },
  { key: 'section', labels: ['الشعبة', 'القسم', 'الصف / الشعبة'] },
  { key: 'guardianPhone', labels: ['هاتف ولي الأمر', 'رقم هاتف ولي الأمر', 'هاتف الأب', 'الهاتف', 'رقم الهاتف'] },
  { key: 'address', labels: ['العنوان', 'عنوان السكن', 'السكن'] },
];

const HEALTH_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'diseaseType', labels: ['نوع المرض', 'المرض', 'الحالة الصحية'] },
  { key: 'diseaseTypeOther', labels: ['أخرى', 'مرض آخر'] },
  { key: 'diseaseDescription', labels: ['مدى تطور المرض وتأثيره على الطالب', 'وصف المرض', 'تفاصيل المرض', 'تأثير المرض'] },
  { key: 'procedures', labels: ['الإجراءات المتخذة', 'الإجراءات', 'الإجراء المتخذ'] },
];

const PARENT_LOSS_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'lossType', labels: ['نوع الفقدان', 'الفقدان'] },
  { key: 'lossTypeOther', labels: ['أخرى', 'فقدان آخر'] },
  { key: 'livesWith', labels: ['يعيش مع', 'الطالب يعيش مع'] },
  { key: 'livesWithOther', labels: ['أخرى (يعيش مع)'] },
  { key: 'guardianName', labels: ['اسم ولي الأمر', 'ولي الأمر'] },
  { key: 'guardianPhoneField', labels: ['رقم الهاتف', 'هاتف ولي الأمر'] },
  {
    key: 'academicLevelBeforeLoss',
    labels: ['المستوى العلمي قبل الفقدان', 'مستوى الطالب العلمي قبل الفقدان', 'قبل الفقدان'],
  },
  {
    key: 'academicLevelAfterLoss',
    labels: ['المستوى العلمي بعد الفقدان', 'مستوى الطالب العلمي بعد الفقدان', 'بعد الفقدان'],
  },
  { key: 'studentBehavior', labels: ['سلوك الطالب ومواظبته', 'سلوك الطالب', 'المواظبة'] },
  { key: 'additionalNotes', labels: ['ملاحظات إضافية', 'ملاحظات'] },
];

const SESSION_SPECS: FieldSpec[] = [
  { key: 'sessionNumber', labels: ['رقم الجلسة', 'تسلسل الجلسة'] },
  { key: 'sessionTitle', labels: ['عنوان الجلسة الإرشادية', 'عنوان الجلسة'] },
  { key: 'generalObjective', labels: ['الهدف العام'] },
  { key: 'specificObjectives', labels: ['الأهداف الخاصة', 'الأهداف'] },
  { key: 'activitiesStrategies', labels: ['الأنشطة والاستراتيجيات الإرشادية', 'الأنشطة', 'الاستراتيجيات'] },
  { key: 'beneficiary', labels: ['المستفيد من الجلسة الإرشادية', 'المستفيد'] },
  { key: 'beneficiaryOther', labels: ['أخرى'] },
  { key: 'sessionDate', labels: ['تاريخ الجلسة', 'التاريخ'] },
  { key: 'activity', labels: ['النشاط'] },
  { key: 'evaluation', labels: ['التقويم والمتابعة', 'التقويم'] },
];

const CASE_STUDY_SPECS: FieldSpec[] = [
  { key: 'caseNumber', labels: ['رقم الحالة', 'رقم دراسة الحالة'] },
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب'] },
  { key: 'referralSource', labels: ['مصدر الإحالة', 'جهة الإحالة'] },
  { key: 'caseDate', labels: ['تاريخ الحالة', 'التاريخ'] },
  { key: 'caseDay', labels: ['اليوم'] },
  { key: 'caseTypes', labels: ['نوع الحالة', 'أنواع الحالة', 'النوع', 'المشكلة'] },
  { key: 'familyCount', labels: ['عدد أفراد الأسرة'] },
  { key: 'siblingsCount', labels: ['عدد الإخوة'] },
  { key: 'birthOrder', labels: ['ترتيب الطالب بين إخوته', 'الترتيب بين الإخوة'] },
  { key: 'livesWith', labels: ['يعيش الطالب مع', 'يعيش مع'] },
  { key: 'studentCode', labels: ['رمز الطالب'] },
  { key: 'parentCode', labels: ['رمز ولي الأمر'] },
  { key: 'fatherJobTitle', labels: ['مهنة الأب'] },
  { key: 'sessionsTaken', labels: ['عدد الجلسات', 'عدد الجلسات التي إستغرقتها الحالة'] },
];

const SPECIAL_CASE_SPECS: FieldSpec[] = [
  ...STUDENT_FIELDS,
  { key: 'recordNumber', labels: ['رقم السجل', 'تسلسل السجل'] },
  { key: 'talentType', labels: ['نوع التفوق أو الموهبة', 'نوع الموهبة', 'الموهبة'] },
  { key: 'talentTypeOther', labels: ['أخرى (الموهبة)'] },
  { key: 'counselorServices', labels: ['الخدمات التي قدمها المرشد التربوي', 'الخدمات المقدمة'] },
  { key: 'careerGuidance', labels: ['التوجيه المهني', 'التوجيه المهني الذي يتلائم مع التفوق أو الموهبة'] },
  { key: 'studentProblems', labels: ['المشكلات التي يعاني منها الطالب', 'المشكلات'] },
  { key: 'peerBehavior', labels: ['السلوك التوافقي للطالب مع أقرانه', 'السلوك مع الأقران'] },
  { key: 'delayType', labels: ['نوع التأخر'] },
  { key: 'delayTypeOther', labels: ['أخرى (التأخر)'] },
  { key: 'delayReason', labels: ['سبب التأخر'] },
  { key: 'absenceType', labels: ['نوع الغياب'] },
  { key: 'absenceDays', labels: ['عدد أيام الغياب'] },
  { key: 'procedures', labels: ['الإجراءات', 'الإجراءات المتخذة'] },
  { key: 'evaluation', labels: ['التقويم والمتابعة', 'التقويم'] },
];

const COUNSELING_SPECS: FieldSpec[] = [
  { key: 'title', labels: ['عنوان التدوين', 'العنوان', 'الموضوع'] },
  { key: 'studentName', labels: ['اسم الطالب', 'الطالب'] },
  { key: 'date', labels: ['التاريخ', 'تاريخ التدوين'] },
  { key: 'description', labels: ['تفاصيل الحالة أو الموقف الإرشادي', 'الوصف', 'تفاصيل الحالة', 'الموقف'] },
  { key: 'actionTaken', labels: ['الإجراء الإرشادي المتخذ من قبل المرشد', 'الإجراء المتخذ', 'الإجراء'] },
  { key: 'recommendations', labels: ['التوصيات والمتابعة', 'التوصيات'] },
];

// ── Record builders ──────────────────────────────────────────────────

export function buildRecords(
  kind: RecordImportKind,
  maps: LabelMap[],
  options: { students: Student[]; category?: SpecialCaseCategory; recordType?: RecordType }
): RecordImportResult {
  const specs =
    kind === 'health' ? HEALTH_SPECS
    : kind === 'parentLoss' ? PARENT_LOSS_SPECS
    : kind === 'session' ? SESSION_SPECS
    : kind === 'caseStudy' ? CASE_STUDY_SPECS
    : kind === 'specialCase' ? SPECIAL_CASE_SPECS
    : COUNSELING_SPECS;

  const records: RecordImportResult['records'] = [];
  let recognized = 0;
  let totalFields = 0;
  const warnings: string[] = [];
  const stamp = Date.now();

  maps.filter(hasContent).forEach((map, index) => {
    const { values, recognized: hits } = readFields(map, specs);
    recognized += hits;
    totalFields += specs.length;

    const student = findStudent(options.students, values.studentName || '');
    const studentId = student?.id || '';
    const studentName = student?.fullName || values.studentName || `سجل مستورد ${index + 1}`;

    // The official Word templates use one "الصف والشعبة" cell; split it.
    let grade = student?.classGrade || values.grade || '';
    let section = student?.section || values.section || '';
    if (!section && grade) {
      const split = splitGradeSection(grade);
      if (split) {
        grade = split.grade;
        section = split.section;
      }
    }

    const guardianPhone = values.guardianPhone || '';
    const address = values.address || '';
    const createdAt = nowIso();
    const suffix = `${stamp}_${index + 1}`;

    if (!student && values.studentName) {
      warnings.push(`لم يتم العثور على الطالب "${values.studentName}" في قائمة الطلبة — تم حفظ الاسم كما ورد.`);
    }

    switch (kind) {
      case 'health':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `HR-IMP-${suffix}`,
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          address,
          diseaseType: values.diseaseType || '',
          diseaseTypeOther: values.diseaseTypeOther || '',
          diseaseDescription: values.diseaseDescription || '',
          procedures: values.procedures || '',
          createdAt,
          updatedAt: createdAt,
        } as HealthRecord);
        break;

      case 'parentLoss':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `PL-IMP-${suffix}`,
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          address,
          lossType: values.lossType || '',
          lossTypeOther: values.lossTypeOther || '',
          livesWith: values.livesWith || '',
          livesWithOther: values.livesWithOther || '',
          guardianName: values.guardianName || '',
          guardianPhoneField: values.guardianPhoneField || guardianPhone,
          academicLevelBeforeLoss: values.academicLevelBeforeLoss || '',
          academicLevelAfterLoss: values.academicLevelAfterLoss || '',
          studentBehavior: values.studentBehavior || '',
          additionalNotes: values.additionalNotes || '',
          createdAt,
          updatedAt: createdAt,
        } as ParentLossRecord);
        break;

      case 'session':
        records.push({
          id: uid(),
          sessionNumber: values.sessionNumber || `GN-IMP-${suffix}`,
          sessionTitle: values.sessionTitle || '',
          generalObjective: values.generalObjective || '',
          specificObjectives: values.specificObjectives || '',
          activitiesStrategies: values.activitiesStrategies || '',
          beneficiary: values.beneficiary || '',
          beneficiaryOther: values.beneficiaryOther || '',
          sessionDate: values.sessionDate || '',
          activity: values.activity || '',
          evaluation: values.evaluation || '',
          createdAt,
          updatedAt: createdAt,
        } as CounselingSession);
        break;

      case 'caseStudy':
        records.push({
          id: uid(),
          caseNumber: values.caseNumber || `CS-IMP-${suffix}`,
          studentId,
          studentName,
          createdAt,
          updatedAt: createdAt,
          referralSource: values.referralSource || '',
          caseDate: values.caseDate || '',
          caseDay: values.caseDay || '',
          caseTypes: values.caseTypes ? values.caseTypes.split(/[،,؛;]+/).map(clean).filter(Boolean) : [],
          familyCount: values.familyCount || '',
          siblingsCount: values.siblingsCount || '',
          birthOrder: values.birthOrder || '',
          livesWith: values.livesWith || '',
          reviews: [],
          treatmentGoals: [],
          followUps: [],
          closure: {
            closed: false,
            closedDate: '',
            outcome: 'OTHER',
            closingNotes: '',
          },
          studentCode: values.studentCode || '',
          parentCode: values.parentCode || '',
          fatherJobTitle: values.fatherJobTitle || '',
          sessionsTaken: values.sessionsTaken || '',
          status: 'OPEN',
          totalSessions: Number(values.sessionsTaken) || 0,
        } as CaseStudy);
        break;

      case 'specialCase':
        records.push({
          id: uid(),
          recordNumber: values.recordNumber || `SC-IMP-${suffix}`,
          category: options.category || 'GIFTED_TALENTED',
          studentId,
          studentName,
          grade,
          section,
          guardianPhone,
          studentIds: student ? [student.id] : [],
          studentNames: [studentName],
          address,
          talentType: values.talentType || '',
          talentTypeOther: values.talentTypeOther || '',
          counselorServices: values.counselorServices || '',
          careerGuidance: values.careerGuidance || '',
          studentProblems: values.studentProblems || '',
          peerBehavior: values.peerBehavior || '',
          delayType: values.delayType || '',
          delayTypeOther: values.delayTypeOther || '',
          delayReason: values.delayReason || '',
          absenceType: values.absenceType || '',
          absenceDays: Number(values.absenceDays) || 0,
          procedures: values.procedures || '',
          evaluation: values.evaluation || '',
          createdAt,
          updatedAt: createdAt,
        } as SpecialCaseRecord);
        break;

      case 'counseling':
      default:
        records.push({
          id: uid(),
          studentId,
          studentName,
          recordType: options.recordType || ('DAILY_ACTIVITY_PLAN' as RecordType),
          date: values.date || new Date().toISOString().slice(0, 10),
          title: values.title || `تدوين مستورد ${index + 1}`,
          description: values.description || '',
          actionTaken: values.actionTaken || '',
          recommendations: values.recommendations || '',
          status: 'ONGOING',
          updatedAt: createdAt,
        } as CounselingRecord);
        break;
    }
  });

  return { kind, records, recognized, totalFields, warnings };
}
