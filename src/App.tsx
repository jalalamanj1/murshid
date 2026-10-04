/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
import LockScreen from './components/LockScreen';
import RegistrationView from './components/RegistrationView';
import DesktopWindow from './components/DesktopWindow';
import DashboardView from './components/DashboardView';
import RecordsListView from './components/RecordsListView';
import StudentManagementView from './components/StudentManagementView';
import BackupSyncView from './components/BackupSyncView';
import DriveFolderView from './components/DriveFolderView';
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
import RecordCoversView from './components/RecordCoversView';
import ExportSection from './components/ExportSection';
import UpdateSettingsView from './components/UpdateSettingsView';
import AiSettingsCard from './components/AiSettingsCard';
import { Theme, getStoredTheme, setTheme as persistTheme } from './lib/theme';

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

export default function App() {
  const [flowStage, setFlowStage] = useState<AppFlowStage>('SPLASH');
  const [activeModule, setActiveModule] = useState<ActiveModule>('DASHBOARD');
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

  const handleSplashComplete = () => {
    setFlowStage('LOCKED');
  };

  const handleUnlocked = () => {
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
          <div className="space-y-6">
            <div className="card animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">سجلات</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { type: 'HEALTH_STATUS', name: 'سجل الحالة الصحية' },
                  { type: 'SPECIAL_CASES', name: 'سجل الحالات الخاصة' },
                  { type: 'GROUP_INDIVIDUAL', name: 'سجل الإرشاد الجمعي والفردي' },
                  { type: 'BEREAVED_STUDENTS', name: 'سجل الطلبة الفاقدين (أحد الوالدين أو كليهما)' },
                  { type: 'CASE_STUDY', name: 'سجل دراسة الحالة' },
                  { type: 'HEALTH_KEY_GUIDE', name: 'سجل الدليل (المفتاح) لدراسة الحالة' },
                  { type: 'DAILY_ACTIVITY_PLAN', name: 'سجل النشاط اليومي' }
                ].map((item) => {
                  return (
                    <div 
                      key={item.type} 
                      onClick={() => setSelectedRecordType(item.type as RecordType)}
                      className="border border-slate-200 dark:border-slate-800 hover:border-office-blue/30 dark:hover:border-office-blue/40 p-3 rounded-xl bg-[#F8F6F0] dark:bg-[#F8F6F0] flex flex-col justify-between gap-2 min-h-[100px] transition-all hover:shadow-xs cursor-pointer group"
                    >
                      <span className="text-xs font-black text-main dark:text-slate-100 group-hover:text-office-blue transition-colors leading-snug">{item.name}</span>
                      <button 
                        className="text-[10px] font-black text-office-blue dark:text-blue-400 group-hover:underline text-right cursor-pointer flex items-center justify-end gap-1"
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

            <div className="card animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">سجلات إضافية</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" />
            </div>
          </div>
        );

      case 'TEMPLATES':
        return <RecordCoversView />;

      case 'BACKUP':
        return (
          <BackupSyncView
            onNavigateToStudents={() => setActiveModule('STUDENTS')}
          />
        );

      case 'DRIVE_LETTERS':
        return (
          <DriveFolderView
            folderKey="letters"
            title="مخاطبات التربية"
          />
        );

      case 'DRIVE_FILES':
        return (
          <DriveFolderView
            folderKey="files"
            title="الملفات"
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

              <AiSettingsCard />

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
                      <span className="text-xs font-mono text-muted">v{appVersion}</span>
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

  if (flowStage === 'LOCKED') {
    return <LockScreen onUnlock={handleUnlocked} />;
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
      BACKUP: 'النسخ الاحتياطي',
      DRIVE_LETTERS: 'مخاطبات التربية',
      DRIVE_FILES: 'الملفات',
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
        activeModule={activeModule} 
        onNavigate={handleNavigate}
      >
        {renderActiveModuleContent()}
      </DesktopWindow>
    </>
  );
}
