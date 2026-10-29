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
  AlertCircle,
  Settings,
  Percent,
  TrendingDown,
  Info
} from 'lucide-react';

export const LoansView: React.FC = () => {
  const { user, canPerformAction, hasRole } = useAuth();
  const canApplyLoan = canPerformAction('loan:apply');
  const canApproveLoan = canPerformAction('loan:approve');
  const canDeleteLoan = canPerformAction('loan:delete');
  const canManagePolicy = hasRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN']) || canApproveLoan;

  const [loans, setLoans] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [showRepaymentsModal, setShowRepaymentsModal] = useState(false);
  const [showProductPolicyModal, setShowProductPolicyModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [repaymentsSchedule, setRepaymentsSchedule] = useState<any[]>([]);
  const [repaymentsTab, setRepaymentsTab] = useState<'SCHEDULE' | 'HISTORY'>('SCHEDULE');
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

  // Sanction form state - Principal starts empty as required
  const [employeeId, setEmployeeId] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState<string>('');
  const [tenureMonths, setTenureMonths] = useState<string>('12');
  const [interestType, setInterestType] = useState<'INTEREST_FREE' | 'FIXED_RATE'>('INTEREST_FREE');
  const [interestRatePct, setInterestRatePct] = useState<string>('0');
  const [interestMethod, setInterestMethod] = useState<'REDUCING_BALANCE' | 'FLAT_RATE'>('REDUCING_BALANCE');
  const [interestStartDate, setInterestStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [repaymentFrequency, setRepaymentFrequency] = useState<string>('MONTHLY');
  const [orderNumber, setOrderNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Live EMI Preview calculation state
  const [previewData, setPreviewData] = useState<{
    principalAmount: number;
    interestType: string;
    interestRatePct: number;
    interestMethod: string;
    tenureMonths: number;
    monthlyEmi: number;
    totalInterest: number;
    totalRepayment: number;
    firstRepaymentDate?: string;
  } | null>(null);

  // Amend form state
  const [amendPrincipal, setAmendPrincipal] = useState<string>('');
  const [amendTenure, setAmendTenure] = useState<string>('');
  const [amendInterestType, setAmendInterestType] = useState<'INTEREST_FREE' | 'FIXED_RATE'>('INTEREST_FREE');
  const [amendInterestRatePct, setAmendInterestRatePct] = useState<string>('0');
  const [amendInterestMethod, setAmendInterestMethod] = useState<'REDUCING_BALANCE' | 'FLAT_RATE'>('REDUCING_BALANCE');
  const [amendStatus, setAmendStatus] = useState<string>('ACTIVE');

  // Product Policy form state
  const [policyName, setPolicyName] = useState('');
  const [policyMaxAmount, setPolicyMaxAmount] = useState<string>('100000');
  const [policyMinAmount, setPolicyMinAmount] = useState<string>('1000');
  const [policyMaxTenure, setPolicyMaxTenure] = useState<string>('36');
  const [policyInterestType, setPolicyInterestType] = useState<'INTEREST_FREE' | 'FIXED_RATE'>('INTEREST_FREE');
  const [policyInterestRatePct, setPolicyInterestRatePct] = useState<string>('0');
  const [policyMinInterestRatePct, setPolicyMinInterestRatePct] = useState<string>('0');
  const [policyMaxInterestRatePct, setPolicyMaxInterestRatePct] = useState<string>('24');
  const [policyInterestMethod, setPolicyInterestMethod] = useState<'REDUCING_BALANCE' | 'FLAT_RATE'>('REDUCING_BALANCE');
  const [policyAllowRateOverride, setPolicyAllowRateOverride] = useState<boolean>(true);

  const loadLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lRes, tRes, empRes]: any = await Promise.all([
        api.get('/loans'),
        api.get('/masters/loan-types?status=ACTIVE&all=true').catch(() => api.get('/loans/types')),
        api.get('/employees')
      ]);

      const fetchedLoans = lRes.loans || [];
      const fetchedTypes = tRes.records || tRes.types || tRes.loanTypes || [];
      const fetchedEmps = empRes.employees || [];

      setLoans(fetchedLoans);
      setLoanTypes(fetchedTypes);
      setEmployees(fetchedEmps);

      if (fetchedTypes.length > 0 && !loanTypeId) {
        applyProductDefaults(fetchedTypes[0]);
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

  const applyProductDefaults = (product: any) => {
    if (!product) return;
    setLoanTypeId(product.id);
    const prodType = product.interestType === 'FIXED_RATE' ? 'FIXED_RATE' : 'INTEREST_FREE';
    setInterestType(prodType);
    setInterestRatePct(prodType === 'FIXED_RATE' ? String(product.interestRatePct ?? product.interestRate ?? 0) : '0');
    setInterestMethod(product.interestMethod === 'FLAT_RATE' ? 'FLAT_RATE' : 'REDUCING_BALANCE');
    if (product.maxTenureMonths && Number(tenureMonths) > Number(product.maxTenureMonths)) {
      setTenureMonths(String(product.maxTenureMonths));
    }
  };

  const handleProductSelectionChange = (prodId: string) => {
    const prod = loanTypes.find(lt => lt.id === prodId);
    if (prod) {
      applyProductDefaults(prod);
    } else {
      setLoanTypeId(prodId);
    }
  };

  const handleOpenSanctionModal = () => {
    setFormError(null);
    if (loanTypes.length > 0) {
      applyProductDefaults(loanTypes[0]);
    }
    if (employees.length > 0 && !employeeId) setEmployeeId(employees[0].id);
    // Principal Amount starts empty
    setPrincipalAmount('');
    setTenureMonths('12');
    setInterestStartDate(new Date().toISOString().split('T')[0]);
    setRepaymentFrequency('MONTHLY');
    setOrderNumber(`ORD-${Date.now().toString().slice(-6)}`);
    setPreviewData(null);
    setShowSanctionModal(true);
  };

  const selectedProduct = loanTypes.find(lt => lt.id === loanTypeId);

  // Field-level validation functions
  const validatePrincipalField = (val: string): string | null => {
    if (!val || val.trim() === '') {
      return 'Principal amount is required.';
    }
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) {
      return 'Enter a valid numeric amount.';
    }
    if (num <= 0) {
      return 'Principal amount must be greater than zero.';
    }
    if (selectedProduct) {
      if (selectedProduct.minAmount && num < Number(selectedProduct.minAmount)) {
        return `Minimum allowed principal is ₹${Number(selectedProduct.minAmount).toLocaleString('en-IN')}`;
      }
      if (selectedProduct.maxAmount && num > Number(selectedProduct.maxAmount)) {
        return `Maximum allowed principal is ₹${Number(selectedProduct.maxAmount).toLocaleString('en-IN')}`;
      }
    }
    return null;
  };

  const validateTenureField = (val: string): string | null => {
    if (!val || val.trim() === '') {
      return 'Tenure is required.';
    }
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
      return 'Tenure must be a positive whole number of months.';
    }
    if (selectedProduct && selectedProduct.maxTenureMonths && num > Number(selectedProduct.maxTenureMonths)) {
      return `Maximum allowed tenure is ${selectedProduct.maxTenureMonths} months.`;
    }
    return null;
  };

  const validateRateField = (rateVal: string): string | null => {
    if (interestType === 'INTEREST_FREE') return null;
    if (!rateVal || rateVal.trim() === '') {
      return 'Interest rate is required for interest-bearing loans.';
    }
    const rate = Number(rateVal);
    if (isNaN(rate) || !isFinite(rate)) {
      return 'Enter a valid numeric percentage.';
    }
    if (rate < 0) {
      return 'Interest rate cannot be negative.';
    }
    if (selectedProduct) {
      if (selectedProduct.minInterestRatePct !== null && selectedProduct.minInterestRatePct !== undefined && rate < Number(selectedProduct.minInterestRatePct)) {
        return `Minimum permitted rate is ${selectedProduct.minInterestRatePct}%.`;
      }
      if (selectedProduct.maxInterestRatePct !== null && selectedProduct.maxInterestRatePct !== undefined && rate > Number(selectedProduct.maxInterestRatePct)) {
        return `Maximum permitted rate is ${selectedProduct.maxInterestRatePct}%.`;
      }
    }
    return null;
  };

  const principalError = validatePrincipalField(principalAmount);
  const tenureError = validateTenureField(tenureMonths);
  const rateError = validateRateField(interestRatePct);

  const isFormValid = Boolean(
    employeeId &&
    loanTypeId &&
    principalAmount.trim() !== '' &&
    !principalError &&
    !tenureError &&
    !rateError
  );

  // Live EMI Preview calculation effect
  useEffect(() => {
    const p = parseFloat(principalAmount);
    const n = parseInt(tenureMonths, 10);
    const r = interestType === 'INTEREST_FREE' ? 0 : parseFloat(interestRatePct);

    // If principal is empty or invalid, clear preview immediately
    if (!principalAmount || isNaN(p) || p <= 0 || isNaN(n) || n <= 0 || rateError) {
      setPreviewData(null);
      return;
    }

    // Client-side instant calculation
    let monthlyEmi = 0;
    let totalInterest = 0;
    let totalRepayment = p;

    if (interestType === 'INTEREST_FREE' || isNaN(r) || r === 0) {
      monthlyEmi = Math.round(p / n);
      totalRepayment = p;
      totalInterest = 0;
    } else if (interestMethod === 'FLAT_RATE') {
      totalInterest = Math.round(p * (r / 100) * (n / 12));
      totalRepayment = p + totalInterest;
      monthlyEmi = Math.round(totalRepayment / n);
    } else {
      // REDUCING_BALANCE
      const monthlyRate = r / 12 / 100;
      const factor = Math.pow(1 + monthlyRate, n);
      monthlyEmi = Math.round((p * monthlyRate * factor) / (factor - 1));
      totalRepayment = monthlyEmi * n;
      totalInterest = Math.max(0, totalRepayment - p);
    }

    setPreviewData({
      principalAmount: p,
      interestType,
      interestRatePct: r,
      interestMethod,
      tenureMonths: n,
      monthlyEmi,
      totalInterest,
      totalRepayment,
      firstRepaymentDate: interestStartDate
    });

    // Authoritative backend preview call
    const debounceTimer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          principalAmount: p.toString(),
          tenureMonths: n.toString(),
          interestType,
          interestRatePct: r.toString(),
          interestMethod,
          repaymentFrequency
        });
        const res: any = await api.get(`/loans/preview-emi?${query.toString()}`);
        if (res && res.calculation) {
          setPreviewData(prev => ({
            ...prev,
            principalAmount: res.calculation.principalAmount,
            monthlyEmi: res.calculation.monthlyEmi,
            totalInterest: res.calculation.totalInterest,
            totalRepayment: res.calculation.totalRepayment,
            interestType: res.calculation.interestType,
            interestRatePct: res.calculation.interestRatePct,
            interestMethod: res.calculation.interestMethod,
            tenureMonths: res.calculation.tenureMonths,
            firstRepaymentDate: interestStartDate
          }));
        }
      } catch {
        // Retain local client calculation
      }
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [principalAmount, tenureMonths, interestType, interestRatePct, interestMethod, repaymentFrequency, interestStartDate, rateError]);

  const handleSanctionLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const pErr = validatePrincipalField(principalAmount);
    if (pErr) {
      setFormError(pErr);
      return;
    }
    const tErr = validateTenureField(tenureMonths);
    if (tErr) {
      setFormError(tErr);
      return;
    }
    const rErr = validateRateField(interestRatePct);
    if (rErr) {
      setFormError(rErr);
      return;
    }

    if (!employeeId) {
      setFormError('Please select a beneficiary employee.');
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/loans', {
        employeeId,
        loanTypeId,
        principalAmount: Number(principalAmount),
        tenureMonths: Number(tenureMonths),
        interestType,
        interestRatePct: interestType === 'INTEREST_FREE' ? 0 : Number(interestRatePct),
        interestMethod,
        interestStartDate: interestStartDate || new Date().toISOString().split('T')[0],
        repaymentFrequency,
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
    setAmendPrincipal(String(loan.principalAmount));
    setAmendTenure(String(loan.tenureMonths || loan.totalInstallments));
    setAmendInterestType(loan.interestType === 'FIXED_RATE' ? 'FIXED_RATE' : 'INTEREST_FREE');
    setAmendInterestRatePct(String(loan.interestRatePct ?? 0));
    setAmendInterestMethod(loan.interestMethod === 'FLAT_RATE' ? 'FLAT_RATE' : 'REDUCING_BALANCE');
    setAmendStatus(loan.status);
    setFormError(null);
    setShowAmendModal(true);
  };

  const handleAmendLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    if (selectedLoan.id === 'b405b4b8-1211-48c5-a59e-ee8db001a906') return;
    setFormError(null);

    const p = Number(amendPrincipal);
    if (isNaN(p) || p <= 0) {
      setFormError('Principal amount must be a positive number.');
      return;
    }
    if (p < Number(selectedLoan.recoveredAmount)) {
      setFormError(`Principal cannot be reduced below already recovered amount of ₹${Number(selectedLoan.recoveredAmount).toLocaleString('en-IN')}`);
      return;
    }

    setActionLoading(true);
    try {
      await api.patch(`/loans/${selectedLoan.id}`, {
        principalAmount: p,
        tenureMonths: Number(amendTenure),
        interestType: amendInterestType,
        interestRatePct: amendInterestType === 'INTEREST_FREE' ? 0 : Number(amendInterestRatePct),
        interestMethod: amendInterestMethod,
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
      setRepaymentsSchedule(res.projectedSchedule || []);
      setRepaymentsTab('SCHEDULE');
      setShowRepaymentsModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load repayments schedule');
    }
  };

  // Product Policy Management
  const handleOpenProductPolicy = (prod?: any) => {
    if (prod) {
      setEditingProduct(prod);
      setPolicyName(prod.name || '');
      setPolicyMaxAmount(String(prod.maxAmount || 100000));
      setPolicyMinAmount(String(prod.minAmount || 1000));
      setPolicyMaxTenure(String(prod.maxTenureMonths || 36));
      setPolicyInterestType(prod.interestType === 'FIXED_RATE' ? 'FIXED_RATE' : 'INTEREST_FREE');
      setPolicyInterestRatePct(String(prod.interestRatePct ?? prod.interestRate ?? 0));
      setPolicyMinInterestRatePct(String(prod.minInterestRatePct ?? 0));
      setPolicyMaxInterestRatePct(String(prod.maxInterestRatePct ?? 24));
      setPolicyInterestMethod(prod.interestMethod === 'FLAT_RATE' ? 'FLAT_RATE' : 'REDUCING_BALANCE');
      setPolicyAllowRateOverride(prod.allowRateOverride !== false);
    } else {
      setEditingProduct(null);
      setPolicyName('');
      setPolicyMaxAmount('100000');
      setPolicyMinAmount('1000');
      setPolicyMaxTenure('36');
      setPolicyInterestType('INTEREST_FREE');
      setPolicyInterestRatePct('0');
      setPolicyMinInterestRatePct('0');
      setPolicyMaxInterestRatePct('24');
      setPolicyInterestMethod('REDUCING_BALANCE');
      setPolicyAllowRateOverride(true);
    }
    setShowProductPolicyModal(true);
  };

  const handleSaveProductPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        name: policyName,
        maxAmount: Number(policyMaxAmount),
        minAmount: Number(policyMinAmount),
        maxTenureMonths: Number(policyMaxTenure),
        interestType: policyInterestType,
        interestRatePct: policyInterestType === 'INTEREST_FREE' ? 0 : Number(policyInterestRatePct),
        minInterestRatePct: policyInterestType === 'INTEREST_FREE' ? 0 : Number(policyMinInterestRatePct),
        maxInterestRatePct: policyInterestType === 'INTEREST_FREE' ? 0 : Number(policyMaxInterestRatePct),
        interestMethod: policyInterestMethod,
        allowRateOverride: policyAllowRateOverride
      };

      if (editingProduct) {
        await api.patch(`/loans/types/${editingProduct.id}`, payload);
      } else {
        await api.post('/loans/types', {
          ...payload,
          code: policyName.replace(/[^A-Z0-9]/gi, '_').toUpperCase() + '_' + Date.now().toString().slice(-4)
        });
      }
      setShowProductPolicyModal(false);
      await loadLoans();
    } catch (err: any) {
      alert(err.message || 'Failed to save loan product policy.');
    } finally {
      setActionLoading(false);
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
        subtitle="Configurable Interest Policies, Multi-month Amortization & Automated Payroll Deductions"
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
            {canManagePolicy && (
              <button className="btn btn-outline btn-sm" onClick={() => handleOpenProductPolicy()} title="Configure Loan Products & Interest Policies">
                <Settings size={14} /> Product Policies
              </button>
            )}
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
                <th>Product & Terms</th>
                <th className="money">Principal</th>
                <th className="money">Monthly Recovery</th>
                <th style={{ textAlign: 'center' }}>Progress</th>
                <th className="money">Total Repayable</th>
                <th className="money">Outstanding Balance</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading loan records and schedules...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No advances or loans recorded for this company. Click "Sanction Advance / Loan" above to issue one.
                  </td>
                </tr>
              ) : (
                loans.map(l => {
                  const emi = Number(l.monthlyEmi ?? l.monthlyInstallment ?? 0);
                  const principal = Number(l.principalAmount ?? 0);
                  const totalRepay = Number(l.totalRepayment ?? l.principalAmount ?? 0);
                  const outstanding = Number(l.outstandingAmount ?? 0);
                  const tenure = l.tenureMonths ?? l.totalInstallments ?? 1;
                  const recoveredCount = l.recoveredInstallments ?? l.repayments?.length ?? 0;
                  const isInterestBearing = l.interestType === 'FIXED_RATE' || Number(l.interestRatePct) > 0;
                  const rate = Number(l.interestRatePct ?? l.loanType?.interestRatePct ?? 0);
                  const method = l.interestMethod === 'FLAT_RATE' ? 'Flat' : 'Reducing';
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
                          {l.employee?.employeeCode} • {l.employee?.department?.name || 'General'}
                        </div>
                      </td>
                      <td>
                        <strong>{l.loanType?.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isInterestBearing ? (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>
                              {rate}% p.a. ({method})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                              Interest-Free
                            </span>
                          )}
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
                      <td className="money" style={{ fontWeight: 600 }}>
                        ₹{totalRepay.toLocaleString('en-IN')}
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
                            title="View Repayment Schedule & Ledger"
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
      {/* MODAL: SANCTION ADVANCE / LOAN                                           */}
      {/* ========================================================================= */}
      <FormModal
        isOpen={canApplyLoan && showSanctionModal}
        onClose={() => setShowSanctionModal(false)}
        title="Sanction Employee Advance / Loan"
        subtitle="Configure loan terms, interest calculations, and automated monthly payroll recovery"
        icon={<Landmark size={18} />}
        width="lg"
        onSubmit={handleSanctionLoan}
        submitLabel="Sanction & Activate"
        isSubmitting={actionLoading}
        isSubmitDisabled={!isFormValid || actionLoading}
      >
        {formError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
            {formError}
          </div>
        )}

        {/* Section 1: Parties and Product */}
        <div className="form-grid-2">
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
              onChange={e => handleProductSelectionChange(e.target.value)}
              required
            >
              {loanTypes.map(lt => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} (Max: ₹{Number(lt.maxAmount).toLocaleString('en-IN')}, Tenure: {lt.maxTenureMonths}m)
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Product Policy: {selectedProduct.interestType === 'FIXED_RATE' ? `Fixed Rate (${selectedProduct.interestRatePct ?? 0}% p.a.)` : 'Interest-Free'} • Max ₹{Number(selectedProduct.maxAmount).toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Financial Terms */}
        <div className="form-grid-2">
          {/* Principal Amount - Starts empty, strictly validated */}
          <div className="form-group">
            <label className="form-label">Principal Amount (₹) *</label>
            <input
              className={`form-input ${principalError && principalAmount ? 'border-danger' : ''}`}
              type="number"
              placeholder="Enter principal amount"
              step="1"
              required
              value={principalAmount}
              onChange={e => setPrincipalAmount(e.target.value)}
            />
            {principalError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>
                {principalError}
              </div>
            )}
            {!principalError && selectedProduct && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Limit: ₹{Number(selectedProduct.minAmount || 1000).toLocaleString('en-IN')} – ₹{Number(selectedProduct.maxAmount).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Tenure Months */}
          <div className="form-group">
            <label className="form-label">Tenure (Months) *</label>
            <input
              className={`form-input ${tenureError ? 'border-danger' : ''}`}
              type="number"
              min="1"
              max={selectedProduct?.maxTenureMonths || 60}
              placeholder="e.g. 12"
              required
              value={tenureMonths}
              onChange={e => setTenureMonths(e.target.value)}
            />
            {tenureError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>
                {tenureError}
              </div>
            )}
            {!tenureError && selectedProduct && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Max Allowed: {selectedProduct.maxTenureMonths} months
              </span>
            )}
          </div>
        </div>

        {/* Section 3: Interest Configuration */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Percent size={16} color="var(--primary)" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Interest Configuration & Policy</span>
          </div>

          <div className="form-grid-2">
            {/* Interest Type */}
            <div className="form-group">
              <label className="form-label">Interest Type *</label>
              <select
                className="form-select"
                value={interestType}
                onChange={e => {
                  const val = e.target.value as 'INTEREST_FREE' | 'FIXED_RATE';
                  setInterestType(val);
                  if (val === 'INTEREST_FREE') {
                    setInterestRatePct('0');
                  } else if (selectedProduct && selectedProduct.interestRatePct) {
                    setInterestRatePct(String(selectedProduct.interestRatePct));
                  }
                }}
              >
                <option value="INTEREST_FREE">Interest-Free (0% Policy)</option>
                <option value="FIXED_RATE">Fixed Interest Rate</option>
              </select>
            </div>

            {/* Annual Interest Rate (%) */}
            <div className="form-group">
              <label className="form-label">Annual Interest Rate (%) *</label>
              <input
                className={`form-input ${rateError ? 'border-danger' : ''}`}
                type="number"
                step="0.01"
                min="0"
                disabled={interestType === 'INTEREST_FREE' || (selectedProduct?.allowRateOverride === false && !canManagePolicy)}
                placeholder={interestType === 'INTEREST_FREE' ? '0.00% (Interest-Free)' : 'e.g. 8.50'}
                value={interestType === 'INTEREST_FREE' ? '0' : interestRatePct}
                onChange={e => setInterestRatePct(e.target.value)}
              />
              {rateError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>
                  {rateError}
                </div>
              )}
              {selectedProduct && selectedProduct.interestType === 'FIXED_RATE' && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Policy Range: {selectedProduct.minInterestRatePct ?? 0}% – {selectedProduct.maxInterestRatePct ?? 24}% p.a.
                </span>
              )}
            </div>
          </div>

          <div className="form-grid-3" style={{ marginTop: '10px' }}>
            {/* Calculation Method */}
            <div className="form-group">
              <label className="form-label">Calculation Method *</label>
              <select
                className="form-select"
                value={interestMethod}
                disabled={interestType === 'INTEREST_FREE'}
                onChange={e => setInterestMethod(e.target.value as 'REDUCING_BALANCE' | 'FLAT_RATE')}
              >
                <option value="REDUCING_BALANCE">Reducing Balance (Standard EMI)</option>
                <option value="FLAT_RATE">Flat Rate</option>
              </select>
            </div>

            {/* Repayment Frequency */}
            <div className="form-group">
              <label className="form-label">Repayment Frequency</label>
              <input
                className="form-input"
                value="Monthly (Payroll Linked)"
                disabled
              />
            </div>

            {/* Interest / Deduction Start Date */}
            <div className="form-group">
              <label className="form-label">First Repayment Date</label>
              <input
                className="form-input"
                type="date"
                value={interestStartDate}
                onChange={e => setInterestStartDate(e.target.value)}
              />
            </div>
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

        {/* Live EMI Calculation & Summary Callout */}
        <div style={{ background: previewData ? '#eff6ff' : '#f8fafc', border: previewData ? '1px solid #bfdbfe' : '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
          {!previewData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <Info size={16} />
              <span>Enter a valid positive principal amount and tenure above to view the live projected EMI schedule.</span>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dbeafe', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={18} color="#1d4ed8" />
                  <strong style={{ fontSize: '0.9rem', color: '#1e40af' }}>Projected Repayment Estimate</strong>
                  <span className="badge badge-brand" style={{ fontSize: '0.65rem' }}>Estimated</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Estimated Monthly EMI</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af' }}>
                    ₹{previewData.monthlyEmi.toLocaleString('en-IN')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/ mo</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: '#475569' }}>Principal:</span>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>₹{previewData.principalAmount.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span style={{ color: '#475569' }}>Interest Rate:</span>
                  <div style={{ fontWeight: 600, color: previewData.interestType === 'INTEREST_FREE' ? 'var(--success)' : '#d97706' }}>
                    {previewData.interestType === 'INTEREST_FREE' ? '0.00% (Interest-Free)' : `${previewData.interestRatePct}% (${previewData.interestMethod === 'FLAT_RATE' ? 'Flat' : 'Reducing'})`}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#475569' }}>Total Interest:</span>
                  <div style={{ fontWeight: 600, color: '#b45309' }}>₹{previewData.totalInterest.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span style={{ color: '#475569' }}>Total Repayment:</span>
                  <div style={{ fontWeight: 700, color: '#1e40af' }}>₹{previewData.totalRepayment.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '10px' }}>
                ℹ️ Deductions will be executed automatically under payroll component code <strong>LOAN_EMI</strong>. Estimates are calculated using standard banking financial models and reconciled to the nearest rupee.
              </div>
            </div>
          )}
        </div>
      </FormModal>

      {/* ========================================================================= */}
      {/* MODAL: AMEND LOAN TERMS                                                  */}
      {/* ========================================================================= */}
      {selectedLoan && (
        <FormModal
          isOpen={canApproveLoan && showAmendModal}
          onClose={() => setShowAmendModal(false)}
          title={`Amend Advance Terms: ${selectedLoan.sanctionOrderNumber || `ORD-${selectedLoan.id.slice(-6).toUpperCase()}`}`}
          subtitle="Adjust remaining principal, tenure, or interest policy terms"
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
              onChange={e => setAmendPrincipal(e.target.value)}
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
              onChange={e => setAmendTenure(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Cannot be less than completed installments ({selectedLoan.repayments?.length || 0})
            </span>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Interest Type</label>
              <select
                className="form-select"
                value={amendInterestType}
                onChange={e => setAmendInterestType(e.target.value as 'INTEREST_FREE' | 'FIXED_RATE')}
              >
                <option value="INTEREST_FREE">Interest-Free</option>
                <option value="FIXED_RATE">Fixed Rate</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Annual Rate (%)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                disabled={amendInterestType === 'INTEREST_FREE'}
                value={amendInterestType === 'INTEREST_FREE' ? '0' : amendInterestRatePct}
                onChange={e => setAmendInterestRatePct(e.target.value)}
              />
            </div>
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
      {/* MODAL: REPAYMENT SCHEDULE & AMORTIZATION LEDGER                           */}
      {/* ========================================================================= */}
      {selectedLoan && (
        <FormModal
          isOpen={showRepaymentsModal}
          onClose={() => setShowRepaymentsModal(false)}
          title={`Loan Ledger: ${selectedLoan.sanctionOrderNumber || `ORD-${selectedLoan.id.slice(-6).toUpperCase()}`}`}
          subtitle="Audit trail of projected amortization and historical payroll deductions"
          icon={<FileText size={18} />}
          width="lg"
          footer={
            <button className="btn btn-secondary" onClick={() => setShowRepaymentsModal(false)}>
              Close Ledger
            </button>
          }
        >
          {/* Summary Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Borrower:</span>
              <div><strong>{selectedLoan.employee?.firstName} {selectedLoan.employee?.lastName}</strong></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedLoan.employee?.employeeCode}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Principal:</span>
              <div className="money" style={{ fontWeight: 600 }}>₹{Number(selectedLoan.principalAmount).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: selectedLoan.interestType === 'FIXED_RATE' ? '#d97706' : 'var(--success)' }}>
                {selectedLoan.interestType === 'FIXED_RATE' ? `${selectedLoan.interestRatePct}% p.a.` : 'Interest-Free'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Repayable:</span>
              <div className="money" style={{ fontWeight: 600 }}>₹{Number(selectedLoan.totalRepayment || selectedLoan.principalAmount).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: '#b45309' }}>
                Interest: ₹{Number(selectedLoan.totalInterest || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Recovered:</span>
              <div className="money" style={{ color: 'var(--success)', fontWeight: 600 }}>₹{Number(selectedLoan.recoveredAmount).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {selectedLoan.repayments?.length || 0} installments
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Outstanding:</span>
              <div className="money" style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.95rem' }}>₹{Number(selectedLoan.outstandingAmount).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                EMI: ₹{Number(selectedLoan.monthlyEmi).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '16px' }}>
            <button
              className={`btn btn-sm ${repaymentsTab === 'SCHEDULE' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRepaymentsTab('SCHEDULE')}
            >
              <TrendingDown size={14} /> Projected Amortization Schedule
            </button>
            <button
              className={`btn btn-sm ${repaymentsTab === 'HISTORY' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRepaymentsTab('HISTORY')}
            >
              <CheckCircle2 size={14} /> Recorded Payroll Deductions ({selectedLoan.repayments?.length || 0})
            </button>
          </div>

          {repaymentsTab === 'SCHEDULE' ? (
            <div style={{ marginTop: '12px' }}>
              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>Inst #</th>
                      <th>Due Date</th>
                      <th className="money">Opening Balance</th>
                      <th className="money">Installment (EMI)</th>
                      <th className="money">Principal</th>
                      <th className="money">Interest</th>
                      <th className="money">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repaymentsSchedule.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No amortization schedule generated for this loan.
                        </td>
                      </tr>
                    ) : (
                      repaymentsSchedule.map((row: any) => (
                        <tr key={row.installmentNumber}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.installmentNumber}</td>
                          <td>{row.dueDate}</td>
                          <td className="money">₹{row.openingBalance.toLocaleString('en-IN')}</td>
                          <td className="money" style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{row.emi.toLocaleString('en-IN')}</td>
                          <td className="money">₹{row.principalPortion.toLocaleString('en-IN')}</td>
                          <td className="money" style={{ color: row.interestPortion > 0 ? '#b45309' : 'var(--text-muted)' }}>
                            ₹{row.interestPortion.toLocaleString('en-IN')}
                          </td>
                          <td className="money" style={{ fontWeight: row.closingBalance === 0 ? 700 : 400, color: row.closingBalance === 0 ? 'var(--success)' : 'inherit' }}>
                            ₹{row.closingBalance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '12px' }}>
              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>Installment #</th>
                      <th>Deduction Date</th>
                      <th className="money">Amount Recovered</th>
                      <th>Reference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedLoan.repayments || selectedLoan.repayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No installments have been processed through payroll yet. Recoveries begin in the next pay cycle.
                        </td>
                      </tr>
                    ) : (
                      selectedLoan.repayments.map((rep: any) => (
                        <tr key={rep.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{rep.installmentNumber}</td>
                          <td>
                            {rep.paidDate && !isNaN(new Date(rep.paidDate).getTime())
                              ? new Date(rep.paidDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                          <td className="money" style={{ color: 'var(--success)', fontWeight: 600 }}>
                            ₹{Number(rep.amountPaid).toLocaleString('en-IN')}
                          </td>
                          <td>{rep.payrollRunId ? `Payroll Run #${rep.payrollRunId.slice(-6)}` : 'Automated Recovery'}</td>
                          <td><span className="badge badge-approved">RECOVERED</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </FormModal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE LOAN PRODUCTS & POLICY (Admin Controls)                 */}
      {/* ========================================================================= */}
      <FormModal
        isOpen={showProductPolicyModal}
        onClose={() => setShowProductPolicyModal(false)}
        title={editingProduct ? `Edit Loan Product: ${editingProduct.name}` : "Configure Loan Products & Interest Policies"}
        subtitle="Manage product limits, permitted interest rates, and calculation methods"
        icon={<Settings size={18} />}
        width="lg"
        onSubmit={handleSaveProductPolicy}
        submitLabel={editingProduct ? "Save Policy Updates" : "Create Product Policy"}
        isSubmitting={actionLoading}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              className="form-input"
              value={policyName}
              placeholder="e.g. Festival Advance, Personal Loan"
              onChange={e => setPolicyName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Principal Cap (₹) *</label>
            <input
              className="form-input"
              type="number"
              min="1000"
              value={policyMaxAmount}
              onChange={e => setPolicyMaxAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Min Principal Cap (₹)</label>
            <input
              className="form-input"
              type="number"
              min="100"
              value={policyMinAmount}
              onChange={e => setPolicyMinAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Tenure (Months) *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="120"
              value={policyMaxTenure}
              onChange={e => setPolicyMaxTenure(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Default Interest Type *</label>
            <select
              className="form-select"
              value={policyInterestType}
              onChange={e => setPolicyInterestType(e.target.value as 'INTEREST_FREE' | 'FIXED_RATE')}
            >
              <option value="INTEREST_FREE">Interest-Free Loan</option>
              <option value="FIXED_RATE">Fixed Interest Rate Loan</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Default Annual Rate (%)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              disabled={policyInterestType === 'INTEREST_FREE'}
              value={policyInterestType === 'INTEREST_FREE' ? '0' : policyInterestRatePct}
              onChange={e => setPolicyInterestRatePct(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Min Permitted Rate (%)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              disabled={policyInterestType === 'INTEREST_FREE'}
              value={policyInterestType === 'INTEREST_FREE' ? '0' : policyMinInterestRatePct}
              onChange={e => setPolicyMinInterestRatePct(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Permitted Rate (%)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              disabled={policyInterestType === 'INTEREST_FREE'}
              value={policyInterestType === 'INTEREST_FREE' ? '0' : policyMaxInterestRatePct}
              onChange={e => setPolicyMaxInterestRatePct(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Calculation Method</label>
            <select
              className="form-select"
              value={policyInterestMethod}
              disabled={policyInterestType === 'INTEREST_FREE'}
              onChange={e => setPolicyInterestMethod(e.target.value as 'REDUCING_BALANCE' | 'FLAT_RATE')}
            >
              <option value="REDUCING_BALANCE">Reducing Balance</option>
              <option value="FLAT_RATE">Flat Rate</option>
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '28px' }}>
            <input
              type="checkbox"
              id="allowOverride"
              checked={policyAllowRateOverride}
              onChange={e => setPolicyAllowRateOverride(e.target.checked)}
            />
            <label htmlFor="allowOverride" style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              Allow Sanctioner to Override Rate (within bounds)
            </label>
          </div>
        </div>

        {/* Existing Products List for Quick Edit */}
        {!editingProduct && loanTypes.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h5 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '8px' }}>Configured Loan Products ({loanTypes.length})</h5>
            <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Rate Range</th>
                    <th>Max Cap</th>
                    <th>Max Tenure</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loanTypes.map(prod => (
                    <tr key={prod.id}>
                      <td><strong>{prod.name}</strong></td>
                      <td>{prod.interestType === 'FIXED_RATE' ? 'Fixed Rate' : 'Interest-Free'}</td>
                      <td>{prod.interestType === 'FIXED_RATE' ? `${prod.minInterestRatePct ?? 0}% - ${prod.maxInterestRatePct ?? 24}%` : '0%'}</td>
                      <td className="money">₹{Number(prod.maxAmount).toLocaleString('en-IN')}</td>
                      <td>{prod.maxTenureMonths}m</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenProductPolicy(prod)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FormModal>

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
