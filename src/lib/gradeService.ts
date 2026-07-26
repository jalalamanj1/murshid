/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Grade Service
 * All grade lists are defined here. Every form, filter, and report
 * must request its grades from GetGrades(). No hard-coding elsewhere.
 */

import { CounselorProfile } from '../types';

// Grade definitions per educational stage
const GRADE_MAP: Record<string, string[]> = {
  PRIMARY: [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي'
  ],
  MIDDLE: [
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط'
  ],
  HIGH: [
    'الرابع العلمي',
    'الرابع الأدبي',
    'الخامس العلمي',
    'الخامس الأدبي',
    'السادس العلمي',
    'السادس الأدبي'
  ],
  SECONDARY: [
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط',
    'الرابع العلمي',
    'الرابع الأدبي',
    'الخامس العلمي',
    'الخامس الأدبي',
    'السادس العلمي',
    'السادس الأدبي'
  ],
  KINDERGARTEN: [
    'الصف الأول التمهيدي',
    'الصف الثاني التمهيدي'
  ]
};

// Iraqi school system: grade number → Arabic stage name
const STAGE_BY_NUMBER: Record<string, string> = {
  '7': 'الأول المتوسط',
  '8': 'الثاني المتوسط',
  '9': 'الثالث المتوسط',
  '10': 'الرابع الإعدادي',
  '11': 'الخامس الإعدادي',
  '12': 'السادس الإعدادي',
};

// English section letter → Arabic section letter
const SECTION_LETTER_MAP: Record<string, string> = {
  'A': 'أ',
  'B': 'ب',
  'C': 'ج',
  'a': 'أ',
  'b': 'ب',
  'c': 'ج',
};

/**
 * Parse a compact class string like "7A" or "8 B" or "10-a"
 * and return the full Arabic format "الأول المتوسط - الشعبة أ".
 *
 * Supported input formats:
 *   7A, 7 A, 7-A, 7_a, 7a, 7 a
 *
 * Returns null if the input cannot be parsed.
 */
export function parseCompactClass(input: string): string | null {
  const s = input.trim();
  // Match: digit(s) followed by optional separator and letter
  const m = s.match(/^(\d{1,2})\s*[-_ ]?\s*([A-Ca-c])$/);
  if (!m) return null;

  const num = m[1];
  const letter = m[2];

  const stage = STAGE_BY_NUMBER[num];
  const section = SECTION_LETTER_MAP[letter];
  if (!stage || !section) return null;

  return `${stage} - الشعبة ${section}`;
}

/**
 * Try to parse a class string. If it matches the compact format,
 * return the full Arabic format. Otherwise return the original string.
 */
export function normalizeClassGrade(value: string): string {
  const parsed = parseCompactClass(value);
  return parsed !== null ? parsed : value;
}

/**
 * Convert an Excel serial date number (e.g. 45485) to YYYY-MM-DD.
 * Handles the Excel 1900 leap year bug (serial 60 = 1900-02-29 which doesn't exist).
 * If the value is already a date string or not a number, return it unchanged.
 */
export function normalizeExcelDate(value: string): string {
  if (!value) return value;
  const num = Number(value);
  if (isNaN(num)) return value;
  // Excel serial: days since 1900-01-01 (serial 1 = 1900-01-01)
  // Account for the 1900 leap year bug: Excel has Feb 29, 1900 but it doesn't exist
  const adjusted = num > 60 ? num - 1 : num;
  const date = new Date(Date.UTC(1899, 11, 31 + adjusted));
  if (isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const str = `${y}-${m}-${d}`;
  // Sanity check: year should be between 1900 and 2100
  if (y < 1900 || y > 2100) return value;
  return str;
}

// Display labels for educational stages (Arabic)
export const STAGE_LABELS: Record<string, string> = {
  PRIMARY: 'المرحلة الابتدائية',
  MIDDLE: 'المرحلة المتوسطة',
  HIGH: 'المرحلة الإعدادية',
  SECONDARY: 'المرحلة الثانوية',
  KINDERGARTEN: 'مرحلة رياض الأطفال'
};

/**
 * Get the list of valid grades for a given educational stage.
 * Falls back to MIDDLE if stage is unknown.
 */
export function GetGrades(schoolType: string): string[] {
  return GRADE_MAP[schoolType] || GRADE_MAP['MIDDLE'];
}

/**
 * Get the display label for a school type key.
 */
export function GetStageLabel(schoolType: string): string {
  return STAGE_LABELS[schoolType] || schoolType;
}

/**
 * Validate that a grade belongs to the given educational stage.
 * Returns true if the grade is valid for the stage.
 */
export function IsValidGrade(grade: string, schoolType: string): boolean {
  const validGrades = GetGrades(schoolType);
  return validGrades.includes(grade);
}

/**
 * Get all grades from the profile's school type.
 * Convenience wrapper used by components that have the profile object.
 */
export function GetGradesFromProfile(profile: CounselorProfile): string[] {
  return GetGrades(profile.schoolType);
}

/**
 * Filter an array of students, keeping only those with grades
 * valid for the given school type. Useful for validation on load.
 */
export function FilterValidStudents(
  students: { classGrade: string }[],
  schoolType: string
): { classGrade: string }[] {
  const valid = new Set(GetGrades(schoolType));
  return students.filter(s => valid.has(s.classGrade));
}
