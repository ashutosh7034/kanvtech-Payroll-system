import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const employeeRouter = Router();

// List Employees
employeeRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Number(req.query.pageSize ?? 50));
    const search = req.query.search ? String(req.query.search) : undefined;
    const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const terms = search ? search.trim().split(/\s+/).filter(Boolean) : [];
    const where: any = {
      companyId: req.user!.companyId,
      ...(departmentId ? { departmentId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { workEmail: { contains: search, mode: 'insensitive' } },
              ...(terms.length > 1
                ? [
                    {
                      AND: terms.map(term => ({
                        OR: [
                          { firstName: { contains: term, mode: 'insensitive' } },
                          { lastName: { contains: term, mode: 'insensitive' } },
                          { employeeCode: { contains: term, mode: 'insensitive' } }
                        ]
                      }))
                    }
                  ]
                : [])
            ]
          }
        : {})
    };

    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'hr_manager', 'hr_executive', 'payroll_admin', 'finance_admin'].includes(r)
    );

    const [total, rawEmployees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          branch: true,
          jobBand: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true }
          },
          salaryStructure: {
            select: { annualCtc: true, monthlyGross: true }
          }
        },
        orderBy: { employeeCode: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    // Mask confidential fields if caller is a regular employee
    const employees = rawEmployees.map(emp => {
      if (!isPrivileged) {
        return {
          ...emp,
          salaryStructure: (emp.id === req.user!.employeeId) ? emp.salaryStructure : null,
          panNumber: emp.panNumber ? 'XXXXX' + emp.panNumber.slice(-4) : 'XXXXX0000',
          bankAccountNumber: emp.bankAccountNumber ? '••••••••' + emp.bankAccountNumber.slice(-4) : '••••••••••••',
          uanNumber: emp.id === req.user!.employeeId ? emp.uanNumber : null,
          pfNumber: emp.id === req.user!.employeeId ? emp.pfNumber : null
        };
      }
      return emp;
    });

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

// Single Employee Profile
employeeRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isPrivileged = req.user!.roles.some(r =>
      ['company_admin', 'platform_admin', 'hr_manager', 'hr_executive', 'payroll_admin', 'finance_admin'].includes(r)
    );
    const requestedId = String(req.params.id);

    const employee = await prisma.employee.findFirst({
      where: {
        id: requestedId,
        companyId: req.user!.companyId
      },
      include: {
        department: true,
        designation: true,
        branch: true,
        jobBand: true,
        costCenter: true,
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, workEmail: true }
        },
        directReports: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true }
        },
        salaryStructure: {
          include: {
            lines: {
              include: { component: true },
              orderBy: { component: { displayOrder: 'asc' } }
            }
          }
        },
        documents: {
          orderBy: { uploadedAt: 'desc' }
        },
        timeline: {
          orderBy: { effectiveDate: 'desc' }
        },
        leaveBalances: {
          include: { leavePolicy: true }
        },
        allocatedAssets: {
          include: { asset: true }
        },
        payrollPolicy: true,
        salaryRevisions: {
          orderBy: { effectiveFrom: 'desc' },
          take: 10
        }
      }
    });

    if (!employee) throw new AppError('Employee not found', 404);

    // Enforce role isolation: Regular employees cannot inspect other employees' full profiles
    const isSelf = req.user!.employeeId === employee.id;
    const isManagerOfEmployee = employee.managerId === req.user!.employeeId;

    if (!isPrivileged && !isSelf && !isManagerOfEmployee) {
      throw new AppError('Access denied: Confidential employee profile is restricted to HR and administrative personnel', 403, 'FORBIDDEN');
    }

    // If manager (but not HR/Admin), redact confidential salary and bank details
    if (!isPrivileged && !isSelf && isManagerOfEmployee) {
      const sanitized = {
        ...employee,
        salaryStructure: null,
        panNumber: employee.panNumber ? 'XXXXX' + employee.panNumber.slice(-4) : null,
        bankAccountNumber: employee.bankAccountNumber ? '••••••••' + employee.bankAccountNumber.slice(-4) : null,
        uanNumber: null,
        pfNumber: null,
        documents: []
      };
      res.status(200).json({ employee: sanitized });
      return;
    }

    res.status(200).json({ employee });
  } catch (error) {
    next(error);
  }
});

