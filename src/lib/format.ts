const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const LATIN_DIGITS = '0123456789';

/**
 * Normalize digits to Western (English) numerals 0-9 for display.
 * Converts any Arabic-Indic (Eastern Arabic) digits to English digits;
 * input already in Western digits passes through unchanged.
 */
export function toLatinDigits(value: string | number): string {
  return String(value).replace(/[٠-٩]/g, (d) => LATIN_DIGITS[ARABIC_INDIC.indexOf(d)]);
}

/**
 * Format an academic year string in RTL-correct order. Converts "2025-2026"
 * to "2026-2025" so it displays correctly in Arabic RTL contexts.
 */
export function academicYear(year: string): string {
  const parts = year.split('-');
  if (parts.length === 2) return `${parts[1]}-${parts[0]}`;
  return year;
}
