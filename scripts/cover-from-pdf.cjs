#!/usr/bin/env node
/**
 * Build a multi-page cover DOCX from a PDF.
 *
 * Each PDF page is rendered to a high-resolution JPEG and placed on its own
 * page of the Word cover, behind the exact text box copied from the template
 * (same position, size, fonts and placeholders).
 *
 * Usage:
 *   node scripts/cover-from-pdf.cjs --pdf "path.pdf" --template "cover.docx" [--out "out.docx"] [--dpi 300]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const JSZip = require('jszip');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const pdfPath = path.resolve(arg('pdf'));
const templatePath = path.resolve(arg('template', path.join(path.dirname(pdfPath), 'cover.docx')));
const dpi = Number(arg('dpi', '300'));
const outPath = path.resolve(
  arg('out', path.join(path.dirname(pdfPath), `${path.basename(pdfPath, path.extname(pdfPath))}.docx`))
);

if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);
if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'murshid-cover-'));
const pagesDir = path.join(workDir, 'pages');
fs.mkdirSync(pagesDir, { recursive: true });

// ── 1. Render PDF pages with PyMuPDF (preinstalled on this machine) ──
const python = `
import pymupdf, sys, os, json
pdf = sys.argv[1]
out = sys.argv[2]
dpi = int(round(float(sys.argv[3])))
doc = pymupdf.open(pdf)
paths = []
for i in range(doc.page_count):
    pix = doc[i].get_pixmap(dpi=dpi)
    target = os.path.join(out, f"page-{i + 1:03d}.jpg")
    pix.save(target, jpg_quality=92)
    paths.append(target)
print(json.dumps({"count": doc.page_count, "paths": paths}))
`;

const rendered = spawnSync('python', ['-c', python, pdfPath, pagesDir, String(dpi)], {
  encoding: 'utf8',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
if (rendered.status !== 0) {
  throw new Error(`PDF rendering failed: ${rendered.stderr || rendered.stdout}`);
}
const info = JSON.parse(rendered.stdout.trim().split('\n').pop());

// ── 2. Read the template and extract its text-box paragraph ─────────
function extractTextBoxParagraph(xml) {
  const anchor = xml.indexOf('<w:pict');
  if (anchor < 0) throw new Error('The template has no text box (w:pict).');

  // Walk back to the paragraph that owns the drawing.
  const start = xml.lastIndexOf('<w:p ', anchor);
  if (start < 0) throw new Error('Could not locate the text-box paragraph.');

  // Nested paragraphs exist inside the text box, so track depth.
  const tag = /<w:p\b|<\/w:p>/g;
  tag.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tag.exec(xml))) {
    if (match[0] === '</w:p>') {
      depth -= 1;
      if (depth === 0) return xml.slice(start, match.index + match[0].length);
    } else {
      depth += 1;
    }
  }
  throw new Error('Unclosed text-box paragraph in the template.');
}

function pageSize(xml) {
  const size = xml.match(/<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/);
  if (!size) return { width: 11906, height: 16838 };
  return { width: Number(size[1]), height: Number(size[2]) };
}

function addPageBreakBefore(paragraph) {
  const opening = paragraph.match(/^<w:p\b[^>]*>/);
  if (!opening) return paragraph;
  const head = opening[0];
  const rest = paragraph.slice(head.length);
  const pPr = rest.match(/^<w:pPr>([\s\S]*?)<\/w:pPr>/);
  if (pPr) {
    if (pPr[1].includes('<w:pageBreakBefore')) return paragraph;
    return `${head}<w:pPr><w:pageBreakBefore/>${pPr[1]}</w:pPr>${rest.slice(pPr[0].length)}`;
  }
  return `${head}<w:pPr><w:pageBreakBefore/></w:pPr>${rest}`;
}

/** Duplicated text boxes need unique VML/Word ids or Word refuses the file. */
function uniquifyOverlay(paragraph, pageIndex) {
  return paragraph
    .replace(/\s+w14:(?:paraId|textId|anchorId)="[^"]*"/g, '')
    .replace(/id="Text Box 12"/g, `id="Text Box ${pageIndex}"`)
    .replace(/o:spid="_x0000_s1026"/g, `o:spid="_x0000_s${1026 + pageIndex}"`)
    .replace(/<v:shapetype id="_x0000_t202"/g, `<v:shapetype id="_x0000_t202_${pageIndex}"`)
    .replace(/type="#_x0000_t202"/g, `type="#_x0000_t202_${pageIndex}"`);
}

