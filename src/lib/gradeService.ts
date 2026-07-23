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
