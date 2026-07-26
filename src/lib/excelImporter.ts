/**
 * Generic Excel Import Engine
 *
 * Separated into:
 *   – ExcelReader       : reads .xlsx/.xls/.csv → { headers, rows }
 *   – HeaderNormalizer  : normalizes Arabic/English text for comparison
 *   – MatchingEngine    : matches Excel headers to form fields
 *   – ImportValidator   : validates mappings and required fields
 *   – DataImporter      : applies mappings to raw rows → typed objects
 */

import * as XLSX from 'xlsx';

// ── Public types ──────────────────────────────────────────────────────

export interface FormFieldDef {
  key: string;
  label: string;
  required?: boolean;
  keywords?: string[];
}

export interface ExcelData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface FieldMatch {
  excelHeader: string;
  formField: FormFieldDef;
  confidence: 'exact' | 'high' | 'medium';
}

export interface ImportMapping {
  /** Excel header → form field key */
  [excelHeader: string]: string;
}

export interface ImportSummary {
  totalColumns: number;
  autoMatched: number;
  manuallyMapped: number;
  unmatched: string[];
  missingRequired: FormFieldDef[];
  warnings: string[];
}

export interface ImportResult<T> {
  success: boolean;
  items: T[];
  errors: string[];
}

// ── Step 1: ExcelReader ───────────────────────────────────────────────

export function readExcel(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
        if (!json || json.length === 0) {
          reject(new Error('الملف فارغ'));
          return;
        }
        const headers = Object.keys(json[0]);
        resolve({ headers, rows: json as Record<string, string>[] });
      } catch (err) {
        reject(new Error('فشل قراءة الملف: ' + (err instanceof Error ? err.message : '')));
      }
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Step 2: HeaderNormalizer ──────────────────────────────────────────

export function normalizeHeader(s: string): string {
  return s
    .trim()
    // Remove Arabic/English punctuation and special chars
    .replace(/[؟\?\!\(\)\[\]\{\}\.\,\:\;\/\\\~\#\@\$\%\^\&\*\_\-\+\=\|\<\>\'\"]/g, '')
    // Remove zero-width joiners
    .replace(/\u200c|\u200d/g, '')
    // Remove tashkeel
    .replace(/[ًٌٍَُِّْٰ]/g, '')
    // Collapse whitespace
    .replace(/[\s  ]+/g, ' ')
    // Normalize common Arabic spelling variants
    .replace(/ە/g, 'ه')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

// ── Step 3: MatchingEngine ────────────────────────────────────────────

export interface MatchResult {
  matches: ImportMapping;
  unmatched: string[];
  warnings: string[];
}

/**
 * Match Excel headers to form fields using STRICT normalized equality ONLY.
 *
 * For each header, compare its normalized form against EVERY field's
 * normalized label + keywords individually. This avoids the problem
 * where multiple fields normalize to the same value (e.g. father and
 * mother death info fields after و-spacing normalization).
 *
 * Rules:
 *   1. Normalize both the header and each field label/keyword.
 *   2. Compare with ===.
 *   3. No substring matching. No contains. No fuzzy. No similarity.
 *   4. If a header matches exactly one field, auto-map it.
 *   5. If a header matches multiple fields, warn about ambiguity.
 *   6. If a header matches zero fields, leave unmatched.
 *   7. Never guess. "No match" is better than an incorrect match.
 */
export function matchHeaders(
  excelHeaders: string[],
  formFields: FormFieldDef[],
): MatchResult {
  const matches: ImportMapping = {};
  const unmatched: string[] = [];
  const warnings: string[] = [];
  const usedFields = new Set<string>();

  // Pre-compute normalized forms for every field (label + keywords)
  const fieldNormMap = new Map<string, { field: FormFieldDef; type: 'label' | 'keyword' }[]>();
  for (const f of formFields) {
    const normLabel = normalizeHeader(f.label);
    if (!fieldNormMap.has(normLabel)) fieldNormMap.set(normLabel, []);
    fieldNormMap.get(normLabel)!.push({ field: f, type: 'label' });

    for (const kw of f.keywords || []) {
      const normKw = normalizeHeader(kw);
      if (!fieldNormMap.has(normKw)) fieldNormMap.set(normKw, []);
      fieldNormMap.get(normKw)!.push({ field: f, type: 'keyword' });
    }
  }

  for (const header of excelHeaders) {
    const norm = normalizeHeader(header);
    if (!norm) { unmatched.push(header); continue; }

    // Look up all fields that match this normalized header
    const candidates = fieldNormMap.get(norm);
    if (!candidates) { unmatched.push(header); continue; }

    // Deduplicate by field key
    const unique = new Map<string, FormFieldDef>();
    for (const c of candidates) unique.set(c.field.key, c.field);
    const uniqueList = Array.from(unique.values());

    if (uniqueList.length === 1) {
      const field = uniqueList[0];
      if (usedFields.has(field.key)) {
        warnings.push(`"${header}" يتطابق مع "${field.label}" الذي سبق ربطه بعمود آخر — تم تجاهل التكرار`);
        unmatched.push(header);
      } else {
        matches[header] = field.key;
        usedFields.add(field.key);
      }
    } else {
      // Ambiguity: multiple form fields normalize to the same value
      const labels = uniqueList.map(f => f.label).join('، ');
      warnings.push(`"${header}" يتطابق مع حقول متعددة (${labels}) — يرجى الربط يدوياً`);
      unmatched.push(header);
    }
  }

  return { matches, unmatched, warnings };
}

// ── Step 4: ImportValidator ───────────────────────────────────────────

export function buildImportSummary(
  excelHeaders: string[],
  formFields: FormFieldDef[],
  mapping: ImportMapping,
): ImportSummary {
  const matchedFields = new Set(Object.values(mapping));
  const autoCount = Object.keys(mapping).filter(h => excelHeaders.includes(h)).length;

  const unmatched = excelHeaders.filter(h => !mapping[h]);

  const missingRequired = formFields.filter(f =>
    f.required && !matchedFields.has(f.key)
  );

  const manuallyMapped = Object.keys(mapping).length - autoCount;

  return {
    totalColumns: excelHeaders.length,
    autoMatched: autoCount,
    manuallyMapped: Math.max(0, manuallyMapped),
    unmatched,
    missingRequired,
    warnings: [],
  };
}

// ── Step 5: DataImporter ──────────────────────────────────────────────

/**
 * Generic import: applies column mappings to raw rows and builds typed objects.
 *
 * @param rows        Raw rows from Excel (header → value)
 * @param mapping     Excel header → form field key
 * @param factory     Function that creates a new empty object of type T
 * @param fieldKeys   Complete list of field keys on T (so the importer knows which keys exist)
 * @param transforms  Optional map of field key → transform function applied after mapping
 * @returns           Array of populated T objects
 */
export function importData<T>(
  rows: Record<string, string>[],
  mapping: ImportMapping,
  factory: () => T,
  fieldKeys: (keyof T)[],
  transforms?: Record<string, (val: string) => string>,
): ImportResult<T> {
  const items: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const item = factory();

      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey || fieldKey === 'custom') continue;
        if ((fieldKeys as string[]).includes(fieldKey)) {
          let val = String(row[header] || '').trim();
          // Apply transform if specified
          if (transforms && transforms[fieldKey]) {
            val = transforms[fieldKey](val);
          }
          (item as any)[fieldKey] = val;
        }
      }

      items.push(item);
    } catch (err) {
      errors.push(`الصف ${i + 1}: ${err instanceof Error ? err.message : 'خطأ'}`);
    }
  }

  return { success: errors.length === 0, items, errors };
}