// Create Employee
employeeRouter.post('/', authenticate, requireRole(['company_admin', 'hr_manager', 'hr_executive']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeCode: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      workEmail: z.string().email(),
      personalEmail: z.string().email().optional(),
      phone: z.string().optional(),
      branchId: z.string().min(1),
      departmentId: z.string().min(1),
      designationId: z.string().min(1),
      jobBandId: z.string().optional(),
      costCenterId: z.string().optional(),
      managerId: z.string().optional(),
      dateOfJoining: z.string(),
      probationDays: z.number().default(90),
      employmentType: z.enum(['PERMANENT', 'PROBATIONARY', 'CONTRACTUAL', 'CONSULTANT', 'INTERN']).default('PERMANENT'),
      workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']).default('OFFICE'),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
      panNumber: z.string().optional().nullable(),
      uanNumber: z.string().optional().nullable(),
      bankName: z.string().optional().nullable(),
      bankAccountNumber: z.string().optional().nullable(),
      ifscCode: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable(),
      maritalStatus: z.string().optional().nullable(),
      bloodGroup: z.string().optional().nullable(),
      emergencyContactName: z.string().optional().nullable(),
      emergencyContactPhone: z.string().optional().nullable(),
      addressLine1: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      pinCode: z.string().optional().nullable(),
      confirmationDate: z.string().optional().nullable(),
      noticePeriodDays: z.number().optional().nullable(),
      pfNumber: z.string().optional().nullable(),
      esicNumber: z.string().optional().nullable(),
      aadhaarMasked: z.string().optional().nullable(),
      bankBranch: z.string().optional().nullable(),
      customFields: z.array(z.object({ fieldDefinitionId: z.string(), value: z.string() })).optional()
    });
    const data = schema.parse(req.body);

    const existing = await prisma.employee.findFirst({
      where: {
        companyId: req.user!.companyId,
        OR: [
          { employeeCode: data.employeeCode },
          { workEmail: data.workEmail }
        ]
      }
    });
    if (existing) {
      throw new AppError('Employee code or work email already exists', 400, 'DUPLICATE_EMPLOYEE');
    }

    const joiningDate = new Date(data.dateOfJoining);

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          companyId: req.user!.companyId,
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          workEmail: data.workEmail,
          personalEmail: data.personalEmail || null,
          phone: data.phone || null,
          branchId: data.branchId,
          departmentId: data.departmentId,
          designationId: data.designationId,
          jobBandId: data.jobBandId || null,
          costCenterId: data.costCenterId || null,
          managerId: data.managerId || null,
          dateOfJoining: joiningDate,
          probationDays: data.probationDays,
          employmentType: data.employmentType as any,
          workMode: data.workMode as any,
          status: 'PROBATION',
          gender: data.gender as any,
          panNumber: data.panNumber || null,
          uanNumber: data.uanNumber || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          ifscCode: data.ifscCode || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          maritalStatus: data.maritalStatus || null,
          bloodGroup: data.bloodGroup || null,
          emergencyContactName: data.emergencyContactName || null,
          emergencyContactPhone: data.emergencyContactPhone || null,
          addressLine1: data.addressLine1 || null,
          city: data.city || null,
          state: data.state || null,
          pinCode: data.pinCode || null,
          confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
          noticePeriodDays: data.noticePeriodDays ?? 60,
          pfNumber: data.pfNumber || null,
          esicNumber: data.esicNumber || null,
          aadhaarMasked: data.aadhaarMasked || null,
          bankBranch: data.bankBranch || null
        }
      });

      if (data.customFields && data.customFields.length > 0) {
        for (const cf of data.customFields) {
          if (cf.fieldDefinitionId && cf.value) {
            await tx.employeeCustomFieldValue.upsert({
              where: {
                employeeId_fieldDefinitionId: {
                  employeeId: emp.id,
                  fieldDefinitionId: cf.fieldDefinitionId
                }
              },
              create: {
                employeeId: emp.id,
                fieldDefinitionId: cf.fieldDefinitionId,
                fieldValue: cf.value
              },
              update: {
                fieldValue: cf.value
              }
            });
          }
        }
      }

      // Record Timeline Event
      await tx.employmentTimeline.create({
        data: {
          employeeId: emp.id,
          eventType: 'JOINING',
          title: 'Joined Apex Global',
          description: `Joined as ${data.employmentType} employee under probation of ${data.probationDays} days.`,
          effectiveDate: joiningDate,
          recordedBy: req.user!.fullName
        }
      });

      // Allocate default leave balances from leave policies
      const policies = await tx.leavePolicy.findMany({
        where: { companyId: req.user!.companyId }
      });
      const currentYear = joiningDate.getFullYear();
      for (const p of policies) {
        await tx.employeeLeaveBalance.create({
          data: {
            employeeId: emp.id,
            leavePolicyId: p.id,
            calendarYear: currentYear,
            credited: p.annualQuota,
            used: 0,
            balance: p.annualQuota
          }
        });
      }

      // Initialize default EmployeePayrollPolicy
      const branch = await tx.branch.findUnique({ where: { id: data.branchId } });
      await tx.employeePayrollPolicy.create({
        data: {
          employeeId: emp.id,
          pfApplicable: true,
          pfStatus: 'APPLICABLE',
          pfWageBasis: 'CEILING_15000',
          pfNumber: data.uanNumber ? `MH/BAN/${data.uanNumber.slice(-7)}` : null,
          uanNumber: data.uanNumber || null,
          esiApplicable: false,
          esiStatus: 'EXEMPT_OVER_CEILING',
          ptApplicable: true,
          ptState: branch?.state || 'Maharashtra',
          taxRegime: 'NEW',
          paymentMode: 'NEFT',
          payrollFrequency: 'MONTHLY',
          effectiveFrom: joiningDate
        }
      });

      return emp;
    });

    await recordAudit(req, 'CREATE_EMPLOYEE', 'Employee', employee.id, { employeeCode: data.employeeCode });
    res.status(201).json({ employee });
  } catch (error) {
    next(error);
  }
});

