import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Layers, 
  Calculator, 
  ShieldCheck, 
  Settings, 
  Code, 
  AlertCircle, 
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { SalaryComponentItem } from '../../pages/SalaryColumnMasterView';

export interface SalaryHeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  editingItem: SalaryComponentItem | null;
  existingComponents: SalaryComponentItem[];
  onOpenFormulaInspector?: (code: string, name: string, formula: string) => void;
  formulaFromInspector?: string | null;
  isSubmitting?: boolean;
}

export const SalaryHeadModal: React.FC<SalaryHeadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  existingComponents,
  onOpenFormulaInspector,
  formulaFromInspector,
  isSubmitting = false
}) => {
  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY'>('EARNING');
  const [calcOnPresentDays, setCalcOnPresentDays] = useState(true);
  const [calcMode, setCalcMode] = useState<'FIXED_AMOUNT' | 'PERCENTAGE_OF_COMPONENT' | 'FORMULA_EXPRESSION'>('FIXED_AMOUNT');
  const [formula, setFormula] = useState('');
  const [baseCode, setBaseCode] = useState('BASIC');
  const [percentage, setPercentage] = useState<number>(0);
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [isTaxable, setIsTaxable] = useState(true);
  const [isPfGross, setIsPfGross] = useState(false);
  const [isEsicGross, setIsEsicGross] = useState(false);
  const [isPtGross, setIsPtGross] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Unsaved Changes Tracking
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialValuesRef = useRef<string>('');

  // Sync external formula if returned from inspector
  useEffect(() => {
    if (formulaFromInspector !== undefined && formulaFromInspector !== null) {
      setFormula(formulaFromInspector);
    }
  }, [formulaFromInspector]);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setShowDiscardConfirm(false);
      return;
    }

    setServerError(null);
    setErrors({});

    if (editingItem) {
      setCode(editingItem.code);
      setName(editingItem.name);
      setType(editingItem.type);
      setCalcOnPresentDays(editingItem.category !== 'VARIABLE');
      setCalcMode(editingItem.calculationMode);
      setFormula(editingItem.formulaExpression || '');
      setBaseCode(editingItem.baseComponentCode || 'BASIC');
      setPercentage(Number(editingItem.percentageValue || 0));
      setFixedAmount(Number(editingItem.fixedAmount || 0));
      setIsTaxable(editingItem.isTaxable);
      setIsPfGross(editingItem.isPfGross);
      setIsEsicGross(editingItem.isEsicGross);
      setIsPtGross(editingItem.isPtGross);
      setDisplayOrder(editingItem.displayOrder || 1);

      initialValuesRef.current = JSON.stringify({
        code: editingItem.code,
        name: editingItem.name,
        type: editingItem.type,
        calcOnPresentDays: editingItem.category !== 'VARIABLE',
        calcMode: editingItem.calculationMode,
        formula: editingItem.formulaExpression || '',
        baseCode: editingItem.baseComponentCode || 'BASIC',
        percentage: Number(editingItem.percentageValue || 0),
        fixedAmount: Number(editingItem.fixedAmount || 0),
        isTaxable: editingItem.isTaxable,
        isPfGross: editingItem.isPfGross,
        isEsicGross: editingItem.isEsicGross,
        isPtGross: editingItem.isPtGross,
        displayOrder: editingItem.displayOrder || 1
      });
    } else {
      setCode('');
      setName('');
      setType('EARNING');
      setCalcOnPresentDays(true);
      setCalcMode('FIXED_AMOUNT');
      setFormula('');
      setBaseCode('BASIC');
      setPercentage(0);
      setFixedAmount(0);
      setIsTaxable(true);
      setIsPfGross(false);
      setIsEsicGross(false);
      setIsPtGross(false);
      setDisplayOrder(existingComponents.length + 1);

      initialValuesRef.current = JSON.stringify({
        code: '',
        name: '',
        type: 'EARNING',
        calcOnPresentDays: true,
        calcMode: 'FIXED_AMOUNT',
        formula: '',
        baseCode: 'BASIC',
        percentage: 0,
        fixedAmount: 0,
        isTaxable: true,
        isPfGross: false,
        isEsicGross: false,
        isPtGross: false,
        displayOrder: existingComponents.length + 1
      });
    }
  }, [isOpen, editingItem, existingComponents.length]);

  const isFormDirty = () => {
    const currentValues = JSON.stringify({
      code,
      name,
      type,
      calcOnPresentDays,
      calcMode,
      formula,
      baseCode,
      percentage,
      fixedAmount,
      isTaxable,
      isPfGross,
      isEsicGross,
      isPtGross,
      displayOrder
    });
    return currentValues !== initialValuesRef.current;
  };

  const handleRequestClose = () => {
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleRequestClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDiscardConfirm, code, name, type, calcOnPresentDays, calcMode, formula, baseCode, percentage, fixedAmount, isTaxable, isPfGross, isEsicGross, isPtGross, displayOrder]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!code.trim()) {
      errs.code = 'Head code is required';
    } else if (!/^[A-Z0-9_]+$/.test(code.trim().toUpperCase())) {
      errs.code = 'Code must contain uppercase letters, numbers, and underscores only';
    } else if (!editingItem && existingComponents.some(c => c.code.toUpperCase() === code.trim().toUpperCase())) {
      errs.code = `Head code ${code.toUpperCase()} already exists`;
    }

    if (!name.trim()) {
      errs.name = 'Head display name is required';
    }

    if (calcMode === 'FORMULA_EXPRESSION' && !formula.trim()) {
      errs.formula = 'Formula expression is required when column type is Formula';
    }

    if (calcMode === 'PERCENTAGE_OF_COMPONENT') {
      if (percentage <= 0) errs.percentage = 'Percentage must be greater than 0%';
      if (!baseCode.trim()) errs.baseCode = 'Base component reference is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setServerError(null);

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      type,
      category: calcOnPresentDays ? 'FIXED_EARNING' : 'VARIABLE',
      calculationMode: calcMode,
      formulaExpression: calcMode === 'FORMULA_EXPRESSION' ? formula.trim() : null,
      baseComponentCode: calcMode === 'PERCENTAGE_OF_COMPONENT' ? baseCode : null,
      percentageValue: calcMode === 'PERCENTAGE_OF_COMPONENT' ? Number(percentage) : null,
      fixedAmount: calcMode === 'FIXED_AMOUNT' ? Number(fixedAmount) : null,
      isTaxable,
      isPfGross,
      isEsicGross,
      isPtGross,
      displayOrder: Number(displayOrder)
    };

    try {
      await onSave(payload);
    } catch (err: any) {
      setServerError(err.message || 'Failed to save salary head. Please check your inputs.');
    }
  };

  return (
    <div className="modal-overlay" onClick={handleRequestClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '8px',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          background: '#ffffff',
          position: 'relative'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-head-modal-title"
      >
        {/* Sticky Accessible Header */}
        <div style={{
          padding: '18px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexShrink: 0
        }}>
          <div>
            <h3 id="salary-head-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              {editingItem ? `Edit Salary Head: ${editingItem.code}` : 'Create New Salary Head'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
              Define component classification, formula rules, and statutory calculation parameters.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s, color 0.15s'
            }}
            title="Close dialog (Esc)"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div style={{
            margin: '12px 24px 0 24px',
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div style={{
          padding: '20px 24px 28px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>

          {/* ===================================================
              SECTION A: SALARY HEAD INFORMATION
              =================================================== */}
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#0369a1',
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <Layers size={15} />
              <span>A. Salary Head Information</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Head Code <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HRA"
                  disabled={Boolean(editingItem)}
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  style={{
                    height: '34px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    borderColor: errors.code ? 'var(--danger)' : undefined
                  }}
                  aria-invalid={Boolean(errors.code)}
                />
                {errors.code ? (
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--danger)' }}>{errors.code}</p>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Unique alphanumeric identifier (e.g., BASIC, HRA, CONVEYANCE).</span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Head Display Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. House Rent Allowance"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    height: '34px',
                    borderColor: errors.name ? 'var(--danger)' : undefined
                  }}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name ? (
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--danger)' }}>{errors.name}</p>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Full descriptive label printed on employee payslips.</span>
                )}
              </div>
            </div>
          </div>

          {/* ===================================================
              SECTION B: CLASSIFICATION & CALCULATION
              =================================================== */}
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#0d9488',
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <Calculator size={15} />
              <span>B. Classification & Calculation</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Attach As (Classification)
                </label>
                <select
                  className="form-select"
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  style={{ height: '34px' }}
                >
                  <option value="EARNING">Gross Addition (Earning)</option>
                  <option value="DEDUCTION">Employee Deduction</option>
                  <option value="EMPLOYER_STATUTORY">Employer Contribution</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Column Type
                </label>
                <select
                  className="form-select"
                  value={calcMode}
                  onChange={e => setCalcMode(e.target.value as any)}
                  style={{ height: '34px' }}
                >
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="PERCENTAGE_OF_COMPONENT">Percentage of Component</option>
                  <option value="FORMULA_EXPRESSION">AST Formula Expression</option>
                </select>
              </div>
            </div>

            {/* Calculate on Present Days Toggle Card */}
            <div style={{
              padding: '12px 14px',
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              marginBottom: '14px'
            }}>
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1e293b' }}>
                  Calculate On Present Days
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  When enabled, earnings prorate based on payable days vs calendar working days (attendance & LOP deduction).
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '22px', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={calcOnPresentDays}
                  onChange={e => setCalcOnPresentDays(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                  aria-label="Calculate on present days toggle"
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    inset: 0,
                    backgroundColor: calcOnPresentDays ? 'var(--primary)' : '#cbd5e1',
                    borderRadius: '22px',
                    transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '16px',
                      width: '16px',
                      left: calcOnPresentDays ? '19px' : '3px',
                      bottom: '3px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      transition: '0.2s',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Conditional Calculation Mode Inputs */}
            {calcMode === 'FIXED_AMOUNT' && (
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Default Monthly Amount (₹)
                </label>
                <div style={{ position: 'relative', maxWidth: '240px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '7px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={fixedAmount}
                    onChange={e => setFixedAmount(Number(e.target.value))}
                    style={{ height: '34px', paddingLeft: '26px', fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Default value when assigned. Can be overridden per employee in Salary Structure assignment.
                </span>
              </div>
            )}

            {calcMode === 'PERCENTAGE_OF_COMPONENT' && (
              <div style={{
                background: '#ffffff',
                padding: '14px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Percentage Rate (%) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={percentage}
                      onChange={e => setPercentage(Number(e.target.value))}
                      style={{ height: '34px', paddingRight: '26px', fontVariantNumeric: 'tabular-nums', borderColor: errors.percentage ? 'var(--danger)' : undefined }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '7px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>%</span>
                  </div>
                  {errors.percentage && <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--danger)' }}>{errors.percentage}</p>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Base Component Code <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    value={baseCode}
                    onChange={e => setBaseCode(e.target.value)}
                    style={{ height: '34px', borderColor: errors.baseCode ? 'var(--danger)' : undefined }}
                  >
                    {existingComponents
                      .filter(c => !editingItem || c.id !== editingItem.id)
                      .map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                  </select>
                  {errors.baseCode && <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--danger)' }}>{errors.baseCode}</p>}
                </div>
              </div>
            )}

            {calcMode === 'FORMULA_EXPRESSION' && (
              <div style={{ background: '#ffffff', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    AST Formula Expression <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  {onOpenFormulaInspector && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onOpenFormulaInspector(code || 'TEMP', name || 'New Component', formula)}
                      style={{ height: '26px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Code size={12} /> Open Full Inspector
                    </button>
                  )}
                </div>

                <textarea
                  className="form-input"
                  rows={2}
                  value={formula}
                  onChange={e => setFormula(e.target.value)}
                  placeholder="e.g. BASIC * 0.50 + CONVEYANCE"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    borderColor: errors.formula ? 'var(--danger)' : undefined
                  }}
                />
                {errors.formula ? (
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'var(--danger)' }}>{errors.formula}</p>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Supported functions: MIN, MAX, ROUND, CEIL, FLOOR, arithmetic operators (+, -, *, /).
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ===================================================
              SECTION C: STATUTORY BASIS & TAX RULES
              =================================================== */}
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#059669',
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <ShieldCheck size={15} />
              <span>C. Statutory Basis & Tax Rules</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '10px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem'
              }}>
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={e => setIsTaxable(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Subject to TDS Income Tax</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Included in annual taxable income calculation.</div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem'
              }}>
                <input
                  type="checkbox"
                  checked={isPfGross}
                  onChange={e => setIsPfGross(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Included in PF Gross Basis</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Contributes toward 12% EPF statutory wage basis.</div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem'
              }}>
                <input
                  type="checkbox"
                  checked={isEsicGross}
                  onChange={e => setIsEsicGross(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Included in ESIC Gross Basis</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Applies when monthly gross wages ≤ ₹21,000.</div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem'
              }}>
                <input
                  type="checkbox"
                  checked={isPtGross}
                  onChange={e => setIsPtGross(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Included in PT Gross Basis</div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Subject to state Professional Tax slab evaluation.</div>
                </div>
              </label>
            </div>
          </div>

          {/* ===================================================
              SECTION D: DISPLAY CONFIGURATION
              =================================================== */}
          <div style={{
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#64748b',
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <Settings size={15} />
              <span>D. Display Configuration</span>
            </div>

            <div style={{ maxWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Display Sequence Order
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-input"
                value={displayOrder}
                onChange={e => setDisplayOrder(Number(e.target.value))}
                style={{ height: '34px', fontVariantNumeric: 'tabular-nums' }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                Sort index for column ordering on payslips and registers.
              </span>
            </div>
          </div>

        </div>

        {/* Sticky Accessible Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          flexShrink: 0
        }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleRequestClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isSubmitting}
            onClick={handleSubmit}
            style={{ minWidth: '130px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSubmitting ? 'Saving...' : editingItem ? 'Update Salary Head' : 'Save Salary Head'}
          </button>
        </div>

        {/* Unsaved Changes Confirmation Modal */}
        {showDiscardConfirm && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1300
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b45309', marginBottom: '10px' }}>
                <AlertTriangle size={20} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Discard Unsaved Changes?</h4>
              </div>
              <p style={{ margin: '0 0 18px 0', fontSize: '0.825rem', color: '#475569', lineHeight: 1.5 }}>
                You have modified this salary head configuration. Discarding will lose any unsaved edits.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
