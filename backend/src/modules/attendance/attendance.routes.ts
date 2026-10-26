import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const attendanceRouter = Router();

// 1. Shift Policies
attendanceRouter.get('/shifts', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const shifts = await prisma.shiftPolicy.findMany({
      where: { companyId: req.user!.companyId },
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ shifts });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.post('/shifts', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      startTime: z.string(),
      endTime: z.string(),
      graceMinutes: z.number().default(15),
      halfDayMinutes: z.number().default(240),
      fullDayMinutes: z.number().default(480)
    });
    const data = schema.parse(req.body);

    const shift = await prisma.shiftPolicy.create({
      data: {
        companyId: req.user!.companyId,
        ...data
      }
    });

    await recordAudit(req, 'CREATE_SHIFT_POLICY', 'ShiftPolicy', shift.id, data);
    res.status(201).json({ shift });
  } catch (error) {
    next(error);
  }
});

// 2. Web Clock-In / Clock-Out
const punchHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('User is not associated with an employee record', 400);

    const schema = z.object({
      punchType: z.enum(['IN', 'OUT']),
      source: z.enum(['WEB', 'BIOMETRIC', 'MOBILE', 'MANUAL']).default('WEB')
    });
    const { punchType, source } = schema.parse(req.body);

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Record raw punch
    const punch = await prisma.attendancePunch.create({
      data: {
        employeeId,
        punchTime: now,
        punchType,
        source: source as any,
        ipAddress: req.ip ?? req.socket.remoteAddress
      }
    });

    // Update or create DailyAttendance
    let daily = await prisma.dailyAttendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today
        }
      }
    });

    if (!daily) {
      daily = await prisma.dailyAttendance.create({
        data: {
          employeeId,
          date: today,
          status: 'PRESENT',
          firstIn: punchType === 'IN' ? now : null,
          lastOut: punchType === 'OUT' ? now : null,
          workingHours: 0
        }
      });
    } else {
      const firstIn = daily.firstIn ?? (punchType === 'IN' ? now : null);
      const lastOut = punchType === 'OUT' ? now : daily.lastOut;

      let workingHours = 0;
      if (firstIn && lastOut && lastOut > firstIn) {
        workingHours = Math.round(((lastOut.getTime() - firstIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;
      }

      daily = await prisma.dailyAttendance.update({
        where: { id: daily.id },
        data: {
          firstIn,
          lastOut,
          workingHours,
          status: workingHours >= 8 ? 'PRESENT' : workingHours >= 4 ? 'HALF_DAY' : 'PRESENT'
        }
      });
    }

    res.status(200).json({
      message: `Punch ${punchType} registered successfully`,
      punch,
      dailyAttendance: daily
    });
  } catch (error) {
    next(error);
  }
};

attendanceRouter.post('/punch', authenticate, punchHandler);
attendanceRouter.post('/clock-in', authenticate, (req: Request, res: Response, next: NextFunction) => {
  req.body.punchType = 'IN';
  req.body.source = req.body.source || 'WEB';
  return punchHandler(req, res, next);
});
attendanceRouter.post('/clock-out', authenticate, (req: Request, res: Response, next: NextFunction) => {
  req.body.punchType = 'OUT';
  req.body.source = req.body.source || 'WEB';
  return punchHandler(req, res, next);
});

// 3. Daily Attendance Catalog & Filtering
attendanceRouter.get('/daily', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const date = req.query.date ? new Date(String(req.query.date)) : undefined;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;

    const attendances = await prisma.dailyAttendance.findMany({
      where: {
        ...(date ? { date } : {}),
        employee: {
          companyId: req.user!.companyId,
          ...(departmentId ? { departmentId } : {}),
          ...(branchId ? { branchId } : {})
        }
      },
      take: 100,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { name: true } }
          }
        },
        shiftPolicy: true
      },
      orderBy: [{ date: 'desc' }, { employee: { employeeCode: 'asc' } }]
    });

    res.status(200).json({ date: date ? date.toISOString().split('T')[0] : 'All Recent', attendances });
  } catch (error) {
    next(error);
  }
});

// 4. Regularization Requests
attendanceRouter.post('/regularize', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError('User is not associated with an employee record', 400);

    const schema = z.object({
      attendanceDate: z.string(),
      reasonCode: z.enum(['BIOMETRIC_GLITCH', 'CLIENT_VISIT', 'FORGOT_PUNCH', 'OFFICIAL_DUTY']),
      reasonNotes: z.string().min(1),
      requestedStatus: z.enum(['PRESENT', 'HALF_DAY']).default('PRESENT')
    });
    const data = schema.parse(req.body);

    const reg = await prisma.attendanceRegularization.create({
      data: {
        employeeId,
        attendanceDate: new Date(data.attendanceDate),
        reasonCode: data.reasonCode,
        reasonNotes: data.reasonNotes,
        requestedStatus: data.requestedStatus as any,
        status: 'PENDING'
      }
    });

    res.status(201).json({ regularization: reg });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.get('/regularizations', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const isManager = req.user!.roles.includes('department_manager') || req.user!.roles.includes('hr_manager') || req.user!.roles.includes('company_admin');

    const where: any = {
      employee: { companyId: req.user!.companyId },
      ...(status ? { status: status as any } : {})
    };

    if (!isManager) {
      where.employeeId = req.user!.employeeId || 'unassigned';
    }

    const regularizations = await prisma.attendanceRegularization.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ regularizations });
  } catch (error) {
    next(error);
  }
});