// Update Employee
employeeRouter.put('/:id', authenticate, requireRole(['company_admin', 'hr_manager', 'hr_executive']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      personalEmail: z.string().email().optional(),
      phone: z.string().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      maritalStatus: z.string().optional(),
      bloodGroup: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      addressLine1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pinCode: z.string().optional(),
      workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']).optional(),
      panNumber: z.string().optional(),
      uanNumber: z.string().optional(),
      pfNumber: z.string().optional(),
      esicNumber: z.string().optional(),
      bankName: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      ifscCode: z.string().optional(),
      bankBranch: z.string().optional()
    });
    const data = schema.parse(req.body);

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: data as any
    });

    await recordAudit(req, 'UPDATE_EMPLOYEE', 'Employee', updated.id, data);
    res.status(200).json({ employee: updated });
  } catch (error) {
    next(error);
  }
});

// Record Lifecycle Event (Confirmation, Promotion, Transfer, Salary Revision, Exit)
employeeRouter.post('/:id/lifecycle', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      eventType: z.enum(['CONFIRMATION', 'PROMOTION', 'TRANSFER', 'SALARY_REVISION', 'RESIGNATION', 'EXIT']),
      title: z.string().min(1),
      description: z.string().optional(),
      effectiveDate: z.string(),
      newDepartmentId: z.string().optional(),
      newDesignationId: z.string().optional(),
      newBranchId: z.string().optional(),
      newJobBandId: z.string().optional(),
      newManagerId: z.string().optional()
    });
    const data = schema.parse(req.body);

    const employee = await prisma.employee.findFirst({
      where: { id: String(req.params.id), companyId: req.user!.companyId }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const effectiveDate = new Date(data.effectiveDate);

    await prisma.$transaction(async (tx) => {
      // 1. Record Timeline
      await tx.employmentTimeline.create({
        data: {
          employeeId: employee.id,
          eventType: data.eventType,
          title: data.title,
          description: data.description,
          effectiveDate,
          recordedBy: req.user!.fullName
        }
      });

      // 2. Update Employee fields according to event
      const updates: any = {};
      if (data.eventType === 'CONFIRMATION') {
        updates.status = 'CONFIRMED';
        updates.confirmationDate = effectiveDate;
      } else if (data.eventType === 'PROMOTION') {
        if (data.newDesignationId) updates.designationId = data.newDesignationId;
        if (data.newJobBandId) updates.jobBandId = data.newJobBandId;
      } else if (data.eventType === 'TRANSFER') {
        if (data.newBranchId) updates.branchId = data.newBranchId;
        if (data.newDepartmentId) updates.departmentId = data.newDepartmentId;
        if (data.newManagerId) updates.managerId = data.newManagerId;
      } else if (data.eventType === 'EXIT') {
        updates.status = 'EXITED';
        updates.exitDate = effectiveDate;
      }

      if (Object.keys(updates).length > 0) {
        await tx.employee.update({
          where: { id: employee.id },
          data: updates
        });
      }
    });

    await recordAudit(req, `LIFECYCLE_${data.eventType}`, 'Employee', employee.id, data);
    res.status(200).json({ message: `Lifecycle event ${data.eventType} recorded successfully` });
  } catch (error) {
    next(error);
  }
});

