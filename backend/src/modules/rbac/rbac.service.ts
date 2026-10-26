import { prisma } from '../../config/db.js';

export interface SystemPermissionDef {
  key: string;
  name: string;
  category: 'MODULE' | 'TAB' | 'ACTION' | 'FIELD';
  description: string;
}

export const ALL_SYSTEM_PERMISSIONS: SystemPermissionDef[] = [
  // Modules
  { key: 'module:dashboard', name: 'Dashboard', category: 'MODULE', description: 'Access executive dashboard' },
  { key: 'module:employees', name: 'Employee Master', category: 'MODULE', description: 'Access employee directory' },
  { key: 'module:recruitment', name: 'Recruitment & ATS', category: 'MODULE', description: 'Access recruitment pipeline' },
  { key: 'module:offboarding', name: 'Offboarding & F&F', category: 'MODULE', description: 'Access offboarding desk' },
  { key: 'module:attendance', name: 'Shifts & Attendance', category: 'MODULE', description: 'Access time & attendance' },
  { key: 'module:leave', name: 'Leave Management', category: 'MODULE', description: 'Access leave portal' },
  { key: 'module:column_master', name: 'Salary Column Master', category: 'MODULE', description: 'Access column master' },
  { key: 'module:compensation', name: 'Salary Structures (CTC)', category: 'MODULE', description: 'Access CTC templates' },
  { key: 'module:payroll', name: 'Payroll Engine', category: 'MODULE', description: 'Access 7-stage payroll' },
  { key: 'module:loans', name: 'Loans & Advances', category: 'MODULE', description: 'Access employee loans' },
  { key: 'module:expenses', name: 'Expenses & Travel', category: 'MODULE', description: 'Access reimbursement desk' },
  { key: 'module:assets_helpdesk', name: 'Assets & Help Desk', category: 'MODULE', description: 'Access assets & ticketing' },
  { key: 'module:reports', name: 'Registers & NEFT Export', category: 'MODULE', description: 'Access compliance registers' },
  { key: 'module:self_service', name: 'My Self-Service (ESS)', category: 'MODULE', description: 'Access employee portal' },

  // Tabs
  { key: 'tab:assets:inventory', name: 'Hardware Inventory Tab', category: 'TAB', description: 'View company hardware inventory tab' },
  { key: 'tab:assets:helpdesk', name: 'Support Tickets Tab', category: 'TAB', description: 'View support tickets tab' },
  { key: 'tab:expenses:claims', name: 'Expense Claims Tab', category: 'TAB', description: 'View expense claims tab' },
  { key: 'tab:expenses:travel', name: 'Travel Desk Tab', category: 'TAB', description: 'View travel desk tab' },
  { key: 'tab:leave:balance', name: 'Leave Balances Tab', category: 'TAB', description: 'View leave quotas tab' },
  { key: 'tab:leave:apply', name: 'Apply Leave Tab', category: 'TAB', description: 'View leave application tab' },
  { key: 'tab:leave:approvals', name: 'Leave Approvals Tab', category: 'TAB', description: 'View team leave approvals' },
  { key: 'tab:loans:active', name: 'Active Loans Tab', category: 'TAB', description: 'View active loan register' },
  { key: 'tab:loans:apply', name: 'Apply Loan Tab', category: 'TAB', description: 'View loan application tab' },
  { key: 'tab:loans:types', name: 'Loan Types Tab', category: 'TAB', description: 'View loan products configuration' },

  // Actions - Assets
  { key: 'asset:create', name: 'Register Asset', category: 'ACTION', description: 'Register new IT / hardware asset' },
  { key: 'asset:allocate', name: 'Allocate Asset', category: 'ACTION', description: 'Assign asset to custodian' },
  { key: 'asset:view_inventory', name: 'View Asset Inventory', category: 'ACTION', description: 'View company asset inventory' },

  // Actions - Help Desk
  { key: 'ticket:create', name: 'Raise Ticket', category: 'ACTION', description: 'Submit new support ticket' },
  { key: 'ticket:comment', name: 'Comment Ticket', category: 'ACTION', description: 'Post responses on tickets' },
  { key: 'ticket:resolve', name: 'Resolve Ticket', category: 'ACTION', description: 'Update status to resolved/closed' },

  // Actions - Employees
  { key: 'employee:create', name: 'Enroll Employee', category: 'ACTION', description: 'Create new employee profile' },
  { key: 'employee:edit', name: 'Edit Employee', category: 'ACTION', description: 'Update employee profile' },
  { key: 'employee:delete', name: 'Terminate Employee', category: 'ACTION', description: 'Deactivate employee profile' },
  { key: 'employee:view', name: 'View Employees', category: 'ACTION', description: 'Browse employee master' },

  // Actions - Recruitment
  { key: 'recruitment:create_job', name: 'Create Opening', category: 'ACTION', description: 'Publish manpower opening' },
  { key: 'recruitment:move_stage', name: 'Update Candidate Stage', category: 'ACTION', description: 'Move candidate in ATS' },
  { key: 'recruitment:hire', name: 'Convert to Employee', category: 'ACTION', description: '1-click hire into Employee Master' },

  // Actions - Offboarding
  { key: 'offboarding:initiate', name: 'Initiate Resignation', category: 'ACTION', description: 'Submit resignation' },
  { key: 'offboarding:settle', name: 'Calculate F&F', category: 'ACTION', description: 'Approve final settlement' },

  // Actions - Attendance & Leave
  { key: 'attendance:punch', name: 'Daily Punch', category: 'ACTION', description: 'Clock in / clock out' },
  { key: 'attendance:regularize', name: 'Regularize Attendance', category: 'ACTION', description: 'Submit punch regularization' },
  { key: 'attendance:manage_shifts', name: 'Configure Shifts', category: 'ACTION', description: 'Manage shifts & rosters' },
  { key: 'leave:apply', name: 'Apply Leave', category: 'ACTION', description: 'Submit leave request' },
  { key: 'leave:approve', name: 'Approve Leave', category: 'ACTION', description: 'Review & approve leave requests' },
  { key: 'leave:policy_create', name: 'Configure Leave Policy', category: 'ACTION', description: 'Create leave policy quotas' },

  // Actions - Salary Column Master & Structures
  { key: 'salary_component:create', name: 'Add Salary Head', category: 'ACTION', description: 'Create salary component head' },
  { key: 'salary_component:edit', name: 'Edit Salary Head', category: 'ACTION', description: 'Modify salary head & formula' },
  { key: 'salary_component:toggle', name: 'Toggle Salary Head', category: 'ACTION', description: 'Activate / Deactivate head' },
  { key: 'salary_structure:create', name: 'Create Salary Structure', category: 'ACTION', description: 'Create CTC structure' },
  { key: 'salary_structure:assign', name: 'Assign Structure', category: 'ACTION', description: 'Map structure to employee' },

  // Actions - Payroll
  { key: 'payroll:period_create', name: 'Create Payroll Period', category: 'ACTION', description: 'Initialize calendar month' },
  { key: 'payroll:run_draft', name: 'Generate Draft Run', category: 'ACTION', description: 'Generate draft payroll run' },
  { key: 'payroll:run_validate', name: 'Validate Inputs', category: 'ACTION', description: 'Run attendance validation' },
  { key: 'payroll:run_calculate', name: 'Calculate Pay Slips', category: 'ACTION', description: 'Compute formula & TDS' },
  { key: 'payroll:run_review', name: 'Review & Freeze', category: 'ACTION', description: 'Freeze payroll calculation' },
  { key: 'payroll:run_approve', name: 'Approve Disbursement', category: 'ACTION', description: 'Final financial approval' },
  { key: 'payroll:run_pay', name: 'Disburse & Close', category: 'ACTION', description: 'Mark payment ready & paid' },
  { key: 'payroll:send_payslips', name: 'Dispatch Payslips', category: 'ACTION', description: 'Email payslips to employees' },
  // Granular Payroll Studio Permissions (Task 2 / Admin Controlled RBAC)
  { key: 'payroll:view_dashboard', name: 'View Payroll Studio', category: 'MODULE', description: 'Access the main payroll overview workbench' },
  { key: 'payroll:view_runs', name: 'View Monthly Runs', category: 'TAB', description: 'Browse institutional and monthly payroll batches' },
  { key: 'payroll:view_employee_details', name: 'View Employee Slips', category: 'FIELD', description: 'Inspect individual employee gross, deductions and net calculations' },
  { key: 'payroll:view_salary_structures', name: 'View Salary CTC', category: 'TAB', description: 'Inspect compensation component master and CTC sheets' },
  { key: 'payroll:view_reports', name: 'View Statutory Reports', category: 'TAB', description: 'Access PF, ESI, PT and tax compliance summaries' },
  { key: 'payroll:prepare', name: 'Initialize Monthly Batches', category: 'ACTION', description: 'Create and redraft new monthly payroll runs' },
  { key: 'payroll:edit_salary_inputs', name: 'Edit Salary Inputs', category: 'ACTION', description: 'Modify monthly attendance adjustments and arrears' },
  { key: 'payroll:validate', name: 'Execute Validation Scan', category: 'ACTION', description: 'Verify LOP, salary structure presence and mid-month joinings' },
  { key: 'payroll:calculate', name: 'Run Calculation Engine', category: 'ACTION', description: 'Trigger pure decimal salary calculation engine' },
  { key: 'payroll:resolve_errors', name: 'Resolve Validation Errors', category: 'ACTION', description: 'Override or address payroll exceptions and blocks' },
  { key: 'payroll:review', name: 'Audit Payroll Variances', category: 'ACTION', description: 'Analyze delta against prior runs and flag deductions > 50%' },
  { key: 'payroll:request_corrections', name: 'Request Recalculation', category: 'ACTION', description: 'Return runs for salary adjustments before approval' },
  { key: 'payroll:submit_approval', name: 'Submit for Executive Signoff', category: 'ACTION', description: 'Transition reviewed runs to pending approval queue' },
  { key: 'payroll:approve', name: 'Authorize Payroll Disbursement', category: 'ACTION', description: 'Formal executive authorization for salary fund disbursement' },
  { key: 'payroll:reject', name: 'Reject Payroll Run', category: 'ACTION', description: 'Reject reviewed payroll batch with formal audit justification' },
  { key: 'payroll:access_tds', name: 'Access Income Tax Studio', category: 'MODULE', description: 'View income tax projections and deductions' },
  { key: 'payroll:run_tax_assessment', name: 'Run Tax Calculations', category: 'ACTION', description: 'Compute regime-based tax liability under Old/New regime' },
  { key: 'payroll:port_tds', name: 'Port TDS to Monthly Salary', category: 'ACTION', description: 'Post assessed tax deductions into active salary structures' },
  { key: 'payroll:prepare_payment', name: 'Generate Bank NEFT Register', category: 'ACTION', description: 'Export electronic bank payment file for corporate disbursal' },
  { key: 'payroll:mark_paid', name: 'Record Bank UTR & Release Slips', category: 'ACTION', description: 'Confirm settlement reference, recover loan EMIs, release to ESS' },
  { key: 'payroll:manage_permissions', name: 'Manage Payroll Access', category: 'ACTION', description: 'Grant or revoke payroll capabilities for system users' },
  { key: 'payroll:audit_logs', name: 'View Permission Audit Trail', category: 'ACTION', description: 'Inspect historical access changes and actor records' },

  // Actions - Loans
  { key: 'loan:apply', name: 'Sanction Loan', category: 'ACTION', description: 'Sanction loan or advance' },
  { key: 'loan:approve', name: 'Approve Loan', category: 'ACTION', description: 'Approve loan status' },
  { key: 'loan:type_create', name: 'Configure Loan Product', category: 'ACTION', description: 'Create loan products' },
  { key: 'loan:delete', name: 'Delete Loan', category: 'ACTION', description: 'Cancel loan advance' },

  // Actions - Expenses
  { key: 'expense:submit', name: 'Submit Expense Claim', category: 'ACTION', description: 'Submit reimbursement claim' },
  { key: 'expense:review', name: 'Review Expense Claims', category: 'ACTION', description: 'Approve/reject expense claims' },
  { key: 'expense:admin_link', name: 'Link User to Employee', category: 'ACTION', description: 'Administrative account resolution' },

  // Actions - Reports
  { key: 'reports:view', name: 'View Reports', category: 'ACTION', description: 'View salary & compliance registers' },
  { key: 'reports:export', name: 'Export NEFT & Excel', category: 'ACTION', description: 'Download payment registers' },

  // Actions - RBAC
  { key: 'rbac:manage', name: 'Manage Roles & Permissions', category: 'ACTION', description: 'Configure role permissions' },

  // Fields
  { key: 'field:employee:basic_pay', name: 'View Basic Pay', category: 'FIELD', description: 'View basic salary figures' },
  { key: 'field:employee:bank_account', name: 'View Bank Account', category: 'FIELD', description: 'View full bank account numbers' },
  { key: 'field:employee:pan_uan', name: 'View PAN & UAN', category: 'FIELD', description: 'View tax & PF identifiers' }
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ALL_SYSTEM_PERMISSIONS.map(p => p.key),
  company_admin: ALL_SYSTEM_PERMISSIONS.map(p => p.key),

  asset_manager: [
    'module:dashboard',
    'module:assets_helpdesk',
    'module:self_service',
    'tab:assets:inventory',
    'tab:assets:helpdesk',
    'asset:create',
    'asset:allocate',
    'asset:view_inventory',
    'ticket:create',
    'ticket:comment',
    'ticket:resolve'
  ],

  hr_manager: [
    'module:dashboard',
    'module:employees',
    'module:recruitment',
    'module:offboarding',
    'module:attendance',
    'module:leave',
    'module:loans',
    'module:expenses',
    'module:assets_helpdesk',
    'module:reports',
    'module:self_service',
    'tab:assets:helpdesk',
    'tab:expenses:claims',
    'tab:expenses:travel',
    'tab:leave:balance',
    'tab:leave:apply',
    'tab:leave:approvals',
    'tab:loans:active',
    'tab:loans:apply',
    'tab:loans:types',
    'employee:create',
    'employee:edit',
    'employee:delete',
    'employee:view',
    'recruitment:create_job',
    'recruitment:move_stage',
    'recruitment:hire',
    'offboarding:initiate',
    'offboarding:settle',
    'attendance:punch',
    'attendance:regularize',
    'attendance:manage_shifts',
    'leave:apply',
    'leave:approve',
    'leave:policy_create',
    'loan:apply',
    'loan:approve',
    'loan:type_create',
    'loan:delete',
    'expense:submit',
    'expense:review',
    'expense:admin_link',
    'reports:view',
    'ticket:create',
    'ticket:comment',
    'ticket:resolve',
    'field:employee:basic_pay',
    'field:employee:bank_account',
    'field:employee:pan_uan'
  ],

  hr_executive: [
    'module:dashboard',
    'module:employees',
    'module:recruitment',
    'module:attendance',
    'module:leave',
    'module:assets_helpdesk',
    'module:self_service',
    'tab:assets:helpdesk',
    'employee:create',
    'employee:edit',
    'employee:view',
    'recruitment:move_stage',
    'attendance:punch',
    'attendance:regularize',
    'leave:apply',
    'ticket:create',
    'ticket:comment'
  ],

  payroll_admin: [
    'module:dashboard',
    'module:employees',
    'module:column_master',
    'module:compensation',
    'module:payroll',
    'module:loans',
    'module:reports',
    'module:attendance',
    'module:leave',
    'module:self_service',
    'tab:loans:active',
    'tab:loans:apply',
    'tab:loans:types',
    'employee:view',
    'salary_component:create',
    'salary_component:edit',
    'salary_component:toggle',
    'salary_structure:create',
    'salary_structure:assign',
    'payroll:period_create',
    'payroll:run_draft',
    'payroll:run_validate',
    'payroll:run_calculate',
    'payroll:run_review',
    'payroll:send_payslips',
    'loan:apply',
    'loan:approve',
    'loan:type_create',
    'reports:view',
    'reports:export',
    'field:employee:basic_pay',
    'field:employee:bank_account',
    'field:employee:pan_uan'
  ],

  payroll_processor: [
    'module:dashboard',
    'module:payroll',
    'module:column_master',
    'module:compensation',
    'module:self_service',
    'payroll:run_draft',
    'payroll:run_validate',
    'payroll:run_calculate'
  ],

  finance_admin: [
    'module:dashboard',
    'module:payroll',
    'module:loans',
    'module:expenses',
    'module:offboarding',
    'module:reports',
    'module:self_service',
    'tab:expenses:claims',
    'tab:expenses:travel',
    'tab:loans:active',
    'tab:loans:apply',
    'tab:loans:types',
    'payroll:run_approve',
    'payroll:run_pay',
    'payroll:send_payslips',
    'loan:apply',
    'loan:approve',
    'loan:type_create',
    'loan:delete',
    'expense:submit',
    'expense:review',
    'offboarding:settle',
    'reports:view',
    'reports:export',
    'field:employee:basic_pay',
    'field:employee:bank_account',
    'field:employee:pan_uan'
  ],

  department_manager: [
    'module:dashboard',
    'module:attendance',
    'module:leave',
    'module:expenses',
    'module:assets_helpdesk',
    'module:self_service',
    'tab:assets:helpdesk',
    'tab:expenses:claims',
    'tab:expenses:travel',
    'tab:leave:balance',
    'tab:leave:apply',
    'tab:leave:approvals',
    'leave:apply',
    'leave:approve',
    'expense:submit',
    'expense:review',
    'attendance:punch',
    'attendance:regularize',
    'ticket:create',
    'ticket:comment'
  ],

  recruiter: [
    'module:dashboard',
    'module:recruitment',
    'module:self_service',
    'recruitment:create_job',
    'recruitment:move_stage'
  ],

  employee: [
    'module:dashboard',
    'module:self_service',
    'module:expenses',
    'module:assets_helpdesk',
    'tab:assets:helpdesk',
    'tab:expenses:claims',
    'tab:expenses:travel',
    'tab:leave:balance',
    'tab:leave:apply',
    'expense:submit',
    'leave:apply',
    'attendance:punch',
    'ticket:create',
    'ticket:comment',
    'offboarding:initiate'
  ]
};

/**
 * Computes effective permissions for a user from their assigned roles and any persisted role permissions.
 */
export async function getEffectivePermissionsForUser(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user || !user.active) {
    return [];
  }

  const roleNames = user.userRoles.map(ur => ur.role.name);
  if (roleNames.includes('platform_admin') || roleNames.includes('company_admin')) {
    return ALL_SYSTEM_PERMISSIONS.map(p => p.key);
  }

  const permissionSet = new Set<string>();

  for (const ur of user.userRoles) {
    // 1. Check custom persisted permissions on Role model
    if (ur.role.permissions && ur.role.permissions.length > 0) {
      for (const p of ur.role.permissions) {
        permissionSet.add(p);
      }
    } else {
      // 2. Fall back to standard authoritative default permissions
      const defaults = DEFAULT_ROLE_PERMISSIONS[ur.role.name] || [];
      for (const p of defaults) {
        permissionSet.add(p);
      }
    }
  }

  return Array.from(permissionSet);
}
