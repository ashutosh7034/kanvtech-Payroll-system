import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import {
  Shield,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  X,
  Building,
  UserCheck
} from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  department?: string;
  designation?: string;
  employeeCode?: string;
}

interface PermissionGroup {
  category: string;
  description: string;
  permissions: Array<{
    key: string;
    label: string;
    description: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

const PAYROLL_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: 'Payroll Visibility',
    description: 'Read-only access to payroll dashboards, salary summaries, and calculations',
    permissions: [
      { key: 'payroll:view_dashboard', label: 'View Payroll Studio', description: 'Access the main payroll overview workbench', riskLevel: 'LOW' },
      { key: 'payroll:view_runs', label: 'View Monthly Runs', description: 'Browse institutional and monthly payroll batches', riskLevel: 'LOW' },
      { key: 'payroll:view_employee_details', label: 'View Employee Slips', description: 'Inspect individual employee gross, deductions and net calculations', riskLevel: 'MEDIUM' },
      { key: 'payroll:view_salary_structures', label: 'View Salary CTC', description: 'Inspect compensation component master and CTC sheets', riskLevel: 'LOW' },
      { key: 'payroll:view_reports', label: 'View Statutory Reports', description: 'Access PF, ESI, PT and tax compliance summaries', riskLevel: 'LOW' }
    ]
  },
  {
    category: 'Payroll Preparation & Processing',
    description: 'Generate batches, run validations, and perform pure decimal math calculations',
    permissions: [
      { key: 'payroll:prepare', label: 'Initialize Monthly Batches', description: 'Create and redraft new monthly payroll runs', riskLevel: 'MEDIUM' },
      { key: 'payroll:edit_salary_inputs', label: 'Edit Salary Inputs', description: 'Modify monthly attendance adjustments and arrears', riskLevel: 'HIGH' },
      { key: 'payroll:validate', label: 'Execute Validation Scan', description: 'Verify LOP, salary structure presence and mid-month joinings', riskLevel: 'MEDIUM' },
      { key: 'payroll:calculate', label: 'Run Calculation Engine', description: 'Trigger pure decimal salary calculation engine', riskLevel: 'HIGH' },
      { key: 'payroll:resolve_errors', label: 'Resolve Validation Errors', description: 'Override or address payroll exceptions and blocks', riskLevel: 'HIGH' }
    ]
  },
  {
    category: 'Payroll Review & Variance Audit',
    description: 'Audit variances against prior runs, flag negative take-home, and submit for approval',
    permissions: [
      { key: 'payroll:review', label: 'Audit Payroll Variances', description: 'Analyze delta against prior runs and flag deductions > 50%', riskLevel: 'MEDIUM' },
      { key: 'payroll:request_corrections', label: 'Request Recalculation', description: 'Return runs for salary adjustments before approval', riskLevel: 'MEDIUM' },
      { key: 'payroll:submit_approval', label: 'Submit for Executive Signoff', description: 'Transition reviewed runs to pending approval queue', riskLevel: 'MEDIUM' }
    ]
  },
  {
    category: 'Disbursement Authorization (Executive Approval)',
    description: 'Authorized signoff for salary disbursal with Segregation of Duties (SOD)',
    permissions: [
      { key: 'payroll:approve', label: 'Authorize Payroll Disbursement', description: 'Formal executive authorization for salary fund disbursement', riskLevel: 'CRITICAL' },
      { key: 'payroll:reject', label: 'Reject Payroll Run', description: 'Reject reviewed payroll batch with formal audit justification', riskLevel: 'HIGH' }
    ]
  },
  {
    category: 'Income Tax (TDS) & Statutory Processing',
    description: 'Access tax slabs, compute monthly withholding, and port TDS into monthly salaries',
    permissions: [
      { key: 'payroll:access_tds', label: 'Access Income Tax Studio', description: 'View income tax projections and deductions', riskLevel: 'LOW' },
      { key: 'payroll:run_tax_assessment', label: 'Run Tax Calculations', description: 'Compute regime-based tax liability under Old/New regime', riskLevel: 'MEDIUM' },
      { key: 'payroll:port_tds', label: 'Port TDS to Monthly Salary', description: 'Post assessed tax deductions into active salary structures', riskLevel: 'HIGH' }
    ]
  },
  {
    category: 'Finance & Bank Advice (Disbursal)',
    description: 'Generate electronic bank advice (NEFT), record bank UTR, and finalize release',
    permissions: [
      { key: 'payroll:prepare_payment', label: 'Generate Bank NEFT Register', description: 'Export electronic bank payment file for corporate disbursal', riskLevel: 'HIGH' },
      { key: 'payroll:mark_paid', label: 'Record Bank UTR & Release Slips', description: 'Confirm settlement reference, recover loan EMIs, release to ESS', riskLevel: 'CRITICAL' }
    ]
  },
  {
    category: 'Administration & Policy Configuration',
    description: 'Manage permissions, role templates, and inspect audit logs',
    permissions: [
      { key: 'payroll:manage_permissions', label: 'Manage Payroll Access', description: 'Grant or revoke payroll capabilities for system users', riskLevel: 'CRITICAL' },
      { key: 'payroll:audit_logs', label: 'View Permission Audit Trail', description: 'Inspect historical access changes and actor records', riskLevel: 'LOW' }
    ]
  }
];

