import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import { SideDrawer } from '../components/common/SideDrawer';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LogOut, Calculator, CheckCircle2, DollarSign, FileText, AlertCircle } from 'lucide-react';

export const OffboardingView: React.FC = () => {
  const { hasRole, canPerformAction } = useAuth();
  const [resignations, setResignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Submit Resignation Modal (Pattern B)
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [requestedLwd, setRequestedLwd] = useState('2026-05-31');
  const [resignationReason, setResignationReason] = useState('Pursuing higher career advancement');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // F&F Calculation Modal (Pattern B)
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [selectedResignation, setSelectedResignation] = useState<any>(null);
  const [agreedLwd, setAgreedLwd] = useState('2026-05-31');
  const [noticeShortfallDays, setNoticeShortfallDays] = useState(0);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Settlement Detail Drawer (Pattern C)
  const [activeSettlement, setActiveSettlement] = useState<any>(null);

  // Confirmation Dialog (Pattern A)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const canInitiateOffboarding = canPerformAction('offboarding:initiate');
  const canSettleOffboarding = canPerformAction('offboarding:settle');

  const loadResignations = async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/offboarding/resignations');
      setResignations(res.resignations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResignations();
  }, []);

  const handleSubmitResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await api.post('/offboarding/resignations', {
        requestedLwd,
        reason: resignationReason
      });
      setShowSubmitModal(false);
      loadResignations();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit resignation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCalcModal = (r: any) => {
    setSelectedResignation(r);
    setAgreedLwd(new Date(r.requestedLwd).toISOString().split('T')[0]);
    setNoticeShortfallDays(0);
    setCalcError(null);
    setShowCalcModal(true);
  };

  const handleCalculateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResignation) return;
    setCalcError(null);
    setIsCalculating(true);
    try {
      const res: any = await api.post('/offboarding/settlement/calculate', {
        resignationId: selectedResignation.id,
        agreedLwd,
        noticeShortfallDays: Number(noticeShortfallDays)
      });
      setShowCalcModal(false);
      setActiveSettlement(res.settlement);
      loadResignations();
    } catch (err: any) {
      setCalcError(err.message || 'Failed to compute settlement');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMarkPaid = (settlementId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Disburse Full & Final Settlement',
      message: 'Are you sure you want to mark this F&F settlement as Disbursed/Paid? This registers statutory final payout in the accounting ledger.',
      onConfirm: async () => {
        try {
          await api.patch(`/offboarding/settlement/${settlementId}/status`, { status: 'PAID' });
          loadResignations();
          if (activeSettlement && activeSettlement.id === settlementId) {
            setActiveSettlement({ ...activeSettlement, status: 'PAID' });
          }
        } catch (err: any) {
          alert(err.message || 'Failed to update payment status');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const formatCurrency = (val: number | string) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="Offboarding & Full-and-Final Settlement"
        subtitle="Resignation Lifecycles, Notice Waivers & Statutory Indian F&F Settlement Calculations"
        breadcrumbs={[
          { label: 'People & Organization' },
          { label: 'Offboarding & F&F' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>F&F Lifecycle</span>}
        actions={
          canInitiateOffboarding && (
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
              onClick={() => { setSubmitError(null); setShowSubmitModal(true); }}
            >
              <LogOut size={14} /> Submit Resignation
            </button>
          )
        }
      />

      {/* Resignations Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title">
            Separation & Settlement Records ({resignations.length})
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Includes Notice Period adjustments and gratuity eligibility checks
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Submission Date</th>
                <th>Requested LWD</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Settlement Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading separation records...
                  </td>
                </tr>
              ) : resignations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No resignation or separation records found.
                  </td>
                </tr>
              ) : (
                resignations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.employee?.firstName} {r.employee?.lastName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.employee?.employeeCode} • {r.employee?.department?.name || 'General'}
                      </div>
                    </td>
                    <td>{new Date(r.submittedAt).toLocaleDateString('en-IN')}</td>
                    <td>{new Date(r.requestedLwd).toLocaleDateString('en-IN')}</td>
                    <td style={{ maxWidth: '240px', fontSize: '0.8rem' }}>{r.reason}</td>
                    <td>
                      <span className={`badge ${r.status === 'APPROVED' ? 'badge-approved' : r.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {r.settlement ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setActiveSettlement(r.settlement)}
                            title="View Computed F&F Statement"
                          >
                            <FileText size={13} /> View F&F
                          </button>
                        ) : (
                          canSettleOffboarding && r.status === 'APPROVED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenCalcModal(r)}
                            >
                              <Calculator size={13} /> Compute F&F
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Resignation Modal (Pattern B) */}
      <FormModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Separation / Resignation Request"
        subtitle="Formal employee resignation notice submission for institutional HR workflow"
        icon={<LogOut size={18} />}
        width="md"
        onSubmit={handleSubmitResignation}
        submitLabel="Submit Resignation"
        isSubmitting={isSubmitting}
      >
        {submitError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
            {submitError}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Requested Last Working Day (LWD) *</label>
          <input
            type="date"
            className="form-input"
            value={requestedLwd}
            onChange={(e) => setRequestedLwd(e.target.value)}
            required
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Standard statutory notice period: 30 to 90 days as per appointment terms
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Reason for Separation *</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Please detail the reason for separation (e.g. Higher studies, career advancement, personal reasons)..."
            value={resignationReason}
            onChange={(e) => setResignationReason(e.target.value)}
            required
          />
        </div>
      </FormModal>

      {/* Compute F&F Modal (Pattern B) */}
      {selectedResignation && (
        <FormModal
          isOpen={canSettleOffboarding && showCalcModal}
          onClose={() => setShowCalcModal(false)}
          title="Compute Full & Final Settlement"
          subtitle={`Calculate final statutory earnings and deductions for ${selectedResignation.employee?.firstName} ${selectedResignation.employee?.lastName}`}
          icon={<Calculator size={18} />}
          width="md"
          onSubmit={handleCalculateSettlement}
          submitLabel="Compute & Generate Statement"
          isSubmitting={isCalculating}
        >
          {calcError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {calcError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
            Employee: <strong>{selectedResignation.employee?.firstName} {selectedResignation.employee?.lastName}</strong> ({selectedResignation.employee?.employeeCode})<br />
            Requested LWD: <strong>{new Date(selectedResignation.requestedLwd).toLocaleDateString('en-IN')}</strong>
          </div>

          <div className="form-group">
            <label className="form-label">Agreed Last Working Day (LWD) *</label>
            <input
              type="date"
              className="form-input"
              value={agreedLwd}
              onChange={(e) => setAgreedLwd(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notice Period Shortfall (Days)</label>
            <input
              type="number"
              min={0}
              max={90}
              className="form-input"
              value={noticeShortfallDays}
              onChange={(e) => setNoticeShortfallDays(Number(e.target.value))}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Shortfall days will be deducted from final settlement as notice recovery
            </span>
          </div>
        </FormModal>
      )}

      {/* Settlement Detail Drawer (Pattern C) */}
      <SideDrawer
        isOpen={Boolean(activeSettlement)}
        onClose={() => setActiveSettlement(null)}
        title="F&F Settlement Statement"
        subtitle={`Settlement ID: ${activeSettlement?.id || ''}`}
        width="540px"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setActiveSettlement(null)}>
              Close
            </button>
            {activeSettlement?.status !== 'PAID' && canSettleOffboarding && (
              <button className="btn btn-primary" onClick={() => handleMarkPaid(activeSettlement.id)}>
                <CheckCircle2 size={14} /> Mark Disbursed & Paid
              </button>
            )}
          </div>
        }
      >
        {activeSettlement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Settlement Payable</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {formatCurrency(activeSettlement.netPayable)}
                </div>
              </div>
              <div>
                <span className={`badge ${activeSettlement.status === 'PAID' ? 'badge-approved' : 'badge-warning'}`}>
                  {activeSettlement.status}
                </span>
              </div>
            </div>

            <table className="data-table" style={{ width: '100%' }}>
              <tbody>
                <tr><td>Earned Salary Payable</td><td className="money">{formatCurrency(activeSettlement.earnedSalary)}</td></tr>
                <tr><td>Leave Encashment Payout</td><td className="money">{formatCurrency(activeSettlement.leaveEncashment)}</td></tr>
                <tr><td>Gratuity Payout (Statutory)</td><td className="money">{formatCurrency(activeSettlement.gratuityAmount)}</td></tr>
                <tr><td>Bonus / Incentive Payout</td><td className="money">{formatCurrency(activeSettlement.bonusAmount)}</td></tr>
                <tr><td style={{ color: 'var(--danger)' }}>Notice Shortfall Recovery</td><td className="money" style={{ color: 'var(--danger)' }}>-{formatCurrency(activeSettlement.noticeRecovery)}</td></tr>
                <tr><td style={{ color: 'var(--danger)' }}>Outstanding Loan Recovery</td><td className="money" style={{ color: 'var(--danger)' }}>-{formatCurrency(activeSettlement.loanDeduction)}</td></tr>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                  <td>Total Net Settlement Payable</td>
                  <td className="money" style={{ color: 'var(--success)', fontSize: '0.95rem' }}>{formatCurrency(activeSettlement.netPayable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SideDrawer>

      {/* Confirmation Dialog (Pattern A) */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};