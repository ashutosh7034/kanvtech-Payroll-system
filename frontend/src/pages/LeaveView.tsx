import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X } from 'lucide-react';

export const LeaveView: React.FC = () => {
  const { hasRole } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('2026-04-10');
  const [toDate, setToDate] = useState('2026-04-15');
  const [daysCount, setDaysCount] = useState(5);
  const [remarks, setRemarks] = useState('');

  const loadLeaveData = async () => {
    try {
      const [tRes, rRes, empRes]: any = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/records'),
        api.get('/employees')
      ]);
      setTypes(tRes.leaveTypes);
      setRecords(rRes.leaveRecords);
      setEmployees(empRes.employees);

      if (tRes.leaveTypes[0]) setLeaveTypeId(tRes.leaveTypes[0].id);
      if (empRes.employees[0]) setEmployeeId(empRes.employees[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLeaveData();
  }, []);

  const handleRecordLeave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert(err.message || 'Failed to record leave');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Leave-Linked Salary Adjustments
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            HPL (Half Pay Leave) & EOL (Extraordinary Leave / Loss of Pay) Integration (PDF pp. 27-28)
          </p>
        </div>

        {hasRole(['payroll_admin', 'payroll_pcm', 'payroll_pda']) && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Record Approved Leave
          </button>
        )}
      </div>

      {/* Leave Types Policy Grid */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Institutional Leave Payability Rules</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {types.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{t.code}</strong>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '4px' }}>{t.name}</div>
              <div style={{ marginTop: '8px' }}>
                <span className={`badge ${Number(t.deductionRatio) === 0 ? 'badge-approved' : (Number(t.deductionRatio) === 0.5 ? 'badge-finalized' : 'badge-returned')}`}>
                  {Number(t.deductionRatio) === 0 ? '100% Paid (0% LOP)' : (Number(t.deductionRatio) === 0.5 ? 'Half Pay (50% LOP)' : 'Without Pay (100% LOP)')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approved Leave Records */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Approved Leave Records Feeding Monthly Payroll</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Days Count</th>
                <th>Loss of Pay Impact</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No leave records recorded for this cycle.</td></tr>
              ) : (
                records.map(r => {
                  const lopDays = Number(r.daysCount) * Number(r.leaveType?.deductionRatio || 0);
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.employee?.firstName} {r.employee?.lastName}</strong> ({r.employee?.employeeCode})</td>
                      <td><span className="badge badge-neutral">{r.leaveType?.name}</span></td>
                      <td>{new Date(r.fromDate).toLocaleDateString('en-IN')}</td>
                      <td>{new Date(r.toDate).toLocaleDateString('en-IN')}</td>
                      <td>{Number(r.daysCount)} days</td>
                      <td>
                        <strong style={{ color: lopDays > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {lopDays} days deducted
                        </strong>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.remarks || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Approved Leave</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleRecordLeave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select className="form-select" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Type *</label>
                  <select className="form-select" value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}>
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
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
                  <input className="form-input" type="number" step="0.5" required value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sanction Reference</label>
                  <input className="form-input" placeholder="e.g. Leave order #04/2026" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Approved Leave</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
