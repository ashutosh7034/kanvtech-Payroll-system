import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Database,
  Building2,
  MapPin,
  Network,
  Briefcase,
  Award,
  Layers,
  Factory,
  Users,
  KanbanSquare,
  UserCheck,
  DollarSign,
  FileSpreadsheet,
  CreditCard,
  Clock,
  Calendar,
  Receipt,
  LifeBuoy,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Check,
  X,
  ChevronRight,
  Info
} from 'lucide-react';

interface MasterFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'time';
  required?: boolean;
  options?: { value: string; label: string }[];
  parentCategory?: string;
  placeholder?: string;
  readOnly?: boolean;
}

interface MasterCategoryConfig {
  key: string;
  label: string;
  singularLabel: string;
  group: 'organization' | 'payroll' | 'attendance' | 'operations';
  description: string;
  icon: string;
  model: string;
  codeField: string;
  nameField: string;
  supportsActiveToggle: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  fields: MasterFieldDefinition[];
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Building2,
  MapPin,
  Network,
  Briefcase,
  Award,
  Layers,
  Factory,
  Users,
  KanbanSquare,
  UserCheck,
  DollarSign,
  FileSpreadsheet,
  CreditCard,
  Clock,
  Calendar,
  Receipt,
  LifeBuoy,
  Database
};

