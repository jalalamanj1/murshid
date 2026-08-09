/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  loadLicense, 
  saveLicense,
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
  LicenseInfo, 
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
import ActivationView from './components/ActivationView';
import RegistrationView from './components/RegistrationView';
import DesktopWindow from './components/DesktopWindow';
import DashboardView from './components/DashboardView';
import RecordsListView from './components/RecordsListView';
import StudentManagementView from './components/StudentManagementView';
import BackupSyncView from './components/BackupSyncView';
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
import GoogleDriveFolderView from './components/GoogleDriveFolderView';
import RecordCoversView from './components/RecordCoversView';
import OfficialLettersView from './components/OfficialLettersView';
import ExportSection from './components/ExportSection';
import UpdateSettingsView from './components/UpdateSettingsView';
import { loadCache, validateAsync, deleteCache as deleteActivationCache } from './lib/pandaraActivation';
import { Theme, getStoredTheme, setTheme as persistTheme } from './lib/theme';

import { 
  Users, 
  FileBox, 
  FileText, 
  Sliders, 
  Database, 
  Paperclip, 
  HelpCircle, 
  AlertCircle,
  Plus,
  Award,
} from 'lucide-react';

export default function App() {
  const [flowStage, setFlowStage] = useState<AppFlowStage>('SPLASH');
  const [activeModule, setActiveModule] = useState<ActiveModule>('DASHBOARD');
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  
  const [license, setLicense] = useState<LicenseInfo>({ isActivated: false });
  const [profile, setProfile] = useState<CounselorProfile>({
    fullName: '',
    schoolName: '',
    province: 'كركوك',
    academicYear: '2025-2026',
    schoolType: 'MIDDLE',
    isRegistered: false
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [selectedRecordType, setSelectedRecordType] = useState<RecordType | null>(null);
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
  
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gdriveEmail, setGdriveEmail] = useState('');
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
    const raw = localStorage.getItem('murshid_gdrive_token');
    if (raw) {
      try {
        const t = JSON.parse(raw);
        setGdriveConnected(!!t.access_token);
        setGdriveEmail(t.email || '');
      } catch {}
    }
  }, []);

  const handleGDriveConnect = async () => {
    try {
      const electron = (window as any).electronAPI;
      if (!electron?.driveAuth) return;
      const res = await electron.driveAuth();
      if (res.ok) {
        // Save to unified token key (used by PT Drive, Official Letters)
        localStorage.setItem('murshid_gdrive_token', JSON.stringify(res.tokens));
        // Also save to backup service key so Backup is connected too
        const backupAccount = { connected: true, email: res.tokens.email || '', tokens: res.tokens, folderId: undefined };
        localStorage.setItem('murshid_google_drive', JSON.stringify(backupAccount));
        setGdriveConnected(true);
        setGdriveEmail(res.tokens.email || '');
      } else {
        alert(res.error || 'فشل الاتصال');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في الاتصال');
    }
  };

  const handleGDriveDisconnect = () => {
    localStorage.removeItem('murshid_gdrive_token');
    localStorage.removeItem('murshid_google_drive');
    setGdriveConnected(false);
    setGdriveEmail('');
  };

  // Check if license is expired — clears activation so user hits the activation screen
  const checkExpiration = () => {
    const lic = loadLicense();
    if (!lic.isActivated) return;
    // Load the cache to check expiresAt
    const raw = localStorage.getItem('pandara_activation');
    if (!raw) return;
    try {
      const cache = JSON.parse(raw);
      if (cache.expiresAt && new Date(cache.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem('pandara_activation');
        const expired: LicenseInfo = { isActivated: false };
        saveLicense(expired);
        setLicense(expired);
        setFlowStage('ACTIVATION');
      }
    } catch {}
  };

  // Load configuration on mount
  useEffect(() => {
    const activeLicense = loadLicense();
    const activeProfile = loadProfile();
    setLicense(activeLicense);
    setProfile(activeProfile);
    setStudents(loadStudents());
    setRecords(loadRecords());
    setCaseStudies(loadCaseStudies());
    setCounselingSessions(loadCounselingSessions());
    setSpecialCases(loadSpecialCases());
    setHealthRecords(loadHealthRecords());
    setParentLossRecords(loadParentLossRecords());

    // Check for expired trial on every mount
    checkExpiration();

    // Periodic expiration check every 15 seconds while app is open
    const timer = setInterval(checkExpiration, 15000);

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

    return () => clearInterval(timer);
  }, []);

  // Periodic trial expiry check (every 30 seconds while in MAIN mode)
  useEffect(() => {
    if (flowStage !== 'MAIN') return;
    const interval = setInterval(async () => {
      const validation = await validateAsync();
      if (!validation.isValid) {
        setLicense({ isActivated: false });
        setFlowStage('ACTIVATION');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [flowStage]);

  const handleSplashComplete = async () => {
    // Validate cache for trial expiry
    const validation = await validateAsync();
    if (!validation.isValid) {
      // Cache expired or invalid — clear license
      setLicense({ isActivated: false });
      setFlowStage('ACTIVATION');
      return;
    }

    if (!license.isActivated) {
      setFlowStage('ACTIVATION');
    } else if (!profile.isRegistered) {
      setFlowStage('REGISTRATION');
    } else {
      setFlowStage('MAIN');
    }
  };

  const handleActivated = (lic: LicenseInfo) => {
    setLicense(lic);
    if (!profile.isRegistered) {
      setFlowStage('REGISTRATION');
    } else {
      setFlowStage('MAIN');
    }
  };

  const handleRegistered = (prof: CounselorProfile) => {
    setProfile(prof);
    setFlowStage('MAIN');
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

  const handleDeleteStudent = (id: string) => {
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
    saveStudents(updated);
    const updatedRecords = records.filter(r => r.studentId !== id);
    setRecords(updatedRecords);
    saveRecords(updatedRecords);
  };



  // Render the core active module inside the Content Area
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
            onNavigate={(mod) => setActiveModule(mod as ActiveModule)}
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
            onOpenRecordsForType={(rt) => {
              if (rt === 'SPECIAL_CASES') {
                setSpecialCasesFromDashboard(true);
                setSpecialCaseMode('CATEGORY_SELECT');
                return;
              }
              setActiveModule('RECORDS');
              setSelectedRecordType(rt);
              if (rt === 'GROUP_INDIVIDUAL') {
                setCounselingSessionMode('CREATE');
              } else if (rt === 'CASE_STUDY') {
                setCaseStudyMode('CREATE');
              } else if (rt === 'HEALTH_STATUS') {
                setHealthRecordMode('CREATE');
              } else if (rt === 'BEREAVED_STUDENTS') {
                setParentLossMode('CREATE');
              } else if (rt === 'HEALTH_KEY_GUIDE') {
                // Read-only view, no mode needed
              }
            }}
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
            onResetData={handleClearStudentsAndCases}
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
              onBack={() => setSelectedRecordType(null)}
            />
          );
        }

        return (
          <div className="card animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">السجلات الارشادية</h3>
                <p className="text-xs text-slate-400 dark:text-slate-400">إدارة الحالات وتوثيق الاستشارات بالتطابق مع السجلات التسعة المعتمدة رسمياً في وزارة التربية.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { type: 'HEALTH_STATUS', name: 'سجل الحالة الصحية', desc: 'رصد وتوثيق الحالات الصحية والأمراض المزمنة للطلاب ومتابعة العلاج المدرسي.' },
                { type: 'SPECIAL_CASES', name: 'سجل الحالات الخاصة', desc: 'متابعة شؤون الطلاب من ذوي الاحتياجات الخاصة أو الحالات الاجتماعية والمعيشية الحرجة.' },
                { type: 'GROUP_INDIVIDUAL', name: 'سجل الإرشاد الجمعي والفردي', desc: 'توثيق جلسات الدعم والاستشارات الفردية والجماعية للطلاب لتحسين التكيف والتحصيل.' },
                { type: 'BEREAVED_STUDENTS', name: 'سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)', desc: 'رعاية شؤون الطلاب الأيتام وفاقدي المعيل وتقديم الدعم النفسي والاجتماعي والمالي لهم.' },
                { type: 'CASE_STUDY', name: 'سجل دراسة الحالة', desc: 'دراسة معمقة وبحث تفصيلي متكامل للحالات المستعصية والسلوكيات المعقدة للطلاب.' },
                { type: 'HEALTH_KEY_GUIDE', name: 'سجل الدليل (المفتاح) لدراسة الحالة' },
                { type: 'DAILY_ACTIVITY_PLAN', name: 'سجل النشاط اليومي', desc: 'توزيع وتنظيم خطة النشاط الإرشادي السنوي والشهري وتدوين اليوميات التنفيذية للعمل.' }
              ].map((item) => {
                return (
                  <div 
                    key={item.type} 
                    onClick={() => setSelectedRecordType(item.type as RecordType)}
                    className="border border-slate-200 dark:border-slate-800 hover:border-office-blue/30 dark:hover:border-office-blue/40 p-4 rounded-xl bg-[#F8F6F0] dark:bg-[#F8F6F0] flex flex-col justify-between h-36 transition-all hover:shadow-xs cursor-pointer group"
                  >
                    <div>
                      <div>
                        <span className="text-xs font-black text-main dark:text-slate-100 group-hover:text-office-blue transition-colors">{item.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">{item.desc}</p>
                    </div>
                    <button 
                      className="text-[10px] font-black text-office-blue dark:text-blue-400 group-hover:underline text-right mt-3 cursor-pointer flex items-center justify-end gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecordType(item.type as RecordType);
                      }}
                    >
                      <span>فتح السجل وإدارته</span>
                      <span>←</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'TEMPLATES':
        return <RecordCoversView />;

      case 'PT_DRIVE':
        return <GoogleDriveFolderView />;

      case 'OFFICIAL_LETTERS':
        return <OfficialLettersView />;

      case 'BACKUP':
        return (
          <BackupSyncView
            onNavigateToStudents={() => setActiveModule('STUDENTS')}
          />
        );

      case 'SETTINGS':
        return (
          <div className="card space-y-6">
            <div className="border-b border-divider-color pb-4">
              <h3 className="text-base font-bold text-main">إعدادات نظام مرشد</h3>
              <p className="text-xs text-muted mt-1">تخصيص مسارات الحفظ المحمية ومراجعة تفاصيل ترخيص البرنامج</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-1.5 max-w-lg">
                <label className="form-label">مجلد حفظ السجلات:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={saveFolder || 'سطح المكتب\\سجلات مرشد (الافتراضي)'}
                    className="form-input flex-1"
                  />
                  <button 
                    className="btn-secondary !py-1.5 !px-3 text-xs"
                    onClick={handlePickSaveFolder}
                  >
                    تغيير
                  </button>
                </div>
                <p className="text-[10px] text-muted">جميع سجلات التصدير تُحفظ في هذا المسار افتراضياً.</p>
              </div>

              <div className="space-y-3 max-w-lg">
                <h4 className="text-xs font-bold text-main">مظهر البرنامج</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setThemeState('dark'); persistTheme('dark'); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-primary-bg border-primary text-primary'
                        : 'bg-card border-border-color text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-md bg-[#0D121A] border border-[#232A34] block" />
                    داكن
                  </button>
                  <button
                    onClick={() => { setThemeState('light'); persistTheme('light'); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-xs font-bold transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-primary-bg border-primary text-primary'
                        : 'bg-card border-border-color text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-md bg-[#FAFAFA] border border-[#E8E8E8] block" />
                    فاتح
                  </button>
                </div>
                <p className="text-[10px] text-muted">يُحفظ اختيار المظهر تلقائياً ويُطبَّق عند كل تشغيل.</p>
              </div>

              <UpdateSettingsView />

              <div className="space-y-3 max-w-lg">
                <h4 className="text-xs font-bold text-main">Google Drive</h4>
                <div className="bg-card rounded-xl p-4 border border-border-color flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gdriveConnected ? 'bg-emerald-50 text-success' : 'bg-[#FAFAFA] text-muted border border-border-color'}`}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-main">الاتصال السحابي</p>
                      <p className="text-[10px] text-muted">{gdriveConnected ? gdriveEmail || 'متصل' : 'غير متصل'}</p>
                    </div>
                  </div>
                  <button
                    onClick={gdriveConnected ? handleGDriveDisconnect : handleGDriveConnect}
                    className={gdriveConnected ? 'btn-danger !py-1.5 !px-4 text-[11px]' : 'btn-primary !py-1.5 !px-4 text-[11px]'}
                  >
                    {gdriveConnected ? 'قطع الاتصال' : 'اتصال'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-main">حول النظام</h4>
                <div className="bg-card rounded-xl p-5 border border-border-color">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-main">اسم النظام:</span>
                      <span className="text-xs text-primary font-bold">Murshid - مرشد</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-main">الإصدار الحالي:</span>
                      <span className="text-xs font-mono text-muted">v1.1.2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-main">المطور:</span>
                      <a
                        href="https://jalalamanj.online"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary-hover transition-colors underline decoration-dotted underline-offset-2"
                      >
                        Jalal Amanj
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    return <ActivationView onActivated={handleActivated} />;
  }

  if (flowStage === 'REGISTRATION') {
    return <RegistrationView onComplete={handleRegistered} />;
  }

  const handleNavigate = (mod: ActiveModule) => {
    // Reset all module-specific state when navigating
    setSelectedRecordType(null);
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
      PT_DRIVE: 'Google Drive',
      OFFICIAL_LETTERS: 'مخاطبات رسمية',
      BACKUP: 'النسخ الاحتياطي',
      SETTINGS: 'الإعدادات',
    };
    try {
      const e = (window as any).electronAPI;
      if (e?.updateAppContext) {
        e.updateAppContext({ currentModule: mod, currentPage: screenNames[mod] || mod });
      }
    } catch {}
  };

  return (
    <>
      <DesktopWindow 
        profile={profile} 
        activeModule={activeModule} 
        onNavigate={handleNavigate}

      >
        {renderActiveModuleContent()}
      </DesktopWindow>
    </>
  );
}