function imageDrawing(relId, index, extent) {
  return (
    `<w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="1" relativeHeight="2" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1" wp14:anchorId="${(0x10000000 + index).toString(16).toUpperCase()}" wp14:editId="${(0x20000000 + index).toString(16).toUpperCase()}">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${extent.cx}" cy="${extent.cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${100 + index}" name="Page ${index}"/>` +
    `<wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${100 + index}" name="page-${index}.jpg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${extent.cx}" cy="${extent.cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:anchor></w:drawing>`
  );
}

/** Inner content of the template paragraph (its run with the text box). */
function paragraphInner(paragraph) {
  const opening = paragraph.match(/^<w:p\b[^>]*>/);
  if (!opening) return paragraph;
  return paragraph.slice(opening[0].length, paragraph.lastIndexOf('</w:p>'));
}

/** Remove an inner <w:pPr> that belongs to the template paragraph. */
function stripOuterParagraphProperties(inner) {
  return inner.replace(/^<w:pPr>[\s\S]*?<\/w:pPr>/, '');
}

(async () => {
  const templateZip = await JSZip.loadAsync(fs.readFileSync(templatePath));
  const documentXml = await templateZip.file('word/document.xml').async('string');

  const overlay = extractTextBoxParagraph(documentXml);
  const { width, height } = pageSize(documentXml);
  const extent = { cx: width * 635, cy: height * 635 };

  const bodyStart = documentXml.indexOf('<w:body>') + '<w:body>'.length;
  const sectStart = documentXml.indexOf('<w:sectPr', bodyStart);
  if (sectStart < 0) throw new Error('The template has no section properties.');
  const sectPr = documentXml.slice(sectStart, documentXml.indexOf('</w:body>'));
  const prefix = documentXml.slice(0, bodyStart);
  const suffix = documentXml.slice(documentXml.indexOf('</w:body>'));

  const contentTypesXml = await templateZip.file('[Content_Types].xml').async('string');
  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = await templateZip.file(relsPath).async('string');

  const mediaFiles = fs.readdirSync(pagesDir).filter((name) => name.endsWith('.jpg')).sort();
  let body = '';

  mediaFiles.forEach((fileName, index) => {
    const relId = `rIdCover${index + 1}`;
    const inner = stripOuterParagraphProperties(paragraphInner(overlay));
    const pageInner = index === 0 ? inner : uniquifyOverlay(inner, index + 1);
    const pageBreak = index === 0 ? '' : '<w:pPr><w:pageBreakBefore/></w:pPr>';
    body += `<w:p>${pageBreak}<w:r><w:rPr><w:noProof/></w:rPr>${imageDrawing(
      relId,
      index + 1,
      extent
    )}</w:r>${pageInner}</w:p>`;

    const mediaName = `cover-page-${index + 1}.jpg`;
    templateZip.file(`word/media/${mediaName}`, fs.readFileSync(path.join(pagesDir, fileName)));
    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
    );
  });

  let contentTypes = contentTypesXml;
  if (!/Extension="jpg"/i.test(contentTypes)) {
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Default Extension="jpg" ContentType="image/jpeg"/></Types>'
    );
  }

  templateZip.file('word/document.xml', `${prefix}${body}${sectPr}${suffix}`);
  templateZip.file('[Content_Types].xml', contentTypes);
  templateZip.file(relsPath, relsXml);

  const output = await templateZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, output);

  // First page preview image used by the app's covers tab.
  const previewDir = path.join(path.dirname(outPath), 'previews');
  fs.mkdirSync(previewDir, { recursive: true });
  const previewPath = path.join(previewDir, `${path.basename(outPath, '.docx')}.jpg`);
  fs.copyFileSync(path.join(pagesDir, mediaFiles[0]), previewPath);

  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        pages: info.count,
        dpi,
        docx: outPath,
        preview: previewPath,
        sizeMB: Number((fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)),
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
