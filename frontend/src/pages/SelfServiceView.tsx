import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import {
  FileText,
  Building,
  CreditCard,
  Landmark,
  Printer,
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  User,
  ShieldCheck
} from 'lucide-react';

interface Props {
  onNavigate?: (page: string) => void;
}

export const SelfServiceView: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimMetrics, setClaimMetrics] = useState<any>({
    totalCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    correctionRequestedCount: 0,
    paidCount: 0,
    expenseCount: 0,
    reimbursementCount: 0,
    totalPendingAmount: 0,
    totalApprovedAmount: 0,
    totalPaidAmount: 0
  });
  const [claimsTab, setClaimsTab] = useState<'all' | 'expense' | 'reimbursement'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pRes, psRes, cRes]: any = await Promise.all([
          api.get('/self-service/profile').catch(() => ({ profile: null })),
          api.get('/self-service/payslips').catch(() => ({ payslips: [] })),
          api.get('/expenses/claims?pageSize=10').catch(() => ({ claims: [], metrics: null }))
        ]);
        setProfile(pRes.profile);
        setPayslips(psRes.payslips || []);
        setClaims(cRes.claims || []);
        if (cRes.metrics) setClaimMetrics(cRes.metrics);
      } catch (err) {
        console.error('Failed to load self-service profile:', err);
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
      console.error('Failed to load full payslip:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading employee portal...</div>;
  }

  const assignment = profile?.salaryAssignments?.[0];
  const bank = profile?.bankAccounts?.[0];

  const filteredClaims = claims.filter(c => {
    if (claimsTab === 'expense') return (c.claimType || 'EXPENSE') === 'EXPENSE';
    if (claimsTab === 'reimbursement') return c.claimType === 'REIMBURSEMENT';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title={`Employee Portal: ${user?.fullName || 'Staff Member'}`}
        subtitle={`Emp Code: ${profile?.employeeCode || 'N/A'} • ${profile?.designation?.name || 'Staff'} • ${profile?.department?.name || 'Department'}`}
        breadcrumbs={[
          { label: 'Employee Portal' },
          { label: 'My Self-Service (ESS)' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>ESS Verified</span>}
        actions={
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate?.('expenses')}>
            <Receipt size={14} /> My Claims & Expenses
          </button>
        }
      />

      {/* Profile & Statutory Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {/* Personal & Employment Info */}
        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <User size={16} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Employment Profile</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Work Email:</span>
              <strong>{profile?.workEmail || user?.email || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Date of Joining:</span>
              <strong>{profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString('en-IN') : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Branch Office:</span>
              <strong>{profile?.branch?.name || 'Headquarters'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Reporting Manager:</span>
              <strong>{profile?.reportingManager ? `${profile.reportingManager.firstName} ${profile.reportingManager.lastName}` : 'Direct Lead'}</strong>
            </div>
          </div>
        </div>

        {/* Compensation & Structure */}
        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <Building size={16} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Active Compensation</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Salary Structure:</span>
              <strong>{assignment?.structure?.name || 'Standard Corporate CTC'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Monthly Base:</span>
              <strong className="money">₹{Number(assignment?.baseSalary || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Effective From:</span>
              <strong>{assignment?.effectiveFrom ? new Date(assignment.effectiveFrom).toLocaleDateString('en-IN') : 'Active'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge badge-approved">Active Enrollment</span>
            </div>
          </div>
        </div>

        {/* Bank & Statutory Identifiers */}
        <div className="panel" style={{ padding: '16px', margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <Landmark size={16} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Disbursement & Statutory</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bank Name:</span>
              <strong>{bank?.bankName || 'State Bank of India'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{bank?.accountNumber ? `••••${bank.accountNumber.slice(-4)}` : '••••3892'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{bank?.ifscCode || 'SBIN0001245'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>PAN Identifier:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{profile?.pan || 'ABCDE1234F'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Claims & Expense Overview */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={16} color="var(--primary)" /> Recent Corporate Reimbursement Claims ({claims.length})
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn btn-xs ${claimsTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setClaimsTab('all')}
            >
              All
            </button>
            <button
              className={`btn btn-xs ${claimsTab === 'expense' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setClaimsTab('expense')}
            >
              Expenses
            </button>
            <button
              className={`btn btn-xs ${claimsTab === 'reimbursement' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setClaimsTab('reimbursement')}
            >
              Reimbursements
            </button>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim # / Ref</th>
                <th>Type</th>
                <th>Claim Date</th>
                <th className="money">Claimed Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No reimbursement claims filed yet.
                  </td>
                </tr>
              ) : (
                filteredClaims.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.claimNumber || c.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.title}</div>
                    </td>
                    <td>
                      <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>
                        {c.claimType || 'EXPENSE'}
                      </span>
                    </td>
                    <td>{new Date(c.claimDate).toLocaleDateString('en-IN')}</td>
                    <td className="money" style={{ fontWeight: 600 }}>₹{Number(c.totalAmount).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge ${c.status === 'APPROVED' ? 'badge-approved' : c.status === 'PAID' ? 'badge-finalized' : c.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onNavigate?.('expenses')}
                      >
                        <Eye size={12} /> View in Studio
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Payslips Catalog */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--primary)" /> My Official Monthly Payslips
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Approved Disbursement Vouchers</span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
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
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payslips.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No finalized payslips available yet.
                  </td>
                </tr>
              ) : (
                payslips.map(ps => (
                  <tr key={ps.recordId}>
                    <td><strong>{ps.periodName}</strong></td>
                    <td>{ps.financialYear}</td>
                    <td>{ps.payableDays} Days</td>
                    <td className="money">₹{ps.basicPay.toLocaleString('en-IN')}</td>
                    <td className="money">₹{ps.grossAmount.toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--danger)' }}>₹{ps.deductionAmount.toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{ps.netAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
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

      {/* Payslip Modal (Pattern B - Large) */}
      {selectedPayslip && (
        <FormModal
          isOpen={Boolean(selectedPayslip)}
          onClose={() => setSelectedPayslip(null)}
          title={`Salary Slip: ${selectedPayslip.period || 'Monthly Period'}`}
          subtitle={`${selectedPayslip.institution?.name || 'PayFlow HRMS'} • Employee Code: ${selectedPayslip.employee?.code || ''}`}
          icon={<FileText size={18} />}
          width="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-outline" onClick={() => window.print()}>
                <Printer size={14} /> Print Payslip
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedPayslip(null)}>
                Close
              </button>
            </div>
          }
        >
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
                    {selectedPayslip.earnings?.map((e: any, idx: number) => (
                      <tr key={idx}><td>{e.name}</td><td style={{ textAlign: 'right' }}>₹{e.amount.toLocaleString('en-IN')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 style={{ color: '#991b1b', marginBottom: '8px' }}>Deductions & Recoveries</h4>
                <table className="payslip-table">
                  <thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Amount (₹)</th></tr></thead>
                  <tbody>
                    {selectedPayslip.deductions?.map((d: any, idx: number) => (
                      <tr key={idx}><td>{d.name}</td><td style={{ textAlign: 'right' }}>₹{d.amount.toLocaleString('en-IN')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="payslip-summary-box">
              <div>
                <div>Gross Pay: <strong>₹{selectedPayslip.summary?.gross?.toLocaleString('en-IN')}</strong></div>
                <div>Total Deductions: <strong>₹{selectedPayslip.summary?.deductions?.toLocaleString('en-IN')}</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem' }}>Net Take-Home Pay</span>
                <h1 style={{ color: '#15803d', margin: 0 }}>₹{selectedPayslip.summary?.net?.toLocaleString('en-IN')}</h1>
              </div>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
};
