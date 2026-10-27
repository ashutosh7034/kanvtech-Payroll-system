import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Receipt,
  Plane,
  Check,
  X,
  FileText,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  Clock,
  ArrowUpDown,
  Building,
  User,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Upload,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Calendar,
  Layers,
  DollarSign,
  ArrowLeft
} from 'lucide-react';

interface ExpenseItem {
  id?: string;
  categoryId: string;
  amount: number;
  description?: string;
  receiptUrl?: string;
  category?: {
    id: string;
    name: string;
    code: string;
    maxLimit?: number | null;
  };
}

interface ExpenseClaim {
  id: string;
  claimNumber?: string | null;
  claimType?: 'EXPENSE' | 'REIMBURSEMENT' | string;
  title: string;
  claimDate: string;
  totalAmount: number | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED' | 'PAID';
  approvedBy?: string | null;
  actionedAt?: string | null;
  rejectionReason?: string | null;
  resubmittedAt?: string | null;
  correctionNotes?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    workEmail?: string;
    department?: { name: string; code: string } | null;
    branch?: { name: string; city: string } | null;
  };
  items?: ExpenseItem[];
}

interface EmployeeClaimSummary {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    workEmail?: string;
    department?: { id: string; name: string; code: string } | null;
    designation?: { id: string; name: string } | null;
    branch?: { id: string; name: string; city: string } | null;
  };
  expenseCount: number;
  reimbursementCount: number;
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  correctionRequestedClaims: number;
  paidClaims: number;
  totalClaimedAmount: number;
  paidAmount: number;
  lastSubmissionDate: string;
}

