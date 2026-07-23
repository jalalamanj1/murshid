/**
 * ExportService — generates DOCX exports using Dynamic Placeholder Mapping.
 *
 * Placeholders are automatically read from the DOCX template.
 * Object properties are automatically read from the record.
 * Matching is done by name — no manual maintenance needed when names match.
 *
 * TRANSFORMATIONS (optional) — only needed when:
 *   - Placeholder name differs from property name
 *   - Value needs transformation (array→string, nested→flat)
 *   - Value comes from a calculated field
 *
 * Adding a new record type:
 *   1. Register template in template-registry.cjs
 *   2. Add transformations ONLY for non-matching placeholders
 *   3. No ExportService code changes needed
 */

const { templateManager } = require('./template-manager.cjs');
const { templateRegistry } = require('./template-registry.cjs');

// ── Transformations — only for non-matching placeholder→property pairs ──
// Key: placeholder name, Value: resolver function(record) → string
// If a placeholder is NOT listed here, auto-matching by name is used.

const TRANSFORMATIONS = {
  'study-case': {
    // Identity fields (entered manually in the form)
    studentcode: (r) => r.studentCode || '',
    studentName: (r) => r.studentName || '',
    studentliveswith: (r) => r.livesWith || '',
    // Parent / family (entered manually in the form)
    parentcode: (r) => r.parentCode || '',
    fatherjobtitle: (r) => r.fatherJobTitle || r.fatherjobtitle || '',
    dateofbirth: (r) => r.dateofbirth || r.birthDate || '',
    familymembers: (r) => r.familyCount || '',
    siblings: (r) => r.siblingsCount || '',
    order: (r) => r.birthOrder || '',
    // Case info
    referencesource: (r) => r.referralSource || '',
    dayofregister: (r) => r.caseDay || '',
    dateofregister: (r) => r.caseDate || '',
    // Case type
    type: (r) => (Array.isArray(r.caseTypes) ? r.caseTypes.join('، ') : r.caseTypes || ''),
    // Visit dates
    firsttimedate: (r) => (r.followUps?.[0]?.date ?? (r.reviews?.[0]?.date ?? '')),
    secondtimedate: (r) => (r.followUps?.[1]?.date ?? ''),
    thirdtimedate: (r) => (r.followUps?.[2]?.date ?? ''),
    // Review summary
    summary: (r) => (r.reviews?.[0]?.observation ?? ''),
    // Treatment goals
    goal1: (r) => (r.treatmentGoals?.[0]?.goal ?? ''),
    goal2: (r) => (r.treatmentGoals?.[1]?.goal ?? ''),
    goal3: (r) => (r.treatmentGoals?.[2]?.goal ?? ''),
    goal4: (r) => (r.treatmentGoals?.[3]?.goal ?? ''),
    goal5: (r) => (r.treatmentGoals?.[4]?.goal ?? ''),
    steps1: (r) => (r.treatmentGoals?.[0]?.actions ?? ''),
    steps2: (r) => (r.treatmentGoals?.[1]?.actions ?? ''),
    steps3: (r) => (r.treatmentGoals?.[2]?.actions ?? ''),
    steps4: (r) => (r.treatmentGoals?.[3]?.actions ?? ''),
    steps5: (r) => (r.treatmentGoals?.[4]?.actions ?? ''),
    // Follow-up notes
    note1: (r) => (r.followUps?.[0]?.observation ?? ''),
    note2: (r) => (r.followUps?.[1]?.observation ?? ''),
    note3: (r) => (r.followUps?.[2]?.observation ?? ''),
    note4: (r) => (r.followUps?.[3]?.observation ?? ''),
    note5: (r) => (r.followUps?.[4]?.observation ?? ''),
    notedate1: (r) => (r.followUps?.[0]?.date ?? ''),
    notedate2: (r) => (r.followUps?.[1]?.date ?? ''),
    notedate3: (r) => (r.followUps?.[2]?.date ?? ''),
    notedate4: (r) => (r.followUps?.[3]?.date ?? ''),
    notedate5: (r) => (r.followUps?.[4]?.date ?? ''),
    // Closure
    enddate: (r) => (r.closure?.closedDate ?? ''),
    amountofsessionstaken: (r) => r.sessionsTaken || String(r.totalSessions ?? ''),
  },

  'parent-loss': {
    studentname: (r) => r.studentName || '',
    address: (r) => r.address || '',
    class: (r) => [r.grade, r.section].filter(Boolean).join(' — ') || '',
    phone1: (r) => r.guardianPhoneField || '',
    phone2: (r) => r.guardianPhone || '',
    typeoflosing: (r) => (r.lossType === 'أخرى' ? (r.lossTypeOther || '') : (r.lossType || '')),
    beforelosing: (r) => r.academicLevelBeforeLoss || '',
    afterlosing: (r) => r.academicLevelAfterLoss || '',
    caregivername: (r) => r.guardianName || '',
    studentlivingwith: (r) => (r.livesWith === 'أخرى' ? (r.livesWithOther || '') : (r.livesWith || '')),
    studentattitude: (r) => r.studentBehavior || '',
  },

  'health-record': {
    studentname: (r) => r.studentName || '',
    class: (r) => [r.grade, r.section].filter(Boolean).join(' — ') || '',
    address: (r) => r.address || '',
    phone: (r) => r.guardianPhone || '',
    sickness: (r) => (r.diseaseType === 'أخرى' ? (r.diseaseTypeOther || '') : (r.diseaseType || '')),
    history: (r) => r.diseaseDescription || '',
    procedures: (r) => r.procedures || '',
  },

  'special-gifted': {
    studentname: (r) => r.studentName || '',
    class: (r) => [r.grade, r.section].filter(Boolean).join(' — ') || '',
    address: (r) => r.address || '',
    phone: (r) => r.guardianPhone || '',
    talent: (r) => (r.talentType === 'أخرى' ? (r.talentTypeOther || '') : (r.talentType || '')),
    servicesprovided: (r) => r.counselorServices || '',
    guidance: (r) => r.careerGuidance || '',
    problems: (r) => r.studentProblems || '',
    relationshipwithpeers: (r) => r.peerBehavior || '',
    proceeders: (r) => r.procedures || '',
    followup: (r) => r.evaluation || '',
  },

  'special-delayed': {
    studentname: (r) => r.studentName || '',
    class: (r) => [r.grade, r.section].filter(Boolean).join(' — ') || '',
    latetype: (r) => (r.delayType === 'أخرى' ? (r.delayTypeOther || '') : (r.delayType || '')),
    latereason: (r) => r.delayReason || '',
    proceeders: (r) => r.procedures || '',
  },

  'special-absent': {
      studentname: (r) => r.studentName || '',
      class: (r) => [r.grade, r.section].filter(Boolean).join(' - ') || '',
      typeofabsense: (r) => r.absenceType || '',
      amountofdaysabsent: (r) => String(r.absenceDays ?? ''),
      proceeders: (r) => r.procedures || '',
      followup: (r) => r.evaluation || '',
    },

    // ── Counseling Sessions (individual & group share one template) ──
    'individual-counseling': {
      sessiontitle: (r) => r.sessionTitle || '',
      generalgoal: (r) => r.generalObjective || '',
      privategoals: (r) => r.specificObjectives || '',
      strategies: (r) => r.activitiesStrategies || '',
      beneficial: (r) => {
        if (r.beneficiary === 'other') return r.beneficiaryOther || '';
        return r.beneficiary || '';
      },
      date: (r) => r.sessionDate || '',
      activity: (r) => r.activity || '',
      followup: (r) => r.evaluation || '',
    },
    'group-counseling': {
      sessiontitle: (r) => r.sessionTitle || '',
      generalgoal: (r) => r.generalObjective || '',
      privategoals: (r) => r.specificObjectives || '',
      strategies: (r) => r.activitiesStrategies || '',
      beneficial: (r) => {
        if (r.beneficiary === 'other') return r.beneficiaryOther || '';
        return r.beneficiary || '';
      },
      date: (r) => r.sessionDate || '',
      activity: (r) => r.activity || '',
      followup: (r) => r.evaluation || '',
    },
    // Daily Activity Plan — one page per day; each activity becomes a table row.
    'daily-activity': {
      day: (r) => r.day || '',
      date: (r) => r.date || '',
      // Array kept intact so the template renders one row per activity.
      activities: (r) => (Array.isArray(r.activities)
        ? r.activities.map(a => ({
            activity: a.activity || '',
            place: a.location || '',
            details: a.details || '',
          }))
        : []),
    },
  };

