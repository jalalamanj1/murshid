/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  purgeLegacyActivationData,
  loadProfile, 
  loadStudents, 
  loadRecords, 
  saveStudents, 
  saveRecords, 
  resetApplicationData,
  loadCaseStudies,
  saveCaseStudies,
  addCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  loadCounselingSessions,
  saveCounselingSessions,
  loadSpecialCases,
  saveSpecialCases,
  loadHealthRecords,
  saveHealthRecords,
  loadParentLossRecords,
  saveParentLossRecords,
} from './lib/storage';

import { 
  AppFlowStage, 
  ActiveModule, 
  CounselorProfile, 
  Student, 
  CounselingRecord,
  RecordType,
  CaseStudy,
  CounselingSession,
  SpecialCaseRecord,
  SpecialCaseCategory,
  HealthRecord,
  ParentLossRecord,
} from './types';

// Components
import SplashView from './components/SplashView';
import ActivationGateView from './components/ActivationGateView';
import PasscodeLockView from './components/PasscodeLockView';
import RegistrationView from './components/RegistrationView';
import DesktopWindow from './components/DesktopWindow';
import DashboardView from './components/DashboardViewRedesigned';
import RecordsListView from './components/RecordsListView';
import StudentManagementView from './components/StudentManagementView';
import BackupSyncView from './components/BackupSyncView';
import RepoLibraryView from './components/RepoLibraryView';
import NotificationsView, { type AppNotification } from './components/NotificationsView';
import CaseStudyFormView from './components/CaseStudyFormView';
import CaseStudyListView from './components/CaseStudyListView';
import CounselingSessionFormView from './components/CounselingSessionFormView';
import CounselingSessionListView from './components/CounselingSessionListView';
import SpecialCaseCategorySelectView from './components/SpecialCaseCategorySelectView';
import SpecialCaseFormView from './components/SpecialCaseFormView';
import SpecialCaseListView from './components/SpecialCaseListView';
import HealthRecordFormView from './components/HealthRecordFormView';
import HealthRecordListView from './components/HealthRecordListView';
import ParentLossRecordFormView from './components/ParentLossRecordFormView';
import ParentLossRecordListView from './components/ParentLossRecordListView';
import CaseStudyKeyGuideView from './components/CaseStudyKeyGuideView';
import ExportSection from './components/ExportSection';
import SettingsView from './components/SettingsView';
import UpdatePrompt from './components/UpdatePrompt';
import type { RecordImportResult } from './lib/recordFileImport';
import { academicYear, toLatinDigits } from './lib/format';
import { Theme, getStoredTheme, setTheme as persistTheme } from './lib/theme';
import {
  getActivationStatus,
  submitActivationRequest,
  type ActivationStatusResult,
} from './lib/activationManager';
import { runAutoBackupIfDue } from './lib/backupService';
import { isAppLockEnabled } from './lib/appLock';

import { 
  Users, 
  FileBox, 
  FileText, 
  Sliders, 
  Paperclip, 
  HelpCircle, 
  AlertCircle,
  Plus,
  Award,
} from 'lucide-react';

const EXPORT_FOLDERS: Record<ActiveModule, string> = {
  DASHBOARD: 'لوحة التحكم',
  STUDENTS: 'إدارة الطلبة',
  RECORDS: 'السجلات الإرشادية',
  TEMPLATES: 'أغلفة السجلات',
  DRIVE_LETTERS: 'مخاطبات التربية',
  DRIVE_FILES: 'الملفات',
  BACKUP: 'النسخ الاحتياطي',
  SETTINGS: 'الإعدادات',
  NOTIFICATIONS: 'التنبيهات',
};

