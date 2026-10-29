import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import { Briefcase, UserPlus, Mail, MapPin, Users, CheckCircle2 } from 'lucide-react';

export const RecruitmentView: React.FC = () => {
  const { canPerformAction } = useAuth();
  const canMoveStage = canPerformAction('recruitment:move_stage');
  const canHire = canPerformAction('recruitment:hire');

  const [openings, setOpenings] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireEmail, setHireEmail] = useState('');
  const [hireBranchId, setHireBranchId] = useState('');
  const [isHiring, setIsHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [openingsRes, appsRes, branchRes]: any = await Promise.all([
        api.get('/recruitment/openings'),
        api.get('/recruitment/applications'),
        api.get('/masters/branches?status=ACTIVE&all=true').catch(() => api.get('/org/branches'))
      ]);
      setOpenings(openingsRes.openings || []);
      setApplications(appsRes.applications || []);
      const branchList = branchRes.records || branchRes.branches || [];
      setBranches(branchList);
      if (branchList[0]) setHireBranchId(branchList[0].id);
    } catch (err) {
      console.error('Failed to load recruitment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMoveStage = async (appId: string, newStage: string) => {
    try {
      await api.post(`/recruitment/applications/${appId}/stage`, { stage: newStage });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update stage');
    }
  };

  const handleConvertHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setHireError(null);
    setIsHiring(true);
    try {
      const code = `APEX-${Date.now().toString().slice(-4)}`;
      await api.post(`/recruitment/applications/${selectedApp.id}/convert-to-employee`, {
        employeeCode: code,
        workEmail: hireEmail,
        branchId: hireBranchId,
        dateOfJoining: new Date().toISOString().split('T')[0]
      });
      setShowHireModal(false);
      loadData();
      alert(`Candidate converted to employee successfully with code: ${code}`);
    } catch (err: any) {
      setHireError(err.message || 'Failed to convert candidate');
    } finally {
      setIsHiring(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="Recruitment & Applicant Tracking (ATS)"
        subtitle="Manpower Requisitions, Candidate Pipeline, Interview Evaluations & 1-Click Hire Onboarding"
        breadcrumbs={[
          { label: 'People & Organization' },
          { label: 'Recruitment & ATS' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>ATS Pipeline</span>}
      />

      {/* Openings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        {openings.map(op => (
          <div key={op.id} className="panel" style={{ padding: '16px', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-brand" style={{ fontSize: '0.6875rem' }}>
                  {op.department?.name || 'Department'}
                </span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-main)' }}>{op.title}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Vacancies: <strong>{op.openingsCount}</strong> • Min Exp: {op.minExperience} yrs
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {op._count?.applications || 0}
                </span>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Applicants</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Candidate Pipeline Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={16} color="var(--primary)" /> Candidate Applications Pipeline ({applications.length})
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Stage progression feeds automatic employee onboarding
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role / Opening</th>
                <th>Contact</th>
                <th>Experience</th>
                <th>Current Stage</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Loading applicant pipeline...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No candidate applications found in the pipeline.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.candidate?.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Applied {new Date(app.createdAt).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <strong>{app.jobOpening?.title || 'Requisition'}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {app.jobOpening?.department?.name || 'Department'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                        <Mail size={12} color="var(--text-dim)" /> {app.candidate?.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <MapPin size={12} color="var(--text-dim)" /> {app.candidate?.city || 'Location'}
                      </div>
                    </td>
                    <td>{app.candidate?.experienceYears ?? 0} Years</td>
                    <td>
                      {canMoveStage && app.stage !== 'HIRED' ? (
                        <select
                          className="form-select"
                          style={{ height: '28px', fontSize: '0.75rem', padding: '0 8px', width: 'auto' }}
                          value={app.stage}
                          onChange={(e) => handleMoveStage(app.id, e.target.value)}
                        >
                          <option value="APPLIED">Applied</option>
                          <option value="SHORTLISTED">Shortlisted</option>
                          <option value="TECHNICAL_INTERVIEW">Technical Interview</option>
                          <option value="HR_INTERVIEW">HR Interview</option>
                          <option value="OFFER_EXTENDED">Offer Extended</option>
                          <option value="HIRED">Hired</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      ) : (
                        <span className={`badge ${app.stage === 'HIRED' ? 'badge-approved' : 'badge-neutral'}`} style={{ fontSize: '0.75rem' }}>
                          {app.stage}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {canHire && app.stage === 'OFFER_EXTENDED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setHireEmail(`${app.candidate?.fullName.toLowerCase().replace(/\s+/g, '.')}@apexglobal.tech`);
                              setHireError(null);
                              setShowHireModal(true);
                            }}
                          >
                            <UserPlus size={12} /> Convert to Employee
                          </button>
                        )}

                        {app.stage === 'HIRED' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Enrolled
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1-Click Convert to Employee Modal (Pattern B) */}
      {selectedApp && (
        <FormModal
          isOpen={canHire && showHireModal}
          onClose={() => setShowHireModal(false)}
          title="Convert Candidate to Corporate Employee"
          subtitle={`Auto-enroll candidate ${selectedApp.candidate?.fullName} into Employee Master`}
          icon={<UserPlus size={18} />}
          width="md"
          onSubmit={handleConvertHire}
          submitLabel="Complete Hire & Create Profile"
          isSubmitting={isHiring}
        >
          {hireError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
              {hireError}
            </div>
          )}

          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
            Position: <strong>{selectedApp.jobOpening?.title}</strong><br />
            Candidate: <strong>{selectedApp.candidate?.fullName}</strong> ({selectedApp.candidate?.email})
          </div>

          <div className="form-group">
            <label className="form-label">Corporate Work Email *</label>
            <input
              type="email"
              className="form-input"
              value={hireEmail}
              onChange={(e) => setHireEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Branch Office Placement *</label>
            <select className="form-select" value={hireBranchId} onChange={(e) => setHireBranchId(e.target.value)} required>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
            </select>
          </div>
        </FormModal>
      )}
    </div>
  );
};
