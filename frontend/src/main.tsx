import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { api } from './services/api';
import { LoginView } from './pages/LoginView';
import { DashboardView } from './pages/DashboardView';
import { EmployeesView } from './pages/EmployeesView';
import { RecruitmentView } from './pages/RecruitmentView';
import { AttendanceView } from './pages/AttendanceView';
import { LeaveView } from './pages/LeaveView';
import { CompensationView } from './pages/CompensationView';
import { PayrollProcessingView } from './pages/PayrollProcessingView';
import { ExpensesView } from './pages/ExpensesView';
import { OffboardingView } from './pages/OffboardingView';
import { AssetsHelpDeskView } from './pages/AssetsHelpDeskView';
import { ReportsView } from './pages/ReportsView';
import { SelfServiceView } from './pages/SelfServiceView';
import { LoansView } from './pages/LoansView';
import { SalaryColumnMasterView } from './pages/SalaryColumnMasterView';
import { PayrollPermissionsView } from './pages/PayrollPermissionsView';
import { ManageEmployeeView } from './pages/ManageEmployeeView';
import { MyLeaveView } from './pages/MyLeaveView';
import { MyPayslipsView } from './pages/MyPayslipsView';
import { NotificationBell } from './components/NotificationBell';
import { AccessDeniedView } from './components/common/AccessDeniedView';

