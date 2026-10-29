import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import {
  Play,
  CheckCheck,
  Lock,
  CheckCircle,
  RotateCcw,
  FileText,
  Printer,
  X,
  Plus,
  Edit3,
  Calculator,
  Download,
  AlertTriangle,
  Layers,
  Sparkles,
  Save,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Eye,
  Info,
  Filter,
  Users,
  Building,
  TrendingUp,
  TrendingDown,
  Search
} from 'lucide-react';
import { CreatePayrollRunModal } from '../components/payroll/CreatePayrollRunModal';
import { ManualAdjustmentModal } from '../components/payroll/ManualAdjustmentModal';
import { TdsDeferralModal } from '../components/payroll/TdsDeferralModal';
import { DetailedCalculationModal } from '../components/payroll/DetailedCalculationModal';
import { DepartmentPayrollWorkspace } from '../components/payroll/DepartmentPayrollWorkspace';
import { formatAmount, formatCurrency } from '../utils/formatters';

interface StageDefinition {
  stage: number;
  id: string;
  label: string;
  description: string;
}

const SEVEN_STAGES: StageDefinition[] = [
  { stage: 1, id: 'DRAFT', label: '1. Draft', description: 'Batch initialized & scope established' },
  { stage: 2, id: 'VALIDATED', label: '2. Validated', description: 'Attendance, LOP & CTC verified' },
  { stage: 3, id: 'CALCULATED', label: '3. Calculated', description: 'Pure decimal math executed' },
  { stage: 4, id: 'REVIEWED', label: '4. Reviewed', description: 'Variances audited & flagged' },
  { stage: 5, id: 'APPROVED', label: '5. Approved', description: 'Executive signoff authorized' },
  { stage: 6, id: 'PAYMENT_READY', label: '6. Payment Ready', description: 'Electronic bank advice (NEFT) ready' },
  { stage: 7, id: 'PAID', label: '7. Paid', description: 'UTR confirmed & slips released to ESS' }
];

