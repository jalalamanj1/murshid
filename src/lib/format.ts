/**
 * Format an academic year string in RTL-correct order.
 * Converts "2025-2026" to "2026-2025" so it displays correctly
 * in Arabic RTL contexts.
 */
export function academicYear(year: string): string {
  const parts = year.split('-');
  if (parts.length === 2) return `${parts[1]}-${parts[0]}`;
  return year;
}