attendanceRouter.post('/regularizations/:id/action', authenticate, requireRole(['department_manager', 'hr_manager', 'company_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED'])
    });
    const { status } = schema.parse(req.body);

    const reg = await prisma.attendanceRegularization.findUnique({
      where: { id: String(req.params.id) },
      include: { employee: true }
    });
    if (!reg) throw new AppError('Regularization request not found', 404);

    if (reg.employeeId === req.user!.employeeId && !req.user!.roles.includes('company_admin')) {
      throw new AppError('Segregation of duties: You cannot approve your own regularization request', 403, 'FORBIDDEN');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.attendanceRegularization.update({
        where: { id: reg.id },
        data: {
          status: status as any,
          approvedBy: req.user!.fullName,
          actionedAt: new Date()
        }
      });

      if (status === 'APPROVED') {
        await tx.dailyAttendance.upsert({
          where: {
            employeeId_date: {
              employeeId: reg.employeeId,
              date: reg.attendanceDate
            }
          },
          update: {
            status: reg.requestedStatus,
            workingHours: reg.requestedStatus === 'PRESENT' ? 8 : 4
          },
          create: {
            employeeId: reg.employeeId,
            date: reg.attendanceDate,
            status: reg.requestedStatus,
            workingHours: reg.requestedStatus === 'PRESENT' ? 8 : 4
          }
        });
      }

      return r;
    });

    res.status(200).json({ regularization: updated });
  } catch (error) {
    next(error);
  }
});

// 4. Monthly Attendance Matrix (Saral PayPack Parity)
attendanceRouter.get('/monthly-matrix', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59));

    // Fetch active employees
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: { in: ['ACTIVE', 'CONFIRMED', 'PROBATION'] },
        ...(departmentId ? { departmentId } : {}),
        dateOfJoining: { lte: endDate },
        OR: [
          { exitDate: null },
          { exitDate: { gte: startDate } }
        ]
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        dailyAttendance: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        },
        leaveRequests: {
          where: {
            status: 'APPROVED',
            fromDate: { lte: endDate },
            toDate: { gte: startDate }
          },
          include: { leavePolicy: true }
        }
      },
      orderBy: { employeeCode: 'asc' }
    });

    const matrix = employees.map(emp => {
      let presentCount = 0;
      let totalOvertimeHours = 0;
      for (const d of emp.dailyAttendance) {
        if (d.status === 'PRESENT') {
          presentCount += 1;
        } else if (d.status === 'HALF_DAY') {
          presentCount += 0.5;
        }
        if (d.workingHours && Number(d.workingHours) > 8) {
          totalOvertimeHours += (Number(d.workingHours) - 8);
        }
      }

      let clDays = 0;
      let slDays = 0;
      let plDays = 0;
      let lopDays = 0;
      let otherPaidDays = 0;

      for (const req of emp.leaveRequests) {
        const days = Number(req.totalDays);
        if (!req.leavePolicy.isPaid) {
          lopDays += days;
        } else {
          const code = req.leavePolicy.code.toUpperCase();
          if (code.includes('CL') || code.includes('CASUAL')) clDays += days;
          else if (code.includes('SL') || code.includes('SICK')) slDays += days;
          else if (code.includes('PL') || code.includes('EARNED') || code.includes('PRIVILEGE')) plDays += days;
          else otherPaidDays += days;
        }
      }

      const joiningDate = new Date(emp.dateOfJoining);
      let nonEmployedDays = 0;
      if (joiningDate > startDate) {
        nonEmployedDays = Math.round((joiningDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      const totalLeaves = clDays + slDays + plDays + otherPaidDays;
      const effectivePresent = emp.dailyAttendance.length > 0
        ? presentCount
        : Math.max(0, lastDay - nonEmployedDays - lopDays - totalLeaves);

      const payableDays = Math.max(0, lastDay - nonEmployedDays - lopDays);

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name || 'General',
        designation: emp.designation?.name || 'Staff',
        calendarDays: lastDay,
        presentDays: effectivePresent,
        overtimeHours: totalOvertimeHours,
        lopDays,
        casualLeave: clDays,
        sickLeave: slDays,
        paidLeave: plDays,
        otherPaidLeave: otherPaidDays,
        totalPaidLeave: totalLeaves,
        payableDays,
        status: emp.status
      };
    });

    res.status(200).json({
      month,
      year,
      calendarDays: lastDay,
      totalListed: matrix.length,
      matrix
    });
  } catch (error) {
    next(error);
  }
});
