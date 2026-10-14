import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Landmark } from 'lucide-react';

export const DashboardView: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res: any = await api.get('/reports/dashboard-metrics');
        setMetrics(res.metrics);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading executive payroll dashboard...</div>;
  }

  const runs = metrics?.payrollRuns ?? { generated: 0, verified: 0, finalized: 0, approved: 0 };

  return (
    <div>
      {/* Top Banner */}
      <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(16,185,129,0.05))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {user?.institutionBrand || 'Payroll Management System'}
          </span>
          <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 700, marginTop: '2px' }}>
            Welcome back, {user?.fullName}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Active Financial Year: <strong>{metrics?.activeFinancialYear}</strong> • Current System Time: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('payroll')}>
          Open Payroll Queues <ArrowRight size={14} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Active Staff</span>
            <Users size={18} color="var(--primary)" />
          </div>
          <div className="kpi-value">{metrics?.totalActiveEmployees ?? 0}</div>
          <div className="kpi-subtext">Teaching & Non-Teaching enrolled</div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Financial Year</span>
            <Calendar size={18} color="var(--info)" />
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{metrics?.activeFinancialYear}</div>
          <div className="kpi-subtext">{metrics?.totalPeriods} Payroll periods configured</div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Active Loans</span>
            <Landmark size={18} color="var(--warning)" />
          </div>
          <div className="kpi-value">{metrics?.activeLoansCount ?? 0}</div>
          <div className="kpi-subtext">Running advance recoveries</div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Approved Runs</span>
            <CheckCircle2 size={18} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{runs.approved}</div>
          <div className="kpi-subtext">Disbursement-ready payroll cycles</div>
        </div>
      </div>

      {/* Payroll Workflow Pipeline Tracker */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Payroll Workflow Processing Pipeline</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>4-Stage Lifecycle (PDF pp. 19-20)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="badge badge-generated">1. Generated</span>
              <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{runs.generated}</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending verification by Verifying Officer (PVO).</p>
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="badge badge-verified">2. Verified</span>
              <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{runs.verified}</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ready for calculation snapshot freeze by PFO.</p>
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="badge badge-finalized">3. Finalized</span>
              <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{runs.finalized}</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Calculation frozen; waiting for AR Salary approval.</p>
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="badge badge-approved">4. Approved</span>
              <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>{runs.approved}</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Official disbursement approved. Bank advice generated.</p>
          </div>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--primary)" />
            <h3 className="panel-title">System Audit & Compliance Stream</h3>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('reports')}>
            View All Logs
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity Target</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.recentAudits && metrics.recentAudits.length > 0 ? (
                metrics.recentAudits.map((log: any) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{log.action}</span>
                    </td>
                    <td>{log.user?.fullName ?? log.user?.username ?? 'System Operator'}</td>
                    <td>{log.entityType} {log.entityId ? `(#${log.entityId.slice(-6)})` : ''}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    No audit records recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
