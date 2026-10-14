import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const employeeRouter = Router();

// List Employees with Search & Pagination
employeeRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const ouId = req.query.ouId ? String(req.query.ouId) : undefined;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;

    const where: any = {
      institutionId: req.user!.institutionId,
      ...(ouId ? { ouId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(active !== undefined ? { active } : {})
    };

    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { pan: { contains: search, mode: 'insensitive' } }
      ];
    }

    // OU scoping for payroll_ou_admin
    if (req.user!.roles.includes('payroll_ou_admin') && !req.user!.roles.includes('payroll_admin')) {
      if (req.user!.scopedOuIds.length > 0) {
        where.ouId = { in: req.user!.scopedOuIds };
      }
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          ou: true,
          department: true,
          designation: true,
          employeeGroup: true,
          salaryAssignments: {
            where: { active: true },
            include: {
              structure: true,
              payLevel: true,
              payMatrixCell: true
            },
            take: 1
          },
          bankAccounts: {
            where: { isPrimary: true },
            take: 1
          },
          gpfAccount: true
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { employeeCode: 'asc' }
      })
    ]);

    res.status(200).json({
      employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Single Employee Details
employeeRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employee = await prisma.employee.findFirst({
      where: {
        id: String(req.params.id),
        institutionId: req.user!.institutionId
      },
      include: {
        ou: true,
        department: true,
        designation: true,
        employeeGroup: true,
        managedPayrollGroup: true,
        bankAccounts: true,
        salaryAssignments: {
          include: {
            structure: {
              include: { lines: { include: { salaryHead: true } } }
            },
            payLevel: true,
            payMatrixCell: true
          },
          orderBy: { effectiveFrom: 'desc' }
        },
        taxProfiles: {
          include: { financialYear: true },
          orderBy: { createdAt: 'desc' }
        },
        gpfAccount: {
          include: {
            statements: { orderBy: { createdAt: 'desc' } }
          }
        },
        loans: {
          include: { loanType: true },
          orderBy: { createdAt: 'desc' }
        },
        leaveRecords: {
          include: { leaveType: true },
          orderBy: { fromDate: 'desc' },
          take: 10
        }
      }
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    res.status(200).json({ employee });
  } catch (error) {
    next(error);
  }
});

// Create Employee
const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  dateOfJoining: z.string(),
  employmentType: z.enum(['PERMANENT', 'CONTRACTUAL', 'ADHOC', 'TEMPORARY']).default('PERMANENT'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pan: z.string().min(10).max(10).optional(),
  cityCategory: z.enum(['X', 'Y', 'Z']).default('X'),
  ouId: z.string().min(1),
  departmentId: z.string().min(1),
  designationId: z.string().min(1),
  employeeGroupId: z.string().min(1),
  managedPayrollGroupId: z.string().optional(),
  // Bank details
  bankName: z.string().min(1),
  accountNumber: z.string().min(5),
  ifscCode: z.string().min(4),
  // Initial salary assignment
  structureId: z.string().min(1),
  payLevelId: z.string().optional(),
  payMatrixCellId: z.string().optional(),
  basicPay: z.number().positive(),
  // GPF or NPS
  gpfAccountNumber: z.string().optional(),
  gpfOpeningBalance: z.number().optional()
});

employeeRouter.post('/', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createEmployeeSchema.parse(req.body);

    const existing = await prisma.employee.findUnique({
      where: {
        institutionId_employeeCode: {
          institutionId: req.user!.institutionId,
          employeeCode: data.employeeCode
        }
      }
    });

    if (existing) {
      throw new AppError(`Employee code ${data.employeeCode} already exists`, 400, 'DUPLICATE_CODE');
    }

    const maskedPan = data.pan ? `${data.pan.slice(0, 3)}XXXXX${data.pan.slice(-2)}` : null;
    const maskedAccount = `XXXXXX${data.accountNumber.slice(-4)}`;

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          institutionId: req.user!.institutionId,
          ouId: data.ouId,
          departmentId: data.departmentId,
          designationId: data.designationId,
          employeeGroupId: data.employeeGroupId,
          managedPayrollGroupId: data.managedPayrollGroupId,
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          dateOfJoining: new Date(data.dateOfJoining),
          employmentType: data.employmentType,
          email: data.email,
          phone: data.phone,
          pan: data.pan,
          maskedPan,
          cityCategory: data.cityCategory
        }
      });

      // Bank account
      await tx.employeeBankAccount.create({
        data: {
          employeeId: employee.id,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          maskedAccount,
          ifscCode: data.ifscCode,
          paymentMode: 'NEFT',
          isPrimary: true
        }
      });

      // Salary assignment
      await tx.employeeSalaryAssignment.create({
        data: {
          employeeId: employee.id,
          structureId: data.structureId,
          payLevelId: data.payLevelId,
          payMatrixCellId: data.payMatrixCellId,
          basicPay: data.basicPay,
          effectiveFrom: new Date(data.dateOfJoining),
          active: true
        }
      });

      // GPF account if specified
      if (data.gpfAccountNumber) {
        await tx.gpfAccount.create({
          data: {
            employeeId: employee.id,
            accountNumber: data.gpfAccountNumber,
            openingBalance: data.gpfOpeningBalance ?? 0,
            openingBalanceDate: new Date(data.dateOfJoining),
            currentBalance: data.gpfOpeningBalance ?? 0
          }
        });
      }

      return employee;
    });

    await recordAudit(req, 'CREATE_EMPLOYEE', 'Employee', result.id, { employeeCode: data.employeeCode });
    res.status(201).json({ employee: result });
  } catch (error) {
    next(error);
  }
});

// Update employee basic details
employeeRouter.patch('/:id', authenticate, requireRole(['payroll_admin', 'payroll_pcm']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      firstName: z.string().optional(),
      middleName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      cityCategory: z.enum(['X', 'Y', 'Z']).optional(),
      ouId: z.string().optional(),
      departmentId: z.string().optional(),
      designationId: z.string().optional(),
      active: z.boolean().optional()
    });
    const data = schema.parse(req.body);

    const employee = await prisma.employee.update({
      where: { id: String(req.params.id) },
      data
    });

    await recordAudit(req, 'UPDATE_EMPLOYEE', 'Employee', employee.id, data);
    res.status(200).json({ employee });
  } catch (error) {
    next(error);
  }
});