// Map a SpecialCaseCategory to its template registry id
const SPECIAL_CATEGORY_TEMPLATE = {
  GIFTED_TALENTED: 'special-gifted',
  ACADEMIC_DELAYED: 'special-delayed',
  ABSENT: 'special-absent',
};

// ── DynamicMapper ─────────────────────────────────────────────────────

class DynamicMapper {
  /**
   * @param {string[]} templatePlaceholders - e.g. ['siblings', 'order', ...]
   * @param {object} record - The CaseStudy/record object
   * @param {object} transformations - Optional overrides for non-matching pairs
   */
  constructor(templatePlaceholders, record, transformations = {}) {
    this.placeholders = templatePlaceholders;
    this.record = record;
    this.transformations = transformations;
  }

  /**
   * Map all placeholders to values.
   * Auto-matches by name first, falls back to transformations, defaults to ''.
   *
   * @returns {{ values: object, report: Array<object> }}
   */
  map() {
    const values = {};
    const report = [];

    for (const placeholder of this.placeholders) {
      let value;
      let method = 'default';

      // 1. Check transformations first (explicit override)
      if (this.transformations[placeholder] !== undefined) {
        const resolver = this.transformations[placeholder];
        value = typeof resolver === 'function' ? resolver(this.record) : this.record[resolver];
        method = 'transformation';
      } else {
        // 2. Auto-match by name
        value = this.record[placeholder];
        if (value !== undefined) {
          method = 'auto-match';
        } else {
          // 3. Auto-match with common prefixes (e.g., student_name → name)
          const altKey = Object.keys(this.record).find(k =>
            k.toLowerCase().replace(/[_-]/g, '') === placeholder.toLowerCase().replace(/[_-]/g, '')
          );
          if (altKey) {
            value = this.record[altKey];
            method = `auto-match (alias: ${altKey})`;
          }
        }
      }

      // Convert to string
      const strValue = (value === undefined || value === null) ? '' : String(value);
      values[placeholder] = strValue;

      report.push({
        placeholder,
        method,
        found: value !== undefined && value !== null,
        valuePreview: strValue.slice(0, 60),
      });
    }

    return { values, report };
  }

