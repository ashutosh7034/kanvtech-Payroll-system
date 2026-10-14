import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, CheckCircle, Plus, X } from 'lucide-react';

export const IncrementsView: React.FC = () => {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [previewList, setPreviewList] = useState<any[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [batchName, setBatchName] = useState('Annual July 2026 Increments');
  const [effectiveDate, setEffectiveDate] = useState('2026-07-01');

  const loadData = async () => {
    try {
      const [bRes, fyRes]: any = await Promise.all([
        api.get('/increments/batches'),
        api.get('/masters/financial-years')
      ]);
      setBatches(bRes.incrementBatches);
      setFinancialYears(fyRes.financialYears);
      const activeFy = fyRes.financialYears.find((f: any) => f.active) || fyRes.financialYears[0];
      if (activeFy) setSelectedFyId(activeFy.id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res: any = await api.post('/increments/batches/preview', {
        financialYearId: selectedFyId,
        effectiveDate
      });
      setPreviewList(res.eligibleEmployees);
    } catch (err: any) {
      alert(err.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (previewList.length === 0) return;
    try {
      await api.post('/increments/batches', {
        name: batchName,
        financialYearId: selectedFyId,
        effectiveDate,
        increments: previewList.map(p => ({
          employeeId: p.employee.id,
          currentCellId: p.currentCell.id,
          currentBasic: p.currentCell.basic,
          nextCellId: p.nextCell.id,
          nextBasic: p.nextCell.basic
        }))
      });
      setShowGenerateModal(false);
      setPreviewList([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Generation failed');
    }
  };

  const handleApproveBatch = async (batchId: string) => {
    try {
      await api.post(`/increments/batches/${batchId}/approve`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            7th CPC Annual Salary Increments
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Automated Pay Matrix Progression & Next Increment Dates (PDF pp. 33-35)
          </p>
        </div>

        {hasRole(['payroll_admin', 'payroll_pda']) && (
          <button className="btn btn-primary" onClick={() => { setShowGenerateModal(true); handlePreview(); }}>
            <Plus size={16} /> Process Increment Cycle
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Processed Increment Cycles</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Name</th>
                <th>Financial Year</th>
                <th>Effective Date</th>
                <th>Staff Count</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No increment cycles generated yet.</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.financialYear?.name}</td>
                    <td>{new Date(b.effectiveDate).toLocaleDateString('en-IN')}</td>
                    <td>{b.totalEmployees} employees</td>
                    <td>
                      <span className={`badge ${b.status === 'APPROVED' ? 'badge-approved' : 'badge-generated'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.status !== 'APPROVED' && hasRole(['payroll_ar_salary', 'payroll_admin']) && (
                        <button className="btn btn-success btn-sm" onClick={() => handleApproveBatch(b.id)}>
                          <CheckCircle size={12} /> Approve & Promote Cells
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

      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Preview & Generate 7th CPC Increment Batch</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowGenerateModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Batch Title *</label>
                  <input className="form-input" required value={batchName} onChange={e => setBatchName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Effective Date *</label>
                  <input className="form-input" type="date" required value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Eligible Employees for Matrix Step-Up ({previewList.length})</h4>
                <div className="table-container" style={{ maxHeight: '250px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Pay Level</th>
                        <th>Current Cell</th>
                        <th>Next Cell (Step +1)</th>
                        <th className="money">Monthly Hike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewList.map(p => (
                        <tr key={p.employee.id}>
                          <td><strong>{p.employee.name}</strong> ({p.employee.code})</td>
                          <td>{p.payLevel}</td>
                          <td>Cell #{p.currentCell.index} (₹{p.currentCell.basic.toLocaleString('en-IN')})</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            Cell #{p.nextCell.index} (₹{p.nextCell.basic.toLocaleString('en-IN')})
                          </td>
                          <td className="money" style={{ color: 'var(--success)' }}>+₹{p.incrementAmount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleGenerateBatch} disabled={previewList.length === 0}>
                Confirm & Create Increment Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