export const PayrollPermissionsView: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [inheritedPermissions, setInheritedPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');

  const isAdmin = hasRole(['company_admin', 'platform_admin']);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes]: any = await Promise.all([
        api.get('/employees').catch(() => ({ employees: [] })),
        api.get('/rbac/roles').catch(() => ({ roles: [] }))
      ]);

      const roleList = rRes.roles || [];
      setRoles(roleList);

      // Map employees into user items
      const userList: UserItem[] = (uRes.employees || []).map((emp: any) => ({
        id: emp.id,
        username: emp.employeeCode || emp.workEmail || emp.firstName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        email: emp.workEmail || 'N/A',
        roles: emp.roles || ['employee'],
        department: emp.department?.name || 'General',
        designation: emp.designation?.name || 'Staff',
        employeeCode: emp.employeeCode
      }));

      // Add seeded admin if not present
      if (!userList.some(u => u.roles.includes('company_admin'))) {
        userList.unshift({
          id: 'admin-user',
          username: 'admin',
          fullName: 'Institutional Administrator',
          email: 'admin@payflow.internal',
          roles: ['company_admin'],
          department: 'Executive Office',
          designation: 'Company Admin',
          employeeCode: 'ADM-001'
        });
      }

      setUsers(userList);
      if (userList.length > 0) {
        selectUser(userList[0], roleList);
      }
    } catch (err: any) {
      console.error('Failed to load users/roles for permissions dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (u: UserItem, roleList = roles) => {
    setSelectedUser(u);
    // Find matching role in role list
    const primaryRoleName = u.roles[0] || 'employee';
    const foundRole = roleList.find((r: any) => r.name === primaryRoleName) || roleList[0];
    setSelectedRole(foundRole);

    if (foundRole) {
      const perms = Array.isArray(foundRole.permissions) ? foundRole.permissions : [];
      setActivePermissions(perms);
      setInheritedPermissions(perms);
    } else {
      setActivePermissions([]);
      setInheritedPermissions([]);
    }
  };

  const handleSelectRole = (role: any) => {
    setSelectedRole(role);
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    setActivePermissions(perms);
    setInheritedPermissions(perms);
  };

  const togglePermission = (permKey: string) => {
    if (!isAdmin) {
      showToast('Only administrators can modify payroll permissions.', 'warning');
      return;
    }
    if (activePermissions.includes(permKey)) {
      setActivePermissions(activePermissions.filter(p => p !== permKey));
    } else {
      setActivePermissions([...activePermissions, permKey]);
    }
  };

  const applyTemplate = (templateName: string) => {
    let perms: string[] = [];
    switch (templateName) {
      case 'ADMIN':
        perms = PAYROLL_PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
        break;
      case 'PROCESSOR':
        perms = [
          'payroll:view_dashboard',
          'payroll:view_runs',
          'payroll:view_employee_details',
          'payroll:view_salary_structures',
          'payroll:view_reports',
          'payroll:prepare',
          'payroll:edit_salary_inputs',
          'payroll:validate',
          'payroll:calculate',
          'payroll:resolve_errors',
          'payroll:review',
          'payroll:request_corrections',
          'payroll:submit_approval',
          'payroll:access_tds',
          'payroll:run_tax_assessment',
          'payroll:port_tds'
        ];
        break;
      case 'APPROVER':
        perms = [
          'payroll:view_dashboard',
          'payroll:view_runs',
          'payroll:view_employee_details',
          'payroll:view_reports',
          'payroll:review',
          'payroll:approve',
          'payroll:reject'
        ];
        break;
      case 'FINANCE':
        perms = [
          'payroll:view_dashboard',
          'payroll:view_runs',
          'payroll:view_reports',
          'payroll:prepare_payment',
          'payroll:mark_paid'
        ];
        break;
      case 'AUDITOR':
        perms = [
          'payroll:view_dashboard',
          'payroll:view_runs',
          'payroll:view_employee_details',
          'payroll:view_salary_structures',
          'payroll:view_reports',
          'payroll:access_tds',
          'payroll:audit_logs'
        ];
        break;
      default:
        perms = [];
    }
    setActivePermissions(perms);
    showToast(`Applied '${templateName}' role template. Click 'Save Changes' to enforce.`, 'success');
  };

  const savePermissions = async () => {
    if (!selectedRole) {
      showToast('No role selected for updating permissions.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/rbac/roles/${selectedRole.id}/permissions`, {
        permissions: activePermissions
      });
      showToast(`Permissions successfully updated and enforced for role '${selectedRole.label || selectedRole.name}'.`, 'success');
      // Update local state
      setRoles(roles.map(r => r.id === selectedRole.id ? { ...r, permissions: activePermissions } : r));
    } catch (err: any) {
      showToast(err.message || 'Failed to persist permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Segregation of Duties Check
  const hasPrep = activePermissions.some(p => ['payroll:prepare', 'payroll:calculate', 'payroll:validate'].includes(p));
  const hasApprove = activePermissions.includes('payroll:approve');
  const hasDisburse = activePermissions.includes('payroll:mark_paid');
  const hasSodConflict = (hasPrep && hasApprove) || (hasApprove && hasDisburse);

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.department?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            background: toastType === 'success' ? '#065f46' : toastType === 'warning' ? '#92400e' : '#991b1b',
            color: '#ffffff',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            fontWeight: 500
          }}
        >
          {toastType === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Standard PageHeader */}
      <PageHeader
        title="Payroll Access Control & Permissions Studio"
        subtitle="Authoritative role-based permission management, segregation of duties enforcement, and real-time backend synchronization."
        breadcrumbs={[
          { label: 'Access Control & Admin' },
          { label: 'Payroll Permissions' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Admin Controlled</span>}
        actions={
          isAdmin && (
            <button
              className="btn btn-primary btn-sm"
              onClick={savePermissions}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={14} /> {saving ? 'Persisting...' : 'Save Permissions'}
            </button>
          )
        }
      />

      {/* Segregation of Duties Warning Banner */}
      {hasSodConflict && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            color: '#92400e',
            fontSize: '0.825rem'
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Segregation of Duties (SOD) Warning:</strong> This configuration combines{' '}
            {hasPrep && hasApprove && <span><strong>Preparation</strong> and <strong>Approval</strong> authority</span>}
            {hasApprove && hasDisburse && <span><strong>Approval</strong> and <strong>Disbursal</strong> authority</span>}.
            In strict compliance environments, the initiator or calculator of a payroll run cannot self-approve or execute payment.
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', alignItems: 'start' }}>
        {/* Left Column: User & Role Directory */}
        <div className="panel" style={{ padding: '16px', margin: 0, height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} /> Directory & Role Assignments
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search user, code, dept..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          {/* Role Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              className={`btn btn-xs ${roleFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('ALL')}
            >
              All
            </button>
            <button
              className={`btn btn-xs ${roleFilter === 'company_admin' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('company_admin')}
            >
              Admins
            </button>
            <button
              className={`btn btn-xs ${roleFilter === 'payroll_admin' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('payroll_admin')}
            >
              Payroll
            </button>
            <button
              className={`btn btn-xs ${roleFilter === 'finance_admin' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRoleFilter('finance_admin')}
            >
              Finance
            </button>
          </div>

          {/* User List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredUsers.map(u => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => selectUser(u)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(2, 132, 199, 0.06)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem', color: isSelected ? 'var(--primary)' : 'inherit' }}>
                      {u.fullName}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {u.employeeCode || 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {u.designation} • {u.department}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {u.roles.map(r => (
                      <span key={r} className="badge badge-brand" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                        {r.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Configuration Studio */}
        <div className="panel" style={{ padding: '20px', margin: 0, height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {selectedUser ? (
            <div>
              {/* User Profile Summary Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    Selected User Profile
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '2px 0 0' }}>
                    {selectedUser.fullName}{' '}
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                      ({selectedUser.employeeCode})
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedUser.email} • {selectedUser.department} • {selectedUser.designation}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Configuring Role:</span>
                  <select
                    className="form-control"
                    value={selectedRole?.id || ''}
                    onChange={e => {
                      const r = roles.find(rl => rl.id === e.target.value);
                      if (r) handleSelectRole(r);
                    }}
                    style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '160px' }}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label || r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Standard Role Templates */}
              {isAdmin && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="var(--primary)" /> Apply Standard Role Template
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-xs" onClick={() => applyTemplate('ADMIN')}>
                      Admin (Full Studio)
                    </button>
                    <button className="btn btn-outline btn-xs" onClick={() => applyTemplate('PROCESSOR')}>
                      Payroll Processor (Prep + Calc + TDS)
                    </button>
                    <button className="btn btn-outline btn-xs" onClick={() => applyTemplate('APPROVER')}>
                      Executive Approver (Review + Signoff)
                    </button>
                    <button className="btn btn-outline btn-xs" onClick={() => applyTemplate('FINANCE')}>
                      Finance Disburser (NEFT + Paid)
                    </button>
                    <button className="btn btn-outline btn-xs" onClick={() => applyTemplate('AUDITOR')}>
                      Read-Only Auditor
                    </button>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setActivePermissions([])}
                      style={{ color: '#ef4444' }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              {/* Categorized Permissions Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {PAYROLL_PERMISSION_GROUPS.map(group => {
                  const groupKeys = group.permissions.map(p => p.key);
                  const allSelected = groupKeys.every(k => activePermissions.includes(k));
                  const someSelected = groupKeys.some(k => activePermissions.includes(k));

                  return (
                    <div
                      key={group.category}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Group Header */}
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.875rem' }}>{group.category}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.description}</div>
                        </div>

                        {isAdmin && (
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => {
                              if (allSelected) {
                                setActivePermissions(activePermissions.filter(k => !groupKeys.includes(k)));
                              } else {
                                setActivePermissions([...new Set([...activePermissions, ...groupKeys])]);
                              }
                            }}
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      {/* Permission Items */}
                      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {group.permissions.map(p => {
                          const isChecked = activePermissions.includes(p.key);
                          return (
                            <div
                              key={p.key}
                              onClick={() => togglePermission(p.key)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: 'var(--radius-sm)',
                                background: isChecked ? 'rgba(2, 132, 199, 0.04)' : 'transparent',
                                cursor: isAdmin ? 'pointer' : 'default',
                                userSelect: 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    border: isChecked ? '1px solid var(--primary)' : '1px solid #cbd5e1',
                                    background: isChecked ? 'var(--primary)' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff'
                                  }}
                                >
                                  {isChecked && <Check size={13} strokeWidth={3} />}
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{p.label}</div>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{p.description}</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.675rem', color: '#64748b' }}>
                                  {p.key}
                                </span>
                                {p.riskLevel && (
                                  <span
                                    className={`badge ${
                                      p.riskLevel === 'CRITICAL'
                                        ? 'badge-danger'
                                        : p.riskLevel === 'HIGH'
                                        ? 'badge-warning'
                                        : 'badge-gray'
                                    }`}
                                    style={{ fontSize: '0.65rem' }}
                                  >
                                    {p.riskLevel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserCheck size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <div>Select a user from the directory on the left to inspect or configure their payroll permissions.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