  /**
   * Generate a validation report.
   * @param {Array} report - from map()
   * @returns {object} { valid, missing, warnings, summary }
   */
  static validate(report) {
    const missing = report.filter(r => !r.found);
    const autoMatched = report.filter(r => r.method === 'auto-match');
    const transformed = report.filter(r => r.method === 'transformation');

    return {
      valid: missing.length === 0,
      missing: missing.map(r => r.placeholder),
      autoMatched: autoMatched.length,
      transformed: transformed.length,
      totalPlaceholders: report.length,
      report,
    };
  }
}

// ── ExportService ─────────────────────────────────────────────────────

class ExportService {
  exportDocx(recordType, records) {
    if (!records || records.length === 0) return null;

    if (!templateRegistry.exists(recordType)) {
      throw new Error(`No template registered for "${recordType}".`);
    }

    const validation = templateManager.validate(recordType);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(' ')}`);
    }

    const placeholders = validation.placeholders;
    const transformations = TRANSFORMATIONS[recordType] || {};

      const allValues = [];
      for (const record of records) {
        const mapper = new DynamicMapper(placeholders, record, transformations);
        const { values, report } = mapper.map();

        // Run validation
        const vResult = DynamicMapper.validate(report);
        if (!vResult.valid) {
          console.log(`[Export] Missing placeholders for "${recordType}": ${vResult.missing.join(', ')}`);
          // Don't block export — missing placeholders become empty strings
        }

        // Attach loop arrays (e.g. activities) that aren't captured as single placeholders.
        if (transformations.activities) {
          values.activities = typeof transformations.activities === 'function'
            ? transformations.activities(record)
            : record[transformations.activities];
        }

        allValues.push(values);
      }

    const result = templateManager.generateBulk(recordType, allValues);
    if (!result) {
      throw new Error(`Template generation failed for "${recordType}".`);
    }

    return result;
  }

  /**
   * Export a single SpecialCaseRecord using the template matching its category.
   * @param {string} category - SpecialCaseCategory ('GIFTED_TALENTED' | 'ACADEMIC_DELAYED' | 'ABSENT')
   * @param {object} record - The SpecialCaseRecord
   */
  exportSpecialCaseDocx(category, record) {
    const recordType = SPECIAL_CATEGORY_TEMPLATE[category];
    if (!recordType) throw new Error(`No template for category "${category}".`);
    return this.exportDocx(recordType, [record]);
  }
}

const exportService = new ExportService();
module.exports = { exportService, ExportService, DynamicMapper };