import {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  CalendarCheck,
  Calculator,
  PlayCircle,
  Receipt,
  LogOut as LogOutIcon,
  Laptop,
  BarChart3,
  UserCheck,
  Power,
  ChevronRight,
  ShieldCheck,
  Shield,
  Landmark,
  Layers,
  ChevronDown,
  User,
  FileText
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, token, isLoading, logout, login, canViewModule } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [manageEmployeeId, setManageEmployeeId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-muted)' }}>
        Initializing Corporate HRMS & Payroll Suite...
      </div>
    );
  }

  if (!token || !user) {
    return <LoginView />;
  }

  const isSelfServiceOnly = user.roles.length === 1 && user.roles.includes('employee');

  // Quick Persona Switcher for demonstration & multi-role testing
  const handleQuickSwitchUser = async (targetUsername: string) => {
    try {
      const res: any = await api.post('/auth/login', { username: targetUsername, password: 'Admin@123' });
      login(res.token, res.user);
    } catch (err: any) {
      alert(err.message || 'Failed to switch role');
    }
  };

  const getBreadcrumb = () => {
    switch (currentPage) {
      case 'dashboard':
        return { section: 'Overview', page: 'Executive Dashboard' };
      case 'employees':
        return { section: 'People', page: 'Employee Directory & Master' };
      case 'manage-employee':
        return { section: 'HRIS / Employee', page: manageEmployeeId ? 'Edit Employee' : 'Manage Employee' };
      case 'recruitment':
        return { section: 'People', page: 'Recruitment & Candidate Pipeline' };
      case 'offboarding':
        return { section: 'People', page: 'Offboarding & F&F Settlement' };
      case 'attendance':
        return { section: 'Time Management', page: 'Shifts & Daily Punches' };
      case 'leave':
        return { section: 'Time Management', page: 'Leave Quotas & Approvals' };
      case 'column-master':
        return { section: 'Payroll & CTC', page: 'Salary Column Master' };
      case 'compensation':
        return { section: 'Payroll & CTC', page: 'Salary Structures & Components' };
      case 'payroll':
        return { section: 'Payroll & CTC', page: '7-Stage Payroll Workbench' };
      case 'expenses':
        return { section: 'Business Operations', page: 'Reimbursements & Travel Desk' };
      case 'assets-helpdesk':
        return { section: 'Business Operations', page: 'Hardware Assets & IT Helpdesk' };
      case 'reports':
        return { section: 'Compliance & Reports', page: 'Salary Registers & NEFT Export' };
      case 'loans':
        return { section: 'Operations & Finance', page: 'Employee Loans & Salary Advances' };
      case 'self':
        return { section: 'Employee Portal', page: 'My Self-Service (ESS)' };
      case 'my-leave':
        return { section: 'Employee Portal', page: 'My Leave' };
      case 'my-payslips':
        return { section: 'Employee Portal', page: 'My Payslips' };
      case 'payroll-permissions':
        return { section: 'Access Control', page: 'Payroll Permissions Dashboard' };
      default:
        return { section: 'HRMS', page: currentPage };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-badge">PF</div>
          <div className="brand-info">
            <h2>PayFlow</h2>
            <p>Corporate HRMS & Payroll</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main Application Navigation">
          {(
            [
              {
                title: 'Overview',
                items: [
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'dashboard' }
                ]
              },
              {
                title: 'People & Organization',
                items: [
                  { id: 'employees', label: 'Employee Master', icon: Users, permissionKey: 'employees', hideForSelfServiceOnly: true },
                  { id: 'recruitment', label: 'Recruitment & ATS', icon: Briefcase, permissionKey: 'recruitment', hideForSelfServiceOnly: true },
                  { id: 'offboarding', label: 'Offboarding & F&F', icon: LogOutIcon, permissionKey: 'offboarding', hideForSelfServiceOnly: true }
                ]
              },
              {
                title: 'Time & Attendance',
                items: [
                  { id: 'attendance', label: 'Shifts & Attendance', icon: Clock, permissionKey: 'attendance', hideForSelfServiceOnly: true },
                  { id: 'leave', label: 'Team Leave & Approvals', icon: CalendarCheck, permissionKey: 'leave', hideForSelfServiceOnly: true }
                ]
              },
              {
                title: 'Payroll & Compensation',
                items: [
                  { id: 'column-master', label: 'Salary Column Master', icon: Layers, permissionKey: 'column-master', hideForSelfServiceOnly: true },
                  { id: 'compensation', label: 'Salary Structures (CTC)', icon: Calculator, permissionKey: 'compensation', hideForSelfServiceOnly: true },
                  { id: 'payroll', label: '7-Stage Payroll Engine', icon: PlayCircle, permissionKey: 'payroll', hideForSelfServiceOnly: true }
                ]
              },
              {
                title: 'Operations & Finance',
                items: [
                  { id: 'loans', label: 'Loans & Advances', icon: Landmark, permissionKey: 'loans', hideForSelfServiceOnly: true },
                  { id: 'expenses', label: 'Expenses & Travel', icon: Receipt, permissionKey: 'expenses', hideForSelfServiceOnly: true },
                  { id: 'assets-helpdesk', label: 'Assets & Help Desk', icon: Laptop, permissionKey: 'assets-helpdesk', hideForSelfServiceOnly: true }
                ]
              },
              {
                title: 'Compliance & Reports',
                items: [
                  { id: 'reports', label: 'Registers & NEFT Export', icon: BarChart3, permissionKey: 'reports', hideForSelfServiceOnly: true }
                ]
              },
              {
                title: 'Self-Service',
                items: [
                  { id: 'self', label: 'My Self-Service (ESS)', icon: UserCheck, permissionKey: 'self' },
                  { id: 'my-leave', label: 'My Leave', icon: CalendarCheck, permissionKey: 'my-leave' },
                  { id: 'expenses', label: 'My Claims & Expenses', icon: Receipt, permissionKey: 'expenses' },
                  { id: 'my-payslips', label: 'My Payslips', icon: FileText, permissionKey: 'my-payslips' }
                ]
              },
              {
                title: 'Access Control & Admin',
                items: [
                  { id: 'payroll-permissions', label: 'Payroll Permissions', icon: Shield, permissionKey: 'rbac', hideForSelfServiceOnly: true }
                ]
              }
            ] as Array<{
              title: string;
              items: Array<{
                id: string;
                label: string;
                icon: React.ComponentType<{ size: number }>;
                permissionKey: string;
                hideForSelfServiceOnly?: boolean;
              }>;
            }>
          )
            .map(section => ({
              ...section,
              items: section.items.filter(item => {
                if (item.hideForSelfServiceOnly && isSelfServiceOnly) return false;
                return canViewModule(item.permissionKey);
              })
            }))
            .filter(section => section.items.length > 0)
            .map(section => (
              <React.Fragment key={section.title}>
                <div className="nav-section-title">{section.title}</div>
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <div
                      key={`${section.title}-${item.id}`}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setCurrentPage(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCurrentPage(item.id);
                        }
                      }}
                    >
                      <Icon size={15} /> {item.label}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
        </nav>
      </aside>

      {/* Main Workspace Body */}
      <div className="main-wrapper">
        {/* Topbar Header */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb-trail">
              <span className="breadcrumb-item">{breadcrumb.section}</span>
              <ChevronRight size={12} />
              <span className="breadcrumb-current">{breadcrumb.page}</span>
            </div>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Live Notification Center */}
            <NotificationBell onNavigate={(page) => setCurrentPage(page)} />

            {/* Top-Right Profile Menu */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                id="payflow-profile-menu-trigger"
                onClick={() => setProfileMenuOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  padding: '4px 10px 4px 6px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  fontSize: '0.8125rem',
                  fontWeight: 500
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </div>
                <span>{user.fullName}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div
                    id="payflow-profile-dropdown"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      width: '220px',
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 999,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{user.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {user.roles[0]?.replace('_', ' ') ?? 'Employee'}
                      </div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <button
                        type="button"
                        id="payflow-my-profile-btn"
                        onClick={() => {
                          setCurrentPage('self');
                          setProfileMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-main)',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <User size={14} style={{ color: 'var(--primary)' }} />
                        <span>My Profile</span>
                      </button>
                      <button
                        type="button"
                        id="payflow-logout-btn"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          logout();
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--danger)',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <LogOutIcon size={14} />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content with Route Guard */}
        <main className="content-body">
          {(!canViewModule(currentPage === 'manage-employee' ? 'employees' : currentPage)) ? (
            <AccessDeniedView
              moduleName={breadcrumb.page}
              requiredPermission={`module:${currentPage === 'manage-employee' ? 'employees' : currentPage}`}
              onNavigate={(page) => setCurrentPage(page)}
            />
          ) : (
            <>
              {currentPage === 'dashboard' && <DashboardView onNavigate={setCurrentPage} />}
              {currentPage === 'employees' && (
                <EmployeesView 
                  onEnroll={() => { setManageEmployeeId(null); setCurrentPage('manage-employee'); }} 
                  onEdit={(id) => { setManageEmployeeId(id); setCurrentPage('manage-employee'); }} 
                />
              )}
              {currentPage === 'manage-employee' && (
                <ManageEmployeeView 
                  employeeId={manageEmployeeId}
                  onBack={() => { setManageEmployeeId(null); setCurrentPage('employees'); }}
                  onSuccess={() => { setManageEmployeeId(null); setCurrentPage('employees'); }}
                />
              )}
              {currentPage === 'recruitment' && <RecruitmentView />}
              {currentPage === 'offboarding' && <OffboardingView />}
              {currentPage === 'attendance' && <AttendanceView />}
              {currentPage === 'leave' && <LeaveView />}
              {currentPage === 'column-master' && <SalaryColumnMasterView onNavigateToStructures={() => setCurrentPage('compensation')} />}
              {currentPage === 'compensation' && <CompensationView />}
              {currentPage === 'payroll' && <PayrollProcessingView />}
              {currentPage === 'loans' && <LoansView />}
              {currentPage === 'expenses' && <ExpensesView />}
              {currentPage === 'assets-helpdesk' && <AssetsHelpDeskView />}
              {currentPage === 'reports' && <ReportsView />}
              {currentPage === 'self' && <SelfServiceView onNavigate={setCurrentPage} />}
              {currentPage === 'my-leave' && <MyLeaveView />}
              {currentPage === 'my-payslips' && <MyPayslipsView />}
              {currentPage === 'payroll-permissions' && <PayrollPermissionsView />}
            </>
          )}
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
