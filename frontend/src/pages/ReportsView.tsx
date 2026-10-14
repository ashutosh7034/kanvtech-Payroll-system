import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BarChart3, Building, ShieldAlert, FileText, Printer } from 'lucide-react';

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
        const fyRes: any = await api.get('/masters/financial-years');
        const activeFy = fyRes.financialYears.find((f: any) => f.active) || fyRes.financialYears[0];
        if (activeFy) {
          const pRes: any = await api.get(`/masters/financial-years/${activeFy.id}/periods`);
          setPeriods(pRes.periods);
          if (pRes.periods[0]) setSelectedPeriodId(pRes.periods[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadPeriods();
  }, []);

  const loadReportData = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      if (activeTab === 'heads') {
        const res: any = await api.get(`/reports/head-summary?periodId=${selectedPeriodId}`);
        setHeadSummary(res);
      } else if (activeTab === 'depts') {
        const res: any = await api.get(`/reports/department-summary?periodId=${selectedPeriodId}`);
        setDeptSummary(res.departmentSummary);
      } else if (activeTab === 'audits') {
        const res: any = await api.get('/reports/audit-logs');
        setAuditLogs(res.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedPeriodId, activeTab]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Institutional Financial Reports & Audit Analytics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Head-wise Summaries, Departmental Allocations & Compliance Logs (PDF pp. 35-40)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTab !== 'audits' && (
            <select className="form-select" style={{ width: 'auto' }} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      <div className="tabs-bar">
        <button className={`tab-btn ${activeTab === 'heads' ? 'active' : ''}`} onClick={() => setActiveTab('heads')}>
          <BarChart3 size={14} style={{ display: 'inline', marginRight: '6px' }} /> Head-Wise Salary Summary
        </button>
        <button className={`tab-btn ${activeTab === 'depts' ? 'active' : ''}`} onClick={() => setActiveTab('depts')}>
          <Building size={14} style={{ display: 'inline', marginRight: '6px' }} /> Department-Wise Pay Bill
        </button>
        <button className={`tab-btn ${activeTab === 'audits' ? 'active' : ''}`} onClick={() => setActiveTab('audits')}>
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: '6px' }} /> Immutable Audit Trail
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Generating authorized report query...</div>
      ) : activeTab === 'heads' ? (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Component-Wise Salary Head Distribution ({headSummary?.periodName})</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {headSummary?.runStatus || 'No Run'}</span>
          </div>
          {headSummary?.headSummary?.length > 0 ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Total Staff: <br /><strong>{headSummary.totalEmployees} employees</strong>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Gross Earnings: <br /><strong className="money" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>₹{Number(headSummary.grossTotal).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Net Disbursable: <br /><strong className="money" style={{ color: 'var(--success)', fontSize: '1.2rem' }}>₹{Number(headSummary.netTotal).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <div className="table-container">
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
                          <span className={`badge ${h.headType === 'EARNING' ? 'badge-approved' : (h.headType === 'DEDUCTION' ? 'badge-returned' : 'badge-neutral')}`}>
                            {h.headType}
                          </span>
                        </td>
                        <td>{h.count} staff</td>
                        <td className="money" style={{ fontWeight: 600 }}>₹{Number(h.totalAmount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No salary runs generated for this period.</p>
          )}
        </div>
      ) : activeTab === 'depts' ? (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Departmental Allocation & Total Payroll Expenditure</h3>
          </div>
          <div className="table-container">
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
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No department records for selected cycle.</td></tr>
                ) : (
                  deptSummary.map((d, i) => (
                    <tr key={i}>
                      <td><strong>{d.departmentName}</strong></td>
                      <td>{d.ouName}</td>
                      <td>{d.employeeCount} members</td>
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
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Institutional Audit Trail & Operational Events</h3>
          </div>
          <div className="table-container">
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
                {auditLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                    <td><span className="badge badge-neutral">{l.action}</span></td>
                    <td>{l.user?.fullName || l.user?.username || 'System'}</td>
                    <td>{l.entityType} {l.entityId ? `(#${l.entityId.slice(-6)})` : ''}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{l.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
