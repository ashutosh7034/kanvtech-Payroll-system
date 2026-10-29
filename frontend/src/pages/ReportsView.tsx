import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PageHeader } from '../components/common/PageHeader';
import { BarChart3, Building, ShieldAlert, FileText, Printer, Calendar, Users, DollarSign } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'heads' | 'depts' | 'audits'>('heads');
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const [headSummary, setHeadSummary] = useState<any | null>(null);
  const [deptSummary, setDeptSummary] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const pRes: any = await api.get('/payroll/periods').catch(() => ({ periods: [] }));
        const list = pRes.periods || [];
        setPeriods(list);
        if (list[0]) setSelectedPeriodId(list[0].id);
      } catch (err) {
        console.error('Failed to load payroll periods:', err);
      }
    };
    loadPeriods();
  }, []);

  const loadReportData = async () => {
    if (!selectedPeriodId && activeTab !== 'audits') return;
    setLoading(true);
    try {
      if (activeTab === 'heads') {
        const res: any = await api.get(`/reports/head-summary?periodId=${selectedPeriodId}`);
        setHeadSummary(res);
      } else if (activeTab === 'depts') {
        const res: any = await api.get(`/reports/department-summary?periodId=${selectedPeriodId}`);
        setDeptSummary(res.departmentSummary || []);
      } else if (activeTab === 'audits') {
        const res: any = await api.get('/reports/audit-logs');
        setAuditLogs(res.logs || []);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedPeriodId, activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="Institutional Financial Reports & Audit Analytics"
        subtitle="Head-wise Summaries, Departmental Cost Allocations & Immutable Compliance Logs"
        breadcrumbs={[
          { label: 'Compliance & Reports' },
          { label: 'Registers & NEFT Export' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Audit Ready</span>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeTab !== 'audits' && (
              <select
                className="form-select"
                style={{ width: 'auto', height: '32px', padding: '0 10px', fontSize: '0.8125rem' }}
                value={selectedPeriodId}
                onChange={e => setSelectedPeriodId(e.target.value)}
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Print Report
            </button>
          </div>
        }
      />

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'heads' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('heads')}
        >
          <BarChart3 size={14} /> Head-Wise Salary Summary
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'depts' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('depts')}
        >
          <Building size={14} /> Department-Wise Pay Bill
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'audits' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('audits')}
        >
          <ShieldAlert size={14} /> Immutable Audit Trail
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Generating authorized report query...
        </div>
      ) : activeTab === 'heads' ? (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="panel-title">Component-Wise Salary Head Distribution ({headSummary?.periodName || 'Selected Period'})</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {headSummary?.runStatus || 'No Run'}</span>
          </div>

          {headSummary?.headSummary?.length > 0 ? (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} color="var(--primary)" /> Total Staff Paid
                  </div>
                  <strong style={{ fontSize: '1.25rem', marginTop: '4px', display: 'block' }}>{headSummary.totalEmployees} Employees</strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} color="var(--primary)" /> Gross Earnings
                  </div>
                  <strong className="money" style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginTop: '4px', display: 'block' }}>
                    ₹{Number(headSummary.grossTotal).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} color="var(--success)" /> Net Disbursable
                  </div>
                  <strong className="money" style={{ color: 'var(--success)', fontSize: '1.25rem', marginTop: '4px', display: 'block' }}>
                    ₹{Number(headSummary.netTotal).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Salary Head</th>
                      <th>Head Code</th>
                      <th>Type</th>
                      <th>Staff Count</th>
                      <th className="money">Disbursed Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headSummary.headSummary.map((h: any, i: number) => (
                      <tr key={i}>
                        <td><strong>{h.headName}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{h.headCode}</td>
                        <td>
                          <span className={`badge ${h.headType === 'EARNING' ? 'badge-approved' : (h.headType === 'DEDUCTION' ? 'badge-danger' : 'badge-neutral')}`}>
                            {h.headType}
                          </span>
                        </td>
                        <td>{h.count} Staff</td>
                        <td className="money" style={{ fontWeight: 600 }}>₹{Number(h.totalAmount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              No salary runs generated or finalized for this period.
            </p>
          )}
        </div>
      ) : activeTab === 'depts' ? (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="panel-title">Departmental Allocation & Total Payroll Expenditure</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cost center distribution by operating unit</span>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Faculty / OU</th>
                  <th>Staff Count</th>
                  <th className="money">Gross Bill (₹)</th>
                  <th className="money">Net Bill (₹)</th>
                </tr>
              </thead>
              <tbody>
                {deptSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No department records found for the selected cycle.
                    </td>
                  </tr>
                ) : (
                  deptSummary.map((d, i) => (
                    <tr key={i}>
                      <td><strong>{d.departmentName}</strong></td>
                      <td>{d.ouName}</td>
                      <td>{d.employeeCount} Members</td>
                      <td className="money">₹{Number(d.grossTotal).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>
                        ₹{Number(d.netTotal).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="panel-title">Institutional Audit Trail & Operational Events</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Append-only immutable system event log</span>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No audit log records found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-neutral">{l.action}</span></td>
                      <td>{l.user?.fullName || l.user?.username || 'System'}</td>
                      <td>{l.entityType} {l.entityId ? `(#${l.entityId.slice(-6)})` : ''}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{l.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
