/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  FileText,
  Users,
  Upload,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  UserPlus,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Filter,
  Download,
  FileSpreadsheet,
  MapPin,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Student, CounselorProfile, CounselingRecord, RecordType } from '../types';
import { GetGradesFromProfile, IsValidGrade } from '../lib/gradeService';
import { loadRecords, loadHealthRecords, loadSpecialCases, loadCaseStudies } from '../lib/storage';
import { academicYear } from '../lib/format';

interface StudentManagementViewProps {
  students: Student[];
  records: CounselingRecord[];
  profile: CounselorProfile;
  onAddStudent: (student: Student) => void;
  onImportStudents?: (students: Student[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onOpenRecords?: () => void;
}

type SortField = 'fullName' | 'classGrade' | 'birthDate' | 'parentPhone' | 'createdAt';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 8;

// ── Arabic normalization helpers for Excel import ──────────────────────
function stripArabicDefArticle(s: string): string {
  return s.replace(/^ال/, '');
}

function normalizeArabic(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, ' ')
    .replace(/[ًٌٍَُِّْ]/g, '') // strip tashkeel
    .replace(/ة/g, 'ه')         // ta-marbuta → ha
    .replace(/ى/g, 'ي')         // alef-maksura → ya
    .replace(/أ|إ|آ/g, 'ا')     // normalize alef
    .replace(/ؤ/g, 'و')         // hamza on waw
    .replace(/ئ/g, 'ي')         // hamza on ya
    .replace(/\u200c/g, '')      // remove zero-width non-joiner
    .replace(/\u200d/g, '');     // remove zero-width joiner
}

// Map keywords → Student field keys. Each array is tried (OR logic).
const COLUMN_KEYWORDS: [string[], keyof Student][] = [
  // fullName
  [['اسم الطالب', 'الاسم', 'اسم الكامل', 'الاسم الكامل', 'الاسم الثلاثي', 'اسم', 'student name', 'full name', 'name'], 'fullName'],
  // gender
  [['الجنس', 'نوع', 'gender', 'sex', 'type'], 'gender'],
  // classGrade
  [['الصف', 'الفصل الدراسي', 'المرحلة', 'grade', 'class', 'المستوى', 'stage', 'level'], 'classGrade'],
  // section
  [['الشعبة', 'الفصل', 'القسم', 'section', 'division', 'group'], 'section'],
  // birthDate
  [['تاريخ الميلاد', 'الميلاد', 'التاريخ', 'birth date', 'date of birth', 'dob', 'تاريخ الولادة'], 'birthDate'],
  // parentPhone
  [['هاتف ولي الامر', 'هاتف ولي الأمر', 'هاتف الأب', 'هاتف الاب', 'التلفون', 'الهاتف', 'الجوال', 'رقم الهاتف', 'هاتف', 'phone', 'telephone', 'mobile', 'tel', 'contact'], 'parentPhone'],
  // parentJob
  [['مهنة ولي الامر', 'مهنة ولي الأمر', 'مهنة الأب', 'مهنة الاب', 'عمل ولي الامر', 'عمل الأب', 'مهنه', 'job', 'occupation', 'work'], 'parentJob'],
  // address
  [['السكن', 'العنوان', 'المنزل', 'ال domicile', 'address', 'residence', 'location'], 'address'],
  // bloodType
  [['فصيلة الدم', 'نوع الدم', 'الدم', 'blood', 'blood type', 'group'], 'bloodType'],
  // healthStatus
  [['الحالة الصحية', 'الحالة الصحية', 'صحة', 'health', 'medical', 'medical condition'], 'healthStatus'],
  // studentNumber
  [['رقم الطالب', 'رقم القيد', 'رقم القيد العام', 'رقم السجل', 'student number', 'student id', 'student no', 'serial'], 'studentNumber'],
  // fatherName
  [['اسم الأب', 'اسم الاب', 'اسم ولي الامر', 'اسم ولي الأمر', 'father', 'father name', 'parent name'], 'fatherName'],
  // motherName
  [['اسم الأم', 'اسم الام', 'mother', 'mother name', 'اسم الوالدة'], 'motherName'],
  // motherJob
  [['مهنة الأم', 'مهنة الام', 'عمل الأم', 'عمل الام', 'mother job', 'mother occupation'], 'motherJob'],
  // notes
  [['ملاحظات', 'ملاحظة', 'ملاحظات عامة', 'ملاحظات المعلم', 'ملاحظات المرشد', 'notes', 'comments', 'remark', 'remarks'], 'notes'],
];

function calculateAge(birthDate: string): string {
  if (!birthDate) return '';
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} سنة`;
  } catch {
    return '';
  }
}

export default function StudentManagementView({
  students,
  records,
  profile,
  onAddStudent,
  onImportStudents,
  onUpdateStudent,
  onDeleteStudent,
  onOpenRecords
}: StudentManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [printStudent, setPrintStudent] = useState<Student | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Import wizard states
  const [importStep, setImportStep] = useState(0); // 0: preview, 1: mapping, 2: validation, 3: progress
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [customColumnNames, setCustomColumnNames] = useState<Record<string, string>>({});
  const [importFileName, setImportFileName] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);

  // Form state for Add/Edit
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [formGrade, setFormGrade] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formJob, setFormJob] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBlood, setFormBlood] = useState('');
  const [formHealth, setFormHealth] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formMotherName, setFormMotherName] = useState('');
  const [formMotherJob, setFormMotherJob] = useState('');
  const [formBirthPlace, setFormBirthPlace] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formSiblingOrder, setFormSiblingOrder] = useState('');
  const [formFatherAlive, setFormFatherAlive] = useState('');
  const [formFatherAge, setFormFatherAge] = useState('');
  const [formFatherEducation, setFormFatherEducation] = useState('');
  const [formFatherJob, setFormFatherJob] = useState('');
  const [formFatherPhone, setFormFatherPhone] = useState('');
  const [formFatherDeathYear, setFormFatherDeathYear] = useState('');
  const [formMotherAlive, setFormMotherAlive] = useState('');
  const [formMotherAge, setFormMotherAge] = useState('');
  const [formMotherEducation, setFormMotherEducation] = useState('');
  const [formMotherPhone, setFormMotherPhone] = useState('');
  const [formMotherDeathYear, setFormMotherDeathYear] = useState('');
  const [formResidenceAuthority, setFormResidenceAuthority] = useState('');
  const [formBrothersCount, setFormBrothersCount] = useState('');
  const [formSistersCount, setFormSistersCount] = useState('');
  const [formRoomsCount, setFormRoomsCount] = useState('');
  const [formAltGuardianPhone, setFormAltGuardianPhone] = useState('');
  const [formHousingType, setFormHousingType] = useState('');
  const [formIsEmployed, setFormIsEmployed] = useState('');
  const [formEmploymentDetails, setFormEmploymentDetails] = useState('');
  const [formChronicDisease, setFormChronicDisease] = useState('');
  const [formDiseaseDetails, setFormDiseaseDetails] = useState('');
  const [formSeesSpecialist, setFormSeesSpecialist] = useState('');
  const [formSpecialistDetails, setFormSpecialistDetails] = useState('');
  const [formMentalPhysicalState, setFormMentalPhysicalState] = useState('');
  const [formAcademicDelay, setFormAcademicDelay] = useState('');
  const [formTalents, setFormTalents] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Auto-trigger print
  useEffect(() => {
    if (printStudent) {
      const timer = setTimeout(() => {
        window.print();
        setPrintStudent(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printStudent]);

  // Unique grades and sections for filters
  const uniqueSections = useMemo(() => [...new Set(students.map(s => s.section))].sort(), [students]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.fullName.toLowerCase().includes(term) ||
        s.parentPhone.includes(term) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(term)) ||
        (s.studentNumber && s.studentNumber.toLowerCase().includes(term))
      );
    }

    if (filterGrade) {
      result = result.filter(s => s.classGrade === filterGrade);
    }

    if (filterSection) {
      result = result.filter(s => s.section === filterSection);
    }

    result.sort((a, b) => {
      const aVal = (a[sortField] || '').toString();
      const bVal = (b[sortField] || '').toString();
      const cmp = aVal.localeCompare(bVal, 'ar');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [students, searchTerm, sortField, sortDir, filterGrade, filterSection]);

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterGrade, filterSection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormGender('MALE');
    setFormGrade('');
    setFormSection('');
    setFormBirthDate('');
    setFormPhone('');
    setFormJob('');
    setFormAddress('');
    setFormBlood('');
    setFormHealth('');
    setFormNotes('');
    setFormStudentNumber('');
    setFormFatherName('');
    setFormMotherName('');
    setFormMotherJob('');
    setFormBirthPlace('');
    setFormNationalId('');
    setFormSiblingOrder('');
    setFormFatherAlive('');
    setFormFatherAge('');
    setFormFatherEducation('');
    setFormFatherJob('');
    setFormFatherPhone('');
    setFormFatherDeathYear('');
    setFormMotherAlive('');
    setFormMotherAge('');
    setFormMotherEducation('');
    setFormMotherPhone('');
    setFormMotherDeathYear('');
    setFormResidenceAuthority('');
    setFormBrothersCount('');
    setFormSistersCount('');
    setFormRoomsCount('');
    setFormAltGuardianPhone('');
    setFormHousingType('');
    setFormIsEmployed('');
    setFormEmploymentDetails('');
    setFormChronicDisease('');
    setFormDiseaseDetails('');
    setFormSeesSpecialist('');
    setFormSpecialistDetails('');
    setFormMentalPhysicalState('');
    setFormAcademicDelay('');
    setFormTalents('');
  };

  // Start edit
  const handleStartEdit = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.fullName);
    setFormGender(student.gender);
    setFormGrade(student.classGrade);
    setFormSection(student.section);
    setFormBirthDate(student.birthDate);
    setFormPhone(student.parentPhone);
    setFormJob(student.parentJob);
    setFormAddress(student.address);
    setFormBlood(student.bloodType || '');
    setFormHealth(student.healthStatus || '');
    setFormNotes(student.notes || '');
    setFormStudentNumber(student.studentNumber || '');
    setFormFatherName(student.fatherName || '');
    setFormMotherName(student.motherName || '');
    setFormMotherJob(student.motherJob || '');
    setFormBirthPlace(student.birthPlace || '');
    setFormNationalId(student.nationalId || '');
    setFormSiblingOrder(student.siblingOrder || '');
    setFormFatherAlive(student.fatherAlive || '');
    setFormFatherAge(student.fatherAge || '');
    setFormFatherEducation(student.fatherEducation || '');
    setFormFatherJob(student.fatherJob || '');
    setFormFatherPhone(student.fatherPhone || '');
    setFormFatherDeathYear(student.fatherDeathYear || '');
    setFormMotherAlive(student.motherAlive || '');
    setFormMotherAge(student.motherAge || '');
    setFormMotherEducation(student.motherEducation || '');
    setFormMotherPhone(student.motherPhone || '');
    setFormMotherDeathYear(student.motherDeathYear || '');
    setFormResidenceAuthority(student.residenceAuthority || '');
    setFormBrothersCount(student.brothersCount || '');
    setFormSistersCount(student.sistersCount || '');
    setFormRoomsCount(student.roomsCount || '');
    setFormAltGuardianPhone(student.altGuardianPhone || '');
    setFormHousingType(student.housingType || '');
    setFormIsEmployed(student.isEmployed || '');
    setFormEmploymentDetails(student.employmentDetails || '');
    setFormChronicDisease(student.chronicDisease || '');
    setFormDiseaseDetails(student.diseaseDetails || '');
    setFormSeesSpecialist(student.seesSpecialist || '');
    setFormSpecialistDetails(student.specialistDetails || '');
    setFormMentalPhysicalState(student.mentalPhysicalState || '');
    setFormAcademicDelay(student.academicDelay || '');
    setFormTalents(student.talents || '');
    setShowAddDialog(true);
  };

  // View student profile + auto-set AI memory context
  const handleViewStudent = async (student: Student) => {
    setViewingStudent(student);
    // Load all related records for AI memory
    try {
      const allRecords = loadRecords();
      const healthRecords = loadHealthRecords();
      const specialCases = loadSpecialCases();
      const caseStudies = loadCaseStudies();

      const studentRecords = allRecords.filter(r => r.studentId === student.id);
      const behaviorRecords = allRecords.filter(r =>
        r.studentId === student.id &&
        (r.recordType?.includes('سلوك') || r.description?.includes('سلوك'))
      );

      const memoryData = {
        name: student.fullName,
        id: student.id,
        classGrade: student.classGrade,
        section: student.section,
        gender: student.gender,
        studentNumber: student.studentNumber,
        healthStatus: student.healthStatus,
        bloodType: student.bloodType,
        parentPhone: student.parentPhone,
        notes: student.notes,
        attendanceRecords: studentRecords,
        behaviorRecords: behaviorRecords,
        counselingRecords: studentRecords,
        healthRecord: healthRecords.find(r => r.studentId === student.id) || null,
        specialCases: specialCases.filter(c => c.studentId === student.id),
        caseStudy: caseStudies.find(c => c.studentId === student.id) || null,
      };
      if ((window as any).electronAPI?.setMemoryStudent) {
        (window as any).electronAPI.setMemoryStudent(memoryData);
      }
    } catch {}
  };

  // Submit add/edit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formGrade.trim() || !formSection.trim()) {
      alert('الرجاء ملء الحقول الأساسية: الاسم، الصف، الشعبة.');
      return;
    }

    if (!IsValidGrade(formGrade.trim(), profile.schoolType)) {
      alert('الصف المحدد غير متاح في المرحلة التعليمية المسجلة. الرجاء اختيارصف من القائمة المسموحة.');
      return;
    }

    const studentData: Student = {
      id: editingStudent?.id || 'std_' + Date.now(),
      fullName: formName.trim(),
      gender: formGender,
      classGrade: formGrade.trim(),
      section: formSection.trim(),
      birthDate: formBirthDate,
      parentPhone: formPhone.trim(),
      parentJob: formJob.trim(),
      address: formAddress.trim(),
      bloodType: formBlood.trim() || undefined,
      healthStatus: formHealth.trim() || undefined,
      notes: formNotes.trim() || undefined,
      studentNumber: formStudentNumber.trim() || undefined,
      fatherName: formFatherName.trim() || undefined,
      motherName: formMotherName.trim() || undefined,
      motherJob: formMotherJob.trim() || undefined,
      birthPlace: formBirthPlace.trim() || undefined,
      nationalId: formNationalId.trim() || undefined,
      siblingOrder: formSiblingOrder.trim() || undefined,
      fatherAlive: formFatherAlive.trim() || undefined,
      fatherAge: formFatherAge.trim() || undefined,
      fatherEducation: formFatherEducation.trim() || undefined,
      fatherJob: formFatherJob.trim() || undefined,
      fatherPhone: formFatherPhone.trim() || undefined,
      fatherDeathYear: formFatherDeathYear.trim() || undefined,
      motherAlive: formMotherAlive.trim() || undefined,
      motherAge: formMotherAge.trim() || undefined,
      motherEducation: formMotherEducation.trim() || undefined,
      motherPhone: formMotherPhone.trim() || undefined,
      motherDeathYear: formMotherDeathYear.trim() || undefined,
      residenceAuthority: formResidenceAuthority.trim() || undefined,
      brothersCount: formBrothersCount.trim() || undefined,
      sistersCount: formSistersCount.trim() || undefined,
      roomsCount: formRoomsCount.trim() || undefined,
      altGuardianPhone: formAltGuardianPhone.trim() || undefined,
      housingType: formHousingType.trim() || undefined,
      isEmployed: formIsEmployed.trim() || undefined,
      employmentDetails: formEmploymentDetails.trim() || undefined,
      chronicDisease: formChronicDisease.trim() || undefined,
      diseaseDetails: formDiseaseDetails.trim() || undefined,
      seesSpecialist: formSeesSpecialist.trim() || undefined,
      specialistDetails: formSpecialistDetails.trim() || undefined,
      mentalPhysicalState: formMentalPhysicalState.trim() || undefined,
      academicDelay: formAcademicDelay.trim() || undefined,
      talents: formTalents.trim() || undefined,
      createdAt: editingStudent?.createdAt || new Date().toISOString()
    };

    if (editingStudent) {
      onUpdateStudent(studentData);
    } else {
      onAddStudent(studentData);
    }

    resetForm();
    setEditingStudent(null);
    setShowAddDialog(false);
  };

  // Handle Excel file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        alert('الملف فارغ أو لا يحتوي على بيانات صالحة.');
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setImportData(jsonData);
      setImportHeaders(headers);
      setImportFileName(file.name);

      // Auto-map columns using keyword-level matching
      const autoMappings: Record<string, string> = {};
      headers.forEach(h => {
        const norm = normalizeArabic(h);
        const normStripped = stripArabicDefArticle(norm);
        for (const [keywords, fieldKey] of COLUMN_KEYWORDS) {
          const matched = keywords.some(kw => {
            const nkw = normalizeArabic(kw);
            const nkwStripped = stripArabicDefArticle(nkw);
            // Match if normalized header contains keyword or vice versa (both with and without ال)
            return (
              norm.includes(nkw) || nkw.includes(norm) ||
              normStripped.includes(nkwStripped) || nkwStripped.includes(normStripped) ||
              // Token-level: check if any significant word (≥3 chars) matches
              norm.split(' ').some(tok => tok.length >= 3 && (nkw.includes(tok) || nkwStripped.includes(tok))) ||
              nkw.split(' ').some(tok => tok.length >= 3 && (norm.includes(tok) || normStripped.includes(tok)))
            );
          });
          if (matched) {
            autoMappings[h] = fieldKey;
            break;
          }
        }
      });
      setColumnMappings(autoMappings);
      setCustomColumnNames({});
      setImportStep(1);
      setShowImportWizard(true);
    } catch (err) {
      alert('حدث خطأ أثناء قراءة الملف. تأكد من أن الملف بتنسيق Excel أو CSV صحيح.');
      console.error(err);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Auto-map remaining unmapped columns
  const handleAutoMapColumns = () => {
    const updated = { ...columnMappings };
    importHeaders.forEach(h => {
      if (!updated[h]) {
        const norm = normalizeArabic(h);
        const normStripped = stripArabicDefArticle(norm);
        for (const [keywords, fieldKey] of COLUMN_KEYWORDS) {
          const matched = keywords.some(kw => {
            const nkw = normalizeArabic(kw);
            const nkwStripped = stripArabicDefArticle(nkw);
            return (
              norm.includes(nkw) || nkw.includes(norm) ||
              normStripped.includes(nkwStripped) || nkwStripped.includes(normStripped) ||
              norm.split(' ').some(tok => tok.length >= 3 && (nkw.includes(tok) || nkwStripped.includes(tok))) ||
              nkw.split(' ').some(tok => tok.length >= 3 && (norm.includes(tok) || normStripped.includes(tok)))
            );
          });
          if (matched) {
            updated[h] = fieldKey;
            break;
          }
        }
      }
    });
    setColumnMappings(updated);
  };

  // Validate and import
  const handleImportConfirm = () => {
    const mappedFields = Object.values(columnMappings).filter(v => v && v !== 'custom');
    if (!mappedFields.includes('fullName')) {
      const proceed = confirm('لم يتم ربط عمود بالاسم الكامل. سيتم تسمية الطلاب تلقائياً. هل تريد المتابعة؟');
      if (!proceed) return;
    }

    setImportStep(3);
    setImportTotal(importData.length);
    setImportProgress(0);

    // Simulate import with progress
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= importData.length) {
        clearInterval(interval);

        // Actually import
        const newStudents: Student[] = importData.map((row, i) => {
          const student: Student = {
            id: 'std_import_' + Date.now() + '_' + i,
            fullName: '',
            gender: 'MALE',
            classGrade: '',
            section: '',
            birthDate: '',
            parentPhone: '',
            parentJob: '',
            address: '',
            bloodType: '',
            healthStatus: '',
            notes: '',
            studentNumber: '',
            fatherName: '',
            motherName: '',
            motherJob: '',
            createdAt: new Date().toISOString()
          };

          // Apply mapped columns to student fields
          Object.entries(columnMappings).forEach(([header, fieldKey]) => {
            if (fieldKey && typeof fieldKey === 'string' && fieldKey in student && fieldKey !== 'custom') {
              let val = String(row[header] || '').trim();
              // Auto-detect gender from Arabic
              if (fieldKey === 'gender') {
                const normVal = normalizeArabic(val);
                if (['انثي', 'انثى', 'بنت', 'بنت', 'f', 'female', 'f'].some(g => normVal.includes(g))) {
                  val = 'FEMALE';
                } else {
                  val = 'MALE';
                }
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (student as any)[fieldKey] = val;
            }
          });

          // Handle custom fields: ALL unmapped headers become custom fields
          const customFields: Record<string, string> = {};
          importHeaders.forEach(h => {
            const mapping = columnMappings[h];
            if (!mapping || mapping === 'custom') {
              const val = String(row[h] || '').trim();
              if (val) {
                const customKey = customColumnNames[h] || h;
                customFields[customKey] = val;
              }
            }
          });
          if (Object.keys(customFields).length > 0) {
            student.customFields = customFields;
          }

          if (!student.fullName) student.fullName = 'طالب غير مسمى';
          if (!student.classGrade || !IsValidGrade(student.classGrade, profile.schoolType)) {
            student.classGrade = GetGradesFromProfile(profile)[0] || 'غير محدد';
          }
          if (!student.section) student.section = 'غير محدد';

          return student;
        });

        if (onImportStudents) {
          onImportStudents(newStudents);
        } else {
          newStudents.forEach(s => onAddStudent(s));
        }
        setTimeout(() => {
          setShowImportWizard(false);
          setImportStep(0);
          setImportData([]);
          setImportHeaders([]);
          setColumnMappings({});
          setCustomColumnNames({});
        }, 500);
      } else {
        setImportProgress(idx + 1);
        idx++;
      }
    }, 30);
  };

  // Get student's records count
  const getStudentRecordCount = (studentId: string) => {
    return records.filter(r => r.studentId === studentId).length;
  };

  // Export single student's data + all their records to Excel
  const handleExportStudentData = async (student: Student) => {
    try {
      const XLSX = await import('xlsx');

      // Column widths for professional layout
      const colWidths = [{ wch: 30 }, { wch: 40 }];

      // Border style
      const thinBorder = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      // Sheet 1: Student Info
      const studentData: Record<string, string> = {
        'اسم الطالب الرباعي واللقب': student.fullName,
        'الصف': student.classGrade,
        'تاريخ الميلاد': student.birthDate,
        'محل الولادة': student.birthPlace || '',
        'رقم البطاقة الموحدة/الجنسية': student.nationalId || '',
        'ترتيب الطالب بين إخوته': student.siblingOrder || '',
        'عنوان السكن': student.address,
        'اسم الأب الثلاثي': student.fatherName || '',
        'الأب على قيد الحياة': student.fatherAlive || '',
        'عمر الأب': student.fatherAge || '',
        'تحصيل الأب الدراسي': student.fatherEducation || '',
        'مهنة الأب ومكان العمل': student.fatherJob || '',
        'هاتف الأب': student.fatherPhone || '',
        'سنة وسبب وفاة الأب': student.fatherDeathYear || '',
        'اسم الأم الثلاثي': student.motherName || '',
        'الأم على قيد الحياة': student.motherAlive || '',
        'عمر الأم': student.motherAge || '',
        'تحصيل الأم الدراسي': student.motherEducation || '',
        'مهنة الأم ومكان العمل': student.motherJob || '',
        'هاتف الأم': student.motherPhone || '',
        'سنة وسبب وفاة الأم': student.motherDeathYear || '',
        'جهة الإقامة': student.residenceAuthority || '',
        'عدد الإخوة': student.brothersCount || '',
        'عدد الأخوات': student.sistersCount || '',
        'عدد غرف السكن': student.roomsCount || '',
        'هاتف ولي الأمر البديل': student.altGuardianPhone || '',
        'نوع السكن': student.housingType || '',
        'يعمل': student.isEmployed || '',
        'نوع ومكان العمل': student.employmentDetails || '',
        'مرض مزمن': student.chronicDisease || '',
        'تفاصيل المرض': student.diseaseDetails || '',
        'يراجع طبيب اختصاص': student.seesSpecialist || '',
        'اسم الطبيب والاختصاص': student.specialistDetails || '',
        'الحالة النفسية/الجسدية': student.mentalPhysicalState || '',
        'الرسوب أو التأخير الدراسي': student.academicDelay || '',
        'المواهب': student.talents || '',
      };
      // Build styled sheet manually
      const headers = Object.keys(studentData);
      const values = Object.values(studentData);
      const wsData = [headers, values];
      const studentSheet = XLSX.utils.aoa_to_sheet(wsData);
      studentSheet['!cols'] = colWidths;

      // Style header row
      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (studentSheet[ref]) {
          studentSheet[ref].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill: { fgColor: { rgb: '1E40AF' } },
            alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
            border: thinBorder,
          };
        }
      }
      // Style data cells
      for (let c = 0; c < values.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 1, c });
        if (studentSheet[ref]) {
          studentSheet[ref].s = {
            font: { sz: 10 },
            alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
            border: thinBorder,
          };
        }
      }
      // Row height
      studentSheet['!rows'] = [{ hpt: 30 }, { hpt: 25 }];

      // Sheet 2: All Records
      const studentRecords = records.filter(r => r.studentId === student.id);
      const recordRows = studentRecords.map((r, i) => ({
        'ت': i + 1,
        'العنوان': r.title,
        'التاريخ': r.date,
        'النوع': r.recordType,
        'الوصف': r.description || '',
        'الإجراء': r.actionTaken || '',
        'التوصيات': r.recommendations || '',
        'الحالة': r.status === 'COMPLETED' ? 'مكتملة' : r.status === 'ONGOING' ? 'قيد المتابعة' : 'مؤرشفة',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, studentSheet, 'بيانات الطالب');
      if (recordRows.length > 0) {
        const recHeaders = Object.keys(recordRows[0]);
        const recData = [recHeaders, ...recordRows.map(r => recHeaders.map(h => (r as any)[h] || ''))];
        const recordsSheet = XLSX.utils.aoa_to_sheet(recData);
        recordsSheet['!cols'] = recHeaders.map(() => ({ wch: 20 }));
        for (let c = 0; c < recHeaders.length; c++) {
          const ref = XLSX.utils.encode_cell({ r: 0, c });
          if (recordsSheet[ref]) {
            recordsSheet[ref].s = {
              font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
              fill: { fgColor: { rgb: '059669' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: thinBorder,
            };
          }
        }
        XLSX.utils.book_append_sheet(wb, recordsSheet, 'السجلات');
      }

      XLSX.writeFile(wb, `student-${student.fullName}.xlsx`);
    } catch (err: any) {
      alert('فشل تصدير البيانات: ' + (err.message || ''));
    }
  };

  // Export students to Excel
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');

      const headers = [
        'الاسم الكامل', 'الجنس', 'الصف', 'الشعبة', 'تاريخ الميلاد',
        'هاتف ولي الأمر', 'اسم الأب', 'مهنة ولي الأمر', 'اسم الأم', 'مهنة الأم',
        'السكن', 'فصيلة الدم', 'الحالة الصحية', 'رقم القيد العام', 'ملاحظات'
      ];

      // Collect all custom field keys across all students
      const customKeys = new Set<string>();
      filteredStudents.forEach(s => {
        if (s.customFields) Object.keys(s.customFields).forEach(k => customKeys.add(k));
      });
      const allHeaders = [...headers, ...customKeys];

      const rows = filteredStudents.map(s => {
        const base: Record<string, string> = {
          'الاسم الكامل': s.fullName,
          'الجنس': s.gender === 'MALE' ? 'ذكر' : 'أنثى',
          'الصف': s.classGrade,
          'الشعبة': s.section,
          'تاريخ الميلاد': s.birthDate,
          'هاتف ولي الأمر': s.parentPhone,
          'اسم الأب': s.fatherName || '',
          'مهنة ولي الأمر': s.parentJob,
          'اسم الأم': s.motherName || '',
          'مهنة الأم': s.motherJob || '',
          'السكن': s.address,
          'فصيلة الدم': s.bloodType || '',
          'الحالة الصحية': s.healthStatus || '',
          'رقم القيد العام': s.studentNumber || '',
          'ملاحظات': s.notes || '',
        };
        if (s.customFields) Object.assign(base, s.customFields);
        return base;
      });

      // Build worksheet manually for full control over styles and widths
      const ws: Record<string, unknown> = {};

      // Border style
      const thinBorder = { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } };

      // Header style
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '2D8CFF' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: false },
        border: thinBorder,
      };

      // Cell style
      const cellStyle = {
        alignment: { vertical: 'center' as const, wrapText: false },
        border: thinBorder,
      };

      // Column width tracker (Arabic chars ~2x width)
      const colWidths: number[] = allHeaders.map(() => 8);

      // Write header row
      allHeaders.forEach((h, ci) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
        ws[ref] = { v: h, t: 's', s: headerStyle };
        // Estimate width: Arabic chars count more
        const w = Math.max(h.length * 1.8, 12);
        colWidths[ci] = Math.max(colWidths[ci], Math.min(w, 40));
      });

      // Write data rows
      rows.forEach((row, ri) => {
        allHeaders.forEach((h, ci) => {
          const val = row[h] || '';
          const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          ws[ref] = { v: val, t: 's', s: cellStyle };
          // Update column width based on content
          const contentWidth = val.length * 1.5;
          colWidths[ci] = Math.max(colWidths[ci], Math.min(contentWidth, 50));
        });
      });

      // Set sheet range
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: allHeaders.length - 1 }
      });

      // Set column widths
      ws['!cols'] = colWidths.map(w => ({ wch: Math.ceil(w) }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
      XLSX.writeFile(wb, 'قائمة_الطلاب_' + new Date().toISOString().split('T')[0] + '.xlsx');
    } catch (err) {
      alert('حدث خطأ أثناء التصدير.');
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Panel */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-office-blue" />
            <span>إدارة شؤون الطلاب</span>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 px-2.5 py-0.5 rounded-full font-bold">
              {students.length} طالب
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">
            إضافة وتعديل وحذف وطباعة واستيراد وتصدير ملفات الطلاب.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 text-xs font-black py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            استيراد من Excel
          </button>
          <button
            onClick={handleExportExcel}
            disabled={filteredStudents.length === 0}
            className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 text-office-blue dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 text-xs font-black py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            تصدير إلى Excel
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingStudent(null);
              setShowAddDialog(true);
            }}
            className="bg-office-blue hover:bg-office-hover text-white text-xs font-black py-2 px-4 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            تسجيل طالب جديد
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الهاتف أو رقم القيد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg pr-10 pl-3 py-2 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue"
            />
          </div>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"
          >
            <option value="">جميع الصفوف</option>
            {GetGradesFromProfile(profile).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"
          >
            <option value="">جميع الشعب</option>
            {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-[#0f172a] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('fullName')}>
                  <span className="flex items-center gap-1">
                    اسم الطالب
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('classGrade')}>
                  <span className="flex items-center gap-1">
                    الصف والشعبة
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('birthDate')}>
                  <span className="flex items-center gap-1">
                    تاريخ الميلاد
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3 cursor-pointer hover:text-office-blue transition-colors" onClick={() => handleSort('parentPhone')}>
                  <span className="flex items-center gap-1">
                    هاتف ولي الأمر
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="p-3">فصيلة الدم</th>
                <th className="p-3">السجلات</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        {searchTerm || filterGrade || filterSection ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد طالب مسجل حالياً'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-colors">
                    <td className="p-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{student.fullName}</span>
                        {student.fatherName && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">أب: {student.fatherName}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{student.classGrade} • {student.section}</td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                      {student.birthDate}
                      {student.birthDate && (
                        <span className="text-[10px] text-office-blue block">{calculateAge(student.birthDate)}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{student.parentPhone}</td>
                    <td className="p-3 text-center font-bold text-office-blue dark:text-blue-400">{student.bloodType || 'N/A'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 rounded-md font-mono font-black border border-blue-100 dark:border-blue-900/40">
                        {getStudentRecordCount(student.id)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-office-blue dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          title="عرض الملف الشخصي"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(student)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          title="تعديل بيانات الطالب"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportStudentData(student)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          title="تصدير بيانات الطالب"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف الطالب (${student.fullName}) نهائياً؟\nسيؤدي ذلك أيضاً لحذف جميع سجلاته الإرشادية المرتبطة.`)) {
                              onDeleteStudent(student.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
                          title="حذف الطالب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a]/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
              عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} من {filteredStudents.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? 'bg-office-blue text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          ADD / EDIT STUDENT DIALOG
          ================================================================ */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
            {/* Dialog Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-office-blue" />
                {editingStudent ? 'تعديل بيانات الطالب' : 'تسجيل طالب جديد في النظام'}
              </h3>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setEditingStudent(null);
                  resetForm();
                }}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dialog Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Personal Info Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  المعلومات الشخصية الأساسية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الاسم الكامل للطالب (ثلاثي مع اللقب): *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد علي حسن البياتي"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue focus:border-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الجنس: *</label>
                    <select
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value as 'MALE' | 'FEMALE')}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    >
                      <option value="MALE">ذكر</option>
                      <option value="FEMALE">أنثى</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Academic Info Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  المعلومات الدراسية والتسجيلية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الصف الدراسي: *</label>
                    <select
                      required
                      value={formGrade}
                      onChange={(e) => setFormGrade(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    >
                      <option value="">-- اختر الصف --</option>
                      {GetGradesFromProfile(profile).map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الشعبة: *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أ، ب، ج"
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">رقم القيد العام:</label>
                    <input
                      type="text"
                      placeholder="رقم السجل الداخلي"
                      value={formStudentNumber}
                      onChange={(e) => setFormStudentNumber(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                </div>
              </div>

              {/* Family Info Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  معلومات الأسرة والولي
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">اسم الأب الكامل:</label>
                    <input
                      type="text"
                      placeholder="الاسم الكامل للأب"
                      value={formFatherName}
                      onChange={(e) => setFormFatherName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">مهنة ولي الأمر:</label>
                    <input
                      type="text"
                      placeholder="مثال: موظف حكومي"
                      value={formJob}
                      onChange={(e) => setFormJob(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">هاتف ولي الأمر:</label>
                    <input
                      type="text"
                      placeholder="07XXXXXXXXX"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">اسم الأم:</label>
                    <input
                      type="text"
                      placeholder="الاسم الكامل للأم"
                      value={formMotherName}
                      onChange={(e) => setFormMotherName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">مهنة الأم:</label>
                    <input
                      type="text"
                      placeholder="مثال: ربة منزل"
                      value={formMotherJob}
                      onChange={(e) => setFormMotherJob(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">تاريخ الميلاد:</label>
                    <input
                      type="date"
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none font-mono"
                    />
                    {formBirthDate && (
                      <span className="text-[10px] text-office-blue font-bold">{calculateAge(formBirthDate)}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">السكن بالتفصيل:</label>
                  <input
                    type="text"
                    placeholder="مثال: كركوك، طريق بغداد"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                  />
                </div>
              </div>

              {/* Health & Medical Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  المعلومات الصحية والطبية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">فصيلة الدم:</label>
                    <select
                      value={formBlood}
                      onChange={(e) => setFormBlood(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none"
                    >
                      <option value="">-- اختر --</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                        <option key={bt} value={bt}>{bt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الحالة الصحية الخاصة (إن وجدت):</label>
                    <input
                      type="text"
                      placeholder="مثال: حساسية من الغبار، ربو، سكري..."
                      value={formHealth}
                      onChange={(e) => setFormHealth(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">ملاحظات عامة للمرشد:</label>
                  <textarea
                    rows={3}
                    placeholder="أي ملاحظات إضافية تهم المرشد التربوي..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-office-blue leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* Expanded Student Info */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  التفاصيل الموسعة
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">محل الولادة:</label><input type="text" value={formBirthPlace} onChange={e=>setFormBirthPlace(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">رقم البطاقة الموحدة/الجنسية:</label><input type="text" value={formNationalId} onChange={e=>setFormNationalId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">ترتيب الطالب بين إخوته:</label><input type="text" value={formSiblingOrder} onChange={e=>setFormSiblingOrder(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">جهة الإقامة:</label><input type="text" value={formResidenceAuthority} onChange={e=>setFormResidenceAuthority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">عدد الإخوة:</label><input type="text" value={formBrothersCount} onChange={e=>setFormBrothersCount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">عدد الأخوات:</label><input type="text" value={formSistersCount} onChange={e=>setFormSistersCount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">عدد غرف السكن:</label><input type="text" value={formRoomsCount} onChange={e=>setFormRoomsCount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">نوع السكن:</label><input type="text" value={formHousingType} onChange={e=>setFormHousingType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هاتف ولي الأمر البديل:</label><input type="text" value={formAltGuardianPhone} onChange={e=>setFormAltGuardianPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                </div>

                <h5 className="text-[10px] font-black text-amber-600 dark:text-amber-400">معلومات الأب</h5>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">اسم الأب الثلاثي:</label><input type="text" value={formFatherName} onChange={e=>setFormFatherName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">على قيد الحياة؟</label><select value={formFatherAlive} onChange={e=>setFormFatherAlive(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">العمر:</label><input type="text" value={formFatherAge} onChange={e=>setFormFatherAge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">التحصيل الدراسي:</label><input type="text" value={formFatherEducation} onChange={e=>setFormFatherEducation(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">مهنة الأب ومكان العمل:</label><input type="text" value={formFatherJob} onChange={e=>setFormFatherJob(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هاتف الأب:</label><input type="text" value={formFatherPhone} onChange={e=>setFormFatherPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-500 block">سنة وسبب وفاة الأب:</label><input type="text" value={formFatherDeathYear} onChange={e=>setFormFatherDeathYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                </div>

                <h5 className="text-[10px] font-black text-amber-600 dark:text-amber-400">معلومات الأم</h5>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">اسم الأم الثلاثي:</label><input type="text" value={formMotherName} onChange={e=>setFormMotherName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">على قيد الحياة؟</label><select value={formMotherAlive} onChange={e=>setFormMotherAlive(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">العمر:</label><input type="text" value={formMotherAge} onChange={e=>setFormMotherAge(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">التحصيل الدراسي:</label><input type="text" value={formMotherEducation} onChange={e=>setFormMotherEducation(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">مهنة الأم ومكان العمل:</label><input type="text" value={formMotherJob} onChange={e=>setFormMotherJob(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هاتف الأم:</label><input type="text" value={formMotherPhone} onChange={e=>setFormMotherPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-500 block">سنة وسبب وفاة الأم:</label><input type="text" value={formMotherDeathYear} onChange={e=>setFormMotherDeathYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                </div>

                <h5 className="text-[10px] font-black text-amber-600 dark:text-amber-400">العمل والصحة</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">هل يعمل الطالب؟</label><select value={formIsEmployed} onChange={e=>setFormIsEmployed(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                  <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-500 block">نوع ومكان العمل:</label><input type="text" value={formEmploymentDetails} onChange={e=>setFormEmploymentDetails(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">مرض مزمن؟</label><select value={formChronicDisease} onChange={e=>setFormChronicDisease(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">تفاصيل المرض:</label><input type="text" value={formDiseaseDetails} onChange={e=>setFormDiseaseDetails(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">يراجع طبيب اختصاص؟</label><select value={formSeesSpecialist} onChange={e=>setFormSeesSpecialist(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue"><option value="">اختر</option><option value="نعم">نعم</option><option value="لا">لا</option></select></div>
                  <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-500 block">اسم الطبيب والاختصاص:</label><input type="text" value={formSpecialistDetails} onChange={e=>setFormSpecialistDetails(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-slate-500 block">الحالة النفسية/الجسدية:</label><input type="text" value={formMentalPhysicalState} onChange={e=>setFormMentalPhysicalState(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">الرسوب أو التأخير الدراسي:</label><input type="text" value={formAcademicDelay} onChange={e=>setFormAcademicDelay(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 block">المواهب:</label><input type="text" value={formTalents} onChange={e=>setFormTalents(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-office-blue" /></div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingStudent(null);
                    resetForm();
                  }}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm active:scale-98"
                >
                  {editingStudent ? 'تحديث وحفظ التعديلات' : 'حفظ الطالب في النظام'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          VIEW STUDENT PROFILE DIALOG
          ================================================================ */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            {/* Dialog Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Eye className="w-5 h-5 text-office-blue" />
                الملف الشخصي للطالب
              </h3>
              <button
                onClick={() => setViewingStudent(null)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Student Name & Badge */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-office-blue/10 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto border-2 border-office-blue/20">
                  <span className="text-xl font-black text-office-blue dark:text-blue-400">
                    {viewingStudent.fullName.charAt(0)}
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{viewingStudent.fullName}</h2>
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/40 text-office-blue dark:text-blue-400 rounded-full font-bold border border-blue-100 dark:border-blue-900/40">
                    {viewingStudent.classGrade} - شعبة {viewingStudent.section}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold ${
                    viewingStudent.gender === 'MALE'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400 border border-pink-100 dark:border-pink-900/40'
                  }`}>
                    {viewingStudent.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                  </span>
                  {viewingStudent.bloodType && (
                    <span className="px-2.5 py-0.5 text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 rounded-full font-bold border border-rose-100 dark:border-rose-900/40">
                      فصيلة الدم: {viewingStudent.bloodType}
                    </span>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Info Card */}
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    المعلومات الشخصية
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500 dark:text-slate-400">تاريخ الميلاد:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {viewingStudent.birthDate || 'غير محدد'}
                        {viewingStudent.birthDate && <span className="text-office-blue mr-2">({calculateAge(viewingStudent.birthDate)})</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500 dark:text-slate-400">رقم القيد العام:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{viewingStudent.studentNumber || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500 dark:text-slate-400">الحالة الصحية:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{viewingStudent.healthStatus || 'طبيعي'}</span>
                    </div>
                  </div>
                </div>

                {/* Family Info Card */}
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    معلومات الأسرة
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الأب:</span><span className="font-bold text-slate-800">{viewingStudent.fatherName || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">الأب على قيد الحياة:</span><span className="font-bold text-slate-800">{viewingStudent.fatherAlive || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">عمر الأب:</span><span className="font-bold text-slate-800">{viewingStudent.fatherAge || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">تحصيل الأب الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.fatherEducation || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">مهنة الأب:</span><span className="font-bold text-slate-800">{viewingStudent.fatherJob || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف الأب:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.fatherPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">سنة وسبب وفاة الأب:</span><span className="font-bold text-slate-800">{viewingStudent.fatherDeathYear || '—'}</span></div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    معلومات الأم
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الأم:</span><span className="font-bold text-slate-800">{viewingStudent.motherName || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">الأم على قيد الحياة:</span><span className="font-bold text-slate-800">{viewingStudent.motherAlive || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">عمر الأم:</span><span className="font-bold text-slate-800">{viewingStudent.motherAge || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">تحصيل الأم الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.motherEducation || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">مهنة الأم:</span><span className="font-bold text-slate-800">{viewingStudent.motherJob || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف الأم:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.motherPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">سنة وسبب وفاة الأم:</span><span className="font-bold text-slate-800">{viewingStudent.motherDeathYear || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف ولي الأمر:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.parentPhone || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">مهنة ولي الأمر:</span><span className="font-bold text-slate-800">{viewingStudent.parentJob || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">هاتف ولي الأمر البديل:</span><span className="font-bold text-slate-800 font-mono" dir="ltr">{viewingStudent.altGuardianPhone || '—'}</span></div>
                  </div>
                </div>
              </div>

              {/* Details Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    مكان وتفاصيل السكن
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">محل الولادة:</span><span className="font-bold text-slate-800">{viewingStudent.birthPlace || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">رقم البطاقة:</span><span className="font-bold text-slate-800">{viewingStudent.nationalId || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">ترتيب الطالب:</span><span className="font-bold text-slate-800">{viewingStudent.siblingOrder || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">جهة الإقامة:</span><span className="font-bold text-slate-800">{viewingStudent.residenceAuthority || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">عدد الإخوة:</span><span className="font-bold text-slate-800">{viewingStudent.brothersCount || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">عدد الأخوات:</span><span className="font-bold text-slate-800">{viewingStudent.sistersCount || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">عدد غرف السكن:</span><span className="font-bold text-slate-800">{viewingStudent.roomsCount || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">نوع السكن:</span><span className="font-bold text-slate-800">{viewingStudent.housingType || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">العنوان:</span><span className="font-bold text-slate-800">{viewingStudent.address || '—'}</span></div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    العمل والصحة والمواهب
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="font-bold text-slate-500">يعمل؟</span><span className="font-bold text-slate-800">{viewingStudent.isEmployed || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">نوع ومكان العمل:</span><span className="font-bold text-slate-800">{viewingStudent.employmentDetails || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">مرض مزمن:</span><span className="font-bold text-slate-800">{viewingStudent.chronicDisease || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">تفاصيل المرض:</span><span className="font-bold text-slate-800">{viewingStudent.diseaseDetails || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">يراجع طبيب اختصاص:</span><span className="font-bold text-slate-800">{viewingStudent.seesSpecialist || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">اسم الطبيب:</span><span className="font-bold text-slate-800">{viewingStudent.specialistDetails || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">الحالة النفسية/الجسدية:</span><span className="font-bold text-slate-800">{viewingStudent.mentalPhysicalState || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">التأخير الدراسي:</span><span className="font-bold text-slate-800">{viewingStudent.academicDelay || '—'}</span></div>
                    <div className="flex justify-between"><span className="font-bold text-slate-500">المواهب:</span><span className="font-bold text-slate-800">{viewingStudent.talents || '—'}</span></div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingStudent.notes && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 rounded-xl p-4 border border-amber-200 dark:border-amber-900/30 space-y-2">
                  <h4 className="text-[11px] font-black text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-900/30 pb-1.5">
                    ملاحظات المرشد التربوي
                  </h4>
                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed font-medium whitespace-pre-line">
                    {viewingStudent.notes}
                  </p>
                </div>
              )}

              {/* Custom Fields */}
              {viewingStudent.customFields && Object.keys(viewingStudent.customFields).length > 0 && (
                <div className="bg-slate-50 dark:bg-[#0f172a] rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-black text-office-blue dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    بيانات إضافية (من الاستيراد)
                  </h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries(viewingStudent.customFields).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-bold text-slate-500 dark:text-slate-400">{key}:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Records Link */}
              <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-xs font-black text-blue-800 dark:text-blue-300">
                    السجلات الإرشادية المرتبطة: {getStudentRecordCount(viewingStudent.id)} سجلات
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    يمكنك عرض جميع سجلات الطالب الإرشادية من قسم السجلات.
                  </p>
                </div>
                {onOpenRecords && (
                  <button
                    onClick={() => {
                      setViewingStudent(null);
                      onOpenRecords();
                    }}
                    className="bg-office-blue hover:bg-office-hover text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    فتح السجلات
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setViewingStudent(null);
                    handleStartEdit(viewingStudent);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  تعديل البيانات
                </button>
                <button
                  onClick={() => handleExportStudentData(viewingStudent)}
                  className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير السجلات
                </button>
                <button
                  onClick={() => setViewingStudent(null)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          EXCEL IMPORT WIZARD DIALOG
          ================================================================ */}
      {showImportWizard && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
            {/* Wizard Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  استيراد طلاب من ملف Excel
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  الملف: {importFileName} | {importData.length} صف بيانات
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportWizard(false);
                  setImportStep(0);
                  setImportData([]);
                  setImportHeaders([]);
                  setColumnMappings({});
                }}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2 mb-4">
                {['معاينة البيانات', 'ربط الأعمدة', 'التحقق والحفظ'].map((label, i) => (
                  <React.Fragment key={i}>
                    <div className={`flex items-center gap-1.5 ${i <= importStep - 1 ? 'text-office-blue' : 'text-slate-400 dark:text-slate-500'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${
                        i < importStep - 1
                          ? 'bg-office-blue text-white border-office-blue'
                          : i === importStep - 1
                          ? 'bg-office-blue/10 text-office-blue border-office-blue'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}>
                        {i < importStep - 1 ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className="text-[11px] font-bold hidden sm:inline">{label}</span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-0.5 ${i < importStep - 1 ? 'bg-office-blue' : 'bg-slate-200 dark:bg-slate-800'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Preview Data */}
              {importStep === 0 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    معاينة أول {Math.min(5, importData.length)} صفوف من أصل {importData.length}:
                  </p>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          {importHeaders.slice(0, 8).map(h => (
                            <th key={h} className="p-2 font-bold text-slate-600 dark:text-slate-300">{h}</th>
                          ))}
                          {importHeaders.length > 8 && <th className="p-2 text-slate-400">+{importHeaders.length - 8} أعمدة أخرى</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/10">
                            {importHeaders.slice(0, 8).map(h => (
                              <td key={h} className="p-2 text-slate-700 dark:text-slate-300">{String(row[h] || '').substring(0, 30)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowImportWizard(false);
                        setImportStep(0);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => setImportStep(1)}
                      className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                    >
                      المتابعة لربط الأعمدة
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                      قم بربط أعمدة الملف بالحقول المطلوبة في النظام:
                    </p>
                    <button
                      onClick={handleAutoMapColumns}
                      className="text-[11px] text-office-blue hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      كشف تلقائي للأعمدة
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {importHeaders.map(header => (
                      <div key={header} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-1/3 truncate" title={header}>
                          {header}
                        </span>
                        <span className="text-slate-400">←</span>
                        <select
                          value={columnMappings[header] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setColumnMappings(prev => ({ ...prev, [header]: val }));
                            if (val === 'custom') {
                              setCustomColumnNames(prev => ({ ...prev, [header]: header }));
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none"
                        >
                          <option value="">-- لا ربط --</option>
                          <optgroup label="حقول الطالب الأساسية">
                            <option value="fullName">الاسم الكامل</option>
                            <option value="gender">الجنس</option>
                            <option value="classGrade">الصف</option>
                            <option value="section">الشعبة</option>
                            <option value="birthDate">تاريخ الميلاد</option>
                            <option value="parentPhone">هاتف ولي الأمر</option>
                            <option value="parentJob">مهنة ولي الأمر</option>
                            <option value="address">السكن</option>
                          </optgroup>
                          <optgroup label="معلومات إضافية">
                            <option value="bloodType">فصيلة الدم</option>
                            <option value="healthStatus">الحالة الصحية</option>
                            <option value="notes">ملاحظات</option>
                            <option value="studentNumber">رقم القيد العام</option>
                            <option value="fatherName">اسم الأب</option>
                            <option value="motherName">اسم الأم</option>
                            <option value="motherJob">مهنة الأم</option>
                          </optgroup>
                          <option value="custom">عمود مخصص (إدخال يدوي)</option>
                        </select>
                        {columnMappings[header] === 'custom' && (
                          <input
                            type="text"
                            placeholder="اسم الحقل المخصص"
                            value={customColumnNames[header] || ''}
                            onChange={(e) => setCustomColumnNames(prev => ({ ...prev, [header]: e.target.value }))}
                            className="w-32 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setImportStep(0)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={() => setImportStep(2)}
                      className="bg-office-blue hover:bg-office-hover text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                    >
                      المتابعة للتحقق
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Validation */}
              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">جاهز للاستيراد</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      سيتم استيراد {importData.length} طالب من الملف — جميع البيانات ستُحفظ ({importHeaders.length} عمود).
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(columnMappings).filter(([_, v]) => v && v !== 'custom').map(([h, v]) => (
                        <span key={h} className="px-2 py-0.5 text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full font-bold border border-emerald-200 dark:border-emerald-900/40">
                          {h} → {v}
                        </span>
                      ))}
                    </div>
                    {importHeaders.filter(h => !columnMappings[h] || columnMappings[h] === 'custom').length > 0 && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1">
                        + {importHeaders.filter(h => !columnMappings[h] || columnMappings[h] === 'custom').length} أعمدة إضافية ستُحفظ كبيانات مخصصة
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setImportStep(1)}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={handleImportConfirm}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      بدء الاستيراد
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Import Progress */}
              {importStep === 3 && (
                <div className="space-y-4 py-8">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-office-blue/10 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto">
                      <RefreshCw className="w-8 h-8 text-office-blue dark:text-blue-400 animate-spin" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      جاري استيراد الطلاب...
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {importProgress} / {importTotal}
                    </p>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-office-blue h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                    />
                  </div>
                  {importProgress >= importTotal && (
                    <div className="text-center space-y-2 animate-fade-in">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        تم استيراد {importTotal} طالب بنجاح!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          PRINT CONTAINER
          ================================================================ */}
      {printStudent && (
        <div id="student-print-container" className="hidden print:block font-sans text-right" dir="rtl">
          <div ref={printRef} className="w-full max-w-4xl mx-auto p-6 border-4 border-double border-slate-800 rounded-xl min-h-[290mm] flex flex-col justify-between bg-white text-black">
            <div>
              {/* Official Ministry Header */}
              <div className="grid grid-cols-3 items-center border-b-2 border-slate-800 pb-4 mb-6">
                <div className="text-xs space-y-1 text-right font-bold text-black">
                  <p className="font-extrabold text-[14px]">جمهورية العراق</p>
                  <p>وزارة التربية</p>
                  <p>المديرية العامة لتربية {profile.province || 'كركوك'}</p>
                  <p>المدرسة: {profile.schoolName || '..........'}</p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-full border-2 border-slate-800 flex items-center justify-center mx-auto mb-1">
                    <Users className="w-8 h-8 text-slate-800" />
                  </div>
                  <p className="text-[10px] font-black text-slate-800">ملف الطالب الشخصي</p>
                </div>

                <div className="text-xs space-y-1 text-left font-bold text-black">
                  <p className="font-extrabold text-[14px]">الملف الرقمي للطالب</p>
                  <p>العام الدراسي: {academicYear(profile.academicYear) || '2026-2025'}</p>
                  <p>المرشد: {profile.fullName || 'المرشد التربوي'}</p>
                  <p className="font-mono">تاريخ الطباعة: {new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>

              {/* Student Name Title */}
              <div className="text-center my-6">
                <h2 className="text-xl font-black text-slate-900 border-b-4 border-double border-slate-900 pb-2.5 inline-block px-12">
                  الملف الشخصي: {printStudent.fullName}
                </h2>
              </div>

              {/* Student Info Summary */}
              <div className="grid grid-cols-2 bg-slate-100 border-2 border-slate-800 rounded-lg p-4 text-sm font-black my-6 text-black">
                <div className="space-y-1">
                  <p>الاسم الكامل: {printStudent.fullName}</p>
                  <p>الصف والشعبة: {printStudent.classGrade} - {printStudent.section}</p>
                  <p>الجنس: {printStudent.gender === 'MALE' ? 'ذكر' : 'أنثى'}</p>
                  <p>رقم القيد العام: {printStudent.studentNumber || '..........'}</p>
                </div>
                <div className="space-y-1 text-left">
                  <p>رقم القيد العام: {printStudent.studentNumber || '..........'}</p>
                  <p>تاريخ الميلاد: {printStudent.birthDate || '..........'} {printStudent.birthDate && `(${calculateAge(printStudent.birthDate)})`}</p>
                  <p>فصيلة الدم: {printStudent.bloodType || '..........'}  </p>
                  <p>الحالة الصحية: {printStudent.healthStatus || 'طبيعي'}</p>
                </div>
              </div>

              {/* Family Info Table */}
              <div className="mt-6 border-2 border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b-2 border-slate-800 text-slate-950 font-extrabold text-sm">
                      <th className="py-3 px-3 border-l-2 border-slate-800 text-center font-extrabold text-[13px] w-[30%]">البيان</th>
                      <th className="py-3 px-3 text-center font-extrabold text-[13px] w-[70%]">المعلومة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['اسم الأب الكامل', printStudent.fatherName || '..........'],
                      ['مهنة ولي الأمر', printStudent.parentJob || '..........'],
                      ['هاتف ولي الأمر', printStudent.parentPhone || '..........'],
                      ['اسم الأم', printStudent.motherName || '..........'],
                      ['مهنة الأم', printStudent.motherJob || '..........'],
                      ['السكن بالتفصيل', printStudent.address || '..........']
                    ].map(([label, value], idx) => (
                      <tr key={idx} className={`border-b border-slate-400 last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="py-3 px-3 border-l border-slate-400 text-xs font-black text-slate-900 text-center bg-slate-100">{label}</td>
                        <td className="py-3 px-3 text-xs text-slate-900 font-medium text-right leading-relaxed">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {printStudent.notes && (
                <div className="mt-6 border-2 border-slate-800 rounded-lg p-5 bg-white space-y-2 text-black">
                  <h3 className="font-black text-slate-950 text-[14px] border-b-2 border-slate-300 pb-2">
                    ملاحظات المرشد التربوي:
                  </h3>
                  <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-line font-medium">
                    {printStudent.notes}
                  </p>
                </div>
              )}

              {/* Custom Fields */}
              {printStudent.customFields && Object.keys(printStudent.customFields).length > 0 && (
                <div className="mt-6 border-2 border-slate-800 rounded-lg p-5 bg-white space-y-2 text-black">
                  <h3 className="font-black text-slate-950 text-[14px] border-b-2 border-slate-300 pb-2">
                    بيانات إضافية:
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(printStudent.customFields).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-black text-slate-700">{key}:</span>
                        <span className="font-medium text-slate-900">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Signatures block */}
            <div className="grid grid-cols-2 text-xs font-bold mt-12 border-t-2 border-slate-800 pt-6 text-black">
              <div className="text-right space-y-2">
                <p className="font-extrabold text-[13px]">توقيع المرشد التربوي والاجتماعي:</p>
                <p className="text-slate-800">الاسم الثلاثي: {profile.fullName || '................................'}</p>
                <p className="text-slate-800">التوقيع الصريح:</p>
              </div>
              <div className="text-left space-y-2">
                <p className="font-extrabold text-[13px]">مصادقة وتوقيع مدير المدرسة:</p>
                <p className="text-slate-800">الاسم الثلاثي: ............................................</p>
                <p className="text-slate-800">التوقيع والختم الرسمي للمدرسة:</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
