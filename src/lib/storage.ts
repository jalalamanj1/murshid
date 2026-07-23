/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CounselorProfile, LicenseInfo, Student, CounselingRecord, AppSettings, CaseStudy, CounselingSession, SpecialCaseRecord, HealthRecord, ParentLossRecord } from '../types';

const STORAGE_KEYS = {
  LICENSE: 'murshid_license',
  PROFILE: 'murshid_profile',
  STUDENTS: 'murshid_students',
  RECORDS: 'murshid_records',
  SETTINGS: 'murshid_settings',
  CASE_STUDIES: 'murshid_case_studies',
  COUNSELING_SESSIONS: 'murshid_counseling_sessions',
  SPECIAL_CASES: 'murshid_special_cases',
  HEALTH_RECORDS: 'murshid_health_records',
  PARENT_LOSS_RECORDS: 'murshid_parent_loss_records',
};

// Initial Setup & Default Seed Data
const DEFAULT_SETTINGS: AppSettings = {
  saveFolder: 'C:\\Murshid\\Data',
  autoBackupEnabled: true,
  backupIntervalMinutes: 30,
  googleDriveLinked: false,
  appColorTheme: 'BlueOffice'
};

const DEFAULT_STUDENTS: Student[] = [];

const DEFAULT_RECORDS: CounselingRecord[] = [];

export const loadLicense = (): LicenseInfo => {
  const data = localStorage.getItem(STORAGE_KEYS.LICENSE);
  if (!data) return { licenseKey: '', isActivated: false };
  try {
    return JSON.parse(data);
  } catch {
    return { licenseKey: '', isActivated: false };
  }
};

export const saveLicense = (license: LicenseInfo): void => {
  localStorage.setItem(STORAGE_KEYS.LICENSE, JSON.stringify(license));
};

export const loadProfile = (): CounselorProfile => {
  const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
  if (!data) {
    return {
      fullName: '',
      schoolName: '',
      province: 'كركوك',
      academicYear: '2025-2026',
      schoolType: 'MIDDLE',
      isRegistered: false
    };
  }
  try {
    return JSON.parse(data);
  } catch {
    return {
      fullName: '',
      schoolName: '',
      province: 'كركوك',
      academicYear: '2025-2026',
      schoolType: 'MIDDLE',
      isRegistered: false
    };
  }
};

export const saveProfile = (profile: CounselorProfile): void => {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
};

export const loadStudents = (): Student[] => {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!data) {
    saveStudents(DEFAULT_STUDENTS);
    return DEFAULT_STUDENTS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_STUDENTS;
  }
};

export const saveStudents = (students: Student[]): void => {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
};

export const loadRecords = (): CounselingRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
  if (!data) {
    saveRecords(DEFAULT_RECORDS);
    return DEFAULT_RECORDS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_RECORDS;
  }
};

export const saveRecords = (records: CounselingRecord[]): void => {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
};

export const loadSettings = (): AppSettings => {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!data) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

// ── Trial Edition ─────────────────────────────────────────────────────

// Reset Application to initial state (for testing / fresh installs)
export const resetApplicationData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.LICENSE);
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
  localStorage.removeItem(STORAGE_KEYS.STUDENTS);
  localStorage.removeItem(STORAGE_KEYS.RECORDS);
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.CASE_STUDIES);
  localStorage.removeItem(STORAGE_KEYS.COUNSELING_SESSIONS);
  localStorage.removeItem(STORAGE_KEYS.SPECIAL_CASES);
  localStorage.removeItem(STORAGE_KEYS.HEALTH_RECORDS);
  localStorage.removeItem(STORAGE_KEYS.PARENT_LOSS_RECORDS);
};

// ── Case Study CRUD ─────────────────────────────────────────────────

