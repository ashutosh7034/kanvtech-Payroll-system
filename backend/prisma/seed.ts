import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🌱 Starting Corporate HRMS & Payroll database seed [Environment: ${env}]...`);

  if (env === 'production') {
    console.log('🔒 Production Mode: Only initializing master reference entities and administrative access.');
    console.log('🔒 Production Safety: Destructive resets, mock employee fixtures, fake attendance, and demo runs are strictly prohibited.');
  }

  const defaultPasswordHash = await bcrypt.hash('Admin@123', 10);

  // 1. Roles
  const roleNames = [
    'platform_admin',
    'company_admin',
    'hr_manager',
    'hr_executive',
    'payroll_admin',
    'payroll_processor',
    'finance_admin',
    'department_manager',
    'employee',
    'recruiter',
    'asset_manager',
    'security_desk'
  ];

  const roleMap = new Map<string, string>();
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `Corporate role for ${name.replace('_', ' ')}` }
    });
    roleMap.set(name, role.id);
  }

  // 2. Company / Legal Entity
  const company = await prisma.company.upsert({
    where: { code: 'APEX' },
    update: {},
    create: {
      code: 'APEX',
      name: 'Apex Global Technologies Pvt. Ltd.',
      brandName: 'Apex Global',
      legalName: 'Apex Global Technologies Private Limited',
      cinNumber: 'U72200MH2015PTC268491',
      gstin: '27AABCA1234F1Z8',
      panNumber: 'AABCA1234F',
      tanNumber: 'MUMA12345F',
      pfEstablishmentCode: 'MH/BAN/0045892/000',
      esicCode: '31000458920000101',
      ptrcNumber: '27654321098P',
      contactEmail: 'contact@apexglobal.tech',
      contactPhone: '+91 22 6123 4567',
      website: 'https://apexglobal.tech',
      currency: 'INR',
      active: true
    }
  });

  const existingBranches = await prisma.branch.count({ where: { companyId: company.id } });
  if (existingBranches > 0) {
    if (env === 'production') {
      console.log('🔒 Production Safety Mode: Master data and company entities already exist. No destructive actions taken.');
    } else {
      console.log('ℹ️ Database already contains seeded master data. Preserving existing records without duplicate insertions.');
    }
    return;
  }

  // 3. Branches
  const bHeadquarters = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: 'MUM-HQ',
      name: 'Mumbai Headquarters',
      state: 'Maharashtra',
      city: 'Mumbai',
      address: 'Level 14, Platina Tower, Bandra Kurla Complex',
      pinCode: '400051',
      isHeadquarters: true
    }
  });

  const bBengaluru = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: 'BLR-TECH',
      name: 'Bengaluru Tech Center',
      state: 'Karnataka',
      city: 'Bengaluru',
      address: 'Tower B, RMZ Ecoworld, Outer Ring Road',
      pinCode: '560103',
      isHeadquarters: false
    }
  });

  const bPune = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: 'PUN-DEL',
      name: 'Pune Delivery Center',
      state: 'Maharashtra',
      city: 'Pune',
      address: 'Quadron Business Park, Hinjawadi Phase 2',
      pinCode: '411057',
      isHeadquarters: false
    }
  });

  // 4. Departments
  const deptEng = await prisma.department.create({
    data: { companyId: company.id, code: 'ENG', name: 'Software Engineering' }
  });
  const deptPrd = await prisma.department.create({
    data: { companyId: company.id, code: 'PRD', name: 'Product & Design' }
  });
  const deptHr = await prisma.department.create({
    data: { companyId: company.id, code: 'HR', name: 'People & Culture (HR)' }
  });
  const deptFin = await prisma.department.create({
    data: { companyId: company.id, code: 'FIN', name: 'Finance & Accounts' }
  });

  // 5. Designations
  const desVp = await prisma.designation.create({
    data: { companyId: company.id, code: 'VPE', name: 'Vice President of Engineering' }
  });
  const desLeadDes = await prisma.designation.create({
    data: { companyId: company.id, code: 'LPD', name: 'Lead Product Designer' }
  });
  const desSrEng = await prisma.designation.create({
    data: { companyId: company.id, code: 'SSE', name: 'Senior Software Engineer' }
  });
  const desHrMgr = await prisma.designation.create({
    data: { companyId: company.id, code: 'HRM', name: 'Senior HR Manager' }
  });
  const desFinMgr = await prisma.designation.create({
    data: { companyId: company.id, code: 'FM', name: 'Finance Controller' }
  });

  // 6. Job Bands
  const bandL1 = await prisma.jobBand.create({
    data: { companyId: company.id, code: 'L1', name: 'Associate Level', minCtc: 400000, maxCtc: 800000 }
  });
  const bandL2 = await prisma.jobBand.create({
    data: { companyId: company.id, code: 'L2', name: 'Senior Specialist', minCtc: 800000, maxCtc: 1600000 }
  });
  const bandL3 = await prisma.jobBand.create({
    data: { companyId: company.id, code: 'L3', name: 'Principal / Lead', minCtc: 1600000, maxCtc: 3000000 }
  });
  const bandL4 = await prisma.jobBand.create({
    data: { companyId: company.id, code: 'L4', name: 'Director / VP', minCtc: 3000000, maxCtc: 6500000 }
  });

  // 7. Cost Centers
  const ccRnd = await prisma.costCenter.create({
    data: { companyId: company.id, code: 'CC-RND', name: 'R&D Product Engineering' }
  });
  const ccGna = await prisma.costCenter.create({
    data: { companyId: company.id, code: 'CC-GNA', name: 'General & Administrative' }
  });

  // 7b. Units, Categories, Projects, Job Positions
  await prisma.orgUnit.createMany({
    data: [
      { companyId: company.id, branchId: bHeadquarters.id, code: 'UNIT-CORP-1', name: 'Corporate Unit 1', description: 'Central Executive & Corporate Operations Unit' },
      { companyId: company.id, branchId: bBengaluru.id, code: 'UNIT-MFG-2', name: 'Manufacturing Unit 2', description: 'Industrial & Manufacturing Plant Operations' },
      { companyId: company.id, branchId: bPune.id, code: 'UNIT-RD-LAB', name: 'R&D Lab', description: 'Advanced Research, AI & Prototyping Laboratory' }
    ],
    skipDuplicates: true
  });

  await prisma.employmentCategory.createMany({
    data: [
      { companyId: company.id, code: 'CAT-PERM', name: 'Permanent Staff', description: 'Regular Full-time Employees with standard benefits' },
      { companyId: company.id, code: 'CAT-EXEC', name: 'Executive Officer', description: 'Senior Corporate Executives and C-Suite Leadership' },
      { companyId: company.id, code: 'CAT-CONT', name: 'Contractual Specialist', description: 'Fixed-term contract specialists and technical consultants' }
    ],
    skipDuplicates: true
  });

  await prisma.project.createMany({
    data: [
      { companyId: company.id, code: 'PRJ-OPS', name: 'Internal Operations', clientName: 'Apex Internal', status: 'ACTIVE' },
      { companyId: company.id, code: 'PRJ-ENG', name: 'Product Engineering', clientName: 'Platform Products', status: 'ACTIVE' },
      { companyId: company.id, code: 'PRJ-CS', name: 'Client Services', clientName: 'Enterprise Client Advisory', status: 'ACTIVE' }
    ],
    skipDuplicates: true
  });

  await prisma.jobPosition.createMany({
    data: [
      { companyId: company.id, departmentId: deptEng.id, designationId: desSrEng.id, gradeId: bandL2.id, code: 'SE-2026', title: 'Senior Software Engineer (2026)', description: 'Lead enterprise payroll application backend & cloud engineering' },
      { companyId: company.id, departmentId: deptPrd.id, designationId: desLeadDes.id, gradeId: bandL3.id, code: 'PM-2026', title: 'Product Manager (2026)', description: 'Core HRMS & statutory compliance product manager' },
      { companyId: company.id, departmentId: deptEng.id, designationId: desSrEng.id, gradeId: bandL2.id, code: 'QA-2026', title: 'QA Automation Lead (2026)', description: 'End-to-end regression testing and test infrastructure lead' }
    ],
    skipDuplicates: true
  });

  // 8. Statutory Configuration & PT Slabs
  await prisma.statutoryConfig.create({
    data: {
      companyId: company.id,
      pfWageCeiling: 15000,
      pfEmployeePct: 12.0,
      pfEmployerEpfsPct: 3.67,
      pfEmployerEpsPct: 8.33,
      esicWageCeiling: 21000,
      esicEmployeePct: 0.75,
      esicEmployerPct: 3.25,
      gratuityPct: 4.81
    }
  });

  // Maharashtra PT Slabs
  await prisma.professionalTaxSlab.createMany({
    data: [
      { state: 'Maharashtra', minSalary: 0, maxSalary: 7500, monthlyAmount: 0 },
      { state: 'Maharashtra', minSalary: 7501, maxSalary: 10000, monthlyAmount: 175 },
      { state: 'Maharashtra', minSalary: 10001, maxSalary: null, monthlyAmount: 200, februaryAmount: 300 },
      { state: 'Karnataka', minSalary: 0, maxSalary: 24999, monthlyAmount: 0 },
      { state: 'Karnataka', minSalary: 25000, maxSalary: null, monthlyAmount: 200 }
    ]
  });

  // 9. Salary Components
  const cBasic = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'BASIC', name: 'Basic Salary', type: 'EARNING', category: 'FIXED_EARNING', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'CTC', percentageValue: 40.0, isTaxable: true, isPfGross: true, isEsicGross: true, isPtGross: true, displayOrder: 1 }
  });
  const cHra = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'EARNING', category: 'FIXED_EARNING', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'BASIC', percentageValue: 50.0, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 2 }
  });
  const cSpl = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', type: 'EARNING', category: 'FIXED_EARNING', calculationMode: 'FIXED_AMOUNT', isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 3 }
  });
  const cConv = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'CONVEYANCE', name: 'Conveyance Allowance', type: 'EARNING', category: 'FIXED_EARNING', calculationMode: 'FIXED_AMOUNT', fixedAmount: 5000, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 4 }
  });
  const cMed = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'MEDICAL', name: 'Medical Allowance', type: 'EARNING', category: 'FIXED_EARNING', calculationMode: 'FIXED_AMOUNT', fixedAmount: 5000, isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 5 }
  });
  const cVar = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'VARIABLE_PAY', name: 'Performance Bonus', type: 'EARNING', category: 'VARIABLE_EARNING', calculationMode: 'FIXED_AMOUNT', isTaxable: true, isPfGross: false, isEsicGross: true, isPtGross: true, displayOrder: 6 }
  });

  // Deductions
  const cPfEmp = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'EPF_EMPLOYEE', name: 'Employee Provident Fund (12%)', type: 'DEDUCTION', category: 'STATUTORY_DEDUCTION', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'BASIC', percentageValue: 12.0, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 10 }
  });
  const cEsiEmp = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'ESIC_EMPLOYEE', name: 'Employee ESIC (0.75%)', type: 'DEDUCTION', category: 'STATUTORY_DEDUCTION', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'GROSS', percentageValue: 0.75, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 11 }
  });
  const cPt = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'PROFESSIONAL_TAX', name: 'Professional Tax', type: 'DEDUCTION', category: 'STATUTORY_DEDUCTION', calculationMode: 'FIXED_AMOUNT', isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 12 }
  });
  const cTds = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'TDS', name: 'Income Tax (TDS)', type: 'DEDUCTION', category: 'STATUTORY_DEDUCTION', calculationMode: 'FIXED_AMOUNT', isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 13 }
  });

  // Employer Statutory
  const cPfEmpr = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'EPF_EMPLOYER', name: 'Employer PF Contribution (12%)', type: 'EMPLOYER_STATUTORY', category: 'EMPLOYER_CONTRIBUTION', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'BASIC', percentageValue: 12.0, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 20 }
  });
  const cEsiEmpr = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'ESIC_EMPLOYER', name: 'Employer ESIC (3.25%)', type: 'EMPLOYER_STATUTORY', category: 'EMPLOYER_CONTRIBUTION', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'GROSS', percentageValue: 3.25, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 21 }
  });
  const cGrat = await prisma.salaryComponent.create({
    data: { companyId: company.id, code: 'GRATUITY', name: 'Gratuity Provision (4.81%)', type: 'EMPLOYER_STATUTORY', category: 'EMPLOYER_CONTRIBUTION', calculationMode: 'PERCENTAGE_OF_COMPONENT', baseComponentCode: 'BASIC', percentageValue: 4.81, isTaxable: false, isPfGross: false, isEsicGross: false, isPtGross: false, displayOrder: 22 }
  });

  // Salary Structure Templates
  const templateStandard = await prisma.salaryTemplate.create({
    data: {
      companyId: company.id,
      code: 'TECH-STD-L2',
      name: 'Engineering Professional Standard Band',
      description: 'Standard salary structure for Tech Center software engineers with PF and statutory allowances',
      version: 1,
      isDefault: true,
      lines: {
        create: [
          { componentId: cBasic.id, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageOfBasic: 40.0, percentageValue: 40.0, displayOrder: 1 },
          { componentId: cHra.id, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageOfBasic: 50.0, percentageValue: 50.0, baseComponentCode: 'BASIC', displayOrder: 2 },
          { componentId: cConv.id, calculationMode: 'FIXED_AMOUNT', fixedAmount: 5000, displayOrder: 3 },
          { componentId: cMed.id, calculationMode: 'FIXED_AMOUNT', fixedAmount: 5000, displayOrder: 4 },
          { componentId: cSpl.id, calculationMode: 'FIXED_AMOUNT', displayOrder: 5 },
          { componentId: cPfEmp.id, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageValue: 12.0, baseComponentCode: 'BASIC', displayOrder: 10 },
          { componentId: cPt.id, calculationMode: 'FIXED_AMOUNT', displayOrder: 11 },
          { componentId: cTds.id, calculationMode: 'FIXED_AMOUNT', displayOrder: 12 },
          { componentId: cPfEmpr.id, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageValue: 12.0, baseComponentCode: 'BASIC', displayOrder: 20 },
          { componentId: cGrat.id, calculationMode: 'PERCENTAGE_OF_COMPONENT', percentageValue: 4.81, baseComponentCode: 'BASIC', displayOrder: 21 }
        ]
      }
    }
  });

  // 10. Shift Policies
  const shiftGeneral = await prisma.shiftPolicy.create({
    data: {
      companyId: company.id,
      code: 'GS-0930',
      name: 'General Corporate Shift (09:30 - 18:30)',
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
      halfDayMinutes: 240,
      fullDayMinutes: 480
    }
  });

  // 11. Leave Policies
  const lCl = await prisma.leavePolicy.create({
    data: { companyId: company.id, code: 'CL', name: 'Casual Leave', annualQuota: 12, isPaid: true, maxCarryForward: 0, encashable: false }
  });
  const lSl = await prisma.leavePolicy.create({
    data: { companyId: company.id, code: 'SL', name: 'Sick Leave', annualQuota: 12, isPaid: true, maxCarryForward: 6, encashable: false }
  });
  const lPl = await prisma.leavePolicy.create({
    data: { companyId: company.id, code: 'PL', name: 'Privilege Leave', annualQuota: 18, isPaid: true, maxCarryForward: 30, encashable: true }
  });
  const lComp = await prisma.leavePolicy.create({
    data: { companyId: company.id, code: 'COMP_OFF', name: 'Compensatory Off', annualQuota: 5, isPaid: true, maxCarryForward: 0, encashable: false }
  });

  if (env === 'production') {
    console.log('🔒 Production Mode: Creating essential payroll periods and administrative users...');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(2026, m, 1));
      const end = new Date(Date.UTC(2026, m + 1, 0));
      const cutoff = new Date(Date.UTC(2026, m, 25));

      await prisma.payrollPeriod.upsert({
        where: {
          companyId_month_year: {
            companyId: company.id,
            month: m + 1,
            year: 2026
          }
        },
        update: {},
        create: {
          companyId: company.id,
          periodNumber: m + 1,
          name: `${monthNames[m]} 2026`,
          month: m + 1,
          year: 2026,
          startDate: start,
          endDate: end,
          cutoffDate: cutoff,
          isLocked: m < 9
        }
      });
    }

    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        companyId: company.id,
        username: 'admin',
        email: 'admin@apexglobal.tech',
        passwordHash: defaultPasswordHash,
        fullName: 'System Administrator',
        userRoles: {
          create: [
            { roleId: roleMap.get('company_admin')! },
            { roleId: roleMap.get('platform_admin')! }
          ]
        }
      }
    });

    console.log('✅ Production base master setup completed successfully. Zero mock records created.');
    return;
  }

  // 12. Corporate Employees (Development & Test Fixtures)
  // Employee 1: Rohit Sharma (VP Engineering, Manager)
  const empRohit = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: bHeadquarters.id,
      departmentId: deptEng.id,
      designationId: desVp.id,
      jobBandId: bandL4.id,
      costCenterId: ccRnd.id,
      employeeCode: 'APEX-1001',
      firstName: 'Rohit',
      lastName: 'Sharma',
      workEmail: 'rohit.sharma@apexglobal.tech',
      personalEmail: 'rohit.sharma.personal@gmail.com',
      phone: '+91 98200 12345',
      dateOfBirth: new Date('1985-06-15'),
      gender: 'MALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'HYBRID',
      dateOfJoining: new Date('2021-04-01'),
      confirmationDate: new Date('2021-07-01'),
      probationDays: 90,
      panNumber: 'ABCPS1234F',
      uanNumber: '100904589211',
      pfNumber: 'MH/BAN/0045892/000/1001',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50100234567890',
      ifscCode: 'HDFC0000123',
      bankBranch: 'BKC Branch'
    }
  });

  // Employee 2: Ananya Verma (Lead Product Designer)
  const empAnanya = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: bHeadquarters.id,
      departmentId: deptPrd.id,
      designationId: desLeadDes.id,
      jobBandId: bandL3.id,
      costCenterId: ccRnd.id,
      managerId: empRohit.id,
      employeeCode: 'APEX-1002',
      firstName: 'Ananya',
      lastName: 'Verma',
      workEmail: 'ananya.verma@apexglobal.tech',
      personalEmail: 'ananya.design@gmail.com',
      phone: '+91 98201 23456',
      dateOfBirth: new Date('1991-09-22'),
      gender: 'FEMALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'HYBRID',
      dateOfJoining: new Date('2022-06-15'),
      confirmationDate: new Date('2022-09-15'),
      probationDays: 90,
      panNumber: 'ABCPV5678K',
      uanNumber: '100904589212',
      pfNumber: 'MH/BAN/0045892/000/1002',
      bankName: 'ICICI Bank',
      bankAccountNumber: '001101567890',
      ifscCode: 'ICIC0000011',
      bankBranch: 'Bandra West Branch'
    }
  });

  // Employee 3: Rahul Mehta (Senior Software Engineer)
  const empRahul = await prisma.employee.create({
    data: {
      companyId: company.id,
      branchId: bBengaluru.id,
      departmentId: deptEng.id,
      designationId: desSrEng.id,
      jobBandId: bandL2.id,
      costCenterId: ccRnd.id,
      managerId: empRohit.id,
      employeeCode: 'APEX-1003',
      firstName: 'Rahul',
      lastName: 'Mehta',
      workEmail: 'rahul.mehta@apexglobal.tech',
      personalEmail: 'rahul.dev@gmail.com',
      phone: '+91 98450 34567',
      dateOfBirth: new Date('1995-11-04'),
      gender: 'MALE',
      employmentType: 'PERMANENT',
      status: 'CONFIRMED',
      workMode: 'OFFICE',
      dateOfJoining: new Date('2023-01-10'),
      confirmationDate: new Date('2023-04-10'),
      probationDays: 90,
      panNumber: 'ABCPM9012L',
      uanNumber: '100904589213',
      pfNumber: 'MH/BAN/0045892/000/1003',
      bankName: 'State Bank of India',
      bankAccountNumber: '30245678901',
      ifscCode: 'SBIN0004567',
      bankBranch: 'Whitefield Branch'
    }
  });

  // Assign Salary Structures
  // Rahul: CTC ₹14,40,000 (Monthly Gross ₹1,10,000)
  // Basic: 50,000, HRA: 25,000, Spl: 25,000, Conv: 5,000, Med: 5,000
  // PF: 6,000 (12% of 50000), PT: 200, TDS: 7,500
  const rahulStructure = await prisma.employeeSalaryStructure.create({
    data: {
      employeeId: empRahul.id,
      annualCtc: 1440000,
      monthlyGross: 110000,
      effectiveFrom: new Date('2024-04-01'),
      lines: {
        create: [
          { componentId: cBasic.id, monthlyAmount: 50000, annualAmount: 600000 },
          { componentId: cHra.id, monthlyAmount: 25000, annualAmount: 300000 },
          { componentId: cSpl.id, monthlyAmount: 25000, annualAmount: 300000 },
          { componentId: cConv.id, monthlyAmount: 5000, annualAmount: 60000 },
          { componentId: cMed.id, monthlyAmount: 5000, annualAmount: 60000 },
          { componentId: cPfEmp.id, monthlyAmount: 6000, annualAmount: 72000 },
          { componentId: cPt.id, monthlyAmount: 200, annualAmount: 2400 },
          { componentId: cTds.id, monthlyAmount: 7500, annualAmount: 90000 },
          { componentId: cPfEmpr.id, monthlyAmount: 6000, annualAmount: 72000 },
          { componentId: cGrat.id, monthlyAmount: 2405, annualAmount: 28860 }
        ]
      }
    }
  });

  // Ananya: CTC ₹18,00,000 (Monthly Gross ₹1,35,000)
  await prisma.employeeSalaryStructure.create({
    data: {
      employeeId: empAnanya.id,
      annualCtc: 1800000,
      monthlyGross: 135000,
      effectiveFrom: new Date('2024-04-01'),
      lines: {
        create: [
          { componentId: cBasic.id, monthlyAmount: 65000, annualAmount: 780000 },
          { componentId: cHra.id, monthlyAmount: 32500, annualAmount: 390000 },
          { componentId: cSpl.id, monthlyAmount: 27500, annualAmount: 330000 },
          { componentId: cConv.id, monthlyAmount: 5000, annualAmount: 60000 },
          { componentId: cMed.id, monthlyAmount: 5000, annualAmount: 60000 },
          { componentId: cPfEmp.id, monthlyAmount: 7800, annualAmount: 93600 },
          { componentId: cPt.id, monthlyAmount: 200, annualAmount: 2400 },
          { componentId: cTds.id, monthlyAmount: 11000, annualAmount: 132000 },
          { componentId: cPfEmpr.id, monthlyAmount: 7800, annualAmount: 93600 },
          { componentId: cGrat.id, monthlyAmount: 3127, annualAmount: 37524 }
        ]
      }
    }
  });

  // Rohit: CTC ₹32,00,000 (Monthly Gross ₹2,40,000)
  await prisma.employeeSalaryStructure.create({
    data: {
      employeeId: empRohit.id,
      annualCtc: 3200000,
      monthlyGross: 240000,
      effectiveFrom: new Date('2024-04-01'),
      lines: {
        create: [
          { componentId: cBasic.id, monthlyAmount: 115000, annualAmount: 1380000 },
          { componentId: cHra.id, monthlyAmount: 57500, annualAmount: 690000 },
          { componentId: cSpl.id, monthlyAmount: 52500, annualAmount: 630000 },
          { componentId: cConv.id, monthlyAmount: 7500, annualAmount: 90000 },
          { componentId: cMed.id, monthlyAmount: 7500, annualAmount: 90000 },
          { componentId: cPfEmp.id, monthlyAmount: 13800, annualAmount: 165600 },
          { componentId: cPt.id, monthlyAmount: 200, annualAmount: 2400 },
          { componentId: cTds.id, monthlyAmount: 32000, annualAmount: 384000 },
          { componentId: cPfEmpr.id, monthlyAmount: 13800, annualAmount: 165600 },
          { componentId: cGrat.id, monthlyAmount: 5532, annualAmount: 66384 }
        ]
      }
    }
  });

  // Employee-Specific Payroll Policies & Statutory Eligibility
  await prisma.employeePayrollPolicy.createMany({
    data: [
      {
        employeeId: empRohit.id,
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'CEILING_15000',
        pfNumber: empRohit.pfNumber,
        uanNumber: empRohit.uanNumber,
        esiApplicable: false,
        esiStatus: 'EXEMPT_OVER_CEILING',
        ptApplicable: true,
        ptState: 'Maharashtra',
        taxRegime: 'NEW',
        paymentMode: 'NEFT',
        payrollFrequency: 'MONTHLY',
        effectiveFrom: new Date('2024-04-01')
      },
      {
        employeeId: empAnanya.id,
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'ACTUAL_BASIC',
        pfNumber: empAnanya.pfNumber,
        uanNumber: empAnanya.uanNumber,
        esiApplicable: false,
        esiStatus: 'EXEMPT_OVER_CEILING',
        ptApplicable: true,
        ptState: 'Maharashtra',
        taxRegime: 'OLD',
        paymentMode: 'NEFT',
        payrollFrequency: 'MONTHLY',
        effectiveFrom: new Date('2024-04-01')
      },
      {
        employeeId: empRahul.id,
        pfApplicable: true,
        pfStatus: 'APPLICABLE',
        pfWageBasis: 'CEILING_15000',
        pfNumber: empRahul.pfNumber,
        uanNumber: empRahul.uanNumber,
        esiApplicable: false,
        esiStatus: 'EXEMPT_OVER_CEILING',
        ptApplicable: true,
        ptState: 'Karnataka',
        taxRegime: 'NEW',
        paymentMode: 'NEFT',
        payrollFrequency: 'MONTHLY',
        effectiveFrom: new Date('2024-04-01')
      }
    ]
  });

  // Leave Balances for all 3 employees
  for (const emp of [empRohit, empAnanya, empRahul]) {
    await prisma.employeeLeaveBalance.createMany({
      data: [
        { employeeId: emp.id, leavePolicyId: lCl.id, calendarYear: 2026, credited: 12, used: 2, balance: 10 },
        { employeeId: emp.id, leavePolicyId: lSl.id, calendarYear: 2026, credited: 12, used: 1, balance: 11 },
        { employeeId: emp.id, leavePolicyId: lPl.id, calendarYear: 2026, credited: 18, used: 3, balance: 15 }
      ]
    });
  }

  // 13. Payroll Periods (Calendar Year 2026)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const periods = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(Date.UTC(2026, m, 1));
    const end = new Date(Date.UTC(2026, m + 1, 0));
    const cutoff = new Date(Date.UTC(2026, m, 25));

    const p = await prisma.payrollPeriod.create({
      data: {
        companyId: company.id,
        periodNumber: m + 1,
        name: `${monthNames[m]} 2026`,
        month: m + 1,
        year: 2026,
        startDate: start,
        endDate: end,
        cutoffDate: cutoff,
        isLocked: m < 9 // Lock past months up to Sep 2026
      }
    });
    periods.push(p);
  }

  // 14. Corporate Users
  const userAdmin = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'admin',
      email: 'admin@apexglobal.tech',
      passwordHash: defaultPasswordHash,
      fullName: 'System Administrator',
      userRoles: {
        create: [
          { roleId: roleMap.get('company_admin')! },
          { roleId: roleMap.get('platform_admin')! }
        ]
      }
    }
  });

  const userHr = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'hr.manager',
      email: 'hr.manager@apexglobal.tech',
      passwordHash: defaultPasswordHash,
      fullName: 'Pooja Hegde (HR Lead)',
      userRoles: {
        create: [
          { roleId: roleMap.get('hr_manager')! }
        ]
      }
    }
  });

  const userPayroll = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'payroll.officer',
      email: 'payroll@apexglobal.tech',
      passwordHash: defaultPasswordHash,
      fullName: 'Siddharth Nair (Payroll Specialist)',
      userRoles: {
        create: [
          { roleId: roleMap.get('payroll_admin')! }
        ]
      }
    }
  });

  const userFinance = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'finance.lead',
      email: 'finance@apexglobal.tech',
      passwordHash: defaultPasswordHash,
      fullName: 'Alok Singhal (Finance Controller)',
      userRoles: {
        create: [
          { roleId: roleMap.get('finance_admin')! }
        ]
      }
    }
  });

  // Employee Login Users
  const userRohit = await prisma.user.create({
    data: {
      companyId: company.id,
      employeeId: empRohit.id,
      username: 'rohit.sharma',
      email: empRohit.workEmail,
      passwordHash: defaultPasswordHash,
      fullName: 'Rohit Sharma',
      userRoles: {
        create: [
          { roleId: roleMap.get('department_manager')! },
          { roleId: roleMap.get('employee')! }
        ]
      }
    }
  });

  const userAnanya = await prisma.user.create({
    data: {
      companyId: company.id,
      employeeId: empAnanya.id,
      username: 'ananya.verma',
      email: empAnanya.workEmail,
      passwordHash: defaultPasswordHash,
      fullName: 'Ananya Verma',
      userRoles: {
        create: [
          { roleId: roleMap.get('employee')! }
        ]
      }
    }
  });

  const userRahul = await prisma.user.create({
    data: {
      companyId: company.id,
      employeeId: empRahul.id,
      username: 'rahul.mehta',
      email: empRahul.workEmail,
      passwordHash: defaultPasswordHash,
      fullName: 'Rahul Mehta',
      userRoles: {
        create: [
          { roleId: roleMap.get('employee')! }
        ]
      }
    }
  });

  // 15. Sample Recruitment Job Openings
  const jobEng = await prisma.jobOpening.create({
    data: {
      companyId: company.id,
      departmentId: deptEng.id,
      designationId: desSrEng.id,
      title: 'Senior Full Stack Engineer (Node.js & React)',
      openingsCount: 3,
      minExperience: 5,
      budgetMin: 1400000,
      budgetMax: 2000000,
      description: 'Looking for a senior full stack engineer proficient in TypeScript, React, Express, and PostgreSQL.'
    }
  });

  const candKunal = await prisma.candidate.create({
    data: {
      fullName: 'Kunal Deshmukh',
      email: 'kunal.deshmukh@gmail.com',
      phone: '+91 99200 44556',
      currentCompany: 'Infosys Limited',
      currentCtc: 1200000,
      expectedCtc: 1600000,
      noticePeriodDays: 30
    }
  });

  await prisma.jobApplication.create({
    data: {
      jobOpeningId: jobEng.id,
      candidateId: candKunal.id,
      stage: 'TECHNICAL_INTERVIEW',
      notes: 'Strong DSA and system design background. Scheduled for round 2.'
    }
  });

  // 16. Sample IT Assets
  const asset1 = await prisma.companyAsset.create({
    data: {
      companyId: company.id,
      assetTag: 'AST-MAC-2024-001',
      name: 'Apple MacBook Pro 16" M3 Pro',
      category: 'LAPTOP',
      serialNumber: 'C02G1234MD6R',
      condition: 'NEW'
    }
  });

  await prisma.assetAllocation.create({
    data: {
      assetId: asset1.id,
      employeeId: empRahul.id,
      status: 'ALLOCATED'
    }
  });

  // 17. Sample Help Desk Categories & Ticket
  const catIt = await prisma.helpDeskCategory.create({
    data: { companyId: company.id, name: 'IT Infrastructure & Access', slaHours: 24 }
  });
  const catHr = await prisma.helpDeskCategory.create({
    data: { companyId: company.id, name: 'Payroll & Tax Queries', slaHours: 48 }
  });

  await prisma.helpDeskTicket.create({
    data: {
      ticketNumber: 'TKT-2026-001',
      employeeId: empRahul.id,
      categoryId: catIt.id,
      priority: 'MEDIUM',
      subject: 'Docker Desktop License Request',
      description: 'Requesting Docker Desktop license for development in the Apex Global microservices workspace.',
      status: 'OPEN'
    }
  });

  // 18. Sample Loan / Salary Advance
  const loanAdvance = await prisma.loanType.create({
    data: {
      companyId: company.id,
      code: 'SAL-ADV',
      name: 'Salary Advance (Interest-Free)',
      maxAmount: 100000,
      interestRatePct: 0,
      maxTenureMonths: 6
    }
  });

  // 19. Sample Expense Categories
  await prisma.expenseCategory.createMany({
    data: [
      { companyId: company.id, code: 'EXP-TRAVEL', name: 'Travel & Lodging', maxLimit: 50000, requiresReceipt: true },
      { companyId: company.id, code: 'EXP-MEAL', name: 'Client Meal & Dining', maxLimit: 5000, requiresReceipt: true },
      { companyId: company.id, code: 'EXP-INTERNET', name: 'Work From Home Broadband', maxLimit: 1500, requiresReceipt: true }
    ]
  });

  console.log('✅ Corporate HRMS & Payroll seed completed successfully!');
  console.log(`🏢 Company: ${company.name} (${company.code})`);
  console.log(`👥 Seeded ${await prisma.employee.count()} Employees, ${await prisma.user.count()} Users`);
  console.log('🔑 Default password for all seed accounts: Admin@123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