export const ExpensesView: React.FC = () => {
  const { user, hasRole } = useAuth();
  const isApprover = hasRole(['finance_admin', 'company_admin', 'platform_admin', 'department_manager', 'hr_manager', 'payroll_admin']);

  // Mode: 'employee' (Self-Service) vs 'admin_hierarchy' (HR/Admin claim-driven employee list)
  const [viewMode, setViewMode] = useState<'employee' | 'admin_hierarchy'>(isApprover ? 'admin_hierarchy' : 'employee');
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'reimbursement' | 'travel'>('all');

  // Hierarchy Navigation Level for HR/Admin: 'list' -> 'profile' -> 'claim_detail'
  const [hierarchyLevel, setHierarchyLevel] = useState<'list' | 'profile'>('list');
  const [selectedProfileEmployee, setSelectedProfileEmployee] = useState<EmployeeClaimSummary | null>(null);

  // Data States
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employeesWithClaims, setEmployeesWithClaims] = useState<EmployeeClaimSummary[]>([]);
  const [travelRequests, setTravelRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    correctionRequestedCount: 0,
    paidCount: 0,
    expenseCount: 0,
    reimbursementCount: 0,
    totalPendingAmount: 0,
    totalApprovedAmount: 0,
    totalPaidAmount: 0
  });
  const [userContext, setUserContext] = useState<any>(null);

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showReimbursementModal, setShowReimbursementModal] = useState<boolean>(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);

  // Reviewer Action Dialogs
  const [actionClaimId, setActionClaimId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'REJECTED' | 'CORRECTION_REQUESTED' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Single Expense Form State (Screenshot Parity)
  const [singleExpenseCategory, setSingleExpenseCategory] = useState<string>('');
  const [singleExpenseDate, setSingleExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [singleExpenseAmount, setSingleExpenseAmount] = useState<number>(0);
  const [singleExpenseRemarks, setSingleExpenseRemarks] = useState<string>('');
  const [singleExpenseReceiptUrl, setSingleExpenseReceiptUrl] = useState<string>('');
  const [singleExpenseReceiptName, setSingleExpenseReceiptName] = useState<string>('');
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState<boolean>(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState<string | null>(null);

  // Reimbursement Form State (Multi-Item Voucher)
  const [reimTitle, setReimTitle] = useState<string>('');
  const [reimDate, setReimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reimItems, setReimItems] = useState<Array<{ categoryId: string; amount: number; description: string; receiptUrl: string; receiptName?: string }>>([
    { categoryId: '', amount: 1500, description: '', receiptUrl: '' }
  ]);
  const [reimSubmitting, setReimSubmitting] = useState<boolean>(false);
  const [reimError, setReimError] = useState<string | null>(null);
  const [reimSuccessMsg, setReimSuccessMsg] = useState<string | null>(null);

  // Correction Resubmission Form State
  const [correctingClaim, setCorrectingClaim] = useState<ExpenseClaim | null>(null);
  const [correctingTitle, setCorrectingTitle] = useState<string>('');
  const [correctingDate, setCorrectingDate] = useState<string>('');
  const [correctingNotes, setCorrectingNotes] = useState<string>('');
  const [correctingItems, setCorrectingItems] = useState<Array<{ categoryId: string; amount: number; description: string; receiptUrl: string }>>([]);
  const [correctingSubmitting, setCorrectingSubmitting] = useState<boolean>(false);
  const [correctingError, setCorrectingError] = useState<string | null>(null);

  // Travel Modal State
  const [showTravelModal, setShowTravelModal] = useState<boolean>(false);
  const [travelPurpose, setTravelPurpose] = useState<string>('');
  const [travelDestination, setTravelDestination] = useState<string>('');
  const [travelFrom, setTravelFrom] = useState<string>('');
  const [travelTo, setTravelTo] = useState<string>('');
  const [travelBudget, setTravelBudget] = useState<number>(15000);
  const [travelAdvance, setTravelAdvance] = useState<number>(5000);

  useEffect(() => {
    loadData();
  }, [page, statusFilter, sortBy, sortOrder, activeTab, viewMode, hierarchyLevel]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const claimTypeParam = activeTab === 'expense' ? 'EXPENSE' : activeTab === 'reimbursement' ? 'REIMBURSEMENT' : 'ALL';
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: search.trim(),
        status: statusFilter,
        claimType: claimTypeParam,
        sortBy,
        sortOrder
      });

      if (hierarchyLevel === 'profile' && selectedProfileEmployee) {
        queryParams.set('employeeId', selectedProfileEmployee.employee.id);
      }

      const promises: Promise<any>[] = [
        api.get('/expenses/categories').catch(() => ({ categories: [] })),
        api.get(`/expenses/claims?${queryParams.toString()}`).catch(() => ({ claims: [], pagination: { totalPages: 1, total: 0 } })),
        api.get('/expenses/travel').catch(() => ({ requests: [] }))
      ];

      if (isApprover) {
        promises.push(api.get('/expenses/employees-with-claims').catch(() => ({ employees: [] })));
      }

      const results = await Promise.all(promises);
      const catRes = results[0];
      const claimRes = results[1];
      const travelRes = results[2];
      const empRes = results[3];

      setCategories(catRes.categories || []);
      setClaims(claimRes.claims || []);
      setTotalPages(claimRes.pagination?.totalPages || 1);
      setTotalRecords(claimRes.pagination?.total || 0);
      if (claimRes.metrics) setMetrics(claimRes.metrics);
      if (claimRes.userContext) setUserContext(claimRes.userContext);
      setTravelRequests(travelRes.requests || []);
      if (empRes && empRes.employees) {
        setEmployeesWithClaims(empRes.employees);
      }

      // Default single expense category if not set
      if (catRes.categories?.length > 0 && !singleExpenseCategory) {
        setSingleExpenseCategory(catRes.categories[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Secure Receipt Document Upload Handler
  const handleReceiptUpload = async (file: File, target: 'single' | 'reim', itemIdx = 0) => {
    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const uploadRes: any = await api.post('/expenses/upload-receipt', {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data
          });

          if (target === 'single') {
            setSingleExpenseReceiptUrl(uploadRes.url);
            setSingleExpenseReceiptName(uploadRes.filename);
          } else {
            const nextItems = [...reimItems];
            nextItems[itemIdx].receiptUrl = uploadRes.url;
            nextItems[itemIdx].receiptName = uploadRes.filename;
            setReimItems(nextItems);
          }
        } catch (err: any) {
          alert(err.message || 'Failed to upload receipt');
        } finally {
          setUploadingReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert('Error reading file: ' + err.message);
      setUploadingReceipt(false);
    }
  };

  // Submit Single Expense Claim (Screenshot Parity)
  const handleSubmitSingleExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSuccessMsg(null);

    if (!singleExpenseCategory) {
      setExpenseError('Please select an Expense Type category.');
      return;
    }
    if (singleExpenseAmount <= 0) {
      setExpenseError('Actual Expense Amount must be greater than zero.');
      return;
    }

    const catObj = categories.find(c => c.id === singleExpenseCategory);
    const catName = catObj ? catObj.name : 'Business Expense';
    const title = `${catName} - ${singleExpenseDate}`;

    setExpenseSubmitting(true);
    try {
      const payload = {
        claimType: 'EXPENSE',
        title,
        claimDate: singleExpenseDate,
        items: [
          {
            categoryId: singleExpenseCategory,
            amount: Number(singleExpenseAmount),
            description: singleExpenseRemarks.trim() || `${catName} incurred on ${singleExpenseDate}`,
            receiptUrl: singleExpenseReceiptUrl || null
          }
        ]
      };

      const res: any = await api.post('/expenses/claims', payload);
      setExpenseSuccessMsg(`Success! Expense claim ${res.claim?.claimNumber || ''} registered successfully.`);
      setTimeout(() => {
        setShowExpenseModal(false);
        setExpenseSuccessMsg(null);
        setSingleExpenseAmount(0);
        setSingleExpenseRemarks('');
        setSingleExpenseReceiptUrl('');
        setSingleExpenseReceiptName('');
        loadData(true);
      }, 1500);
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to submit expense claim');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Submit Multi-Item Reimbursement Voucher
  const handleSubmitReimbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    setReimError(null);
    setReimSuccessMsg(null);

    if (!reimTitle.trim()) {
      setReimError('Please enter a claim title.');
      return;
    }
    for (let i = 0; i < reimItems.length; i++) {
      if (!reimItems[i].categoryId) {
        setReimError(`Item #${i + 1} requires an expense category.`);
        return;
      }
      if (reimItems[i].amount <= 0) {
        setReimError(`Item #${i + 1} amount must be greater than zero.`);
        return;
      }
    }

    setReimSubmitting(true);
    try {
      const payload = {
        claimType: 'REIMBURSEMENT',
        title: reimTitle.trim(),
        claimDate: reimDate,
        items: reimItems.map(item => ({
          categoryId: item.categoryId,
          amount: Number(item.amount),
          description: item.description?.trim() || null,
          receiptUrl: item.receiptUrl?.trim() || null
        }))
      };

      const res: any = await api.post('/expenses/claims', payload);
      setReimSuccessMsg(`Success! Reimbursement voucher ${res.claim?.claimNumber || ''} submitted successfully.`);
      setTimeout(() => {
        setShowReimbursementModal(false);
        setReimSuccessMsg(null);
        setReimTitle('');
        setReimItems([{ categoryId: categories[0]?.id || '', amount: 1000, description: '', receiptUrl: '' }]);
        loadData(true);
      }, 1500);
    } catch (err: any) {
      setReimError(err.message || 'Failed to submit reimbursement voucher');
    } finally {
      setReimSubmitting(false);
    }
  };

  // Open Claim Correction Dialog
  const handleOpenCorrection = (claim: ExpenseClaim) => {
    setCorrectingClaim(claim);
    const safeClaimDate = claim.claimDate && !isNaN(new Date(claim.claimDate).getTime())
      ? new Date(claim.claimDate).toISOString().split('T')[0]
      : '';
    setCorrectingDate(safeClaimDate);
    setCorrectingNotes(claim.correctionNotes || '');
    setCorrectingItems(
      (claim.items || []).map(i => ({
        categoryId: i.categoryId,
        amount: Number(i.amount),
        description: i.description || '',
        receiptUrl: i.receiptUrl || ''
      }))
    );
    setCorrectingError(null);
    setShowCorrectionModal(true);
  };

  // Resubmit Corrected Claim
  const handleResubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingClaim) return;
    setCorrectingError(null);

    setCorrectingSubmitting(true);
    try {
      const payload = {
        title: correctingTitle.trim(),
        claimDate: correctingDate,
        correctionNotes: correctingNotes.trim(),
        items: correctingItems.map(item => ({
          categoryId: item.categoryId,
          amount: Number(item.amount),
          description: item.description?.trim() || null,
          receiptUrl: item.receiptUrl?.trim() || null
        }))
      };

      await api.put(`/expenses/claims/${correctingClaim.id}/resubmit`, payload);
      setShowCorrectionModal(false);
      setCorrectingClaim(null);
      loadData(true);
    } catch (err: any) {
      setCorrectingError(err.message || 'Failed to resubmit corrected claim');
    } finally {
      setCorrectingSubmitting(false);
    }
  };

  // Reviewer Action Handler (Approve / Reject / Request Corrections / Paid)
  const handleActionConfirm = async () => {
    if (!actionClaimId || !actionType) return;
    if (!actionReason.trim()) {
      setActionError(`Please enter a justification or reason for ${actionType === 'REJECTED' ? 'rejection' : 'requesting corrections'}.`);
      return;
    }

    try {
      await api.post(`/expenses/claims/${actionClaimId}/action`, {
        status: actionType,
        reason: actionReason.trim()
      });
      setActionClaimId(null);
      setActionType(null);
      setActionReason('');
      setActionError(null);
      loadData(true);
      if (selectedClaim?.id === actionClaimId) {
        setShowDetailModal(false);
        setSelectedClaim(null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to process reviewer action');
    }
  };

  const handleQuickApprove = async (claimId: string) => {
    if (!confirm('Are you sure you want to approve this expense claim?')) return;
    try {
      await api.post(`/expenses/claims/${claimId}/action`, { status: 'APPROVED' });
      loadData(true);
      if (selectedClaim?.id === claimId) {
        setShowDetailModal(false);
        setSelectedClaim(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve claim');
    }
  };

  const handleMarkPaid = async (claimId: string) => {
    if (!confirm('Confirm that this claim has been disbursed/paid to the employee?')) return;
    try {
      await api.post(`/expenses/claims/${claimId}/action`, { status: 'PAID' });
      loadData(true);
      if (selectedClaim?.id === claimId) {
        setShowDetailModal(false);
        setSelectedClaim(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const selectedCategoryObj = categories.find(c => c.id === singleExpenseCategory);

  const renderClaimsTable = () => (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="CORRECTION_REQUESTED">Correction Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAID">Recorded as Paid</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-xs" onClick={() => loadData(true)}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="table-container" style={{ border: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Claim Ref</th>
              <th>Type</th>
              <th>Title & Description</th>
              <th>Claim Date</th>
              <th>Items</th>
              <th className="money">Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Receipt size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <div>No expense or reimbursement claims found matching criteria.</div>
                </td>
              </tr>
            ) : (
              claims.map(claim => (
                <tr key={claim.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem' }}>
                    {claim.claimNumber || `EXP-${(claim.id || '').slice(0, 8).toUpperCase()}`}
                  </td>
                  <td>
                    <span
                      className={`badge ${claim.claimType === 'REIMBURSEMENT' ? 'badge-brand' : 'badge-gray'}`}
                      style={{ fontSize: '0.68rem' }}
                    >
                      {claim.claimType === 'REIMBURSEMENT' ? 'Reimbursement' : 'Expense'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{claim.title}</div>
                    {claim.employee && isApprover && viewMode === 'admin_hierarchy' && !selectedProfileEmployee && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        By: {claim.employee.firstName} {claim.employee.lastName} ({claim.employee.employeeCode})
                      </div>
                    )}
                    {claim.status === 'CORRECTION_REQUESTED' && claim.rejectionReason && (
                      <div style={{ fontSize: '0.725rem', color: '#b45309', marginTop: '2px' }}>
                        <strong>Correction Note:</strong> {claim.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {claim.claimDate && !isNaN(new Date(claim.claimDate).getTime())
                      ? new Date(claim.claimDate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {claim.items?.length || 1} line item{(claim.items?.length || 1) > 1 ? 's' : ''}
                  </td>
                  <td className="money" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    ₹{Number(claim.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    {claim.status === 'PENDING' && <span className="badge badge-warning">Pending Review</span>}
                    {claim.status === 'CORRECTION_REQUESTED' && <span className="badge badge-brand">Correction Requested</span>}
                    {claim.status === 'APPROVED' && <span className="badge badge-success">Approved</span>}
                    {claim.status === 'REJECTED' && <span className="badge badge-danger">Rejected</span>}
                    {claim.status === 'PAID' && <span className="badge badge-brand">Paid</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => {
                          setSelectedClaim(claim);
                          setShowDetailModal(true);
                        }}
                        title="View details"
                      >
                        <Eye size={13} /> View
                      </button>

                      {/* Correction Action for Claimant */}
                      {claim.status === 'CORRECTION_REQUESTED' && (
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => handleOpenCorrection(claim)}
                          style={{ background: '#0284c7' }}
                        >
                          <Edit3 size={13} /> Edit & Resubmit
                        </button>
                      )}

                      {/* Approver Actions */}
                      {isApprover && claim.status === 'PENDING' && (
                        <>
                          <button
                            className="btn btn-xs"
                            onClick={() => handleQuickApprove(claim.id)}
                            style={{ background: '#10b981', color: '#fff' }}
                            title="Approve claim"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => {
                              setActionClaimId(claim.id);
                              setActionType('CORRECTION_REQUESTED');
                              setActionReason('');
                              setActionError(null);
                            }}
                            title="Request corrections"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            className="btn btn-xs btn-outline"
                            onClick={() => {
                              setActionClaimId(claim.id);
                              setActionType('REJECTED');
                              setActionReason('');
                              setActionError(null);
                            }}
                            style={{ color: '#ef4444' }}
                            title="Reject claim"
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}

                      {isApprover && claim.status === 'APPROVED' && (
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => handleMarkPaid(claim.id)}
                          title="Mark as Paid"
                        >
                          Mark Paid
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
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner & Header */}
      <div
        style={{
          background: '#ffffff',
          padding: '18px 24px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Expenses & Reimbursements Studio
            </h2>
            <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Corporate Portal</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '4px 0 0' }}>
            Itemized receipt submission, budget verification, multi-item reimbursement vouchers, and hierarchical HR reviews.
          </p>
        </div>

        {/* Distinct Action Buttons for Employee Submission */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              setSingleExpenseAmount(0);
              setSingleExpenseRemarks('');
              setSingleExpenseReceiptUrl('');
              setSingleExpenseReceiptName('');
              setExpenseError(null);
              setExpenseSuccessMsg(null);
              setShowExpenseModal(true);
            }}
            title="Fast-track submission for a single out-of-pocket expense"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Submit Expense
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setReimTitle('');
              setReimItems([{ categoryId: categories[0]?.id || '', amount: 1500, description: '', receiptUrl: '' }]);
              setReimError(null);
              setReimSuccessMsg(null);
              setShowReimbursementModal(true);
            }}
            title="Consolidated voucher for multiple itemized receipts and expenses"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Receipt size={14} /> Create Reimbursement Voucher
          </button>
        </div>
      </div>

      {/* Role / View Mode Switcher for Reviewers */}
      {isApprover && (
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
          <button
            className={`btn btn-xs ${viewMode === 'admin_hierarchy' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setViewMode('admin_hierarchy');
              setHierarchyLevel('list');
              setSelectedProfileEmployee(null);
            }}
          >
            <Users size={13} /> HR/Admin Hierarchical Review ({employeesWithClaims.length} Employees)
          </button>
          <button
            className={`btn btn-xs ${viewMode === 'employee' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('employee')}
          >
            <User size={13} /> My Personal Claims & Expenses
          </button>
        </div>
      )}

      {/* Unified Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="panel" style={{ padding: '14px', margin: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Claims</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>{metrics.totalCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {metrics.expenseCount} Expenses • {metrics.reimbursementCount} Reimbursements
          </div>
        </div>

        <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Pending Review</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>{metrics.pendingCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ₹{Number(metrics.totalPendingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600 }}>Correction Requested</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>{metrics.correctionRequestedCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Awaiting claimant resubmission</div>
        </div>

        <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Approved Claims</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#047857', marginTop: '4px' }}>{metrics.approvedCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ₹{Number(metrics.totalApprovedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="panel" style={{ padding: '14px', margin: 0, borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>Recorded as Paid</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0369a1', marginTop: '4px' }}>{metrics.paidCount}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ₹{Number(metrics.totalPaidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: HR/ADMIN HIERARCHICAL MANAGEMENT (Part 3)                         */}
      {/* ========================================================================= */}
      {isApprover && viewMode === 'admin_hierarchy' && (
        <div>
          {hierarchyLevel === 'list' ? (
            /* STEP 1: Claim-Driven Employee List (ONLY employees with claims) */
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Employees with Active Expense / Reimbursement Claims</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Displaying only employees who have submitted claims within your authorized tenant/department scope.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search employee..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: '30px', fontSize: '0.8rem', width: '220px' }}
                    />
                  </div>
                  <button className="btn btn-outline btn-xs" onClick={() => loadData(true)}>
                    <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th style={{ textAlign: 'center' }}>Expenses</th>
                      <th style={{ textAlign: 'center' }}>Reimbursements</th>
                      <th style={{ textAlign: 'center' }}>Pending</th>
                      <th style={{ textAlign: 'center' }}>Approved</th>
                      <th className="money">Total Claimed</th>
                      <th>Last Submission</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesWithClaims.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          <Receipt size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                          <div>No employees have submitted expense claims in this company.</div>
                        </td>
                      </tr>
                    ) : (
                      employeesWithClaims.map(item => (
                        <tr key={item.employee.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.employee.firstName} {item.employee.lastName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {item.employee.employeeCode}
                            </div>
                          </td>
                          <td>{item.employee.department?.name || 'General'}</td>
                          <td>{item.employee.designation?.name || 'Staff'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>{item.expenseCount}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-brand" style={{ fontSize: '0.75rem' }}>{item.reimbursementCount}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.pendingClaims > 0 ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{item.pendingClaims}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{item.approvedClaims}</span>
                          </td>
                          <td className="money" style={{ fontWeight: 600 }}>
                            ₹{Number(item.totalClaimedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>
                            {new Date(item.lastSubmissionDate).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => {
                                setSelectedProfileEmployee(item);
                                setHierarchyLevel('profile');
                              }}
                            >
                              <Eye size={13} /> View Claims Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* STEP 2: Employee Expense Profile & Claim History */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => {
                      setHierarchyLevel('list');
                      setSelectedProfileEmployee(null);
                    }}
                    style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowLeft size={13} /> Back to Employee List
                  </button>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                    {selectedProfileEmployee?.employee.firstName} {selectedProfileEmployee?.employee.lastName}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '8px' }}>
                      ({selectedProfileEmployee?.employee.employeeCode})
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedProfileEmployee?.employee.department?.name} • {selectedProfileEmployee?.employee.designation?.name} • {selectedProfileEmployee?.employee.workEmail}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Incurred</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                      ₹{Number(selectedProfileEmployee?.totalClaimedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Claims Table for Selected Employee */}
              {renderClaimsTable()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: EMPLOYEE SELF-SERVICE / PERSONAL VIEW                            */}
      {/* ========================================================================= */}
      {(!isApprover || viewMode === 'employee') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Sub-Tabs: All / Expenses / Reimbursements / Travel */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('all')}
            >
              All Claims ({metrics.totalCount})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'expense' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('expense')}
            >
              <FileText size={14} /> My Expenses ({metrics.expenseCount})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'reimbursement' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('reimbursement')}
            >
              <Receipt size={14} /> My Reimbursements ({metrics.reimbursementCount})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'travel' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('travel')}
            >
              <Plane size={14} /> Travel Requisitions ({travelRequests.length})
            </button>
          </div>

          {activeTab === 'travel' ? renderTravelSection() : renderClaimsTable()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SUBMIT SINGLE EXPENSE (Screenshot Parity)                       */}
      {/* ========================================================================= */}

      {/* ========================================================================= */}
      {/* MODAL 1: SUBMIT SINGLE EXPENSE (Screenshot Parity)                       */}
      {/* ========================================================================= */}
      {showExpenseModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowExpenseModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Submit Expense (Single Item)</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Fast-track submission for an individual out-of-pocket business expense receipt.
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowExpenseModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitSingleExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {expenseError && (
                  <div className="alert alert-danger" style={{ fontSize: '0.825rem' }}>
                    <AlertCircle size={15} /> {expenseError}
                  </div>
                )}
                {expenseSuccessMsg && (
                  <div className="alert alert-success" style={{ fontSize: '0.825rem' }}>
                    <CheckCircle2 size={15} /> {expenseSuccessMsg}
                  </div>
                )}

                {/* Employee Display */}
                <div className="form-group">
                  <label className="form-label">Employee</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userContext?.employeeName ? `${userContext.employeeName} (${userContext.employeeCode || ''})` : user?.fullName || 'Authenticated Employee'}
                    readOnly
                    style={{ background: '#f8fafc', color: 'var(--text-muted)' }}
                  />
                </div>

                {/* Expense Type (Searchable Dropdown) */}
                <div className="form-group">
                  <label className="form-label">Expense Type *</label>
                  <select
                    className="form-control"
                    value={singleExpenseCategory}
                    onChange={e => setSingleExpenseCategory(e.target.value)}
                    required
                  >
                    <option value="">Select Expense Type...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.maxLimit ? `(Budget Limit: ₹${Number(cat.maxLimit).toLocaleString('en-IN')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expense Date */}
                <div className="form-group">
                  <label className="form-label">Expense Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={singleExpenseDate}
                    onChange={e => setSingleExpenseDate(e.target.value)}
                    required
                  />
                </div>

                {/* Budget Amount (Read-Only Rate / Limit Display) */}
                <div className="form-group">
                  <label className="form-label">Budget Amount</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedCategoryObj?.maxLimit ? `₹${Number(selectedCategoryObj.maxLimit).toLocaleString('en-IN')}` : 'No ceiling limit configured'}
                    readOnly
                    style={{ background: '#f8fafc', color: 'var(--text-muted)' }}
                  />
                </div>

                {/* Actual Expense Amount */}
                <div className="form-group">
                  <label className="form-label">Actual Expense Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="form-control"
                    placeholder="Enter amount (e.g. 1250.00)"
                    value={singleExpenseAmount || ''}
                    onChange={e => setSingleExpenseAmount(Number(e.target.value))}
                    required
                  />
                </div>

                {/* Remarks */}
                <div className="form-group">
                  <label className="form-label">Remarks / Business Purpose</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Enter explanation or business purpose (optional)"
                    value={singleExpenseRemarks}
                    onChange={e => setSingleExpenseRemarks(e.target.value)}
                  />
                </div>

                {/* Bill / Receipt Upload Control */}
                <div className="form-group">
                  <label className="form-label">Bill / Receipt (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      id="single-receipt-file"
                      style={{ display: 'none' }}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleReceiptUpload(e.target.files[0], 'single');
                        }
                      }}
                    />
                    <label htmlFor="single-receipt-file" className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                      <Upload size={14} /> {uploadingReceipt ? 'Uploading...' : 'Choose File'}
                    </label>
                    <span style={{ fontSize: '0.8rem', color: singleExpenseReceiptUrl ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {singleExpenseReceiptName || (singleExpenseReceiptUrl ? 'Receipt attached' : 'No file chosen (PDF, JPEG, PNG, WEBP max 5MB)')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowExpenseModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={expenseSubmitting || uploadingReceipt}>
                  {expenseSubmitting ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SUBMIT MULTI-ITEM REIMBURSEMENT VOUCHER                         */}
      {/* ========================================================================= */}
      {showReimbursementModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowReimbursementModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Create Reimbursement Voucher</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Add multiple itemized expense receipts for consolidated corporate reimbursement.
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowReimbursementModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitReimbursement}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reimError && (
                  <div className="alert alert-danger" style={{ fontSize: '0.825rem' }}>
                    <AlertCircle size={15} /> {reimError}
                  </div>
                )}
                {reimSuccessMsg && (
                  <div className="alert alert-success" style={{ fontSize: '0.825rem' }}>
                    <CheckCircle2 size={15} /> {reimSuccessMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Claim Title / Reference *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Q4 Client Hospitality & Travel"
                      value={reimTitle}
                      onChange={e => setReimTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Claim Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={reimDate}
                      onChange={e => setReimDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Itemized Expense Lines</label>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setReimItems([...reimItems, { categoryId: categories[0]?.id || '', amount: 500, description: '', receiptUrl: '' }])}
                    >
                      <Plus size={12} /> Add Line Item
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {reimItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          display: 'grid',
                          gridTemplateColumns: '180px 120px 1fr 120px 32px',
                          gap: '8px',
                          alignItems: 'center'
                        }}
                      >
                        <select
                          className="form-control"
                          value={item.categoryId}
                          onChange={e => {
                            const next = [...reimItems];
                            next[idx].categoryId = e.target.value;
                            setReimItems(next);
                          }}
                          required
                          style={{ fontSize: '0.8rem' }}
                        >
                          <option value="">Category...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          step="any"
                          className="form-control"
                          placeholder="Amount"
                          value={item.amount || ''}
                          onChange={e => {
                            const next = [...reimItems];
                            next[idx].amount = Number(e.target.value);
                            setReimItems(next);
                          }}
                          required
                          style={{ fontSize: '0.8rem' }}
                        />

                        <input
                          type="text"
                          className="form-control"
                          placeholder="Description / Remarks"
                          value={item.description}
                          onChange={e => {
                            const next = [...reimItems];
                            next[idx].description = e.target.value;
                            setReimItems(next);
                          }}
                          style={{ fontSize: '0.8rem' }}
                        />

                        <div>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            id={`reim-file-${idx}`}
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                handleReceiptUpload(e.target.files[0], 'reim', idx);
                              }
                            }}
                          />
                          <label
                            htmlFor={`reim-file-${idx}`}
                            className="btn btn-outline btn-xs"
                            style={{ width: '100%', textAlign: 'center', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            <Upload size={11} /> {item.receiptUrl ? 'Attached' : 'Receipt'}
                          </label>
                        </div>

                        {reimItems.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-xs"
                            onClick={() => setReimItems(reimItems.filter((_, i) => i !== idx))}
                            style={{ color: '#ef4444', padding: '4px' }}
                          >
                            <X size={14} />
                          </button>
                        ) : <div />}
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.9rem', fontWeight: 700 }}>
                    Calculated Total: ₹{reimItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowReimbursementModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={reimSubmitting}>
                  {reimSubmitting ? 'Creating Voucher...' : 'Create Reimbursement Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CLAIM CORRECTION & RESUBMISSION (Part 4)                         */}
      {/* ========================================================================= */}
      {showCorrectionModal && correctingClaim && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowCorrectionModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Revise & Resubmit Claim: {correctingClaim.claimNumber || correctingClaim.title}
                </h3>
                <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Make necessary corrections requested by the reviewer and resubmit.
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowCorrectionModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResubmitCorrection}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {correctingError && (
                  <div className="alert alert-danger" style={{ fontSize: '0.825rem' }}>
                    <AlertCircle size={15} /> {correctingError}
                  </div>
                )}

                {/* Reviewer Note Banner */}
                {correctingClaim.rejectionReason && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid #f59e0b',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      fontSize: '0.825rem',
                      color: '#92400e'
                    }}
                  >
                    <strong>Reviewer's Requested Correction:</strong> {correctingClaim.rejectionReason}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Claim Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={correctingTitle}
                      onChange={e => setCorrectingTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Claim Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={correctingDate}
                      onChange={e => setCorrectingDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Correction Notes / Response to Reviewer</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Describe the adjustments you have made..."
                    value={correctingNotes}
                    onChange={e => setCorrectingNotes(e.target.value)}
                  />
                </div>

                {/* Items */}
                <div>
                  <label className="form-label">Adjust Line Items</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {correctingItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          display: 'grid',
                          gridTemplateColumns: '180px 120px 1fr 32px',
                          gap: '8px',
                          alignItems: 'center'
                        }}
                      >
                        <select
                          className="form-control"
                          value={item.categoryId}
                          onChange={e => {
                            const next = [...correctingItems];
                            next[idx].categoryId = e.target.value;
                            setCorrectingItems(next);
                          }}
                          required
                          style={{ fontSize: '0.8rem' }}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          step="any"
                          className="form-control"
                          value={item.amount || ''}
                          onChange={e => {
                            const next = [...correctingItems];
                            next[idx].amount = Number(e.target.value);
                            setCorrectingItems(next);
                          }}
                          required
                          style={{ fontSize: '0.8rem' }}
                        />

                        <input
                          type="text"
                          className="form-control"
                          placeholder="Description"
                          value={item.description}
                          onChange={e => {
                            const next = [...correctingItems];
                            next[idx].description = e.target.value;
                            setCorrectingItems(next);
                          }}
                          style={{ fontSize: '0.8rem' }}
                        />

                        {correctingItems.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-xs"
                            onClick={() => setCorrectingItems(correctingItems.filter((_, i) => i !== idx))}
                            style={{ color: '#ef4444' }}
                          >
                            <X size={14} />
                          </button>
                        ) : <div />}
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.9rem', fontWeight: 700 }}>
                    Revised Total: ₹{correctingItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCorrectionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={correctingSubmitting}>
                  {correctingSubmitting ? 'Resubmitting...' : 'Resubmit Revised Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INDIVIDUAL CLAIM DETAILS VIEW                                    */}
      {/* ========================================================================= */}
      {showDetailModal && selectedClaim && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  Claim Details: {selectedClaim.claimNumber || selectedClaim.title}
                </h3>
                <span
                  className={`badge ${
                    selectedClaim.status === 'APPROVED'
                      ? 'badge-success'
                      : selectedClaim.status === 'CORRECTION_REQUESTED'
                      ? 'badge-brand'
                      : selectedClaim.status === 'REJECTED'
                      ? 'badge-danger'
                      : 'badge-warning'
                  }`}
                  style={{ marginTop: '4px' }}
                >
                  {selectedClaim.status.replace('_', ' ')}
                </span>
              </div>
              <button className="btn-close" onClick={() => setShowDetailModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Claimant:</span>{' '}
                  <strong>{selectedClaim.employee?.firstName} {selectedClaim.employee?.lastName} ({selectedClaim.employee?.employeeCode})</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Department:</span>{' '}
                  <strong>{selectedClaim.employee?.department?.name || 'General'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Claim Date:</span>{' '}
                  <strong>{new Date(selectedClaim.claimDate).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Submitted:</span>{' '}
                  <strong>{new Date(selectedClaim.createdAt).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Claim Type:</span>{' '}
                  <strong>{selectedClaim.claimType || 'EXPENSE'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>{' '}
                  <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                    ₹{Number(selectedClaim.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {selectedClaim.rejectionReason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.825rem', color: '#991b1b' }}>
                  <strong>{selectedClaim.status === 'CORRECTION_REQUESTED' ? 'Correction Note' : 'Rejection Reason'}:</strong> {selectedClaim.rejectionReason}
                </div>
              )}

              {selectedClaim.correctionNotes && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.825rem', color: '#166534' }}>
                  <strong>Claimant Resubmission Note:</strong> {selectedClaim.correctionNotes}
                </div>
              )}

              {/* Items Table */}
              <div>
                <strong style={{ fontSize: '0.85rem' }}>Line Items & Receipts</strong>
                <table className="data-table" style={{ marginTop: '6px' }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th className="money">Amount</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedClaim.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.category?.name || 'Expense'}</td>
                        <td>{item.description || '—'}</td>
                        <td className="money">₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>
                          {item.receiptUrl ? (
                            <a
                              href={item.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--primary)', fontSize: '0.75rem', textDecoration: 'underline' }}
                            >
                              View Attachment
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No receipt</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
              {isApprover && selectedClaim.status === 'PENDING' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleQuickApprove(selectedClaim.id)}
                  style={{ background: '#10b981' }}
                >
                  <Check size={14} /> Approve Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REVIEWER ACTION DIALOG (REJECT OR CORRECTION REQUESTED)          */}
      {/* ========================================================================= */}
      {actionClaimId && actionType && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { setActionClaimId(null); setActionType(null); } }}>
          <div className="modal-dialog" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {actionType === 'REJECTED' ? 'Reject Expense Claim' : 'Request Corrections from Claimant'}
              </h3>
              <button className="btn-close" onClick={() => { setActionClaimId(null); setActionType(null); }}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {actionError && (
                <div className="alert alert-danger" style={{ fontSize: '0.825rem' }}>
                  <AlertCircle size={15} /> {actionError}
                </div>
              )}
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                {actionType === 'REJECTED'
                  ? 'Please provide a clear justification for rejecting this claim. The employee will be notified.'
                  : 'Specify what details, rates, or receipts the claimant needs to update before the claim can be approved.'}
              </p>
              <div className="form-group">
                <label className="form-label">
                  {actionType === 'REJECTED' ? 'Rejection Reason *' : 'Required Corrections / Feedback *'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Enter detailed instructions for the employee..."
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setActionClaimId(null); setActionType(null); }}>
                Cancel
              </button>
              <button
                className={`btn ${actionType === 'REJECTED' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleActionConfirm}
              >
                {actionType === 'REJECTED' ? 'Confirm Rejection' : 'Send Correction Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderTravelSection() {
    return (
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Travel Desk Advance Requisitions</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Corporate travel itineraries, budget approvals, and per-diem advances</div>
          </div>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Destination</th>
                <th>Purpose</th>
                <th>Dates</th>
                <th className="money">Budget</th>
                <th className="money">Advance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {travelRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No travel desk requisitions found.
                  </td>
                </tr>
              ) : (
                travelRequests.map(tr => (
                  <tr key={tr.id}>
                    <td style={{ fontWeight: 600 }}>{tr.destination}</td>
                    <td>{tr.purpose}</td>
                    <td>{new Date(tr.fromDate).toLocaleDateString()} - {new Date(tr.toDate).toLocaleDateString()}</td>
                    <td className="money">₹{Number(tr.estimatedBudget).toLocaleString('en-IN')}</td>
                    <td className="money">₹{Number(tr.advanceAmount).toLocaleString('en-IN')}</td>
                    <td><span className="badge badge-warning">{tr.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
};