export const loadCaseStudies = (): CaseStudy[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CASE_STUDIES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveCaseStudies = (cases: CaseStudy[]): void => {
  localStorage.setItem(STORAGE_KEYS.CASE_STUDIES, JSON.stringify(cases));
};

export const addCaseStudy = (c: CaseStudy): void => {
  const all = loadCaseStudies();
  all.push(c);
  saveCaseStudies(all);
};

export const updateCaseStudy = (c: CaseStudy): void => {
  const all = loadCaseStudies();
  const idx = all.findIndex(x => x.id === c.id);
  if (idx >= 0) {
    all[idx] = c;
    saveCaseStudies(all);
  }
};

export const deleteCaseStudy = (id: string): void => {
  const all = loadCaseStudies().filter(x => x.id !== id);
  saveCaseStudies(all);
};

export const getNextCaseNumber = (): string => {
  const all = loadCaseStudies();
  const max = all.reduce((m, c) => {
    const n = parseInt(c.caseNumber.replace('CS-', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'CS-' + String(max + 1).padStart(6, '0');
};

// ── Counseling Session CRUD ──────────────────────────────────────────

export const loadCounselingSessions = (): CounselingSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.COUNSELING_SESSIONS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveCounselingSessions = (sessions: CounselingSession[]): void => {
  localStorage.setItem(STORAGE_KEYS.COUNSELING_SESSIONS, JSON.stringify(sessions));
};

export const addCounselingSession = (s: CounselingSession): void => {
  const all = loadCounselingSessions();
  all.push(s);
  saveCounselingSessions(all);
};

export const updateCounselingSession = (s: CounselingSession): void => {
  const all = loadCounselingSessions();
  const idx = all.findIndex(x => x.id === s.id);
  if (idx >= 0) {
    all[idx] = s;
    saveCounselingSessions(all);
  }
};

export const deleteCounselingSession = (id: string): void => {
  const all = loadCounselingSessions().filter(x => x.id !== id);
  saveCounselingSessions(all);
};

export const getNextSessionNumber = (): string => {
  const all = loadCounselingSessions();
  const max = all.reduce((m, s) => {
    const n = parseInt(s.sessionNumber.replace('GN-', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'GN-' + String(max + 1).padStart(6, '0');
};

// ── Special Cases CRUD ──────────────────────────────────────────────

export const loadSpecialCases = (): SpecialCaseRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SPECIAL_CASES);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveSpecialCases = (cases: SpecialCaseRecord[]): void => {
  localStorage.setItem(STORAGE_KEYS.SPECIAL_CASES, JSON.stringify(cases));
};

export const addSpecialCase = (c: SpecialCaseRecord): void => {
  const all = loadSpecialCases();
  all.push(c);
  saveSpecialCases(all);
};

export const updateSpecialCase = (c: SpecialCaseRecord): void => {
  const all = loadSpecialCases();
  const idx = all.findIndex(x => x.id === c.id);
  if (idx >= 0) {
    all[idx] = c;
    saveSpecialCases(all);
  }
};

export const deleteSpecialCase = (id: string): void => {
  const all = loadSpecialCases().filter(x => x.id !== id);
  saveSpecialCases(all);
};

export const getNextSpecialCaseNumber = (): string => {
  const all = loadSpecialCases();
  const max = all.reduce((m, c) => {
    const n = parseInt(c.recordNumber.replace('SC-', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'SC-' + String(max + 1).padStart(6, '0');
};

// ── Health Record CRUD ──────────────────────────────────────────────

export const loadHealthRecords = (): HealthRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.HEALTH_RECORDS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveHealthRecords = (records: HealthRecord[]): void => {
  localStorage.setItem(STORAGE_KEYS.HEALTH_RECORDS, JSON.stringify(records));
};

export const addHealthRecord = (r: HealthRecord): void => {
  const all = loadHealthRecords();
  all.push(r);
  saveHealthRecords(all);
};

export const updateHealthRecord = (r: HealthRecord): void => {
  const all = loadHealthRecords();
  const idx = all.findIndex(x => x.id === r.id);
  if (idx >= 0) {
    all[idx] = r;
    saveHealthRecords(all);
  }
};

export const deleteHealthRecord = (id: string): void => {
  const all = loadHealthRecords().filter(x => x.id !== id);
  saveHealthRecords(all);
};

export const getNextHealthRecordNumber = (): string => {
  const all = loadHealthRecords();
  const max = all.reduce((m, r) => {
    const n = parseInt(r.recordNumber.replace('HR-', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'HR-' + String(max + 1).padStart(6, '0');
};

// ── Parent Loss Record CRUD ──────────────────────────────────────────

export const loadParentLossRecords = (): ParentLossRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PARENT_LOSS_RECORDS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveParentLossRecords = (records: ParentLossRecord[]): void => {
  localStorage.setItem(STORAGE_KEYS.PARENT_LOSS_RECORDS, JSON.stringify(records));
};

export const addParentLossRecord = (r: ParentLossRecord): void => {
  const all = loadParentLossRecords();
  all.push(r);
  saveParentLossRecords(all);
};

export const updateParentLossRecord = (r: ParentLossRecord): void => {
  const all = loadParentLossRecords();
  const idx = all.findIndex(x => x.id === r.id);
  if (idx >= 0) {
    all[idx] = r;
    saveParentLossRecords(all);
  }
};

export const deleteParentLossRecord = (id: string): void => {
  const all = loadParentLossRecords().filter(x => x.id !== id);
  saveParentLossRecords(all);
};

export const getNextParentLossRecordNumber = (): string => {
  const all = loadParentLossRecords();
  const max = all.reduce((m, r) => {
    const n = parseInt(r.recordNumber.replace('PL-', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'PL-' + String(max + 1).padStart(6, '0');
};
