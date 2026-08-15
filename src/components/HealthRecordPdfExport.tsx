/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HealthRecordPdfExport — Generates A4 Portrait PDF for Health Records.
 * Ministry-style layout. Auto-expands long fields across pages.
 */

import jsPDF from 'jspdf';
import { HealthRecord, Student } from '../types';
import { toArabicDigits } from '../lib/format';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return toArabicDigits(new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }));
}

export function exportHealthRecordPdf(record: HealthRecord, _students: Student[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - 2 * margin;
  const centerX = pageW / 2;

  doc.setFont('helvetica', 'bold');

  // ── Header ────────────────────────────────────────────────────
  let y = margin;

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 2;

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('HEALTH STATUS RECORD', centerX, y + 6, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Record No: ${record.recordNumber}`, centerX, y + 4, { align: 'center' });
  y += 7;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ── Helpers ───────────────────────────────────────────────────
  const drawSection = (label: string, value: string, startY: number): number => {
    if (!value || !value.trim()) return startY;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label, pageW - margin, startY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const lines = doc.splitTextToSize(value, contentW - 10);
    const lineHeight = 4.5;
    const blockHeight = lines.length * lineHeight + 4;

    if (startY + blockHeight > pageH - margin - 10) {
      doc.addPage();
      startY = margin + 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`${record.recordNumber} - Health Record (continued)`, centerX, startY, { align: 'center' });
      startY += 8;
      doc.setLineWidth(0.3);
      doc.line(margin, startY, pageW - margin, startY);
      startY += 5;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, startY - 3, contentW, blockHeight, 2, 2, 'FD');

    let textY = startY + 1;
    for (const line of lines) {
      doc.text(line, pageW - margin - 5, textY, { align: 'right' });
      textY += lineHeight;
    }

    return startY + blockHeight + 3;
  };

  const drawRow = (label1: string, value1: string, label2: string, value2: string, startY: number): number => {
    const halfW = (contentW - 5) / 2;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label1, margin + halfW, startY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(value1 || '—', margin + halfW, startY + 5, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, startY - 3, halfW, 12, 2, 2, 'D');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label2, pageW - margin, startY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(value2 || '—', pageW - margin - 5, startY + 5, { align: 'right' });
    doc.roundedRect(margin + halfW + 5, startY - 3, halfW, 12, 2, 2, 'D');

    return startY + 14;
  };

  // ── Student Info ──────────────────────────────────────────────
  y = drawRow('Student Name', record.studentName, 'Grade', record.grade, y);
  y = drawRow('Section', record.section, 'Guardian Phone', record.guardianPhone, y);
  y = drawRow('Disease Type', record.diseaseType === 'أخرى' ? record.diseaseTypeOther : record.diseaseType, '', '', y);
  y += 3;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ── Text Sections ─────────────────────────────────────────────
  y = drawSection('Address', record.address, y);
  y = drawSection('Disease Description & Impact on Student', record.diseaseDescription, y);
  y = drawSection('Procedures Taken', record.procedures, y);

  // ── Footer ────────────────────────────────────────────────────
  if (y > pageH - 30) {
    doc.addPage();
    y = margin + 10;
  }

  y = Math.max(y + 5, pageH - 25);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Created: ${fmtDate(record.createdAt)}`, margin, y);
  doc.text(`Updated: ${fmtDate(record.updatedAt)}`, pageW - margin, y, { align: 'right' });
  doc.text('Murshid - School Counselor System', centerX, y, { align: 'center' });

  doc.save(`${record.recordNumber}_${record.studentName}.pdf`);
}