// Get Employee Payroll Policy
employeeRouter.get('/:id/payroll-policy', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestedId = String(req.params.id);
    const employee = await prisma.employee.findFirst({
      where: { id: requestedId, companyId: req.user!.companyId },
      include: { branch: true }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    let policy = await prisma.employeePayrollPolicy.findUnique({
      where: { employeeId: employee.id }
    });

    if (!policy) {
      policy = await prisma.employeePayrollPolicy.create({
        data: {
          employeeId: employee.id,
          pfApplicable: true,
          pfStatus: 'APPLICABLE',
          pfWageBasis: 'CEILING_15000',
          pfNumber: employee.pfNumber,
          uanNumber: employee.uanNumber,
          esiApplicable: false,
          esiStatus: 'EXEMPT_OVER_CEILING',
          ptApplicable: true,
          ptState: employee.branch?.state || 'Maharashtra',
          taxRegime: 'NEW',
          paymentMode: 'NEFT',
          payrollFrequency: 'MONTHLY',
          effectiveFrom: employee.dateOfJoining || new Date()
        }
      });
    }

    const policyWithBank = {
      ...policy,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      bankIfsc: employee.ifscCode
    };

    res.status(200).json({ policy: policyWithBank });
  } catch (error) {
    next(error);
  }
});

