/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ParentLossRecordPdfExport — Generates A4 Portrait PDF for Parent Loss Records.
 * Ministry-style layout. Auto-expands long fields across pages.
 */

import jsPDF from 'jspdf';
import { ParentLossRecord, Student } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function exportParentLossRecordPdf(record: ParentLossRecord, _students: Student[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297, margin = 15, contentW = pageW - 2 * margin, centerX = pageW / 2;

  doc.setFont('helvetica', 'bold');
  let y = margin;

  // Header
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 2;

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('PARENT LOSS RECORD', centerX, y + 6, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Record No: ${record.recordNumber}`, centerX, y + 4, { align: 'center' });
  y += 7;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Helpers
  const drawSection = (label: string, value: string, startY: number): number => {
    if (!value || !value.trim()) return startY;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
    doc.text(label, pageW - margin, startY, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(value, contentW - 10);
    const lineHeight = 4.5, blockHeight = lines.length * lineHeight + 4;
    if (startY + blockHeight > pageH - margin - 10) {
      doc.addPage(); startY = margin + 5;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text(`${record.recordNumber} - Parent Loss (continued)`, centerX, startY, { align: 'center' });
      startY += 8; doc.setLineWidth(0.3); doc.line(margin, startY, pageW - margin, startY); startY += 5;
    }
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, startY - 3, contentW, blockHeight, 2, 2, 'FD');
    let textY = startY + 1;
    for (const line of lines) { doc.text(line, pageW - margin - 5, textY, { align: 'right' }); textY += lineHeight; }
    return startY + blockHeight + 3;
  };

  const drawRow = (l1: string, v1: string, l2: string, v2: string, startY: number): number => {
    const halfW = (contentW - 5) / 2;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
    doc.text(l1, margin + halfW, startY, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text(v1 || '—', margin + halfW, startY + 5, { align: 'right' });
    doc.setDrawColor(226, 232, 240); doc.roundedRect(margin, startY - 3, halfW, 12, 2, 2, 'D');

    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
    doc.text(l2, pageW - margin, startY, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text(v2 || '—', pageW - margin - 5, startY + 5, { align: 'right' });
    doc.roundedRect(margin + halfW + 5, startY - 3, halfW, 12, 2, 2, 'D');
    return startY + 14;
  };

  // Student Info
  y = drawRow('Student Name', record.studentName, 'Grade', record.grade, y);
  y = drawRow('Section', record.section, 'Loss Type', record.lossType === 'أخرى' ? record.lossTypeOther : record.lossType, y);
  y = drawRow('Lives With', record.livesWith === 'أخرى' ? record.livesWithOther : record.livesWith, 'Guardian Name', record.guardianName, y);
  y = drawRow('Guardian Phone', record.guardianPhoneField, '', '', y);
  y = drawRow('Academic Level Before', record.academicLevelBeforeLoss, 'Academic Level After', record.academicLevelAfterLoss, y);
  y += 3;

  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y); y += 5;

  // Text Sections
  y = drawSection('Address', record.address, y);
  y = drawSection('Student Behavior & Attendance', record.studentBehavior, y);
  y = drawSection('Additional Notes', record.additionalNotes, y);

  // Footer
  if (y > pageH - 30) { doc.addPage(); y = margin + 10; }
  y = Math.max(y + 5, pageH - 25);
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y); y += 5;
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
  doc.text(`Created: ${fmtDate(record.createdAt)}`, margin, y);
  doc.text(`Updated: ${fmtDate(record.updatedAt)}`, pageW - margin, y, { align: 'right' });
  doc.text('Murshid - School Counselor System', centerX, y, { align: 'center' });

  doc.save(`${record.recordNumber}_${record.studentName}.pdf`);
}
