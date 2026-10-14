import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../services/api';
import { ShieldCheck, LogIn, KeyRound, UserCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge">PM</div>
          <h2>Payroll Management System</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enterprise Institutional Payroll Platform</p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Email</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }} disabled={loading}>
            {loading ? 'Authenticating...' : <><LogIn size={16} /> Sign In to Workspace</>}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Quick Role Switcher (Preconfigured Demo Accounts):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('admin')}>
              <ShieldCheck size={12} /> payroll_admin
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('pda_officer')}>
              <KeyRound size={12} /> payroll_pda (Gen)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('pvo_officer')}>
              <UserCheck size={12} /> payroll_pvo (Ver)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('pfo_officer')}>
              <ShieldCheck size={12} /> payroll_pfo (Fin)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('ar_salary')}>
              <ShieldCheck size={12} /> payroll_ar_salary
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDemoUser('vikram.sharma')}>
              <UserCheck size={12} /> Employee Self
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
