import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  Play,
  Filter,
  Users,
  AlertTriangle,
  CheckCircle,
  Building,
  Search,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';

interface CreatePayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  periods: any[];
  initialPeriodId?: string;
  onRunCreated: (run: any) => void;
}

export const CreatePayrollRunModal: React.FC<CreatePayrollRunModalProps> = ({
  isOpen,
  onClose,
  periods,
  initialPeriodId,
  onRunCreated
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialPeriodId || (periods[0]?.id || ''));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [remarks, setRemarks] = useState('');

  // Preview state
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    period?: any;
    totalCount: number;
    eligibleCount: number;
    missingStructureCount: number;
    alreadyProcessedCount: number;
    employees: any[];
    departments: any[];
    branches: any[];
  }>({
    totalCount: 0,
    eligibleCount: 0,
    missingStructureCount: 0,
    alreadyProcessedCount: 0,
    employees: [],
    departments: [],
    branches: []
  });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [excludedEmployeeIds, setExcludedEmployeeIds] = useState<Set<string>>(new Set());
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial period
  useEffect(() => {
    if (initialPeriodId) {
      setSelectedPeriodId(initialPeriodId);
    } else if (periods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(periods[0].id);
    }
  }, [initialPeriodId, periods]);

  // Fetch preview when filters change
  const fetchPreview = async () => {
    if (!selectedPeriodId) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('periodId', selectedPeriodId);
      if (selectedDepartmentId !== 'ALL') params.append('departmentId', selectedDepartmentId);
      if (selectedBranchId !== 'ALL') params.append('branchId', selectedBranchId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res: any = await api.get(`/payroll/runs/preview-eligible?${params.toString()}`);
      setPreviewData(res);

      // By default, select all eligible employees who don't have existing runs
      const eligibleIds = new Set<string>();
      (res.employees || []).forEach((emp: any) => {
        if (emp.isEligible && !emp.alreadyProcessedRun) {
          eligibleIds.add(emp.id);
        }
      });
      setSelectedEmployeeIds(eligibleIds);
      setExcludedEmployeeIds(new Set());
      setExclusionReasons({});
    } catch (err: any) {
      setError(err.message || 'Failed to fetch eligible employees preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedPeriodId) {
      fetchPreview();
    }
  }, [isOpen, selectedPeriodId, selectedDepartmentId, selectedBranchId]);

  if (!isOpen) return null;

  const toggleSelectEmployee = (id: string, isEligible: boolean) => {
    if (!isEligible) return;
    const nextSelected = new Set(selectedEmployeeIds);
    const nextExcluded = new Set(excludedEmployeeIds);

    if (nextSelected.has(id)) {
      nextSelected.delete(id);
      nextExcluded.add(id);
    } else {
      nextSelected.add(id);
      nextExcluded.delete(id);
      const nextReasons = { ...exclusionReasons };
      delete nextReasons[id];
      setExclusionReasons(nextReasons);
    }
    setSelectedEmployeeIds(nextSelected);
    setExcludedEmployeeIds(nextExcluded);
  };

  const selectAllEligible = () => {
    const nextSelected = new Set<string>();
    previewData.employees.forEach((emp: any) => {
      if (emp.isEligible && !emp.alreadyProcessedRun) {
        nextSelected.add(emp.id);
      }
    });
    setSelectedEmployeeIds(nextSelected);
    setExcludedEmployeeIds(new Set());
    setExclusionReasons({});
  };

  const deselectAll = () => {
    const nextExcluded = new Set<string>();
    previewData.employees.forEach((emp: any) => {
      if (emp.isEligible) {
        nextExcluded.add(emp.id);
      }
    });
    setSelectedEmployeeIds(new Set());
    setExcludedEmployeeIds(nextExcluded);
  };

  const handleReasonChange = (empId: string, reason: string) => {
    setExclusionReasons(prev => ({ ...prev, [empId]: reason }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId) {
      setError('Please select a payroll period.');
      return;
    }

    if (selectedEmployeeIds.size === 0) {
      setError('At least one eligible employee must be selected to initialize a payroll run.');
      return;
    }

    // Check if any excluded employees are missing reasons
    for (const id of excludedEmployeeIds) {
      if (!exclusionReasons[id] || !exclusionReasons[id].trim()) {
        const emp = previewData.employees.find(e => e.id === id);
        setError(`Please provide an exclusion reason for employee ${emp?.employeeCode || id} (${emp?.fullName || ''}).`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        periodId: selectedPeriodId,
        departmentId: selectedDepartmentId !== 'ALL' ? selectedDepartmentId : undefined,
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        selectedEmployeeIds: Array.from(selectedEmployeeIds),
        excludedEmployeeIds: Array.from(excludedEmployeeIds),
        exclusionReasons,
        remarks: remarks.trim() || undefined
      };

      const res: any = await api.post('/payroll/runs/draft', payload);
      onRunCreated(res.run);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payroll run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '880px', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={18} style={{ color: 'var(--primary)' }} /> Initialize Department / Group Payroll Run (Stage 1)
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Select target organization unit, inspect candidate employees, exclude exceptions with reasons, and draft batch.
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', padding: '16px 20px' }}>
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertTriangle size={15} /> <span>{error}</span>
              </div>
            )}

            {/* Filter Row: Period, Department, Branch */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Payroll Period *</label>
                <select
                  className="form-control"
                  value={selectedPeriodId}
                  onChange={e => setSelectedPeriodId(e.target.value)}
                  required
                >
                  <option value="">Select period...</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (FY {p.year})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Department Scope</label>
                <select
                  className="form-control"
                  value={selectedDepartmentId}
                  onChange={e => setSelectedDepartmentId(e.target.value)}
                >
                  <option value="ALL">All Departments (Entire Company)</option>
                  {previewData.departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Branch / Location</label>
                <select
                  className="form-control"
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                >
                  <option value="ALL">All Branches & Locations</option>
                  {previewData.branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Candidate Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Candidates</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{previewData.totalCount}</div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>In active employment</div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Eligible To Run</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534', marginTop: '2px' }}>
                  {previewData.eligibleCount}
                </div>
                <div style={{ fontSize: '0.675rem', color: '#166534' }}>{selectedEmployeeIds.size} selected</div>
              </div>

              <div style={{ padding: '10px 12px', background: previewData.missingStructureCount > 0 ? '#fffbeb' : '#f8fafc', border: previewData.missingStructureCount > 0 ? '1px solid #fde68a' : '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: previewData.missingStructureCount > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600 }}>
                  Missing CTC Structure
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: previewData.missingStructureCount > 0 ? '#b45309' : 'inherit', marginTop: '2px' }}>
                  {previewData.missingStructureCount}
                </div>
                <div style={{ fontSize: '0.675rem', color: previewData.missingStructureCount > 0 ? '#b45309' : 'var(--text-muted)' }}>
                  Action required before payroll
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Already Processed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{previewData.alreadyProcessedCount}</div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>In locked/active run</div>
              </div>
            </div>

            {/* Search & Bulk Selection Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
                  placeholder="Search candidate by name or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchPreview(); } }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={selectAllEligible}
                >
                  <CheckSquare size={13} /> Select All Eligible ({previewData.eligibleCount})
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={deselectAll}
                >
                  <Square size={13} /> Deselect All
                </button>
              </div>
            </div>

            {/* Candidate Employee Preview Table */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
              {loadingPreview ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Scanning employee master & CTC configurations...
                </div>
              ) : previewData.employees.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active employees found matching the selected period and organization filters.
                </div>
              ) : (
                <table className="data-table" style={{ margin: 0, fontSize: '0.775rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ width: '38px', textAlign: 'center' }}></th>
                      <th>Code</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Branch</th>
                      <th className="money">Monthly Gross</th>
                      <th>Status & Exception</th>
                      <th style={{ minWidth: '180px' }}>Exclusion Reason (If unselected)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.employees.map(emp => {
                      const isSelected = selectedEmployeeIds.has(emp.id);
                      const isExcluded = excludedEmployeeIds.has(emp.id);

                      return (
                        <tr
                          key={emp.id}
                          style={{
                            background: !emp.isEligible ? '#fffbfb' : isSelected ? 'rgba(2, 132, 199, 0.04)' : undefined
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!emp.isEligible}
                              onChange={() => toggleSelectEmployee(emp.id, emp.isEligible)}
                              style={{ cursor: emp.isEligible ? 'pointer' : 'not-allowed' }}
                            />
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{emp.employeeCode}</td>
                          <td><strong>{emp.fullName}</strong></td>
                          <td>{emp.department?.name || '—'}</td>
                          <td>{emp.branch?.name || '—'}</td>
                          <td className="money">
                            {emp.hasSalaryStructure ? `₹${emp.monthlyGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td>
                            {emp.isEligible ? (
                              <span className="badge badge-success" style={{ fontSize: '0.675rem' }}>
                                Eligible
                              </span>
                            ) : !emp.hasSalaryStructure ? (
                              <span
                                className="badge badge-warning"
                                style={{ fontSize: '0.675rem', color: '#b45309' }}
                                title="No active CTC lines configured in Salary Structures"
                              >
                                Missing CTC Structure
                              </span>
                            ) : emp.alreadyProcessedRun ? (
                              <span
                                className="badge badge-gray"
                                style={{ fontSize: '0.675rem' }}
                                title={emp.ineligibilityReason}
                              >
                                In {emp.alreadyProcessedRun.runNumber} ({emp.alreadyProcessedRun.status})
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.675rem' }}>
                                Ineligible
                              </span>
                            )}
                          </td>
                          <td>
                            {isExcluded ? (
                              <input
                                type="text"
                                className="form-control"
                                style={{ fontSize: '0.75rem', padding: '3px 8px', height: '26px', borderColor: !exclusionReasons[emp.id]?.trim() ? '#ef4444' : undefined }}
                                placeholder="Mandatory exclusion reason..."
                                value={exclusionReasons[emp.id] || ''}
                                onChange={e => handleReasonChange(emp.id, e.target.value)}
                              />
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Included in batch</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Run Remarks */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Run Initialization Remarks</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="e.g. October 2026 Engineering monthly disbursement batch..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Selected: <strong style={{ color: 'var(--primary)' }}>{selectedEmployeeIds.size} employees</strong>
              {excludedEmployeeIds.size > 0 && <span> • Excluded: <strong>{excludedEmployeeIds.size}</strong></span>}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={submitting || selectedEmployeeIds.size === 0}
              >
                {submitting ? 'Initializing Batch...' : `Initialize Stage 1 Draft (${selectedEmployeeIds.size} Staff)`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
