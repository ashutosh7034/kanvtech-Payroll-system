import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Plus,
  FileText,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wallet,
  Calendar,
  Layers,
  ShieldCheck,
  Landmark,
  Calculator,
  AlertCircle
} from 'lucide-react';

export const LoansView: React.FC = () => {
  const { user, canPerformAction } = useAuth();
  const canApplyLoan = canPerformAction('loan:apply');
  const canApproveLoan = canPerformAction('loan:approve');
  const canDeleteLoan = canPerformAction('loan:delete');

  const [loans, setLoans] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [showRepaymentsModal, setShowRepaymentsModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm dialog state (Pattern A)
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

  // Sanction form state
  const [employeeId, setEmployeeId] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState<number>(50000);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Amend form state
  const [amendPrincipal, setAmendPrincipal] = useState<number>(0);
  const [amendTenure, setAmendTenure] = useState<number>(0);
  const [amendStatus, setAmendStatus] = useState<string>('ACTIVE');

  const loadLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lRes, tRes, empRes]: any = await Promise.all([
        api.get('/loans'),
        api.get('/loans/types'),
        api.get('/employees')
      ]);

      const fetchedLoans = lRes.loans || [];
      const fetchedTypes = tRes.types || tRes.loanTypes || [];
      const fetchedEmps = empRes.employees || [];

      setLoans(fetchedLoans);
      setLoanTypes(fetchedTypes);
      setEmployees(fetchedEmps);

      if (fetchedTypes.length > 0 && !loanTypeId) {
        setLoanTypeId(fetchedTypes[0].id);
      }
      if (fetchedEmps.length > 0 && !employeeId) {
        setEmployeeId(fetchedEmps[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load loans data:', err);
      setError(err.message || 'Failed to communicate with the loan service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleOpenSanctionModal = () => {
    setFormError(null);
    if (loanTypes.length > 0 && !loanTypeId) setLoanTypeId(loanTypes[0].id);
    if (employees.length > 0 && !employeeId) setEmployeeId(employees[0].id);
    setPrincipalAmount(50000);
    setTenureMonths(12);
    setOrderNumber(`ORD-${Date.now().toString().slice(-6)}`);
    setShowSanctionModal(true);
  };

  const selectedProduct = loanTypes.find(lt => lt.id === loanTypeId);
  const calculatedEmi = tenureMonths > 0 ? Math.round(principalAmount / tenureMonths) : 0;

  const handleSanctionLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!employeeId) {
      setFormError('Please select a beneficiary employee.');
      return;
    }
    if (!loanTypeId) {
      setFormError('Please select a loan product.');
      return;
    }
    if (principalAmount <= 0) {
      setFormError('Principal amount must be greater than zero.');
      return;
    }
    if (selectedProduct && principalAmount > Number(selectedProduct.maxAmount)) {
      setFormError(`Principal amount exceeds maximum allowed limit of ₹${Number(selectedProduct.maxAmount).toLocaleString('en-IN')}`);
      return;
    }
    if (selectedProduct && tenureMonths > selectedProduct.maxTenureMonths) {
      setFormError(`Tenure exceeds maximum allowed limit of ${selectedProduct.maxTenureMonths} months`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/loans', {
        employeeId,
        loanTypeId,
        principalAmount: Number(principalAmount),
        tenureMonths: Number(tenureMonths),
        sanctionOrderNumber: orderNumber || `ORD-${Date.now().toString().slice(-6)}`
      });
      setShowSanctionModal(false);
      await loadLoans();
    } catch (err: any) {
      setFormError(err.message || 'Failed to sanction advance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAmendModal = (loan: any) => {
    if (loan.id === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      alert('This protected loan record is read-only and cannot be amended.');
      return;
    }
    setSelectedLoan(loan);
    setAmendPrincipal(Number(loan.principalAmount));
    setAmendTenure(Number(loan.tenureMonths || loan.totalInstallments));
    setAmendStatus(loan.status);
    setFormError(null);
    setShowAmendModal(true);
  };

  const handleAmendLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    if (selectedLoan.id === 'b405b4b8-1211-48c5-a59e-ee8db001a906') return;
    setFormError(null);
    setActionLoading(true);
    try {
      await api.patch(`/loans/${selectedLoan.id}`, {
        principalAmount: Number(amendPrincipal),
        tenureMonths: Number(amendTenure),
        status: amendStatus
      });
      setShowAmendModal(false);
      await loadLoans();
    } catch (err: any) {
      setFormError(err.message || 'Failed to amend loan terms.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = (loanId: string, newStatus: 'ACTIVE' | 'CLOSED' | 'CANCELLED') => {
    if (loanId === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      alert('This protected loan record is read-only.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: `Update Advance Status to ${newStatus}`,
      message: `Are you sure you want to mark this advance as ${newStatus}? This will impact future monthly payroll deduction schedules.`,
      isDestructive: newStatus === 'CANCELLED',
      onConfirm: async () => {
        try {
          await api.patch(`/loans/${loanId}/status`, { status: newStatus });
          await loadLoans();
        } catch (err: any) {
          alert(err.message || `Failed to update status to ${newStatus}`);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteLoan = (loan: any) => {
    if (loan.id === 'b405b4b8-1211-48c5-a59e-ee8db001a906') {
      alert('This protected loan record is read-only.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Draft Advance Record',
      message: `Are you sure you want to delete advance record ${loan.sanctionOrderNumber}? This action is irreversible.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await api.delete(`/loans/${loan.id}`);
          await loadLoans();
        } catch (err: any) {
          alert(err.message || 'Failed to delete advance record');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenRepayments = async (loan: any) => {
    try {
      const res: any = await api.get(`/loans/${loan.id}/repayments`);
      setSelectedLoan(res.loan || loan);
      setShowRepaymentsModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load repayments schedule');
    }
  };

  // Metrics calculation
  const totalPrincipalAll = loans.reduce((acc, l) => acc + Number(l.principalAmount || 0), 0);
  const totalOutstandingAll = loans.reduce((acc, l) => acc + Number(l.outstandingAmount || 0), 0);
  const totalRecoveredAll = loans.reduce((acc, l) => acc + Number(l.recoveredAmount || 0), 0);
  const activeCount = loans.filter(l => l.status === 'ACTIVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard Page Header */}
      <PageHeader
        title="Loans, Advances & Payroll Recoveries"
        subtitle="Salary Advances, Festival Advances, Multi-month Amortization & Automated Payroll Deductions"
        breadcrumbs={[
          { label: 'Operations & Finance' },
          { label: 'Loans & Advances' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Enterprise Recovery</span>}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={loadLoans} disabled={loading} title="Refresh Loans">
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
            {canApplyLoan && (
              <button className="btn btn-primary btn-sm" onClick={handleOpenSanctionModal}>
                <Plus size={14} /> Sanction Advance / Loan
              </button>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="var(--primary)" /> Active Advances
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
            {activeCount} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ {loans.length} total</span>
          </div>
        </div>

        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} color="var(--primary)" /> Total Principal Sanctioned
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
            ₹{totalPrincipalAll.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} color="var(--success)" /> Total Recovered (Payroll)
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
            ₹{totalRecoveredAll.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="var(--danger)" /> Outstanding Balance
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger)', marginTop: '4px' }}>
            ₹{totalOutstandingAll.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Main Advances Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title">Active Running Advances & Installment Schedules</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Deductions auto-applied via payroll item code <code style={{ color: 'var(--primary)', fontWeight: 600 }}>LOAN_EMI</code>
          </span>
        </div>

        {error && (
          <div style={{ margin: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <div style={{ flex: 1, fontSize: '0.85rem' }}>{error}</div>
            <button className="btn btn-outline btn-sm" onClick={loadLoans}>Try Again</button>
          </div>
        )}

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sanction #</th>
                <th>Employee</th>
                <th>Advance Type</th>
                <th className="money">Principal</th>
                <th className="money">Monthly Recovery</th>
                <th style={{ textAlign: 'center' }}>Progress</th>
                <th className="money">Outstanding Balance</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading loan records and schedules...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No advances or loans recorded for this company. Click "Sanction Advance / Loan" above to issue one.
                  </td>
                </tr>
              ) : (
                loans.map(l => {
                  const emi = Number(l.monthlyEmi ?? l.monthlyInstallment ?? 0);
                  const principal = Number(l.principalAmount ?? 0);
                  const outstanding = Number(l.outstandingAmount ?? 0);
                  const tenure = l.tenureMonths ?? l.totalInstallments ?? 1;
                  const recoveredCount = l.recoveredInstallments ?? l.repayments?.length ?? 0;
                  const interestRate = l.loanType?.interestRatePct ?? l.loanType?.interestRate ?? 0;
                  const isProtected = l.id === 'b405b4b8-1211-48c5-a59e-ee8db001a906';

                  return (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {l.sanctionOrderNumber || `ORD-${l.id.slice(-6).toUpperCase()}`}
                          {isProtected && (
                            <span title="Protected Reference Loan" style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                              <ShieldCheck size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{l.employee?.firstName} {l.employee?.lastName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {l.employee?.employeeCode} • {l.employee?.department?.name || 'Department'}
                        </div>
                      </td>
                      <td>
                        <strong>{l.loanType?.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {interestRate > 0 ? `${interestRate}% p.a.` : 'Interest-Free'}
                        </div>
                      </td>
                      <td className="money">₹{principal.toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        ₹{emi.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                          {recoveredCount} / {tenure}
                        </span>
                        <div style={{ width: '80px', height: '5px', background: '#e2e8f0', borderRadius: '3px', margin: '4px auto 0', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, (recoveredCount / tenure) * 100)}%`,
                              height: '100%',
                              background: 'var(--success)'
                            }}
                          />
                        </div>
                      </td>
                      <td className="money" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        ₹{outstanding.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge ${l.status === 'ACTIVE' ? 'badge-approved' : l.status === 'CLOSED' ? 'badge-neutral' : 'badge-danger'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            title="View Repayment Schedule"
                            onClick={() => handleOpenRepayments(l)}
                          >
                            <FileText size={12} />
                          </button>

                          {!isProtected && canApproveLoan && (
                            <>
                              <button
                                className="btn btn-outline btn-sm"
                                title="Amend Terms"
                                onClick={() => handleOpenAmendModal(l)}
                              >
                                <Edit2 size={12} />
                              </button>

                              {l.status === 'ACTIVE' && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ color: '#d97706' }}
                                  title="Close Advance"
                                  onClick={() => handleStatusChange(l.id, 'CLOSED')}
                                >
                                  <CheckCircle2 size={12} />
                                </button>
                              )}

                              {l.status === 'ACTIVE' && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ color: 'var(--danger)' }}
                                  title="Cancel Advance"
                                  onClick={() => handleStatusChange(l.id, 'CANCELLED')}
                                >
                                  <XCircle size={12} />
                                </button>
                              )}
                            </>
                          )}

                          {!isProtected && canDeleteLoan && recoveredCount === 0 && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--danger)' }}
                              title="Delete Draft Advance"
                              onClick={() => handleDeleteLoan(l)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SANCTION ADVANCE / LOAN (Pattern B)                                */}
      {/* ========================================================================= */}
      <FormModal
        isOpen={canApplyLoan && showSanctionModal}
        onClose={() => setShowSanctionModal(false)}
        title="Sanction Employee Advance / Loan"
        subtitle="Establish formal loan sanction terms, tenure, and automated monthly payroll recovery"
        icon={<Landmark size={18} />}
        width="md"
        onSubmit={handleSanctionLoan}
        submitLabel="Sanction & Activate"
        isSubmitting={actionLoading}
      >
        {formError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
            {formError}
          </div>
        )}

        {/* Beneficiary Employee */}
        <div className="form-group">
          <label className="form-label">Beneficiary Employee *</label>
          <select
            className="form-select"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            required
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.employeeCode})
              </option>
            ))}
          </select>
          {user?.employeeId && employeeId === user.employeeId && (
            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '4px' }}>
              ⚠️ Note: Self-sanctioning is guarded by Segregation-of-Duties (SEC-SOD-002).
            </div>
          )}
        </div>

        {/* Loan Product */}
        <div className="form-group">
          <label className="form-label">Loan Product *</label>
          <select
            className="form-select"
            value={loanTypeId}
            onChange={e => setLoanTypeId(e.target.value)}
            required
          >
            {loanTypes.map(lt => (
              <option key={lt.id} value={lt.id}>
                {lt.name} (Max: ₹{Number(lt.maxAmount).toLocaleString('en-IN')}, Tenure: {lt.maxTenureMonths}m)
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid-2">
          {/* Principal Amount */}
          <div className="form-group">
            <label className="form-label">Principal Amount (₹) *</label>
            <input
              className="form-input"
              type="number"
              min="1000"
              step="500"
              required
              value={principalAmount}
              onChange={e => setPrincipalAmount(Number(e.target.value))}
            />
            {selectedProduct && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Product Cap: ₹{Number(selectedProduct.maxAmount).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Tenure Months */}
          <div className="form-group">
            <label className="form-label">Tenure (Months) *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max={selectedProduct?.maxTenureMonths || 60}
              required
              value={tenureMonths}
              onChange={e => setTenureMonths(Number(e.target.value))}
            />
            {selectedProduct && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Max Allowed: {selectedProduct.maxTenureMonths} months
              </span>
            )}
          </div>
        </div>

        {/* Sanction Reference */}
        <div className="form-group">
          <label className="form-label">Sanction Order Reference</label>
          <input
            className="form-input"
            placeholder="e.g. NIHER/EST/ADV/2026/042"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
          />
        </div>

        {/* Live EMI Calculation Callout */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calculator size={15} /> Projected Monthly EMI:
            </span>
            <strong style={{ fontSize: '1.15rem', color: '#1e40af' }}>
              ₹{calculatedEmi.toLocaleString('en-IN')} / month
            </strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '4px' }}>
            Auto-deducted under component code <strong>LOAN_EMI</strong> during monthly institutional payroll runs.
          </div>
        </div>
      </FormModal>

      {/* ========================================================================= */}
      {/* MODAL: AMEND LOAN TERMS (Pattern B)                                      */}
      {/* ========================================================================= */}
      {selectedLoan && (
        <FormModal
          isOpen={canApproveLoan && showAmendModal}
          onClose={() => setShowAmendModal(false)}
          title={`Amend Advance Terms: ${selectedLoan.sanctionOrderNumber || `ORD-${selectedLoan.id.slice(-6).toUpperCase()}`}`}
          subtitle="Adjust remaining tenure or modify active recovery state"
          icon={<Edit2 size={18} />}
          width="md"
          onSubmit={handleAmendLoan}
          submitLabel="Save Amendments"
          isSubmitting={actionLoading}
        >
          {formError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {formError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
            <div>Borrower: <strong>{selectedLoan.employee?.firstName} {selectedLoan.employee?.lastName}</strong> ({selectedLoan.employee?.employeeCode})</div>
            <div style={{ marginTop: '4px' }}>
              Recovered to date: <strong style={{ color: 'var(--success)' }}>₹{Number(selectedLoan.recoveredAmount).toLocaleString('en-IN')}</strong> ({selectedLoan.repayments?.length || 0} installments)
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Principal Amount (₹) *</label>
            <input
              type="number"
              min={Number(selectedLoan.recoveredAmount)}
              className="form-input"
              value={amendPrincipal}
              onChange={e => setAmendPrincipal(Number(e.target.value))}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Cannot be reduced below already recovered amount (₹{Number(selectedLoan.recoveredAmount).toLocaleString('en-IN')})
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Total Tenure (Months) *</label>
            <input
              type="number"
              min={selectedLoan.repayments?.length || 1}
              max={selectedLoan.loanType?.maxTenureMonths || 60}
              className="form-input"
              value={amendTenure}
              onChange={e => setAmendTenure(Number(e.target.value))}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Cannot be less than completed installments ({selectedLoan.repayments?.length || 0})
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={amendStatus}
              onChange={e => setAmendStatus(e.target.value)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </FormModal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REPAYMENT SCHEDULE & HISTORY (Pattern B)                          */}
      {/* ========================================================================= */}
      {selectedLoan && (
        <FormModal
          isOpen={showRepaymentsModal}
          onClose={() => setShowRepaymentsModal(false)}
          title={`Advance Repayment Ledger: ${selectedLoan.sanctionOrderNumber || `ORD-${selectedLoan.id.slice(-6).toUpperCase()}`}`}
          subtitle="Audit trail of historical payroll deductions and recovery milestones"
          icon={<FileText size={18} />}
          width="lg"
          footer={
            <button className="btn btn-secondary" onClick={() => setShowRepaymentsModal(false)}>
              Close Ledger
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
            <div>Employee: <br /><strong>{selectedLoan.employee?.firstName} {selectedLoan.employee?.lastName}</strong></div>
            <div>Principal: <br /><strong className="money">₹{Number(selectedLoan.principalAmount).toLocaleString('en-IN')}</strong></div>
            <div>Recovered: <br /><strong className="money" style={{ color: 'var(--success)' }}>₹{Number(selectedLoan.recoveredAmount).toLocaleString('en-IN')}</strong></div>
            <div>Outstanding: <br /><strong className="money" style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>₹{Number(selectedLoan.outstandingAmount).toLocaleString('en-IN')}</strong></div>
          </div>

          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 0 0' }}>Recorded Payroll Deductions / Repayments</h4>
          <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>Installment #</th>
                  <th>Payment Date</th>
                  <th className="money">Amount Deducted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!selectedLoan.repayments || selectedLoan.repayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No installments have been processed through payroll yet. Recoveries begin in the next pay cycle.
                    </td>
                  </tr>
                ) : (
                  selectedLoan.repayments.map((rep: any) => (
                    <tr key={rep.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{rep.installmentNumber}</td>
                      <td>{new Date(rep.paidDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="money" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        ₹{Number(rep.amountPaid).toLocaleString('en-IN')}
                      </td>
                      <td><span className="badge badge-approved">RECOVERED</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </FormModal>
      )}

      {/* Confirmation Dialog (Pattern A) */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
