/**
 * Fill {{placeholders}} inside a DOCX while preserving formatting.
 *
 * Word often splits a placeholder across several runs, and text boxes add
 * another layer. Instead of re-rendering the document, each paragraph's text
 * runs are scanned as one string; the placeholder span is replaced inside the
 * run where it starts, so the value inherits that run's font, size and the
 * text box's existing position. Everything else in the XML is untouched.
 */

const PizZip = require('pizzip');

const KEYS = {
  school_name: /school\s*_?\s*name/i,
  academic_year: /academic\s*_?\s*year/i,
  counselor_name: /counselor\s*_?\s*name/i,
  title: /title/i,
};

const PLACEHOLDER_PATTERN =
  /\{\s*\{?\s*(school\s*_?\s*name|academic\s*_?\s*year|counselor\s*_?\s*name|title)\s*\}?\s*\}/gi;

function decodeXml(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function encodeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function valueFor(matchedKey, values) {
  for (const [key, pattern] of Object.entries(KEYS)) {
    if (pattern.test(matchedKey)) return values[key] == null ? '' : String(values[key]);
  }
  return '';
}

/**
 * Replace placeholders inside every paragraph of the document.
 * Paragraph boundaries are respected; placeholders never span paragraphs.
 */
function fillParagraph(xml, values) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const runs = [];
    const runRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = runRegex.exec(paragraph)) !== null) {
      runs.push({
        start: match.index,
        end: match.index + match[0].length,
        textStart: match.index + match[0].indexOf('>') + 1,
        textEnd: match.index + match[0].length - '</w:t>'.length,
        text: decodeXml(match[1]),
      });
    }
    if (runs.length === 0) return paragraph;

    let cursor = 0;
    const offsets = runs.map((run) => {
      const start = cursor;
      cursor += run.text.length;
      return { start, end: cursor };
    });
    const combined = runs.map((run) => run.text).join('');

    const replacements = [];
    PLACEHOLDER_PATTERN.lastIndex = 0;
    let placeholder;
    while ((placeholder = PLACEHOLDER_PATTERN.exec(combined)) !== null) {
      replacements.push({
        start: placeholder.index,
        end: placeholder.index + placeholder[0].length,
        value: valueFor(placeholder[1], values),
      });
    }
    if (replacements.length === 0) return paragraph;

    // Apply from the end so earlier offsets stay valid.
    for (let r = replacements.length - 1; r >= 0; r -= 1) {
      const { start, end, value } = replacements[r];
      const startRunIndex = offsets.findIndex((o) => start >= o.start && start < o.end);
      const lastRunIndex = offsets.findIndex((o) => end > o.start && end <= o.end);
      if (startRunIndex === -1) continue;
      const endRun = lastRunIndex === -1 ? startRunIndex : lastRunIndex;

      const startRun = runs[startRunIndex];
      const before = startRun.text.slice(0, start - offsets[startRunIndex].start);
      if (startRunIndex === endRun) {
        const after = startRun.text.slice(end - offsets[startRunIndex].start);
        startRun.text = before + value + after;
      } else {
        startRun.text = before + value;
        for (let i = startRunIndex + 1; i <= endRun; i += 1) {
          const entry = runs[i];
          if (!entry) continue;
          if (i === endRun) {
            entry.text = entry.text.slice(Math.max(0, end - offsets[i].start));
          } else {
            entry.text = '';
          }
        }
      }

      // Recompute offsets after the change to keep subsequent matches valid.
      let position = 0;
      runs.forEach((run, index) => {
        offsets[index] = { start: position, end: position + run.text.length };
        position += run.text.length;
      });
    }

    // Write the texts back into the same <w:t> elements, in place.
    let rebuilt = '';
    let textCursor = 0;
    runs.forEach((run) => {
      rebuilt += paragraph.slice(textCursor, run.textStart);
      rebuilt += encodeXml(run.text);
      textCursor = run.textEnd;
    });
    rebuilt += paragraph.slice(textCursor);
    return rebuilt;
  });
}

function normalizeDocumentXml(xml) {
  // Cosmetic spell-check markers can split words and placeholders.
  return String(xml).replace(/<w:proofErr[^>]*\/>/g, '');
}

function fillDocxBuffer(buffer, values) {
  const zip = new PizZip(buffer);
  const parts = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name)
  );
  if (!parts.includes('word/document.xml')) {
    throw new Error('الملف ليس مستند Word صالح.');
  }
  for (const name of parts) {
    const xml = normalizeDocumentXml(zip.file(name).asText());
    zip.file(name, fillParagraph(xml, values || {}));
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Inspect placeholders (including those inside text boxes) for diagnostics. */
function listPlaceholders(buffer) {
  const zip = new PizZip(buffer);
  const xml = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name))
    .map((name) => zip.file(name).asText())
    .join('\n');
  const text = (xml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map((part) => decodeXml(part.replace(/<[^>]+>/g, '')))
    .join('');
  const found = new Set();
  PLACEHOLDER_PATTERN.lastIndex = 0;
  let match;
  while ((match = PLACEHOLDER_PATTERN.exec(text)) !== null) found.add(match[1].trim());
  return { placeholders: [...found], textBoxes: (xml.match(/<w:txbxContent>/g) || []).length };
}

module.exports = { fillDocxBuffer, listPlaceholders, normalizeDocumentXml };
