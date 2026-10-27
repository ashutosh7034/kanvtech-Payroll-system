import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, UserPlus, Eye, Pencil } from 'lucide-react';
import { ManageEmployeeView } from './ManageEmployeeView';
import { EmployeeProfileModal } from '../components/EmployeeProfileModal';

export interface EmployeesViewProps {
  onEnroll?: () => void;
  onEdit?: (id: string) => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ onEnroll, onEdit }) => {
  const { canPerformAction, canViewField } = useAuth();
  const canCreateEmployee = canPerformAction('employee:create');
  const canViewBasicPay = canViewField('field:employee:basic_pay');
  const canViewBankAccount = canViewField('field:employee:bank_account');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'manage'>('list');
  const [manageEmpId, setManageEmpId] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res: any = await api.get(`/employees${query}`);
      setEmployees(res.employees || []);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search]);

  const viewEmployeeDetails = async (id: string) => {
    try {
      const res: any = await api.get(`/employees/${id}`);
      setSelectedEmp(res.employee);
    } catch (err) {
      console.error('Failed to load employee details:', err);
    }
  };

  const handleEnrollClick = () => {
    if (onEnroll) {
      onEnroll();
    } else {
      setManageEmpId(null);
      setViewMode('manage');
    }
  };

  const handleEditClick = (id: string) => {
    if (onEdit) {
      onEdit(id);
    } else {
      setManageEmpId(id);
      setViewMode('manage');
    }
  };

  // If internal full-screen manage mode is active
  if (viewMode === 'manage') {
    return (
      <ManageEmployeeView
        employeeId={manageEmpId}
        onBack={() => {
          setManageEmpId(null);
          setViewMode('list');
          fetchEmployees();
        }}
        onSuccess={() => {
          setManageEmpId(null);
          setViewMode('list');
          fetchEmployees();
        }}
      />
    );
  }

  return (
    <div>
      {/* Top Filter and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '9px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by name, employee code, or PAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {canCreateEmployee && (
          <button className="btn btn-primary" onClick={handleEnrollClick}>
            <UserPlus size={16} /> Enroll New Employee
          </button>
        )}
      </div>

      {/* Employees Table */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Department & OU</th>
                {canViewBasicPay && <th>Basic Pay</th>}
                {canViewBankAccount && <th>Bank Account</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6 + (canViewBasicPay ? 1 : 0) + (canViewBankAccount ? 1 : 0)} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading employee records...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={6 + (canViewBasicPay ? 1 : 0) + (canViewBankAccount ? 1 : 0)} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No matching employees found.</td></tr>
              ) : (
                employees.map((emp) => {
                  const basicLine = emp.salaryStructure?.lines?.find(
                    (l: any) => l.component?.code === 'BASIC' || l.component?.name?.toLowerCase().includes('basic')
                  );
                  const basicPay = basicLine 
                    ? Number(basicLine.monthlyAmount) 
                    : (emp.salaryStructure?.monthlyGross ? Number(emp.salaryStructure.monthlyGross) * 0.5 : 0);

                  const bankName = emp.bankName || emp.bankAccounts?.[0]?.bankName;
                  const maskedAcc = emp.bankAccountNumber 
                    ? '••••' + emp.bankAccountNumber.slice(-4) 
                    : (emp.bankAccounts?.[0]?.maskedAccount || null);

                  return (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{emp.employeeCode}</td>
                      <td>
                        <strong>{emp.firstName} {emp.lastName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.workEmail || emp.email || 'No email registered'}</div>
                      </td>
                      <td>{emp.designation?.name || 'N/A'}</td>
                      <td>
                        <div>{emp.department?.name || 'General'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{emp.branch?.name || 'Corporate HQ'}</div>
                      </td>
                      {canViewBasicPay && (
                        <td className="money">
                          {basicPay > 0 ? `₹${basicPay.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                      )}
                      {canViewBankAccount && (
                        <td style={{ fontSize: '0.8rem' }}>
                          <div>{bankName || 'N/A'}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{maskedAcc || 'N/A'}</div>
                        </td>
                      )}
                      <td>
                        <span className={`badge ${emp.status === 'ACTIVE' || emp.status === 'CONFIRMED' || emp.active ? 'badge-approved' : 'badge-pending'}`}>
                          {emp.status || (emp.active ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => viewEmployeeDetails(emp.id)} title="View Complete Employee Profile">
                            <Eye size={12} /> View
                          </button>
                          {canCreateEmployee && (
                            <button className="btn btn-outline btn-sm" onClick={() => handleEditClick(emp.id)} title="Edit Employee Full Profile">
                              <Pencil size={12} /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redesigned Complete Employee Profile Modal */}
      {selectedEmp && (
        <EmployeeProfileModal
          employee={selectedEmp}
          onClose={() => setSelectedEmp(null)}
          onEdit={handleEditClick}
        />
      )}
    </div>
  );
};
