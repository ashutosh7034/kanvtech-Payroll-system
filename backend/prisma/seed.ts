import { PrismaClient, CadreType, EmploymentType, OuType, SalaryHeadType, CalculationType, TaxRegime, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Payroll Management System master data...');

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // 1. Roles
  const roles = [
    { code: 'payroll_admin', name: 'Payroll Administrator', description: 'Complete system administration and configuration' },
    { code: 'payroll_admin_view', name: 'Payroll Admin View', description: 'Read-only access to payroll data and reports' },
    { code: 'payroll_ou_admin', name: 'OU Payroll Administrator', description: 'Organizational unit scoped payroll administrator' },
    { code: 'payroll_pcm', name: 'Payroll Change Manager', description: 'Configures salary components and updates assignments' },
    { code: 'payroll_pda', name: 'Payroll Dealing Assistant', description: 'Generates individual and bulk payroll runs' },
    { code: 'payroll_pvo', name: 'Payroll Verifying Officer', description: 'Verifies generated payroll and validates exceptions' },
    { code: 'payroll_pfo', name: 'Payroll Finalizing Officer', description: 'Freezes calculation snapshots and finalizes payroll' },
    { code: 'payroll_ar_salary', name: 'Payroll Approving Officer', description: 'Approves finalized payroll runs for payment' },
    { code: 'payroll_incometax_admin', name: 'Income Tax Administrator', description: 'Manages tax slabs, rules, declarations and TDS' },
    { code: 'employee_self_service', name: 'Employee Self Service', description: 'Self-service access for payslips and declarations' },
    { code: 'platform_admin', name: 'Platform Administrator', description: 'Technical configuration and audit monitoring' }
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r
    });
  }
  console.log('✓ Roles seeded');

  // 2. Institution
  const institution = await prisma.institution.upsert({
    where: { code: 'NIHER' },
    update: {},
    create: {
      code: 'NIHER',
      name: 'National Institute of Higher Education & Research',
      brandName: 'NIHER Central Payroll',
      contactEmail: 'payroll@niher.edu.in',
      currency: 'INR',
      currencySymbol: '₹'
    }
  });

  // Settings
  const defaultSettings = [
    { key: 'mask_pan', value: 'true', description: 'Mask employee PAN on public views and payslips' },
    { key: 'mask_bank', value: 'true', description: 'Mask bank account number except last 4 digits' },
    { key: 'show_employer_contributions', value: 'true', description: 'Show employer NPS/EPF contributions on payslip' },
    { key: 'allow_self_approval', value: 'false', description: 'Strict separation of duties between generation and approval' },
    { key: 'currency_code', value: 'INR', description: 'Default currency symbol and code' }
  ];

  for (const s of defaultSettings) {
    await prisma.institutionSetting.upsert({
      where: { institutionId_key: { institutionId: institution.id, key: s.key } },
      update: { value: s.value },
      create: { institutionId: institution.id, key: s.key, value: s.value, description: s.description }
    });
  }

  // 3. Organizational Units
  const mainCampus = await prisma.organizationalUnit.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'MAIN_CAMPUS' } },
    update: {},
    create: {
      institutionId: institution.id,
      code: 'MAIN_CAMPUS',
      name: 'Main University Campus',
      type: OuType.CAMPUS
    }
  });

  const engFaculty = await prisma.organizationalUnit.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'FAC_ENG' } },
    update: {},
    create: {
      institutionId: institution.id,
      code: 'FAC_ENG',
      name: 'Faculty of Engineering & Technology',
      type: OuType.FACULTY,
      parentOuId: mainCampus.id
    }
  });

  const sciFaculty = await prisma.organizationalUnit.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'FAC_SCI' } },
    update: {},
    create: {
      institutionId: institution.id,
      code: 'FAC_SCI',
      name: 'Faculty of Sciences',
      type: OuType.FACULTY,
      parentOuId: mainCampus.id
    }
  });

  // 4. Departments
  const deptCse = await prisma.department.upsert({
    where: { ouId_code: { ouId: engFaculty.id, code: 'CSE' } },
    update: {},
    create: { ouId: engFaculty.id, code: 'CSE', name: 'Computer Science and Engineering' }
  });

  const deptMech = await prisma.department.upsert({
    where: { ouId_code: { ouId: engFaculty.id, code: 'MECH' } },
    update: {},
    create: { ouId: engFaculty.id, code: 'MECH', name: 'Mechanical Engineering' }
  });

  const deptPhysics = await prisma.department.upsert({
    where: { ouId_code: { ouId: sciFaculty.id, code: 'PHYSICS' } },
    update: {},
    create: { ouId: sciFaculty.id, code: 'PHYSICS', name: 'Department of Physics' }
  });

  const deptAdmin = await prisma.department.upsert({
    where: { ouId_code: { ouId: mainCampus.id, code: 'FINANCE' } },
    update: {},
    create: { ouId: mainCampus.id, code: 'FINANCE', name: 'Finance and Accounts Section' }
  });

  // 5. Designations
  const designations = [
    { code: 'PROF', name: 'Professor', cadre: CadreType.TEACHING },
    { code: 'ASSOC_PROF', name: 'Associate Professor', cadre: CadreType.TEACHING },
    { code: 'ASST_PROF', name: 'Assistant Professor', cadre: CadreType.TEACHING },
    { code: 'REGISTRAR', name: 'Registrar', cadre: CadreType.ADMINISTRATIVE },
    { code: 'FIN_OFFICER', name: 'Finance Officer', cadre: CadreType.ADMINISTRATIVE },
    { code: 'SEC_OFFICER', name: 'Section Officer', cadre: CadreType.ADMINISTRATIVE },
    { code: 'JR_ASST', name: 'Junior Assistant', cadre: CadreType.NON_TEACHING }
  ];

  const desigMap: Record<string, string> = {};
  for (const d of designations) {
    const record = await prisma.designation.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: d.code } },
      update: {},
      create: { institutionId: institution.id, code: d.code, name: d.name, cadre: d.cadre }
    });
    desigMap[d.code] = record.id;
  }

  // 6. Employee Groups
  const groupA = await prisma.employeeGroup.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'GRP_A' } },
    update: {},
    create: { institutionId: institution.id, code: 'GRP_A', name: 'Group A (Officers & Faculty)' }
  });

  const groupB = await prisma.employeeGroup.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'GRP_B' } },
    update: {},
    create: { institutionId: institution.id, code: 'GRP_B', name: 'Group B (Gazetted/Technical)' }
  });

  const groupC = await prisma.employeeGroup.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'GRP_C' } },
    update: {},
    create: { institutionId: institution.id, code: 'GRP_C', name: 'Group C (Administrative & Clerical)' }
  });

  // Managed Payroll Groups
  const payrollGroupTeaching = await prisma.managedPayrollGroup.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'REGULAR_TEACHING' } },
    update: {},
    create: { institutionId: institution.id, code: 'REGULAR_TEACHING', name: 'Regular Faculty Payroll', description: 'Faculty on 7th CPC academic pay scale' }
  });

  const payrollGroupStaff = await prisma.managedPayrollGroup.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'REGULAR_NON_TEACHING' } },
    update: {},
    create: { institutionId: institution.id, code: 'REGULAR_NON_TEACHING', name: 'Regular Administrative Staff', description: 'Staff on 7th CPC ministerial pay scale' }
  });

  // 7. Financial Years & Periods
  const fy2026 = await prisma.financialYear.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: '2026-2027' } },
    update: { active: true },
    create: {
      institutionId: institution.id,
      name: '2026-2027',
      startsOn: new Date('2026-04-01T00:00:00Z'),
      endsOn: new Date('2027-03-31T23:59:59Z'),
      active: true,
      isClosed: false
    }
  });

  const monthNames = [
    'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026',
    'October 2026', 'November 2026', 'December 2026', 'January 2027', 'February 2027', 'March 2027'
  ];

  const periodMap: Record<number, string> = {};
  for (let m = 0; m < 12; m++) {
    const pNum = m + 1;
    const year = m < 9 ? 2026 : 2027;
    const calMonth = (m + 3) % 12; // 3 = April, 11 = Dec, 0 = Jan, 2 = March
    const startDate = new Date(Date.UTC(year, calMonth, 1));
    const nextMonth = new Date(Date.UTC(year, calMonth + 1, 1));
    const endDate = new Date(nextMonth.getTime() - 1);
    const payDate = new Date(Date.UTC(year, calMonth + 1, 1)); // 1st of next month

    const period = await prisma.payrollPeriod.upsert({
      where: { financialYearId_periodNumber: { financialYearId: fy2026.id, periodNumber: pNum } },
      update: {},
      create: {
        financialYearId: fy2026.id,
        periodNumber: pNum,
        name: monthNames[m],
        startDate,
        endDate,
        payDate,
        status: m === 0 ? 'OPEN' : 'OPEN'
      }
    });
    periodMap[pNum] = period.id;
  }
  console.log('✓ Financial Year 2026-2027 and 12 periods seeded');

  // 8. 7th CPC Pay Levels and Pay Matrix Cells
  const payLevelConfigs = [
    { level: 4, name: 'Level 4 (GP 2400)', startAmount: 25500, count: 10, stepRate: 0.03 },
    { level: 7, name: 'Level 7 (GP 4600)', startAmount: 44900, count: 10, stepRate: 0.03 },
    { level: 10, name: 'Level 10 (Assistant Professor)', startAmount: 57700, count: 15, stepRate: 0.03 },
    { level: 11, name: 'Level 11 (Senior Asst Prof)', startAmount: 68900, count: 15, stepRate: 0.03 },
    { level: 12, name: 'Level 12 (Associate Professor)', startAmount: 79800, count: 15, stepRate: 0.03 },
    { level: 13, name: 'Level 13A (Professor)', startAmount: 131400, count: 15, stepRate: 0.03 },
    { level: 14, name: 'Level 14 (Senior Professor / Registrar)', startAmount: 144200, count: 15, stepRate: 0.03 }
  ];

  const payLevelMap: Record<number, string> = {};
  const firstCellMap: Record<number, string> = {};

  for (const pl of payLevelConfigs) {
    const levelRecord = await prisma.payLevel.upsert({
      where: { institutionId_levelNumber: { institutionId: institution.id, levelNumber: pl.level } },
      update: { name: pl.name },
      create: { institutionId: institution.id, levelNumber: pl.level, name: pl.name }
    });
    payLevelMap[pl.level] = levelRecord.id;

    let currentVal = pl.startAmount;
    for (let c = 1; c <= pl.count; c++) {
      const roundedAmount = Math.round(currentVal / 100) * 100;
      const cell = await prisma.payMatrixCell.upsert({
        where: { payLevelId_indexNumber: { payLevelId: levelRecord.id, indexNumber: c } },
        update: { basicAmount: roundedAmount },
        create: { payLevelId: levelRecord.id, indexNumber: c, basicAmount: roundedAmount }
      });
      if (c === 1) firstCellMap[pl.level] = cell.id;
      currentVal = currentVal * (1 + pl.stepRate);
    }
  }
  console.log('✓ 7th CPC Pay Levels & Pay Matrix cells seeded');

  // 9. Salary Heads
  const salaryHeadsData = [
    { code: 'BASIC', name: 'Basic Pay', type: SalaryHeadType.EARNING, calc: CalculationType.FIXED, isTaxable: true, isLeave: true },
    { code: 'DA', name: 'Dearness Allowance (50%)', type: SalaryHeadType.EARNING, calc: CalculationType.PERCENTAGE_OF_HEAD, isTaxable: true, isLeave: true, config: { baseHead: 'BASIC', percentage: 50.0 } },
    { code: 'HRA', name: 'House Rent Allowance (27% X-City)', type: SalaryHeadType.EARNING, calc: CalculationType.PERCENTAGE_OF_HEAD, isTaxable: true, isLeave: false, config: { baseHead: 'BASIC', percentage: 27.0 } },
    { code: 'TA', name: 'Transport Allowance', type: SalaryHeadType.EARNING, calc: CalculationType.FIXED, isTaxable: true, isLeave: false, config: { fixedAmount: 7200 } },
    { code: 'NPA', name: 'Non-Practicing Allowance', type: SalaryHeadType.EARNING, calc: CalculationType.FIXED, isTaxable: true, isLeave: true },
    { code: 'SPECIAL_PAY', name: 'Special Allowance', type: SalaryHeadType.EARNING, calc: CalculationType.FIXED, isTaxable: true, isLeave: false },
    { code: 'EPF', name: 'Employees Provident Fund', type: SalaryHeadType.DEDUCTION, calc: CalculationType.PERCENTAGE_OF_HEAD, isTaxable: false, isLeave: false, config: { baseHead: 'BASIC', percentage: 12.0 } },
    { code: 'GPF', name: 'General Provident Fund Subscription', type: SalaryHeadType.DEDUCTION, calc: CalculationType.FIXED, isTaxable: false, isLeave: false },
    { code: 'NPS_TIER1', name: 'NPS Employee Tier 1 (10% Basic+DA)', type: SalaryHeadType.DEDUCTION, calc: CalculationType.PERCENTAGE_OF_HEAD, isTaxable: false, isLeave: false, config: { baseHead: 'BASIC_PLUS_DA', percentage: 10.0 } },
    { code: 'TDS', name: 'Income Tax (TDS)', type: SalaryHeadType.DEDUCTION, calc: CalculationType.FIXED, isTaxable: false, isLeave: false },
    { code: 'PROF_TAX', name: 'Professional Tax', type: SalaryHeadType.DEDUCTION, calc: CalculationType.FIXED, isTaxable: false, isLeave: false, config: { fixedAmount: 200 } },
    { code: 'GIS', name: 'Group Insurance Scheme', type: SalaryHeadType.DEDUCTION, calc: CalculationType.FIXED, isTaxable: false, isLeave: false, config: { fixedAmount: 120 } },
    { code: 'HEALTH_SCHEME', name: 'Institutional Health Scheme', type: SalaryHeadType.DEDUCTION, calc: CalculationType.FIXED, isTaxable: false, isLeave: false, config: { fixedAmount: 500 } },
    { code: 'NPS_EMPLOYER', name: 'Employer NPS Contribution (14% Basic+DA)', type: SalaryHeadType.EMPLOYER_CONTRIBUTION, calc: CalculationType.PERCENTAGE_OF_HEAD, isTaxable: false, isLeave: false, config: { baseHead: 'BASIC_PLUS_DA', percentage: 14.0 } }
  ];

  const headMap: Record<string, string> = {};
  for (const h of salaryHeadsData) {
    const head = await prisma.salaryHead.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: h.code } },
      update: { name: h.name, type: h.type, calculationType: h.calc, isTaxable: h.isTaxable, formulaConfig: h.config ?? {} },
      create: {
        institutionId: institution.id,
        code: h.code,
        name: h.name,
        type: h.type,
        calculationType: h.calc,
        isTaxable: h.isTaxable,
        isLeaveImpacted: h.isLeave,
        formulaConfig: h.config ?? {}
      }
    });
    headMap[h.code] = head.id;
  }
  console.log('✓ Salary Heads seeded');

  // 10. Salary Structures
  const structureTeaching = await prisma.salaryStructure.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: '7CPC_ACADEMIC_STANDARD' } },
    update: {},
    create: {
      institutionId: institution.id,
      code: '7CPC_ACADEMIC_STANDARD',
      name: '7th CPC Academic Structure (Permanent)',
      employmentType: EmploymentType.PERMANENT
    }
  });

  const teachingLines = [
    { headCode: 'BASIC', calc: CalculationType.FIXED, order: 1 },
    { headCode: 'DA', calc: CalculationType.PERCENTAGE_OF_HEAD, base: 'BASIC', pct: 50.0, order: 2 },
    { headCode: 'HRA', calc: CalculationType.PERCENTAGE_OF_HEAD, base: 'BASIC', pct: 27.0, order: 3 },
    { headCode: 'TA', calc: CalculationType.FIXED, amount: 7200, order: 4 },
    { headCode: 'NPS_TIER1', calc: CalculationType.PERCENTAGE_OF_HEAD, base: 'BASIC_PLUS_DA', pct: 10.0, order: 5 },
    { headCode: 'TDS', calc: CalculationType.FIXED, order: 6 },
    { headCode: 'PROF_TAX', calc: CalculationType.FIXED, amount: 200, order: 7 },
    { headCode: 'GIS', calc: CalculationType.FIXED, amount: 120, order: 8 },
    { headCode: 'HEALTH_SCHEME', calc: CalculationType.FIXED, amount: 500, order: 9 },
    { headCode: 'NPS_EMPLOYER', calc: CalculationType.PERCENTAGE_OF_HEAD, base: 'BASIC_PLUS_DA', pct: 14.0, order: 10 }
  ];

  for (const l of teachingLines) {
    await prisma.salaryStructureLine.upsert({
      where: { structureId_salaryHeadId: { structureId: structureTeaching.id, salaryHeadId: headMap[l.headCode] } },
      update: { percentage: l.pct, fixedAmount: l.amount, displayOrder: l.order },
      create: {
        structureId: structureTeaching.id,
        salaryHeadId: headMap[l.headCode],
        calculationType: l.calc,
        baseHeadCode: l.base,
        percentage: l.pct,
        fixedAmount: l.amount,
        displayOrder: l.order
      }
    });
  }

  // 11. Tax Sections
  const taxSections = [
    { sectionCode: '80C', name: 'Life Insurance, PF, PPF, Tuition Fees', maxLimit: 150000, regimeAllowed: TaxRegime.OLD },
    { sectionCode: '80D', name: 'Health Insurance Premium', maxLimit: 25000, regimeAllowed: TaxRegime.OLD },
    { sectionCode: '24B', name: 'Interest on Housing Loan', maxLimit: 200000, regimeAllowed: TaxRegime.OLD },
    { sectionCode: '80CCD_1B', name: 'Additional NPS Contribution', maxLimit: 50000, regimeAllowed: TaxRegime.OLD },
    { sectionCode: 'STD_DEDUCTION', name: 'Standard Deduction (Salaried)', maxLimit: 75000, regimeAllowed: TaxRegime.NEW }
  ];

  for (const ts of taxSections) {
    await prisma.taxSection.upsert({
      where: { sectionCode: ts.sectionCode },
      update: { name: ts.name, maxLimit: ts.maxLimit, regimeAllowed: ts.regimeAllowed },
      create: ts
    });
  }

  // 12. Leave Types
  const leaveTypes = [
    { code: 'CL', name: 'Casual Leave', isPaid: true, ratio: 0.0 },
    { code: 'EL', name: 'Earned Leave', isPaid: true, ratio: 0.0 },
    { code: 'HPL', name: 'Half Pay Leave', isPaid: true, ratio: 0.5 },
    { code: 'EOL', name: 'Extraordinary Leave (Without Pay)', isPaid: false, ratio: 1.0 }
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: lt.code } },
      update: { isPaid: lt.isPaid, deductionRatio: lt.ratio },
      create: { institutionId: institution.id, code: lt.code, name: lt.name, isPaid: lt.isPaid, deductionRatio: lt.ratio }
    });
  }

  // 13. Loan Types
  const loanTypes = [
    { code: 'COMP_ADV', name: 'Computer Advance', maxAmount: 50000, rate: 5.0, installments: 24 },
    { code: 'FEST_ADV', name: 'Festival Advance', maxAmount: 10000, rate: 0.0, installments: 10 },
    { code: 'HBA', name: 'House Building Advance', maxAmount: 2500000, rate: 7.5, installments: 180 }
  ];

  for (const lt of loanTypes) {
    await prisma.loanType.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: lt.code } },
      update: {},
      create: {
        institutionId: institution.id,
        code: lt.code,
        name: lt.name,
        maxAmount: lt.maxAmount,
        interestRate: lt.rate,
        maxInstallments: lt.installments
      }
    });
  }

  // 14. GPF Interest Rate
  await prisma.gpfInterestRate.upsert({
    where: {
      institutionId_financialYearId_effectiveFrom: {
        institutionId: institution.id,
        financialYearId: fy2026.id,
        effectiveFrom: new Date('2026-04-01T00:00:00Z')
      }
    },
    update: { ratePercentage: 7.1 },
    create: {
      institutionId: institution.id,
      financialYearId: fy2026.id,
      ratePercentage: 7.1,
      effectiveFrom: new Date('2026-04-01T00:00:00Z'),
      effectiveTo: new Date('2027-03-31T23:59:59Z'),
      isApproved: true
    }
  });

  // 15. Other Payment Types
  const otherTypes = [
    { code: 'CEA', name: 'Children Education Allowance', isTaxable: true },
    { code: 'HONORARIUM', name: 'Examination & Evaluation Honorarium', isTaxable: true },
    { code: 'RESEARCH_INCENTIVE', name: 'Research Excellence Incentive', isTaxable: true },
    { code: 'BONUS', name: 'Non-Productivity Linked Bonus', isTaxable: true }
  ];

  for (const ot of otherTypes) {
    await prisma.otherPaymentType.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: ot.code } },
      update: {},
      create: { institutionId: institution.id, code: ot.code, name: ot.name, isTaxable: ot.isTaxable }
    });
  }

  // 16. Sample Seed Employees
  const employeesData = [
    {
      code: 'EMP-1001',
      firstName: 'Dr. Vikram',
      middleName: 'Prasad',
      lastName: 'Sharma',
      gender: 'Male',
      dob: new Date('1978-06-15'),
      doj: new Date('2012-08-01'),
      email: 'vikram.sharma@niher.edu.in',
      phone: '9876543210',
      pan: 'ABCPS1234F',
      maskedPan: 'ABCXXXXX4F',
      cityCategory: 'X',
      desigCode: 'PROF',
      deptId: deptCse.id,
      ouId: engFaculty.id,
      level: 13,
      basic: 131400,
      bank: { bankName: 'State Bank of India', account: '30012345678', ifsc: 'SBIN0001234' },
      gpfAccount: 'GPF-CSE-1001',
      gpfOpening: 450000,
      roleCode: 'employee_self_service',
      username: 'vikram.sharma'
    },
    {
      code: 'EMP-1002',
      firstName: 'Dr. Ananya',
      middleName: null,
      lastName: 'Iyer',
      gender: 'Female',
      dob: new Date('1985-03-22'),
      doj: new Date('2016-11-15'),
      email: 'ananya.iyer@niher.edu.in',
      phone: '9876543211',
      pan: 'ABCPY5678K',
      maskedPan: 'ABCXXXXX8K',
      cityCategory: 'X',
      desigCode: 'ASSOC_PROF',
      deptId: deptPhysics.id,
      ouId: sciFaculty.id,
      level: 12,
      basic: 79800,
      bank: { bankName: 'Punjab National Bank', account: '10098765432', ifsc: 'PUNB0005678' },
      gpfAccount: 'GPF-PHY-1002',
      gpfOpening: 220000,
      roleCode: 'employee_self_service',
      username: 'ananya.iyer'
    },
    {
      code: 'EMP-1003',
      firstName: 'Rajesh',
      middleName: 'Kumar',
      lastName: 'Verma',
      gender: 'Male',
      dob: new Date('1982-10-10'),
      doj: new Date('2014-04-01'),
      email: 'rajesh.verma@niher.edu.in',
      phone: '9876543212',
      pan: 'ABCPV9012L',
      maskedPan: 'ABCXXXXX2L',
      cityCategory: 'X',
      desigCode: 'SEC_OFFICER',
      deptId: deptAdmin.id,
      ouId: mainCampus.id,
      level: 7,
      basic: 44900,
      bank: { bankName: 'Canara Bank', account: '20055443322', ifsc: 'CNRB0001122' },
      gpfAccount: 'GPF-ADM-1003',
      gpfOpening: 180000,
      roleCode: 'payroll_pda',
      username: 'pda_officer'
    },
    {
      code: 'EMP-1004',
      firstName: 'Suresh',
      middleName: 'Chandra',
      lastName: 'Patel',
      gender: 'Male',
      dob: new Date('1975-12-05'),
      doj: new Date('2005-01-10'),
      email: 'suresh.patel@niher.edu.in',
      phone: '9876543213',
      pan: 'ABCPP3456M',
      maskedPan: 'ABCXXXXX6M',
      cityCategory: 'X',
      desigCode: 'FIN_OFFICER',
      deptId: deptAdmin.id,
      ouId: mainCampus.id,
      level: 14,
      basic: 144200,
      bank: { bankName: 'State Bank of India', account: '30099887766', ifsc: 'SBIN0001234' },
      gpfAccount: 'GPF-ADM-1004',
      gpfOpening: 950000,
      roleCode: 'payroll_pfo',
      username: 'pfo_officer'
    }
  ];

  for (const emp of employeesData) {
    const employee = await prisma.employee.upsert({
      where: { institutionId_employeeCode: { institutionId: institution.id, employeeCode: emp.code } },
      update: { basicPay: undefined },
      create: {
        institutionId: institution.id,
        ouId: emp.ouId,
        departmentId: emp.deptId,
        designationId: desigMap[emp.desigCode],
        employeeGroupId: emp.level >= 10 ? groupA.id : groupB.id,
        managedPayrollGroupId: emp.level >= 10 ? payrollGroupTeaching.id : payrollGroupStaff.id,
        employeeCode: emp.code,
        firstName: emp.firstName,
        middleName: emp.middleName,
        lastName: emp.lastName,
        gender: emp.gender,
        dateOfBirth: emp.dob,
        dateOfJoining: emp.doj,
        email: emp.email,
        phone: emp.phone,
        pan: emp.pan,
        maskedPan: emp.maskedPan,
        aadhaarLast4: '4321',
        cityCategory: emp.cityCategory
      }
    });

    // Bank
    await prisma.employeeBankAccount.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeBankAccount.create({
      data: {
        employeeId: employee.id,
        bankName: emp.bank.bankName,
        accountNumber: emp.bank.account,
        maskedAccount: 'XXXXXX' + emp.bank.account.slice(-4),
        ifscCode: emp.bank.ifsc,
        paymentMode: PaymentMethod.NEFT,
        isPrimary: true
      }
    });

    // Salary assignment
    await prisma.employeeSalaryAssignment.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeSalaryAssignment.create({
      data: {
        employeeId: employee.id,
        structureId: structureTeaching.id,
        payLevelId: payLevelMap[emp.level],
        payMatrixCellId: firstCellMap[emp.level],
        basicPay: emp.basic,
        effectiveFrom: new Date('2026-04-01T00:00:00Z'),
        active: true
      }
    });

    // Tax profile
    await prisma.employeeTaxProfile.upsert({
      where: { employeeId_financialYearId: { employeeId: employee.id, financialYearId: fy2026.id } },
      update: {},
      create: {
        employeeId: employee.id,
        financialYearId: fy2026.id,
        regime: TaxRegime.NEW,
        active: true
      }
    });

    // GPF account
    await prisma.gpfAccount.upsert({
      where: { accountNumber: emp.gpfAccount },
      update: {},
      create: {
        employeeId: employee.id,
        accountNumber: emp.gpfAccount,
        openingBalance: emp.gpfOpening,
        openingBalanceDate: new Date('2026-04-01T00:00:00Z'),
        currentBalance: emp.gpfOpening
      }
    });

    // User account
    const user = await prisma.user.upsert({
      where: { username: emp.username },
      update: { employeeId: employee.id },
      create: {
        institutionId: institution.id,
        employeeId: employee.id,
        username: emp.username,
        email: emp.email,
        passwordHash,
        fullName: `${emp.firstName} ${emp.lastName}`
      }
    });

    const role = await prisma.role.findUnique({ where: { code: emp.roleCode } });
    if (role) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id }
      });
    }
  }

  // 17. Seed dedicated system administration and workflow users
  const systemUsers = [
    { username: 'admin', email: 'admin@niher.edu.in', fullName: 'Chief Payroll Administrator', role: 'payroll_admin' },
    { username: 'pvo_officer', email: 'pvo@niher.edu.in', fullName: 'Payroll Verifying Officer', role: 'payroll_pvo' },
    { username: 'ar_salary', email: 'approver@niher.edu.in', fullName: 'Assistant Registrar (Salary Approver)', role: 'payroll_ar_salary' },
    { username: 'tax_admin', email: 'tax@niher.edu.in', fullName: 'Income Tax Administrator', role: 'payroll_incometax_admin' },
    { username: 'ou_admin', email: 'ouadmin@niher.edu.in', fullName: 'Engineering Faculty Payroll Officer', role: 'payroll_ou_admin', ouId: engFaculty.id }
  ];

  for (const su of systemUsers) {
    const user = await prisma.user.upsert({
      where: { username: su.username },
      update: { passwordHash },
      create: {
        institutionId: institution.id,
        username: su.username,
        email: su.email,
        passwordHash,
        fullName: su.fullName
      }
    });

    const role = await prisma.role.findUnique({ where: { code: su.role } });
    if (role) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          ouId: su.ouId ?? null
        }
      });
    }
  }

  console.log('✓ System administrative and workflow users seeded with password "Admin@123"');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
