/**
 * RecordCoverService — DOCX → PDF record cover generator.
 *
 * Scans assets/records-cover/ for model folders (each = one cover template).
 * Fills placeholders via docxtemplater, converts to HTML via mammoth,
 * then renders to PDF via Electron's printToPDF for maximum fidelity.
 *
 * Works 100% offline with zero external dependencies.
 */

const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const COVERS_DIR = path.join(__dirname, '..', 'assets', 'records-cover');
const PLACEHOLDER_KEYS = ['school_name', 'academic_year', 'title', 'counselor_name'];

/**
 * Get the user-writable models directory (outside ASAR).
 * Users can add new models here without rebuilding the app.
 */
function getUserModelsDir() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'records-cover');
  } catch {
    return null;
  }
}

const DEFAULT_SAVE_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || 'Documents',
  'Documents',
  'Murshid',
  'Record Covers'
);

class RecordCoverService {
  /**
   * Scan the covers directory and return an array of available models.
   * Each model = one folder containing a .docx file and a preview image.
   */
  /**
   * Scan a single directory for model folders.
   */
  _scanDir(dirPath, seenIds) {
    const results = [];
    if (!fs.existsSync(dirPath)) return results;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip if already found (bundled takes priority over user)
      if (seenIds.has(entry.name)) continue;
      seenIds.add(entry.name);

      const folderPath = path.join(dirPath, entry.name);
      let files;
      try { files = fs.readdirSync(folderPath); } catch { continue; }

      const docx = files.find(f => f.toLowerCase().endsWith('.docx'));
      const preview = files.find(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (!docx) continue;

      results.push({
        id: entry.name,
        name: entry.name,
        docxPath: path.join(folderPath, docx),
        previewPath: preview ? path.join(folderPath, preview) : null,
      });
    }
    return results;
  }

  listModels() {
    const seenIds = new Set();
    // 1. Bundled models (inside ASAR — read-only, shipped with app)
    const bundled = this._scanDir(COVERS_DIR, seenIds);
    // 2. User models (writable directory — added without rebuilding)
    const userDir = getUserModelsDir();
    const userModels = userDir ? this._scanDir(userDir, seenIds) : [];
    // Merge: bundled first, then user-added
    const all = [...bundled, ...userModels];
    all.sort((a, b) => a.id.localeCompare(b.id));
    return all;
  }

