import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Building, CreditCard, Landmark, Printer, X } from 'lucide-react';

export const SelfServiceView: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pRes, psRes]: any = await Promise.all([
          api.get('/self-service/profile'),
          api.get('/self-service/payslips')
        ]);
        setProfile(pRes.profile);
        setPayslips(psRes.payslips);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const openFullPayslip = async (recordId: string) => {
    try {
      const res: any = await api.get(`/self-service/payslips/${recordId}`);
      setSelectedPayslip(res.payslip);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading employee portal...</div>;
  }

  const assignment = profile?.salaryAssignments?.[0];
  const bank = profile?.bankAccounts?.[0];

  return (
    <div>
      {/* Top Banner */}
      <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(16,185,129,0.1))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Employee Self-Service Portal
        </span>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 700, marginTop: '2px' }}>
          {profile?.firstName} {profile?.middleName ? `${profile?.middleName} ` : ''}{profile?.lastName}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {profile?.employeeCode} • {profile?.designation?.name} • {profile?.department?.name}
        </p>
      </div>

      {/* Grid Information */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="panel" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
            <Building size={16} /> <strong style={{ fontSize: '0.9rem' }}>Department & Placement</strong>
          </div>
          <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}>
            <div>Campus: <strong>{profile?.ou?.name}</strong></div>
            <div>Department: <strong>{profile?.department?.name}</strong></div>
            <div>Pay Level: <strong>{assignment?.payLevel?.name || 'Level 13'}</strong></div>
            <div>Basic Salary: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>₹{Number(assignment?.basicPay || 0).toLocaleString('en-IN')}</strong></div>
          </div>
        </div>

        <div className="panel" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '12px' }}>
            <CreditCard size={16} /> <strong style={{ fontSize: '0.9rem' }}>Bank & PAN Record</strong>
          </div>
          <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}>
            <div>Bank: <strong>{bank?.bankName || 'State Bank of India'}</strong></div>
            <div>A/C: <strong style={{ fontFamily: 'var(--font-mono)' }}>{bank?.maskedAccount || 'XXXXXX1234'}</strong></div>
            <div>IFSC: <strong style={{ fontFamily: 'var(--font-mono)' }}>{bank?.ifscCode || 'SBIN0001234'}</strong></div>
            <div>PAN: <strong style={{ fontFamily: 'var(--font-mono)' }}>{profile?.maskedPan || 'ABCXXXXX4F'}</strong></div>
          </div>
        </div>

        <div className="panel" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', marginBottom: '12px' }}>
            <Landmark size={16} /> <strong style={{ fontSize: '0.9rem' }}>Provident Fund & Loans</strong>
          </div>
          <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}>
            <div>GPF Account: <strong style={{ fontFamily: 'var(--font-mono)' }}>{profile?.gpfAccount?.accountNumber || 'N/A'}</strong></div>
            <div>GPF Balance: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>₹{Number(profile?.gpfAccount?.currentBalance || 0).toLocaleString('en-IN')}</strong></div>
            <div>Active Loans: <strong>{profile?.loans?.length || 0} active advances</strong></div>
          </div>
        </div>
      </div>

      {/* Monthly Payslips Catalog */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">My Official Monthly Payslips</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Approved Disbursement Vouchers</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payroll Period</th>
                <th>Financial Year</th>
                <th>Working Days</th>
                <th className="money">Basic Pay</th>
                <th className="money">Gross Earnings</th>
                <th className="money">Total Deductions</th>
                <th className="money">Net Credit</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No finalized payslips available yet.</td></tr>
              ) : (
                payslips.map(ps => (
                  <tr key={ps.recordId}>
                    <td><strong>{ps.periodName}</strong></td>
                    <td>{ps.financialYear}</td>
                    <td>{ps.payableDays} days</td>
                    <td className="money">₹{ps.basicPay.toLocaleString('en-IN')}</td>
                    <td className="money">₹{ps.grossAmount.toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--danger)' }}>₹{ps.deductionAmount.toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{ps.netAmount.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openFullPayslip(ps.recordId)}>
                        <FileText size={12} /> View Slip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      {selectedPayslip && (
        <div className="modal-overlay" onClick={() => setSelectedPayslip(null)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ background: '#f1f5f9' }}>
            <div className="modal-header" style={{ background: '#ffffff', color: '#0f172a' }}>
              <h3 style={{ color: '#0f172a' }}>Salary Slip</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={12} /> Print</button>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedPayslip(null)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div className="payslip-sheet">
                <div className="payslip-header">
                  <h2>{selectedPayslip.institution?.name}</h2>
                  <p>{selectedPayslip.institution?.brandName} • Payslip for {selectedPayslip.period}</p>
                </div>

                <div className="payslip-emp-grid">
                  <div className="payslip-emp-row"><span>Employee Code:</span> <strong>{selectedPayslip.employee?.code}</strong></div>
                  <div className="payslip-emp-row"><span>Designation:</span> <strong>{selectedPayslip.employee?.designation}</strong></div>
                  <div className="payslip-emp-row"><span>Name:</span> <strong>{selectedPayslip.employee?.name}</strong></div>
                  <div className="payslip-emp-row"><span>Department:</span> <strong>{selectedPayslip.employee?.department}</strong></div>
                  <div className="payslip-emp-row"><span>Bank A/C:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedPayslip.employee?.accountNumber} ({selectedPayslip.employee?.bankName})</strong></div>
                  <div className="payslip-emp-row"><span>PAN:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedPayslip.employee?.pan}</strong></div>
                </div>

                <div className="payslip-salary-split">
                  <div>
                    <h4 style={{ color: '#1e3a8a', marginBottom: '8px' }}>Earnings & Allowances</h4>
                    <table className="payslip-table">
                      <thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Amount (₹)</th></tr></thead>
                      <tbody>
                        {selectedPayslip.earnings?.map((e: any, i: number) => (
                          <tr key={i}><td>{e.name}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(e.amount).toLocaleString('en-IN')}</td></tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>Gross Earnings</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{Number(selectedPayslip.grossAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 style={{ color: '#991b1b', marginBottom: '8px' }}>Deductions & Recoveries</h4>
                    <table className="payslip-table">
                      <thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Amount (₹)</th></tr></thead>
                      <tbody>
                        {selectedPayslip.deductions?.map((d: any, i: number) => (
                          <tr key={i}><td>{d.name}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(d.amount).toLocaleString('en-IN')}</td></tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>Total Deductions</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#991b1b' }}>₹{Number(selectedPayslip.deductionAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="payslip-net-box">
                  <h4>Net Payable Salary</h4>
                  <div className="net-val">₹{Number(selectedPayslip.netAmount).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