// Update Employee Payroll Policy
employeeRouter.put('/:id/payroll-policy', authenticate, requireRole(['company_admin', 'payroll_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestedId = String(req.params.id);
    const employee = await prisma.employee.findFirst({
      where: { id: requestedId, companyId: req.user!.companyId }
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const schema = z.object({
      pfApplicable: z.boolean().default(true),
      pfStatus: z.string().default('APPLICABLE'),
      pfWageBasis: z.string().default('CEILING_15000'),
      pfNumber: z.string().optional().nullable(),
      uanNumber: z.string().optional().nullable(),
      pfUan: z.string().optional().nullable(),
      esiApplicable: z.boolean().default(false),
      esiStatus: z.string().default('EXEMPT_OVER_CEILING'),
      esiNumber: z.string().optional().nullable(),
      esiInsuranceNumber: z.string().optional().nullable(),
      ptApplicable: z.boolean().default(true),
      ptState: z.string().default('Maharashtra'),
      taxRegime: z.string().default('NEW'),
      tdsMonthlyOverride: z.number().optional().nullable(),
      paymentMode: z.string().default('NEFT'),
      payrollFrequency: z.string().default('MONTHLY'),
      exceptionRemarks: z.string().optional().nullable(),
      pfExemptionReason: z.string().optional().nullable(),
      effectiveFrom: z.string().optional(),
      bankName: z.string().optional().nullable(),
      bankAccountNumber: z.string().optional().nullable(),
      bankIfsc: z.string().optional().nullable(),
      notes: z.string().optional().nullable()
    });
    const rawData = schema.parse(req.body);

    const pfStatus = (rawData.pfStatus === 'NOT_APPLICABLE' || rawData.pfStatus === 'EXEMPT_OVER_CEILING' || rawData.pfStatus === 'APPROVED_EXCEPTION')
      ? (rawData.pfStatus === 'APPROVED_EXCEPTION' ? 'APPROVED_EXCEPTION' : 'NOT_APPLICABLE')
      : rawData.pfStatus;

    const pfWageBasis = rawData.pfWageBasis;
    const taxRegime = (rawData.taxRegime === 'NEW_REGIME' || rawData.taxRegime === 'NEW') ? 'NEW' : 'OLD';

    const validModes = ['NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'UPI'];
    const paymentMode = validModes.includes(String(rawData.paymentMode).toUpperCase())
      ? String(rawData.paymentMode).toUpperCase()
      : 'NEFT';

    const exceptionRemarks = rawData.exceptionRemarks || rawData.pfExemptionReason || rawData.notes || null;
    const uanNumber = rawData.uanNumber || rawData.pfUan || employee.uanNumber;
    const esiNumber = rawData.esiNumber || rawData.esiInsuranceNumber || employee.esicNumber;

    // Validation: Legitimate exemption justification
    if ((pfStatus === 'NOT_APPLICABLE' || pfStatus === 'EXEMPT_OVER_CEILING' || pfStatus === 'APPROVED_EXCEPTION') && !exceptionRemarks) {
      throw new AppError('Legitimate compliance exception remarks are required when disabling mandatory PF contribution.', 400);
    }

    const effectiveDate = rawData.effectiveFrom ? new Date(rawData.effectiveFrom) : new Date();

    const policy = await prisma.employeePayrollPolicy.upsert({
      where: { employeeId: employee.id },
      update: {
        pfApplicable: rawData.pfApplicable,
        pfStatus,
        pfWageBasis,
        pfNumber: rawData.pfNumber,
        uanNumber,
        esiApplicable: rawData.esiApplicable,
        esiStatus: rawData.esiStatus,
        esiNumber,
        ptApplicable: rawData.ptApplicable,
        ptState: rawData.ptState,
        taxRegime,
        tdsMonthlyOverride: rawData.tdsMonthlyOverride !== undefined && rawData.tdsMonthlyOverride !== null ? new Decimal(rawData.tdsMonthlyOverride) : null,
        paymentMode: paymentMode as any,
        payrollFrequency: rawData.payrollFrequency,
        exceptionRemarks,
        effectiveFrom: effectiveDate,
        approvedBy: req.user?.fullName || req.user?.username || 'System',
        approvedAt: new Date()
      },
      create: {
        employeeId: employee.id,
        pfApplicable: rawData.pfApplicable,
        pfStatus,
        pfWageBasis,
        pfNumber: rawData.pfNumber,
        uanNumber,
        esiApplicable: rawData.esiApplicable,
        esiStatus: rawData.esiStatus,
        esiNumber,
        ptApplicable: rawData.ptApplicable,
        ptState: rawData.ptState,
        taxRegime,
        tdsMonthlyOverride: rawData.tdsMonthlyOverride !== undefined && rawData.tdsMonthlyOverride !== null ? new Decimal(rawData.tdsMonthlyOverride) : null,
        paymentMode: paymentMode as any,
        payrollFrequency: rawData.payrollFrequency,
        exceptionRemarks,
        effectiveFrom: effectiveDate,
        approvedBy: req.user?.fullName || req.user?.username || 'System',
        approvedAt: new Date()
      }
    });

    if (rawData.bankName || rawData.bankAccountNumber || rawData.bankIfsc) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          ...(rawData.bankName ? { bankName: rawData.bankName } : {}),
          ...(rawData.bankAccountNumber ? { bankAccountNumber: rawData.bankAccountNumber } : {}),
          ...(rawData.bankIfsc ? { ifscCode: rawData.bankIfsc } : {})
        }
      });
    }

    const updatedEmployee = await prisma.employee.findUnique({ where: { id: employee.id } });
    const policyWithBank = {
      ...policy,
      bankName: updatedEmployee?.bankName || employee.bankName,
      bankAccountNumber: updatedEmployee?.bankAccountNumber || employee.bankAccountNumber,
      bankIfsc: updatedEmployee?.ifscCode || employee.ifscCode
    };

    await recordAudit(req, 'UPDATE_PAYROLL_POLICY', 'EmployeePayrollPolicy', policy.id, {
      employeeCode: employee.employeeCode,
      pfStatus: rawData.pfStatus,
      ptState: rawData.ptState,
      taxRegime: rawData.taxRegime
    });

    res.status(200).json({ message: 'Payroll policy updated successfully', policy: policyWithBank });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// COLUMN MANAGER & CUSTOM FIELDS
// ==========================================

// Get all custom field definitions for the company
employeeRouter.get('/custom-fields/definitions', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let fields = await prisma.customFieldDefinition.findMany({
      where: { companyId: req.user!.companyId, module: 'EMPLOYEE' },
      orderBy: { displayOrder: 'asc' }
    });

    // Seed standard enterprise custom columns if none exist
    if (fields.length === 0) {
      await prisma.customFieldDefinition.createMany({
        data: [
          { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: 'emergencyContactRelation', fieldLabel: 'Emergency Contact Relation', fieldType: 'DROPDOWN', optionsJson: JSON.stringify(['Spouse', 'Parent', 'Sibling', 'Friend', 'Guardian']), isRequired: false, isVisible: true, displayOrder: 1 },
          { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: 'aadhaarNumber', fieldLabel: 'Aadhaar Reference (Masked)', fieldType: 'TEXT', isRequired: false, isVisible: true, displayOrder: 2 },
          { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: 'bloodGroup', fieldLabel: 'Blood Group', fieldType: 'DROPDOWN', optionsJson: JSON.stringify(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']), isRequired: false, isVisible: true, displayOrder: 3 },
          { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: 'laptopSerial', fieldLabel: 'Corporate Laptop Serial #', fieldType: 'TEXT', isRequired: false, isVisible: true, displayOrder: 4 },
          { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: 'priorExperienceYears', fieldLabel: 'Prior Experience (Years)', fieldType: 'NUMBER', isRequired: false, isVisible: true, displayOrder: 5 }
        ]
      });
      fields = await prisma.customFieldDefinition.findMany({
        where: { companyId: req.user!.companyId, module: 'EMPLOYEE' },
        orderBy: { displayOrder: 'asc' }
      });
    }

    res.status(200).json({ fields });
  } catch (error) {
    next(error);
  }
});

// Create Custom Field Definition
employeeRouter.post('/custom-fields/definitions', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      fieldLabel: z.string().min(2),
      fieldKey: z.string().min(2).regex(/^[a-zA-Z0-9_]+$/, 'Field key must be alphanumeric without spaces'),
      fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'EMAIL']),
      options: z.array(z.string()).optional(),
      isRequired: z.boolean().default(false),
      defaultValue: z.string().optional(),
      isVisible: z.boolean().default(true)
    });

    const parsed = schema.parse(req.body);
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { companyId: req.user!.companyId, module: 'EMPLOYEE', fieldKey: parsed.fieldKey }
    });
    if (existing) throw new AppError('Field key already exists in Column Manager', 400);

    const maxOrder = await prisma.customFieldDefinition.count({
      where: { companyId: req.user!.companyId, module: 'EMPLOYEE' }
    });

    const field = await prisma.customFieldDefinition.create({
      data: {
        companyId: req.user!.companyId,
        module: 'EMPLOYEE',
        fieldKey: parsed.fieldKey,
        fieldLabel: parsed.fieldLabel,
        fieldType: parsed.fieldType,
        optionsJson: parsed.options ? JSON.stringify(parsed.options) : null,
        isRequired: parsed.isRequired,
        defaultValue: parsed.defaultValue,
        isVisible: parsed.isVisible,
        displayOrder: maxOrder + 1
      }
    });

    res.status(201).json({ field });
  } catch (error) {
    next(error);
  }
});

