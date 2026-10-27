import React, { useState } from 'react';
import { 
  X, 
  Pencil, 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Mail, 
  Phone, 
  User, 
  CreditCard, 
  ShieldCheck, 
  Layers, 
  Calculator,
  Clock,
  HeartHandshake,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export interface EmployeeProfileModalProps {
  employee: any;
  onClose: () => void;
  onEdit?: (employeeId: string) => void;
}

type ProfileTab = 'PLACEMENT' | 'CONTACT_PERSONAL' | 'STATUTORY_BANK' | 'COMPENSATION' | 'UDF';

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employee,
  onClose,
  onEdit
}) => {
  const { canPerformAction, canViewField } = useAuth();
  const canEdit = canPerformAction('employee:update') || canPerformAction('employee:create');
  const canViewBasicPay = canViewField('field:employee:basic_pay');
  const canViewBankAccount = canViewField('field:employee:bank_account');

  const [activeTab, setActiveTab] = useState<ProfileTab>('PLACEMENT');

  if (!employee) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'CONFIRMED':
        return 'badge-approved';
      case 'PROBATION':
      case 'NOTICE_PERIOD':
        return 'badge-pending';
      case 'SUSPENDED':
      case 'EXITED':
        return 'badge-rejected';
      default:
        return 'badge-brand';
    }
  };

  // Extract compensation figures
  const structure = employee.salaryStructure;
  const basicLine = structure?.lines?.find(
    (l: any) => l.component?.code === 'BASIC' || l.component?.name?.toLowerCase().includes('basic')
  );
  const hraLine = structure?.lines?.find(
    (l: any) => l.component?.code === 'HRA' || l.component?.name?.toLowerCase().includes('house rent')
  );
  const specialLine = structure?.lines?.find(
    (l: any) => l.component?.code === 'SPL_ALLOW' || l.component?.code === 'SPECIAL' || l.component?.name?.toLowerCase().includes('special')
  );

  const earnings = structure?.lines?.filter((l: any) => l.component?.type === 'EARNING') || [];
  const deductions = structure?.lines?.filter((l: any) => l.component?.type === 'DEDUCTION') || [];
  const employerStatutory = structure?.lines?.filter((l: any) => l.component?.type === 'EMPLOYER_STATUTORY') || [];

  const customFields = employee.customFieldValues || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: '1050px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        {/* Top Header Card */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
            }}>
              {employee.firstName?.[0] || 'E'}{employee.lastName?.[0] || ''}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {employee.firstName} {employee.lastName}
                </h2>
                <span className={`badge ${getStatusBadgeClass(employee.status)}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  {employee.status || 'ACTIVE'}
                </span>
                <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>
                  {employee.employmentType || 'PERMANENT'}
                </span>
                <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }}>
                  {employee.workMode || 'OFFICE'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>{employee.employeeCode}</span>
                <span>•</span>
                <span>{employee.designation?.name || 'Designation Not Assigned'}</span>
                <span>•</span>
                <span>{employee.department?.name || 'General Department'}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {canEdit && onEdit && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onEdit(employee.id);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Pencil size={13} /> Edit Full Profile
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '4px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s'
              }}
              title="Close Profile"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 24px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {[
            { id: 'PLACEMENT', label: 'Organizational Placement', icon: Building2 },
            { id: 'CONTACT_PERSONAL', label: 'Contact & Personal', icon: User },
            { id: 'STATUTORY_BANK', label: 'Statutory & Banking', icon: CreditCard },
            { id: 'COMPENSATION', label: 'Compensation & CTC', icon: Calculator },
            { id: 'UDF', label: `Custom Fields (${customFields.length})`, icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ProfileTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          background: '#ffffff'
        }}>

          {/* TAB 1: PLACEMENT */}
          {activeTab === 'PLACEMENT' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Organization Placement Card */}
              <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} /> Placement & Reporting
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Company:</span>
                  <strong>{employee.company?.name || 'Apex Global Technologies Pvt. Ltd.'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Branch / Office:</span>
                  <strong>{employee.branch?.name ? `${employee.branch.name} (${employee.branch.city || ''})` : 'Corporate Headquarters'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                  <strong>{employee.department?.name || 'General Operations'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Designation:</span>
                  <strong>{employee.designation?.name || 'N/A'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Job Band / Grade:</span>
                  <strong>{employee.jobBand?.name ? `${employee.jobBand.name} (${employee.jobBand.code})` : 'Standard Grade'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Cost Center:</span>
                  <strong>{employee.costCenter?.name || 'Corporate Cost Center'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Reporting Manager:</span>
                  <strong>{employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName} (${employee.manager.employeeCode})` : 'Executive Leadership / Self'}</strong>
                </div>
              </div>

              {/* Employment Terms Card */}
              <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#0d9488', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} /> Timeline & Service Terms
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date of Joining:</span>
                  <strong>{formatDate(employee.dateOfJoining)}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Employment Type:</span>
                  <strong>{employee.employmentType || 'PERMANENT'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Employment Status:</span>
                  <span className={`badge ${getStatusBadgeClass(employee.status)}`} style={{ display: 'inline-block', width: 'fit-content' }}>
                    {employee.status || 'ACTIVE'}
                  </span>

                  <span style={{ color: 'var(--text-muted)' }}>Work Mode:</span>
                  <strong>{employee.workMode || 'OFFICE'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Probation Period:</span>
                  <strong>{employee.probationDays ? `${employee.probationDays} Days` : '90 Days'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Confirmation Date:</span>
                  <strong>{employee.confirmationDate ? formatDate(employee.confirmationDate) : 'Confirmed on joining'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Notice Period:</span>
                  <strong>{employee.noticePeriodDays ? `${employee.noticePeriodDays} Days` : '60 Days'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT & PERSONAL */}
          {activeTab === 'CONTACT_PERSONAL' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Contact Card */}
              <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} /> Contact Details & Address
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Work Email:</span>
                  <strong style={{ color: 'var(--primary)' }}>{employee.workEmail || 'N/A'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Personal Email:</span>
                  <strong>{employee.personalEmail || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Mobile / Phone:</span>
                  <strong>{employee.phone || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Street Address:</span>
                  <strong>{employee.addressLine1 || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>City & State:</span>
                  <strong>{employee.city || employee.state ? `${employee.city || ''}, ${employee.state || ''}` : 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>PIN Code:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.pinCode || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Emergency Contact:</span>
                  <strong>{employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactPhone || 'No Phone'})` : 'Not specified'}</strong>
                </div>
              </div>

              {/* Personal Card */}
              <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#8b5cf6', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} /> Personal Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date of Birth:</span>
                  <strong>{formatDate(employee.dateOfBirth)}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Gender:</span>
                  <strong>{employee.gender || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Marital Status:</span>
                  <strong>{employee.maritalStatus || 'Not specified'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Blood Group:</span>
                  <strong style={{ color: '#ef4444' }}>{employee.bloodGroup || 'Not specified'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STATUTORY & BANKING */}
          {activeTab === 'STATUTORY_BANK' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Statutory Compliance Card */}
              <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Statutory Compliance
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Income Tax PAN:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{employee.panNumber || 'Not registered'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Aadhaar Number:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.aadhaarMasked ? `•••• •••• ${employee.aadhaarMasked.slice(-4)}` : 'Not registered'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>EPFO UAN:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.uanNumber || 'Not registered'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>PF Member ID:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.pfNumber || 'Not registered'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>ESIC IP Number:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.esicNumber || 'Not applicable / Gross > ₹21,000'}</strong>

                  <span style={{ color: 'var(--text-muted)' }}>Professional Tax:</span>
                  <strong>Maharashtra State PT Registered</strong>
                </div>
              </div>

              {/* Banking & Disbursement Card */}
              {canViewBankAccount ? (
                <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#0284c7', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={16} /> Salary Disbursement Account
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '10px', fontSize: '0.83rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Bank Name:</span>
                    <strong>{employee.bankName || 'Not registered'}</strong>

                    <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{employee.bankAccountNumber || 'Not registered'}</strong>

                    <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{employee.ifscCode || 'Not registered'}</strong>

                    <span style={{ color: 'var(--text-muted)' }}>Branch Location:</span>
                    <strong>{employee.bankBranch || 'Main Corporate Branch'}</strong>

                    <span style={{ color: 'var(--text-muted)' }}>Disbursement Mode:</span>
                    <strong>Electronic Bank Transfer (NEFT / RTGS)</strong>
                  </div>
                </div>
              ) : (
                <div className="panel" style={{ margin: 0, padding: '18px', background: '#f8fafc', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Bank account details are confidential and restricted by role-based access control.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COMPENSATION */}
          {activeTab === 'COMPENSATION' && (
            <div>
              {canViewBasicPay ? (
                <div>
                  {/* Summary CTC Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div className="metric-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <div className="metric-title" style={{ color: '#166534' }}>Annual Cost to Company (CTC)</div>
                      <div className="metric-value" style={{ color: '#15803d', fontSize: '1.4rem' }}>
                        ₹{structure ? Number(structure.annualCtc).toLocaleString('en-IN') : '0'}
                      </div>
                    </div>

                    <div className="metric-card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                      <div className="metric-title" style={{ color: '#0369a1' }}>Monthly Gross Remuneration</div>
                      <div className="metric-value" style={{ color: '#0284c7', fontSize: '1.4rem' }}>
                        ₹{structure ? Number(structure.monthlyGross).toLocaleString('en-IN') : '0'}
                      </div>
                    </div>

                    <div className="metric-card" style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
                      <div className="metric-title" style={{ color: '#6b21a8' }}>Monthly Basic Pay</div>
                      <div className="metric-value" style={{ color: '#7e22ce', fontSize: '1.4rem' }}>
                        ₹{basicLine ? Number(basicLine.monthlyAmount).toLocaleString('en-IN') : (structure ? Number(structure.monthlyGross * 0.5).toLocaleString('en-IN') : '0')}
                      </div>
                    </div>
                  </div>

                  {/* Component Breakdown Tables */}
                  {structure?.lines && structure.lines.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {/* Earnings */}
                      <div className="panel" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#ecfdf5', borderBottom: '1px solid #d1fae5', fontWeight: 700, fontSize: '0.85rem', color: '#065f46' }}>
                          Itemized Monthly Earnings
                        </div>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Component</th>
                              <th style={{ textAlign: 'right' }}>Monthly (₹)</th>
                              <th style={{ textAlign: 'right' }}>Annual (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {earnings.map((line: any) => (
                              <tr key={line.id}>
                                <td><strong>{line.component?.name || line.component?.code}</strong></td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{Number(line.monthlyAmount).toLocaleString('en-IN')}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>₹{Number(line.annualAmount || line.monthlyAmount * 12).toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Deductions & Statutory */}
                      <div className="panel" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', background: '#fef2f2', borderBottom: '1px solid #fee2e2', fontWeight: 700, fontSize: '0.85rem', color: '#991b1b' }}>
                          Standard Monthly Deductions & Contributions
                        </div>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>Component</th>
                              <th style={{ textAlign: 'right' }}>Monthly (₹)</th>
                              <th style={{ textAlign: 'right' }}>Annual (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...deductions, ...employerStatutory].map((line: any) => (
                              <tr key={line.id}>
                                <td><strong>{line.component?.name || line.component?.code}</strong></td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{Number(line.monthlyAmount).toLocaleString('en-IN')}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>₹{Number(line.annualAmount || line.monthlyAmount * 12).toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '6px' }}>
                      No itemized salary structure components configured for this employee yet.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Salary assignments and CTC figures are restricted to authorized Payroll and HR Administrators.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: USER-DEFINED FIELDS (UDF) */}
          {activeTab === 'UDF' && (
            <div>
              {customFields.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {customFields.map((cf: any) => (
                    <div key={cf.id} className="panel" style={{ margin: 0, padding: '16px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {cf.fieldDefinition?.fieldLabel || cf.fieldDefinition?.fieldKey || 'Custom Field'}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {cf.fieldValue || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '6px' }}>
                  No custom user-defined field records found for this employee.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 24px',
          background: '#f8fafc',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {canEdit && onEdit && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onEdit(employee.id);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Pencil size={13} /> Edit Full Profile
              </button>
            )}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
