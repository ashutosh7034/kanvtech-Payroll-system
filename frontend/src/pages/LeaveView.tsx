import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import { Plus, CalendarCheck, Calendar, Clock, AlertTriangle } from 'lucide-react';

export const LeaveView: React.FC = () => {
  const { hasRole } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('2026-04-10');
  const [toDate, setToDate] = useState('2026-04-15');
  const [daysCount, setDaysCount] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadLeaveData = async () => {
    try {
      const [tRes, rRes, empRes]: any = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/records'),
        api.get('/employees')
      ]);
      setTypes(tRes.leaveTypes || []);
      setRecords(rRes.leaveRecords || []);
      setEmployees(empRes.employees || []);

      if (tRes.leaveTypes?.[0] && !leaveTypeId) setLeaveTypeId(tRes.leaveTypes[0].id);
      if (empRes.employees?.[0] && !employeeId) setEmployeeId(empRes.employees[0].id);
    } catch (err) {
      console.error('Failed to load leave data:', err);
    }
  };

  useEffect(() => {
    loadLeaveData();
  }, []);

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post('/leave/records', {
        employeeId,
        leaveTypeId,
        fromDate,
        toDate,
        daysCount: Number(daysCount),
        remarks
      });
      setShowAddModal(false);
      loadLeaveData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record leave entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = types.find(t => t.id === leaveTypeId);
  const projectedLop = Number(daysCount) * Number(selectedType?.deductionRatio || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standardized PageHeader */}
      <PageHeader
        title="Leave-Linked Salary Adjustments"
        subtitle="HPL (Half Pay Leave) & EOL (Extraordinary Leave / Loss of Pay) Integration with Payroll Deductions"
        breadcrumbs={[
          { label: 'Time Management' },
          { label: 'Leave Management' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Attendance & LOP</span>}
        actions={
          hasRole(['payroll_admin', 'payroll_pcm', 'payroll_pda']) && (
            <button className="btn btn-primary btn-sm" onClick={() => { setFormError(null); setShowAddModal(true); }}>
              <Plus size={14} /> Record Approved Leave
            </button>
          )
        }
      />

      {/* Leave Types Policy Grid */}
      <div className="panel" style={{ padding: '16px' }}>
        <div className="panel-header" style={{ marginBottom: '12px' }}>
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarCheck size={16} color="var(--primary)" /> Institutional Leave Payability Rules
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configured deduction ratios for payroll computation</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {types.map(t => (
            <div key={t.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{t.code}</strong>
                <span className={`badge ${Number(t.deductionRatio) === 0 ? 'badge-approved' : (Number(t.deductionRatio) === 0.5 ? 'badge-finalized' : 'badge-danger')}`}>
                  {Number(t.deductionRatio) === 0 ? '100% Paid' : (Number(t.deductionRatio) === 0.5 ? '50% LOP' : '100% LOP')}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '6px', color: 'var(--text-main)' }}>{t.name}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {Number(t.deductionRatio) === 0 ? 'Full salary payable without loss of pay' : Number(t.deductionRatio) === 0.5 ? 'Half-day deduction per calendar leave day' : 'Full loss of pay deducted from monthly gross'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Approved Leave Records */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title">Approved Leave Records Feeding Monthly Payroll</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-deducted during 7-stage payroll cycle</span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Days Count</th>
                <th>Loss of Pay Impact</th>
                <th>Sanction Reference / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No leave records recorded for this cycle. Click "Record Approved Leave" to log approved leaves.
                  </td>
                </tr>
              ) : (
                records.map(r => {
                  const lopDays = Number(r.daysCount) * Number(r.leaveType?.deductionRatio || 0);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.employee?.firstName} {r.employee?.lastName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.employee?.employeeCode}</div>
                      </td>
                      <td><span className="badge badge-neutral">{r.leaveType?.name || 'Leave'}</span></td>
                      <td>{new Date(r.fromDate).toLocaleDateString('en-IN')}</td>
                      <td>{new Date(r.toDate).toLocaleDateString('en-IN')}</td>
                      <td><strong>{Number(r.daysCount)}</strong> days</td>
                      <td>
                        <strong style={{ color: lopDays > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {lopDays} days deducted
                        </strong>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.remarks || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standardized Record Leave Modal (Pattern B) */}
      <FormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Approved Leave Entry"
        subtitle="Log authorized institutional leave to adjust salary loss of pay (LOP) days"
        icon={<CalendarCheck size={18} />}
        width="md"
        onSubmit={handleRecordLeave}
        submitLabel="Save Approved Leave"
        isSubmitting={isSubmitting}
      >
        {formError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
            {formError}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Employee *</label>
          <select className="form-select" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.employeeCode})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Leave Type *</label>
          <select className="form-select" value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)} required>
            {types.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code}) — {Number(t.deductionRatio) === 0 ? 'Paid' : (Number(t.deductionRatio) === 0.5 ? 'Half Pay' : 'Without Pay')}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">From Date *</label>
            <input className="form-input" type="date" required value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date *</label>
            <input className="form-input" type="date" required value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Total Days *</label>
          <input className="form-input" type="number" step="0.5" min="0.5" required value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} />
        </div>

        <div className="form-group">
          <label className="form-label">Sanction Reference / Order Number</label>
          <input className="form-input" placeholder="e.g. Leave order #04/2026 / Medical certificate ref" value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>

        {/* LOP Impact Callout */}
        <div style={{ background: projectedLop > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${projectedLop > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: '6px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: projectedLop > 0 ? '#92400e' : '#166534', fontWeight: 600 }}>
              Payroll Loss of Pay (LOP) Impact:
            </span>
            <strong style={{ fontSize: '0.95rem', color: projectedLop > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {projectedLop} Days Deducted
            </strong>
          </div>
        </div>
      </FormModal>
    </div>
  );
};
