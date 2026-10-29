import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import {
  CalendarCheck,
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Shield,
  Layers,
  Settings,
  Filter,
  Eye,
  FileText
} from 'lucide-react';

export const LeaveView: React.FC = () => {
  const { user, hasRole } = useAuth();
  const isHrOrAdmin = hasRole(['company_admin', 'hr_manager', 'platform_admin']);
  const isManager = hasRole(['department_manager', 'hr_manager', 'company_admin', 'platform_admin']);

  const [activeTab, setActiveTab] = useState<'approvals' | 'policies'>('approvals');

  // Approvals State
  const [requests, setRequests] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterEmployee, setFilterEmployee] = useState<string>('');
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Action Modal State (Approve / Reject)
  const [actionTarget, setActionTarget] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [actionComment, setActionComment] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Policy Master State
  const [policies, setPolicies] = useState<any[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyFormError, setPolicyFormError] = useState<string | null>(null);

  // Policy Form Fields
  const [polCode, setPolCode] = useState('');
  const [polName, setPolName] = useState('');
  const [polQuota, setPolQuota] = useState(12);
  const [polIsPaid, setPolIsPaid] = useState(true);
  const [polCarryForward, setPolCarryForward] = useState(0);
  const [polEncashable, setPolEncashable] = useState(false);
  const [polAdvanceNotice, setPolAdvanceNotice] = useState(0);
  const [polMaxConsecutive, setPolMaxConsecutive] = useState(30);
  const [polAllowHalfDay, setPolAllowHalfDay] = useState(true);
  const [polRequiresAttachment, setPolRequiresAttachment] = useState(false);
  const [polProbationAllowed, setPolProbationAllowed] = useState(true);

  // Adjustment Form Fields
  const [adjEmployeeId, setAdjEmployeeId] = useState('');
  const [adjPolicyId, setAdjPolicyId] = useState('');
  const [adjDays, setAdjDays] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Load Requests
  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const queryParams = new URLSearchParams();
      if (filterStatus && filterStatus !== 'ALL') queryParams.append('status', filterStatus);
      if (filterDepartment) queryParams.append('departmentId', filterDepartment);
      if (filterEmployee) queryParams.append('employeeId', filterEmployee);

      const res: any = await api.get(`/leave/requests?${queryParams.toString()}`);
      setRequests(res.requests || res.applications || []);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Load Policies & Metadata
  const loadPoliciesAndMetadata = async () => {
    try {
      setLoadingPolicies(true);
      const [polRes, depRes, empRes]: any = await Promise.all([
        api.get('/masters/leave-policies?status=ACTIVE&all=true').catch(() => api.get('/leave/policies')),
        api.get('/masters/departments?status=ACTIVE&all=true').catch(() => api.get('/org/departments')).catch(() => ({ departments: [] })),
        api.get('/employees').catch(() => ({ employees: [] }))
      ]);
      const policyList = polRes.records || polRes.policies || [];
      const departmentList = depRes.records || depRes.departments || [];
      setPolicies(policyList);
      setDepartments(departmentList);
      setEmployees(empRes.employees || []);

      if (policyList[0] && !adjPolicyId) setAdjPolicyId(policyList[0].id);
      if (empRes.employees?.[0] && !adjEmployeeId) setAdjEmployeeId(empRes.employees[0].id);
    } catch (err) {
      console.error('Failed to load leave policies:', err);
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filterStatus, filterDepartment, filterEmployee]);

  useEffect(() => {
    loadPoliciesAndMetadata();
  }, []);

  // Handle Approve / Reject Action
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;

    if (actionType === 'REJECTED' && (!actionComment || !actionComment.trim())) {
      setActionError('A valid rejection reason is mandatory when rejecting a leave request.');
      return;
    }

    setActionError(null);
    setIsActioning(true);

    try {
      await api.post(`/leave/applications/${actionTarget.id}/action`, {
        status: actionType,
        rejectionReason: actionType === 'REJECTED' ? actionComment : undefined,
        approverComment: actionComment
      });

      setActionTarget(null);
      setActionComment('');
      loadRequests();
    } catch (err: any) {
      setActionError(err.message || 'Failed to process leave action');
    } finally {
      setIsActioning(false);
    }
  };

  // Handle Create Policy
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyFormError(null);
    setIsSavingPolicy(true);

    try {
      await api.post('/leave/policies', {
        code: polCode.trim().toUpperCase(),
        name: polName.trim(),
        annualQuota: Number(polQuota),
        isPaid: polIsPaid,
        maxCarryForward: Number(polCarryForward),
        encashable: polEncashable,
        minAdvanceNoticeDays: Number(polAdvanceNotice),
        maxConsecutiveDays: Number(polMaxConsecutive),
        allowHalfDay: polAllowHalfDay,
        requiresAttachment: polRequiresAttachment,
        probationAllowed: polProbationAllowed
      });

      setShowPolicyModal(false);
      setPolCode('');
      setPolName('');
      loadPoliciesAndMetadata();
    } catch (err: any) {
      setPolicyFormError(err.message || 'Failed to create leave policy');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Handle Manual Balance Adjustment
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    setIsAdjusting(true);

    try {
      await api.post('/leave/balances/adjust', {
        employeeId: adjEmployeeId,
        leavePolicyId: adjPolicyId,
        adjustmentDays: Number(adjDays),
        reason: adjReason
      });

      setShowAdjustModal(false);
      setAdjDays(0);
      setAdjReason('');
      alert('Leave balance successfully adjusted and audit trail logged.');
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust balance');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Page Header */}
      <PageHeader
        title="Leave Approvals & Policy Management"
        subtitle="Review team leave applications, attendance impact & enterprise leave quota configurations"
        breadcrumbs={[
          { label: 'Time Management' },
          { label: 'Leave Management' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Attendance Linked</span>}
        actions={
          isHrOrAdmin && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setAdjustError(null); setShowAdjustModal(true); }}
              >
                <Settings size={14} /> Adjust Quotas
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setPolicyFormError(null); setShowPolicyModal(true); }}
              >
                <Plus size={14} /> New Leave Policy
              </button>
            </div>
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'approvals' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('approvals')}
        >
          <UserCheck size={14} /> Team Leave Approvals
        </button>
        {isHrOrAdmin && (
          <button
            className={`btn btn-sm ${activeTab === 'policies' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('policies')}
          >
            <Layers size={14} /> Policy & Quotas Configuration
          </button>
        )}
      </div>

      {/* TAB 1: TEAM LEAVE APPROVALS */}
      {activeTab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          <div className="panel" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <Filter size={14} /> Filter Requests:
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
                <button
                  key={st}
                  className={`btn btn-xs ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterStatus(st)}
                >
                  {st === 'PENDING' ? 'Pending Approval' : st}
                </button>
              ))}
            </div>

            {departments.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <select
                  className="form-select"
                  style={{ width: '180px', padding: '4px 8px', fontSize: '0.78rem' }}
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Requests Table */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={16} color="var(--primary)" /> Team Leave Applications ({requests.length})
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isHrOrAdmin ? 'Organization-wide scope' : 'Direct reporting team scope'}
              </span>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Policy</th>
                    <th>Dates Range</th>
                    <th>Working Days</th>
                    <th>Duration</th>
                    <th>Reason Given</th>
                    <th>Current Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        Loading leave requests...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No leave requests found matching the current filter.
                      </td>
                    </tr>
                  ) : (
                    requests.map(req => {
                      const isOwner = req.employeeId === user?.employeeId;
                      return (
                        <tr key={req.id}>
                          <td>
                            <strong>{req.employee?.firstName} {req.employee?.lastName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {req.employee?.employeeCode} • {req.employee?.department?.name || 'Department'}
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                              {req.leavePolicy?.code}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {req.leavePolicy?.name} ({req.leavePolicy?.isPaid ? 'Paid' : 'Unpaid LOP'})
                            </div>
                          </td>
                          <td>
                            <div>{new Date(req.fromDate).toLocaleDateString('en-IN')}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              to {new Date(req.toDate).toLocaleDateString('en-IN')}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontSize: '0.95rem' }}>{Number(req.totalDays)} Days</strong>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {req.durationType === 'FULL_DAY' ? 'Full Day' : req.durationType === 'FIRST_HALF' ? '1st Half' : '2nd Half'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.reason}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                req.status === 'APPROVED'
                                  ? 'badge-approved'
                                  : req.status === 'PENDING'
                                  ? 'badge-warning'
                                  : req.status === 'REJECTED'
                                  ? 'badge-danger'
                                  : 'badge-neutral'
                              }`}
                            >
                              {req.status}
                            </span>
                            {req.approvedBy && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                by {req.approvedBy}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {req.status === 'PENDING' ? (
                              isOwner ? (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Own Request
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    className="btn btn-xs btn-primary"
                                    onClick={() => {
                                      setActionTarget(req);
                                      setActionType('APPROVED');
                                      setActionComment('Approved by manager');
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-xs btn-outline"
                                    style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}
                                    onClick={() => {
                                      setActionTarget(req);
                                      setActionType('REJECTED');
                                      setActionComment('');
                                    }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              )
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {req.actionedAt ? new Date(req.actionedAt).toLocaleDateString('en-IN') : 'Actioned'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POLICY & QUOTAS CONFIGURATION */}
      {activeTab === 'policies' && isHrOrAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}>
              <div>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--primary)" /> Enterprise Leave Policy Master
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Institutional entitlement quotas, notice rules and Loss of Pay (LOP) integration
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {policies.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                      {p.code}
                    </span>
                    <span className={`badge ${p.isPaid ? 'badge-approved' : 'badge-danger'}`}>
                      {p.isPaid ? 'Paid Leave' : 'Unpaid (LOP)'}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{p.name}</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {p.isPaid ? 'Maintains full payable days during monthly payroll' : 'Deducts payable days as Loss of Pay (LOP)'}
                    </p>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px', fontSize: '0.78rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Annual Allocation:</span>
                      <strong> {Number(p.annualQuota)} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Max Carry Forward:</span>
                      <strong> {Number(p.maxCarryForward || 0)} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Advance Notice:</span>
                      <strong> {p.minAdvanceNoticeDays || 0} Day(s)</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Max Consecutive:</span>
                      <strong> {p.maxConsecutiveDays || 30} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Half Day Allowed:</span>
                      <strong> {p.allowHalfDay ? 'Yes' : 'No'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Attachment Req:</span>
                      <strong> {p.requiresAttachment ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* APPROVE / REJECT ACTION MODAL */}
      {actionTarget && (
        <FormModal
          isOpen={Boolean(actionTarget)}
          onClose={() => setActionTarget(null)}
          title={`${actionType === 'APPROVED' ? 'Approve' : 'Reject'} Leave Request`}
          subtitle={`Employee: ${actionTarget.employee?.firstName} ${actionTarget.employee?.lastName} (${actionTarget.employee?.employeeCode})`}
          icon={actionType === 'APPROVED' ? <CheckCircle2 size={18} color="var(--success)" /> : <XCircle size={18} color="var(--danger)" />}
          width="md"
          onSubmit={handleExecuteAction}
          submitLabel={actionType === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
          isSubmitting={isActioning}
        >
          {actionError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {actionError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '0.8125rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Leave Policy</span>
              <strong>{actionTarget.leavePolicy?.name} ({actionTarget.leavePolicy?.code})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Requested Days</span>
              <strong>{Number(actionTarget.totalDays)} Days ({actionTarget.durationType})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Period</span>
              <strong>{new Date(actionTarget.fromDate).toLocaleDateString('en-IN')} to {new Date(actionTarget.toDate).toLocaleDateString('en-IN')}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Payroll Payability</span>
              <strong>{actionTarget.leavePolicy?.isPaid ? '100% Paid (No LOP)' : 'Deducts LOP Days'}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Employee's Stated Reason</label>
            <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8125rem' }}>
              {actionTarget.reason}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              {actionType === 'APPROVED' ? 'Approval Comments (Optional)' : 'Rejection Reason * (Mandatory)'}
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder={actionType === 'APPROVED' ? 'e.g. Approved as per project staffing plan' : 'Provide specific reason for rejection...'}
              value={actionComment}
              onChange={e => setActionComment(e.target.value)}
              required={actionType === 'REJECTED'}
            />
          </div>
        </FormModal>
      )}

      {/* CREATE NEW LEAVE POLICY MODAL */}
      {showPolicyModal && (
        <FormModal
          isOpen={showPolicyModal}
          onClose={() => setShowPolicyModal(false)}
          title="Create New Institutional Leave Policy"
          subtitle="Configure quota, payability, notice rules and half-day allowances"
          icon={<Plus size={18} />}
          width="md"
          onSubmit={handleCreatePolicy}
          submitLabel="Save Policy"
          isSubmitting={isSavingPolicy}
        >
          {policyFormError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {policyFormError}
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Policy Code *</label>
              <input
                className="form-input"
                placeholder="e.g. PL, SL, MAT, PAT"
                value={polCode}
                onChange={e => setPolCode(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Policy Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Privilege / Annual Leave"
                value={polName}
                onChange={e => setPolName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Annual Quota (Days) *</label>
              <input
                className="form-input"
                type="number"
                step="0.5"
                min="0"
                value={polQuota}
                onChange={e => setPolQuota(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payability Classification *</label>
              <select
                className="form-select"
                value={polIsPaid ? 'true' : 'false'}
                onChange={e => setPolIsPaid(e.target.value === 'true')}
              >
                <option value="true">100% Paid Leave</option>
                <option value="false">Unpaid Leave (Loss of Pay / LOP)</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Min Advance Notice (Days)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={polAdvanceNotice}
                onChange={e => setPolAdvanceNotice(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Consecutive Days</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={polMaxConsecutive}
                onChange={e => setPolMaxConsecutive(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={polAllowHalfDay}
                onChange={e => setPolAllowHalfDay(e.target.checked)}
              />
              Allow Half-Day Requests
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={polRequiresAttachment}
                onChange={e => setPolRequiresAttachment(e.target.checked)}
              />
              Require Supporting Document
            </label>
          </div>
        </FormModal>
      )}

      {/* ADJUST BALANCE MODAL */}
      {showAdjustModal && (
        <FormModal
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          title="Manual Leave Quota Adjustment"
          subtitle="Credit or adjust leave days with mandatory reason and immutable audit trail"
          icon={<Settings size={18} />}
          width="md"
          onSubmit={handleAdjustBalance}
          submitLabel="Save Adjustment"
          isSubmitting={isAdjusting}
        >
          {adjustError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {adjustError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select
              className="form-select"
              value={adjEmployeeId}
              onChange={e => setAdjEmployeeId(e.target.value)}
              required
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Leave Policy *</label>
            <select
              className="form-select"
              value={adjPolicyId}
              onChange={e => setAdjPolicyId(e.target.value)}
              required
            >
              {policies.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Adjustment Days (+/-) *</label>
            <input
              type="number"
              step="0.5"
              className="form-input"
              placeholder="e.g. 2 for credit, -1 for deduction"
              value={adjDays}
              onChange={e => setAdjDays(Number(e.target.value))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Adjustment Reason / Order Number *</label>
            <input
              className="form-input"
              placeholder="e.g. Compensatory off credit / Annual policy adjustment"
              value={adjReason}
              onChange={e => setAdjReason(e.target.value)}
              required
            />
          </div>
        </FormModal>
      )}
    </div>
  );
};
