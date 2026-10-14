import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Landmark, X } from 'lucide-react';

export const LoansView: React.FC = () => {
  const { hasRole } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showSanctionModal, setShowSanctionModal] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState(50000);
  const [totalInstallments, setTotalInstallments] = useState(24);
  const [orderNumber, setOrderNumber] = useState('');

  const loadLoans = async () => {
    try {
      const [lRes, tRes, empRes]: any = await Promise.all([
        api.get('/loans'),
        api.get('/loans/types'),
        api.get('/employees')
      ]);
      setLoans(lRes.loans);
      setLoanTypes(tRes.loanTypes);
      setEmployees(empRes.employees);

      if (tRes.loanTypes[0]) setLoanTypeId(tRes.loanTypes[0].id);
      if (empRes.employees[0]) setEmployeeId(empRes.employees[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleSanctionLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/loans', {
        employeeId,
        loanTypeId,
        principalAmount: Number(principalAmount),
        totalInstallments: Number(totalInstallments),
        sanctionOrderNumber: orderNumber || `ORD-${Date.now()}`
      });
      setShowSanctionModal(false);
      loadLoans();
    } catch (err: any) {
      alert(err.message || 'Failed to sanction loan');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Loans, Advances & Payroll Recoveries
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Computer Advances, House Building Advances, Festival Advances (PDF pp. 13-14, 25)
          </p>
        </div>

        {hasRole(['payroll_admin', 'payroll_pcm']) && (
          <button className="btn btn-primary" onClick={() => setShowSanctionModal(true)}>
            <Plus size={16} /> Sanction Advance / Loan
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Active Running Advances & Installment Schedules</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sanction #</th>
                <th>Employee</th>
                <th>Advance Type</th>
                <th className="money">Principal</th>
                <th className="money">Monthly Recovery</th>
                <th>Progress</th>
                <th className="money">Outstanding Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No active loans recorded.</td></tr>
              ) : (
                loans.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{l.sanctionOrderNumber}</td>
                    <td><strong>{l.employee?.firstName} {l.employee?.lastName}</strong> ({l.employee?.employeeCode})</td>
                    <td>{l.loanType?.name} ({l.loanType?.interestRate}% p.a.)</td>
                    <td className="money">₹{Number(l.principalAmount).toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      ₹{Number(l.monthlyInstallment).toLocaleString('en-IN')}
                    </td>
                    <td>{l.recoveredInstallments} of {l.totalInstallments} inst.</td>
                    <td className="money" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                      ₹{Number(l.outstandingAmount).toLocaleString('en-IN')}
                    </td>
                    <td><span className="badge badge-approved">{l.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSanctionModal && (
        <div className="modal-overlay" onClick={() => setShowSanctionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sanction Loan / Advance</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowSanctionModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSanctionLoan}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Beneficiary Employee *</label>
                  <select className="form-select" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Loan Product *</label>
                  <select className="form-select" value={loanTypeId} onChange={e => setLoanTypeId(e.target.value)}>
                    {loanTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name} (Max ₹{Number(lt.maxAmount).toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Principal Amount (₹) *</label>
                  <input className="form-input" type="number" required value={principalAmount} onChange={e => setPrincipalAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Installments (Months) *</label>
                  <input className="form-input" type="number" required value={totalInstallments} onChange={e => setTotalInstallments(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sanction Order Number</label>
                  <input className="form-input" placeholder="e.g. NIHER/EST/ADV/2026/042" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSanctionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Sanction & Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
