import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import {
  FileText,
  Printer,
  Calendar,
  Building,
  Landmark,
  CreditCard,
  Download,
  AlertCircle
} from 'lucide-react';

export const MyPayslipsView: React.FC = () => {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayslips = async () => {
      try {
        setLoading(true);
        const res: any = await api.get('/self-service/payslips');
        setPayslips(res.payslips || []);
      } catch (err) {
        console.error('Failed to load payslips:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPayslips();
  }, []);

  const openFullPayslip = async (recordId: string) => {
    try {
      const res: any = await api.get(`/self-service/payslips/${recordId}`);
      setSelectedPayslip(res.payslip);
    } catch (err) {
      console.error('Failed to load full payslip:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeader
        title="My Monthly Payslips"
        subtitle={`Official Salary Statements & Disbursement Vouchers for ${user?.fullName || 'Employee'}`}
        breadcrumbs={[
          { label: 'Employee Portal' },
          { label: 'My Payslips' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Bank Disbursed</span>}
      />

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--primary)" /> Finalized Monthly Payslips ({payslips.length})
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Digitally certified salary vouchers
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Payroll Period</th>
                <th>Financial Year</th>
                <th>Payable Days</th>
                <th className="money">Basic Pay</th>
                <th className="money">Gross Earnings</th>
                <th className="money">Total Deductions</th>
                <th className="money">Net Take-Home</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading your official payslips...
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No finalized payslips available yet for this fiscal cycle.
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
                        <FileText size={12} /> View Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Payslip Modal */}
      {selectedPayslip && (
        <FormModal
          isOpen={Boolean(selectedPayslip)}
          onClose={() => setSelectedPayslip(null)}
          title={`Salary Voucher: ${selectedPayslip.period || 'Period'}`}
          subtitle={`${selectedPayslip.institution?.name || 'Company'} • Code: ${selectedPayslip.employee?.code || ''}`}
          icon={<FileText size={18} />}
          width="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-outline" onClick={() => window.print()}>
                <Printer size={14} /> Print Voucher
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedPayslip(null)}>
                Close
              </button>
            </div>
          }
        >
          <div className="payslip-sheet">
            <div className="payslip-header" style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>{selectedPayslip.institution?.name}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Salary Pay Slip for {selectedPayslip.period}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.8125rem', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div>
                <div><strong>Employee:</strong> {selectedPayslip.employee?.name}</div>
                <div><strong>Emp Code:</strong> {selectedPayslip.employee?.code}</div>
                <div><strong>Designation:</strong> {selectedPayslip.employee?.designation}</div>
                <div><strong>Department:</strong> {selectedPayslip.employee?.department}</div>
              </div>
              <div>
                <div><strong>Bank Name:</strong> {selectedPayslip.payment?.bankName || 'Direct Deposit'}</div>
                <div><strong>Account:</strong> {selectedPayslip.payment?.accountNumber || '••••••••'}</div>
                <div><strong>Payable Days:</strong> {selectedPayslip.attendance?.payableDays}</div>
                <div><strong>Payment Ref:</strong> {selectedPayslip.payment?.paymentRef || 'NEFT-VERIFIED'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--success)' }}>
                  Earnings (Gross)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Basic Pay:</span>
                    <strong>₹{Number(selectedPayslip.earnings?.basic || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Allowances:</span>
                    <strong>₹{(Number(selectedPayslip.earnings?.gross || 0) - Number(selectedPayslip.earnings?.basic || 0)).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 700 }}>
                    <span>Total Gross:</span>
                    <span>₹{Number(selectedPayslip.earnings?.gross || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--danger)' }}>
                  Deductions
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Statutory & Tax:</span>
                    <strong>₹{Number(selectedPayslip.deductions?.total || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '4px', fontWeight: 700 }}>
                    <span>Total Deductions:</span>
                    <span style={{ color: 'var(--danger)' }}>₹{Number(selectedPayslip.deductions?.total || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#166534' }}>Net Salary Credited:</span>
              <strong style={{ fontSize: '1.25rem', color: '#166534' }}>
                ₹{Number(selectedPayslip.netSalary || 0).toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
};
