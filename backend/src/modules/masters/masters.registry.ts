import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { MasterCategoryConfig, MasterCategoryKey } from './masters.types.js';

export const MASTER_CONFIGS: Record<MasterCategoryKey, MasterCategoryConfig> = {
  companies: {
    key: 'companies',
    label: 'Companies',
    singularLabel: 'Company',
    group: 'organization',
    description: 'Corporate entities, legal names, statutory registration codes and contact details.',
    icon: 'Building2',
    model: 'company',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: false, // Managed via platform onboarding
    canEdit: true,
    canDelete: false,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Company Code', type: 'text', required: true, readOnly: true },
      { name: 'name', label: 'Company Display Name', type: 'text', required: true },
      { name: 'legalName', label: 'Legal Entity Name', type: 'text', required: true },
      { name: 'brandName', label: 'Brand Name', type: 'text' },
      { name: 'contactEmail', label: 'Contact Email', type: 'text', required: true },
      { name: 'contactPhone', label: 'Contact Phone', type: 'text' },
      { name: 'cinNumber', label: 'CIN Number', type: 'text' },
      { name: 'gstin', label: 'GSTIN', type: 'text' },
      { name: 'panNumber', label: 'PAN Number', type: 'text' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  branches: {
    key: 'branches',
    label: 'Branches & Locations',
    singularLabel: 'Branch',
    group: 'organization',
    description: 'Physical workplace locations, branches, and regional office premises.',
    icon: 'MapPin',
    model: 'branch',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Branch Code', type: 'text', required: true, placeholder: 'e.g. BR-MUM-01' },
      { name: 'name', label: 'Branch Name', type: 'text', required: true, placeholder: 'e.g. Mumbai HQ' },
      { name: 'city', label: 'City', type: 'text', required: true, placeholder: 'e.g. Mumbai' },
      { name: 'state', label: 'State', type: 'text', required: true, placeholder: 'e.g. Maharashtra' },
      { name: 'address', label: 'Address Line', type: 'text' },
      { name: 'pinCode', label: 'PIN Code', type: 'text' },
      { name: 'isHeadquarters', label: 'Is Headquarters', type: 'boolean' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  departments: {
    key: 'departments',
    label: 'Departments',
    singularLabel: 'Department',
    group: 'organization',
    description: 'Functional business departments and operational units.',
    icon: 'Network',
    model: 'department',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Department Code', type: 'text', required: true, placeholder: 'e.g. ENG, HR, FIN' },
      { name: 'name', label: 'Department Name', type: 'text', required: true, placeholder: 'e.g. Engineering' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  designations: {
    key: 'designations',
    label: 'Designations',
    singularLabel: 'Designation',
    group: 'organization',
    description: 'Official corporate titles, job roles, and organizational designations.',
    icon: 'Briefcase',
    model: 'designation',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Designation Code', type: 'text', required: true, placeholder: 'e.g. SE, SSE, EM' },
      { name: 'name', label: 'Designation Title', type: 'text', required: true, placeholder: 'e.g. Senior Software Engineer' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  grades: {
    key: 'grades',
    label: 'Grades & Job Bands',
    singularLabel: 'Grade / Band',
    group: 'organization',
    description: 'Corporate salary bands, seniority grades, and CTC qualification ranges.',
    icon: 'Award',
    model: 'jobBand',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'code', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Grade Code', type: 'text', required: true, placeholder: 'e.g. L1, L2, L3, M1' },
      { name: 'name', label: 'Grade Level Name', type: 'text', required: true, placeholder: 'e.g. Associate Engineer, Senior Specialist' },
      { name: 'minCtc', label: 'Minimum CTC (₹)', type: 'number', required: false, placeholder: '0' },
      { name: 'maxCtc', label: 'Maximum CTC (₹)', type: 'number', required: false, placeholder: '0' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  divisions: {
    key: 'divisions',
    label: 'Divisions & Cost Centers',
    singularLabel: 'Division',
    group: 'organization',
    description: 'Financial cost centers, strategic business units, and divisional reporting nodes.',
    icon: 'Layers',
    model: 'costCenter',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Division / Cost Center Code', type: 'text', required: true, placeholder: 'e.g. CC-TECH, CC-SALES' },
      { name: 'name', label: 'Division Name', type: 'text', required: true, placeholder: 'e.g. Technology & Digital Products' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  units: {
    key: 'units',
    label: 'Organizational Units',
    singularLabel: 'Unit',
    group: 'organization',
    description: 'Sub-branch work facilities, plants, manufacturing units, and labs.',
    icon: 'Factory',
    model: 'orgUnit',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Unit Code', type: 'text', required: true, placeholder: 'e.g. UNIT-CORP-1, LAB-RD-01' },
      { name: 'name', label: 'Unit Name', type: 'text', required: true, placeholder: 'e.g. Corporate Unit 1' },
      { name: 'branchId', label: 'Associated Branch', type: 'select', parentCategory: 'branches' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  categories: {
    key: 'categories',
    label: 'Employment Categories',
    singularLabel: 'Category',
    group: 'organization',
    description: 'Workforce classifications such as Permanent Staff, Executive Officer, and Contractual.',
    icon: 'Users',
    model: 'employmentCategory',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Category Code', type: 'text', required: true, placeholder: 'e.g. PERM, EXEC, CONT' },
      { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Permanent Staff' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  projects: {
    key: 'projects',
    label: 'Projects',
    singularLabel: 'Project',
    group: 'organization',
    description: 'Client billable projects, internal operational initiatives, and delivery assignments.',
    icon: 'KanbanSquare',
    model: 'project',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Project Code', type: 'text', required: true, placeholder: 'e.g. PRJ-INTERNAL, PRJ-ENG' },
      { name: 'name', label: 'Project Name', type: 'text', required: true, placeholder: 'e.g. Internal Operations' },
      { name: 'clientName', label: 'Client / Sponsor Name', type: 'text', placeholder: 'e.g. Enterprise Client' },
      { name: 'status', label: 'Status Code', type: 'text', placeholder: 'ACTIVE' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'job-positions': {
    key: 'job-positions',
    label: 'Job Positions & Posts',
    singularLabel: 'Job Position',
    group: 'organization',
    description: 'Specific budgeted position posts linked to departments and designations.',
    icon: 'UserCheck',
    model: 'jobPosition',
    codeField: 'code',
    nameField: 'title',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'code', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Job Post Code', type: 'text', required: true, placeholder: 'e.g. SE-2026, PM-001' },
      { name: 'title', label: 'Position Title', type: 'text', required: true, placeholder: 'e.g. Lead Full-Stack Architect' },
      { name: 'departmentId', label: 'Department', type: 'select', parentCategory: 'departments' },
      { name: 'designationId', label: 'Designation', type: 'select', parentCategory: 'designations' },
      { name: 'gradeId', label: 'Seniority Grade', type: 'select', parentCategory: 'grades' },
      { name: 'description', label: 'Job Summary', type: 'textarea' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'salary-components': {
    key: 'salary-components',
    label: 'Salary Components',
    singularLabel: 'Salary Component',
    group: 'payroll',
    description: 'Earnings, statutory deductions, benefits, and variable pay column master definitions.',
    icon: 'DollarSign',
    model: 'salaryComponent',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'displayOrder', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Component Code', type: 'text', required: true, placeholder: 'e.g. BASIC, HRA, SPECIAL_ALLOW' },
      { name: 'name', label: 'Component Name', type: 'text', required: true, placeholder: 'e.g. Basic Salary' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          { value: 'EARNING', label: 'Earning' },
          { value: 'DEDUCTION', label: 'Deduction' },
          { value: 'REIMBURSEMENT', label: 'Reimbursement' },
          { value: 'STATUTORY_EMPLOYER', label: 'Employer Statutory' }
        ]
      },
      {
        name: 'calculationMode',
        label: 'Calculation Mode',
        type: 'select',
        required: true,
        options: [
          { value: 'FIXED_AMOUNT', label: 'Fixed Amount' },
          { value: 'PERCENTAGE_OF_BASIC', label: 'Percentage of Basic' },
          { value: 'PERCENTAGE_OF_GROSS', label: 'Percentage of Gross' },
          { value: 'FORMULA', label: 'Formula Expression' }
        ]
      },
      { name: 'formulaExpression', label: 'Formula Expression', type: 'text', placeholder: 'e.g. BASIC * 0.40' },
      { name: 'percentageValue', label: 'Percentage (%)', type: 'number', placeholder: '0' },
      { name: 'fixedAmount', label: 'Default Fixed Amount (₹)', type: 'number', placeholder: '0' },
      { name: 'isTaxable', label: 'Is Taxable', type: 'boolean' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'salary-templates': {
    key: 'salary-templates',
    label: 'Salary Templates & CTC Packages',
    singularLabel: 'Salary Template',
    group: 'payroll',
    description: 'Configured compensation templates with standard salary component breakdowns.',
    icon: 'FileSpreadsheet',
    model: 'salaryTemplate',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Template Code', type: 'text', placeholder: 'e.g. TPL-EXEC, TPL-LEAD' },
      { name: 'name', label: 'Template Name', type: 'text', required: true, placeholder: 'e.g. Standard Executive CTC' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'isDefault', label: 'Is Default Organization Template', type: 'boolean' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'loan-types': {
    key: 'loan-types',
    label: 'Loan & Advance Products',
    singularLabel: 'Loan Product',
    group: 'payroll',
    description: 'Corporate employee loan policies, salary advances, and interest guidelines.',
    icon: 'CreditCard',
    model: 'loanType',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Product Code', type: 'text', required: true, placeholder: 'e.g. SAL-ADV, EMER-LOAN' },
      { name: 'name', label: 'Product Name', type: 'text', required: true, placeholder: 'e.g. Salary Advance' },
      { name: 'maxAmount', label: 'Maximum Limit (₹)', type: 'number', required: true, placeholder: '50000' },
      { name: 'interestRatePct', label: 'Annual Interest Rate (%)', type: 'number', placeholder: '0' },
      { name: 'maxTenureMonths', label: 'Maximum Tenure (Months)', type: 'number', placeholder: '12' },
      {
        name: 'interestType',
        label: 'Interest Type',
        type: 'select',
        options: [
          { value: 'INTEREST_FREE', label: 'Interest Free' },
          { value: 'SIMPLE_INTEREST', label: 'Simple Interest' },
          { value: 'COMPOUND_INTEREST', label: 'Compound Interest' }
        ]
      },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'shift-policies': {
    key: 'shift-policies',
    label: 'Shift Policies & Rosters',
    singularLabel: 'Shift Policy',
    group: 'attendance',
    description: 'Work schedules, operational shifts, grace periods, and half-day thresholds.',
    icon: 'Clock',
    model: 'shiftPolicy',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Shift Code', type: 'text', required: true, placeholder: 'e.g. GEN, MORNING, NIGHT' },
      { name: 'name', label: 'Shift Name', type: 'text', required: true, placeholder: 'e.g. General Day Shift' },
      { name: 'startTime', label: 'Start Time (HH:MM)', type: 'text', required: true, placeholder: '09:00' },
      { name: 'endTime', label: 'End Time (HH:MM)', type: 'text', required: true, placeholder: '18:00' },
      { name: 'graceMinutes', label: 'Grace Period (Minutes)', type: 'number', placeholder: '15' },
      { name: 'halfDayMinutes', label: 'Half-Day Minimum (Minutes)', type: 'number', placeholder: '240' },
      { name: 'fullDayMinutes', label: 'Full-Day Minimum (Minutes)', type: 'number', placeholder: '480' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'leave-policies': {
    key: 'leave-policies',
    label: 'Leave Policies & Types',
    singularLabel: 'Leave Policy',
    group: 'attendance',
    description: 'Annual leave quotas, paid leave policies, carry-forward, and encashment terms.',
    icon: 'Calendar',
    model: 'leavePolicy',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Leave Code', type: 'text', required: true, placeholder: 'e.g. CL, SL, EL, ML' },
      { name: 'name', label: 'Leave Name', type: 'text', required: true, placeholder: 'e.g. Casual Leave' },
      { name: 'annualQuota', label: 'Annual Quota (Days)', type: 'number', required: true, placeholder: '12' },
      { name: 'isPaid', label: 'Is Paid Leave', type: 'boolean' },
      { name: 'maxCarryForward', label: 'Max Carry Forward (Days)', type: 'number', placeholder: '0' },
      { name: 'encashable', label: 'Is Encashable', type: 'boolean' },
      { name: 'description', label: 'Policy Rules / Notes', type: 'textarea' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'expense-categories': {
    key: 'expense-categories',
    label: 'Expense & Reimbursement Categories',
    singularLabel: 'Expense Category',
    group: 'operations',
    description: 'Corporate travel, client entertainment, conveyance, and meal expense categories.',
    icon: 'Receipt',
    model: 'expenseCategory',
    codeField: 'code',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'code', label: 'Expense Code', type: 'text', required: true, placeholder: 'e.g. TRAVEL, MEAL, LODGING' },
      { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Business Travel & Commute' },
      { name: 'maxLimit', label: 'Maximum Claim Limit (₹)', type: 'number', placeholder: '10000' },
      { name: 'requiresReceipt', label: 'Mandatory Proof / Receipt', type: 'boolean' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  },
  'helpdesk-categories': {
    key: 'helpdesk-categories',
    label: 'Help Desk Ticket Categories',
    singularLabel: 'Help Desk Category',
    group: 'operations',
    description: 'Employee query classification, IT support categories, HR help tickets, and SLAs.',
    icon: 'LifeBuoy',
    model: 'helpDeskCategory',
    codeField: 'name',
    nameField: 'name',
    supportsActiveToggle: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    defaultOrderBy: { field: 'name', direction: 'asc' },
    fields: [
      { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. IT Infrastructure, Payroll Discrepancy' },
      { name: 'slaHours', label: 'Resolution SLA (Hours)', type: 'number', required: true, placeholder: '24' },
      { name: 'active', label: 'Active Status', type: 'boolean' }
    ]
  }
};

/**
 * Validates whether a record can be safely deleted or deactivated without breaking referential integrity.
 */
export async function checkMasterRecordDependencies(
  categoryKey: MasterCategoryKey,
  recordId: string,
  companyId: string
): Promise<{ canDelete: boolean; referenceCount: number; reason?: string }> {
  switch (categoryKey) {
    case 'companies':
      return { canDelete: false, referenceCount: 1, reason: 'Primary company entity cannot be deleted.' };

    case 'branches': {
      const empCount = await prisma.employee.count({ where: { companyId, branchId: recordId } });
      const unitCount = await prisma.orgUnit.count({ where: { companyId, branchId: recordId } });
      const total = empCount + unitCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${empCount} employee(s) and ${unitCount} unit(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'departments': {
      const empCount = await prisma.employee.count({ where: { companyId, departmentId: recordId } });
      const posCount = await prisma.jobPosition.count({ where: { companyId, departmentId: recordId } });
      const total = empCount + posCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${empCount} employee(s) and ${posCount} job position(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'designations': {
      const empCount = await prisma.employee.count({ where: { companyId, designationId: recordId } });
      const posCount = await prisma.jobPosition.count({ where: { companyId, designationId: recordId } });
      const total = empCount + posCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${empCount} employee(s) and ${posCount} job position(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'grades': {
      const empCount = await prisma.employee.count({ where: { companyId, jobBandId: recordId } });
      const posCount = await prisma.jobPosition.count({ where: { companyId, gradeId: recordId } });
      const total = empCount + posCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${empCount} employee(s) and ${posCount} job position(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'divisions': {
      const empCount = await prisma.employee.count({ where: { companyId, costCenterId: recordId } });
      if (empCount > 0) {
        return {
          canDelete: false,
          referenceCount: empCount,
          reason: `Referenced by ${empCount} employee(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'units': {
      const unit = await prisma.orgUnit.findUnique({ where: { id: recordId } });
      if (!unit) return { canDelete: true, referenceCount: 0 };
      const empCount = await prisma.employee.count({ where: { companyId, unit: unit.name } });
      if (empCount > 0) {
        return {
          canDelete: false,
          referenceCount: empCount,
          reason: `Referenced by ${empCount} employee profile(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'categories': {
      const cat = await prisma.employmentCategory.findUnique({ where: { id: recordId } });
      if (!cat) return { canDelete: true, referenceCount: 0 };
      const empCount = await prisma.employee.count({ where: { companyId, category: cat.name } });
      if (empCount > 0) {
        return {
          canDelete: false,
          referenceCount: empCount,
          reason: `Referenced by ${empCount} employee profile(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'projects': {
      const allocCount = await prisma.projectAllocation.count({ where: { projectId: recordId } });
      const proj = await prisma.project.findUnique({ where: { id: recordId } });
      const empCount = proj ? await prisma.employee.count({ where: { companyId, project: proj.name } }) : 0;
      const total = allocCount + empCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${allocCount} allocation(s) and ${empCount} employee profile(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'job-positions': {
      const pos = await prisma.jobPosition.findUnique({ where: { id: recordId } });
      if (!pos) return { canDelete: true, referenceCount: 0 };
      const empCount = await prisma.employee.count({ where: { companyId, jobPostCode: pos.code } });
      if (empCount > 0) {
        return {
          canDelete: false,
          referenceCount: empCount,
          reason: `Referenced by ${empCount} employee(s) using job post code ${pos.code}. Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'salary-components': {
      const tmplCount = await prisma.salaryTemplateLine.count({ where: { componentId: recordId } });
      const structCount = await prisma.employeeSalaryLine.count({ where: { componentId: recordId } });
      const total = tmplCount + structCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Used in ${tmplCount} salary template lines and ${structCount} employee salary lines. Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'salary-templates': {
      const structCount = await prisma.employeeSalaryStructure.count({ where: { templateId: recordId } });
      if (structCount > 0) {
        return {
          canDelete: false,
          referenceCount: structCount,
          reason: `Assigned to ${structCount} employee salary structures. Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'loan-types': {
      const loanCount = await prisma.employeeLoan.count({ where: { loanTypeId: recordId } });
      if (loanCount > 0) {
        return {
          canDelete: false,
          referenceCount: loanCount,
          reason: `Referenced by ${loanCount} existing loan contracts. Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'shift-policies': {
      const attCount = await prisma.dailyAttendance.count({ where: { shiftPolicyId: recordId } });
      const rosterCount = await prisma.shiftRoster.count({ where: { shiftPolicyId: recordId } });
      const total = attCount + rosterCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${attCount} attendance logs and ${rosterCount} shift roster records. Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'leave-policies': {
      const balCount = await prisma.employeeLeaveBalance.count({ where: { leavePolicyId: recordId } });
      const reqCount = await prisma.leaveRequest.count({ where: { leavePolicyId: recordId } });
      const total = balCount + reqCount;
      if (total > 0) {
        return {
          canDelete: false,
          referenceCount: total,
          reason: `Referenced by ${balCount} leave balance ledger(s) and ${reqCount} leave request(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'expense-categories': {
      const itemCount = await prisma.expenseItem.count({ where: { categoryId: recordId } });
      if (itemCount > 0) {
        return {
          canDelete: false,
          referenceCount: itemCount,
          reason: `Referenced by ${itemCount} expense claim item(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    case 'helpdesk-categories': {
      const ticketCount = await prisma.helpDeskTicket.count({ where: { categoryId: recordId } });
      if (ticketCount > 0) {
        return {
          canDelete: false,
          referenceCount: ticketCount,
          reason: `Referenced by ${ticketCount} help desk support ticket(s). Deactivate instead of deleting.`
        };
      }
      return { canDelete: true, referenceCount: 0 };
    }

    default:
      return { canDelete: true, referenceCount: 0 };
  }
}
