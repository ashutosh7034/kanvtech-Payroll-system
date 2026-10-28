import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCheck,
  ShieldCheck,
  CreditCard,
  Search,
  Filter,
  Eye,
  Calculator,
  TrendingUp,
  TrendingDown,
  X,
  FileText,
  DollarSign,
  ChevronRight,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DetailedCalculationModal } from './DetailedCalculationModal';

interface DepartmentPayrollWorkspaceProps {
  periods: any[];
  initialPeriodId?: string;
  onRefreshRuns?: () => void;
}

export const DepartmentPayrollWorkspace: React.FC<DepartmentPayrollWorkspaceProps> = ({
  periods,
  initialPeriodId,
  onRefreshRuns
}) => {
  const { hasRole, user } = useAuth();

  // Filter States
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(initialPeriodId || (periods[0]?.id ?? ''));
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('ALL');
  const [processingStatusFilter, setProcessingStatusFilter] = useState<string>('ALL');

  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [activeRun, setActiveRun] = useState<any | null>(null);

  // Action / Transition States
  const [processingBatch, setProcessingBatch] = useState<boolean>(false);
  const [advancingStage, setAdvancingStage] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Sub-Modals
  const [selectedBreakdownRow, setSelectedBreakdownRow] = useState<any | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState<boolean>(false);
  const [inspectIneligibleRow, setInspectIneligibleRow] = useState<any | null>(null);

  // Rejection Dialog State
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejecting, setRejecting] = useState<boolean>(false);

  // Load departments list if not loaded
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res: any = await api.get('/org/departments');
        setDepartments(res.departments || res || []);
      } catch (err) {
        console.warn('Failed to load departments:', err);
      }
    };
    fetchDepts();
  }, []);

  // Update selectedPeriodId when initialPeriodId changes
  useEffect(() => {
    if (initialPeriodId && initialPeriodId !== selectedPeriodId) {
      setSelectedPeriodId(initialPeriodId);
    } else if (!selectedPeriodId && periods.length > 0) {
      setSelectedPeriodId(periods[0].id);
    }
  }, [initialPeriodId, periods]);

  // Load workspace data whenever primary filters change
  const fetchWorkspace = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setErrorToast(null);

    try {
      const params = new URLSearchParams();
      params.append('periodId', selectedPeriodId);
      if (selectedDeptId && selectedDeptId !== 'ALL') params.append('departmentId', selectedDeptId);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (eligibilityFilter && eligibilityFilter !== 'ALL') params.append('eligibility', eligibilityFilter);
      if (processingStatusFilter && processingStatusFilter !== 'ALL') params.append('processingStatus', processingStatusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res: any = await api.get(`/payroll/department/workspace?${params.toString()}`);
      setWorkspaceData(res);
      setEmployees(res.employees || []);
      setActiveRun(res.activeRun || null);

      if (res.departments && res.departments.length > 0) {
        setDepartments(res.departments);
      }

      // Default select all eligible employees if none selected yet
      const eligibleIds = (res.employees || []).filter((e: any) => e.isEligible).map((e: any) => e.employeeId);
      setSelectedEmployeeIds(eligibleIds);
    } catch (err: any) {
      setErrorToast(err?.message || 'Failed to load department payroll workspace data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [selectedPeriodId, selectedDeptId, statusFilter, eligibilityFilter, processingStatusFilter]);

  // Selection handlers
  const handleToggleSelectAllEligible = () => {
    const eligibleEmployees = employees.filter(e => e.isEligible);
    if (selectedEmployeeIds.length === eligibleEmployees.length && eligibleEmployees.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(eligibleEmployees.map(e => e.employeeId));
    }
  };

  const handleToggleSelectEmployee = (empId: string) => {
    if (selectedEmployeeIds.includes(empId)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== empId));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, empId]);
    }
  };

  // Process Batch Handler
  const handleProcessDepartmentBatch = async () => {
    if (!selectedPeriodId) {
      setErrorToast('Please select a valid payroll period');
      return;
    }
    if (!selectedDeptId || selectedDeptId === 'ALL') {
      setErrorToast('Please select a specific department to process a department batch');
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      setErrorToast('Please select at least one eligible employee to process');
      return;
    }

    setProcessingBatch(true);
    setErrorToast(null);

    try {
      const payload = {
        periodId: selectedPeriodId,
        departmentId: selectedDeptId,
        selectedEmployeeIds,
        remarks: `Department batch processing initiated by ${user?.fullName || 'operator'}`
      };

      const res: any = await api.post('/payroll/department/process', payload);
      setSuccessToast(`Successfully processed department batch: ${res.summary?.processedCount || 0} employees calculated.`);
      setActiveRun(res.run);
      await fetchWorkspace();
      if (onRefreshRuns) onRefreshRuns();
    } catch (err: any) {
      setErrorToast(err?.message || 'Department batch processing failed');
    } finally {
      setProcessingBatch(false);
    }
  };

  // Run Stage Transitions
  const handleAdvanceStage = async (stageEndpoint: string, successMessage: string) => {
    if (!activeRun) return;
    setAdvancingStage(true);
    setErrorToast(null);

    try {
      const res: any = await api.post(`/payroll/runs/${activeRun.id}/${stageEndpoint}`, {});
      setSuccessToast(successMessage);
      setActiveRun(res.run || null);
      await fetchWorkspace();
      if (onRefreshRuns) onRefreshRuns();
    } catch (err: any) {
      setErrorToast(err?.message || `Failed to advance payroll stage: ${stageEndpoint}`);
    } finally {
      setAdvancingStage(false);
    }
  };

  // Reject Batch Handler
  const handleRejectBatch = async () => {
    if (!activeRun) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      setErrorToast('Please provide a descriptive rejection reason (minimum 5 characters)');
      return;
    }

    setRejecting(true);
    setErrorToast(null);

    try {
      const res: any = await api.post(`/payroll/runs/${activeRun.id}/reject`, {
        reason: rejectionReason.trim()
      });
      setSuccessToast(`Batch rejected and returned to VALIDATED state: ${rejectionReason}`);
      setShowRejectModal(false);
      setRejectionReason('');
      setActiveRun(res.run || null);
      await fetchWorkspace();
      if (onRefreshRuns) onRefreshRuns();
    } catch (err: any) {
      setErrorToast(err?.message || 'Failed to reject payroll batch');
    } finally {
      setRejecting(false);
    }
  };

  // Summary Metrics
  const summary = workspaceData?.summary || {
    totalEmployees: employees.length,
    eligibleCount: employees.filter(e => e.isEligible).length,
    ineligibleCount: employees.filter(e => !e.isEligible).length,
    processedCount: employees.filter(e => e.processingStatus === 'PROCESSED').length,
    pendingCount: employees.filter(e => e.processingStatus === 'PENDING').length,
    failedCount: employees.filter(e => e.processingStatus === 'FAILED').length,
    totalGross: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalEmployerCost: 0
  };

  // Filtered employees by text search
  const displayedEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(e =>
      e.employeeCode?.toLowerCase().includes(q) ||
      e.employeeName?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notifications */}
      {successToast && (
        <div
          style={{
            background: '#065f46',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{successToast}</span>
          </div>
          <button className="btn-close" style={{ color: '#fff' }} onClick={() => setSuccessToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {errorToast && (
        <div
          style={{
            background: '#991b1b',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorToast}</span>
          </div>
          <button className="btn-close" style={{ color: '#fff' }} onClick={() => setErrorToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* FILTER & WORKSPACE SELECTION CONTROL BAR */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          {/* Period Selector */}
          <div style={{ minWidth: '220px', flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Payroll Period *
            </label>
            <select
              className="form-control"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              style={{ width: '100%', height: '38px' }}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.month}/{p.year}) {p.isLocked ? '🔒 [Finalized]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div style={{ minWidth: '220px', flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Department *
            </label>
            <select
              className="form-control"
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              style={{ width: '100%', height: '38px' }}
            >
              <option value="ALL">All Departments (Entire Organization)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ minWidth: '200px', flex: 1 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Search Employee
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="ID, Name, or Role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', height: '38px', paddingLeft: '32px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Employment Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Status
            </label>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', height: '38px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROBATION">Probation</option>
              <option value="NOTICE_PERIOD">Notice Period</option>
              <option value="EXITED">Exited</option>
            </select>
          </div>

          {/* Eligibility Filter */}
          <div style={{ minWidth: '140px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Eligibility
            </label>
            <select
              className="form-control"
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              style={{ width: '100%', height: '38px' }}
            >
              <option value="ALL">All Candidates</option>
              <option value="ELIGIBLE">Eligible Only</option>
              <option value="INELIGIBLE">Ineligible Only</option>
            </select>
          </div>

          {/* Processing Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Processing State
            </label>
            <select
              className="form-control"
              value={processingStatusFilter}
              onChange={(e) => setProcessingStatusFilter(e.target.value)}
              style={{ width: '100%', height: '38px' }}
            >
              <option value="ALL">All States</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSED">Processed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Refresh / Filter button */}
          <div>
            <button
              className="btn btn-outline"
              onClick={fetchWorkspace}
              disabled={loading}
              title="Refresh Workspace"
              style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS (PHASE B & E) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Employees in Scope</span>
            <Users size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>
            {summary.totalEmployees}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {selectedDeptId === 'ALL' ? 'Organization-wide' : 'Department specific'}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857' }}>Eligible for Payroll</span>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
            {summary.eligibleCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {summary.totalEmployees > 0 ? Math.round((summary.eligibleCount / summary.totalEmployees) * 100) : 0}% compliance rate
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c' }}>Ineligible / Excluded</span>
            <AlertCircle size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c', marginTop: '4px' }}>
            {summary.ineligibleCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Requires attention / missing CTC
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8' }}>Processed vs Pending</span>
            <Clock size={16} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
            {summary.processedCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {summary.eligibleCount}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {summary.pendingCount} pending calculation
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Gross Earnings</span>
            <TrendingUp size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
            ₹{Number(summary.totalGross || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Calculated salary base
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Deductions</span>
            <TrendingDown size={16} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
            ₹{Number(summary.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            PF, ESIC, PT, TDS, Loans
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '2px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Net Take-Home Pay</span>
            <CreditCard size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ₹{Number(summary.totalNetPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Electronic disbursement amount
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Employer Statutory Cost</span>
            <ShieldCheck size={16} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
            ₹{Number(summary.totalEmployerCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Employer PF + ESIC + Gratuity
          </div>
        </div>
      </div>

      {/* STAGE & ACTION WORKFLOW CONTROL BAR */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Department Run</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeRun ? (
                <>
                  <span>{activeRun.runNumber}</span>
                  <span className={`badge ${
                    activeRun.status === 'PAID' ? 'badge-success' :
                    activeRun.status === 'APPROVED' ? 'badge-approved' :
                    activeRun.status === 'CALCULATED' || activeRun.status === 'REVIEWED' ? 'badge-brand' :
                    'badge-warning'
                  }`}>
                    {activeRun.status}
                  </span>
                  {(activeRun.validationNotes as any)?.rejection && activeRun.status === 'VALIDATED' && (
                    <span className="badge badge-danger" title={`Rejection reason: ${(activeRun.validationNotes as any).rejection.reason}`}>
                      Returned from Rejection
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  No active run initialized for this department/period
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Select all eligible button */}
          <button
            className="btn btn-outline btn-sm"
            onClick={handleToggleSelectAllEligible}
            disabled={loading || summary.eligibleCount === 0}
          >
            <CheckCheck size={14} />
            <span>
              {selectedEmployeeIds.length === summary.eligibleCount && summary.eligibleCount > 0
                ? 'Deselect All'
                : `Select All Eligible (${summary.eligibleCount})`}
            </span>
          </button>

          {/* Execute Department Batch Processing Button */}
          {hasRole(['company_admin', 'payroll_admin', 'payroll_processor']) && (!activeRun || activeRun.status === 'DRAFT' || activeRun.status === 'VALIDATED' || activeRun.status === 'CALCULATED') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleProcessDepartmentBatch}
              disabled={processingBatch || loading || selectedEmployeeIds.length === 0 || selectedDeptId === 'ALL'}
              title={selectedDeptId === 'ALL' ? 'Select a specific department above to process' : 'Calculate & process payroll batch for selected employees'}
            >
              <Play size={14} className={processingBatch ? 'spin' : ''} />
              <span>{processingBatch ? 'Processing...' : 'Process Department Batch'}</span>
            </button>
          )}

          {/* Workflow Transitions if Run exists */}
          {activeRun && hasRole(['company_admin', 'payroll_admin']) && activeRun.status === 'CALCULATED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAdvanceStage('review', 'Department batch submitted for review.')}
              disabled={advancingStage}
            >
              <ShieldCheck size={14} /> Submit for Review
            </button>
          )}

          {activeRun && hasRole(['company_admin', 'finance_admin']) && activeRun.status === 'REVIEWED' && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleAdvanceStage('approve', 'Department payroll batch approved for disbursement.')}
                disabled={advancingStage}
              >
                <CheckCircle2 size={14} /> Approve Batch
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowRejectModal(true)}
                disabled={advancingStage}
              >
                <X size={14} /> Reject Batch
              </button>
            </>
          )}

          {activeRun && hasRole(['company_admin', 'finance_admin']) && activeRun.status === 'APPROVED' && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAdvanceStage('payment-ready', 'Electronic payment instructions and bank register ready.')}
              disabled={advancingStage}
            >
              <CreditCard size={14} /> Prepare Bank Advice
            </button>
          )}

          {activeRun && hasRole(['company_admin', 'finance_admin']) && activeRun.status === 'PAYMENT_READY' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleAdvanceStage('mark-paid', 'Payroll confirmed as paid and slips released to Employee Self-Service.')}
              disabled={advancingStage}
            >
              <CheckCheck size={14} /> Confirm Payment & Release Slips
            </button>
          )}
        </div>
      </div>

      {/* EMPLOYEE 13-COLUMN WORKSPACE TABLE */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            Department Employees ({displayedEmployees.length})
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Selected for Processing: <strong>{selectedEmployeeIds.length}</strong> of {summary.eligibleCount} eligible
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RotateCcw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <div>Loading employee workspace and attendance data...</div>
          </div>
        ) : displayedEmployees.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600 }}>No employees match the selected criteria</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Try switching department, removing filters, or clearing search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.82rem', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.length === summary.eligibleCount && summary.eligibleCount > 0}
                      onChange={handleToggleSelectAllEligible}
                      disabled={summary.eligibleCount === 0}
                      title="Select / Deselect all eligible"
                    />
                  </th>
                  <th>ID / Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Payroll Eligibility</th>
                  <th>Salary Structure</th>
                  <th style={{ textAlign: 'right' }}>Payable / LOP</th>
                  <th style={{ textAlign: 'right' }}>Gross Earnings</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Take-Home</th>
                  <th style={{ textAlign: 'center' }}>Processing Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEmployees.map((emp) => {
                  const isSelected = selectedEmployeeIds.includes(emp.employeeId);
                  return (
                    <tr
                      key={emp.employeeId}
                      style={{
                        background: !emp.isEligible ? '#fffbfb' : isSelected ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectEmployee(emp.employeeId)}
                          disabled={!emp.isEligible}
                        />
                      </td>

                      {/* 1. Employee ID / Code */}
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{emp.employeeCode}</strong>
                      </td>

                      {/* 2. Employee Name */}
                      <td>
                        <strong>{emp.employeeName}</strong>
                      </td>

                      {/* 3. Department */}
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>{emp.department}</span>
                      </td>

                      {/* 4. Designation */}
                      <td>
                        <span>{emp.designation || 'Staff'}</span>
                      </td>

                      {/* 5. Status */}
                      <td>
                        <span className={`badge ${
                          emp.status === 'ACTIVE' || emp.status === 'CONFIRMED' ? 'badge-success' :
                          emp.status === 'PROBATION' ? 'badge-neutral' :
                          'badge-danger'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {emp.status}
                        </span>
                      </td>

                      {/* 6. Payroll Eligibility */}
                      <td>
                        {emp.isEligible ? (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={10} /> Eligible
                          </span>
                        ) : (
                          <button
                            className="badge badge-danger"
                            onClick={() => setInspectIneligibleRow(emp)}
                            style={{ fontSize: '0.65rem', cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Click to inspect reason why employee is ineligible"
                          >
                            <AlertCircle size={10} /> Ineligible (Inspect)
                          </button>
                        )}
                      </td>

                      {/* 7. Salary Structure */}
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>{emp.salaryStructure}</div>
                      </td>

                      {/* 8. Payable / LOP Days */}
                      <td style={{ textAlign: 'right' }}>
                        <div><strong>{emp.payableDays}</strong> d</div>
                        {emp.lopDays > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>{emp.lopDays} LOP</div>
                        )}
                      </td>

                      {/* 9. Gross Earnings */}
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(emp.earnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* 10. Deductions */}
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>
                        ₹{Number(emp.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* 11. Net Take-Home */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{Number(emp.netPay || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* 12. Processing Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${
                          emp.processingStatus === 'PROCESSED' ? 'badge-success' :
                          emp.processingStatus === 'PENDING' ? 'badge-warning' :
                          emp.processingStatus === 'FAILED' ? 'badge-danger' :
                          'badge-neutral'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {emp.processingStatus}
                        </span>
                      </td>

                      {/* 13. Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setSelectedBreakdownRow(emp);
                            setShowBreakdownModal(true);
                          }}
                          style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View itemized earnings, deductions and statutory formula breakdown"
                        >
                          <Eye size={12} /> Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUB-MODAL 1: DETAILED CALCULATION BREAKDOWN MODAL */}
      {showBreakdownModal && selectedBreakdownRow && (
        <DetailedCalculationModal
          isOpen={showBreakdownModal}
          onClose={() => {
            setShowBreakdownModal(false);
            setSelectedBreakdownRow(null);
          }}
          row={{
            ...selectedBreakdownRow,
            grossEarnings: selectedBreakdownRow.earnings,
            employeeDeductions: selectedBreakdownRow.deductions,
            employerContributions: selectedBreakdownRow.employerCost,
            items: selectedBreakdownRow.items || []
          }}
          payrollRun={activeRun || { period: workspaceData?.period }}
        />
      )}

      {/* SUB-MODAL 2: INELIGIBILITY REASONS INSPECTION MODAL */}
      {inspectIneligibleRow && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setInspectIneligibleRow(null); }}>
          <div className="modal-dialog" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
                <AlertCircle size={18} />
                Payroll Eligibility Rejection Reasons
              </h3>
              <button className="btn-close" onClick={() => setInspectIneligibleRow(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>
                  {inspectIneligibleRow.employeeName} ({inspectIneligibleRow.employeeCode})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                  Department: {inspectIneligibleRow.department} • Status: {inspectIneligibleRow.status}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Specific Failure Checks:
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(inspectIneligibleRow.ineligibilityReasons || []).map((reason: string, idx: number) => (
                  <li key={idx} style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>
                    {reason}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>How to Resolve:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                  <li>If salary structure is missing, assign a CTC template in <em>Employee Master → Salary Structure</em>.</li>
                  <li>If status is inactive, confirm the employee record before initiating payroll.</li>
                  <li>If already processed in another run, review the active run in <em>Monthly Payroll Runs</em>.</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setInspectIneligibleRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: BATCH REJECTION DIALOG WITH MANDATORY REASON */}
      {showRejectModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowRejectModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <AlertTriangle size={18} />
                Reject Department Payroll Batch
              </h3>
              <button className="btn-close" onClick={() => setShowRejectModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Rejecting this batch returns it to the <strong>VALIDATED</strong> stage so corrections can be applied. An audit entry with your justification will be recorded.
              </p>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Rejection Reason / Auditor Remarks * (Min 5 characters)
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Explain why this department payroll run cannot be approved (e.g. Unverified overtime claims, LOP discrepancies, pending structure approvals)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowRejectModal(false)} disabled={rejecting}>
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleRejectBatch}
                disabled={rejecting || rejectionReason.trim().length < 5}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
