import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { EmployeesView } from './pages/EmployeesView';
import { MastersView } from './pages/MastersView';
import { PayrollProcessingView } from './pages/PayrollProcessingView';
import { TaxView } from './pages/TaxView';
import { LoansView } from './pages/LoansView';
import { LeaveView } from './pages/LeaveView';
import { ArrearsView } from './pages/ArrearsView';
import { IncrementsView } from './pages/IncrementsView';
import { GpfView } from './pages/GpfView';
import { ImportsView } from './pages/ImportsView';
import { PaymentBatchesView } from './pages/PaymentBatchesView';
import { ReportsView } from './pages/ReportsView';
import { SelfServiceView } from './pages/SelfServiceView';

import {
  LayoutDashboard,
  Users,
  Sliders,
  PlayCircle,
  Receipt,
  Landmark,
  CalendarCheck,
  History,
  TrendingUp,
  PiggyBank,
  Upload,
  CreditCard,
  BarChart3,
  UserCheck,
  LogOut
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, token, isLoading, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-muted)' }}>
        Initializing Payroll Management System...
      </div>
    );
  }

  if (!token || !user) {
    return <LoginView />;
  }

  const isSelfServiceOnly = user.roles.length === 1 && user.roles.includes('employee_self_service');

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-badge">PM</div>
          <div className="brand-info">
            <h2>{user.institutionBrand || 'NIHER Payroll'}</h2>
            <p>Enterprise Edition</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Core Operations</div>
          <div className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>
            <LayoutDashboard size={16} /> Overview
          </div>

          {!isSelfServiceOnly && (
            <>
              <div className={`nav-item ${currentPage === 'payroll' ? 'active' : ''}`} onClick={() => setCurrentPage('payroll')}>
                <PlayCircle size={16} /> Payroll Lifecycle
              </div>
              <div className={`nav-item ${currentPage === 'employees' ? 'active' : ''}`} onClick={() => setCurrentPage('employees')}>
                <Users size={16} /> Employee Directory
              </div>
              <div className={`nav-item ${currentPage === 'masters' ? 'active' : ''}`} onClick={() => setCurrentPage('masters')}>
                <Sliders size={16} /> 7th CPC Masters
              </div>

              <div className="nav-section-title">Salary Allowances & Dues</div>
              <div className={`nav-item ${currentPage === 'tax' ? 'active' : ''}`} onClick={() => setCurrentPage('tax')}>
                <Receipt size={16} /> Income Tax (TDS)
              </div>
              <div className={`nav-item ${currentPage === 'loans' ? 'active' : ''}`} onClick={() => setCurrentPage('loans')}>
                <Landmark size={16} /> Loans & Advances
              </div>
              <div className={`nav-item ${currentPage === 'leave' ? 'active' : ''}`} onClick={() => setCurrentPage('leave')}>
                <CalendarCheck size={16} /> Leave-Linked Pay
              </div>
              <div className={`nav-item ${currentPage === 'arrears' ? 'active' : ''}`} onClick={() => setCurrentPage('arrears')}>
                <History size={16} /> Arrears & Fixation
              </div>
              <div className={`nav-item ${currentPage === 'increments' ? 'active' : ''}`} onClick={() => setCurrentPage('increments')}>
                <TrendingUp size={16} /> Annual Increments
              </div>
              <div className={`nav-item ${currentPage === 'gpf' ? 'active' : ''}`} onClick={() => setCurrentPage('gpf')}>
                <PiggyBank size={16} /> GPF Ledger
              </div>

              <div className="nav-section-title">Disbursement & Reports</div>
              <div className={`nav-item ${currentPage === 'imports' ? 'active' : ''}`} onClick={() => setCurrentPage('imports')}>
                <Upload size={16} /> Bulk Upload Center
              </div>
              <div className={`nav-item ${currentPage === 'payments' ? 'active' : ''}`} onClick={() => setCurrentPage('payments')}>
                <CreditCard size={16} /> Bank Advice Batches
              </div>
              <div className={`nav-item ${currentPage === 'reports' ? 'active' : ''}`} onClick={() => setCurrentPage('reports')}>
                <BarChart3 size={16} /> Reports & Audits
              </div>
            </>
          )}

          <div className="nav-section-title">Self-Service</div>
          <div className={`nav-item ${currentPage === 'self' ? 'active' : ''}`} onClick={() => setCurrentPage('self')}>
            <UserCheck size={16} /> My Payslips & Portal
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-snippet">
            <div className="user-avatar">{user.fullName[0]}</div>
            <div className="user-details">
              <div className="user-name">{user.fullName}</div>
              <div className="user-role">{user.roles[0]}</div>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{currentPage.toUpperCase().replace('-', ' ')}</h1>
          </div>
          <div className="topbar-actions">
            <span className="badge badge-approved" style={{ fontSize: '0.72rem' }}>
              Connected: PostgreSQL Local
            </span>
          </div>
        </header>

        <main className="content-body">
          {currentPage === 'dashboard' && <DashboardView onNavigate={setCurrentPage} />}
          {currentPage === 'employees' && <EmployeesView />}
          {currentPage === 'masters' && <MastersView />}
          {currentPage === 'payroll' && <PayrollProcessingView />}
          {currentPage === 'tax' && <TaxView />}
          {currentPage === 'loans' && <LoansView />}
          {currentPage === 'leave' && <LeaveView />}
          {currentPage === 'arrears' && <ArrearsView />}
          {currentPage === 'increments' && <IncrementsView />}
          {currentPage === 'gpf' && <GpfView />}
          {currentPage === 'imports' && <ImportsView />}
          {currentPage === 'payments' && <PaymentBatchesView />}
          {currentPage === 'reports' && <ReportsView />}
          {currentPage === 'self' && <SelfServiceView />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
