import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, UserPlus, Eye, X, Building, CreditCard } from 'lucide-react';
import { EmployeeEnrollmentModal } from '../components/EmployeeEnrollmentModal';

export const EmployeesView: React.FC = () => {
  const { canPerformAction, canViewField } = useAuth();
  const canCreateEmployee = canPerformAction('employee:create');
  const canViewBasicPay = canViewField('field:employee:basic_pay');
  const canViewBankAccount = canViewField('field:employee:bank_account');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res: any = await api.get(`/employees${query}`);
      setEmployees(res.employees);
    } catch (err) {
      console.error(err);
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
      console.error(err);
    }
  };

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
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
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
                  const assignment = emp.salaryAssignments?.[0];
                  const bank = emp.bankAccounts?.[0];
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{emp.branch?.name || emp.ou?.name || 'Corporate HQ'}</div>
                      </td>
                      {canViewBasicPay && (
                        <td className="money">
                          ₹{assignment ? Number(assignment.basicPay).toLocaleString('en-IN') : '0'}
                        </td>
                      )}
                      {canViewBankAccount && (
                        <td style={{ fontSize: '0.8rem' }}>
                          <div>{bank?.bankName || emp.bankName || 'N/A'}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{bank?.maskedAccount || (emp.bankAccountNumber ? '••••' + emp.bankAccountNumber.slice(-4) : 'N/A')}</div>
                        </td>
                      )}
                      <td>
                        <span className={`badge ${emp.status === 'ACTIVE' || emp.status === 'CONFIRMED' || emp.active ? 'badge-approved' : 'badge-pending'}`}>
                          {emp.status || (emp.active ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => viewEmployeeDetails(emp.id)}>
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmp && (
        <div className="modal-overlay" onClick={() => setSelectedEmp(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="user-avatar" style={{ width: '40px', height: '40px', background: 'var(--primary)', color: '#fff', fontSize: '1rem' }}>
                  {selectedEmp.firstName[0]}{selectedEmp.lastName[0]}
                </div>
                <div>
                  <h3>{selectedEmp.firstName} {selectedEmp.middleName ? `${selectedEmp.middleName} ` : ''}{selectedEmp.lastName}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedEmp.employeeCode} • {selectedEmp.designation?.name}</p>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedEmp(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--primary)' }}>
                    <Building size={16} /> <strong>Organizational Placement</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}>
                    <div>Campus/OU: <strong>{selectedEmp.ou?.name}</strong></div>
                    <div>Department: <strong>{selectedEmp.department?.name}</strong></div>
                    <div>Cadre: <strong>{selectedEmp.designation?.cadre}</strong></div>
                    <div>Group: <strong>{selectedEmp.employeeGroup?.name}</strong></div>
                    <div>Date of Joining: <strong>{new Date(selectedEmp.dateOfJoining).toLocaleDateString('en-IN')}</strong></div>
                  </div>
                </div>

                {canViewBankAccount && (
                  <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--success)' }}>
                      <CreditCard size={16} /> <strong>Disbursement & Statutory</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', lineHeight: '1.8' }}>
                      <div>PAN: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedEmp.maskedPan || selectedEmp.pan || 'N/A'}</strong></div>
                      <div>Bank: <strong>{selectedEmp.bankAccounts?.[0]?.bankName}</strong></div>
                      <div>A/C: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedEmp.bankAccounts?.[0]?.maskedAccount}</strong></div>
                      <div>IFSC: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedEmp.bankAccounts?.[0]?.ifscCode}</strong></div>
                      <div>GPF Account: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedEmp.gpfAccount?.accountNumber || 'N/A'}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Salary Assignment */}
              {canViewBasicPay && (
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-main)' }}>Active 7th CPC Salary Assignment</h4>
                  {selectedEmp.salaryAssignments?.[0] ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.85rem' }}>
                      <div>Structure: <br /><strong>{selectedEmp.salaryAssignments[0].structure?.name}</strong></div>
                      <div>Pay Level: <br /><strong>{selectedEmp.salaryAssignments[0].payLevel?.name || 'N/A'}</strong></div>
                      <div>Matrix Cell: <br /><strong>Index #{selectedEmp.salaryAssignments[0].payMatrixCell?.indexNumber || '1'}</strong></div>
                      <div>Basic Pay: <br /><strong style={{ color: 'var(--success)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>₹{Number(selectedEmp.salaryAssignments[0].basicPay).toLocaleString('en-IN')}</strong></div>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>No active salary assignment found.</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedEmp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SpineHR-Style Employee Enrollment Modal */}
      {canCreateEmployee && (
        <EmployeeEnrollmentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchEmployees}
        />
      )}
    </div>
  );
};
