import { UserProfile } from '../contexts/AuthContext';

export type PermissionKey =
  // Modules
  | 'module:dashboard'
  | 'module:employees'
  | 'module:recruitment'
  | 'module:offboarding'
  | 'module:attendance'
  | 'module:leave'
  | 'module:column_master'
  | 'module:compensation'
  | 'module:payroll'
  | 'module:loans'
  | 'module:expenses'
  | 'module:assets_helpdesk'
  | 'module:reports'
  | 'module:self_service'
  // Tabs
  | 'tab:assets:inventory'
  | 'tab:assets:helpdesk'
  | 'tab:expenses:claims'
  | 'tab:expenses:travel'
  | 'tab:leave:balance'
  | 'tab:leave:apply'
  | 'tab:leave:approvals'
  | 'tab:loans:active'
  | 'tab:loans:apply'
  | 'tab:loans:types'
  // Actions
  | 'asset:create'
  | 'asset:allocate'
  | 'asset:view_inventory'
  | 'ticket:create'
  | 'ticket:comment'
  | 'ticket:resolve'
  | 'employee:create'
  | 'employee:edit'
  | 'employee:delete'
  | 'employee:view'
  | 'recruitment:create_job'
  | 'recruitment:move_stage'
  | 'recruitment:hire'
  | 'offboarding:initiate'
  | 'offboarding:settle'
  | 'attendance:punch'
  | 'attendance:regularize'
  | 'attendance:manage_shifts'
  | 'leave:apply'
  | 'leave:approve'
  | 'leave:policy_create'
  | 'salary_component:create'
  | 'salary_component:edit'
  | 'salary_component:toggle'
  | 'salary_structure:create'
  | 'salary_structure:assign'
  | 'payroll:period_create'
  | 'payroll:run_draft'
  | 'payroll:run_validate'
  | 'payroll:run_calculate'
  | 'payroll:run_review'
  | 'payroll:run_approve'
  | 'payroll:run_pay'
  | 'payroll:send_payslips'
  | 'loan:apply'
  | 'loan:approve'
  | 'loan:type_create'
  | 'loan:delete'
  | 'expense:submit'
  | 'expense:review'
  | 'expense:admin_link'
  | 'reports:view'
  | 'reports:export'
  | 'rbac:manage'
  // Fields
  | 'field:employee:basic_pay'
  | 'field:employee:bank_account'
  | 'field:employee:pan_uan';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'module:dashboard', 'module:employees', 'module:recruitment', 'module:offboarding',
  'module:attendance', 'module:leave', 'module:column_master', 'module:compensation',
  'module:payroll', 'module:loans', 'module:expenses', 'module:assets_helpdesk',
  'module:reports', 'module:self_service',
  'tab:assets:inventory', 'tab:assets:helpdesk', 'tab:expenses:claims', 'tab:expenses:travel',
  'tab:leave:balance', 'tab:leave:apply', 'tab:leave:approvals', 'tab:loans:active',
  'tab:loans:apply', 'tab:loans:types',
  'asset:create', 'asset:allocate', 'asset:view_inventory',
  'ticket:create', 'ticket:comment', 'ticket:resolve',
  'employee:create', 'employee:edit', 'employee:delete', 'employee:view',
  'recruitment:create_job', 'recruitment:move_stage', 'recruitment:hire',
  'offboarding:initiate', 'offboarding:settle',
  'attendance:punch', 'attendance:regularize', 'attendance:manage_shifts',
  'leave:apply', 'leave:approve', 'leave:policy_create',
  'salary_component:create', 'salary_component:edit', 'salary_component:toggle',
  'salary_structure:create', 'salary_structure:assign',
  'payroll:period_create', 'payroll:run_draft', 'payroll:run_validate', 'payroll:run_calculate',
  'payroll:run_review', 'payroll:run_approve', 'payroll:run_pay', 'payroll:send_payslips',
  'loan:apply', 'loan:approve', 'loan:type_create', 'loan:delete',
  'expense:submit', 'expense:review', 'expense:admin_link',
  'reports:view', 'reports:export', 'rbac:manage',
  'field:employee:basic_pay', 'field:employee:bank_account', 'field:employee:pan_uan'
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  platform_admin: ALL_PERMISSIONS,
  company_admin: ALL_PERMISSIONS,

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

export const MODULE_PERMISSION_MAP: Record<string, PermissionKey> = {
  dashboard: 'module:dashboard',
  employees: 'module:employees',
  recruitment: 'module:recruitment',
  offboarding: 'module:offboarding',
  attendance: 'module:attendance',
  leave: 'module:leave',
  'column-master': 'module:column_master',
  compensation: 'module:compensation',
  payroll: 'module:payroll',
  loans: 'module:loans',
  expenses: 'module:expenses',
  'assets-helpdesk': 'module:assets_helpdesk',
  reports: 'module:reports',
  self: 'module:self_service',
  'my-leave': 'module:self_service',
  'my-payslips': 'module:self_service'
};

/**
 * Resolves effective permissions for the authenticated user from server payload or role defaults.
 */
export function computeEffectivePermissions(user: UserProfile | null): Set<string> {
  if (!user) return new Set();

  if (user.roles.includes('platform_admin') || user.roles.includes('company_admin')) {
    return new Set(ALL_PERMISSIONS);
  }

  // Use permissions array provided by server if available
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return new Set(user.permissions);
  }

  // Fallback to client-side default role mapping
  const perms = new Set<string>();
  for (const role of user.roles) {
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    for (const p of rolePerms) perms.add(p);
  }
  return perms;
}

export function canViewModule(moduleKey: string, user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.includes('company_admin') || user.roles.includes('platform_admin')) return true;

  const permKey = MODULE_PERMISSION_MAP[moduleKey];
  if (!permKey) return false;

  const perms = computeEffectivePermissions(user);
  return perms.has(permKey);
}

export function canViewPage(pageKey: string, user: UserProfile | null): boolean {
  return canViewModule(pageKey, user);
}

export function canViewTab(tabKey: string, user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.includes('company_admin') || user.roles.includes('platform_admin')) return true;

  const perms = computeEffectivePermissions(user);
  return perms.has(tabKey);
}

export function canPerformAction(actionKey: string, user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.includes('company_admin') || user.roles.includes('platform_admin')) return true;

  const perms = computeEffectivePermissions(user);
  return perms.has(actionKey);
}

export function canViewField(fieldKey: string, user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.includes('company_admin') || user.roles.includes('platform_admin')) return true;

  const perms = computeEffectivePermissions(user);
  return perms.has(fieldKey);
}

export function canAccessRecord(record: { companyId?: string }, user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.roles.includes('platform_admin')) return true;
  if (record.companyId && record.companyId !== user.companyId) return false;
  return true;
}
