import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const incrementRouter = Router();

// List Increment Batches
incrementRouter.get('/batches', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batches = await prisma.incrementBatch.findMany({
      where: { institutionId: req.user!.institutionId },
      include: {
        financialYear: true,
        increments: {
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true }
            },
            currentCell: true,
            nextCell: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ incrementBatches: batches });
  } catch (error) {
    next(error);
  }
});

// Preview Increment for Financial Year (find next cell in 7th CPC matrix)
incrementRouter.post('/batches/preview', authenticate, requireRole(['payroll_admin', 'payroll_pda']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      financialYearId: z.string().min(1),
      effectiveDate: z.string()
    });
    const { financialYearId, effectiveDate } = schema.parse(req.body);

    const employees = await prisma.employee.findMany({
      where: { institutionId: req.user!.institutionId, active: true },
      include: {
        designation: true,
        department: true,
        salaryAssignments: {
          where: { active: true },
          include: {
            payLevel: {
              include: { matrixCells: { orderBy: { indexNumber: 'asc' } } }
            },
            payMatrixCell: true
          },
          take: 1
        }
      }
    });

    const previewList: any[] = [];
    for (const emp of employees) {
      const assignment = emp.salaryAssignments[0];
      if (!assignment || !assignment.payLevel || !assignment.payMatrixCell) continue;

      const cells = assignment.payLevel.matrixCells;
      const currentIndex = assignment.payMatrixCell.indexNumber;
      const nextCell = cells.find(c => c.indexNumber === currentIndex + 1);

      if (nextCell) {
        previewList.push({
          employee: {
            id: emp.id,
            code: emp.employeeCode,
            name: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation.name,
            department: emp.department.name
          },
          payLevel: assignment.payLevel.name,
          currentCell: { id: assignment.payMatrixCell.id, index: currentIndex, basic: Number(assignment.payMatrixCell.basicAmount) },
          nextCell: { id: nextCell.id, index: nextCell.indexNumber, basic: Number(nextCell.basicAmount) },
          incrementAmount: Number(nextCell.basicAmount) - Number(assignment.payMatrixCell.basicAmount),
          effectiveDate
        });
      }
    }

    res.status(200).json({ eligibleEmployees: previewList });
  } catch (error) {
    next(error);
  }
});

// Generate and Create Increment Batch
incrementRouter.post('/batches', authenticate, requireRole(['payroll_admin', 'payroll_pda']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      financialYearId: z.string().min(1),
      effectiveDate: z.string(),
      increments: z.array(z.object({
        employeeId: z.string().min(1),
        currentCellId: z.string().min(1),
        currentBasic: z.number().positive(),
        nextCellId: z.string().min(1),
        nextBasic: z.number().positive()
      })).min(1, 'At least one increment required')
    });
    const data = schema.parse(req.body);

    const effDate = new Date(data.effectiveDate);
    const nextIncDate = new Date(effDate);
    nextIncDate.setFullYear(nextIncDate.getFullYear() + 1);

    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.incrementBatch.create({
        data: {
          institutionId: req.user!.institutionId,
          financialYearId: data.financialYearId,
          name: data.name,
          effectiveDate: effDate,
          status: 'GENERATED',
          totalEmployees: data.increments.length,
          increments: {
            create: data.increments.map(inc => ({
              employeeId: inc.employeeId,
              currentCellId: inc.currentCellId,
              currentBasic: inc.currentBasic,
              nextCellId: inc.nextCellId,
              nextBasic: inc.nextBasic,
              effectiveDate: effDate,
              nextIncrementDate: nextIncDate,
              status: 'PROPOSED'
            }))
          }
        },
        include: { increments: true }
      });
      return b;
    });

    await recordAudit(req, 'GENERATE_INCREMENT_BATCH', 'IncrementBatch', batch.id, {
      name: data.name,
      totalEmployees: data.increments.length
    });

    res.status(201).json({ incrementBatch: batch });
  } catch (error) {
    next(error);
  }
});

// Approve Increment Batch & Update Employee Salary Assignments
incrementRouter.post('/batches/:id/approve', authenticate, requireRole(['payroll_ar_salary', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const batch = await prisma.incrementBatch.findUnique({
      where: { id: String(req.params.id) },
      include: { increments: true }
    });
    if (!batch) throw new AppError('Batch not found', 404);

    await prisma.$transaction(async (tx) => {
      await tx.incrementBatch.update({
        where: { id: batch.id },
        data: { status: 'APPROVED' }
      });

      // Update active assignment for each employee
      for (const inc of batch.increments) {
        await tx.employeeIncrement.update({
          where: { id: inc.id },
          data: { status: 'APPROVED' }
        });

        // Deactivate old assignment
        await tx.employeeSalaryAssignment.updateMany({
          where: { employeeId: inc.employeeId, active: true },
          data: { active: false, effectiveTo: batch.effectiveDate }
        });

        // Get assignment structure
        const prevAssignment = await tx.employeeSalaryAssignment.findFirst({
          where: { employeeId: inc.employeeId },
          orderBy: { createdAt: 'desc' }
        });

        if (prevAssignment) {
          await tx.employeeSalaryAssignment.create({
            data: {
              employeeId: inc.employeeId,
              structureId: prevAssignment.structureId,
              payLevelId: prevAssignment.payLevelId,
              payMatrixCellId: inc.nextCellId,
              basicPay: inc.nextBasic,
              effectiveFrom: batch.effectiveDate,
              active: true
            }
          });
        }
      }
    });

    await recordAudit(req, 'APPROVE_INCREMENT_BATCH', 'IncrementBatch', batch.id);
    res.status(200).json({ message: 'Increment batch approved and salary assignments updated' });
  } catch (error) {
    next(error);
  }
});
