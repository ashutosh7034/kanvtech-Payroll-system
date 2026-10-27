import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, ColumnDef } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SalaryHeadModal } from '../components/payroll/SalaryHeadModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { FormulaInspectorDrawer } from '../components/payroll/FormulaInspectorDrawer';
import {
  Plus,
  Edit2,
  Code,
  CheckCircle2,
  AlertCircle,
  Filter,
  Check,
  X,
  Layers,
  Settings,
  HelpCircle,
  Eye
} from 'lucide-react';

export interface SalaryComponentItem {
  id: string;
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_STATUTORY';
  category: string;
  calculationMode: 'FIXED_AMOUNT' | 'PERCENTAGE_OF_COMPONENT' | 'FORMULA_EXPRESSION';
  formulaExpression?: string | null;
  baseComponentCode?: string | null;
  percentageValue?: string | number | null;
  fixedAmount?: string | number | null;
  active: boolean;
  isTaxable: boolean;
  isPfGross: boolean;
  isEsicGross: boolean;
  isPtGross: boolean;
  affectsGross: boolean;
  affectsNet: boolean;
  affectsCtc: boolean;
  displayOrder: number;
}

interface SalaryColumnMasterViewProps {
  onNavigateToStructures?: () => void;
}

export const SalaryColumnMasterView: React.FC<SalaryColumnMasterViewProps> = ({
  onNavigateToStructures
}) => {
  const { canPerformAction } = useAuth();
  const canCreateComponent = canPerformAction('salary_component:create');
  const canEditComponent = canPerformAction('salary_component:edit');
  const canToggleComponent = canPerformAction('salary_component:toggle') || canEditComponent;

  const [components, setComponents] = useState<SalaryComponentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [calcModeFilter, setCalcModeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Formula Inspector Drawer State
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectingComponent, setInspectingComponent] = useState<{
    code: string;
    name: string;
    formula: string;
    isEditingDrawer?: boolean;
  } | null>(null);

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [appliedFormula, setAppliedFormula] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation Dialog State
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [componentToToggle, setComponentToToggle] = useState<SalaryComponentItem | null>(null);

  const loadComponents = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res: any = await api.get('/compensation/components');
      setComponents(res.components || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load salary column master records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, []);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return components.filter(item => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (calcModeFilter !== 'ALL' && item.calculationMode !== calcModeFilter) return false;
      if (statusFilter !== 'ALL') {
        const isActive = statusFilter === 'ACTIVE';
        if (item.active !== isActive) return false;
      }
      return true;
    });
  }, [components, typeFilter, calcModeFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setAppliedFormula(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: SalaryComponentItem) => {
    setEditingId(item.id);
    setAppliedFormula(null);
    setModalOpen(true);
  };

  const handleSaveComponent = async (payload: any) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        await api.put(`/compensation/components/${editingId}`, payload);
        setSuccessMsg(`Salary head ${payload.code} updated successfully`);
      } else {
        await api.post('/compensation/components', payload);
        setSuccessMsg(`Salary head ${payload.code} created successfully`);
      }
      setModalOpen(false);
      setEditingId(null);
      setAppliedFormula(null);
      await loadComponents();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Operation failed';
      setErrorMsg(errMsg);
      throw new Error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!componentToToggle) return;
    try {
      await api.put(`/compensation/components/${componentToToggle.id}`, {
        active: !componentToToggle.active
      });
      setSuccessMsg(`Component ${componentToToggle.code} is now ${!componentToToggle.active ? 'Active' : 'Inactive'}`);
      setConfirmDialogOpen(false);
      setComponentToToggle(null);
      await loadComponents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update component status');
    }
  };

  const formatColumnType = (mode: string) => {
    switch (mode) {
      case 'FIXED_AMOUNT':
        return 'Fixed Amount';
      case 'PERCENTAGE_OF_COMPONENT':
        return 'Percentage';
      case 'FORMULA_EXPRESSION':
        return 'AST Formula';
      default:
        return mode;
    }
  };

  const formatAttachAs = (type: string) => {
    switch (type) {
      case 'EARNING':
        return 'Gross Addition';
      case 'DEDUCTION':
        return 'Employee Deduction';
      case 'EMPLOYER_STATUTORY':
        return 'Employer Liability';
      default:
        return type;
    }
  };

  // DataTable column definitions matching Spine's exact Column Master structure
  const tableColumns: ColumnDef<SalaryComponentItem>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      width: '120px',
      render: (item) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
          {item.code}
        </span>
      )
    },
    {
      key: 'name',
      header: 'Head Name',
      sortable: true,
      width: '200px',
      render: (item) => (
        <div>
          <strong style={{ color: 'var(--text-main)', fontSize: '0.8125rem' }}>{item.name}</strong>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
            Order: {item.displayOrder}
          </div>
        </div>
      )
    },
    {
      key: 'calculationMode',
      header: 'Column Type',
      sortable: true,
      width: '140px',
      render: (item) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}
        >
          {item.calculationMode === 'FORMULA_EXPRESSION' && <Code size={12} style={{ color: 'var(--primary)' }} />}
          {formatColumnType(item.calculationMode)}
        </span>
      )
    },
    {
      key: 'formulaExpression',
      header: 'Formula / Calculation Rule',
      width: '240px',
      render: (item) => {
        if (item.calculationMode === 'FORMULA_EXPRESSION') {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <code
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                  maxWidth: '180px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'inline-block'
                }}
                title={item.formulaExpression || ''}
              >
                {item.formulaExpression}
              </code>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Inspect formula AST and simulation"
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectingComponent({
                    code: item.code,
                    name: item.name,
                    formula: item.formulaExpression || ''
                  });
                  setInspectorOpen(true);
                }}
                style={{ padding: '2px 4px', height: '22px' }}
              >
                <Eye size={12} />
              </button>
            </div>
          );
        }
        if (item.calculationMode === 'PERCENTAGE_OF_COMPONENT') {
          return (
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {Number(item.percentageValue || 0)}% of {item.baseComponentCode || 'BASIC'}
            </span>
          );
        }
        return (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {item.fixedAmount ? `Fixed ₹${Number(item.fixedAmount).toLocaleString('en-IN')}` : 'Structure Assigned'}
          </span>
        );
      }
    },
    {
      key: 'category',
      header: 'Calc On Present Days',
      sortable: true,
      align: 'center',
      width: '150px',
      render: (item) => {
        const isPresentDays = item.category !== 'VARIABLE';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isPresentDays ? '#059669' : 'var(--text-dim)'
            }}
          >
            {isPresentDays ? <Check size={13} style={{ color: '#059669' }} /> : <X size={13} />}
            {isPresentDays ? 'Yes (Prorated)' : 'No (Fixed)'}
          </span>
        );
      }
    },
    {
      key: 'type',
      header: 'Attach As',
      sortable: true,
      width: '160px',
      render: (item) => (
        <div>
          <StatusBadge status={item.type} size="sm" />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            {formatAttachAs(item.type)}
          </div>
        </div>
      )
    },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      width: '100px',
      render: (item) => (
        <StatusBadge status={item.active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '120px',
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          {item.calculationMode === 'FORMULA_EXPRESSION' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              title="Inspect Formula"
              onClick={() => {
                setInspectingComponent({
                  code: item.code,
                  name: item.name,
                  formula: item.formulaExpression || ''
                });
                setInspectorOpen(true);
              }}
              style={{ padding: '0 6px', height: '24px' }}
            >
              <Code size={12} />
            </button>
          )}
          {canEditComponent && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              title="Edit Component"
              onClick={() => handleOpenEdit(item)}
              style={{ padding: '0 6px', height: '24px' }}
            >
              <Edit2 size={12} />
            </button>
          )}
          {canToggleComponent && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title={item.active ? 'Deactivate' : 'Activate'}
              onClick={() => {
                setComponentToToggle(item);
                setConfirmDialogOpen(true);
              }}
              style={{ padding: '0 6px', height: '24px', color: item.active ? 'var(--danger)' : 'var(--success)' }}
            >
              {item.active ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="salary-column-master-view">
      {/* 1. Page Header */}
      <PageHeader
        title="Salary Column Master"
        subtitle="Configure payroll earnings, statutory deductions, formula expressions, and attendance proration rules."
        breadcrumbs={[
          { label: 'Overview' },
          { label: 'Payroll & Compensation' },
          { label: 'Salary Column Master' }
        ]}
        badge={
          <span className="badge badge-brand" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
            ⚡ Spine Parity Architecture
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {onNavigateToStructures && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onNavigateToStructures}
              >
                <Layers size={13} /> CTC Structures
              </button>
            )}
            {canCreateComponent && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenCreate}
              >
                <Plus size={13} /> Add Salary Head
              </button>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="btn btn-ghost btn-sm" style={{ padding: '2px' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="btn btn-ghost btn-sm" style={{ padding: '2px' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* 2. High-Density Column Master DataTable */}
      <DataTable
        data={filteredData}
        columns={tableColumns}
        searchPlaceholder="Search head code, name, formula..."
        pageSize={15}
        isLoading={loading}
        emptyTitle="No Salary Components Found"
        emptySubtitle="No components match your search query or selected filter criteria."
        toolbarActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Filter by Attach As */}
            <select
              className="input-field input-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
            >
              <option value="ALL">All Attach As</option>
              <option value="EARNING">Gross Addition (Earnings)</option>
              <option value="DEDUCTION">Employee Deductions</option>
              <option value="EMPLOYER_STATUTORY">Employer Liabilities</option>
            </select>

            {/* Filter by Column Type */}
            <select
              className="input-field input-sm"
              value={calcModeFilter}
              onChange={(e) => setCalcModeFilter(e.target.value)}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
            >
              <option value="ALL">All Column Types</option>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
              <option value="PERCENTAGE_OF_COMPONENT">Percentage</option>
              <option value="FORMULA_EXPRESSION">AST Formula</option>
            </select>

            {/* Filter by Status */}
            <select
              className="input-field input-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        }
      />

      {/* 3. Create / Edit Salary Head Centered Modal */}
      <SalaryHeadModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
          setAppliedFormula(null);
        }}
        onSave={handleSaveComponent}
        editingItem={components.find(c => c.id === editingId) || null}
        existingComponents={components}
        isSubmitting={isSubmitting}
        onOpenFormulaInspector={(code, name, formula) => {
          setInspectingComponent({
            code: code || 'TEMP_CODE',
            name: name || 'Salary Head',
            formula: formula || '',
            isEditingDrawer: true
          });
          setInspectorOpen(true);
        }}
        formulaFromInspector={appliedFormula}
      />

      {/* 4. AST Formula Inspector Drawer */}
      <FormulaInspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        componentCode={inspectingComponent?.code || ''}
        componentName={inspectingComponent?.name}
        initialFormula={inspectingComponent?.formula || ''}
        canEdit={Boolean(inspectingComponent?.isEditingDrawer)}
        onApplyFormula={(newFormula) => {
          if (inspectingComponent?.isEditingDrawer) {
            setAppliedFormula(newFormula);
          }
        }}
      />

      {/* 5. Status Toggle Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        title={componentToToggle?.active ? 'Deactivate Salary Component?' : 'Activate Salary Component?'}
        message={`Are you sure you want to ${componentToToggle?.active ? 'deactivate' : 'activate'} ${componentToToggle?.code} (${componentToToggle?.name})? Deactivating prevents new assignments in salary structures but preserves historical payroll runs.`}
        confirmText={componentToToggle?.active ? 'Deactivate' : 'Activate'}
        isDestructive={Boolean(componentToToggle?.active)}
        onConfirm={handleToggleStatus}
        onCancel={() => {
          setConfirmDialogOpen(false);
          setComponentToToggle(null);
        }}
      />
    </div>
  );
};
