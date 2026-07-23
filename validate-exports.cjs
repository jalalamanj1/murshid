#!/usr/bin/env node
/**
 * Export Validation System
 * Run: node validate-exports.cjs
 *
 * For every registered template:
 *   1. Load sample data
 *   2. Export DOCX
 *   3. Verify no remaining placeholders
 *   4. Verify no "undefined" or "null" strings
 *   5. Verify valid ZIP/DOCX structure
 *   6. Report pass/fail
 */

const { templateRegistry } = require('./electron/template-registry.cjs');
const { exportService } = require('./electron/ExportService.cjs');
const PizZip = require('pizzip');
const fs = require('fs');

// ── Sample data generators ───────────────────────────────────────────

const SAMPLE_DATA = {
  'study-case': {
    id: 'cs-test-001',
    caseNumber: 'CS-000001',
    studentId: 'std-001',
    studentName: 'أحمد محمد',
    createdAt: '2025-07-17T10:00:00.000Z',
    updatedAt: '2025-07-17T10:00:00.000Z',
    referralSource: 'المعلم',
    caseDate: '2025-07-17',
    caseDay: 'الخميس',
    caseTypes: ['ضعف دراسي', 'مشاكل سلوكية'],
    familyCount: '5',
    siblingsCount: '3',
    birthOrder: '2',
    livesWith: 'الوالدين',
    reviews: [
      { id: 'rev-1', date: '2025-07-17', day: 'الخميس', observation: 'مبدئي: الطالب يعاني من ضعف في التركيز' }
    ],
    treatmentGoals: [
      { id: 'goal-1', goal: 'تحسين التركيز في الحصة', actions: 'تمارين تركيز يومية' },
      { id: 'goal-2', goal: 'رفع المستوى التحصيلي', actions: 'حصص تقوية أسبوعية' },
    ],
    followUps: [
      { id: 'fu-1', date: '2025-07-20', day: 'الأحد', observation: 'تحسن ملحوظ', recommendation: 'الاستمرار', progress: 'IMPROVED_MEDIUM' },
    ],
    closure: { closed: false, closedDate: '', outcome: 'RESOLVED', closingNotes: '' },
    status: 'OPEN',
    totalSessions: 1,
    lastFollowUp: '2025-07-20',
  },
};

// ── Validation runner ────────────────────────────────────────────────

const results = [];

function run() {
  const initResult = templateRegistry.initialize();
  const templates = templateRegistry.getAll();

  console.log('══════════════════════════════════════════════════');
  console.log('  Murshid AI — Export Validation Report');
  console.log('══════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const template of templates) {
    if (!template.exists) {
      console.log(`⚠ SKIP  ${template.id} (${template.displayName}) — template file missing`);
      console.log(`         Place assets/templates/${template.id}/${template.templateFile}\n`);
      skipped++;
      results.push({ id: template.id, status: 'SKIP', reason: 'Template file missing' });
      continue;
    }

    console.log(`▶ TEST  ${template.id} (${template.displayName})`);

    const record = SAMPLE_DATA[template.id];
    if (!record) {
      console.log(`  ⚠ SKIP  — no sample data defined\n`);
      skipped++;
      results.push({ id: template.id, status: 'SKIP', reason: 'No sample data' });
      continue;
    }

    try {
      // Step 1: Export
      const result = exportService.exportDocx(template.id, [record]);
      console.log(`  ✅ Export: ${result.buffer.length} bytes`);

      // Step 2: Validate ZIP structure
      let zip;
      try {
        zip = new PizZip(result.buffer);
      } catch {
        throw new Error('Invalid ZIP — not a valid DOCX package');
      }
      if (!zip.file('word/document.xml')) {
        throw new Error('Missing word/document.xml');
      }
      if (!zip.file('[Content_Types].xml')) {
        throw new Error('Missing [Content_Types].xml');
      }
      console.log(`  ✅ Valid DOCX: ${Object.keys(zip.files).filter(f => !zip.files[f].dir).length} files`);

      // Step 3: Check for unreplaced placeholders
      const xml = zip.file('word/document.xml').asText();
      const remaining = xml.match(/\{\{(\w+)\}\}/g);
      if (remaining && remaining.length > 0) {
        const unique = [...new Set(remaining)];
        throw new Error(`${unique.length} unreplaced placeholders: ${unique.join(', ')}`);
      }
      console.log(`  ✅ All ${template.placeholderSchema.length} placeholders replaced`);

      // Step 4: Check for "undefined" string in output
      if (xml.includes('undefined')) {
        // Find context around "undefined"
        const idx = xml.indexOf('undefined');
        const context = xml.substring(Math.max(0, idx - 40), idx + 50);
        throw new Error(`Literal "undefined" found in output at byte ${idx}: ...${context}...`);
      }
      console.log(`  ✅ No "undefined" strings`);

      // Step 5: Check for "null" string in output
      if (xml.includes('null')) {
        const nullRegex = /\bnull\b/g;
        const matches = xml.match(nullRegex);
        if (matches) {
          throw new Error(`Literal "null" found in output (${matches.length} occurrences)`);
        }
      }
      console.log(`  ✅ No "null" strings`);

      // Step 6: Check header* and footer* files too
      for (let i = 1; i <= 3; i++) {
        for (const prefix of ['header', 'footer']) {
          const hf = zip.file(`word/${prefix}${i}.xml`);
          if (hf) {
            const hfXml = hf.asText();
            if (hfXml.match(/\{\{(\w+)\}\}/g)) {
              throw new Error(`Unreplaced placeholder in ${prefix}${i}.xml`);
            }
          }
        }
      }
      console.log(`  ✅ Headers/footers clean`);

      console.log(`  ✅ PASS\n`);
      passed++;
      results.push({ id: template.id, status: 'PASS' });
    } catch (err) {
      console.log(`  ❌ FAIL: ${err.message}\n`);
      failed++;
      results.push({ id: template.id, status: 'FAIL', error: err.message });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Total templates: ${templates.length}`);
  console.log(`  Passed:          ${passed}`);
  console.log(`  Failed:          ${failed}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log('');

  if (failed > 0) {
    console.log('  FAILURES:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        console.log(`    ${r.id}: ${r.error}`);
      }
    }
    console.log('');
  }

  if (skipped > 0) {
    console.log('  SKIPPED (missing templates):');
    for (const r of results) {
      if (r.status === 'SKIP') {
        console.log(`    ${r.id}: ${r.reason}`);
      }
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
