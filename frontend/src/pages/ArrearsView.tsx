import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle, X } from 'lucide-react';

export const ArrearsView: React.FC = () => {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [batchName, setBatchName] = useState('DA Hike Arrears July-Dec 2025');
  const [reason, setReason] = useState('Central Government Dearness Allowance Revision');
  const [employeeId, setEmployeeId] = useState('');
  const [periodName, setPeriodName] = useState('July 2025 - December 2025');
  const [oldBasic, setOldBasic] = useState(131400);
  const [newBasic, setNewBasic] = useState(135300);

  const loadArrears = async () => {
    try {
      const [bRes, empRes]: any = await Promise.all([
        api.get('/arrears/batches'),
        api.get('/employees')
      ]);
      setBatches(bRes.arrearBatches);
      setEmployees(empRes.employees);
      if (empRes.employees[0]) setEmployeeId(empRes.employees[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadArrears();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/arrears/batches', {
        name: batchName,
        reason,
        records: [
          {
            employeeId,
            periodName,
            oldBasic: Number(oldBasic),
            newBasic: Number(newBasic),
            daPercentage: 50.0,
            hraPercentage: 27.0
          }
        ]
      });
      setShowCreateModal(false);
      loadArrears();
    } catch (err: any) {
      alert(err.message || 'Failed to create arrear batch');
    }
  };

  const handleApprove = async (batchId: string) => {
    try {
      await api.post(`/arrears/batches/${batchId}/approve`);
      loadArrears();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Arrears & Pay Fixation Processing
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Basic, DA, HRA Difference Computations (PDF pp. 28-32)
          </p>
        </div>

        {hasRole(['payroll_admin', 'payroll_pda']) && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Create Arrear Batch
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Processed Arrear Batches</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Name</th>
                <th>Reason</th>
                <th>Staff Count</th>
                <th className="money">Total Arrear Payable</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No arrear batches generated.</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.reason}</td>
                    <td>{b.records?.length || 0} employees</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'APPROVED' ? 'badge-approved' : 'badge-generated'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.status !== 'APPROVED' && hasRole(['payroll_ar_salary', 'payroll_admin']) && (
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(b.id)}>
                          <CheckCircle size={12} /> Approve Arrears
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Arrear Calculation Batch</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateBatch}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Batch Title *</label>
                  <input className="form-input" required value={batchName} onChange={e => setBatchName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sanction Order / Reason *</label>
                  <input className="form-input" required value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select className="form-select" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Arrear Period Range *</label>
                  <input className="form-input" required value={periodName} onChange={e => setPeriodName(e.target.value)} />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Historical Basic Pay (₹) *</label>
                    <input className="form-input" type="number" required value={oldBasic} onChange={e => setOldBasic(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Revised Basic Pay (₹) *</label>
                    <input className="form-input" type="number" required value={newBasic} onChange={e => setNewBasic(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  Difference: <strong>₹{newBasic - oldBasic}</strong> Basic + 50% DA difference (₹{(newBasic - oldBasic) * 0.5}) + 27% HRA difference (₹{(newBasic - oldBasic) * 0.27}) = Total Payable: <strong style={{ color: 'var(--success)' }}>₹{(newBasic - oldBasic) * 1.77}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Arrears</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
