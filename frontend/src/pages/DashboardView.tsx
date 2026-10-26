import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { Users, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Landmark, Layers } from 'lucide-react';

export const DashboardView: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { user, canViewModule } = useAuth();
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
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading executive dashboard...</div>;
  }

  const runs = metrics?.payrollRuns ?? { generated: 0, verified: 0, finalized: 0, approved: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title={`Welcome back, ${user?.fullName || 'User'}`}
        subtitle={`Active Financial Year: ${metrics?.activeFinancialYear || '2026-2027'} • Current System Period: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
        breadcrumbs={[
          { label: 'Overview' },
          { label: 'Executive Dashboard' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>{user?.companyBrand || 'Enterprise HRMS'}</span>}
        actions={
          canViewModule('payroll') && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('payroll')}>
              Open Payroll Engine <ArrowRight size={14} />
            </button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        {canViewModule('employees') && (
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Active Staff</span>
              <Users size={18} color="var(--primary)" />
            </div>
            <div className="kpi-value">{metrics?.totalActiveEmployees ?? 0}</div>
            <div className="kpi-subtext">Teaching & Non-Teaching enrolled</div>
          </div>
        )}

        {canViewModule('payroll') && (
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Financial Year</span>
              <Calendar size={18} color="var(--info)" />
            </div>
            <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{metrics?.activeFinancialYear || '2026-2027'}</div>
            <div className="kpi-subtext">{metrics?.totalPeriods ?? 12} Payroll periods configured</div>
          </div>
        )}

        {canViewModule('loans') && (
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Active Advances</span>
              <Landmark size={18} color="var(--warning)" />
            </div>
            <div className="kpi-value">{metrics?.activeLoansCount ?? 0}</div>
            <div className="kpi-subtext">Running advance recoveries</div>
          </div>
        )}

        {canViewModule('payroll') && (
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Approved Runs</span>
              <CheckCircle2 size={18} color="var(--success)" />
            </div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{runs.approved}</div>
            <div className="kpi-subtext">Disbursement-ready payroll cycles</div>
          </div>
        )}
      </div>

      {/* Payroll Workflow Pipeline Tracker */}
      {canViewModule('payroll') && (
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-header" style={{ marginBottom: '14px' }}>
            <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--primary)" /> Payroll Workflow Processing Pipeline
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>4-Stage Verification & Approval Lifecycle</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-generated">1. Generated</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{runs.generated}</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Pending verification by Verifying Officer (PVO).</p>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-verified">2. Verified</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{runs.verified}</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Ready for calculation snapshot freeze by PFO.</p>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-finalized">3. Finalized</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{runs.finalized}</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Calculation frozen; waiting for AR Salary approval.</p>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-approved">4. Approved</span>
                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{runs.approved}</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Official disbursement approved. Bank advice generated.</p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Stream */}
      {canViewModule('reports') && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="var(--primary)" />
              <h3 className="panel-title">System Audit & Compliance Stream</h3>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('reports')}>
              View All Logs
            </button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
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
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No audit records recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