// Toggle Visibility / Update Custom Field
employeeRouter.patch('/custom-fields/definitions/:id', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fieldId = req.params.id as string;
    const field = await prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(req.body.fieldLabel ? { fieldLabel: req.body.fieldLabel } : {}),
        ...(req.body.isVisible !== undefined ? { isVisible: Boolean(req.body.isVisible) } : {}),
        ...(req.body.isRequired !== undefined ? { isRequired: Boolean(req.body.isRequired) } : {}),
        ...(req.body.displayOrder !== undefined ? { displayOrder: Number(req.body.displayOrder) } : {})
      }
    });
    res.status(200).json({ field });
  } catch (error) {
    next(error);
  }
});

// Delete Custom Field
employeeRouter.delete('/custom-fields/definitions/:id', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fieldId = req.params.id as string;
    await prisma.customFieldDefinition.delete({ where: { id: fieldId } });
    res.status(200).json({ success: true, message: 'Custom column removed' });
  } catch (error) {
    next(error);
  }
});

// Get Values for Single Employee
employeeRouter.get('/:id/custom-fields', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const empId = req.params.id as string;
    const values = await prisma.employeeCustomFieldValue.findMany({
      where: { employeeId: empId },
      include: { fieldDefinition: true }
    });
    res.status(200).json({ values });
  } catch (error) {
    next(error);
  }
});

