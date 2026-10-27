import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import {
  CalendarCheck,
  Calendar,
  Clock,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Info,
  RotateCcw,
  Eye,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export const MyLeaveView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'apply' | 'applications' | 'calendar'>('overview');

  const [balances, setBalances] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Apply Form State
  const [leavePolicyId, setLeavePolicyId] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [durationType, setDurationType] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [computedWorkingDays, setComputedWorkingDays] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Detail Modal State
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const currentYear = new Date().getFullYear();

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [balRes, polRes, reqRes]: any = await Promise.all([
        api.get('/leave/balances'),
        api.get('/leave/policies'),
        api.get('/leave/applications')
      ]);

      const loadedBalances = balRes.balances || [];
      const loadedPolicies = polRes.policies || [];
      const loadedRequests = reqRes.applications || reqRes.requests || [];

      setBalances(loadedBalances);
      setPolicies(loadedPolicies);
      setApplications(loadedRequests);

      if (loadedPolicies.length > 0 && !leavePolicyId) {
        setLeavePolicyId(loadedPolicies[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  // Selected policy details
  const selectedPolicy = useMemo(() => {
    return policies.find(p => p.id === leavePolicyId) || null;
  }, [policies, leavePolicyId]);

  // Selected policy balance
  const selectedBalance = useMemo(() => {
    return balances.find(b => b.leavePolicyId === leavePolicyId) || null;
  }, [balances, leavePolicyId]);

  // Recalculate working days when dates or duration changes
  useEffect(() => {
    const calcWorkingDays = async () => {
      if (!fromDate || !toDate) return;
      try {
        const res: any = await api.post('/leave/calculate-days', {
          fromDate,
          toDate,
          durationType
        });
        setComputedWorkingDays(res.workingDays);
      } catch {
        // Fallback calculation
        if (durationType === 'FIRST_HALF' || durationType === 'SECOND_HALF') {
          setComputedWorkingDays(0.5);
          return;
        }
        const f = new Date(fromDate);
        const t = new Date(toDate);
        if (t < f) {
          setComputedWorkingDays(0);
          return;
        }
        let days = 0;
        const cur = new Date(f);
        while (cur <= t) {
          const d = cur.getDay();
          if (d !== 0 && d !== 6) days++;
          cur.setDate(cur.getDate() + 1);
        }
        setComputedWorkingDays(days === 0 ? 0.5 : days);
      }
    };
    calcWorkingDays();
  }, [fromDate, toDate, durationType]);

  // Handle Submit or Draft
  const handleApply = async (isDraft: boolean) => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    try {
      const payload = {
        leavePolicyId,
        fromDate,
        toDate,
        durationType,
        halfDayPeriod: durationType !== 'FULL_DAY' ? halfDayPeriod : undefined,
        totalDays: computedWorkingDays,
        reason,
        attachmentUrl: attachmentUrl || undefined,
        isDraft
      };

      const res: any = await api.post('/leave/apply', payload);
      setFormSuccess(
        isDraft
          ? 'Leave application saved as draft.'
          : `Leave application (${res.leaveRequest?.applicationNumber || 'submitted'}) successfully submitted for approval!`
      );
      setReason('');
      setAttachmentUrl('');
      setRefreshKey(prev => prev + 1);

      // Auto switch to applications tab after short delay
      setTimeout(() => {
        setActiveTab('applications');
        setFormSuccess(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel / Withdraw
  const handleCancelApplication = async (appId: string) => {
    if (!window.confirm('Are you sure you want to withdraw/cancel this leave application?')) return;
    try {
      await api.post(`/leave/applications/${appId}/withdraw`, {
        reason: 'Withdrawn by employee'
      });
      setRefreshKey(prev => prev + 1);
      if (selectedApplication?.id === appId) {
        setSelectedApplication(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel application');
    }
  };

  // Calendar Helpers
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; dayNumber: number }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        dayNumber: d.getDate()
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: true,
        dayNumber: i
      });
    }

    // Next month padding to fill complete weeks
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        dayNumber: i
      });
    }

    return days;
  }, [calendarMonth]);

  // Map dates to applications for calendar
  const dateApplicationMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const app of applications) {
      if (['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(app.status)) continue;
      const start = new Date(app.fromDate);
      const end = new Date(app.toDate);
      const cur = new Date(start);
      while (cur <= end) {
        const key = cur.toISOString().split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(app);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [applications]);

  // Aggregate pending days per policy
  const pendingDaysByPolicy = useMemo(() => {
    const map: Record<string, number> = {};
    for (const app of applications) {
      if (app.status === 'PENDING') {
        map[app.leavePolicyId] = (map[app.leavePolicyId] || 0) + Number(app.totalDays);
      }
    }
    return map;
  }, [applications]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="My Leave Workspace"
        subtitle={`Employee Self-Service (ESS) • Leave Applications, Entitlements & Calendar for ${currentYear}`}
        breadcrumbs={[
          { label: 'Employee Portal' },
          { label: 'My Leave' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Leave Year {currentYear}</span>}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'apply' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setFormError(null); setFormSuccess(null); setActiveTab('apply'); }}
            >
              <Plus size={14} /> Apply for Leave
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'applications' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('applications')}
            >
              <FileText size={14} /> My Applications ({applications.length})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'calendar' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('calendar')}
            >
              <Calendar size={14} /> Leave Calendar
            </button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview & Balances
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'apply' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('apply')}
        >
          Apply for Leave
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'applications' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('applications')}
        >
          My Applications ({applications.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {/* SECTION A: LEAVE BALANCE SUMMARY CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarCheck size={16} color="var(--primary)" /> Leave Entitlements & Balances ({currentYear})
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            As of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading leave balances...</div>
        ) : balances.length === 0 ? (
          <div className="panel" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No leave balances assigned yet. Please contact HR to configure initial allocations.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {balances.map(b => {
              const pending = pendingDaysByPolicy[b.leavePolicyId] || 0;
              const available = Math.max(0, Number(b.balance) - pending);
              return (
                <div
                  key={b.id}
                  className="panel"
                  style={{
                    padding: '16px',
                    margin: 0,
                    borderLeft: `4px solid ${b.leavePolicy?.isPaid ? 'var(--primary)' : '#94a3b8'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {b.leavePolicy?.code}
                      </span>
                      <h4 style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 700 }}>
                        {b.leavePolicy?.name}
                      </h4>
                    </div>
                    <span className={`badge ${b.leavePolicy?.isPaid ? 'badge-approved' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {b.leavePolicy?.isPaid ? 'Paid Leave' : 'Loss of Pay (LOP)'}
                    </span>
                  </div>

                  {/* Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Allocated / Quota</span>
                      <strong>{Number(b.credited)} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Taken / Approved</span>
                      <strong style={{ color: 'var(--text-main)' }}>{Number(b.used)} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Pending Approval</span>
                      <strong style={{ color: pending > 0 ? '#b45309' : 'var(--text-muted)' }}>{pending} Days</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Net Available</span>
                      <strong style={{ color: available > 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.95rem' }}>
                        {available} Days
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Max carry: {Number(b.leavePolicy?.maxCarryForward || 0)}d
                    </span>
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() => {
                        setLeavePolicyId(b.leavePolicyId);
                        setActiveTab('apply');
                      }}
                    >
                      Apply This Type <ArrowRight size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION B: APPLY FOR LEAVE FORM */}
      {activeTab === 'apply' && (
        <div className="panel" style={{ padding: '20px' }}>
          <div className="panel-header" style={{ marginBottom: '16px' }}>
            <div>
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} color="var(--primary)" /> Submit Leave Application
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Fill out dates and details. Working days exclude institutional weekly offs and holidays automatically.
              </p>
            </div>
          </div>

          {formError && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Policy Selection */}
            <div className="form-group">
              <label className="form-label">Leave Type / Category *</label>
              <select
                className="form-select"
                value={leavePolicyId}
                onChange={e => setLeavePolicyId(e.target.value)}
                required
              >
                {policies.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.isPaid ? '100% Paid' : 'Loss of Pay (Unpaid)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration Type */}
            <div className="form-group">
              <label className="form-label">Duration Type *</label>
              <select
                className="form-select"
                value={durationType}
                onChange={e => setDurationType(e.target.value as any)}
                required
              >
                <option value="FULL_DAY">Full Day Leave</option>
                <option value="FIRST_HALF" disabled={selectedPolicy && !selectedPolicy.allowHalfDay}>
                  First Half (Morning) {selectedPolicy && !selectedPolicy.allowHalfDay ? '(Disabled by Policy)' : ''}
                </option>
                <option value="SECOND_HALF" disabled={selectedPolicy && !selectedPolicy.allowHalfDay}>
                  Second Half (Afternoon) {selectedPolicy && !selectedPolicy.allowHalfDay ? '(Disabled by Policy)' : ''}
                </option>
              </select>
            </div>

            {/* Date Range */}
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value);
                  if (durationType !== 'FULL_DAY' || e.target.value > toDate) {
                    setToDate(e.target.value);
                  }
                }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                disabled={durationType !== 'FULL_DAY'}
                required
              />
            </div>
          </div>

          {/* Working Days & Balance Callout */}
          <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Computed Working Days</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{computedWorkingDays} Days</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Available Policy Balance</span>
              <strong style={{ fontSize: '1.1rem', color: selectedBalance && Number(selectedBalance.balance) >= computedWorkingDays ? 'var(--success)' : 'var(--danger)' }}>
                {selectedBalance ? Number(selectedBalance.balance) : 0} Days
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Policy Rules</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                Max consecutive: {selectedPolicy?.maxConsecutiveDays || 30}d • Advance notice: {selectedPolicy?.minAdvanceNoticeDays || 0}d
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Reason for Leave *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="State clear reason for leave (medical, personal, bereavement, vacation, etc.)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>

          {/* Supporting Document / Medical Certificate */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileUp size={14} /> Supporting Document URL {selectedPolicy?.requiresAttachment && <span style={{ color: 'var(--danger)' }}>* (Mandatory for {selectedPolicy?.name})</span>}
            </label>
            <input
              type="url"
              className="form-input"
              placeholder="e.g. https://storage.payflow.internal/attachments/medical-cert-2026.pdf"
              value={attachmentUrl}
              onChange={e => setAttachmentUrl(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={isSubmitting || !reason}
              onClick={() => handleApply(true)}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting || !reason || computedWorkingDays <= 0}
              onClick={() => handleApply(false)}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}

      {/* SECTION C: MY LEAVE APPLICATIONS TABLE */}
      {activeTab === 'applications' && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--primary)" /> Leave History & Approval Status
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing all recorded applications
            </span>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref # / Type</th>
                  <th>Dates Range</th>
                  <th>Working Days</th>
                  <th>Duration</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th>Approver / Comments</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No leave applications found. Click "Apply for Leave" above to create your first application.
                    </td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app.id}>
                      <td>
                        <strong>{app.applicationNumber || 'LR-PENDING'}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                          {app.leavePolicy?.name} ({app.leavePolicy?.code})
                        </div>
                      </td>
                      <td>
                        <div>{new Date(app.fromDate).toLocaleDateString('en-IN')}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          to {new Date(app.toDate).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.9rem' }}>{Number(app.totalDays)} Days</strong>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {app.durationType === 'FULL_DAY' ? 'Full Day' : app.durationType === 'FIRST_HALF' ? '1st Half' : '2nd Half'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(app.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            app.status === 'APPROVED'
                              ? 'badge-approved'
                              : app.status === 'PENDING'
                              ? 'badge-warning'
                              : app.status === 'REJECTED'
                              ? 'badge-danger'
                              : app.status === 'DRAFT'
                              ? 'badge-neutral'
                              : 'badge-finalized'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {app.approvedBy ? (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>By: </span>
                            <strong>{app.approvedBy}</strong>
                          </div>
                        ) : null}
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.rejectionReason || app.approverComment || '—'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-xs btn-outline"
                            title="View Details"
                            onClick={() => setSelectedApplication(app)}
                          >
                            <Eye size={12} /> View
                          </button>
                          {['PENDING', 'DRAFT'].includes(app.status) && (
                            <button
                              className="btn btn-xs btn-outline"
                              style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}
                              title="Withdraw application"
                              onClick={() => handleCancelApplication(app.id)}
                            >
                              <RotateCcw size={12} /> Withdraw
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
      )}

      {/* SECTION D: LEAVE CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={() => setCalendarMonth(new Date())}
                >
                  Today
                </button>
                <button
                  className="btn btn-xs btn-outline"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} />
                <span>Approved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }} />
                <span>Pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
                <span>Rejected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e2e8f0', display: 'inline-block' }} />
                <span>Weekly Off</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', padding: '6px', color: 'var(--text-muted)' }}>
                {d}
              </div>
            ))}

            {calendarDays.map((day, idx) => {
              const dayOfWeek = day.date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const dayLeaves = dateApplicationMap.get(day.dateStr) || [];
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={idx}
                  style={{
                    minHeight: '80px',
                    padding: '6px',
                    borderRadius: '4px',
                    border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isWeekend ? '#f8fafc' : day.isCurrentMonth ? '#ffffff' : '#fcfcfc',
                    opacity: day.isCurrentMonth ? 1 : 0.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--primary)' : 'var(--text-main)' }}>
                      {day.dayNumber}
                    </span>
                    {isWeekend && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Off</span>
                    )}
                  </div>

                  {dayLeaves.map(app => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApplication(app)}
                      style={{
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        background:
                          app.status === 'APPROVED' ? '#dcfce7' : app.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                        color:
                          app.status === 'APPROVED' ? '#166534' : app.status === 'PENDING' ? '#92400e' : '#991b1b',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${app.leavePolicy?.name} (${app.status})`}
                    >
                      {app.leavePolicy?.code} • {app.status}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Pattern B) */}
      {selectedApplication && (
        <FormModal
          isOpen={Boolean(selectedApplication)}
          onClose={() => setSelectedApplication(null)}
          title={`Leave Application: ${selectedApplication.applicationNumber || 'Reference'}`}
          subtitle={`${selectedApplication.leavePolicy?.name} (${selectedApplication.leavePolicy?.code})`}
          icon={<CalendarCheck size={18} />}
          width="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div>
                {['PENDING', 'DRAFT'].includes(selectedApplication.status) && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}
                    onClick={() => handleCancelApplication(selectedApplication.id)}
                  >
                    Withdraw Application
                  </button>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedApplication(null)}>
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Status</span>
                <span className={`badge ${selectedApplication.status === 'APPROVED' ? 'badge-approved' : selectedApplication.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                  {selectedApplication.status}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Duration</span>
                <strong>{Number(selectedApplication.totalDays)} Working Days ({selectedApplication.durationType})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>From Date</span>
                <strong>{new Date(selectedApplication.fromDate).toLocaleDateString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>To Date</span>
                <strong>{new Date(selectedApplication.toDate).toLocaleDateString('en-IN')}</strong>
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Reason Submitted</span>
              <p style={{ margin: '4px 0 0', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                {selectedApplication.reason}
              </p>
            </div>

            {selectedApplication.attachmentUrl && (
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Attachment</span>
                <a
                  href={selectedApplication.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.8rem' }}
                >
                  View Supporting Document
                </a>
              </div>
            )}

            {(selectedApplication.approvedBy || selectedApplication.approverComment || selectedApplication.rejectionReason) && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Approver Audit & Comments</span>
                <div style={{ margin: '4px 0 0', padding: '8px 12px', background: selectedApplication.status === 'REJECTED' ? '#fef2f2' : '#f0fdf4', borderRadius: '4px', border: `1px solid ${selectedApplication.status === 'REJECTED' ? '#fecaca' : '#bbf7d0'}` }}>
                  <div><strong>Approver:</strong> {selectedApplication.approvedBy || 'Manager'}</div>
                  {selectedApplication.actionedAt && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Actioned on: {new Date(selectedApplication.actionedAt).toLocaleString('en-IN')}
                    </div>
                  )}
                  <div style={{ marginTop: '4px' }}>
                    <strong>Note:</strong> {selectedApplication.rejectionReason || selectedApplication.approverComment || 'None'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormModal>
      )}
    </div>
  );
};
