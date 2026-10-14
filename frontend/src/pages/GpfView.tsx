import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Lock, FileSpreadsheet, Plus, X } from 'lucide-react';

export const GpfView: React.FC = () => {
  const { hasRole } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [broadSheet, setBroadSheet] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'accounts' | 'broadsheet'>('accounts');

  // Manual Transaction Modal
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('MONTHLY_SUBSCRIPTION');
  const [txAmount, setTxAmount] = useState(5000);
  const [txRef, setTxRef] = useState('');
  const [txRemarks, setTxRemarks] = useState('');

  const loadGpf = async () => {
    try {
      const [accRes, fyRes]: any = await Promise.all([
        api.get('/gpf/accounts'),
        api.get('/masters/financial-years')
      ]);
      setAccounts(accRes.gpfAccounts);
      setFinancialYears(fyRes.financialYears);
      const activeFy = fyRes.financialYears.find((f: any) => f.active) || fyRes.financialYears[0];
      if (activeFy) {
        setSelectedFyId(activeFy.id);
        const bsRes: any = await api.get(`/gpf/broadsheet?financialYearId=${activeFy.id}`);
        setBroadSheet(bsRes.broadSheet);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadGpf();
  }, []);

  const openAccountLedger = async (id: string) => {
    try {
      const res: any = await api.get(`/gpf/accounts/${id}`);
      setSelectedAccount(res.gpfAccount);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      await api.post('/gpf/transactions', {
        gpfAccountId: selectedAccount.id,
        transactionType: txType,
        amount: Number(txAmount),
        referenceNumber: txRef,
        remarks: txRemarks
      });
      setShowTxModal(false);
      openAccountLedger(selectedAccount.id);
      loadGpf();
    } catch (err: any) {
      alert(err.message || 'Transaction failed');
    }
  };

  const handleGenerateStatement = async (accountId: string) => {
    try {
      await api.post('/gpf/statements/generate', {
        gpfAccountId: accountId,
        financialYearId: selectedFyId
      });
      alert('GPF Annual Statement and 7.10% Interest computed successfully');
      loadGpf();
      if (selectedAccount?.id === accountId) openAccountLedger(accountId);
    } catch (err: any) {
      alert(err.message || 'Generation failed');
    }
  };

  const handleApproveStatement = async (statementId: string) => {
    try {
      await api.post(`/gpf/statements/${statementId}/approve`);
      alert('Statement approved and locked (Immutable)');
      loadGpf();
      if (selectedAccount) openAccountLedger(selectedAccount.id);
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            General Provident Fund (GPF) Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Ledger Subscriptions, Annual Interest, Statements & Broad Sheet (PDF pp. 41-53)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${viewMode === 'accounts' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('accounts')}>
            Member Accounts
          </button>
          <button className={`btn ${viewMode === 'broadsheet' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('broadsheet')}>
            <FileSpreadsheet size={14} /> Annual Broad Sheet Report
          </button>
        </div>
      </div>

      {viewMode === 'accounts' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Active GPF Accounts & Progressive Balances</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>GPF Account #</th>
                  <th>Member Name</th>
                  <th>Department</th>
                  <th className="money">Opening Balance</th>
                  <th className="money">Current Ledger Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id}>
                    <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{acc.accountNumber}</strong></td>
                    <td><strong>{acc.employee?.firstName} {acc.employee?.lastName}</strong> ({acc.employee?.employeeCode})</td>
                    <td>{acc.employee?.department?.name}</td>
                    <td className="money">₹{Number(acc.openingBalance).toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{Number(acc.currentBalance).toLocaleString('en-IN')}
                    </td>
                    <td><span className="badge badge-approved">{acc.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openAccountLedger(acc.id)}>
                          Passbook
                        </button>
                        {hasRole(['payroll_admin']) && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleGenerateStatement(acc.id)}>
                            Compute Interest
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'broadsheet' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">GPF Annual Broad Sheet (Statutory Summary)</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Staff Member</th>
                  <th className="money">Opening (₹)</th>
                  <th className="money">Total Subs (₹)</th>
                  <th className="money">Refunds (₹)</th>
                  <th className="money">Interest (7.1%)</th>
                  <th className="money">Withdrawals (₹)</th>
                  <th className="money">Closing Balance (₹)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {broadSheet.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No statements computed for this financial cycle yet.</td></tr>
                ) : (
                  broadSheet.map(bs => (
                    <tr key={bs.id}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{bs.gpfAccount?.accountNumber}</td>
                      <td>{bs.gpfAccount?.employee?.firstName} {bs.gpfAccount?.employee?.lastName}</td>
                      <td className="money">₹{Number(bs.openingBalance).toLocaleString('en-IN')}</td>
                      <td className="money">₹{Number(bs.totalSubscriptions).toLocaleString('en-IN')}</td>
                      <td className="money">₹{Number(bs.totalRefunds).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--primary)' }}>₹{Number(bs.totalInterest).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--danger)' }}>₹{Number(bs.totalWithdrawals).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ fontWeight: 700, color: 'var(--success)' }}>₹{Number(bs.closingBalance).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${bs.status === 'APPROVED' ? 'badge-approved' : 'badge-generated'}`}>{bs.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Account Passbook Drawer */}
      {selectedAccount && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <div className="panel-header">
            <div>
              <strong style={{ fontSize: '1.1rem' }}>GPF Passbook Ledger: {selectedAccount.accountNumber}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Member: {selectedAccount.employee?.firstName} {selectedAccount.employee?.lastName} • Current Balance: <strong style={{ color: 'var(--success)' }}>₹{Number(selectedAccount.currentBalance).toLocaleString('en-IN')}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasRole(['payroll_admin', 'payroll_pcm']) && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowTxModal(true)}>
                  <Plus size={14} /> Post Adjustment / Advance
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedAccount(null)}><X size={16} /> Close</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Type</th>
                  <th>Ref # / Details</th>
                  <th className="money">Credit / Debit Amount</th>
                  <th className="money">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {selectedAccount.transactions?.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No transactions recorded. Only opening balance present.</td></tr>
                ) : (
                  selectedAccount.transactions?.map((tx: any) => {
                    const isCredit = ['MONTHLY_SUBSCRIPTION', 'ADDITIONAL_SUBSCRIPTION', 'REFUND', 'INTEREST_CREDIT'].includes(tx.transactionType);
                    return (
                      <tr key={tx.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{new Date(tx.transactionDate).toLocaleDateString('en-IN')}</td>
                        <td><span className="badge badge-neutral">{tx.transactionType}</span></td>
                        <td>{tx.remarks || tx.referenceNumber || '-'}</td>
                        <td className="money" style={{ color: isCredit ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="money" style={{ fontWeight: 700 }}>₹{Number(tx.balanceAfter).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual GPF Transaction Modal */}
      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Post GPF Ledger Transaction</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTxModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handlePostTransaction}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Transaction Type *</label>
                  <select className="form-select" value={txType} onChange={e => setTxType(e.target.value)}>
                    <option value="MONTHLY_SUBSCRIPTION">Monthly Subscription (Credit)</option>
                    <option value="ADDITIONAL_SUBSCRIPTION">Additional Voluntary Subscription (Credit)</option>
                    <option value="ADVANCE_TAKEN">Temporary Advance (Debit)</option>
                    <option value="WITHDRAWAL">Non-Refundable Withdrawal (Debit)</option>
                    <option value="REFUND">Advance Refund Recovery (Credit)</option>
                    <option value="ARREAR_DEPOSIT">Arrear Deposit (Credit)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input className="form-input" type="number" required value={txAmount} onChange={e => setTxAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference Number</label>
                  <input className="form-input" placeholder="e.g. SAN/GPF/2026/01" value={txRef} onChange={e => setTxRef(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <input className="form-input" placeholder="e.g. Sanctioned advance for medical purposes" value={txRemarks} onChange={e => setTxRemarks(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post to Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