// Save Custom Field Values for Single Employee
employeeRouter.put('/:id/custom-fields', authenticate, requireRole(['company_admin', 'hr_manager', 'hr_executive']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const empId = req.params.id as string;
    const valuesInput: Array<{ fieldDefinitionId: string; value: string }> = req.body.values || [];
    for (const item of valuesInput) {
      await prisma.employeeCustomFieldValue.upsert({
        where: {
          employeeId_fieldDefinitionId: {
            employeeId: empId,
            fieldDefinitionId: item.fieldDefinitionId
          }
        },
        update: { fieldValue: item.value },
        create: {
          employeeId: empId,
          fieldDefinitionId: item.fieldDefinitionId,
          fieldValue: item.value
        }
      });
    }
    res.status(200).json({ message: 'Custom field values updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Bulk Import Employees with Row-level Validation & Commit
employeeRouter.post('/bulk-import', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows: any[] = req.body.rows || [];
    const commit: boolean = Boolean(req.body.commit);

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError('No import rows provided', 400);
    }

    const branches = await prisma.branch.findMany({ where: { companyId: req.user!.companyId } });
    const departments = await prisma.department.findMany({ where: { companyId: req.user!.companyId } });
    const designations = await prisma.designation.findMany({ where: { companyId: req.user!.companyId } });
    const existingEmployees = await prisma.employee.findMany({
      where: { companyId: req.user!.companyId },
      select: { employeeCode: true, workEmail: true }
    });

    const existingCodes = new Set(existingEmployees.map(e => e.employeeCode.toUpperCase()));
    const existingEmails = new Set(existingEmployees.map(e => e.workEmail.toLowerCase()));

    const results: any[] = [];
    const validRecordsToCreate: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];

      const code = String(row.employeeCode || '').trim();
      const firstName = String(row.firstName || '').trim();
      const lastName = String(row.lastName || '').trim();
      const email = String(row.workEmail || '').trim().toLowerCase();
      const branchName = String(row.branch || '').trim();
      const deptName = String(row.department || '').trim();
      const desigName = String(row.designation || '').trim();
      const joiningDateStr = String(row.dateOfJoining || '').trim();

      if (!code) errors.push('Employee Code is required');
      else if (existingCodes.has(code.toUpperCase())) errors.push(`Duplicate code: ${code} already exists`);

      if (!firstName) errors.push('First Name is required');
      if (!lastName) errors.push('Last Name is required');
      if (!email || !email.includes('@')) errors.push('Valid Work Email is required');
      else if (existingEmails.has(email)) errors.push(`Email: ${email} already registered`);

      const branch = branches.find(b => b.name.toLowerCase() === branchName.toLowerCase() || b.code.toLowerCase() === branchName.toLowerCase()) || branches[0];
      const department = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase() || d.code.toLowerCase() === deptName.toLowerCase()) || departments[0];
      const designation = designations.find(d => d.name.toLowerCase() === desigName.toLowerCase() || d.code.toLowerCase() === desigName.toLowerCase()) || designations[0];

      if (!branch) errors.push(`Invalid branch: ${branchName}`);
      if (!department) errors.push(`Invalid department: ${deptName}`);
      if (!designation) errors.push(`Invalid designation: ${desigName}`);

      let joiningDate = new Date(joiningDateStr);
      if (isNaN(joiningDate.getTime())) {
        joiningDate = new Date('2023-01-01');
      }

      if (errors.length === 0) {
        existingCodes.add(code.toUpperCase());
        existingEmails.add(email);
        validRecordsToCreate.push({
          companyId: req.user!.companyId,
          employeeCode: code,
          firstName,
          lastName,
          workEmail: email,
          branchId: branch.id,
          departmentId: department.id,
          designationId: designation.id,
          dateOfJoining: joiningDate,
          employmentType: 'PERMANENT',
          status: 'ACTIVE',
          workMode: 'OFFICE'
        });
      }

      results.push({
        rowNumber: i + 1,
        employeeCode: code,
        name: `${firstName} ${lastName}`.trim(),
        email,
        valid: errors.length === 0,
        errors
      });
    }

    if (commit && validRecordsToCreate.length > 0) {
      await prisma.$transaction(async tx => {
        for (const data of validRecordsToCreate) {
          await tx.employee.create({ data });
        }
      });
    }

    res.status(200).json({
      summary: {
        totalRows: rows.length,
        validRows: validRecordsToCreate.length,
        errorRows: rows.length - validRecordsToCreate.length,
        committed: commit && validRecordsToCreate.length > 0
      },
      results
    });
  } catch (error) {
    next(error);
  }
});

