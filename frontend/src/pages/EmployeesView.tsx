import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, UserPlus, Eye, X, Building, CreditCard } from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const { hasRole } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new employee
  const [ous, setOus] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'Male',
    dateOfJoining: '2026-04-01',
    employmentType: 'PERMANENT',
    email: '',
    phone: '',
    pan: '',
    cityCategory: 'X',
    ouId: '',
    departmentId: '',
    designationId: '',
    employeeGroupId: '',
    bankName: 'State Bank of India',
    accountNumber: '',
    ifscCode: 'SBIN0001234',
    structureId: '',
    basicPay: 57700,
    gpfAccountNumber: '',
    gpfOpeningBalance: 0
  });

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

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [ouRes, deptRes, desigRes, grpRes, structRes]: any = await Promise.all([
          api.get('/org/ous'),
          api.get('/org/departments'),
          api.get('/org/designations'),
          api.get('/org/employee-groups'),
          api.get('/masters/salary-structures')
        ]);
        setOus(ouRes.ous);
        setDepartments(deptRes.departments);
        setDesignations(desigRes.designations);
        setGroups(grpRes.employeeGroups);
        setStructures(structRes.salaryStructures);

        if (ouRes.ous[0]) setFormData(prev => ({ ...prev, ouId: ouRes.ous[0].id }));
        if (deptRes.departments[0]) setFormData(prev => ({ ...prev, departmentId: deptRes.departments[0].id }));
        if (desigRes.designations[0]) setFormData(prev => ({ ...prev, designationId: desigRes.designations[0].id }));
        if (grpRes.employeeGroups[0]) setFormData(prev => ({ ...prev, employeeGroupId: grpRes.employeeGroups[0].id }));
        if (structRes.salaryStructures[0]) setFormData(prev => ({ ...prev, structureId: structRes.salaryStructures[0].id }));
      } catch (err) {
        console.error('Failed to load masters for employee creation:', err);
      }
    };
    fetchMasters();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/employees', {
        ...formData,
        basicPay: Number(formData.basicPay),
        gpfOpeningBalance: Number(formData.gpfOpeningBalance)
      });
      setShowAddModal(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to create employee');
    }
  };

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
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by name, employee code, or PAN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {hasRole(['payroll_admin', 'payroll_pcm']) && (
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
                <th>Basic Pay</th>
                <th>Bank Account</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading employee records...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No matching employees found.</td></tr>
              ) : (
                employees.map((emp) => {
                  const assignment = emp.salaryAssignments?.[0];
                  const bank = emp.bankAccounts?.[0];
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{emp.employeeCode}</td>
                      <td>
                        <strong>{emp.firstName} {emp.lastName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email || 'No email registered'}</div>
                      </td>
                      <td>{emp.designation?.name}</td>
                      <td>
                        <div>{emp.department?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{emp.ou?.name}</div>
                      </td>
                      <td className="money">
                        ₹{assignment ? Number(assignment.basicPay).toLocaleString('en-IN') : '0'}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{bank?.bankName}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{bank?.maskedAccount}</div>
                      </td>
                      <td>
                        <span className={`badge ${emp.active ? 'badge-approved' : 'badge-returned'}`}>
                          {emp.active ? 'Active' : 'Inactive'}
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
              </div>

              {/* Active Salary Assignment */}
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedEmp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enroll New Institutional Employee</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateEmployee}>
              <div className="modal-body">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Employee Code *</label>
                    <input className="form-input" required value={formData.employeeCode} onChange={e => setFormData({ ...formData, employeeCode: e.target.value })} placeholder="e.g. EMP-2001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN (10 chars)</label>
                    <input className="form-input" maxLength={10} value={formData.pan} onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })} />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Campus / Faculty (OU) *</label>
                    <select className="form-select" value={formData.ouId} onChange={e => setFormData({ ...formData, ouId: e.target.value })}>
                      {ous.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-select" value={formData.departmentId} onChange={e => setFormData({ ...formData, departmentId: e.target.value })}>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation *</label>
                    <select className="form-select" value={formData.designationId} onChange={e => setFormData({ ...formData, designationId: e.target.value })}>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name} ({d.cadre})</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Salary Structure *</label>
                    <select className="form-select" value={formData.structureId} onChange={e => setFormData({ ...formData, structureId: e.target.value })}>
                      {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Basic Pay (₹) *</label>
                    <input className="form-input" type="number" required value={formData.basicPay} onChange={e => setFormData({ ...formData, basicPay: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City Category (HRA/TA)</label>
                    <select className="form-select" value={formData.cityCategory} onChange={e => setFormData({ ...formData, cityCategory: e.target.value })}>
                      <option value="X">X (Metro - 27% HRA)</option>
                      <option value="Y">Y (Tier 2 - 18% HRA)</option>
                      <option value="Z">Z (Tier 3 - 9% HRA)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input className="form-input" value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Account Number *</label>
                    <input className="form-input" required value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IFSC Code *</label>
                    <input className="form-input" required value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Enroll Staff Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
