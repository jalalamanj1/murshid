const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩) for display.
 * Only affects presentation — call this when rendering numbers, never on
 * values used for calculations, IDs, sorting, or data.
 */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/**
 * Format an academic year string in RTL-correct order and Arabic-Indic
 * numerals. Converts "2025-2026" to "٢٠٢٦-٢٠٢٥" so it displays correctly
 * in Arabic RTL contexts.
 */
export function academicYear(year: string): string {
  const parts = year.split('-');
  if (parts.length === 2) return toArabicDigits(`${parts[1]}-${parts[0]}`);
  return toArabicDigits(year);
}