// Export Employees to CSV
employeeRouter.get('/export/csv', authenticate, requireRole(['company_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        branch: true,
        department: true,
        designation: true,
        salaryStructure: true
      },
      orderBy: { employeeCode: 'asc' }
    });

    const headers = [
      'EmployeeCode', 'FirstName', 'LastName', 'WorkEmail', 'Department',
      'Designation', 'Branch', 'JoiningDate', 'Status', 'AnnualCTC', 'MonthlyGross'
    ];

    const sanitizeCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = employees.map(emp => [
      sanitizeCell(emp.employeeCode),
      sanitizeCell(emp.firstName),
      sanitizeCell(emp.lastName),
      sanitizeCell(emp.workEmail),
      sanitizeCell(emp.department?.name),
      sanitizeCell(emp.designation?.name),
      sanitizeCell(emp.branch?.name),
      sanitizeCell(emp.dateOfJoining.toISOString().split('T')[0]),
      sanitizeCell(emp.status),
      Number(emp.salaryStructure?.annualCtc || 0).toFixed(2),
      Number(emp.salaryStructure?.monthlyGross || 0).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Employee_Master_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

// Update Employee Status (Deactivate / Reactivate)
employeeRouter.patch('/:id/status', authenticate, requireRole(['company_admin', 'hr_manager']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      status: z.enum(['ACTIVE', 'PROBATION', 'CONFIRMED', 'SUSPENDED', 'EXITED'])
    });
    const parsed = schema.parse(req.body);
    const empId = req.params.id as string;
    const employee = await prisma.employee.update({
      where: { id: empId },
      data: { status: parsed.status }
    });
    res.status(200).json({ employee, message: `Employee status updated to ${parsed.status}` });
  } catch (error) {
    next(error);
  }
});