  /**
   * Fill a cover template with the given values and return the filled DOCX buffer.
   * Does NOT save to disk.
   *
   * @param {string} modelId - Folder name (e.g. 'model-1')
   * @param {object} values - { school_name, academic_year, title, counselor_name }
   * @returns {{ ok: boolean, buffer?: Buffer, error?: string }}
   */
  async fillCover(modelId, values) {
    // 1. Find the model
    const models = this.listModels();
    const model = models.find(m => m.id === modelId);
    if (!model) return { ok: false, error: `لم يتم العثور على النموذج "${modelId}".` };

    // 2. Validate required values
    const missing = [];
    for (const key of PLACEHOLDER_KEYS) {
      if (!values[key] || !String(values[key]).trim()) {
        missing.push(`{{${key}}}`);
      }
    }
    if (missing.length > 0) {
      return { ok: false, error: `القيم التالية مطلوبة: ${missing.join('، ')}` };
    }

    // 3. Pre-process XML: merge runs split by Word spell-check proofErr tags.
    let mergedBuffer;
    try {
      mergedBuffer = this._mergeRunTextAcrossProofErr(model.docxPath);
    } catch (err) {
      return { ok: false, error: `تعذرت معالجة القالب: ${err.message}` };
    }

    // 4. Validate the merged template for placeholder issues
    const validation = this._validateTemplate(mergedBuffer);
    if (validation.errors.length > 0) {
      return { ok: false, error: validation.errors.join('\n') };
    }

    // 5. Fill the DOCX template
    try {
      const zip = new PizZip(mergedBuffer);
      const doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        linebreaks: true,
        nullGetter: () => '',
      });
      doc.render(values);
      const filledBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      return { ok: true, buffer: filledBuffer };
    } catch (err) {
      const details = [];
      if (err.properties && err.properties.errors && Array.isArray(err.properties.errors)) {
        for (const subErr of err.properties.errors) {
          const row = [];
          if (subErr.tag) row.push(`القالب: {{${subErr.tag}}}`);
          if (subErr.offset != null) row.push(`الموضع: ${subErr.offset}`);
          if (subErr.paragraphIndex != null) row.push(`الفقرة: ${subErr.paragraphIndex}`);
          if (subErr.properties) {
            if (subErr.properties.file) row.push(`الملف: ${subErr.properties.file}`);
            if (subErr.properties.explanation) row.push(`السبب: ${subErr.properties.explanation}`);
          }
          if (subErr.message && !subErr.message.includes('MultiError')) {
            row.push(`الخطأ: ${subErr.message}`);
          } else if (subErr.name) {
            row.push(`النوع: ${subErr.name}`);
          }
          details.push(row.join(' | '));
        }
      }
      if (details.length === 0) {
        const tagMatch = (err.message || '').match(/\{\{(\w+)\}\}/);
        if (tagMatch) details.push(`العنصر النائب {{${tagMatch[1]}}} سبب المشكلة.`);
        details.push(err.message || 'خطأ غير معروف');
      }
      console.error('[RecordCoverService] Docxtemplater errors:');
      for (const d of details) console.error('  -', d);
      return { ok: false, error: `فشل تعبئة القالب:\n${details.join('\n')}` };
    }
  }

  /**
   * Generate a DOCX cover for the given model and save to disk.
   *
   * @param {string} modelId - Folder name (e.g. 'model-1')
   * @param {object} values - { school_name, academic_year, title, counselor_name }
   * @returns {{ ok: boolean, docxPath?: string, error?: string }}
   */
  async generateCover(modelId, values) {
    const result = await this.fillCover(modelId, values);
    if (!result.ok) return result;

    const saveDir = this._ensureSaveDir();
    const timestamp = Date.now();
    const finalName = `cover-${modelId}-${timestamp}.docx`;
    const finalPath = path.join(saveDir, finalName);
    try {
      fs.writeFileSync(finalPath, result.buffer);
      return { ok: true, docxPath: finalPath };
    } catch (err) {
      return { ok: false, error: `فشل حفظ DOCX النهائي: ${err.message}` };
    }
  }

  /**
   * Pre-process the DOCX XML to:
   * 1. Remove <w:proofErr> tags (Word spell-check runs that split placeholders)
   * 2. Merge adjacent <w:r> runs with identical formatting (rejoining split placeholders)
   * 3. Fix malformed placeholders (e.g. {schoolname}} → {{school_name}})
   * 4. Normalize placeholder names to match expected keys
   *
   * @param {string} docxPath - Path to the .docx file
   * @returns {Buffer} - Modified DOCX buffer with clean, merged runs
   */
  _mergeRunTextAcrossProofErr(docxPath) {
    const templateBuffer = fs.readFileSync(docxPath);
    const zip = new PizZip(templateBuffer);
    let xml = zip.file('word/document.xml').asText();

    // Step 1: Remove all <w:proofErr .../> tags (cosmetic spell-check markers)
    xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');

    // Step 2: Merge adjacent <w:r> runs with identical <w:rPr>.
    // Process each <w:p> paragraph individually to avoid cross-paragraph merging.
    const pRegex = /<w:p[\s\S]*?<\/w:p>/g;
    const paragraphs = [];
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      paragraphs.push({ full: pMatch[0], start: pMatch.index, end: pMatch.index + pMatch[0].length });
    }

    for (const para of paragraphs) {
      let mergedPara = para.full;
      // Repeatedly merge pairs of consecutive runs until no more merges occur
      let prev = '';
      while (prev !== mergedPara) {
        prev = mergedPara;
        mergedPara = mergedPara.replace(
          /(<w:r><w:rPr>[\s\S]*?<\/w:rPr><w:t[^>]*>)([^<]*)<\/w:t><\/w:r><w:r><w:rPr>[\s\S]*?<\/w:rPr><w:t[^>]*>([^<]*)<\/w:t><\/w:r>/g,
          (_m, open1, text1, text2) => open1 + text1 + text2 + '</w:t></w:r>'
        );
      }
      // Replace the original paragraph with the merged one
      xml = xml.substring(0, para.start) + mergedPara + xml.substring(para.end);
      const lenDiff = mergedPara.length - para.full.length;
      // Adjust positions of subsequent paragraphs
      for (let i = 1; i < paragraphs.length; i++) {
        if (paragraphs[i].start > para.start) {
          paragraphs[i].start += lenDiff;
          paragraphs[i].end += lenDiff;
        }
      }
    }

    // Step 3: Fix malformed placeholders.
    // Template has {schoolname}} (single opening brace) — fix to {{schoolname}}.
    xml = xml.replace(/<w:t[^>]*>\{(\w+)\}\}<\/w:t>/g, (_m, name) => '<w:t>{{' + name + '}}</w:t>');

    // Step 4: Normalize placeholder names — simple string replacement.
    xml = xml.split('{{schoolname}}').join('{{school_name}}');
    xml = xml.split('{{academicyear}}').join('{{academic_year}}');
    xml = xml.split('{{counselorname}}').join('{{counselor_name}}');

    zip.file('word/document.xml', xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /**
   * Validate the merged DOCX template for placeholder issues.
   * Returns a list of errors found.
   */
  _validateTemplate(mergedBuffer) {
    const errors = [];
    const zip = new PizZip(mergedBuffer);
    const xml = zip.file('word/document.xml').asText();

    // Extract the body text content for placeholder analysis
    const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
    if (!bodyMatch) {
      errors.push('لم يتم العثور على وثيقة المحتوى (word/document.xml) في القالب.');
      return { errors, valid: errors.length === 0 };
    }
    const body = bodyMatch[1];

    // Extract all text content from <w:t> elements (after merging)
    const textParts = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = tRegex.exec(body)) !== null) {
      textParts.push(match[1]);
    }
    const fullText = textParts.join('');

    // Find all {{...}} placeholders in the merged text
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const foundPlaceholders = [];
    while ((match = placeholderRegex.exec(fullText)) !== null) {
      foundPlaceholders.push(match[1]);
    }

    // Check for each expected placeholder
    const expected = new Set(PLACEHOLDER_KEYS);
    const found = new Set(foundPlaceholders);
    for (const key of PLACEHOLDER_KEYS) {
      if (!found.has(key)) {
        // Try to find where it should have been — search raw XML for partial text
        const rawParts = [];
        const rawRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        while ((match = rawRegex.exec(xml)) !== null) {
          rawParts.push(match[1]);
        }
        const rawFull = rawParts.join('');
        if (rawFull.includes(key)) {
          errors.push(`العنصر النائب {{${key}}} موجود في القالب ولكنه مقسم عبر خانات نصية متعددة (Word قام بتقسيمه).`);
        } else if (rawFull.includes(`{{${key}}}`) || rawFull.includes(`{{${key}`) || rawFull.includes(`${key}}}`)) {
          errors.push(`العنصر النائب {{${key}}} موجود في القالب ولكن بأقواس غير مكتملة.`);
        } else {
          errors.push(`العنصر النائب {{${key}}} غير موجود في القالب.`);
        }
      }
    }

    // Check for unclosed/malformed placeholders
    const openBraces = (fullText.match(/\{\{/g) || []).length;
    const closeBraces = (fullText.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`عدد الأقواس غير متطابق: {{ يظهر ${openBraces} مرة، }} يظهر ${closeBraces} مرة.`);
    }

    return { errors, valid: errors.length === 0 };
  }

  /**
   * Get the preview image path for a model, relative to the app's resources.
   * Returns null if no preview exists.
   */
  getPreviewPath(modelId) {
    const models = this.listModels();
    const model = models.find(m => m.id === modelId);
    return model ? model.previewPath : null;
  }

  /**
   * Ensure the save directory exists and return its path.
   */
  _ensureSaveDir() {
    if (!fs.existsSync(DEFAULT_SAVE_DIR)) {
      fs.mkdirSync(DEFAULT_SAVE_DIR, { recursive: true });
    }
    return DEFAULT_SAVE_DIR;
  }
}

module.exports = { RecordCoverService };
