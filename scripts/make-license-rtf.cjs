#!/usr/bin/env node
/**
 * Build installer/license.rtf from the Arabic legal documents.
 * RTF with Unicode escapes keeps Arabic readable in the NSIS license page.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'اتفاقية ترخيص المستخدم النهائي.txt',
  'شروط الاستخدام.txt',
  'سياسة الخصوصية.txt',
];

function rtfEscape(text) {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (char === '\\' || char === '{' || char === '}') {
      out += `\\${char}`;
    } else if (char === '\n') {
      out += '\\par\n';
    } else if (char === '\r') {
      // ignore
    } else if (code > 127) {
      const signed = code > 32767 ? code - 65536 : code;
      out += `\\u${signed}?`;
    } else {
      out += char;
    }
  }
  return out;
}

let body = '';
for (const file of FILES) {
  const full = path.join(ROOT, 'legal', file);
  const title = path.basename(file, '.txt');
  body += `\\b\\fs26 ${rtfEscape(title)}\\b0\\fs20\\par\\par\n`;
  body += `${rtfEscape(fs.readFileSync(full, 'utf8'))}\\par\\par\\par\n`;
}

const rtf =
  '{\\rtf1\\ansi\\ansicpg1256\\deff0' +
  '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}' +
  '\\viewkind4\\uc1\\pard\\rtlpar\\qr\\f0\\fs20\n' +
  body +
  '}';

const outDir = path.join(ROOT, 'installer');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'license.rtf'), rtf, 'utf8');
console.log(`Wrote installer/license.rtf (${Buffer.byteLength(rtf)} bytes)`);
