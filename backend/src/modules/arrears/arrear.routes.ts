import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const arrearRouter = Router();

// List Arrear Batches
arrearRouter.get('/batches', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batches = await prisma.arrearBatch.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        records: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ arrearBatches: batches });
  } catch (error) {
    next(error);
  }
});

// Create & Generate Arrear Batch
arrearRouter.post('/batches', authenticate, requireRole(['payroll_admin', 'payroll_pda']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      reason: z.string().min(1),
      records: z.array(z.object({
        employeeId: z.string().min(1),
        periodName: z.string().min(1),
        oldBasic: z.number().positive(),
        newBasic: z.number().positive(),
        daPercentage: z.number().default(50.0),
        hraPercentage: z.number().default(27.0),
        remarks: z.string().optional()
      })).min(1, 'At least one employee arrear record required')
    });
    const data = schema.parse(req.body);

    let batchTotal = new Decimal(0);

    const calculatedRecords = data.records.map(r => {
      const oldB = new Decimal(r.oldBasic);
      const newB = new Decimal(r.newBasic);
      const basicDiff = newB.minus(oldB);

      const daDiff = basicDiff.times(r.daPercentage / 100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const hraDiff = basicDiff.times(r.hraPercentage / 100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const totalArrear = basicDiff.plus(daDiff).plus(hraDiff);

      batchTotal = batchTotal.plus(totalArrear);

      return {
        employeeId: r.employeeId,
        periodName: r.periodName,
        oldBasic: Number(oldB.toFixed(2)),
        newBasic: Number(newB.toFixed(2)),
        basicDiff: Number(basicDiff.toFixed(2)),
        daDiff: Number(daDiff.toFixed(2)),
        hraDiff: Number(hraDiff.toFixed(2)),
        taDiff: 0,
        totalArrear: Number(totalArrear.toFixed(2)),
        remarks: r.remarks
      };
    });

    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.arrearBatch.create({
        data: {
          institutionId: req.user!.institutionId,
          name: data.name,
          reason: data.reason,
          status: 'GENERATED',
          totalAmount: Number(batchTotal.toFixed(2)),
          records: {
            create: calculatedRecords
          }
        },
        include: { records: true }
      });
      return b;
    });

    await recordAudit(req, 'CREATE_ARREAR_BATCH', 'ArrearBatch', batch.id, {
      name: data.name,
      total: Number(batchTotal.toFixed(2))
    });

    res.status(201).json({ arrearBatch: batch });
  } catch (error) {
    next(error);
  }
});

// Approve Arrear Batch
arrearRouter.post('/batches/:id/approve', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batch = await prisma.arrearBatch.findUnique({ where: { id: String(req.params.id) } });
    if (!batch) throw new AppError('Batch not found', 404);

    const updated = await prisma.arrearBatch.update({
      where: { id: batch.id },
      data: { status: 'APPROVED' }
    });

    await recordAudit(req, 'APPROVE_ARREAR_BATCH', 'ArrearBatch', batch.id);
    res.status(200).json({ message: 'Arrear batch approved', arrearBatch: updated });
  } catch (error) {
    next(error);
  }
});
