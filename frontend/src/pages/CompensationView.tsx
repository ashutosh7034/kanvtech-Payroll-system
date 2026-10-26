import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import {
  Calculator,
  CheckCircle2,
  Plus,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Layers,
  Settings,
  Search,
  Filter,
  Copy,
  Edit2,
  Trash2,
  Power,
  X,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  History
} from 'lucide-react';

export const CompensationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assignment' | 'components' | 'templates'>('assignment');

  // Common Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tab 1: Assignment State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [annualCtc, setAnnualCtc] = useState(1500000);
  const [effectiveDate, setEffectiveDate] = useState('2026-06-01');
  const [revisionReason, setRevisionReason] = useState('Annual Performance Revision');
  const [previewBreakdown, setPreviewBreakdown] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [employeeHistory, setEmployeeHistory] = useState<any | null>(null);

  // Tab 2: Components Master State
  const [componentFilter, setComponentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compCode, setCompCode] = useState('');
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY'>('EARNING');
  const [compCategory, setCompCategory] = useState('FIXED_EARNING');
  const [compCalcMode, setCompCalcMode] = useState<'FIXED_AMOUNT' | 'PERCENTAGE_OF_COMPONENT' | 'FORMULA_EXPRESSION'>('FIXED_AMOUNT');
  const [compFormula, setCompFormula] = useState('');
  const [compBaseCode, setCompBaseCode] = useState('BASIC');
  const [compPct, setCompPct] = useState<number>(0);
  const [compFixedAmt, setCompFixedAmt] = useState<number>(0);
  const [compTaxable, setCompTaxable] = useState(true);
  const [compPfGross, setCompPfGross] = useState(false);
  const [compEsicGross, setCompEsicGross] = useState(false);
  const [compPtGross, setCompPtGross] = useState(false);
  const [compDisplayOrder, setCompDisplayOrder] = useState<number>(1);
  const [formulaTestResult, setFormulaTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Tab 3: Template Library State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateCode, setTemplateCode] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [selectedTemplateForDetail, setSelectedTemplateForDetail] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, empRes, tmplRes]: any = await Promise.all([
        api.get('/compensation/components'),
        api.get('/employees'),
        api.get('/compensation/structures')
      ]);
      setComponents(compRes.components || []);
      setEmployees(empRes.employees || []);
      setTemplates(tmplRes.structures || []);

      if (empRes.employees?.[0] && !selectedEmpId) {
        setSelectedEmpId(empRes.employees[0].id);
      }
      if (tmplRes.structures?.[0] && !selectedTemplateId) {
        setSelectedTemplateId(tmplRes.structures[0].id);
      }
    } catch (err) {
      console.error('Error loading compensation masters', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update live preview from backend whenever CTC, template, or custom config changes
  useEffect(() => {
    if (!annualCtc || annualCtc <= 0) return;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const res: any = await api.post('/compensation/structures/preview', {
          annualCtc: Number(annualCtc),
          templateId: selectedTemplateId || undefined
        });
        setPreviewBreakdown(res.breakdown);
      } catch (err) {
        console.error('Preview error', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    const timeout = setTimeout(fetchPreview, 250);
    return () => clearTimeout(timeout);
  }, [annualCtc, selectedTemplateId]);

  // Load employee history when selected employee changes
  useEffect(() => {
    if (!selectedEmpId) return;
    const fetchEmpHistory = async () => {
      try {
        const res: any = await api.get(`/compensation/employee/${selectedEmpId}`);
        setEmployeeHistory(res);
        if (res.currentStructure?.annualCtc) {
          setAnnualCtc(Number(res.currentStructure.annualCtc));
        }
        if (res.currentStructure?.templateId) {
          setSelectedTemplateId(res.currentStructure.templateId);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmpHistory();
  }, [selectedEmpId]);

  const handleAssignStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    try {
      await api.post('/compensation/assign', {
        employeeId: selectedEmpId,
        templateId: selectedTemplateId || undefined,
        annualCtc: Number(annualCtc),
        effectiveFrom: effectiveDate,
        revisionReason
      });
      setMsg({ text: 'Salary structure assigned successfully! Effective-dated revision recorded.', type: 'success' });
      setTimeout(() => setMsg(null), 5000);
      // Reload employee history
      const res: any = await api.get(`/compensation/employee/${selectedEmpId}`);
      setEmployeeHistory(res);
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to assign salary structure', type: 'error' });
    }
  };

  const handleValidateFormula = async () => {
    if (!compFormula) return;
    try {
      const res: any = await api.post('/compensation/components/validate-formula', {
        code: compCode || 'TEMP_CODE',
        formula: compFormula
      });
      if (res.valid) {
        setFormulaTestResult({
          valid: true,
          message: `✓ Valid Formula: Evaluates to ₹${res.sampleResult?.toLocaleString('en-IN')} with test values. Variables: [${res.variables?.join(', ')}]`
        });
      }
    } catch (err: any) {
      setFormulaTestResult({
        valid: false,
        message: `✕ Invalid: ${err.message || 'Syntax error or circular dependency'}`
      });
    }
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: compName,
        category: compCategory,
        type: compType,
        calculationMode: compCalcMode,
        formulaExpression: compCalcMode === 'FORMULA_EXPRESSION' ? compFormula : null,
        baseComponentCode: compCalcMode === 'PERCENTAGE_OF_COMPONENT' ? compBaseCode : null,
        percentageValue: compCalcMode === 'PERCENTAGE_OF_COMPONENT' ? Number(compPct) : null,
        fixedAmount: compCalcMode === 'FIXED_AMOUNT' ? Number(compFixedAmt) : null,
        isTaxable: compTaxable,
        isPfGross: compPfGross,
        isEsicGross: compEsicGross,
        isPtGross: compPtGross,
        displayOrder: Number(compDisplayOrder)
      };

      if (editingCompId) {
        await api.put(`/compensation/components/${editingCompId}`, payload);
        setMsg({ text: `Component ${compCode} updated successfully.`, type: 'success' });
      } else {
        payload.code = compCode.toUpperCase();
        await api.post('/compensation/components', payload);
        setMsg({ text: `Component ${payload.code} created successfully.`, type: 'success' });
      }

      setShowCompModal(false);
      resetCompModal();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save component');
    }
  };

  const handleToggleComponent = async (id: string) => {
    try {
      const res: any = await api.delete(`/compensation/components/${id}`);
      setMsg({ text: res.message || 'Component status toggled', type: 'success' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle component');
    }
  };

  const resetCompModal = () => {
    setEditingCompId(null);
    setCompCode('');
    setCompName('');
    setCompType('EARNING');
    setCompCategory('FIXED_EARNING');
    setCompCalcMode('FIXED_AMOUNT');
    setCompFormula('');
    setCompBaseCode('BASIC');
    setCompPct(0);
    setCompFixedAmt(0);
    setCompTaxable(true);
    setCompPfGross(false);
    setCompEsicGross(false);
    setCompPtGross(false);
    setCompDisplayOrder(1);
    setFormulaTestResult(null);
  };

  const handleOpenEditComponent = (comp: any) => {
    setEditingCompId(comp.id);
    setCompCode(comp.code);
    setCompName(comp.name);
    setCompType(comp.type);
    setCompCategory(comp.category || 'FIXED_EARNING');
    setCompCalcMode(comp.calculationMode);
    setCompFormula(comp.formulaExpression || '');
    setCompBaseCode(comp.baseComponentCode || 'BASIC');
    setCompPct(comp.percentageValue ? Number(comp.percentageValue) : 0);
    setCompFixedAmt(comp.fixedAmount ? Number(comp.fixedAmount) : 0);
    setCompTaxable(comp.isTaxable);
    setCompPfGross(comp.isPfGross);
    setCompEsicGross(comp.isEsicGross);
    setCompPtGross(comp.isPtGross);
    setCompDisplayOrder(comp.displayOrder || 1);
    setFormulaTestResult(null);
    setShowCompModal(true);
  };

  const handleCloneTemplate = async (templateId: string) => {
    try {
      const res: any = await api.post(`/compensation/structures/${templateId}/clone`);
      setMsg({ text: `Template cloned successfully as ${res.structure?.code}`, type: 'success' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to clone template');
    }
  };

  const formatCurrency = (val: number | string) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredComponents = components.filter(c => {
    const matchesSearch = !componentFilter || c.code.toLowerCase().includes(componentFilter.toLowerCase()) || c.name.toLowerCase().includes(componentFilter.toLowerCase());
    const matchesCategory = !categoryFilter || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="Corporate Compensation & CTC Engine"
        subtitle="Configurable Salary Components Master, Dynamic CTC Structures, Safe AST Formulas & Versioned Assignments"
        breadcrumbs={[
          { label: 'Payroll & CTC' },
          { label: 'Salary Structures & Components' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>CTC Modeling</span>}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'components' && (
              <button className="btn btn-primary btn-sm" onClick={() => { resetCompModal(); setShowCompModal(true); }}>
                <Plus size={13} /> Add Salary Component
              </button>
            )}
            {activeTab === 'templates' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowTemplateModal(true)}>
                <Plus size={13} /> Create Structure Template
              </button>
            )}
          </div>
        }
      />

      {/* Navigation Tabs - Horizontal Layout directly below header */}
      <div
        className="tabs-nav compensation-tabs"
        role="tablist"
        aria-label="Corporate Compensation Sections"
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid var(--border-color)',
          margin: '0 0 16px 0',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
          width: '100%'
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-assignment"
          aria-selected={activeTab === 'assignment'}
          aria-controls="panel-assignment"
          tabIndex={activeTab === 'assignment' ? 0 : -1}
          className={`tab-btn ${activeTab === 'assignment' ? 'active' : ''}`}
          style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('assignment')}
        >
          <Calculator size={14} /> Structure Assignment & CTC Builder
        </button>
        <button
          type="button"
          role="tab"
          id="tab-components"
          aria-selected={activeTab === 'components'}
          aria-controls="panel-components"
          tabIndex={activeTab === 'components' ? 0 : -1}
          className={`tab-btn ${activeTab === 'components' ? 'active' : ''}`}
          style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('components')}
        >
          <Layers size={14} /> Salary Components Master ({components.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-templates"
          aria-selected={activeTab === 'templates'}
          aria-controls="panel-templates"
          tabIndex={activeTab === 'templates' ? 0 : -1}
          className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          style={{ flexShrink: 0, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('templates')}
        >
          <Settings size={14} /> Salary Structure Templates ({templates.length})
        </button>
      </div>

      {/* Notifications */}
      {msg && (
        <div
          style={{
            background: msg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${msg.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* TAB 1: CTC BUILDER & ASSIGNMENT */}
      {activeTab === 'assignment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '16px' }}>
            {/* Form Left */}
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <div className="panel-title"><Calculator size={15} /> CTC Assignment Parameters</div>
                {employeeHistory?.currentStructure && (
                  <span className="badge badge-brand" style={{ fontSize: '0.6875rem' }}>
                    Rev {employeeHistory.currentStructure.version || 1} Active
                  </span>
                )}
              </div>
              <div className="panel-body">
                <form onSubmit={handleAssignStructure} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Target Employee <span className="required-star">*</span></label>
                    <select
                      className="form-select"
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      required
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employeeCode} — {emp.firstName} {emp.lastName} ({emp.department?.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Salary Structure Template</label>
                    <select
                      className="form-select"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">Standard Dynamic Policy (All Active Components)</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.code ? `[${t.code}] ` : ''}{t.name} (v{t.version})
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Determines component percentages, formulas, and inclusion rules.
                    </span>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Annual Cost to Company (CTC in ₹) <span className="required-star">*</span>
                      </label>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-subtle)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--primary-border)' }}>
                        Monthly: {formatCurrency(Math.round(annualCtc / 12))}
                      </span>
                    </div>
                    <input
                      type="number"
                      className="form-control"
                      step="25000"
                      min="60000"
                      value={annualCtc}
                      onChange={(e) => setAnnualCtc(Number(e.target.value))}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>₹{(annualCtc / 100000).toFixed(2)} Lakhs per Annum (LPA)</span>
                      <span>Gross/Net calculated dynamically</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label className="form-label">Effective From <span className="required-star">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Revision Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Band Promotion"
                        value={revisionReason}
                        onChange={(e) => setRevisionReason(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                    <ShieldCheck size={14} /> Assign & Commit Revision
                  </button>
                </form>

                {/* Statutory Policy Quick Indicators */}
                {employeeHistory?.payrollPolicy && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Configured Employee Policy:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>PF Status: <span className="badge badge-brand" style={{ fontSize: '0.6875rem' }}>{employeeHistory.payrollPolicy.pfStatus}</span></div>
                      <div>Wage Basis: <strong>{employeeHistory.payrollPolicy.pfWageBasis}</strong></div>
                      <div>PT State: <strong>{employeeHistory.payrollPolicy.ptState}</strong></div>
                      <div>Tax Regime: <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>{employeeHistory.payrollPolicy.taxRegime} REGIME</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Breakup Right */}
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <div className="panel-title">
                  <DollarSign size={15} /> Dynamic CTC Reconciliation Preview
                </div>
                {previewLoading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculating...</span>}
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                {previewBreakdown ? (
                  <>
                    {/* Summary KPI Mini-bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Monthly Gross</div>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>{formatCurrency(previewBreakdown.monthlyGross)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Monthly Deductions</div>
                        <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>-{formatCurrency(previewBreakdown.totalDeductionsMonthly)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Net Take-Home</div>
                        <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}>{formatCurrency(previewBreakdown.netTakeHomeMonthly)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Employer Monthly</div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{formatCurrency(previewBreakdown.totalEmployerCostMonthly)}</div>
                      </div>
                    </div>

                    {/* Component Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Type</th>
                            <th className="col-currency">Monthly (₹)</th>
                            <th className="col-currency">Annual (₹)</th>
                            <th>Calculation Logic</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewBreakdown.lines?.map((line: any) => (
                            <tr key={line.componentId}>
                              <td style={{ fontWeight: 600 }}>{line.name}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    line.type === 'EARNING'
                                      ? 'badge-brand'
                                      : line.type === 'DEDUCTION'
                                      ? 'badge-danger'
                                      : 'badge-neutral'
                                  }`}
                                  style={{ fontSize: '0.6875rem' }}
                                >
                                  {line.type}
                                </span>
                              </td>
                              <td className="col-currency" style={{ fontWeight: 700 }}>
                                {formatCurrency(line.monthly)}
                              </td>
                              <td className="col-currency" style={{ color: 'var(--text-muted)' }}>
                                {formatCurrency(line.annual)}
                              </td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {line.notes}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Reconciliation Footer */}
                    <div style={{ padding: '10px 16px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span>Reconciled CTC Check: Gross + Employer Contributions = Annual CTC</span>
                      <strong style={{ color: 'var(--success)' }}>
                        ✓ {formatCurrency(previewBreakdown.totalCostToCompanyReconciled)} / year (Balanced)
                      </strong>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading structure breakdown preview...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Historical Revisions Log */}
          {employeeHistory?.revisions && employeeHistory.revisions.length > 0 && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <div className="panel-title"><History size={15} /> Employee Salary Revision History</div>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Revision Period</th>
                      <th className="col-currency">Annual CTC</th>
                      <th className="col-currency">Monthly Gross</th>
                      <th>Revision Reason</th>
                      <th>Approved By</th>
                      <th>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeHistory.revisions.map((rev: any) => (
                      <tr key={rev.id}>
                        <td>
                          {new Date(rev.effectiveFrom).toLocaleDateString()}
                          {rev.effectiveTo ? ` ➔ ${new Date(rev.effectiveTo).toLocaleDateString()}` : ' ➔ Present'}
                        </td>
                        <td className="col-currency" style={{ fontWeight: 700 }}>{formatCurrency(rev.annualCtc)}</td>
                        <td className="col-currency">{formatCurrency(rev.monthlyGross)}</td>
                        <td>{rev.revisionReason || 'Salary revision'}</td>
                        <td>{rev.approvedBy || 'System Admin'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(rev.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALARY COMPONENTS MASTER */}
      {activeTab === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
          <div className="panel" style={{ padding: '12px 16px', margin: 0, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '32px' }}
                placeholder="Search component code, title..."
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '200px' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="FIXED_EARNING">Fixed Earnings</option>
              <option value="VARIABLE_EARNING">Variable Earnings</option>
              <option value="REIMBURSEMENT">Reimbursements</option>
              <option value="STATUTORY_DEDUCTION">Statutory Deductions</option>
              <option value="EMPLOYER_CONTRIBUTION">Employer Contributions</option>
            </select>
          </div>

          {/* Components Master Table */}
          <div className="data-table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Display Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Calculation Method</th>
                  <th>Compliance Flags</th>
                  <th>Status</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map(comp => (
                  <tr key={comp.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{comp.code}</td>
                    <td style={{ fontWeight: 600 }}>{comp.name}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                        {comp.category?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          comp.type === 'EARNING'
                            ? 'badge-brand'
                            : comp.type === 'DEDUCTION'
                            ? 'badge-danger'
                            : 'badge-neutral'
                        }`}
                        style={{ fontSize: '0.6875rem' }}
                      >
                        {comp.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {comp.calculationMode === 'PERCENTAGE_OF_COMPONENT' && (
                        <span>{comp.percentageValue}% of {comp.baseComponentCode || 'CTC'}</span>
                      )}
                      {comp.calculationMode === 'FORMULA_EXPRESSION' && (
                        <code style={{ fontSize: '0.6875rem', background: 'var(--bg-subtle)', padding: '2px 4px', borderRadius: '4px' }}>
                          {comp.formulaExpression}
                        </code>
                      )}
                      {comp.calculationMode === 'FIXED_AMOUNT' && (
                        <span>Fixed {comp.fixedAmount ? `₹${Number(comp.fixedAmount).toLocaleString('en-IN')}` : '(Configured on assign)'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {comp.isTaxable && <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>Taxable</span>}
                        {comp.isPfGross && <span className="badge badge-brand" style={{ fontSize: '0.625rem' }}>PF Gross</span>}
                        {comp.isEsicGross && <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>ESI Gross</span>}
                        {comp.isPtGross && <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>PT Gross</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${comp.active ? 'badge-approved' : 'badge-warning'}`} style={{ fontSize: '0.6875rem' }}>
                        {comp.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="col-center">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEditComponent(comp)}
                          title="Edit Component Parameters"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className={`btn btn-sm ${comp.active ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => handleToggleComponent(comp.id)}
                          title={comp.active ? 'Deactivate Component' : 'Activate Component'}
                        >
                          <Power size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SALARY STRUCTURE TEMPLATES LIBRARY */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {templates.map(tmpl => (
              <div key={tmpl.id} className="panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="panel-header">
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
                      {tmpl.code || 'TEMPLATE'}
                    </span>
                    <h4 style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 700 }}>{tmpl.name}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {tmpl.isDefault && <span className="badge badge-brand" style={{ fontSize: '0.6875rem' }}>Default</span>}
                    <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>v{tmpl.version}</span>
                  </div>
                </div>

                <div className="panel-body" style={{ flex: 1, fontSize: '0.8125rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>
                    {tmpl.description || 'Pre-configured compensation band for corporate roles.'}
                  </p>

                  <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                    Configured Component Lines ({tmpl.lines?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                    {tmpl.lines?.map((line: any) => (
                      <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: 'var(--bg-subtle)', borderRadius: '4px', fontSize: '0.75rem' }}>
                        <span>{line.component?.name || line.componentId}</span>
                        <span style={{ fontWeight: 600 }}>
                          {line.calculationMode === 'PERCENTAGE_OF_COMPONENT' && `${line.percentageValue}% of ${line.baseComponentCode || 'CTC'}`}
                          {line.calculationMode === 'FIXED_AMOUNT' && (line.fixedAmount ? `₹${Number(line.fixedAmount)}` : 'Configured')}
                          {line.calculationMode === 'FORMULA_EXPRESSION' && 'Formula'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Assigned to <strong>{tmpl._count?.structures || 0} employees</strong>
                  </div>
                </div>

                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      setActiveTab('assignment');
                    }}
                  >
                    <Calculator size={13} /> Preview & Assign
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCloneTemplate(tmpl.id)}
                  >
                    <Copy size={13} /> Clone Revision
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SALARY COMPONENT */}
      {showCompModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>{editingCompId ? `Edit Component: ${compCode}` : 'Create Salary Component'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCompModal(false)}>
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveComponent}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Component Code <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SPECIAL_ALLOWANCE"
                      value={compCode}
                      onChange={(e) => setCompCode(e.target.value.toUpperCase())}
                      disabled={!!editingCompId}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display Name <span className="required-star">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Special Allowance"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Direction Type <span className="required-star">*</span></label>
                    <select className="form-select" value={compType} onChange={(e: any) => setCompType(e.target.value)}>
                      <option value="EARNING">Earning (Pay to Employee)</option>
                      <option value="DEDUCTION">Deduction (Employee Withholding)</option>
                      <option value="EMPLOYER_STATUTORY">Employer Contribution / Provision</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category <span className="required-star">*</span></label>
                    <select className="form-select" value={compCategory} onChange={(e) => setCompCategory(e.target.value)}>
                      <option value="FIXED_EARNING">Fixed Earning (Basic, Allowances)</option>
                      <option value="VARIABLE_EARNING">Variable Earning (Incentives, Bonus)</option>
                      <option value="REIMBURSEMENT">Expense Reimbursement</option>
                      <option value="STATUTORY_DEDUCTION">Statutory Deduction (PF, ESI, PT, TDS)</option>
                      <option value="LOAN_RECOVERY">Loan & Advance Recovery</option>
                      <option value="EMPLOYER_CONTRIBUTION">Employer Contribution</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Calculation Mode <span className="required-star">*</span></label>
                  <select className="form-select" value={compCalcMode} onChange={(e: any) => setCompCalcMode(e.target.value)}>
                    <option value="FIXED_AMOUNT">Fixed Monthly Amount</option>
                    <option value="PERCENTAGE_OF_COMPONENT">Percentage of Component Base (e.g. 50% of Basic)</option>
                    <option value="FORMULA_EXPRESSION">Mathematical Formula Expression (Safe AST Engine)</option>
                  </select>
                </div>

                {compCalcMode === 'PERCENTAGE_OF_COMPONENT' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="form-group">
                      <label className="form-label">Percentage (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="e.g. 50.00"
                        value={compPct}
                        onChange={(e) => setCompPct(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Base Component</label>
                      <select className="form-select" value={compBaseCode} onChange={(e) => setCompBaseCode(e.target.value)}>
                        <option value="CTC">Monthly CTC</option>
                        <option value="BASIC">Basic Salary (BASIC)</option>
                        <option value="GROSS">Monthly Gross (GROSS)</option>
                      </select>
                    </div>
                  </div>
                )}

                {compCalcMode === 'FORMULA_EXPRESSION' && (
                  <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="form-label">Algebraic Formula (e.g. MIN(1800, BASIC * 0.12) or BASIC * 0.50 + 2000)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="BASIC * 0.40"
                        value={compFormula}
                        onChange={(e) => setCompFormula(e.target.value)}
                        required
                      />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleValidateFormula}>
                        Validate
                      </button>
                    </div>
                    {formulaTestResult && (
                      <div style={{ fontSize: '0.75rem', color: formulaTestResult.valid ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {formulaTestResult.message}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Compliance & Gross Inclusions</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="checkbox" checked={compTaxable} onChange={(e) => setCompTaxable(e.target.checked)} />
                      Taxable Income
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="checkbox" checked={compPfGross} onChange={(e) => setCompPfGross(e.target.checked)} />
                      PF Wage Gross
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="checkbox" checked={compEsicGross} onChange={(e) => setCompEsicGross(e.target.checked)} />
                      ESI Wage Gross
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="checkbox" checked={compPtGross} onChange={(e) => setCompPtGross(e.target.checked)} />
                      PT Wage Gross
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCompModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
