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
  Info
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'runs' | 'editor' | 'tds'>('runs');

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
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [savingAdjustments, setSavingAdjustments] = useState(false);
  const [highlightNet25, setHighlightNet25] = useState(true);

  // TDS Process State
  const [tdsPeriodId, setTdsPeriodId] = useState<string>('');
  const [tdsSummary, setTdsSummary] = useState<any | null>(null);
  const [loadingTds, setLoadingTds] = useState(false);
  const [portingTds, setPortingTds] = useState(false);

  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const res: any = await api.get('/payroll/runs');
      const fetchedRuns = res.runs || [];
      setRuns(fetchedRuns);
      if (fetchedRuns.length > 0) {
        if (!editorRunId) setEditorRunId(fetchedRuns[0].id);
        if (!selectedRun) setSelectedRun(fetchedRuns[0]);
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

  const viewRunDetails = async (runId: string) => {
    try {
      const res: any = await api.get(`/payroll/runs/${runId}`);
      setSelectedRun(res.run);
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
    setLoadingEditor(true);
    try {
      const res: any = await api.get(`/payroll/runs/${runId}/editor`);
      setEditorData(res);
      setEditorEmployees(res.employees || []);
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
        employeeId: emp.id,
        leaveLossOfPayDays: Number(emp.lopDays || 0),
        otHours: Number(emp.otHours || 0),
        otRatePerHour: Number(emp.otRate || 0),
        arrearsAmount: Number(emp.arrears || 0),
        variableAllowance: Number(emp.variableAllowance || 0),
        manualDeduction: Number(emp.manualDeduction || 0)
      }));

      await api.patch(`/payroll/runs/${editorRunId}/adjustments`, { adjustments });
      alert('Salary input adjustments persisted successfully.');
      await loadEditorData(editorRunId);
    } catch (err: any) {
      alert(err.message || 'Failed to persist adjustments');
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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'runs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('runs')}
        >
          <Layers size={14} /> Monthly Payroll Runs ({runs.length})
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Employees Included</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>{totalEmployees}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Active in current cycle</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Calculated Staff</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                {activeRun?.slips?.length || activeRun?.records?.length || totalEmployees}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>With active CTC structures</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: exceptionsCount > 0 ? '4px solid #f59e0b' : '4px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: exceptionsCount > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600 }}>
                Requiring Attention
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: exceptionsCount > 0 ? '#b45309' : 'inherit', marginTop: '4px' }}>
                {exceptionsCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {exceptionsCount > 0 ? 'Audit warnings / LOP notes' : 'Zero exceptions detected'}
              </div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gross Salary Total</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '4px' }}>
                ₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Total earnings basis</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Total Deductions</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--danger)', marginTop: '4px' }}>
                ₹{deductionsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>PF, ESI, PT, TDS & Loans</div>
            </div>

            <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Net Disbursable</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
                ₹{netPayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Net take-home pay</div>
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
                            ₹{Number(run.totalGross ?? run.grossTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="money" style={{ color: 'var(--danger)' }}>
                            ₹{Number(run.totalDeductions ?? run.deductionsTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{Number(run.totalNetPay ?? run.netTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

          {/* Drilldown: Employee Level Calculations & Slips for Selected Run */}
          {selectedRun && (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>Employee Salary Calculations: {selectedRun.period?.name || selectedRun.runNumber}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Detailed earnings, deductions, LOP, and net take-home breakdown per employee.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => {
                      setEditorRunId(selectedRun.id);
                      setActiveTab('editor');
                    }}
                  >
                    <Edit3 size={13} /> Open in Salary Editor
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee Code</th>
                      <th>Employee Name</th>
                      <th>Department</th>
                      <th>Payable Days / LOP</th>
                      <th className="money">Gross Salary</th>
                      <th className="money">Deductions</th>
                      <th className="money">Net Salary</th>
                      <th style={{ textAlign: 'right' }}>Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((selectedRun.slips || selectedRun.records) || []).map((rec: any) => (
                      <tr key={rec.id}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{rec.employee?.employeeCode}</td>
                        <td><strong>{rec.employee?.firstName} {rec.employee?.lastName}</strong></td>
                        <td>{rec.employee?.department?.name || 'General'}</td>
                        <td>{rec.payableDays} / {Number(rec.lopDays ?? rec.leaveLossOfPayDays ?? 0)}</td>
                        <td className="money">
                          ₹{Number(rec.grossPay ?? rec.grossAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="money" style={{ color: 'var(--danger)' }}>
                          ₹{Number(rec.deductionsPay ?? rec.deductionAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          ₹{Number(rec.netPay ?? rec.netAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-outline btn-xs" onClick={() => openPayslip(rec.id)}>
                            <FileText size={12} /> View Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALARY REVIEW & EDITOR (Saral Parity)                              */}
      {/* ========================================================================= */}
      {activeTab === 'editor' && (
        <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Salary Review & Input Adjustment Editor</h3>
              <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Adjust LOP days, overtime hours, arrears, and manual deductions prior to executive authorization.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-control"
                value={editorRunId}
                onChange={e => {
                  setEditorRunId(e.target.value);
                  loadEditorData(e.target.value);
                }}
                style={{ fontSize: '0.8rem', minWidth: '200px' }}
              >
                {runs.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.period?.name || r.runNumber} ({r.status})
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveAdjustments}
                disabled={savingAdjustments}
              >
                <Save size={13} /> {savingAdjustments ? 'Persisting...' : 'Save Salary Adjustments'}
              </button>
            </div>
          </div>

          {loadingEditor ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading salary adjustments sheet...
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Code</th>
                    <th>Employee Name</th>
                    <th>LOP Days</th>
                    <th>Overtime (Hours)</th>
                    <th>Arrears (₹)</th>
                    <th>Variable (₹)</th>
                    <th>Manual Deduction (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {editorEmployees.map((emp, idx) => (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{emp.employeeCode}</td>
                      <td><strong>{emp.firstName} {emp.lastName}</strong></td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '80px', fontSize: '0.8rem' }}
                          value={emp.lopDays ?? 0}
                          onChange={e => {
                            const next = [...editorEmployees];
                            next[idx].lopDays = Number(e.target.value);
                            setEditorEmployees(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '80px', fontSize: '0.8rem' }}
                          value={emp.otHours ?? 0}
                          onChange={e => {
                            const next = [...editorEmployees];
                            next[idx].otHours = Number(e.target.value);
                            setEditorEmployees(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '100px', fontSize: '0.8rem' }}
                          value={emp.arrears ?? 0}
                          onChange={e => {
                            const next = [...editorEmployees];
                            next[idx].arrears = Number(e.target.value);
                            setEditorEmployees(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '100px', fontSize: '0.8rem' }}
                          value={emp.variableAllowance ?? 0}
                          onChange={e => {
                            const next = [...editorEmployees];
                            next[idx].variableAllowance = Number(e.target.value);
                            setEditorEmployees(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '100px', fontSize: '0.8rem' }}
                          value={emp.manualDeduction ?? 0}
                          onChange={e => {
                            const next = [...editorEmployees];
                            next[idx].manualDeduction = Number(e.target.value);
                            setEditorEmployees(next);
                          }}
                        />
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
                      <td className="money">₹{Number(t.annualGross).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--danger)' }}>₹{Number(t.annualTax).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{Number(t.monthlyTds).toLocaleString('en-IN')}
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
      {/* MODAL: INITIALIZE PAYROLL BATCH (STAGE 1 DRAFT)                           */}
      {/* ========================================================================= */}
      {showGenerateModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Initialize Payroll Batch (Stage 1)</h3>
              <button className="btn-close" onClick={() => setShowGenerateModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Select Payroll Period *</label>
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

              <div className="form-group">
                <label className="form-label">Batch Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Optional initialization remarks..."
                  value={generateRemarks}
                  onChange={e => setGenerateRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateDraft}
                disabled={submittingAction || !selectedPeriodId}
              >
                {submittingAction ? 'Initializing...' : 'Initialize Stage 1 (DRAFT)'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <td className="money">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                <span>Net Disbursable Salary:</span>
                <span style={{ color: 'var(--primary)' }}>
                  ₹{Number(payslipData.netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
