import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../services/api';
import { ShieldCheck, LogIn, Briefcase, Users, Calculator, UserCheck, Lock } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revokedMessage, setRevokedMessage] = useState<string | null>(() => {
    const msg = sessionStorage.getItem('pm_session_revoked_msg');
    if (msg) {
      sessionStorage.removeItem('pm_session_revoked_msg');
      return msg;
    }
    return null;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRevokedMessage(null);
    setLoading(true);

    try {
      const res: any = await api.post('/auth/login', { username, password });
      login(res.token, res.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Login failed. Please verify API is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const setDemoUser = (user: string) => {
    setUsername(user);
    setPassword('Admin@123');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px'
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: 'var(--primary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
            }}
          >
            PF
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            PayFlow
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Corporate HRMS & Payroll Management Suite
          </p>
        </div>

        {revokedMessage && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#b45309',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Lock size={14} /> {revokedMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Lock size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">
              Work Username / Email <span className="required-star">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or rahul.mehta"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password <span className="required-star">*</span>
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '4px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : <><LogIn size={16} /> Sign In to Corporate Suite</>}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '10px',
              textAlign: 'center'
            }}
          >
            Role Profile Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              type="button"
              className={`btn ${username === 'admin' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setDemoUser('admin')}
            >
              <ShieldCheck size={12} /> Company Admin
            </button>
            <button
              type="button"
              className={`btn ${username === 'hr.manager' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setDemoUser('hr.manager')}
            >
              <Users size={12} /> HR Lead
            </button>
            <button
              type="button"
              className={`btn ${username === 'payroll.officer' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setDemoUser('payroll.officer')}
            >
              <Calculator size={12} /> Payroll Admin
            </button>
            <button
              type="button"
              className={`btn ${username === 'finance.lead' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setDemoUser('finance.lead')}
            >
              <Briefcase size={12} /> Finance Lead
            </button>
            <button
              type="button"
              className={`btn ${username === 'rahul.mehta' ? 'btn-primary' : 'btn-outline'} btn-sm`}
              style={{ gridColumn: 'span 2' }}
              onClick={() => setDemoUser('rahul.mehta')}
            >
              <UserCheck size={12} /> Employee Portal (Rahul Mehta)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