export const PayrollProcessingView: React.FC = () => {
  const { hasRole, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'runs' | 'dept-payroll' | 'editor' | 'tds'>('runs');

  // Runs & Period State
  const [runs, setRuns] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipData, setPayslipData] = useState<any | null>(null);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(true);

  // Generate / Draft form state
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [generateRemarks, setGenerateRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Rejection / Recalculate modal
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);
  const [recalculateRemarks, setRecalculateRemarks] = useState('');

  // Payment Confirmation (Stage 7) modal
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  // New Month / Period Modal
  const [showNewMonthModal, setShowNewMonthModal] = useState(false);
  const [newMonthNumber, setNewMonthNumber] = useState<number>(new Date().getMonth() + 1);
  const [newMonthYear, setNewMonthYear] = useState<number>(new Date().getFullYear());
  const [creatingMonth, setCreatingMonth] = useState(false);

  // Monthly Salary Editor State
  const [editorRunId, setEditorRunId] = useState<string>('');
  const [editorData, setEditorData] = useState<any | null>(null);
  const [editorEmployees, setEditorEmployees] = useState<any[]>([]);
  const [editorOriginalEmployees, setEditorOriginalEmployees] = useState<any[]>([]);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [savingAdjustments, setSavingAdjustments] = useState(false);
  const [highlightNet25, setHighlightNet25] = useState(true);
  const [editorSearch, setEditorSearch] = useState('');
  const [editorDeptFilter, setEditorDeptFilter] = useState('ALL');
  const [editorStatusFilter, setEditorStatusFilter] = useState('ALL');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);

  // TDS Process State
  const [tdsPeriodId, setTdsPeriodId] = useState<string>('');
  const [tdsSummary, setTdsSummary] = useState<any | null>(null);
  const [loadingTds, setLoadingTds] = useState(false);
  const [portingTds, setPortingTds] = useState(false);

  // Task 4: Review Table & Department Subtotals State (Section 4)
  const [reviewTableData, setReviewTableData] = useState<any | null>(null);
  const [loadingReviewTable, setLoadingReviewTable] = useState(false);
  const [reviewDeptFilter, setReviewDeptFilter] = useState('ALL');

  // Task 4: Sub-Modals State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedEmployeeForRow, setSelectedEmployeeForRow] = useState<any | null>(null);
  const [showTdsModal, setShowTdsModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [selectedCalcRow, setSelectedCalcRow] = useState<any | null>(null);

  const fetchReviewTable = async (runId: string) => {
    setLoadingReviewTable(true);
    try {
      const res: any = await api.get(`/payroll/runs/${runId}/review-table`);
      setReviewTableData(res);
    } catch (err) {
      console.error('Failed to load review table:', err);
    } finally {
      setLoadingReviewTable(false);
    }
  };

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const res: any = await api.get('/payroll/runs');
      const fetchedRuns = res.runs || [];
      setRuns(fetchedRuns);
      if (fetchedRuns.length > 0) {
        const defaultRun = fetchedRuns[0];
        if (!editorRunId) {
          setEditorRunId(defaultRun.id);
          loadEditorData(defaultRun.id);
        }
        if (!selectedRun) {
          setSelectedRun(defaultRun);
          fetchReviewTable(defaultRun.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch payroll runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const fetchPeriods = async () => {
    try {
      const pRes: any = await api.get('/payroll/periods').catch(() => ({ periods: [] }));
      const pList = pRes.periods || [];
      setPeriods(pList);
      if (pList.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(pList[0].id);
        if (!tdsPeriodId) setTdsPeriodId(pList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch periods:', err);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (activeTab === 'editor' && editorRunId) {
      loadEditorData(editorRunId);
    }
  }, [activeTab]);

  useEffect(() => {
    if (editorRunId) {
      loadEditorData(editorRunId);
    }
  }, [editorRunId]);

  const viewRunDetails = async (runId: string) => {
    try {
      const res: any = await api.get(`/payroll/runs/${runId}`);
      setSelectedRun(res.run);
      fetchReviewTable(runId);
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------
  // 7-Stage Workflow Step Actions
  // -------------------------------------------------------------

  // STAGE 1: DRAFT (Initialize Batch)
  const handleCreateDraft = async () => {
    if (!selectedPeriodId) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res: any = await api.post('/payroll/runs/draft', { periodId: selectedPeriodId });
      setShowGenerateModal(false);
      setActionSuccess(`Batch initialized in Stage 1 (DRAFT) for run ${res.run?.runNumber || ''}`);
      await fetchRuns();
      if (res.run?.id) viewRunDetails(res.run.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to initialize payroll draft');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 2: VALIDATE (Verify inputs & exceptions)
  const handleValidateRun = async (runId: string) => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res: any = await api.post(`/payroll/runs/${runId}/validate`);
      setActionSuccess(`Stage 2 Completed: Verified inputs for ${res.validationNotes?.eligibleEmployees || 'all'} employees.`);
      await fetchRuns();
      viewRunDetails(runId);
    } catch (err: any) {
      setActionError(err.message || 'Validation failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 3: CALCULATE (Execute pure decimal math)
  const handleCalculateRun = async (runId: string) => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res: any = await api.post(`/payroll/runs/${runId}/calculate`);
      setActionSuccess(`Stage 3 Completed: Successfully calculated gross, deductions & net salary.`);
      await fetchRuns();
      viewRunDetails(runId);
    } catch (err: any) {
      setActionError(err.message || 'Calculation failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 4: REVIEW (Audit variances against prior runs)
  const handleReviewRun = async (runId: string) => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.post(`/payroll/runs/${runId}/review`);
      setActionSuccess('Stage 4 Completed: Variances audited. Run is ready for executive approval.');
      await fetchRuns();
      viewRunDetails(runId);
    } catch (err: any) {
      setActionError(err.message || 'Review variance audit failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 5: APPROVE (Finance / Executive Signoff with SOD)
  const handleApproveRun = async (runId: string) => {
    if (!confirm('Are you sure you want to authorize this payroll disbursement? Segregation of duties will be validated.')) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.post(`/payroll/runs/${runId}/approve`);
      setActionSuccess('Stage 5 Completed: Disbursement formally approved by Finance Executive.');
      await fetchRuns();
      viewRunDetails(runId);
    } catch (err: any) {
      setActionError(err.message || 'Approval signoff failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 6: PAYMENT READY (Generate Electronic Bank Advice)
  const handlePaymentReady = async (runId: string) => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.post(`/payroll/runs/${runId}/payment-ready`);
      setActionSuccess('Stage 6 Completed: Electronic bank payment register (NEFT) generated.');
      await fetchRuns();
      viewRunDetails(runId);
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate bank payment register');
    } finally {
      setSubmittingAction(false);
    }
  };

  // STAGE 7: MARK PAID (Record UTR & Release Slips)
  const handleConfirmPaid = async () => {
    if (!selectedRun || !paymentReference.trim()) {
      alert('Please enter a valid bank reference or UTR number.');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.post(`/payroll/runs/${selectedRun.id}/mark-paid`, {
        paymentReference: paymentReference.trim()
      });
      setShowMarkPaidModal(false);
      setPaymentReference('');
      setActionSuccess(`Stage 7 Completed: Disbursement confirmed. Slips released to Employee Self-Service.`);
      await fetchRuns();
      viewRunDetails(selectedRun.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to mark payroll as paid');
    } finally {
      setSubmittingAction(false);
    }
  };

  // RECALCULATE / RETURN FOR CORRECTION
  const handleRecalculateRun = async () => {
    if (!selectedRun) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      await api.post(`/payroll/runs/${selectedRun.id}/recalculate`);
      setShowRecalculateModal(false);
      setActionSuccess('Payroll run returned to DRAFT stage for input correction.');
      await fetchRuns();
      viewRunDetails(selectedRun.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset run for correction');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Create New Month / Period
  const handleCreateMonth = async () => {
    setCreatingMonth(true);
    try {
      await api.post('/payroll/periods', {
        month: newMonthNumber,
        year: newMonthYear
      });
      setShowNewMonthModal(false);
      await fetchPeriods();
      alert(`Payroll period for ${newMonthNumber}/${newMonthYear} created successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to create payroll period');
    } finally {
      setCreatingMonth(false);
    }
  };

  // Salary Editor loader
  const loadEditorData = async (runId: string) => {
    if (!runId) return;
    setLoadingEditor(true);
    try {
      const res: any = await api.get(`/payroll/runs/${runId}/editor`);
      setEditorData(res);
      const list = res.rows || res.employees || [];
      setEditorEmployees(list);
      setEditorOriginalEmployees(JSON.parse(JSON.stringify(list)));
    } catch (err: any) {
      console.error('Failed to load salary editor data:', err);
    } finally {
      setLoadingEditor(false);
    }
  };

  const handleSaveAdjustments = async () => {
    if (!editorRunId) return;
    setSavingAdjustments(true);
    try {
      const adjustments = editorEmployees.map(emp => ({
        employeeId: emp.employeeId || emp.id,
        slipId: emp.slipId,
        leaveLossOfPayDays: Number(emp.lopDays || 0),
        otHours: Number(emp.otHours || 0),
        otRatePerHour: Number(emp.otRate || 0),
        arrearsAmount: Number(emp.arrearsAmount ?? emp.arrears ?? 0),
        variableAllowance: Number(emp.variableAllowance ?? emp.variableEarnings ?? 0),
        manualDeduction: Number(emp.manualDeduction || 0)
      }));

      await api.patch(`/payroll/runs/${editorRunId}/adjustments`, { adjustments });
      setActionSuccess('Salary input adjustments persisted successfully.');
      await loadEditorData(editorRunId);
      await fetchRuns();
      if (selectedRun?.id === editorRunId) {
        viewRunDetails(editorRunId);
        fetchReviewTable(editorRunId);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to persist adjustments');
    } finally {
      setSavingAdjustments(false);
    }
  };

  // TDS Summary loader
  const loadTdsSummary = async (periodId: string) => {
    setLoadingTds(true);
    try {
      const res: any = await api.get(`/payroll/tds/summary?periodId=${periodId}`);
      setTdsSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTds(false);
    }
  };

  const handlePortTds = async () => {
    if (!tdsPeriodId) return;
    setPortingTds(true);
    try {
      const res: any = await api.post('/payroll/tds/port-to-salary', { periodId: tdsPeriodId });
      alert(res.message || 'TDS ported successfully to employee salary structures.');
      await loadTdsSummary(tdsPeriodId);
    } catch (err: any) {
      alert(err.message || 'Failed to port TDS');
    } finally {
      setPortingTds(false);
    }
  };

  const openPayslip = async (slipId: string) => {
    try {
      const res: any = await api.get(`/payroll/runs/${selectedRun?.id || runs[0]?.id}/slips/${slipId}`);
      setPayslipData(res.slip);
      setShowPayslipModal(true);
    } catch (err: any) {
      alert('Failed to load payslip: ' + err.message);
    }
  };

  const currentStageIndex = selectedRun
    ? SEVEN_STAGES.findIndex(s => s.id === selectedRun.status)
    : -1;

  // Real Metric Calculations from Current Active Run
  const activeRun = selectedRun || runs[0];
  const totalEmployees = activeRun?.totalEmployees || 0;
  const grossTotal = Number(activeRun?.totalGross ?? activeRun?.grossTotal ?? 0);
  const deductionsTotal = Number(activeRun?.totalDeductions ?? activeRun?.deductionsTotal ?? 0);
  const netPayTotal = Number(activeRun?.totalNetPay ?? activeRun?.netTotal ?? 0);

  const valNotes = activeRun?.validationNotes as any;
  const varNotes = activeRun?.varianceNotes as any;
  const exceptionsCount = (valNotes?.exceptions?.length || 0) + (varNotes?.warnings?.length || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast Alert */}
      {actionSuccess && (
        <div
          style={{
            background: '#065f46',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> <span>{actionSuccess}</span>
          </div>
          <button className="btn-close" style={{ color: '#fff' }} onClick={() => setActionSuccess(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {actionError && (
        <div
          style={{
            background: '#991b1b',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> <span>{actionError}</span>
          </div>
          <button className="btn-close" style={{ color: '#fff' }} onClick={() => setActionError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Standard PageHeader */}
      <PageHeader
        title="Corporate Payroll Studio"
        subtitle="Monthly Payroll Runs • Salary Review & Editor • Income Tax (TDS) Withholding • Electronic Bank Advice"
        breadcrumbs={[
          { label: 'Payroll & CTC' },
          { label: '7-Stage Payroll Workbench' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>7-Stage Workflow</span>}
        actions={
          hasRole(['payroll_admin', 'company_admin']) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowNewMonthModal(true)}
                title="Create New Month / Period"
              >
                <Plus size={14} /> Create Payroll Period
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowGenerateModal(true)}
              >
                <Play size={14} /> Initialize Payroll Batch
              </button>
            </div>
          )
        }
      />

      {/* Primary Navigation Tabs with Plain Language */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activeTab === 'runs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('runs')}
        >
          <Layers size={14} /> Monthly Payroll Runs ({runs.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'dept-payroll' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('dept-payroll')}
        >
          <Building size={14} /> Department Payroll Process
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'editor' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setActiveTab('editor');
            if (editorRunId) loadEditorData(editorRunId);
          }}
        >
          <Edit3 size={14} /> Salary Review & Editor
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'tds' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setActiveTab('tds');
            if (tdsPeriodId) loadTdsSummary(tdsPeriodId);
          }}
        >
          <Calculator size={14} /> Income Tax & TDS
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MONTHLY PAYROLL RUNS (7-Stage Simplified Architecture)             */}
      {/* ========================================================================= */}
      {activeTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Prominent Period Selection & Status Header */}
          {activeRun && (
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
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Current Active Period Selection
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    {activeRun.period?.name || activeRun.runNumber}
                  </h3>
                  <span
                    className={`badge ${
                      activeRun.status === 'PAID'
                        ? 'badge-success'
                        : activeRun.status === 'APPROVED' || activeRun.status === 'PAYMENT_READY'
                        ? 'badge-brand'
                        : activeRun.status === 'REVIEWED' || activeRun.status === 'CALCULATED'
                        ? 'badge-warning'
                        : 'badge-gray'
                    }`}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Stage: {activeRun.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Run ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeRun.runNumber}</strong> • Financial Year: <strong>FY {activeRun.period?.year || '2026-27'}</strong>
                </div>
              </div>

              {/* Contextual Next Stage Action Button */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {activeRun.status === 'DRAFT' && hasRole(['payroll_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleValidateRun(activeRun.id)}
                    disabled={submittingAction}
                  >
                    <ArrowRight size={14} /> Run Validation Scan (Stage 2)
                  </button>
                )}

                {activeRun.status === 'VALIDATED' && hasRole(['payroll_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCalculateRun(activeRun.id)}
                    disabled={submittingAction}
                  >
                    <Calculator size={14} /> Calculate Salary Math (Stage 3)
                  </button>
                )}

                {activeRun.status === 'CALCULATED' && hasRole(['payroll_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleReviewRun(activeRun.id)}
                    disabled={submittingAction}
                  >
                    <ShieldCheck size={14} /> Audit Variances & Review (Stage 4)
                  </button>
                )}

                {activeRun.status === 'REVIEWED' && hasRole(['finance_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApproveRun(activeRun.id)}
                    disabled={submittingAction}
                    style={{ background: '#0284c7' }}
                  >
                    <CheckCircle size={14} /> Authorize Disbursement (Stage 5)
                  </button>
                )}

                {activeRun.status === 'APPROVED' && hasRole(['finance_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePaymentReady(activeRun.id)}
                    disabled={submittingAction}
                    style={{ background: '#10b981' }}
                  >
                    <CreditCard size={14} /> Prepare Bank Advice (Stage 6)
                  </button>
                )}

                {activeRun.status === 'PAYMENT_READY' && hasRole(['finance_admin', 'company_admin']) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowMarkPaidModal(true)}
                    disabled={submittingAction}
                    style={{ background: '#059669' }}
                  >
                    <CheckCircle2 size={14} /> Record UTR & Mark Paid (Stage 7)
                  </button>
                )}

                {/* Recalculate Option before Approval */}
                {['VALIDATED', 'CALCULATED', 'REVIEWED'].includes(activeRun.status) && hasRole(['payroll_admin', 'company_admin']) && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowRecalculateModal(true)}
                    title="Return to Draft for Salary Corrections"
                  >
                    <RotateCcw size={13} /> Return for Correction
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 7-Stage Visual Stepper */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
              7-Stage Payroll Lifecycle Progression
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {SEVEN_STAGES.map((s, idx) => {
                const isPassed = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;

                return (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: isCurrent ? 'rgba(2, 132, 199, 0.08)' : isPassed ? '#f0fdf4' : '#f8fafc',
                      border: isCurrent ? '2px solid var(--primary)' : isPassed ? '1px solid #86efac' : '1px solid var(--border-color)',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isCurrent ? 'var(--primary)' : isPassed ? '#166534' : 'var(--text-muted)'
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>
                      {s.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real Summary Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Employees Included</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>{totalEmployees}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Active in current cycle</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Calculated Staff</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                {activeRun?.slips?.length || activeRun?.records?.length || (['CALCULATED', 'REVIEWED', 'APPROVED', 'PAYMENT_READY', 'PAID'].includes(activeRun?.status) ? totalEmployees : 0)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {['DRAFT', 'VALIDATED'].includes(activeRun?.status) ? 'Awaiting calculation' : 'Calculated in batch'}
              </div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: exceptionsCount > 0 ? '4px solid #f59e0b' : '4px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: exceptionsCount > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600 }}>
                Requiring Attention
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: exceptionsCount > 0 ? '#b45309' : 'inherit', marginTop: '4px' }}>
                {exceptionsCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {exceptionsCount > 0 ? 'Audit warnings / exceptions' : 'Zero exceptions detected'}
              </div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gross Salary Total</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
                {formatCurrency(grossTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {activeRun?.status === 'PAID' ? 'Finalized earnings basis' : 'Total earnings basis'}
              </div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Total Deductions</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--danger)', marginTop: '4px' }}>
                {formatCurrency(deductionsTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>PF, ESI, PT, TDS & Loans</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Net Disbursable</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
                {formatCurrency(netPayTotal)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {activeRun?.status === 'PAID' ? 'Finalized take-home' : 'Estimated take-home'}
              </div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Employer Contributions</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
                {formatCurrency(Math.max(0, Number(activeRun?.totalEmployerCost ?? 0) - grossTotal))}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>PF, ESI & statutory dues</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>Total Employer Cost</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4f46e5', marginTop: '4px' }}>
                {formatCurrency(activeRun?.totalEmployerCost ?? 0)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total CTC cost</div>
            </div>
          </div>

          {/* Actionable Exceptions / Warnings Card */}
          {exceptionsCount > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid #f59e0b',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 700, fontSize: '0.875rem' }}>
                <AlertTriangle size={16} /> Actionable Warnings & Audit Exceptions ({exceptionsCount})
              </div>
              <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '0.8rem', color: '#92400e', lineHeight: 1.6 }}>
                {valNotes?.exceptions?.map((ex: any, idx: number) => (
                  <li key={idx}>
                    <strong>{ex.employeeCode} ({ex.name}):</strong> {ex.issue}
                  </li>
                ))}
                {varNotes?.warnings?.map((w: string, idx: number) => (
                  <li key={`var-${idx}`}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Runs Table with Plain Language and Action Buttons */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Monthly Payroll Runs & Batches</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Inspect batches, verify calculations, and progress runs through the 7-stage workflow.
                </div>
              </div>

              <button className="btn btn-outline btn-xs" onClick={fetchRuns}>
                <RotateCcw size={13} /> Refresh Runs
              </button>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payroll Period</th>
                    <th>Financial Year</th>
                    <th>Employee Count</th>
                    <th className="money">Gross Salary</th>
                    <th className="money">Deductions</th>
                    <th className="money">Net Payable</th>
                    <th>Current Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <Layers size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                        <div>No payroll runs found. Click "Initialize Payroll Batch" to begin Stage 1.</div>
                      </td>
                    </tr>
                  ) : (
                    runs.map(run => {
                      const isSelected = selectedRun?.id === run.id;
                      return (
                        <tr
                          key={run.id}
                          style={{
                            background: isSelected ? 'rgba(2, 132, 199, 0.04)' : undefined,
                            cursor: 'pointer'
                          }}
                          onClick={() => viewRunDetails(run.id)}
                        >
                          <td>
                            <strong>{run.period?.name || run.runNumber}</strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {run.runNumber}
                            </div>
                          </td>
                          <td>FY {run.period?.year || '2026-27'}</td>
                          <td>{run.totalEmployees} employees</td>
                          <td className="money">
                            {formatCurrency(run.totalGross ?? run.grossTotal ?? 0)}
                          </td>
                          <td className="money" style={{ color: 'var(--danger)' }}>
                            {formatCurrency(run.totalDeductions ?? run.deductionsTotal ?? 0)}
                          </td>
                          <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {formatCurrency(run.totalNetPay ?? run.netTotal ?? 0)}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                run.status === 'PAID'
                                  ? 'badge-success'
                                  : run.status === 'APPROVED' || run.status === 'PAYMENT_READY'
                                  ? 'badge-brand'
                                  : run.status === 'REVIEWED' || run.status === 'CALCULATED'
                                  ? 'badge-warning'
                                  : 'badge-gray'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => viewRunDetails(run.id)}
                                title="View details"
                              >
                                <Eye size={13} /> View Details
                              </button>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  setEditorRunId(run.id);
                                  setActiveTab('editor');
                                }}
                                title="Edit salary inputs"
                              >
                                <Edit3 size={13} /> Edit
                              </button>
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
          {/* SECTION 4: AUTHORITATIVE 12-COLUMN PAYROLL REVIEW & AUDIT SCREEN          */}
          {/* ========================================================================= */}
          {selectedRun && (() => {
            const rawRows = reviewTableData?.rows || selectedRun?.slips || [];
            const allRows = rawRows.map((item: any) => {
              // Normalize properties across different API response formats (slips vs review-table)
              const slipId = item.slipId || item.id;
              const employeeId = item.employeeId || item.employee?.id;
              const employeeCode = item.employeeCode || item.employee?.employeeCode || '—';
              const employeeName = item.employeeName || (item.employee ? `${item.employee.firstName || ''} ${item.employee.lastName || ''}`.trim() : 'Unknown Employee');
              const department = item.department || item.employee?.department?.name || 'General';
              const payableDays = Number(item.payableDays ?? 30);
              const lopDays = Number(item.lopDays ?? 0);
              const grossVal = Number(item.grossEarnings ?? item.grossPay ?? 0);
              const manualAdjVal = Number(item.manualAdjustments ?? 0);
              const dedVal = Number(item.employeeDeductions ?? item.deductionsPay ?? 0);
              const tdsVal = Number(item.tds ?? item.tdsWithholding ?? 0);
              const empCostVal = Number(item.employerContributions ?? item.employerCost ?? 0);
              const netVal = Number(item.netPay ?? 0);

              return {
                ...item,
                slipId,
                employeeId,
                employeeCode,
                employeeName,
                department,
                payableDays,
                lopDays,
                grossEarnings: grossVal,
                grossPay: grossVal,
                manualAdjustments: manualAdjVal,
                employeeDeductions: dedVal,
                deductionsPay: dedVal,
                tds: tdsVal,
                employerContributions: empCostVal,
                employerCost: empCostVal,
                netPay: netVal,
                status: item.status || selectedRun.status,
                items: item.items || []
              };
            });

            const filteredRows = reviewDeptFilter === 'ALL'
              ? allRows
              : allRows.filter((r: any) => r.department === reviewDeptFilter);

            const deptSummaries = (reviewTableData?.departmentSummaries || reviewTableData?.departmentTotals || []).map((ds: any) => ({
              departmentId: ds.departmentId || ds.id || ds.name,
              departmentName: ds.departmentName || ds.name,
              employeeCount: Number(ds.employeeCount || 0),
              grossPay: Number(ds.grossPay ?? ds.grossEarnings ?? 0),
              deductionsPay: Number(ds.deductionsPay ?? ds.employeeDeductions ?? 0),
              tds: Number(ds.tds ?? 0),
              employerCost: Number(ds.employerCost ?? ds.employerContributions ?? 0),
              netPay: Number(ds.netPay ?? 0)
            }));

            const grandTotals = {
              totalEmployees: allRows.length,
              grossEarnings: Number(reviewTableData?.grandTotals?.grossEarnings ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.grossEarnings ?? r.grossPay) || 0), 0)),
              manualAdjustments: Number(reviewTableData?.grandTotals?.manualAdjustments ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.manualAdjustments) || 0), 0)),
              employeeDeductions: Number(reviewTableData?.grandTotals?.employeeDeductions ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.employeeDeductions ?? r.deductionsPay) || 0), 0)),
              tds: Number(reviewTableData?.grandTotals?.tds ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.tds) || 0), 0)),
              employerContributions: Number(reviewTableData?.grandTotals?.employerContributions ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.employerContributions ?? r.employerCost) || 0), 0)),
              netPay: Number(reviewTableData?.grandTotals?.netPay ?? allRows.reduce((sum: number, r: any) => sum + (Number(r.netPay) || 0), 0))
            };

            const uniqueDepts: string[] = Array.from(new Set(allRows.map((r: any) => r.department))).filter(Boolean) as string[];

            return (
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header & Department Filter Bar */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={17} style={{ color: 'var(--primary)' }} />
                      Payroll Review & Audit Workspace: {selectedRun.period?.name || selectedRun.runNumber}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Section 4 Standardized 12-Field Financial Reconciliation • Department Subtotals • Drilldown Calculations
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Department Selector Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Filter size={13} style={{ color: 'var(--text-muted)' }} />
                      <select
                        className="form-control"
                        value={reviewDeptFilter}
                        onChange={e => setReviewDeptFilter(e.target.value)}
                        style={{ fontSize: '0.75rem', padding: '4px 8px', height: '30px', minWidth: '170px' }}
                      >
                        <option value="ALL">All Departments ({allRows.length})</option>
                        {uniqueDepts.map(d => (
                          <option key={d} value={d}>
                            {d} ({allRows.filter((r: any) => r.department === d).length})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => fetchReviewTable(selectedRun.id)}
                      title="Refresh Review Data"
                    >
                      <RotateCcw size={12} /> Refresh
                    </button>

                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setEditorRunId(selectedRun.id);
                        setActiveTab('editor');
                      }}
                    >
                      <Edit3 size={12} /> Batch Editor
                    </button>
                  </div>
                </div>

                {/* Department Subtotals Strip */}
                {deptSummaries.length > 0 && reviewDeptFilter === 'ALL' && (
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: '10px',
                      overflowX: 'auto'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <Building size={13} style={{ marginRight: '4px' }} /> Department Subtotals:
                    </div>
                    {deptSummaries.map((ds: any) => (
                      <div
                        key={ds.departmentId}
                        onClick={() => setReviewDeptFilter(ds.departmentName)}
                        style={{
                          padding: '4px 10px',
                          background: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.725rem',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title={`Click to filter by ${ds.departmentName}`}
                      >
                        <strong>{ds.departmentName}</strong>
                        <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{ds.employeeCount} staff</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {formatCurrency(ds.netPay, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 12-Column Authoritative Table */}
                <div className="table-container" style={{ border: 'none', maxHeight: '550px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.75rem', margin: 0 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                        <th>Emp Code</th>
                        <th>Employee Name</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'center' }}>Payable Days</th>
                        <th className="money">Gross Earnings</th>
                        <th className="money">Manual Adj</th>
                        <th className="money">Deductions</th>
                        <th className="money">TDS</th>
                        <th className="money">Employer Cost</th>
                        <th className="money">Net Pay</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right', minWidth: '190px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingReviewTable ? (
                        <tr>
                          <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            Loading financial review and department subtotals...
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No employees calculated in this run. Click "Calculate Salary Math (Stage 3)" to execute payroll.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row: any) => {
                          const hasAdj = row.manualAdjustments !== 0;
                          return (
                            <tr key={row.slipId || row.employeeId}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.employeeCode}</td>
                              <td><strong>{row.employeeName}</strong></td>
                              <td>{row.department}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span>{row.payableDays}</span>
                                {row.lopDays > 0 && (
                                  <span style={{ color: '#b45309', fontSize: '0.675rem', marginLeft: '4px' }} title={`${row.lopDays} LOP Days`}>
                                    (-{row.lopDays})
                                  </span>
                                )}
                              </td>
                              <td className="money">
                                {formatCurrency(row.grossEarnings ?? row.grossPay)}
                              </td>
                              <td className="money">
                                {hasAdj ? (
                                  <span
                                    className={`badge ${row.manualAdjustments > 0 ? 'badge-success' : 'badge-danger'}`}
                                    style={{ fontSize: '0.675rem' }}
                                  >
                                    {row.manualAdjustments > 0 ? '+' : ''}{formatCurrency(row.manualAdjustments)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                              <td className="money" style={{ color: 'var(--danger)' }}>
                                {formatCurrency(row.employeeDeductions ?? row.deductionsPay)}
                              </td>
                              <td className="money" style={{ color: '#92400e' }}>
                                {formatCurrency(row.tds)}
                              </td>
                              <td className="money" style={{ color: 'var(--text-muted)' }}>
                                {formatCurrency(row.employerContributions ?? row.employerCost)}
                              </td>
                              <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {formatCurrency(row.netPay)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  className={`badge ${
                                    row.status === 'PAID'
                                      ? 'badge-success'
                                      : row.status === 'APPROVED' || row.status === 'PAYMENT_READY'
                                      ? 'badge-brand'
                                      : row.status === 'REVIEWED' || row.status === 'CALCULATED'
                                      ? 'badge-warning'
                                      : 'badge-gray'
                                  }`}
                                  style={{ fontSize: '0.675rem' }}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    onClick={() => {
                                      setSelectedCalcRow(row);
                                      setShowCalcModal(true);
                                    }}
                                    title="View Detailed Calculation Breakdown"
                                  >
                                    <Eye size={12} /> Calc
                                  </button>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    onClick={() => {
                                      setSelectedEmployeeForRow(row);
                                      setShowAdjustmentModal(true);
                                    }}
                                    title="Manual Salary Adjustment"
                                  >
                                    <Edit3 size={12} /> Adjust
                                  </button>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    onClick={() => {
                                      setSelectedEmployeeForRow(row);
                                      setShowTdsModal(true);
                                    }}
                                    title="TDS Deferral & Multi-Month Recovery"
                                  >
                                    <Calculator size={12} /> TDS
                                  </button>
                                  <button
                                    className="btn btn-outline btn-xs"
                                    onClick={() => openPayslip(row.slipId)}
                                    title="View Formal Payslip"
                                  >
                                    <FileText size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {/* Table Footer: Reconciled Grand Totals */}
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={3}>
                          Grand Totals ({filteredRows.length} staff{reviewDeptFilter !== 'ALL' ? ` in ${reviewDeptFilter}` : ''})
                        </td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td className="money">
                          {formatCurrency(grandTotals.grossEarnings)}
                        </td>
                        <td className="money">
                          {grandTotals.manualAdjustments !== 0 ? (
                            `${grandTotals.manualAdjustments > 0 ? '+' : ''}${formatCurrency(grandTotals.manualAdjustments)}`
                          ) : '—'}
                        </td>
                        <td className="money" style={{ color: 'var(--danger)' }}>
                          {formatCurrency(grandTotals.employeeDeductions)}
                        </td>
                        <td className="money" style={{ color: '#92400e' }}>
                          {formatCurrency(grandTotals.tds)}
                        </td>
                        <td className="money">
                          {formatCurrency(grandTotals.employerContributions)}
                        </td>
                        <td className="money" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                          {formatCurrency(grandTotals.netPay)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1b: DEPARTMENT PAYROLL PROCESS WORKSPACE (PHASE B - I)                */}
      {/* ========================================================================= */}
      {activeTab === 'dept-payroll' && (
        <DepartmentPayrollWorkspace
          periods={periods}
          initialPeriodId={selectedPeriodId || periods[0]?.id}
          onRefreshRuns={fetchRuns}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALARY REVIEW & INPUT ADJUSTMENT EDITOR (Saral Parity)            */}
      {/* ========================================================================= */}
      {activeTab === 'editor' && (() => {
        const uniqueDepartments = Array.from(new Set(editorEmployees.map(e => e.department))).filter(Boolean) as string[];

        // Filter employees
        const filteredEmployees = editorEmployees.filter(emp => {
          // Search query
          if (editorSearch.trim()) {
            const q = editorSearch.toLowerCase();
            const code = (emp.employeeCode || '').toLowerCase();
            const name = (emp.employeeName || '').toLowerCase();
            if (!code.includes(q) && !name.includes(q)) return false;
          }
          // Department filter
          if (editorDeptFilter !== 'ALL' && emp.department !== editorDeptFilter) {
            return false;
          }
          // Status / Exception filter
          if (editorStatusFilter === 'LOP') {
            if (!emp.lopDays || Number(emp.lopDays) <= 0) return false;
          } else if (editorStatusFilter === 'OT') {
            if (!emp.otHours || Number(emp.otHours) <= 0) return false;
          } else if (editorStatusFilter === 'ARREARS') {
            if (!emp.arrears && !emp.arrearsAmount) return false;
          } else if (editorStatusFilter === 'VARIABLE') {
            if (!emp.variableAllowance && !emp.variableEarnings) return false;
          } else if (editorStatusFilter === 'NET25') {
            if (!emp.isNetLessThan25Percent) return false;
          } else if (editorStatusFilter === 'MISSING') {
            if (emp.calculationStatus !== 'MISSING_STRUCTURE' && (!emp.validationErrors || emp.validationErrors.length === 0)) return false;
          }

          // Modified only filter
          if (showModifiedOnly) {
            const orig = editorOriginalEmployees.find(o => (o.employeeId || o.id) === (emp.employeeId || emp.id));
            if (!orig) return false;
            const lopChanged = Number(emp.lopDays || 0) !== Number(orig.lopDays || 0);
            const otChanged = Number(emp.otHours || 0) !== Number(orig.otHours || 0);
            const arrearsChanged = Number(emp.arrears ?? emp.arrearsAmount ?? 0) !== Number(orig.arrears ?? orig.arrearsAmount ?? 0);
            const varChanged = Number(emp.variableAllowance ?? emp.variableEarnings ?? 0) !== Number(orig.variableAllowance ?? orig.variableEarnings ?? 0);
            const dedChanged = Number(emp.manualDeduction || 0) !== Number(orig.manualDeduction || 0);
            if (!lopChanged && !otChanged && !arrearsChanged && !varChanged && !dedChanged) return false;
          }

          return true;
        });

        // Summary calculations
        const sumLop = editorEmployees.reduce((sum, e) => sum + Number(e.lopDays || 0), 0);
        const sumOt = editorEmployees.reduce((sum, e) => sum + Number(e.otHours || 0), 0);
        const sumArrears = editorEmployees.reduce((sum, e) => sum + Number(e.arrears ?? e.arrearsAmount ?? 0), 0);
        const sumVariable = editorEmployees.reduce((sum, e) => sum + Number(e.variableAllowance ?? e.variableEarnings ?? 0), 0);
        const sumManualDed = editorEmployees.reduce((sum, e) => sum + Number(e.manualDeduction || 0), 0);
        const sumGross = editorEmployees.reduce((sum, e) => sum + Number(e.grossPay || 0), 0);
        const sumNet = editorEmployees.reduce((sum, e) => sum + Number(e.netPay || 0), 0);

        return (
          <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header with Run Selector and Save Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Salary Review & Input Adjustment Editor
                </h3>
                <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Inspect eligible employee attendance, loss-of-pay (LOP), overtime, arrears, and variable earnings. Adjust inputs with live preview before final authorization.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  value={editorRunId}
                  onChange={e => {
                    setEditorRunId(e.target.value);
                    loadEditorData(e.target.value);
                  }}
                  style={{ fontSize: '0.8rem', minWidth: '220px' }}
                >
                  {runs.length === 0 ? (
                    <option value="">No payroll runs found</option>
                  ) : (
                    runs.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.period?.name || r.runNumber} ({r.status})
                      </option>
                    ))
                  )}
                </select>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => loadEditorData(editorRunId)}
                  disabled={loadingEditor || !editorRunId}
                  title="Reload editor data"
                >
                  <RotateCcw size={13} /> Refresh
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveAdjustments}
                  disabled={savingAdjustments || !editorRunId || editorEmployees.length === 0}
                >
                  <Save size={13} /> {savingAdjustments ? 'Persisting...' : 'Save Salary Adjustments'}
                </button>
              </div>
            </div>

            {/* Editor Quick KPI Cards */}
            {editorEmployees.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Staff</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{editorEmployees.length}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: sumLop > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600 }}>Total LOP Days</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: sumLop > 0 ? '#b45309' : 'inherit', marginTop: '2px' }}>
                    {sumLop.toFixed(1)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Overtime Hours</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{sumOt.toFixed(1)} hrs</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Arrears</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(sumArrears, { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Variable Pay</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(sumVariable, { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>Manual Ded.</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>{formatCurrency(sumManualDed, { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gross Payroll</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{formatCurrency(sumGross, { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Net Disbursable</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534', marginTop: '2px' }}>{formatCurrency(sumNet, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            )}

            {/* Filter & Search Toolbar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                background: '#f8fafc',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                <div style={{ position: 'relative', minWidth: '220px', maxWidth: '320px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search staff code or name..."
                    value={editorSearch}
                    onChange={e => setEditorSearch(e.target.value)}
                    style={{ fontSize: '0.8rem', paddingLeft: '28px' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  {editorSearch && (
                    <button
                      onClick={() => setEditorSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  className="form-control"
                  value={editorDeptFilter}
                  onChange={e => setEditorDeptFilter(e.target.value)}
                  style={{ fontSize: '0.8rem', minWidth: '150px' }}
                >
                  <option value="ALL">All Departments</option>
                  {uniqueDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  className="form-control"
                  value={editorStatusFilter}
                  onChange={e => setEditorStatusFilter(e.target.value)}
                  style={{ fontSize: '0.8rem', minWidth: '160px' }}
                >
                  <option value="ALL">All Employees</option>
                  <option value="LOP">Has Loss of Pay (LOP)</option>
                  <option value="OT">Has Overtime (OT)</option>
                  <option value="ARREARS">Has Arrears</option>
                  <option value="VARIABLE">Has Variable Pay</option>
                  <option value="NET25">Take-Home &lt; 25% (Warning)</option>
                  <option value="MISSING">Missing CTC Structure</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showModifiedOnly}
                    onChange={e => setShowModifiedOnly(e.target.checked)}
                  />
                  <span>Show Modified Only</span>
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Showing: <strong>{filteredEmployees.length}</strong> of {editorEmployees.length} staff
                </div>
              </div>
            </div>

            {/* Table or Empty States */}
            {loadingEditor ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Calculator size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <div>Loading salary adjustments sheet & attendance proration data...</div>
              </div>
            ) : editorEmployees.length === 0 ? (
              <div
                style={{
                  padding: '50px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Layers size={36} style={{ opacity: 0.3, marginBottom: '10px', color: 'var(--primary)' }} />
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600 }}>
                  {!editorRunId ? 'No Payroll Run Selected' : 'No Employees in Selected Payroll Run'}
                </h4>
                <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', marginInline: 'auto' }}>
                  {!editorRunId
                    ? 'Please initialize a payroll batch or select an existing monthly payroll run to review and adjust employee salaries.'
                    : 'The candidate scope established for this run contains no eligible employees with active employment status during this period, or employees require salary structure assignment.'}
                </p>
                {hasRole(['payroll_admin', 'company_admin']) && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowGenerateModal(true)}>
                    <Play size={13} /> Initialize Payroll Batch (Stage 1)
                  </button>
                )}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Filter size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <div>No employees match your filter criteria. Try clearing the search or status filter.</div>
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '160px' }}>Staff & Department</th>
                      <th style={{ minWidth: '130px' }}>Salary Structure</th>
                      <th style={{ minWidth: '100px' }}>Working / Payable</th>
                      <th style={{ width: '85px' }}>LOP Days</th>
                      <th style={{ width: '85px' }}>OT (Hours)</th>
                      <th style={{ width: '105px' }}>Arrears (₹)</th>
                      <th style={{ width: '105px' }}>Variable (₹)</th>
                      <th style={{ width: '105px' }}>Manual Ded. (₹)</th>
                      <th className="money" style={{ minWidth: '85px' }}>TDS (₹)</th>
                      <th className="money" style={{ minWidth: '100px' }}>Gross Salary</th>
                      <th className="money" style={{ minWidth: '100px' }}>Deductions</th>
                      <th className="money" style={{ minWidth: '110px' }}>Net Pay</th>
                      <th style={{ textAlign: 'center', width: '110px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const idx = editorEmployees.findIndex(e => (e.employeeId || e.id) === (emp.employeeId || emp.id));
                      const orig = editorOriginalEmployees.find(o => (o.employeeId || o.id) === (emp.employeeId || emp.id));
                      const isLopModified = orig && Number(emp.lopDays || 0) !== Number(orig.lopDays || 0);
                      const isOtModified = orig && Number(emp.otHours || 0) !== Number(orig.otHours || 0);
                      const isArrearsModified = orig && Number(emp.arrears ?? emp.arrearsAmount ?? 0) !== Number(orig.arrears ?? orig.arrearsAmount ?? 0);
                      const isVarModified = orig && Number(emp.variableAllowance ?? emp.variableEarnings ?? 0) !== Number(orig.variableAllowance ?? orig.variableEarnings ?? 0);
                      const isDedModified = orig && Number(emp.manualDeduction || 0) !== Number(orig.manualDeduction || 0);

                      return (
                        <tr
                          key={emp.employeeId || emp.id}
                          style={{
                            background: emp.isNetLessThan25Percent ? 'rgba(239, 68, 68, 0.04)' : undefined
                          }}
                        >
                          {/* Staff & Department */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '0.85rem' }}>{emp.employeeName}</strong>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                  {emp.employeeCode}
                                </span>
                                <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{emp.department}</span>
                              </div>
                            </div>
                          </td>

                          {/* Salary Structure */}
                          <td>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{emp.structureName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Gross: {formatCurrency(emp.monthlyGrossConfigured || emp.grossPay || 0, { maximumFractionDigits: 0 })}
                            </div>
                            {emp.validationErrors && emp.validationErrors.length > 0 && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                                {emp.validationErrors[0]}
                              </div>
                            )}
                          </td>

                          {/* Working / Payable Days */}
                          <td>
                            <div style={{ fontSize: '0.8rem' }}>
                              Payable: <strong>{Number(emp.payableDays || 0).toFixed(1)}</strong>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Cal: {emp.calendarDays || 30} • Pres: {emp.presentDays ?? '-'}
                            </div>
                          </td>

                          {/* LOP Days (Editable) */}
                          <td>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={emp.calendarDays || 31}
                              className="form-control"
                              style={{
                                width: '75px',
                                fontSize: '0.8rem',
                                padding: '4px 6px',
                                borderColor: isLopModified ? 'var(--primary)' : undefined,
                                background: isLopModified ? 'rgba(2, 132, 199, 0.05)' : undefined
                              }}
                              value={emp.lopDays ?? 0}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...editorEmployees];
                                next[idx].lopDays = val;
                                const cal = Number(next[idx].calendarDays || 30);
                                next[idx].payableDays = Math.max(0, cal - val);
                                setEditorEmployees(next);
                              }}
                            />
                          </td>

                          {/* Overtime (Hours) (Editable) */}
                          <td>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="form-control"
                              style={{
                                width: '75px',
                                fontSize: '0.8rem',
                                padding: '4px 6px',
                                borderColor: isOtModified ? 'var(--primary)' : undefined,
                                background: isOtModified ? 'rgba(2, 132, 199, 0.05)' : undefined
                              }}
                              value={emp.otHours ?? 0}
                              onChange={e => {
                                const next = [...editorEmployees];
                                next[idx].otHours = Number(e.target.value);
                                setEditorEmployees(next);
                              }}
                            />
                          </td>

                          {/* Arrears (Editable) */}
                          <td>
                            <input
                              type="number"
                              step="100"
                              min="0"
                              className="form-control"
                              style={{
                                width: '95px',
                                fontSize: '0.8rem',
                                padding: '4px 6px',
                                borderColor: isArrearsModified ? 'var(--primary)' : undefined,
                                background: isArrearsModified ? 'rgba(2, 132, 199, 0.05)' : undefined
                              }}
                              value={emp.arrearsAmount ?? emp.arrears ?? 0}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...editorEmployees];
                                next[idx].arrearsAmount = val;
                                next[idx].arrears = val;
                                setEditorEmployees(next);
                              }}
                            />
                          </td>

                          {/* Variable Pay (Editable) */}
                          <td>
                            <input
                              type="number"
                              step="500"
                              min="0"
                              className="form-control"
                              style={{
                                width: '95px',
                                fontSize: '0.8rem',
                                padding: '4px 6px',
                                borderColor: isVarModified ? 'var(--primary)' : undefined,
                                background: isVarModified ? 'rgba(2, 132, 199, 0.05)' : undefined
                              }}
                              value={emp.variableAllowance ?? emp.variableEarnings ?? 0}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...editorEmployees];
                                next[idx].variableAllowance = val;
                                next[idx].variableEarnings = val;
                                setEditorEmployees(next);
                              }}
                            />
                          </td>

                          {/* Manual Deduction (Editable) */}
                          <td>
                            <input
                              type="number"
                              step="100"
                              min="0"
                              className="form-control"
                              style={{
                                width: '95px',
                                fontSize: '0.8rem',
                                padding: '4px 6px',
                                borderColor: isDedModified ? 'var(--danger)' : undefined,
                                background: isDedModified ? 'rgba(239, 68, 68, 0.05)' : undefined
                              }}
                              value={emp.manualDeduction ?? 0}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...editorEmployees];
                                next[idx].manualDeduction = val;
                                setEditorEmployees(next);
                              }}
                            />
                          </td>

                          {/* TDS */}
                          <td className="money" style={{ fontSize: '0.8rem' }}>
                            {formatCurrency(emp.tdsAdjustment || emp.tds || 0, { maximumFractionDigits: 0 })}
                          </td>

                          {/* Gross Salary */}
                          <td className="money" style={{ fontSize: '0.8rem' }}>
                            {formatCurrency(emp.grossPay || 0, { maximumFractionDigits: 0 })}
                          </td>

                          {/* Deductions */}
                          <td className="money" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                            {formatCurrency(emp.deductionsPay || 0, { maximumFractionDigits: 0 })}
                          </td>

                          {/* Net Pay */}
                          <td className="money" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {formatCurrency(emp.netPay || 0, { maximumFractionDigits: 0 })}
                            {emp.isNetLessThan25Percent && (
                              <div style={{ fontSize: '0.625rem', color: 'var(--danger)', fontWeight: 600 }}>
                                &lt; 25% Take-Home
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  setSelectedCalcRow(emp);
                                  setShowCalcModal(true);
                                }}
                                title="Inspect Pure Decimal Calculation Math"
                              >
                                <Eye size={12} /> View Math
                              </button>
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  setSelectedEmployeeForRow(emp);
                                  setShowAdjustmentModal(true);
                                }}
                                title="Open Detailed Salary Adjustment Modal"
                              >
                                <Edit3 size={12} /> Adjust
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 3: INCOME TAX & TDS STUDIO                                           */}
      {/* ========================================================================= */}
      {activeTab === 'tds' && (
        <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Income Tax & TDS Assessment</h3>
              <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Evaluate regime-based tax liabilities and port monthly withholding into active salary structures.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-control"
                value={tdsPeriodId}
                onChange={e => {
                  setTdsPeriodId(e.target.value);
                  loadTdsSummary(e.target.value);
                }}
                style={{ fontSize: '0.8rem', minWidth: '180px' }}
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary btn-sm"
                onClick={handlePortTds}
                disabled={portingTds}
              >
                <Calculator size={13} /> {portingTds ? 'Porting TDS...' : 'Port TDS to Salary'}
              </button>
            </div>
          </div>

          {loadingTds ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating tax assessments...
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Code</th>
                    <th>Name</th>
                    <th>PAN</th>
                    <th>Regime</th>
                    <th className="money">Gross CTC</th>
                    <th className="money">Annual Tax Liability</th>
                    <th className="money">Monthly TDS Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {(tdsSummary?.records || []).map((t: any) => (
                    <tr key={t.employeeId}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.employeeCode}</td>
                      <td><strong>{t.name}</strong></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.panNumber || 'ABCXXXXX4F'}</td>
                      <td>
                        <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>{t.regime}</span>
                      </td>
                      <td className="money">{formatCurrency(t.annualGross, { maximumFractionDigits: 0 })}</td>
                      <td className="money" style={{ color: 'var(--danger)' }}>{formatCurrency(t.annualTax, { maximumFractionDigits: 0 })}</td>
                      <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(t.monthlyTds, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INITIALIZE PAYROLL BATCH (STAGE 1 DRAFT WITH SCOPE PREVIEW)      */}
      {/* ========================================================================= */}
      <CreatePayrollRunModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        periods={periods}
        initialPeriodId={selectedPeriodId}
        onViewRun={(runId) => {
          setShowGenerateModal(false);
          viewRunDetails(runId);
        }}
        onRunCreated={async (run) => {
          setActionSuccess(`Batch initialized in Stage 1 (DRAFT) for run ${run?.runNumber || ''}`);
          await fetchRuns();
          if (run?.id) viewRunDetails(run.id);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: MANUAL SALARY ADJUSTMENT WORKSPACE                               */}
      {/* ========================================================================= */}
      <ManualAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setSelectedEmployeeForRow(null);
        }}
        payrollRun={selectedRun}
        employeeRow={selectedEmployeeForRow}
        onAdjustmentSaved={async () => {
          setActionSuccess('Manual adjustment applied and recalculation completed.');
          await fetchRuns();
          if (selectedRun?.id) {
            viewRunDetails(selectedRun.id);
            fetchReviewTable(selectedRun.id);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 3: TDS DEFERRAL & RECOVERY WORKSPACE                                */}
      {/* ========================================================================= */}
      <TdsDeferralModal
        isOpen={showTdsModal}
        onClose={() => {
          setShowTdsModal(false);
          setSelectedEmployeeForRow(null);
        }}
        payrollRun={selectedRun}
        employeeRow={selectedEmployeeForRow}
        periods={periods}
        onTdsSaved={async () => {
          setActionSuccess('TDS deferral recorded and recovery scheduled.');
          await fetchRuns();
          if (selectedRun?.id) {
            viewRunDetails(selectedRun.id);
            fetchReviewTable(selectedRun.id);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 4: DETAILED SALARY CALCULATION BREAKDOWN                            */}
      {/* ========================================================================= */}
      <DetailedCalculationModal
        isOpen={showCalcModal}
        onClose={() => {
          setShowCalcModal(false);
          setSelectedCalcRow(null);
        }}
        payrollRun={selectedRun}
        row={selectedCalcRow}
      />

      {/* ========================================================================= */}
      {/* MODAL: STAGE 7 RECORD UTR & CONFIRM PAID                                 */}
      {/* ========================================================================= */}
      {showMarkPaidModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowMarkPaidModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Confirm Bank Settlement (Stage 7)</h3>
              <button className="btn-close" onClick={() => setShowMarkPaidModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                Enter the official Bank Settlement Reference or UTR number confirming electronic fund disbursal. This locks the payroll run and publishes payslips to employee self-service.
              </p>

              <div className="form-group">
                <label className="form-label">Bank Reference / UTR Number *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. UTR-2026-NEFT-890123"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowMarkPaidModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmPaid}
                disabled={submittingAction || !paymentReference.trim()}
                style={{ background: '#059669' }}
              >
                {submittingAction ? 'Confirming...' : 'Confirm Paid & Release Slips'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RETURN FOR CORRECTION / RECALCULATE                                */}
      {/* ========================================================================= */}
      {showRecalculateModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowRecalculateModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Return Payroll for Correction</h3>
              <button className="btn-close" onClick={() => setShowRecalculateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                This action resets the payroll run back to the DRAFT stage, unlocking salary inputs so that HR/Payroll can make adjustments in the Salary Editor.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRecalculateModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleRecalculateRun}
                disabled={submittingAction}
              >
                {submittingAction ? 'Resetting...' : 'Confirm Reset to Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW PAYROLL PERIOD                                          */}
      {/* ========================================================================= */}
      {showNewMonthModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowNewMonthModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Create New Payroll Period</h3>
              <button className="btn-close" onClick={() => setShowNewMonthModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Month</label>
                <select
                  className="form-control"
                  value={newMonthNumber}
                  onChange={e => setNewMonthNumber(Number(e.target.value))}
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-control"
                  value={newMonthYear}
                  onChange={e => setNewMonthYear(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowNewMonthModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateMonth}
                disabled={creatingMonth}
              >
                {creatingMonth ? 'Creating...' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAILED PAYSLIP BREAKDOWN VIEW                                    */}
      {/* ========================================================================= */}
      {showPayslipModal && payslipData && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowPayslipModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Salary Payslip: {payslipData.employee?.firstName} {payslipData.employee?.lastName}
              </h3>
              <button className="btn-close" onClick={() => setShowPayslipModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.825rem' }}>
                <div>Employee Code: <strong>{payslipData.employee?.employeeCode}</strong></div>
                <div>Department: <strong>{payslipData.employee?.department?.name || 'General'}</strong></div>
                <div>Payable Days: <strong>{payslipData.payableDays}</strong></div>
                <div>Loss of Pay: <strong>{Number(payslipData.lopDays || 0)}</strong></div>
              </div>

              <table className="data-table" style={{ marginTop: '8px' }}>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Type</th>
                    <th className="money">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(payslipData.items || []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.name || item.code}</td>
                      <td>
                        <span className={`badge ${item.type === 'EARNING' ? 'badge-success' : 'badge-danger'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="money">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                <span>Net Disbursable Salary:</span>
                <span style={{ color: 'var(--primary)' }}>
                  {formatCurrency(payslipData.netPay)}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowPayslipModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