export default function App() {
  const [flowStage, setFlowStage] = useState<AppFlowStage>('SPLASH');
  const [activationStatus, setActivationStatus] = useState<ActivationStatusResult | null>(null);
  const activationCheckInFlight = useRef(false);
  const isRegisteredRef = useRef(false);
  const sessionUnlockedRef = useRef(!isAppLockEnabled());

  const [activeModule, setActiveModule] = useState<ActiveModule>('DASHBOARD');
  const [moduleBadges, setModuleBadges] = useState<Partial<Record<ActiveModule, number>>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const activeModuleRef = useRef<ActiveModule>('DASHBOARD');
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  
  const [appVersion, setAppVersion] = useState('1.2.5');
  const [profile, setProfile] = useState<CounselorProfile>({
    fullName: '',
    schoolName: '',
    province: 'كركوك',
    academicYear: '2025-2026',
    schoolType: 'MIDDLE',
    isRegistered: false
  });

  useEffect(() => {
    isRegisteredRef.current = profile.isRegistered;
  }, [profile.isRegistered]);

  useEffect(() => {
    activeModuleRef.current = activeModule;
    try {
      (window as any).electronAPI?.setExportTab?.(EXPORT_FOLDERS[activeModule] || 'مرشد');
    } catch {}
  }, [activeModule]);

  // Printing is only allowed when Windows reports at least one installed
  // printer (USB, Wi-Fi or otherwise). Otherwise nothing is sent to print.
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.repo?.hasPrinter) return;
    const originalPrint = window.print.bind(window);
    const hookedPrint = async () => {
      try {
        const result = await api.repo.hasPrinter();
        if (result && result.hasPrinter === false) {
          window.alert(
            'لا توجد طابعة متصلة. تحقق من توصيل الطابعة عبر USB أو Wi-Fi ثم أعد المحاولة.'
          );
          return;
        }
      } catch {}
      originalPrint();
    };
    (window as any).print = hookedPrint;
    return () => {
      (window as any).print = originalPrint;
    };
  }, []);

  // Repository libraries: track new files, keep per-tab badges and a notice log.
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.repo?.onUpdate) return;

    const repos: Record<string, { module: ActiveModule; label: string }> = {
      files: { module: 'DRIVE_FILES', label: 'الملفات' },
      letters: { module: 'DRIVE_LETTERS', label: 'مخاطبات التربية' },
      covers: { module: 'TEMPLATES', label: 'أغلفة السجلات' },
    };
    const lastError: Record<string, string> = {};
    const isConnectivityError = (message: string) =>
      /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|socket hang up|network error/i.test(
        message || ''
      );

    const pushNotification = (notification: Omit<AppNotification, 'id' | 'at'>) => {
      setNotifications(previous => [
        { ...notification, id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, at: Date.now() },
        ...previous,
      ].slice(0, 80));
    };

    const off = api.repo.onUpdate((data: any) => {
      const meta = data?.key ? repos[data.key] : null;
      if (!meta) return;

      if (data.offline) return;

      if (data.error) {
        if (!isConnectivityError(data.error) && lastError[data.key] !== data.error) {
          lastError[data.key] = data.error;
          pushNotification({ text: `تعذر تحديث ${meta.label}: ${data.error}`, level: 'error' });
          setUnreadNotifications(count => count + 1);
        }
        return;
      }
      lastError[data.key] = '';

      if (!data.initial && Array.isArray(data.added) && data.added.length > 0) {
        const count = data.added.length;
        pushNotification({
          text: `تمت إضافة ${toLatinDigits(count)} ملفاً جديداً إلى ${meta.label}.`,
          level: 'info',
          quiet: true,
        });
        if (activeModuleRef.current !== meta.module) {
          setModuleBadges(previous => ({
            ...previous,
            [meta.module]: (previous[meta.module] || 0) + count,
          }));
        }
      }
    });

    return () => {
      if (typeof off === 'function') off();
    };
  }, []);

  // Automatic local backup: checks once a minute while the app is in use.
  useEffect(() => {
    if (flowStage !== 'MAIN') return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void runAutoBackupIfDue().catch(() => {});
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [flowStage]);

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [selectedRecordType, setSelectedRecordType] = useState<RecordType | null>(null);
  const [recordStartInAdd, setRecordStartInAdd] = useState(false);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [caseStudyMode, setCaseStudyMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingCase, setEditingCase] = useState<CaseStudy | undefined>();
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [counselingSessionMode, setCounselingSessionMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingSession, setEditingSession] = useState<CounselingSession | undefined>();
  const [specialCases, setSpecialCases] = useState<SpecialCaseRecord[]>([]);
  const [specialCaseMode, setSpecialCaseMode] = useState<'LIST' | 'CATEGORY_SELECT' | 'FORM'>('LIST');
  const [editingSpecialCase, setEditingSpecialCase] = useState<SpecialCaseRecord | undefined>();
  const [selectedSpecialCaseCategory, setSelectedSpecialCaseCategory] = useState<SpecialCaseCategory | undefined>();
  const [specialCasesFromDashboard, setSpecialCasesFromDashboard] = useState(false);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [healthRecordMode, setHealthRecordMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingHealthRecord, setEditingHealthRecord] = useState<HealthRecord | undefined>();
  const [parentLossRecords, setParentLossRecords] = useState<ParentLossRecord[]>([]);
  const [parentLossMode, setParentLossMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [editingParentLoss, setEditingParentLoss] = useState<ParentLossRecord | undefined>();
  
  const [saveFolder, setSaveFolder] = useState(() => {
    return localStorage.getItem('murshid_save_folder') || '';
  });

  const handlePickSaveFolder = async () => {
    try {
      const api = (window as any).electronAPI;
      if (api?.pickFolder) {
        const result = await api.pickFolder();
        if (result?.canceled) return;
        if (result?.filePaths?.[0]) {
          setSaveFolder(result.filePaths[0]);
          localStorage.setItem('murshid_save_folder', result.filePaths[0]);
        }
      } else {
        const folder = prompt('أدخل مسار مجلد حفظ السجلات:', saveFolder);
        if (folder && folder.trim()) {
          setSaveFolder(folder.trim());
          localStorage.setItem('murshid_save_folder', folder.trim());
        }
      }
    } catch {}
  };

  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.getAppVersion) {
      electron.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  // Load configuration on mount
  useEffect(() => {
    purgeLegacyActivationData();

    const activeProfile = loadProfile();
    setProfile(activeProfile);
    setStudents(loadStudents());
    setRecords(loadRecords());
    setCaseStudies(loadCaseStudies());
    setCounselingSessions(loadCounselingSessions());
    setSpecialCases(loadSpecialCases());
    setHealthRecords(loadHealthRecords());
    setParentLossRecords(loadParentLossRecords());

    // Initialize AI context with user and app info
    try {
      const e = (window as any).electronAPI;
      if (e?.updateUserContext) {
        e.updateUserContext({
          fullName: activeProfile.fullName,
          schoolName: activeProfile.schoolName,
          schoolType: activeProfile.schoolType,
          province: activeProfile.province,
          academicYear: activeProfile.academicYear,
        });
      }
      if (e?.updateAppContext) {
        e.updateAppContext({ currentModule: 'DASHBOARD', currentPage: 'الرئيسية ولوحة التحكم' });
      }
    } catch {}
  }, []);

  // -----------------------------------------------------------------------
  // Activation Manager gate
  // -----------------------------------------------------------------------
  const checkActivationStatus = useCallback(async () => {
    if (activationCheckInFlight.current) return;
    activationCheckInFlight.current = true;
    try {
      const status = await getActivationStatus();
      setActivationStatus(status);

      switch (status.status) {
        case 'error':
          // Network/API problems must not lock an already activated install.
          break;
        case 'approved':
          setFlowStage((prev) => {
            if (prev !== 'SPLASH' && prev !== 'ACTIVATION') return prev;
            if (isAppLockEnabled() && !sessionUnlockedRef.current) return 'LOCK';
            return isRegisteredRef.current ? 'MAIN' : 'REGISTRATION';
          });
          break;
        case 'none':
        case 'pending':
        case 'rejected':
        case 'revoked':
        case 'expired':
        case 'invalid':
        default:
          // Any non-approved state blocks the app and returns to activation.
          setFlowStage('ACTIVATION');
          break;
      }
    } finally {
      activationCheckInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    checkActivationStatus();

    const quick =
      activationStatus?.status !== 'approved' && activationStatus?.status !== 'error';
    // Wait quickly for approval / re-approval; once approved, re-check hourly
    // so a revocation/expiry disables the app automatically.
    const timer = setInterval(checkActivationStatus, quick ? 5_000 : 60_000);

    const onFocus = () => checkActivationStatus();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkActivationStatus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkActivationStatus, activationStatus?.status]);

  const handleSplashComplete = async () => {
    await checkActivationStatus();
    // If the status could not be verified (offline/API error) keep the app
    // blocked on the activation screen instead of entering the workspace.
    setFlowStage((prev) => (prev === 'SPLASH' ? 'ACTIVATION' : prev));
  };

  const handleActivationSubmit = async (data: {
    fullName: string;
    phone: string;
    location: string;
    notes?: string;
  }) => {
    const result = await submitActivationRequest(data.fullName, data.phone, data.location, data.notes);
    if (!result.success) {
      throw new Error(result.error || 'تعذر إرسال طلب التنشيط.');
    }
    // Refresh immediately so the UI shows "pending" without any manual action.
    void checkActivationStatus();
  };

  const handleRegistered = (prof: CounselorProfile) => {
    setProfile(prof);
    setFlowStage('MAIN');
  };

  const handleUnlock = () => {
    sessionUnlockedRef.current = true;
    setFlowStage(profile.isRegistered ? 'MAIN' : 'REGISTRATION');
  };

  const handleClearStudentsAndCases = () => {
    setStudents([]);
    saveStudents([]);
    const filtered = records.filter(r => r.recordType === 'DAILY_ACTIVITY_PLAN' || !r.studentId);
    setRecords(filtered);
    saveRecords(filtered);
    setCaseStudies([]);
    saveCaseStudies([]);
    setCounselingSessions([]);
    saveCounselingSessions([]);
    setSpecialCases([]);
    saveSpecialCases([]);
  };

  const relatedRecordCount = (ids: string[]) => {
    const remove = new Set(ids);
    const matches = (studentId?: string) => Boolean(studentId && remove.has(studentId));
    return (
      records.filter(r => matches(r.studentId)).length +
      healthRecords.filter(r => matches(r.studentId)).length +
      parentLossRecords.filter(r => matches(r.studentId)).length +
      caseStudies.filter(r => matches(r.studentId)).length +
      specialCases.filter(r => matches(r.studentId) || (r.studentIds || []).some(id => remove.has(id))).length
    );
  };

  /**
   * Delete students. With `deleteRelatedRecords`, every register is purged;
   * otherwise the records are kept as history and only detached from the
   * student so no record points at a deleted id.
   */
  const deleteStudents = (ids: string[], deleteRelatedRecords = false) => {
    const remove = new Set(ids);
    const updatedStudents = students.filter(s => !remove.has(s.id));
    setStudents(updatedStudents);
    saveStudents(updatedStudents);

    const detachedRecords = records.map(r =>
      r.studentId && remove.has(r.studentId) ? { ...r, studentId: '' } : r
    );
    const detachedHealth = healthRecords.map(r =>
      r.studentId && remove.has(r.studentId) ? { ...r, studentId: '' } : r
    );
    const detachedParentLoss = parentLossRecords.map(r =>
      r.studentId && remove.has(r.studentId) ? { ...r, studentId: '' } : r
    );
    const detachedCases = caseStudies.map(r =>
      r.studentId && remove.has(r.studentId) ? { ...r, studentId: '' } : r
    );

    // Special cases can cover several students at once.
    const stripSpecialCases = (dropEmpty: boolean) =>
      specialCases.flatMap(record => {
        const studentIds = record.studentIds || [];
        if (studentIds.length === 0) {
          if (record.studentId && remove.has(record.studentId)) {
            return dropEmpty ? [] : [{ ...record, studentId: '', studentIds: [], studentNames: [] }];
          }
          return [record];
        }

        const keepIds: string[] = [];
        const keepNames: string[] = [];
        studentIds.forEach((id, index) => {
          if (!remove.has(id)) {
            keepIds.push(id);
            keepNames.push((record.studentNames || [])[index] || '');
          }
        });

        if (keepIds.length === 0) {
          return dropEmpty ? [] : [{ ...record, studentId: '', studentIds: [], studentNames: [] }];
        }
        return [{
          ...record,
          studentIds: keepIds,
          studentNames: keepNames,
          studentId: keepIds[0],
          studentName: keepNames[0] || record.studentName,
        }];
      });

    const nextRecords = deleteRelatedRecords
      ? records.filter(r => !(r.studentId && remove.has(r.studentId)))
      : detachedRecords;
    const nextHealth = deleteRelatedRecords
      ? healthRecords.filter(r => !(r.studentId && remove.has(r.studentId)))
      : detachedHealth;
    const nextParentLoss = deleteRelatedRecords
      ? parentLossRecords.filter(r => !(r.studentId && remove.has(r.studentId)))
      : detachedParentLoss;
    const nextCases = deleteRelatedRecords
      ? caseStudies.filter(r => !(r.studentId && remove.has(r.studentId)))
      : detachedCases;
    const nextSpecialCases = deleteRelatedRecords ? stripSpecialCases(true) : stripSpecialCases(false);

    setRecords(nextRecords);
    saveRecords(nextRecords);
    setHealthRecords(nextHealth);
    saveHealthRecords(nextHealth);
    setParentLossRecords(nextParentLoss);
    saveParentLossRecords(nextParentLoss);
    setCaseStudies(nextCases);
    saveCaseStudies(nextCases);
    setSpecialCases(nextSpecialCases);
    saveSpecialCases(nextSpecialCases);
  };

  const handleDeleteStudent = (id: string) => deleteStudents([id], false);



  // Render the core active module inside the Content Area
  const coverValues: Record<string, string> = {
    school_name: profile.schoolName || '',
    academic_year: profile.academicYear ? academicYear(profile.academicYear) : '',
    title: profile.counselorGender === 'FEMALE' ? 'المرشدة التربوية' : 'المرشد التربوي',
    counselor_name: profile.fullName || '',
  };

  const dashboardRecordCounts: Partial<Record<RecordType, number>> = {
    HEALTH_STATUS: healthRecords.length,
    SPECIAL_CASES: specialCases.length,
    GROUP_INDIVIDUAL: counselingSessions.length,
    BEREAVED_STUDENTS: parentLossRecords.length,
    CASE_STUDY: caseStudies.length,
    HEALTH_KEY_GUIDE: caseStudies.filter(c => c.status === 'CLOSED').length,
    DAILY_ACTIVITY_PLAN: records.filter(r => r.recordType === 'DAILY_ACTIVITY_PLAN').length,
  };

  const renderActiveModuleContent = () => {
    switch (activeModule) {
      case 'DASHBOARD':
        // If user launched Special Cases from Dashboard, show category select / form inline
        if (specialCasesFromDashboard) {
          if (specialCaseMode === 'CATEGORY_SELECT') {
            return (
              <SpecialCaseCategorySelectView
                onSelect={(cat) => {
                  setSelectedSpecialCaseCategory(cat);
                  setSpecialCaseMode('FORM');
                }}
                onCancel={() => {
                  setSpecialCasesFromDashboard(false);
                  setSpecialCaseMode('LIST');
                  setSelectedSpecialCaseCategory(undefined);
                }}
              />
            );
          }

          if (specialCaseMode === 'FORM') {
            return (
              <SpecialCaseFormView
                students={students}
                category={selectedSpecialCaseCategory || 'GIFTED_TALENTED'}
                existing={editingSpecialCase}
                onSave={(r) => {
                  if (editingSpecialCase) {
                    const updated = specialCases.map(x => x.id === r.id ? r : x);
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  } else {
                    const updated = [r, ...specialCases];
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  }
                  setSpecialCasesFromDashboard(false);
                  setSpecialCaseMode('LIST');
                  setEditingSpecialCase(undefined);
                  setSelectedSpecialCaseCategory(undefined);
                }}
                onSaveAndNew={(r) => {
                  if (editingSpecialCase) {
                    const updated = specialCases.map(x => x.id === r.id ? r : x);
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  } else {
                    const updated = [r, ...specialCases];
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  }
                  setEditingSpecialCase(undefined);
                  setSpecialCaseMode('FORM');
                }}
                onCancel={() => {
                  setSpecialCasesFromDashboard(false);
                  setSpecialCaseMode('LIST');
                  setEditingSpecialCase(undefined);
                  setSelectedSpecialCaseCategory(undefined);
                }}
              />
            );
          }
        }

        return (
          <DashboardView 
            profile={profile} 
            students={students} 
            records={records} 
            onNavigate={handleNavigate}
            onQuickAddStudent={() => setActiveModule('STUDENTS')}
            onQuickAddRecord={() => setActiveModule('RECORDS')}
            onAddRecord={(newRecord) => {
              const updated = [newRecord, ...records];
              setRecords(updated);
              saveRecords(updated);
            }}
            onDeleteRecord={(recordId) => {
              const updated = records.filter(r => r.id !== recordId);
              setRecords(updated);
              saveRecords(updated);
            }}
                    onClearStudentsAndCases={handleClearStudentsAndCases}
            onOpenRecordsForType={openRecordList}
            onCreateRecordForType={openRecordForm}
            recordCounts={dashboardRecordCounts}
          />
        );

      case 'STUDENTS':
        return (
          <StudentManagementView
            students={students}
            records={records}
            profile={profile}
            onAddStudent={(student) => {
              setStudents(prev => {
                const updated = [...prev, student];
                saveStudents(updated);
                return updated;
              });
            }}
            onImportStudents={(newStudents: Student[]) => {
              setStudents(prev => {
                const updated = [...prev, ...newStudents];
                saveStudents(updated);
                return updated;
              });
            }}
            onUpdateStudent={(student) => {
              setStudents(prev => {
                const updated = prev.map(s => s.id === student.id ? student : s);
                saveStudents(updated);
                return updated;
              });
            }}
            onDeleteStudent={handleDeleteStudent}
            onDeleteStudents={deleteStudents}
            getStudentRelatedCount={relatedRecordCount}
            onOpenRecords={() => setActiveModule('RECORDS')}
          />
        );

      case 'RECORDS':
        // CASE_STUDY has its own dedicated system
        if (selectedRecordType === 'CASE_STUDY') {
          if (caseStudyMode === 'CREATE' || caseStudyMode === 'EDIT') {
            return (
              <CaseStudyFormView
                students={students}
                profile={profile}
                existingCase={editingCase}
                onSave={(cs) => {
                  if (editingCase) {
                    const updated = caseStudies.map(c => c.id === cs.id ? cs : c);
                    setCaseStudies(updated);
                    saveCaseStudies(updated);
                  } else {
                    const updated = [cs, ...caseStudies];
                    setCaseStudies(updated);
                    saveCaseStudies(updated);
                  }
                  setCaseStudyMode('LIST');
                  setEditingCase(undefined);
                }}
                onSaveAndNew={(cs) => {
                  if (editingCase) {
                    const updated = caseStudies.map(c => c.id === cs.id ? cs : c);
                    setCaseStudies(updated);
                    saveCaseStudies(updated);
                  } else {
                    const updated = [cs, ...caseStudies];
                    setCaseStudies(updated);
                    saveCaseStudies(updated);
                  }
                  setEditingCase(undefined);
                  setCaseStudyMode('CREATE');
                }}
                onCancel={() => { setCaseStudyMode('LIST'); setEditingCase(undefined); }}
              />
            );
          }

          return (
            <>
              <ExportSection
                recordType="study-case"
                recordLabel="دراسات الحالة"
                records={caseStudies}
                enrich={(cs) => {
                  const student = students.find(s => s.id === cs.studentId);
                  return student
                    ? { ...cs, studentName: cs.studentName || student.fullName, dateofbirth: student.birthDate }
                    : cs;
                }}
              />
              <CaseStudyListView
                students={students}
                profile={profile}
                caseStudies={caseStudies}
                onEdit={(cs) => { setEditingCase(cs); setCaseStudyMode('EDIT'); }}
                onDelete={(id) => {
                  const updated = caseStudies.filter(c => c.id !== id);
                  setCaseStudies(updated);
                  saveCaseStudies(updated);
                }}
                onNew={() => { setEditingCase(undefined); setCaseStudyMode('CREATE'); }}
                onDeleteMany={(ids) => {
                  const remove = new Set(ids);
                  const updated = caseStudies.filter(c => !remove.has(c.id));
                  setCaseStudies(updated);
                  saveCaseStudies(updated);
                }}
                onBack={() => setSelectedRecordType(null)}
              />
            </>
          );
        }

        // GROUP_INDIVIDUAL has its own dedicated counseling session system
        if (selectedRecordType === 'GROUP_INDIVIDUAL') {
          if (counselingSessionMode === 'CREATE' || counselingSessionMode === 'EDIT') {
            return (
              <CounselingSessionFormView
                existing={editingSession}
                onSave={(s) => {
                  if (editingSession) {
                    const updated = counselingSessions.map(x => x.id === s.id ? s : x);
                    setCounselingSessions(updated);
                    saveCounselingSessions(updated);
                  } else {
                    const updated = [s, ...counselingSessions];
                    setCounselingSessions(updated);
                    saveCounselingSessions(updated);
                  }
                  setCounselingSessionMode('LIST');
                  setEditingSession(undefined);
                }}
                onSaveAndNew={(s) => {
                  if (editingSession) {
                    const updated = counselingSessions.map(x => x.id === s.id ? s : x);
                    setCounselingSessions(updated);
                    saveCounselingSessions(updated);
                  } else {
                    const updated = [s, ...counselingSessions];
                    setCounselingSessions(updated);
                    saveCounselingSessions(updated);
                  }
                  setEditingSession(undefined);
                  setCounselingSessionMode('CREATE');
                }}
                onCancel={() => { setCounselingSessionMode('LIST'); setEditingSession(undefined); }}
              />
            );
          }

          return (
            <>
              <ExportSection recordType="individual-counseling" recordLabel="إرشاد فردي" records={counselingSessions} />
              <ExportSection recordType="group-counseling" recordLabel="إرشاد جماعي" records={counselingSessions} />
              <CounselingSessionListView
                sessions={counselingSessions}
                profile={profile}
                onEdit={(s) => { setEditingSession(s); setCounselingSessionMode('EDIT'); }}
                onDelete={(id) => {
                  const updated = counselingSessions.filter(x => x.id !== id);
                  setCounselingSessions(updated);
                  saveCounselingSessions(updated);
                }}
                onNew={() => { setEditingSession(undefined); setCounselingSessionMode('CREATE'); }}
                onDeleteMany={(ids) => {
                  const remove = new Set(ids);
                  const updated = counselingSessions.filter(x => !remove.has(x.id));
                  setCounselingSessions(updated);
                  saveCounselingSessions(updated);
                }}
                onBack={() => setSelectedRecordType(null)}
              />
            </>
          );
        }

        // SPECIAL_CASES has its own dedicated system with category selection
        if (selectedRecordType === 'SPECIAL_CASES') {
          // Step 1: Category selection (NO export actions here)
          if (specialCaseMode === 'CATEGORY_SELECT' || !selectedSpecialCaseCategory) {
            return (
              <SpecialCaseCategorySelectView
                onSelect={(cat) => {
                  setSelectedSpecialCaseCategory(cat);
                  setSpecialCaseMode('LIST');
                }}
                onCancel={() => {
                  setSelectedRecordType(null);
                  setSpecialCaseMode('LIST');
                  setSelectedSpecialCaseCategory(undefined);
                }}
              />
            );
          }

          // Step 2: Form (create or edit) — stays within the selected category
          if (specialCaseMode === 'FORM') {
            return (
              <SpecialCaseFormView
                students={students}
                category={selectedSpecialCaseCategory || 'GIFTED_TALENTED'}
                existing={editingSpecialCase}
                onSave={(r) => {
                  if (editingSpecialCase) {
                    const updated = specialCases.map(x => x.id === r.id ? r : x);
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  } else {
                    const updated = [r, ...specialCases];
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  }
                  setSpecialCaseMode('LIST');
                  setEditingSpecialCase(undefined);
                }}
                onSaveAndNew={(r) => {
                  if (editingSpecialCase) {
                    const updated = specialCases.map(x => x.id === r.id ? r : x);
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  } else {
                    const updated = [r, ...specialCases];
                    setSpecialCases(updated);
                    saveSpecialCases(updated);
                  }
                  setEditingSpecialCase(undefined);
                  setSpecialCaseMode('FORM');
                }}
                onCancel={() => {
                  setSpecialCaseMode('LIST');
                  setEditingSpecialCase(undefined);
                }}
              />
            );
          }

          // Step 3: List view (scoped to one category) — export actions appear here
          return (
            <SpecialCaseListView
              records={specialCases}
              students={students}
              category={selectedSpecialCaseCategory}
              onNew={(cat) => {
                setSelectedSpecialCaseCategory(cat);
                setEditingSpecialCase(undefined);
                setSpecialCaseMode('FORM');
              }}
              onEdit={(r) => {
                setEditingSpecialCase(r);
                setSelectedSpecialCaseCategory(r.category);
                setSpecialCaseMode('FORM');
              }}
              onDelete={(id) => {
                const updated = specialCases.filter(x => x.id !== id);
                setSpecialCases(updated);
                saveSpecialCases(updated);
              }}
              onDeleteMany={(ids) => {
                const remove = new Set(ids);
                const updated = specialCases.filter(x => !remove.has(x.id));
                setSpecialCases(updated);
                saveSpecialCases(updated);
              }}
              onBack={() => {
                setSpecialCaseMode('CATEGORY_SELECT');
                setSelectedSpecialCaseCategory(undefined);
              }}
            />
          );
        }

        // HEALTH_STATUS has its own dedicated system
        if (selectedRecordType === 'HEALTH_STATUS') {
          // Form (create or edit)
          if (healthRecordMode === 'CREATE' || healthRecordMode === 'EDIT') {
            return (
              <HealthRecordFormView
                students={students}
                existing={editingHealthRecord}
                onSave={(r) => {
                  if (editingHealthRecord) {
                    const updated = healthRecords.map(x => x.id === r.id ? r : x);
                    setHealthRecords(updated);
                    saveHealthRecords(updated);
                  } else {
                    const updated = [r, ...healthRecords];
                    setHealthRecords(updated);
                    saveHealthRecords(updated);
                  }
                  setHealthRecordMode('LIST');
                  setEditingHealthRecord(undefined);
                }}
                onSaveAndNew={(r) => {
                  if (editingHealthRecord) {
                    const updated = healthRecords.map(x => x.id === r.id ? r : x);
                    setHealthRecords(updated);
                    saveHealthRecords(updated);
                  } else {
                    const updated = [r, ...healthRecords];
                    setHealthRecords(updated);
                    saveHealthRecords(updated);
                  }
                  setEditingHealthRecord(undefined);
                  setHealthRecordMode('CREATE');
                }}
                onCancel={() => {
                  setHealthRecordMode('LIST');
                  setEditingHealthRecord(undefined);
                }}
              />
            );
          }

          // Default: List view
          return (
            <>
              <ExportSection recordType="health-record" recordLabel="السجلات الصحية" records={healthRecords} />
              <HealthRecordListView
                records={healthRecords}
                students={students}
                onEdit={(r) => {
                  setEditingHealthRecord(r);
                  setHealthRecordMode('EDIT');
                }}
                onDelete={(id) => {
                  const updated = healthRecords.filter(x => x.id !== id);
                  setHealthRecords(updated);
                  saveHealthRecords(updated);
                }}
                onNew={() => { setEditingHealthRecord(undefined); setHealthRecordMode('CREATE'); }}
                onDeleteMany={(ids) => {
                  const remove = new Set(ids);
                  const updated = healthRecords.filter(x => !remove.has(x.id));
                  setHealthRecords(updated);
                  saveHealthRecords(updated);
                }}
                onBack={() => {
                  setSelectedRecordType(null);
                  setHealthRecordMode('LIST');
                }}
              />
            </>
          );
        }

        // BEREAVED_STUDENTS has its own dedicated system
        if (selectedRecordType === 'BEREAVED_STUDENTS') {
          if (parentLossMode === 'CREATE' || parentLossMode === 'EDIT') {
            return (
              <ParentLossRecordFormView
                students={students}
                existing={editingParentLoss}
                onSave={(r) => {
                  if (editingParentLoss) {
                    const updated = parentLossRecords.map(x => x.id === r.id ? r : x);
                    setParentLossRecords(updated);
                    saveParentLossRecords(updated);
                  } else {
                    const updated = [r, ...parentLossRecords];
                    setParentLossRecords(updated);
                    saveParentLossRecords(updated);
                  }
                  setParentLossMode('LIST');
                  setEditingParentLoss(undefined);
                }}
                onSaveAndNew={(r) => {
                  if (editingParentLoss) {
                    const updated = parentLossRecords.map(x => x.id === r.id ? r : x);
                    setParentLossRecords(updated);
                    saveParentLossRecords(updated);
                  } else {
                    const updated = [r, ...parentLossRecords];
                    setParentLossRecords(updated);
                    saveParentLossRecords(updated);
                  }
                  setEditingParentLoss(undefined);
                  setParentLossMode('CREATE');
                }}
                onCancel={() => {
                  setParentLossMode('LIST');
                  setEditingParentLoss(undefined);
                }}
              />
            );
          }

          // Default: List view
          return (
            <>
              <ExportSection recordType="parent-loss" recordLabel="سجل فاقدي الوالدين" records={parentLossRecords} />
              <ParentLossRecordListView
                records={parentLossRecords}
                students={students}
                onEdit={(r) => {
                  setEditingParentLoss(r);
                  setParentLossMode('EDIT');
                }}
                onDelete={(id) => {
                  const updated = parentLossRecords.filter(x => x.id !== id);
                  setParentLossRecords(updated);
                  saveParentLossRecords(updated);
                }}
                onNew={() => { setEditingParentLoss(undefined); setParentLossMode('CREATE'); }}
                onDeleteMany={(ids) => {
                  const remove = new Set(ids);
                  const updated = parentLossRecords.filter(x => !remove.has(x.id));
                  setParentLossRecords(updated);
                  saveParentLossRecords(updated);
                }}
                onBack={() => {
                  setSelectedRecordType(null);
                  setParentLossMode('LIST');
                }}
              />
            </>
          );
        }

        // HEALTH_KEY_GUIDE is a read-only key guide for case studies
        if (selectedRecordType === 'HEALTH_KEY_GUIDE') {
          return (
            <CaseStudyKeyGuideView
              students={students}
              profile={profile}
              caseStudies={caseStudies}
              onOpenCaseStudy={(cs) => {
                setEditingCase(cs);
                setCaseStudyMode('EDIT');
                setSelectedRecordType('CASE_STUDY');
              }}
              onBack={() => setSelectedRecordType(null)}
            />
          );
        }

        // Other record types use the original RecordsListView
        if (selectedRecordType) {
          const matchedTypeInfo = [
            { type: 'HEALTH_STATUS', name: 'سجل الحالة الصحية' },
            { type: 'SPECIAL_CASES', name: 'سجل الحالات الخاصة' },
            { type: 'GROUP_INDIVIDUAL', name: 'سجل الإرشاد الجمعي والفردي' },
            { type: 'BEREAVED_STUDENTS', name: 'سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)' },
            { type: 'CASE_STUDY', name: 'سجل دراسة الحالة' },
            { type: 'HEALTH_KEY_GUIDE', name: 'سجل الدليل (المفتاح) لدراسة الحالة' },
            { type: 'DAILY_ACTIVITY_PLAN', name: 'سجل النشاط اليومي' }
          ].find(t => t.type === selectedRecordType);

          return (
            <RecordsListView
              recordType={selectedRecordType}
              recordTypeName={matchedTypeInfo?.name || 'السجل الإرشادي'}
              records={records}
              students={students}
              profile={profile}
              onAddRecord={(newRecord) => {
                const updated = [newRecord, ...records];
                setRecords(updated);
                saveRecords(updated);
              }}
              onUpdateRecord={(updatedRecord) => {
                const updated = records.map(r => r.id === updatedRecord.id ? updatedRecord : r);
                setRecords(updated);
                saveRecords(updated);
              }}
              onDeleteRecord={(recordId) => {
                const updated = records.filter(r => r.id !== recordId);
                setRecords(updated);
                saveRecords(updated);
              }}
              onDeleteMany={(ids) => {
                const remove = new Set(ids);
                const updated = records.filter(r => !remove.has(r.id));
                setRecords(updated);
                saveRecords(updated);
              }}
              onBack={() => {
                setSelectedRecordType(null);
                setRecordStartInAdd(false);
              }}
              startInAddForm={recordStartInAdd}
            />
          );
        }

        return (
          <div className="flex flex-col gap-6">
            <header>
              <p className="kicker">السجلات الإرشادية</p>
              <h1 className="mt-1.5 text-[24px] font-black leading-tight text-main">سجلات المرشد التربوي</h1>
              <p className="mt-1.5 text-[12px] font-semibold text-sec">
                سبعة سجلات رسمية — افتح أي سجل لمتابعة بياناته، أو أضف تدويناً جديداً مباشرة.
              </p>
            </header>

            <section className="overflow-hidden rounded-[14px] border border-border-color bg-card shadow-xs">
              <ul>
                {[
                  { type: 'HEALTH_STATUS', name: 'سجل الحالة الصحية', desc: 'رصد الحالات الصحية ومتابعة العلاج المدرسي.' },
                  { type: 'SPECIAL_CASES', name: 'سجل الحالات الخاصة', desc: 'متابعة ذوي الاحتياجات الخاصة والحالات الحرجة.' },
                  { type: 'GROUP_INDIVIDUAL', name: 'سجل الإرشاد الجمعي والفردي', desc: 'توثيق جلسات الدعم والاستشارات الفردية والجماعية.' },
                  { type: 'BEREAVED_STUDENTS', name: 'سجل الطلبة الفاقدين', desc: 'رعاية الأيتام وفاقدي المعيل ودعمهم المتكامل.' },
                  { type: 'CASE_STUDY', name: 'سجل دراسة الحالة', desc: 'دراسة معمقة للظواهر السلوكية المعقدة.' },
                  { type: 'HEALTH_KEY_GUIDE', name: 'سجل الدليل (المفتاح)', desc: 'دليل تصنيف الأمراض وتوصيات المتابعة الوقائية.', readOnly: true },
                  { type: 'DAILY_ACTIVITY_PLAN', name: 'سجل النشاط اليومي', desc: 'خطة النشاط الإرشادي وتدوين اليوميات التنفيذية.' },
                ].map((item, index) => (
                  <li
                    key={item.type}
                    onClick={() => openRecordList(item.type as RecordType)}
                    className="group flex cursor-pointer items-center gap-2 border-b border-divider-color px-4 py-2.5 last:border-0 hover:bg-hover"
                  >
                    <span className="num w-5 shrink-0 text-[10px] font-bold text-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="w-[205px] shrink-0 truncate text-[11.5px] font-bold text-main">
                      {item.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-muted">{item.desc}</span>
                    {!item.readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRecordForm(item.type as RecordType);
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-[8px] border border-border-color bg-card px-2.5 py-1.5 text-[10px] font-bold text-primary transition-colors hover:border-primary-border hover:bg-primary-bg"
                      >
                        <Plus className="h-3 w-3" strokeWidth={2.4} />
                        إضافة
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        );

      case 'TEMPLATES':
        return <RepoLibraryView repoKey="covers" title="أغلفة السجلات" mode="covers" coverValues={coverValues} />;

      case 'BACKUP':
        return <BackupSyncView />;

      case 'DRIVE_LETTERS':
        return <RepoLibraryView repoKey="letters" title="مخاطبات التربية" />;

      case 'DRIVE_FILES':
        return <RepoLibraryView repoKey="files" title="الملفات" />;

      case 'NOTIFICATIONS':
        return (
          <NotificationsView
            notifications={notifications}
            onClear={() => {
              setNotifications([]);
              setUnreadNotifications(0);
            }}
          />
        );

      case 'SETTINGS':
        return (
          <SettingsView
            profile={profile}
            appVersion={appVersion}
            theme={theme}
            onThemeChange={(next) => {
              setThemeState(next);
              persistTheme(next);
            }}
            saveFolder={saveFolder}
            onPickSaveFolder={handlePickSaveFolder}
            students={students}
            onImportRecords={handleImportRecordResult}
          />
        );

      default:
        return null;
    }
  };

  // Flow Stage Routing
  if (flowStage === 'SPLASH') {
    return <SplashView onComplete={handleSplashComplete} />;
  }

  if (flowStage === 'ACTIVATION') {
    return (
      <ActivationGateView
        activationStatus={activationStatus}
        onRetry={() => void checkActivationStatus()}
        onSubmit={handleActivationSubmit}
      />
    );
  }

  if (flowStage === 'LOCK') {
    return <PasscodeLockView onUnlock={handleUnlock} />;
  }

  if (flowStage === 'REGISTRATION') {
    return <RegistrationView onComplete={handleRegistered} />;
  }

  const handleNavigate = (mod: ActiveModule) => {
    setModuleBadges(previous => (previous[mod] ? { ...previous, [mod]: 0 } : previous));
    if (mod === 'NOTIFICATIONS') setUnreadNotifications(0);
    // Reset all module-specific state when navigating
    setSelectedRecordType(null);
    setRecordStartInAdd(false);
    setSpecialCaseMode('LIST');
    setSelectedSpecialCaseCategory(undefined);
    setEditingSpecialCase(undefined);
    setSpecialCasesFromDashboard(false);
    setCounselingSessionMode('LIST');
    setEditingSession(undefined);
    setCaseStudyMode('LIST');
    setEditingCase(undefined);
    setHealthRecordMode('LIST');
    setEditingHealthRecord(undefined);
    setParentLossMode('LIST');
    setEditingParentLoss(undefined);
    setActiveModule(mod);

    // Update AI context with current screen
    const screenNames: Record<string, string> = {
      DASHBOARD: 'لوحة التحكم الرئيسية',
      STUDENTS: 'إدارة الطلاب',
      RECORDS: 'السجلات الإرشادية',
      TEMPLATES: 'أغلفة سجلات الإرشاد',
      BACKUP: 'النسخ الاحتياطي',
      DRIVE_LETTERS: 'مخاطبات التربية',
      DRIVE_FILES: 'الملفات',
      SETTINGS: 'الإعدادات',
      NOTIFICATIONS: 'التنبيهات',
    };
    try {
      const e = (window as any).electronAPI;
      if (e?.updateAppContext) {
        e.updateAppContext({ currentModule: mod, currentPage: screenNames[mod] || mod });
      }
    } catch {}
  };

  /** Open a record's list without starting the entry form. */
  const openRecordList = (rt: RecordType) => {
    setEditingCase(undefined);
    setEditingSession(undefined);
    setEditingSpecialCase(undefined);
    setEditingHealthRecord(undefined);
    setEditingParentLoss(undefined);
    setRecordStartInAdd(false);
    setActiveModule('RECORDS');
    setSelectedRecordType(rt);

    if (rt === 'SPECIAL_CASES') {
      setSpecialCasesFromDashboard(false);
      setSelectedSpecialCaseCategory(undefined);
      setSpecialCaseMode('CATEGORY_SELECT');
      return;
    }
    if (rt === 'CASE_STUDY') setCaseStudyMode('LIST');
    if (rt === 'GROUP_INDIVIDUAL') setCounselingSessionMode('LIST');
    if (rt === 'HEALTH_STATUS') setHealthRecordMode('LIST');
    if (rt === 'BEREAVED_STUDENTS') setParentLossMode('LIST');
  };

  /** Open a record straight into its "add new" form — never a popup. */
  const openRecordForm = (rt: RecordType) => {
    openRecordList(rt);
    switch (rt) {
      case 'SPECIAL_CASES':
        setSpecialCasesFromDashboard(true);
        setSpecialCaseMode('CATEGORY_SELECT');
        break;
      case 'GROUP_INDIVIDUAL':
        setCounselingSessionMode('CREATE');
        break;
      case 'CASE_STUDY':
        setCaseStudyMode('CREATE');
        break;
      case 'HEALTH_STATUS':
        setHealthRecordMode('CREATE');
        break;
      case 'BEREAVED_STUDENTS':
        setParentLossMode('CREATE');
        break;
      case 'DAILY_ACTIVITY_PLAN':
        setRecordStartInAdd(true);
        break;
      case 'HEALTH_KEY_GUIDE':
        break;
    }
  };

  /** Stable content signature used to avoid importing the same record twice. */
  const importSignature = (kind: RecordImportResult['kind'], record: any): string => {
    const norm = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    let parts: unknown[] = [];
    switch (kind) {
      case 'health':
        parts = [record.studentName, record.grade, record.section, record.diseaseType, record.diseaseDescription, record.procedures, record.address];
        break;
      case 'parentLoss':
        parts = [record.studentName, record.lossType, record.livesWith, record.academicLevelBeforeLoss, record.academicLevelAfterLoss, record.studentBehavior, record.additionalNotes];
        break;
      case 'session':
        parts = [record.sessionTitle, record.sessionDate, record.generalObjective, record.specificObjectives, record.activity];
        break;
      case 'caseStudy':
        parts = [record.studentName, record.caseNumber, record.referralSource, record.caseDate, (record.caseTypes || []).join(','), record.livesWith];
        break;
      case 'specialCase':
        parts = [record.studentName, record.category, record.talentType, record.delayType, record.absenceType, record.procedures];
        break;
      default:
        parts = [record.recordType, record.date, record.title, record.description];
        break;
    }
    return parts.map(norm).join('|');
  };

  /** Merge records imported from DOCX/Excel files through Settings. */
  const handleImportRecordResult = (result: RecordImportResult): number => {
    const fresh = (list: any[], kind: RecordImportResult['kind']) => {
      const seen = new Set(list.map((record) => importSignature(kind, record)));
      return (result.records as any[]).filter((record) => {
        const key = importSignature(kind, record);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    switch (result.kind) {
      case 'health': {
        const imported = fresh(healthRecords, 'health') as HealthRecord[];
        if (imported.length) {
          const updated = [...imported, ...healthRecords];
          setHealthRecords(updated);
          saveHealthRecords(updated);
        }
        return imported.length;
      }
      case 'parentLoss': {
        const imported = fresh(parentLossRecords, 'parentLoss') as ParentLossRecord[];
        if (imported.length) {
          const updated = [...imported, ...parentLossRecords];
          setParentLossRecords(updated);
          saveParentLossRecords(updated);
        }
        return imported.length;
      }
      case 'caseStudy': {
        const imported = fresh(caseStudies, 'caseStudy') as CaseStudy[];
        if (imported.length) {
          const updated = [...imported, ...caseStudies];
          setCaseStudies(updated);
          saveCaseStudies(updated);
        }
        return imported.length;
      }
      case 'session': {
        const imported = fresh(counselingSessions, 'session') as CounselingSession[];
        if (imported.length) {
          const updated = [...imported, ...counselingSessions];
          setCounselingSessions(updated);
          saveCounselingSessions(updated);
        }
        return imported.length;
      }
      case 'specialCase': {
        const imported = fresh(specialCases, 'specialCase') as SpecialCaseRecord[];
        if (imported.length) {
          const updated = [...imported, ...specialCases];
          setSpecialCases(updated);
          saveSpecialCases(updated);
        }
        return imported.length;
      }
      case 'counseling':
      default: {
        const imported = result.records as CounselingRecord[];
        let updated = [...records];
        let added = 0;

        for (const rec of imported) {
          if (rec.recordType === 'DAILY_ACTIVITY_PLAN') {
            const index = updated.findIndex(
              (r) => r.recordType === 'DAILY_ACTIVITY_PLAN' && r.date === rec.date
            );
            if (index >= 0) {
              const existing = updated[index];
              const existingActivities = existing.activities || [];
              const seen = new Set(
                existingActivities.map(
                  (activity) => `${activity.activity}|${activity.location}|${activity.details}`
                )
              );
              const additions = (rec.activities || []).filter(
                (activity) => !seen.has(`${activity.activity}|${activity.location}|${activity.details}`)
              );
              if (additions.length === 0) continue;
              const merged = [...existingActivities, ...additions].map((activity, order) => ({
                ...activity,
                displayOrder: order,
              }));
              updated[index] = {
                ...existing,
                description: merged
                  .map(
                    (activity, order) =>
                      `النشاط (${order + 1}): ${activity.activity || 'غير محدد'}\n` +
                      `المكان: ${activity.location || 'غير محدد'}\n` +
                      `التفاصيل: ${activity.details || 'بدون تفاصيل'}`
                  )
                  .join('\n\n--------------------------------\n\n'),
                activities: merged,
                updatedAt: new Date().toISOString(),
              };
              added += 1;
              continue;
            }
          }

          const signature = importSignature('counseling', rec);
          if (updated.some((r) => importSignature('counseling', r) === signature)) continue;
          updated = [rec, ...updated];
          added += 1;
        }

        setRecords(updated);
        saveRecords(updated);
        return added;
      }
    }
  };

  return (
    <>
      <DesktopWindow 
        activeModule={activeModule} 
        onNavigate={handleNavigate}
        profile={profile}
        badges={{ ...moduleBadges, NOTIFICATIONS: unreadNotifications }}
      >
        {renderActiveModuleContent()}
      </DesktopWindow>
      <UpdatePrompt />
    </>
  );
}
