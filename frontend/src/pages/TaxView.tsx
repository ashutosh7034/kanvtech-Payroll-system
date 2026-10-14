import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, X, Shield } from 'lucide-react';

export const TaxView: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [sections, setSections] = useState<any[]>([]);
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [selectedFyId, setSelectedFyId] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Form state
  const [sectionId, setSectionId] = useState('');
  const [declaredAmount, setDeclaredAmount] = useState(0);
  const [remarks, setRemarks] = useState('');

  const loadTaxData = async () => {
    try {
      const [secRes, fyRes]: any = await Promise.all([
        api.get('/tax/sections'),
        api.get('/masters/financial-years')
      ]);
      setSections(secRes.sections);
      setFinancialYears(fyRes.financialYears);

      const activeFy = fyRes.financialYears.find((f: any) => f.active) || fyRes.financialYears[0];
      if (activeFy) {
        setSelectedFyId(activeFy.id);
        if (secRes.sections[0]) setSectionId(secRes.sections[0].id);

        const declRes: any = await api.get(`/tax/declarations?financialYearId=${activeFy.id}`);
        setDeclarations(declRes.declarations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTaxData();
  }, []);

  const handleSubmitDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tax/declarations', {
        financialYearId: selectedFyId,
        sectionId,
        declaredAmount: Number(declaredAmount),
        remarks
      });
      setShowSubmitModal(false);
      setRemarks('');
      setDeclaredAmount(0);
      const declRes: any = await api.get(`/tax/declarations?financialYearId=${selectedFyId}`);
      setDeclarations(declRes.declarations);
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    }
  };

  const handleVerify = async (id: string, verifiedAmount: number, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await api.patch(`/tax/declarations/${id}/verify`, {
        verifiedAmount,
        status,
        remarks: status === 'VERIFIED' ? 'Approved after documentary proof verification' : 'Disallowed due to lack of proof'
      });
      const declRes: any = await api.get(`/tax/declarations?financialYearId=${selectedFyId}`);
      setDeclarations(declRes.declarations);
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Income Tax & Statutory Declarations
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Old & New Tax Regime Declarations, Verification & Slabs (PDF pp. 16-17, 20-21)
          </p>
        </div>

        {user?.employee && (
          <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
            <Plus size={16} /> Submit Investment Declaration
          </button>
        )}
      </div>

      {/* Tax Sections Catalog */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Statutory Deduction Limits (FY 2026-2027)</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {sections.map(s => (
            <div key={s.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>Section {s.sectionCode}</strong>
                <span className="badge badge-neutral">{s.regimeAllowed} Regime</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{s.name}</p>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                Max: ₹{Number(s.maxLimit).toLocaleString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Declarations List */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Submitted Declarations for Assessment</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Description</th>
                <th className="money">Declared (₹)</th>
                <th className="money">Verified (₹)</th>
                <th>Status</th>
                <th>Submitted On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {declarations.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No declarations submitted for this financial cycle.</td></tr>
              ) : (
                declarations.map(d => (
                  <tr key={d.id}>
                    <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{d.section?.sectionCode}</strong></td>
                    <td>{d.section?.name}</td>
                    <td className="money" style={{ fontWeight: 600 }}>₹{Number(d.declaredAmount).toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--success)' }}>
                      ₹{d.verifiedAmount !== null ? Number(d.verifiedAmount).toLocaleString('en-IN') : '-'}
                    </td>
                    <td>
                      <span className={`badge ${d.status === 'VERIFIED' ? 'badge-approved' : (d.status === 'REJECTED' ? 'badge-returned' : 'badge-finalized')}`}>
                        {d.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('en-IN') : 'Draft'}
                    </td>
                    <td>
                      {hasRole(['payroll_incometax_admin', 'payroll_admin']) && d.status === 'SUBMITTED' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleVerify(d.id, Number(d.declaredAmount), 'VERIFIED')}>
                            <Check size={12} /> Verify Full
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleVerify(d.id, 0, 'REJECTED')}>
                            <X size={12} /> Disallow
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Declaration Modal */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Investment / Deduction Declaration</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowSubmitModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmitDeclaration}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Deduction Section *</label>
                  <select className="form-select" value={sectionId} onChange={e => setSectionId(e.target.value)}>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.sectionCode} - {s.name} (Max: ₹{Number(s.maxLimit).toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Declared Amount (₹) *</label>
                  <input className="form-input" type="number" required value={declaredAmount} onChange={e => setDeclaredAmount(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Remarks / Policy Reference</label>
                  <input className="form-input" placeholder="e.g. LIC Policy #12345678" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit for Tax Assessment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
