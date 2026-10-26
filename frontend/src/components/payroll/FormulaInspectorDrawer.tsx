import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { SideDrawer } from '../common/SideDrawer';
import { StatusBadge } from '../common/StatusBadge';
import {
  Code,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  GitBranch,
  Layers,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';

interface AvailableReference {
  code: string;
  name: string;
  type: string;
  calculationMode?: string;
}

interface FormulaValidationResponse {
  valid: boolean;
  variables: string[];
  missingVariables: string[];
  dependencyOrder: string[];
  steps: Array<{ variable: string; value: number }>;
  sampleResult?: number;
  formattedResult?: string;
  cycle?: string[];
  error?: string;
}

interface FormulaInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  componentCode: string;
  componentName?: string;
  initialFormula?: string;
  onApplyFormula?: (formula: string) => void;
  canEdit?: boolean;
}

export const FormulaInspectorDrawer: React.FC<FormulaInspectorDrawerProps> = ({
  isOpen,
  onClose,
  componentCode,
  componentName = 'Salary Component',
  initialFormula = '',
  onApplyFormula,
  canEdit = true
}) => {
  const [formula, setFormula] = useState(initialFormula);
  const [availableRefs, setAvailableRefs] = useState<{
    systemVariables: AvailableReference[];
    components: AvailableReference[];
  }>({ systemVariables: [], components: [] });

  const [validation, setValidation] = useState<FormulaValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [simContext, setSimContext] = useState<Record<string, number>>({
    CTC: 100000,
    BASIC: 40000,
    GROSS: 80000,
    NET: 70000,
    PRESENT_DAYS: 30,
    WORKING_DAYS: 30,
    LOP_DAYS: 0
  });

  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Sync initial formula on open
  useEffect(() => {
    if (isOpen) {
      setFormula(initialFormula || '');
      loadReferences();
    }
  }, [isOpen, initialFormula]);

  const loadReferences = async () => {
    try {
      const res: any = await api.get('/compensation/components/available-references');
      setAvailableRefs({
        systemVariables: res.systemVariables || [],
        components: res.components || []
      });
    } catch (err) {
      console.error('Failed to load available formula references', err);
    }
  };

  const validateFormula = useCallback(async (currentFormula: string, customContext = simContext) => {
    if (!currentFormula.trim()) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    try {
      const res: any = await api.post('/compensation/components/validate-formula', {
        code: componentCode || 'PREVIEW_COMP',
        formula: currentFormula.trim(),
        context: customContext
      });

      setValidation({
        valid: res.valid,
        variables: res.variables || [],
        missingVariables: res.missingVariables || [],
        dependencyOrder: res.dependencyOrder || [],
        steps: res.steps || [],
        sampleResult: res.sampleResult,
        formattedResult: res.formattedResult
      });

      // Populate simContext with any newly referenced variables
      if (res.variables && Array.isArray(res.variables)) {
        setSimContext(prev => {
          const updated = { ...prev };
          for (const v of res.variables) {
            if (updated[v] === undefined) {
              updated[v] = 1000;
            }
          }
          return updated;
        });
      }
    } catch (err: any) {
      const errData = err.response?.data;
      setValidation({
        valid: false,
        variables: errData?.variables || [],
        missingVariables: [],
        dependencyOrder: [],
        steps: [],
        cycle: errData?.cycle,
        error: errData?.error || err.message || 'Formula validation error'
      });
    } finally {
      setIsValidating(false);
    }
  }, [componentCode, simContext]);

  // Debounced auto-validation
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      validateFormula(formula, simContext);
    }, 350);
    return () => clearTimeout(timer);
  }, [formula, isOpen]);

  const handleSimContextChange = (key: string, val: number) => {
    const updated = { ...simContext, [key]: val };
    setSimContext(updated);
    validateFormula(formula, updated);
  };

  const insertToken = (tokenText: string) => {
    setFormula(prev => {
      const space = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('(') ? ' ' : '';
      return `${prev}${space}${tokenText} `;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="AST Formula Inspector & Simulator"
      subtitle={`${componentCode} • ${componentName}`}
      width="640px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setFormula(initialFormula || '');
              validateFormula(initialFormula || '', simContext);
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            {canEdit && onApplyFormula && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!validation?.valid || !formula.trim()}
                onClick={() => {
                  onApplyFormula(formula.trim());
                  onClose();
                }}
              >
                Apply to Component
              </button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* 1. Formula Expression Editor */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Code size={14} style={{ color: 'var(--primary)' }} />
              Formula Expression
            </label>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              Deterministic AST Parser • Zero eval()
            </span>
          </div>

          <textarea
            className="input-field"
            rows={3}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="e.g. BASIC * 0.50 or IF(CTC > 50000, BASIC * 0.40, BASIC * 0.30)"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              width: '100%',
              borderColor: validation ? (validation.valid ? 'var(--success-border)' : 'var(--danger-border)') : undefined
            }}
          />

          {/* Quick Syntax Helper Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {['+', '-', '*', '/', '(', ')', 'ROUND(expr, 2)', 'MIN(a, b)', 'MAX(a, b)', 'IF(cond, trueVal, falseVal)'].map(chip => (
              <button
                key={chip}
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => insertToken(chip)}
                style={{
                  fontSize: '0.6875rem',
                  height: '22px',
                  padding: '0 6px',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Validation & AST Feedback Alert */}
        <div>
          {isValidating ? (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ width: '13px', height: '13px' }} />
              <span>Analyzing AST grammar and dependency tree...</span>
            </div>
          ) : validation ? (
            validation.valid ? (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.8125rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Valid Formula Expression</span>
                </div>
                {validation.missingVariables && validation.missingVariables.length > 0 && (
                  <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: '#fffbeb', borderRadius: 'var(--radius-xs)', border: '1px solid #fde68a', color: '#b45309', fontSize: '0.75rem' }}>
                    <strong>Notice:</strong> Unrecognized variables: {validation.missingVariables.join(', ')} (will default to 0 during payroll if unsupplied).
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.8125rem' }}>
                  <AlertTriangle size={16} />
                  <span>{validation.cycle ? 'Circular Dependency Detected' : 'Syntax / Evaluation Error'}</span>
                </div>
                <p style={{ fontSize: '0.75rem', marginTop: '4px', marginBottom: 0, fontFamily: 'var(--font-mono)' }}>
                  {validation.error}
                </p>
                {validation.cycle && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <GitBranch size={13} />
                    <span>Cycle Chain: {validation.cycle.join(' ➔ ')}</span>
                  </div>
                )}
              </div>
            )
          ) : null}
        </div>

        {/* 3. Live Simulation & Intermediate Value Breakdown */}
        {validation?.valid && (
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={13} style={{ color: 'var(--primary)' }} />
                Interactive AST Simulation
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                Output: ₹{validation.formattedResult || Number(validation.sampleResult || 0).toFixed(2)}
              </div>
            </div>

            {/* Inputs Grid for Referenced Variables */}
            {validation.variables && validation.variables.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                {validation.variables.map(v => (
                  <div key={v} style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                      {v}
                    </div>
                    <input
                      type="number"
                      className="input-field input-sm"
                      value={simContext[v] ?? 0}
                      onChange={(e) => handleSimContextChange(v, Number(e.target.value))}
                      style={{ width: '100%', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                This is a fixed constant expression with no dynamic variable inputs.
              </p>
            )}

            {/* Dependency Order Trail */}
            {validation.dependencyOrder && validation.dependencyOrder.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                <Layers size={12} />
                <span>Deterministic Evaluation Order:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                  {validation.dependencyOrder.join(' ➔ ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. Available Component & System Reference Catalog */}
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={14} style={{ color: 'var(--text-dim)' }} />
            Available Component References
          </div>

          {/* System Variables */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '4px' }}>
              Standard System Variables
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {availableRefs.systemVariables.map(ref => (
                <div
                  key={ref.code}
                  onClick={() => insertToken(ref.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
                      {ref.code}
                    </span>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{ref.name}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(ref.code);
                    }}
                    style={{ padding: '2px 4px', height: '20px' }}
                  >
                    {copiedVar === ref.code ? <Check size={11} style={{ color: '#059669' }} /> : <Copy size={11} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Company Salary Components */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '4px' }}>
              Company Salary Components ({availableRefs.components.length})
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {availableRefs.components
                .filter(c => c.code !== componentCode.toUpperCase())
                .map(comp => (
                  <div
                    key={comp.code}
                    onClick={() => insertToken(comp.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        {comp.code}
                      </span>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {comp.name}
                      </div>
                    </div>
                    <StatusBadge status={comp.type} size="sm" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </SideDrawer>
  );
};
