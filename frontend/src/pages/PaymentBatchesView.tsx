import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCheck, Eye, Download, X } from 'lucide-react';

export const PaymentBatchesView: React.FC = () => {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [approvedRuns, setApprovedRuns] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAdvice, setSelectedAdvice] = useState<any | null>(null);

  const [selectedRunId, setSelectedRunId] = useState('');
  const [bankName, setBankName] = useState('State Bank of India');
  const [paymentMethod, setPaymentMethod] = useState('NEFT');

  const loadBatches = async () => {
    try {
      const [bRes, rRes]: any = await Promise.all([
        api.get('/payments/batches'),
        api.get('/payroll/runs?status=APPROVED')
      ]);
      setBatches(bRes.paymentBatches);
      setApprovedRuns(rRes.runs);
      if (rRes.runs[0]) setSelectedRunId(rRes.runs[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payments/batches', {
        payrollRunId: selectedRunId,
        bankName,
        paymentMethod
      });
      setShowCreateModal(false);
      loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to create payment batch');
    }
  };

  const openBankAdvice = async (batchId: string) => {
    try {
      const res: any = await api.get(`/payments/batches/${batchId}/advice`);
      setSelectedAdvice(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconcile = async (batchId: string) => {
    try {
      await api.post(`/payments/batches/${batchId}/reconcile`);
      loadBatches();
      if (selectedAdvice) openBankAdvice(batchId);
    } catch (err: any) {
      alert(err.message || 'Reconciliation failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Payment Batches & Bank Advice Disbursals
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            NEFT, RTGS & PFMS Electronic Bank Advice Generation (PDF pp. 22-25, 37)
          </p>
        </div>

        {hasRole(['payroll_ar_salary', 'payroll_admin']) && approvedRuns.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Generate Bank Advice Batch
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Generated Bank Disbursement Batches</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Payroll Period</th>
                <th>Bank Name</th>
                <th>Method</th>
                <th>Staff Count</th>
                <th className="money">Total Disbursable Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No payment batches generated. Approve a payroll run first.</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id}>
                    <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{b.batchNumber}</strong></td>
                    <td>{b.payrollRun?.period?.name}</td>
                    <td>{b.bankName}</td>
                    <td><span className="badge badge-neutral">{b.paymentMethod}</span></td>
                    <td>{b.totalEmployees} employees</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'RECONCILED' ? 'badge-approved' : 'badge-generated'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openBankAdvice(b.id)}>
                        <Eye size={12} /> Bank Advice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Advice Drawer / Modal */}
      {selectedAdvice && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <div className="panel-header">
            <div>
              <strong style={{ fontSize: '1.1rem' }}>Bank Advice Schedule: {selectedAdvice.batch.batchNumber}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Bank: {selectedAdvice.batch.bankName} • Method: {selectedAdvice.batch.paymentMethod} • Total: <strong style={{ color: 'var(--success)' }}>₹{Number(selectedAdvice.batch.totalAmount).toLocaleString('en-IN')}</strong> ({selectedAdvice.batch.totalEmployees} beneficiaries)
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedAdvice.batch.status !== 'RECONCILED' && hasRole(['payroll_ar_salary', 'payroll_admin']) && (
                <button className="btn btn-success btn-sm" onClick={() => handleReconcile(selectedAdvice.batch.id)}>
                  <CheckCheck size={14} /> Mark Reconciled
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedAdvice(null)}><X size={16} /> Close</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Staff Code</th>
                  <th>Beneficiary Name</th>
                  <th>Department</th>
                  <th>Bank Name</th>
                  <th>Account Number</th>
                  <th>IFSC Code</th>
                  <th className="money">Net Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedAdvice.adviceRows?.map((row: any) => (
                  <tr key={row.serialNumber}>
                    <td>{row.serialNumber}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.employeeCode}</td>
                    <td><strong>{row.beneficiaryName}</strong></td>
                    <td>{row.department}</td>
                    <td>{row.bankName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.maskedAccount}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.ifscCode}</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ₹{Number(row.netAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Bank Advice Batch</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateBatch}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Approved Payroll Cycle *</label>
                  <select className="form-select" value={selectedRunId} onChange={e => setSelectedRunId(e.target.value)}>
                    {approvedRuns.map(r => (
                      <option key={r.id} value={r.id}>{r.period?.name} (₹{Number(r.netTotal).toLocaleString('en-IN')} - {r.totalEmployees} staff)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Disbursement Bank</label>
                  <input className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Disbursement Channel</label>
                  <select className="form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="NEFT">NEFT (National Electronic Funds Transfer)</option>
                    <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                    <option value="PFMS">PFMS (Public Financial Management System)</option>
                    <option value="CHEQUE">Institutional Cheque</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
