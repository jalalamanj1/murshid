/**
 * Template Registry — centralized metadata for all DOCX templates.
 *
 * Every record type has its own template registered here.
 * Adding a new template = add one entry + place the .docx file.
 * No changes needed in ExportService or TemplateManager.
 *
 * Each template entry:
 *   id              – unique identifier (maps to assets/templates/<id>/)
 *   displayName     – Arabic name shown in the UI
 *   templateFile    – expected .docx filename in the template directory
 *   outputFileName  – default filename for generated documents
 *   supportedFormats – ['docx'] currently, 'pdf' in future
 *   placeholderSchema – list of available placeholders (loaded at runtime)
 */

const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'assets', 'templates');

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

// ── Template definitions ─────────────────────────────────────────────

const TEMPLATE_DEFS = [
  {
    id: 'study-case',
    displayName: 'دراسة حالة',
    templateFile: 'study-case.docx',
    outputFileName: 'study-case.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
  {
    id: 'individual-counseling',
    displayName: 'إرشاد فردي',
    templateFile: 'counselling-sessions.docx',
    outputFileName: 'counselling-sessions.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
  {
    id: 'group-counseling',
    displayName: 'إرشاد جماعي',
    templateFile: 'counselling-sessions.docx',
    outputFileName: 'counselling-sessions.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
  {
    id: 'daily-activity',
    displayName: 'نشاط يومي',
    templateFile: 'daily-activity.docx',
    outputFileName: 'daily-activity.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
  {
    id: 'health-record',
    displayName: 'السجل الصحي',
    templateFile: 'health.docx',
    outputFileName: 'health.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
  {
    id: 'parent-loss',
    displayName: 'سجل فاقدي الوالدين',
    templateFile: 'orphan.docx',
    outputFileName: 'orphan.docx',
    supportedFormats: ['docx'],
    placeholderSchema: [],
  },
    {
      id: 'special-gifted',
      displayName: 'الطلبة المتفوقون والموهوبون',
      templateFile: 'talented.docx',
      outputFileName: 'talented.docx',
      supportedFormats: ['docx'],
      placeholderSchema: [],
    },
    {
      id: 'special-delayed',
      displayName: 'الطلبة المتأخرون دراسياً',
      templateFile: 'late.docx',
      outputFileName: 'late.docx',
      supportedFormats: ['docx'],
      placeholderSchema: [],
    },
    {
      id: 'special-absent',
      displayName: 'الطلبة الغائبون',
      templateFile: 'absent.docx',
      outputFileName: 'absent.docx',
      supportedFormats: ['docx'],
      placeholderSchema: [],
    },
];

// ── Registry ─────────────────────────────────────────────────────────

class TemplateRegistry {
  constructor() {
    this._templates = [];
    this._initialized = false;
  }

  /**
   * Initialize registry: load template metadata, validate files.
   * Call once at application startup. Safe to call multiple times.
   */
  initialize() {
    if (this._initialized) return { loaded: this._templates.length, missing: [], errors: [] };
    this._initialized = true;
    const missing = [];
    const errors = [];

    for (const def of TEMPLATE_DEFS) {
      const templateDir = path.join(TEMPLATES_DIR, def.id);
      const templatePath = path.join(templateDir, def.templateFile);

      // Check if the template file exists
      if (!fs.existsSync(templatePath)) {
        missing.push(def.id);
        continue;
      }

      // Read the file to verify it's accessible
      try {
        const buffer = fs.readFileSync(templatePath);

        // Try to extract placeholder schema
        try {
          const PizZip = require('pizzip');
          const zip = new PizZip(buffer);
          const xmlFile = zip.file('word/document.xml');
          if (xmlFile) {
            const content = xmlFile.asText();
            const keys = new Set();
            let match;
            while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
              keys.add(match[1]);
            }
            // Also check headers/footers
            for (let i = 1; i <= 3; i++) {
              const hf = zip.file(`word/header${i}.xml`) || zip.file(`word/footer${i}.xml`);
              if (hf) {
                const hfContent = hf.asText();
                while ((match = PLACEHOLDER_REGEX.exec(hfContent)) !== null) {
                  keys.add(match[1]);
                }
              }
            }
            def.placeholderSchema = [...keys];
          }
        } catch {
          // Schema extraction is non-fatal
          def.placeholderSchema = [];
        }

        this._templates.push({
          ...def,
          templatePath,
          exists: true,
        });
      } catch (err) {
        errors.push(`${def.id}: ${err.message}`);
      }
    }

    return {
      loaded: this._templates.length,
      missing,
      errors,
    };
  }

  /**
   * Get all registered templates.
   */
  getAll() {
    return this._templates;
  }

  /**
   * Get a specific template by id.
   *
   * @param {string} id
   * @returns {object | undefined}
   */
  get(id) {
    return this._templates.find(t => t.id === id);
  }

  /**
   * Check if a template exists and is loaded.
   *
   * @param {string} id
   * @returns {boolean}
   */
  exists(id) {
    return this._templates.some(t => t.id === id);
  }

  /**
   * Get the template file path for a given id.
   *
   * @param {string} id
   * @returns {string | null}
   */
  getPath(id) {
    const t = this.get(id);
    return t ? t.templatePath : null;
  }

  /**
   * Get the placeholder schema for a given id.
   *
   * @param {string} id
   * @returns {string[]}
   */
  getPlaceholders(id) {
    const t = this.get(id);
    return t ? t.placeholderSchema : [];
  }

  /**
   * Get the output filename for a given id.
   *
   * @param {string} id
   * @returns {string}
   */
  getOutputFileName(id) {
    const t = this.get(id);
    return t ? t.outputFileName : `${id}.docx`;
  }
}

// Singleton — initialized once at startup
const templateRegistry = new TemplateRegistry();

module.exports = { templateRegistry, TemplateRegistry };
