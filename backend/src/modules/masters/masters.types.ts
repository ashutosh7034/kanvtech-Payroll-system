export type MasterCategoryKey =
  | 'companies'
  | 'branches'
  | 'departments'
  | 'designations'
  | 'grades'
  | 'divisions'
  | 'units'
  | 'categories'
  | 'projects'
  | 'job-positions'
  | 'salary-components'
  | 'salary-templates'
  | 'loan-types'
  | 'shift-policies'
  | 'leave-policies'
  | 'expense-categories'
  | 'helpdesk-categories';

export type MasterGroup = 'organization' | 'payroll' | 'attendance' | 'operations';

export interface MasterFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'time';
  required?: boolean;
  options?: { value: string; label: string }[];
  parentCategory?: MasterCategoryKey;
  placeholder?: string;
  readOnly?: boolean;
}

export interface MasterCategoryConfig {
  key: MasterCategoryKey;
  label: string;
  singularLabel: string;
  group: MasterGroup;
  description: string;
  icon: string;
  model: string;
  codeField: string;
  nameField: string;
  supportsActiveToggle: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  fields: MasterFieldDefinition[];
  defaultOrderBy: { field: string; direction: 'asc' | 'desc' };
}