export const MasterDataManagementView: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<MasterCategoryConfig[]>([]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [categorySearch, setCategorySearch] = useState<string>('');

  // Record management state
  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);
  const [recordSearch, setRecordSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [modalFormData, setModalFormData] = useState<Record<string, any>>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [parentOptions, setParentOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Status toggle confirmation
  const [deactivateConfirmTarget, setDeactivateConfirmTarget] = useState<any | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // 1. Fetch categories overview
  const loadCategories = useCallback(async () => {
    try {
      const res: any = await api.get('/masters/categories');
      if (res && res.categories) {
        setCategories(res.categories);
      }
    } catch (err: any) {
      console.error('Failed to load master categories:', err);
      setActionNotice({ type: 'error', message: err.message || 'Failed to load master data categories' });
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const activeCategory = useMemo(() => {
    return categories.find(c => c.key === selectedCategoryKey) || null;
  }, [categories, selectedCategoryKey]);

  // 2. Fetch records for selected category
  const loadRecords = useCallback(async () => {
    if (!selectedCategoryKey) return;
    setRecordsLoading(true);
    setActionNotice(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: currentPage.toString(),
        limit: '25'
      });
      if (recordSearch.trim()) {
        params.append('search', recordSearch.trim());
      }
      const res: any = await api.get(`/masters/${selectedCategoryKey}?${params.toString()}`);
      if (res && res.records) {
        setRecords(res.records);
        setTotalRecords(res.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to load master records:', err);
      setActionNotice({ type: 'error', message: err.message || 'Failed to load records' });
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedCategoryKey, statusFilter, currentPage, recordSearch]);

  useEffect(() => {
    if (selectedCategoryKey) {
      loadRecords();
    }
  }, [selectedCategoryKey, loadRecords]);

  // 3. Preload parent options for select fields
  const loadParentOptions = async (category: MasterCategoryConfig) => {
    const optionsMap: Record<string, { value: string; label: string }[]> = {};
    for (const f of category.fields) {
      if (f.type === 'select' && f.parentCategory) {
        try {
          const res: any = await api.get(`/masters/${f.parentCategory}?status=ACTIVE&all=true`);
          if (res && res.records) {
            const parentCfg = categories.find(c => c.key === f.parentCategory);
            const nameField = parentCfg?.nameField || 'name';
            optionsMap[f.name] = res.records.map((r: any) => ({
              value: r.id,
              label: `${r[nameField]} ${r.code ? `(${r.code})` : ''}`
            }));
          }
        } catch (err) {
          console.warn(`Could not preload parent options for ${f.name}:`, err);
        }
      }
    }
    setParentOptions(optionsMap);
  };

  // 4. Open Modal for Create or Edit
  const handleOpenModal = (record?: any) => {
    if (!activeCategory) return;
    setModalError(null);
    loadParentOptions(activeCategory);

    if (record) {
      setEditingRecord(record);
      const initial: Record<string, any> = {};
      activeCategory.fields.forEach(f => {
        initial[f.name] = record[f.name] !== undefined && record[f.name] !== null ? record[f.name] : '';
      });
      setModalFormData(initial);
    } else {
      setEditingRecord(null);
      const initial: Record<string, any> = {};
      activeCategory.fields.forEach(f => {
        if (f.type === 'boolean') {
          initial[f.name] = true;
        } else if (f.type === 'number') {
          initial[f.name] = '';
        } else {
          initial[f.name] = '';
        }
      });
      setModalFormData(initial);
    }
    setIsModalOpen(true);
  };

  // 5. Submit Create or Update
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      if (editingRecord) {
        await api.patch(`/masters/${activeCategory.key}/${editingRecord.id}`, modalFormData);
        setActionNotice({ type: 'success', message: `${activeCategory.singularLabel} updated successfully.` });
      } else {
        await api.post(`/masters/${activeCategory.key}`, modalFormData);
        setActionNotice({ type: 'success', message: `${activeCategory.singularLabel} created successfully.` });
      }
      setIsModalOpen(false);
      loadRecords();
      loadCategories();
    } catch (err: any) {
      setModalError(err.message || 'Operation failed. Please review the inputs.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // 6. Handle Active Toggle
  const handleToggleStatus = async (record: any) => {
    if (!activeCategory) return;
    const newActive = !record.active;

    // If deactivating and might have dependencies, prompt confirmation
    if (!newActive && !deactivateConfirmTarget) {
      setDeactivateConfirmTarget(record);
      return;
    }

    try {
      const res: any = await api.patch(`/masters/${activeCategory.key}/${record.id}/status`, {
        active: newActive
      });
      setActionNotice({
        type: 'success',
        message: res.message || `${activeCategory.singularLabel} status updated.`
      });
      setDeactivateConfirmTarget(null);
      loadRecords();
      loadCategories();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to toggle status' });
      setDeactivateConfirmTarget(null);
    }
  };

  // 7. Handle Delete
  const handleDeleteRecord = async () => {
    if (!activeCategory || !deleteConfirmTarget) return;
    try {
      await api.delete(`/masters/${activeCategory.key}/${deleteConfirmTarget.id}`);
      setActionNotice({
        type: 'success',
        message: `${activeCategory.singularLabel} deleted successfully.`
      });
      setDeleteConfirmTarget(null);
      loadRecords();
      loadCategories();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to delete record' });
      setDeleteConfirmTarget(null);
    }
  };

  // Filter categories by group and search
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesGroup = selectedGroup === 'ALL' || cat.group === selectedGroup;
      const matchesSearch =
        !categorySearch.trim() ||
        cat.label.toLowerCase().includes(categorySearch.toLowerCase()) ||
        cat.description.toLowerCase().includes(categorySearch.toLowerCase());
      return matchesGroup && matchesSearch;
    });
  }, [categories, selectedGroup, categorySearch]);

  const totalAllRecords = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.totalCount || 0), 0);
  }, [categories]);

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
          <Database size={16} />
          <span>System Administration</span>
          <ChevronRight size={14} />
          <span
            style={{ cursor: 'pointer', color: selectedCategoryKey ? 'var(--primary)' : 'inherit', fontWeight: 500 }}
            onClick={() => setSelectedCategoryKey(null)}
          >
            Master Data Management (MDM)
          </span>
          {activeCategory && (
            <>
              <ChevronRight size={14} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeCategory.label}</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database className="text-primary" size={26} />
              {activeCategory ? activeCategory.label : 'Centralized Master Data Management'}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              {activeCategory
                ? activeCategory.description
                : `Authoritative repository of organization structures, company classifications, grades, and system dropdowns (${totalAllRecords} total records across ${categories.length} categories).`}
            </p>
          </div>

          {activeCategory && (
            <button
              onClick={() => setSelectedCategoryKey(null)}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> All Master Categories
            </button>
          )}
        </div>
      </div>

      {/* Global Action / Notification Alert */}
      {actionNotice && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            backgroundColor:
              actionNotice.type === 'success'
                ? 'rgba(16, 185, 129, 0.1)'
                : actionNotice.type === 'error'
                ? 'rgba(239, 68, 68, 0.1)'
                : 'rgba(59, 130, 246, 0.1)',
            color:
              actionNotice.type === 'success'
                ? '#059669'
                : actionNotice.type === 'error'
                ? '#dc2626'
                : '#2563eb',
            border: `1px solid ${
              actionNotice.type === 'success'
                ? '#10b981'
                : actionNotice.type === 'error'
                ? '#ef4444'
                : '#3b82f6'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actionNotice.type === 'success' && <CheckCircle2 size={18} />}
            {actionNotice.type === 'error' && <XCircle size={18} />}
            {actionNotice.type === 'info' && <Info size={18} />}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* VIEW 1: CATEGORIES OVERVIEW GRID */}
      {!selectedCategoryKey && (
        <div>
          {/* Group Filter Bar & Search */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'organization', label: 'Organization & Structure' },
                { id: 'payroll', label: 'Payroll & CTC' },
                { id: 'attendance', label: 'Time & Attendance' },
                { id: 'operations', label: 'Operations & Desk' }
              ].map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedGroup === group.id ? 'var(--primary)' : 'var(--border-color, #cbd5e1)',
                    backgroundColor: selectedGroup === group.id ? 'var(--primary)' : 'transparent',
                    color: selectedGroup === group.id ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search master categories..."
                value={categorySearch}
                onChange={e => setCategorySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* Categories Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
            {filteredCategories.map(cat => {
              const IconComponent = ICON_MAP[cat.icon] || Database;
              return (
                <div
                  key={cat.key}
                  onClick={() => {
                    setSelectedCategoryKey(cat.key);
                    setCurrentPage(1);
                    setRecordSearch('');
                    setStatusFilter('ALL');
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary, #3b82f6)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--primary, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <IconComponent size={22} />
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-muted, #f1f5f9)',
                          color: 'var(--text-muted, #64748b)'
                        }}
                      >
                        {cat.group}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                      {cat.label}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: '1.4', minHeight: '36px' }}>
                      {cat.description}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-color, #f1f5f9)',
                      paddingTop: '14px',
                      marginTop: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#059669'
                        }}
                      >
                        {cat.activeCount} Active
                      </span>
                      {cat.inactiveCount > 0 && (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#dc2626'
                          }}
                        >
                          {cat.inactiveCount} Inactive
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Manage <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: CATEGORY RECORDS WORKBENCH */}
      {activeCategory && (
        <div>
          {/* Controls & Filter Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
              padding: '16px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={`Search ${activeCategory.label.toLowerCase()}...`}
                  value={recordSearch}
                  onChange={e => {
                    setRecordSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Status Filter */}
              {activeCategory.supportsActiveToggle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={e => {
                      setStatusFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '13px',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <option value="ALL">All Records</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>
              )}

              {/* Refresh Button */}
              <button
                onClick={loadRecords}
                className="btn btn-outline"
                style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Refresh master table"
              >
                <RefreshCw size={14} className={recordsLoading ? 'spin' : ''} />
              </button>
            </div>

            {/* Action Button: Add New */}
            {activeCategory.canCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Plus size={16} /> Add {activeCategory.singularLabel}
              </button>
            )}
          </div>

          {/* Records Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border-color, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {activeCategory.key === 'job-positions' ? 'Title' : 'Name / Label'}
                    </th>
                    {/* Category specific column */}
                    {activeCategory.key === 'branches' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Location</th>
                    )}
                    {activeCategory.key === 'grades' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>CTC Range</th>
                    )}
                    {activeCategory.key === 'salary-components' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type / Mode</th>
                    )}
                    {activeCategory.key === 'units' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Branch</th>
                    )}
                    {activeCategory.key === 'job-positions' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Department</th>
                    )}
                    {activeCategory.key === 'loan-types' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Limit / Rate</th>
                    )}
                    {activeCategory.key === 'shift-policies' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Timings</th>
                    )}
                    {activeCategory.key === 'leave-policies' && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Annual Quota</th>
                    )}
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
                        <p style={{ margin: 0 }}>Loading master records...</p>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Info size={28} style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                        <p style={{ margin: '0 0 8px 0', fontWeight: 500, color: 'var(--text-primary)' }}>
                          No {activeCategory.label.toLowerCase()} found
                        </p>
                        <p style={{ margin: 0, fontSize: '12px' }}>
                          {recordSearch ? 'Try adjusting your search criteria.' : `Create the first ${activeCategory.singularLabel.toLowerCase()} to get started.`}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    records.map(r => (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: '1px solid var(--border-color, #f1f5f9)',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted, #f8fafc)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Code */}
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              backgroundColor: 'var(--bg-muted, #f1f5f9)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              border: '1px solid var(--border-color, #e2e8f0)'
                            }}
                          >
                            {r[activeCategory.codeField] || r.code || r.name}
                          </span>
                        </td>

                        {/* Name / Title */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {r[activeCategory.nameField] || r.name || r.title}
                          </div>
                          {r.description && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.description}
                            </div>
                          )}
                        </td>

                        {/* Category Specific Data */}
                        {activeCategory.key === 'branches' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {r.city}, {r.state} {r.isHeadquarters ? '★ HQ' : ''}
                          </td>
                        )}

                        {activeCategory.key === 'grades' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            ₹{Number(r.minCtc || 0).toLocaleString()} – ₹{Number(r.maxCtc || 0).toLocaleString()}
                          </td>
                        )}

                        {activeCategory.key === 'salary-components' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 500 }}>{r.type}</span> ({r.calculationMode})
                          </td>
                        )}

                        {activeCategory.key === 'units' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {r.branch?.name || 'All Locations'}
                          </td>
                        )}

                        {activeCategory.key === 'job-positions' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {r.department?.name || 'General'}
                          </td>
                        )}

                        {activeCategory.key === 'loan-types' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            Max ₹{Number(r.maxAmount || 0).toLocaleString()} ({r.interestRatePct}% p.a.)
                          </td>
                        )}

                        {activeCategory.key === 'shift-policies' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {r.startTime} – {r.endTime}
                          </td>
                        )}

                        {activeCategory.key === 'leave-policies' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {r.annualQuota} Days ({r.isPaid ? 'Paid' : 'Unpaid'})
                          </td>
                        )}

                        {/* Status Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: r.active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                              color: r.active !== false ? '#059669' : '#dc2626'
                            }}
                          >
                            {r.active !== false ? <Check size={12} /> : <X size={12} />}
                            {r.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Edit */}
                            {activeCategory.canEdit && (
                              <button
                                onClick={() => handleOpenModal(r)}
                                style={{
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, #e2e8f0)',
                                  backgroundColor: 'transparent',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer'
                                }}
                                title="Edit master record"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}

                            {/* Activate / Deactivate Toggle */}
                            {activeCategory.supportsActiveToggle && (
                              <button
                                onClick={() => handleToggleStatus(r)}
                                style={{
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, #e2e8f0)',
                                  backgroundColor: r.active ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                  color: r.active ? '#dc2626' : '#059669',
                                  cursor: 'pointer'
                                }}
                                title={r.active ? 'Deactivate record' : 'Activate record'}
                              >
                                <Power size={14} />
                              </button>
                            )}

                            {/* Delete Button */}
                            {activeCategory.canDelete && (
                              <button
                                onClick={() => setDeleteConfirmTarget(r)}
                                style={{
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color, #e2e8f0)',
                                  backgroundColor: 'transparent',
                                  color: '#dc2626',
                                  cursor: 'pointer'
                                }}
                                title="Delete record (only if unreferenced)"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Toolbar */}
            {totalRecords > 25 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)'
                }}
              >
                <span>
                  Showing {records.length} of {totalRecords} records
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="btn btn-outline"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                    Page {currentPage} of {Math.ceil(totalRecords / 25)}
                  </span>
                  <button
                    disabled={currentPage >= Math.ceil(totalRecords / 25)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="btn btn-outline"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && activeCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              border: '1px solid var(--border-color, #cbd5e1)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)'
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                {editingRecord ? `Edit ${activeCategory.singularLabel}` : `Add New ${activeCategory.singularLabel}`}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ padding: '24px' }}>
              {modalError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#dc2626',
                    fontSize: '13px',
                    marginBottom: '16px',
                    border: '1px solid #ef4444'
                  }}
                >
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeCategory.fields.map(field => {
                  if (field.readOnly && !editingRecord) return null;

                  return (
                    <div key={field.name}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          value={modalFormData[field.name] || ''}
                          onChange={e => setModalFormData({ ...modalFormData, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            fontSize: '13px',
                            backgroundColor: 'transparent'
                          }}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={modalFormData[field.name] || ''}
                          onChange={e => setModalFormData({ ...modalFormData, [field.name]: e.target.value })}
                          required={field.required}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            fontSize: '13px',
                            backgroundColor: 'transparent'
                          }}
                        >
                          <option value="">Select {field.label}</option>
                          {field.options
                            ? field.options.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))
                            : (parentOptions[field.name] || []).map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                        </select>
                      ) : field.type === 'boolean' ? (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                          <input
                            type="checkbox"
                            checked={!!modalFormData[field.name]}
                            onChange={e => setModalFormData({ ...modalFormData, [field.name]: e.target.checked })}
                          />
                          <span>Enabled / Active</span>
                        </label>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={modalFormData[field.name] ?? ''}
                          onChange={e => setModalFormData({ ...modalFormData, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          required={field.required}
                          disabled={field.readOnly && !!editingRecord}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            fontSize: '13px',
                            backgroundColor: field.readOnly ? 'var(--bg-muted, #f1f5f9)' : 'transparent'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color, #e2e8f0)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-outline"
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {modalSubmitting ? <RefreshCw size={14} className="spin" /> : null}
                  {editingRecord ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {deactivateConfirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626', marginBottom: '14px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Deactivate Master Record?</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Are you sure you want to deactivate <strong>{deactivateConfirmTarget.name || deactivateConfirmTarget.code}</strong>?
              It will be hidden from new dropdown selections throughout the application, but existing employees and records will retain historical integrity.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeactivateConfirmTarget(null)} className="btn btn-outline">
                Cancel
              </button>
              <button
                onClick={() => handleToggleStatus(deactivateConfirmTarget)}
                className="btn btn-danger"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600 }}
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRICT DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626', marginBottom: '14px' }}>
              <Trash2 size={24} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Permanent Deletion</h3>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmTarget.name || deleteConfirmTarget.code}</strong>?
              PAYFLOW enforces strict referential integrity. Deletion is only allowed if no active employee or subordinate record references this item.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeleteConfirmTarget(null)} className="btn btn-outline">
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                className="btn btn-danger"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600 }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
