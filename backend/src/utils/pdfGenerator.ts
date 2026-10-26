import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface PayslipPdfData {
  companyName: string;
  companyAddress?: string;
  periodName: string;
  runNumber?: string;
  employeeCode: string;
  employeeName: string;
  designation?: string;
  department?: string;
  branch?: string;
  dateOfJoining?: string;
  panNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  pfUan?: string;
  esiNumber?: string;
  calendarDays?: number;
  paidDays?: number;
  unpaidDays?: number;
  pfWageBasis?: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerCost?: number;
  employerPf?: number;
  employerEsi?: number;
  items: Array<{
    name: string;
    type: string;
    amount: number;
  }>;
}

export function generatePayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', err => reject(err));

    // Header / Brand
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(data.companyName.toUpperCase(), { align: 'center' });
    
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(data.companyAddress || 'Corporate Headquarters • Financial District, Bandra-Kurla Complex, Mumbai', { align: 'center' })
      .moveDown(0.2);

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#2563eb')
      .text(`PAYSLIP FOR THE MONTH OF ${data.periodName.toUpperCase()}`, { align: 'center' })
      .moveDown(0.8);

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke()
      .moveDown(0.5);

    // Employee & Attendance Info Grid (2 columns)
    const startY = doc.y;
    const col1X = 40;
    const col2X = 300;
    let currY = startY;

    doc.fontSize(8.5).fillColor('#334155');

    // Left Column: Employee Details
    doc.font('Helvetica-Bold').text('Employee Code: ', col1X, currY, { continued: true })
       .font('Helvetica').text(data.employeeCode);
    doc.font('Helvetica-Bold').text('Employee Name: ', col1X, currY + 14, { continued: true })
       .font('Helvetica').text(data.employeeName);
    doc.font('Helvetica-Bold').text('Designation: ', col1X, currY + 28, { continued: true })
       .font('Helvetica').text(data.designation || 'Staff Specialist');
    doc.font('Helvetica-Bold').text('Department: ', col1X, currY + 42, { continued: true })
       .font('Helvetica').text(data.department || 'Corporate');
    doc.font('Helvetica-Bold').text('Branch Location: ', col1X, currY + 56, { continued: true })
       .font('Helvetica').text(data.branch || 'HQ');
    doc.font('Helvetica-Bold').text('Bank Account: ', col1X, currY + 70, { continued: true })
       .font('Helvetica').text(`${data.bankName || 'HDFC Bank'} •••• ${data.bankAccountNumber ? data.bankAccountNumber.slice(-4) : '7890'}`);

    // Right Column: Attendance & Statutory Identifiers
    doc.font('Helvetica-Bold').text('Calendar Days: ', col2X, currY, { continued: true })
       .font('Helvetica').text(String(data.calendarDays || 30));
    doc.font('Helvetica-Bold').text('Paid Days: ', col2X, currY + 14, { continued: true })
       .font('Helvetica').text(`${data.paidDays ?? 30} days`);
    doc.font('Helvetica-Bold').text('Loss of Pay (LOP): ', col2X, currY + 28, { continued: true })
       .font('Helvetica').text(`${data.unpaidDays ?? 0} days`);
    doc.font('Helvetica-Bold').text('PF Wage Basis: ', col2X, currY + 42, { continued: true })
       .font('Helvetica').text(`₹${(data.pfWageBasis || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    doc.font('Helvetica-Bold').text('PF UAN: ', col2X, currY + 56, { continued: true })
       .font('Helvetica').text(data.pfUan || 'Not Applicable');
    doc.font('Helvetica-Bold').text('Income Tax PAN: ', col2X, currY + 70, { continued: true })
       .font('Helvetica').text(data.panNumber || 'ABCDE1234F');

    doc.y = currY + 95;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke()
      .moveDown(0.6);

    // Earnings & Deductions Tables Side-by-Side
    const tableTop = doc.y;
    const halfWidth = 250;
    const colEarningsX = 40;
    const colDeductionsX = 305;

    // Headers
    doc.rect(colEarningsX, tableTop, halfWidth, 18).fill('#f1f5f9');
    doc.rect(colDeductionsX, tableTop, halfWidth, 18).fill('#f1f5f9');

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    doc.text('EARNINGS', colEarningsX + 8, tableTop + 5);
    doc.text('AMOUNT (₹)', colEarningsX + halfWidth - 75, tableTop + 5, { width: 65, align: 'right' });

    doc.text('DEDUCTIONS', colDeductionsX + 8, tableTop + 5);
    doc.text('AMOUNT (₹)', colDeductionsX + halfWidth - 75, tableTop + 5, { width: 65, align: 'right' });

    // Rows
    const earnings = data.items.filter(i => i.type === 'EARNING');
    const deductions = data.items.filter(i => i.type === 'DEDUCTION');
    const maxRows = Math.max(earnings.length, deductions.length, 5);

    let rowY = tableTop + 24;
    doc.font('Helvetica').fontSize(8).fillColor('#334155');

    for (let i = 0; i < maxRows; i++) {
      const earn = earnings[i];
      const ded = deductions[i];

      if (earn) {
        doc.text(earn.name, colEarningsX + 8, rowY);
        doc.text(earn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colEarningsX + halfWidth - 75, rowY, { width: 65, align: 'right' });
      }
      if (ded) {
        doc.text(ded.name, colDeductionsX + 8, rowY);
        doc.text(ded.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colDeductionsX + halfWidth - 75, rowY, { width: 65, align: 'right' });
      }
      rowY += 16;
    }

    // Totals Bar
    doc.rect(colEarningsX, rowY, halfWidth, 20).fill('#f8fafc');
    doc.rect(colDeductionsX, rowY, halfWidth, 20).fill('#f8fafc');

    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
    doc.text('GROSS EARNINGS', colEarningsX + 8, rowY + 5);
    doc.text(`₹${data.grossPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colEarningsX + halfWidth - 85, rowY + 5, { width: 75, align: 'right' });

    doc.text('TOTAL DEDUCTIONS', colDeductionsX + 8, rowY + 5);
    doc.text(`₹${data.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colDeductionsX + halfWidth - 85, rowY + 5, { width: 75, align: 'right' });

    // Net Pay Callout Banner
    rowY += 32;
    doc.rect(40, rowY, 515, 38).fillAndStroke('#eff6ff', '#bfdbfe');
    doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(10);
    doc.text('NET SALARY PAYABLE:', 55, rowY + 8);
    doc.fontSize(14).text(`₹${data.netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 55, rowY + 20);

    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text('Disbursed via Electronic Bank Transfer (NEFT/RTGS)', 250, rowY + 14, { align: 'right' });

    // Employer Contribution & Note Footer
    rowY += 55;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
    doc.text('EMPLOYER CONTRIBUTIONS (NOT DEDUCTED FROM TAKE-HOME):', 40, rowY);
    const empPf = (data.employerPf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const empEsi = (data.employerEsi || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const empCost = (data.employerCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.font('Helvetica').text(
      `Employer PF (12%): ₹${empPf}    |    Employer ESIC (3.25%): ₹${empEsi}    |    Total CTC Cost: ₹${empCost}`,
      40,
      rowY + 12
    );

    // Disclaimer
    rowY += 40;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(40, rowY)
      .lineTo(555, rowY)
      .stroke();

    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
    doc.text(
      'This document is an authorized computer-generated payslip under Apex Global Corporate HRMS and requires no physical signature.',
      40,
      rowY + 8,
      { align: 'center' }
    );

    doc.end();
  });
}
