import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const importRouter = Router();

// Templates for supported import types
const TEMPLATES: Record<string, { headers: string[]; sampleRows: any[] }> = {
  SALARY_CONFIG: {
    headers: ['employeeCode', 'basicPay', 'payLevelNumber', 'effectiveFrom', 'cityCategory'],
    sampleRows: [
      { employeeCode: 'EMP-1001', basicPay: 131400, payLevelNumber: 13, effectiveFrom: '2026-04-01', cityCategory: 'X' },
      { employeeCode: 'EMP-1002', basicPay: 79800, payLevelNumber: 12, effectiveFrom: '2026-04-01', cityCategory: 'X' }
    ]
  },
  RECURRING_DATA: {
    headers: ['employeeCode', 'salaryHeadCode', 'amount', 'effectiveFrom'],
    sampleRows: [
      { employeeCode: 'EMP-1001', salaryHeadCode: 'SPECIAL_PAY', amount: 5000, effectiveFrom: '2026-04-01' }
    ]
  },
  ONE_TIME_DATA: {
    headers: ['employeeCode', 'paymentTypeCode', 'amount', 'remarks'],
    sampleRows: [
      { employeeCode: 'EMP-1001', paymentTypeCode: 'HONORARIUM', amount: 15000, remarks: 'Ph.D. viva examination' }
    ]
  },
  CITY_CATEGORIES: {
    headers: ['employeeCode', 'cityCategory'],
    sampleRows: [
      { employeeCode: 'EMP-1001', cityCategory: 'X' },
      { employeeCode: 'EMP-1002', cityCategory: 'Y' }
    ]
  }
};

// Download / Get Template
importRouter.get('/template/:type', authenticate, (req: Request, res: Response, next: NextFunction): void => {
  try {
    const type = String(req.params.type).toUpperCase();
    const template = TEMPLATES[type];
    if (!template) {
      throw new AppError(`Unknown import type: ${type}. Supported: ${Object.keys(TEMPLATES).join(', ')}`, 400);
    }
    res.status(200).json({ importType: type, template });
  } catch (error) {
    next(error);
  }
});

// Dry-Run Validate Upload
importRouter.post('/validate', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      importType: z.enum(['SALARY_CONFIG', 'RECURRING_DATA', 'ONE_TIME_DATA', 'CITY_CATEGORIES', 'ARREARS', 'PAY_MATRIX', 'PF_GPF', 'RUNNING_ADVANCES']),
      fileName: z.string().min(1),
      rows: z.array(z.record(z.any())).min(1, 'File cannot be empty')
    });
    const { importType, fileName, rows } = schema.parse(req.body);

    const validRows: any[] = [];
    const rowErrors: Array<{ rowNumber: number; fieldName?: string; errorReason: string; rawData: any }> = [];

    // Pre-fetch all institution employee codes
    const existingEmployees = await prisma.employee.findMany({
      where: { institutionId: req.user!.institutionId },
      select: { id: true, employeeCode: true, active: true }
    });
    const empMap = new Map(existingEmployees.map(e => [e.employeeCode, e]));

    // Validate rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.employeeCode) {
        rowErrors.push({ rowNumber: rowNum, fieldName: 'employeeCode', errorReason: 'Missing employeeCode', rawData: row });
        continue;
      }

      const emp = empMap.get(String(row.employeeCode).trim());
      if (!emp) {
        rowErrors.push({ rowNumber: rowNum, fieldName: 'employeeCode', errorReason: `Employee code '${row.employeeCode}' does not exist`, rawData: row });
        continue;
      }
      if (!emp.active) {
        rowErrors.push({ rowNumber: rowNum, fieldName: 'employeeCode', errorReason: `Employee '${row.employeeCode}' is inactive`, rawData: row });
        continue;
      }

      if (importType === 'SALARY_CONFIG') {
        const basic = Number(row.basicPay);
        if (isNaN(basic) || basic <= 0) {
          rowErrors.push({ rowNumber: rowNum, fieldName: 'basicPay', errorReason: 'basicPay must be a positive number', rawData: row });
          continue;
        }
      }

      validRows.push({ ...row, internalEmployeeId: emp.id });
    }

    // Create ImportJob record
    const job = await prisma.importJob.create({
      data: {
        institutionId: req.user!.institutionId,
        uploadedBy: req.user!.fullName,
        importType: importType as any,
        fileName,
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: rowErrors.length,
        status: rowErrors.length === 0 ? 'VALIDATED' : (validRows.length > 0 ? 'VALIDATED' : 'FAILED'),
        rowErrors: {
          create: rowErrors.map(e => ({
            rowNumber: e.rowNumber,
            fieldName: e.fieldName,
            errorReason: e.errorReason,
            rawData: e.rawData
          }))
        }
      },
      include: { rowErrors: true }
    });

    res.status(200).json({
      jobId: job.id,
      importType,
      fileName,
      totalRows: rows.length,
      validRowsCount: validRows.length,
      errorRowsCount: rowErrors.length,
      errors: rowErrors,
      sampleValid: validRows.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
});

// Commit Validated Import Job
importRouter.post('/commit', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      jobId: z.string().min(1),
      rows: z.array(z.record(z.any())).min(1)
    });
    const { jobId, rows } = schema.parse(req.body);

    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError('Import job not found', 404);

    let processedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (!row.employeeCode) continue;
        const emp = await tx.employee.findUnique({
          where: {
            institutionId_employeeCode: {
              institutionId: req.user!.institutionId,
              employeeCode: String(row.employeeCode).trim()
            }
          }
        });
        if (!emp) continue;

        if (job.importType === 'SALARY_CONFIG') {
          await tx.employeeSalaryAssignment.updateMany({
            where: { employeeId: emp.id, active: true },
            data: { basicPay: Number(row.basicPay) }
          });
          processedCount++;
        } else if (job.importType === 'CITY_CATEGORIES') {
          await tx.employee.update({
            where: { id: emp.id },
            data: { cityCategory: row.cityCategory }
          });
          processedCount++;
        }
      }

      await tx.importJob.update({
        where: { id: job.id },
        data: { status: 'COMMITTED' }
      });
    });

    await recordAudit(req, 'COMMIT_IMPORT', 'ImportJob', job.id, {
      importType: job.importType,
      processed: processedCount
    });

    res.status(200).json({
      message: `Successfully committed ${processedCount} records`,
      processedCount
    });
  } catch (error) {
    next(error);
  }
});
