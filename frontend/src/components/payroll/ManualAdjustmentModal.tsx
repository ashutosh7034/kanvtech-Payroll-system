import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  Edit3,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  MinusCircle,
  FileText,
  DollarSign,
  Calendar,
  Lock,
  ArrowRight
} from 'lucide-react';

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun: any;
  employeeRow: any; // from review-table or slip
  onAdjustmentSaved: () => void;
}

export const ManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({
  isOpen,
  onClose,
  payrollRun,
  employeeRow,
  onAdjustmentSaved
}) => {
  const [adjustmentCategory, setAdjustmentCategory] = useState('INCENTIVE_BONUS');
  const [componentCode, setComponentCode] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'ADDITION' | 'DEDUCTION'>('ADDITION');
  const [amount, setAmount] = useState<string>('0');
  const [lopDays, setLopDays] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [supportingDocRef, setSupportingDocRef] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize values from employee row if available
  useEffect(() => {
    if (employeeRow) {
      setLopDays(String(employeeRow.lopDays || employeeRow.leaveLossOfPayDays || 0));
      setAmount('0');
      setReason('');
      setSupportingDocRef('');
      setError(null);
      setSuccess(null);
    }
  }, [employeeRow]);

  if (!isOpen || !employeeRow) return null;

  const isLocked = ['APPROVED', 'PAYMENT_READY', 'PAID'].includes(payrollRun?.status);

  // Original calculated values
  const originalGross = Number(employeeRow.grossEarnings ?? employeeRow.grossPay ?? employeeRow.grossAmount ?? 0);
  const originalDeductions = Number(employeeRow.employeeDeductions ?? employeeRow.deductionsPay ?? employeeRow.deductionAmount ?? 0);
  const originalNet = Number(employeeRow.netPay ?? employeeRow.netAmount ?? 0);
  const currentPayableDays = Number(employeeRow.payableDays ?? 30);

  // Live recalculation simulation
  const numAmount = Math.max(0, Number(amount) || 0);
  let liveAdj = adjustmentType === 'ADDITION' ? numAmount : -numAmount;

  // If attendance correction
  const isAttendanceCorrection = adjustmentCategory === 'ATTENDANCE_CORRECTION';

  const simulatedRevisedGross = adjustmentType === 'ADDITION'
    ? originalGross + numAmount
    : originalGross;

  const simulatedRevisedDeductions = adjustmentType === 'DEDUCTION'
    ? originalDeductions + numAmount
    : originalDeductions;

  const simulatedRevisedNet = Math.max(0, simulatedRevisedGross - simulatedRevisedDeductions);

  const handleCategoryChange = (cat: string) => {
    setAdjustmentCategory(cat);
    if (['ADDITIONAL_EARNING', 'INCENTIVE_BONUS', 'REIMBURSEMENT', 'ARREARS'].includes(cat)) {
      setAdjustmentType('ADDITION');
    } else if (['ONE_TIME_DEDUCTION', 'VOLUNTARY_DEDUCTION'].includes(cat)) {
      setAdjustmentType('DEDUCTION');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError(`Cannot modify an ${payrollRun?.status} payroll run. Return run for recalculation first.`);
      return;
    }

    if (!reason.trim() || reason.trim().length < 4) {
      setError('A descriptive justification/reason of at least 4 characters is mandatory for financial audit trails.');
      return;
    }

    if (!isAttendanceCorrection && numAmount <= 0) {
      setError('Adjustment amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        employeeId: employeeRow.employeeId || employeeRow.id,
        category: adjustmentCategory,
        componentCode: componentCode.trim() || undefined,
        type: adjustmentType,
        amount: numAmount,
        reason: reason.trim(),
        supportingDocRef: supportingDocRef.trim() || undefined
      };

      if (isAttendanceCorrection) {
        payload.leaveLossOfPayDays = Number(lopDays) || 0;
      }

      await api.post(`/payroll/runs/${payrollRun.id}/adjustments`, payload);
      setSuccess('Manual adjustment recorded and recalculated successfully.');
      setTimeout(() => {
        onAdjustmentSaved();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to record manual adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} style={{ color: 'var(--primary)' }} />
              Manual Salary Adjustment: {employeeRow.employeeName || employeeRow.fullName}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{employeeRow.employeeCode}</strong> •
              Dept: <strong>{employeeRow.department || 'General'}</strong> •
              Period: <strong>{payrollRun?.period?.name || payrollRun?.runNumber}</strong>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
            {/* Status Guard Notice */}
            {isLocked ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#991b1b',
                  fontSize: '0.8rem'
                }}
              >
                <Lock size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Financial Immutability Lock:</strong> This payroll run is in <strong>{payrollRun?.status}</strong> status. Direct manual edits are prohibited. Use <em>"Return for Correction"</em> to reset the run to DRAFT if an authorized rerun is required.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.05)',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '0.775rem',
                  color: 'var(--text-muted)'
                }}
              >
                Manual adjustments preserve the original calculated CTC values and record an immutable financial audit trail. Changes trigger automatic recalculation of dependent totals.
              </div>
            )}

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

            {success && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: '#166534',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle size={15} /> <span>{success}</span>
              </div>
            )}

            {/* 4-Column Live Comparison Display */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>1. Calculated Gross</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '2px' }}>
                  ₹{originalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Engine auto-math</div>
              </div>

              <div>
                <div style={{ fontSize: '0.675rem', color: adjustmentType === 'ADDITION' ? '#166534' : 'var(--danger)', fontWeight: 600, textTransform: 'uppercase' }}>
                  2. Manual Adj
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: adjustmentType === 'ADDITION' ? '#166534' : 'var(--danger)', marginTop: '2px' }}>
                  {adjustmentType === 'ADDITION' ? '+' : '-'} ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>{adjustmentType}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>3. Revised Gross</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '2px' }}>
                  ₹{simulatedRevisedGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>After adjustments</div>
              </div>

              <div>
                <div style={{ fontSize: '0.675rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>4. Final Net Pay</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  ₹{simulatedRevisedNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Estimated take-home</div>
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Adjustment Category *</label>
                <select
                  className="form-control"
                  value={adjustmentCategory}
                  onChange={e => handleCategoryChange(e.target.value)}
                  disabled={isLocked}
                >
                  <option value="INCENTIVE_BONUS">Incentives & Performance Bonus</option>
                  <option value="ADDITIONAL_EARNING">Additional Earnings</option>
                  <option value="ARREARS">Salary Arrears</option>
                  <option value="REIMBURSEMENT">Tax-Free Reimbursement</option>
                  <option value="ONE_TIME_DEDUCTION">One-Time Deduction</option>
                  <option value="SALARY_CORRECTION">Approved Salary Correction</option>
                  <option value="ATTENDANCE_CORRECTION">Attendance (LOP Days) Correction</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Effect on Pay *</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${adjustmentType === 'ADDITION' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, padding: '6px' }}
                    onClick={() => setAdjustmentType('ADDITION')}
                    disabled={isLocked}
                  >
                    <PlusCircle size={14} /> Addition
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${adjustmentType === 'DEDUCTION' ? 'btn-danger' : 'btn-outline'}`}
                    style={{ flex: 1, padding: '6px' }}
                    onClick={() => setAdjustmentType('DEDUCTION')}
                    disabled={isLocked}
                  >
                    <MinusCircle size={14} /> Deduction
                  </button>
                </div>
              </div>
            </div>

            {isAttendanceCorrection ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Revised Loss of Pay (LOP) Days</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="31"
                    className="form-control"
                    value={lopDays}
                    onChange={e => setLopDays(e.target.value)}
                    disabled={isLocked}
                    required
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Current Payable Days: {currentPayableDays}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Direct Monetary Adjustment (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={isLocked}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Adjustment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={isLocked}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Salary Component Code (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. PERF_BONUS or SPECIAL_ALLOW"
                    value={componentCode}
                    onChange={e => setComponentCode(e.target.value.toUpperCase())}
                    disabled={isLocked}
                  />
                </div>
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Reason / Financial Justification *</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="State the exact business reason for this adjustment (e.g. Q3 Performance Incentive as authorized by Dept Head)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={isLocked}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Supporting Document / Approval Reference</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Approval Memo #HR-2026-OCT-892"
                value={supportingDocRef}
                onChange={e => setSupportingDocRef(e.target.value)}
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Close
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || isLocked || !reason.trim()}
            >
              {submitting ? 'Applying Adjustment...' : 'Apply & Recalculate Salary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
