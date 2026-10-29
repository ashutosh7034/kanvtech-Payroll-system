import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  Calculator,
  Calendar,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Building,
  ShieldCheck,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface DetailedCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: any; // review table row or slip
  payrollRun: any;
}

export const DetailedCalculationModal: React.FC<DetailedCalculationModalProps> = ({
  isOpen,
  onClose,
  row,
  payrollRun
}) => {
  if (!isOpen || !row) return null;

  const items = row.items || [];
  const earnings = items.filter((i: any) => i.type === 'EARNING');
  const deductions = items.filter((i: any) => i.type === 'DEDUCTION');
  const employerItems = items.filter((i: any) => i.type === 'EMPLOYER_CONTRIBUTION');

  const grossEarnings = Number(row.grossEarnings ?? row.grossPay ?? 0);
  const totalDeductions = Number(row.employeeDeductions ?? row.deductionsPay ?? 0);
  const netPay = Number(row.netPay ?? 0);
  const employerCost = Number(row.employerContributions ?? 0);
  const manualAdjustments = Number(row.manualAdjustments ?? 0);
  const payableDays = Number(row.payableDays ?? 30);
  const lopDays = Number(row.lopDays ?? row.leaveLossOfPayDays ?? 0);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '780px', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} style={{ color: 'var(--primary)' }} />
              Detailed Salary Calculation & Formula Breakdown
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Employee: <strong>{row.employeeName}</strong> ({row.employeeCode}) •
              Dept: <strong>{row.department}</strong> •
              Cycle: <strong>{payrollRun?.period?.name || payrollRun?.runNumber}</strong>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', padding: '16px 20px' }}>
          {/* Summary Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payable Days</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>
                {payableDays} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>/ 30</span>
              </div>
              <div style={{ fontSize: '0.675rem', color: lopDays > 0 ? '#b45309' : 'var(--text-muted)' }}>
                {lopDays > 0 ? `${lopDays} LOP Days Deducted` : 'Full Attendance'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Gross Earnings</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>
                {formatCurrency(grossEarnings)}
              </div>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                {manualAdjustments !== 0 ? `Incl. ₹${manualAdjustments > 0 ? '+' : ''}${manualAdjustments} Adj` : 'Pure formula earnings'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>Total Deductions</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)', marginTop: '2px' }}>
                {formatCurrency(totalDeductions)}
              </div>
              <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>PF, ESIC, PT, TDS</div>
            </div>

            <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>Net Disbursable</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#166534', marginTop: '2px' }}>
                {formatCurrency(netPay)}
              </div>
              <div style={{ fontSize: '0.675rem', color: '#166534' }}>Take-home bank credit</div>
            </div>
          </div>

          {/* Side-by-side Tables: Earnings vs Deductions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Earnings Column */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} /> Earnings & Allowances
                </strong>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  {formatCurrency(grossEarnings)}
                </span>
              </div>

              <table className="data-table" style={{ margin: 0, fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th className="money">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                        Base CTC Gross: {formatCurrency(grossEarnings)}
                      </td>
                    </tr>
                  ) : (
                    earnings.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td>{item.name || item.code}</td>
                        <td className="money" style={{ fontWeight: 600 }}>
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Deductions Column */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingDown size={14} /> Employee Deductions
                </strong>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)' }}>
                  {formatCurrency(totalDeductions)}
                </span>
              </div>

              <table className="data-table" style={{ margin: 0, fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th className="money">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                        No deductions recorded
                      </td>
                    </tr>
                  ) : (
                    deductions.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td>{item.name || item.code}</td>
                        <td className="money" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employer Statutory Contributions */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} /> Employer Statutory Cost & Benefits
              </strong>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {formatCurrency(employerCost)}
              </span>
            </div>

            <table className="data-table" style={{ margin: 0, fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Contribution Item</th>
                  <th>Statutory Basis</th>
                  <th className="money">Employer Cost (₹)</th>
                </tr>
              </thead>
              <tbody>
                {employerItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                      Calculated Employer PF (12%) / ESIC (3.25%) provision included in CTC: {formatCurrency(employerCost)}
                    </td>
                  </tr>
                ) : (
                  employerItems.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>{item.name || item.code}</td>
                      <td>Statutory Compliance</td>
                      <td className="money" style={{ fontWeight: 600 }}>
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close Calculation View
          </button>
        </div>
      </div>
    </div>
  );
};
