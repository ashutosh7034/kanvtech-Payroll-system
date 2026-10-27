import React, { useState } from 'react';
import { api } from '../../services/api';
import {
  X,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Lock,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface TdsDeferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun: any;
  employeeRow: any;
  periods: any[];
  onTdsSaved: () => void;
}

export const TdsDeferralModal: React.FC<TdsDeferralModalProps> = ({
  isOpen,
  onClose,
  payrollRun,
  employeeRow,
  periods,
  onTdsSaved
}) => {
  const [deferralAmount, setDeferralAmount] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  const [recoveryPeriodId, setRecoveryPeriodId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen || !employeeRow) return null;

  const isLocked = ['APPROVED', 'PAYMENT_READY', 'PAID'].includes(payrollRun?.status);
  const currentTds = Number(employeeRow.tds ?? employeeRow.tdsWithholding ?? 0);
  const numDeferral = Math.max(0, Number(deferralAmount) || 0);

  // Available recovery periods (future periods)
  const currentPeriodYear = payrollRun?.period?.year || 2026;
  const currentPeriodMonth = payrollRun?.period?.month || 1;
  const futurePeriods = periods.filter(p => {
    if (p.year > currentPeriodYear) return true;
    if (p.year === currentPeriodYear && p.month > currentPeriodMonth) return true;
    return false;
  });

  const revisedTds = Math.max(0, currentTds - numDeferral);
  const originalNet = Number(employeeRow.netPay ?? employeeRow.netAmount ?? 0);
  const simulatedRevisedNet = originalNet + numDeferral;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError(`Cannot modify an ${payrollRun?.status} payroll run. Return run for recalculation first.`);
      return;
    }

    if (numDeferral <= 0) {
      setError('Deferral amount must be greater than zero.');
      return;
    }

    if (numDeferral > currentTds) {
      setError(`Deferral amount (₹${numDeferral}) cannot exceed calculated TDS deduction of ₹${currentTds.toFixed(2)}.`);
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('A comprehensive statutory justification (min 5 characters) is required under Indian Income Tax Act compliance.');
      return;
    }

    if (!recoveryPeriodId) {
      setError('Please select a target recovery period in which this deferred TDS will be recovered.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const selectedRecovery = periods.find(p => p.id === recoveryPeriodId);
      await api.post(`/payroll/runs/${payrollRun.id}/tds-deferral`, {
        employeeId: employeeRow.employeeId || employeeRow.id,
        deferralAmount: numDeferral,
        reason: reason.trim(),
        recoveryPeriodId,
        recoveryPeriodName: selectedRecovery?.name || undefined
      });

      setSuccess('TDS deferral recorded and scheduled for recovery. Payroll recalculated.');
      setTimeout(() => {
        onTdsSaved();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to record TDS deferral');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} style={{ color: 'var(--primary)' }} />
              TDS Deferral & Multi-Period Recovery: {employeeRow.employeeName || employeeRow.fullName}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Staff Code: <strong style={{ fontFamily: 'var(--font-mono)' }}>{employeeRow.employeeCode}</strong> •
              Active Run: <strong>{payrollRun?.period?.name || payrollRun?.runNumber}</strong>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
            {/* Tax Safeguard Notice */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.775rem',
                color: '#92400e'
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#b45309' }} />
              <div>
                <strong>Statutory Tax Safeguard (Section 192, Income Tax Act):</strong>
                <div style={{ marginTop: '2px', lineHeight: 1.4 }}>
                  TDS deductions cannot be arbitrarily zeroed out or bypassed. Any deferral must be supported by an authorized tax review (e.g. verified 80C investment proof or pending tax rebate confirmation) and explicitly mapped to a scheduled recovery period.
                </div>
              </div>
            </div>

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

            {/* Tax Comparison Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current TDS</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>
                  ₹{currentTds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Calculated withholding</div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Deferred Amount</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#166534', marginTop: '2px' }}>
                  - ₹{numDeferral.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: '#166534' }}>To be recovered</div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>Net Disbursable</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  ₹{simulatedRevisedNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Take-home after deferral</div>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Proposed Deferral Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={currentTds}
                  className="form-control"
                  placeholder="e.g. 5000"
                  value={deferralAmount}
                  onChange={e => setDeferralAmount(e.target.value)}
                  disabled={isLocked || currentTds <= 0}
                  required
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Maximum permissible: ₹{currentTds.toFixed(2)}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Scheduled Recovery Period *</label>
                <select
                  className="form-control"
                  value={recoveryPeriodId}
                  onChange={e => setRecoveryPeriodId(e.target.value)}
                  disabled={isLocked}
                  required
                >
                  <option value="">Select subsequent period...</option>
                  {futurePeriods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (FY {p.year})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Month where deferred tax will be recovered
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Statutory Justification & Approver Authority *</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="State the tax justification (e.g. Employee submitted revised Form 12BB with valid Life Insurance proofs on 25th Oct; pending IT declaration portal verification)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={isLocked}
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || isLocked || currentTds <= 0 || !reason.trim() || !recoveryPeriodId}
            >
              {submitting ? 'Applying Deferral...' : 'Schedule Deferral & Recalculate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
