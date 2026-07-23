/**
 * TemplateManager — DOCX template engine using Docxtemplater.
 *
 * All templates are registered in the Template Registry.
 * No hardcoded paths. No manual XML editing.
 */

const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { templateRegistry } = require('./template-registry.cjs');

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

class TemplateManager {
  listTemplates() {
    return templateRegistry.getAll().map(t => ({
      recordType: t.id,
      file: t.templateFile,
      path: t.templatePath,
      exists: t.exists,
      displayName: t.displayName,
      placeholders: t.placeholderSchema,
    }));
  }

  validate(recordType) {
    const errors = [];
    const template = templateRegistry.get(recordType);
    if (!template || !template.exists) {
      return { valid: false, errors: [`Template "${recordType}" not found.`], placeholders: [] };
    }
    let zip;
    try {
      const buffer = fs.readFileSync(template.templatePath);
      zip = new PizZip(buffer);
    } catch {
      return { valid: false, errors: [`Template "${recordType}" is not a valid DOCX file.`], placeholders: [] };
    }
    if (!zip.file('word/document.xml')) {
      return { valid: false, errors: [`Template "${recordType}" missing word/document.xml.`], placeholders: [] };
    }
    return { valid: true, errors, placeholders: template.placeholderSchema };
  }

  generate(recordType, values = {}) {
    const entry = templateRegistry.get(recordType);
    if (!entry || !entry.exists) return null;

    let templateBuffer = fs.readFileSync(entry.templatePath);
    const placeholders = entry.placeholderSchema.length > 0
      ? entry.placeholderSchema : this._extractPlaceholders(templateBuffer);

    const data = {};
    for (const key of placeholders) data[key] = '';
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null) {
        // Keep arrays intact so docxtemplater can render them as a loop (e.g. activities rows).
        data[key] = Array.isArray(value) ? value : String(value);
      }
    }

    // Daily Activity Plan: expand one table row per activity before rendering.
    if (recordType === 'daily-activity' && Array.isArray(values.activities)) {
      const zip = new PizZip(templateBuffer);
      const xml = zip.file('word/document.xml').asText();
      const rendered = this._renderActivityRows(xml, values.activities);
      zip.file('word/document.xml', rendered);
      templateBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    }

    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { delimiters: { start: '{{', end: '}}' }, linebreaks: true });
      doc.render(data);
      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      return { buffer: buf, fileName: entry.outputFileName };
    } catch (err) {
      const tagMatch = (err.message || '').match(/\{\{(\w+)\}\}/);
      throw new Error(tagMatch ? `Placeholder "{{${tagMatch[1]}}}" caused an error: ${err.message}` : `Template generation failed: ${err.message}`);
    }
  }

  generateBulk(recordType, recordsData) {
    if (!recordsData || recordsData.length === 0) return null;

    const entry = templateRegistry.get(recordType);
    if (!entry || !entry.exists) return null;

    const templateBuffer = fs.readFileSync(entry.templatePath);
    const placeholders = entry.placeholderSchema.length > 0
      ? entry.placeholderSchema : this._extractPlaceholders(templateBuffer);

    const bodyContents = [];
    for (const recordValues of recordsData) {
      let recBuffer = templateBuffer;
      // Daily Activity Plan: expand one table row per activity before rendering.
      if (recordType === 'daily-activity' && Array.isArray(recordValues.activities)) {
        const rzip = new PizZip(templateBuffer);
        const rxml = rzip.file('word/document.xml').asText();
        rzip.file('word/document.xml', this._renderActivityRows(rxml, recordValues.activities));
        recBuffer = rzip.generate({ type: 'nodebuffer', compression: 'STORE' });
      }

      const data = {};
      for (const key of placeholders) data[key] = '';
      for (const [key, value] of Object.entries(recordValues)) {
        if (value !== undefined && value !== null) {
          // Keep arrays intact so docxtemplater can render them as a loop (e.g. activities rows).
          data[key] = Array.isArray(value) ? value : String(value);
        }
      }
      try {
        const zip = new PizZip(recBuffer);
        const doc = new Docxtemplater(zip, { delimiters: { start: '{{', end: '}}' }, linebreaks: true, nullGetter: () => '' });
        doc.render(data);
        const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'STORE' });
        bodyContents.push(this._extractBody(buf));
      } catch (err) {
        const tagMatch = (err.message || '').match(/\{\{(\w+)\}\}/);
        throw new Error(tagMatch ? `Placeholder "{{${tagMatch[1]}}}" in record failed: ${err.message}` : `Template generation failed: ${err.message}`);
      }
    }

    const merged = this._mergeBodies(bodyContents);
    const final = this._buildFinalDocx(merged, templateBuffer);
    return { buffer: final, fileName: entry.outputFileName };
  }

  templateExists(recordType) { return templateRegistry.exists(recordType); }
  getSupportedTypes() { return templateRegistry.getAll().map(t => t.id); }
  validateAll() { return templateRegistry.initialize(); }

  _extractBody(docxBuffer) {
    const zip = new PizZip(docxBuffer);
    const xml = zip.file('word/document.xml').asText();
    const s = '<w:body>', e = '</w:body>';
    const si = xml.indexOf(s), ei = xml.indexOf(e);
    if (si === -1 || ei === -1) throw new Error('Could not find document body.');
    return xml.substring(si + s.length, ei);
  }

  _mergeBodies(parts) {
    const pb = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
    return parts.join(pb);
  }

  _buildFinalDocx(body, templateBuffer) {
    const zip = new PizZip(templateBuffer);
    const xml = zip.file('word/document.xml').asText();
    const s = '<w:body>', e = '</w:body>';
    const si = xml.indexOf(s), ei = xml.indexOf(e);
    if (si === -1 || ei === -1) throw new Error('Could not find document body.');
    zip.file('word/document.xml', xml.substring(0, si + s.length) + body + xml.substring(ei));
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  _extractPlaceholders(templateBuffer) {
    const zip = new PizZip(templateBuffer);
    const files = ['word/document.xml'];
    for (let i = 1; i <= 3; i++) { files.push(`word/header${i}.xml`, `word/footer${i}.xml`); }
    const keys = new Set();
    for (const f of files) {
      const file = zip.file(f);
      if (!file) continue;
      const content = file.asText();
      let m;
      while ((m = PLACEHOLDER_REGEX.exec(content)) !== null) keys.add(m[1]);
    }
    return [...keys];
  }

  // ── Daily Activity Plan: render one table row per activity ──
  // The template has a single data row containing {{activity}}, {{place}}, {{details}}.
  // We clone that row for each activity (XML-escaped) and swap it in, so each
  // activity gets its own row — no docxtemplater loop required.
  _renderActivityRows(xml, activities) {
    const escapeXml = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const rowOpen = xml.indexOf('<w:tr');
    if (rowOpen === -1) return xml;
    // Find the data row: the <w:tr> whose inner text contains {{activity}}.
    const trRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
    let m, dataRow = null, dataRowMatch = null;
    while ((m = trRegex.exec(xml)) !== null) {
      if (m[0].includes('{{activity}}')) { dataRow = m[0]; dataRowMatch = m; break; }
    }
    if (!dataRow) return xml;

    const list = Array.isArray(activities) ? activities : [];
    let rowsXml;
    if (list.length === 0) {
      // Keep one empty row so the table is never empty.
      rowsXml = dataRow.replace(/\{\{activity\}\}/g, '')
        .replace(/\{\{place\}\}/g, '')
        .replace(/\{\{details\}\}/g, '');
    } else {
      rowsXml = list.map(a =>
        dataRow
          .replace(/\{\{activity\}\}/g, escapeXml(a.activity || ''))
          .replace(/\{\{place\}\}/g, escapeXml(a.place || a.location || ''))
          .replace(/\{\{details\}\}/g, escapeXml(a.details || ''))
      ).join('');
    }

    return xml.slice(0, dataRowMatch.index) + rowsXml + xml.slice(dataRowMatch.index + dataRow.length);
  }
}

const templateManager = new TemplateManager();
module.exports = { templateManager, TemplateManager };
