import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Layers, Sliders, Settings, Table, Plus, X } from 'lucide-react';

export const MastersView: React.FC = () => {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'fy' | 'matrix' | 'heads' | 'structures' | 'settings'>('fy');

  const [financialYears, setFinancialYears] = useState<any[]>([]);
  const [payMatrix, setPayMatrix] = useState<any[]>([]);
  const [salaryHeads, setSalaryHeads] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [institution, setInstitution] = useState<any | null>(null);

  // Institution settings state
  const [brandName, setBrandName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [maskPan, setMaskPan] = useState('true');
  const [maskBank, setMaskBank] = useState('true');
  const [showContributions, setShowContributions] = useState('true');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Create FY Modal
  const [showFyModal, setShowFyModal] = useState(false);
  const [fyName, setFyName] = useState('2027-2028');
  const [fyStart, setFyStart] = useState('2027-04-01');
  const [fyEnd, setFyEnd] = useState('2028-03-31');

  // Create Head Modal
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headCode, setHeadCode] = useState('');
  const [headName, setHeadName] = useState('');
  const [headType, setHeadType] = useState('EARNING');
  const [calcType, setCalcType] = useState('FIXED');

  const loadData = async () => {
    try {
      const [fyRes, matrixRes, headRes, structRes, instRes]: any = await Promise.all([
        api.get('/masters/financial-years'),
        api.get('/masters/pay-matrix'),
        api.get('/masters/salary-heads'),
        api.get('/masters/salary-structures'),
        api.get('/org/institution')
      ]);
      setFinancialYears(fyRes.financialYears);
      setPayMatrix(matrixRes.levels);
      setSalaryHeads(headRes.salaryHeads);
      setStructures(structRes.salaryStructures);
      setInstitution(instRes.institution);

      if (instRes.institution) {
        setBrandName(instRes.institution.brandName || instRes.institution.name);
        setContactEmail(instRes.institution.contactEmail || '');
        const sMap = new Map<string, string>(instRes.institution.settings?.map((s: any) => [String(s.key), String(s.value)]) || []);
        if (sMap.has('mask_pan')) setMaskPan(sMap.get('mask_pan') || 'true');
        if (sMap.has('mask_bank')) setMaskBank(sMap.get('mask_bank') || 'true');
        if (sMap.has('show_employer_contributions')) setShowContributions(sMap.get('show_employer_contributions') || 'true');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateFy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/masters/financial-years', {
        name: fyName,
        startsOn: fyStart,
        endsOn: fyEnd,
        activate: false
      });
      setShowFyModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create financial year');
    }
  };

  const handleCreateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/masters/salary-heads', {
        code: headCode.toUpperCase(),
        name: headName,
        type: headType,
        calculationType: calcType,
        isTaxable: true,
        isLeaveImpacted: true
      });
      setShowHeadModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create salary head');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch('/org/institution', {
        brandName,
        contactEmail,
        settings: {
          mask_pan: maskPan,
          mask_bank: maskBank,
          show_employer_contributions: showContributions
        }
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Salary Masters & Configuration Engine
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          7th CPC Matrix, Financial Cycles, Heads & Institutional Parameters
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        <button className={`tab-btn ${activeTab === 'fy' ? 'active' : ''}`} onClick={() => setActiveTab('fy')}>
          <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} /> Financial Years & Cycles
        </button>
        <button className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`} onClick={() => setActiveTab('matrix')}>
          <Table size={14} style={{ display: 'inline', marginRight: '6px' }} /> 7th CPC Pay Matrix
        </button>
        <button className={`tab-btn ${activeTab === 'heads' ? 'active' : ''}`} onClick={() => setActiveTab('heads')}>
          <Sliders size={14} style={{ display: 'inline', marginRight: '6px' }} /> Salary Heads
        </button>
        <button className={`tab-btn ${activeTab === 'structures' ? 'active' : ''}`} onClick={() => setActiveTab('structures')}>
          <Layers size={14} style={{ display: 'inline', marginRight: '6px' }} /> Salary Structures
        </button>
        <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={14} style={{ display: 'inline', marginRight: '6px' }} /> Institutional Settings
        </button>
      </div>

      {/* Tab: Financial Years */}
      {activeTab === 'fy' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Configured Financial Cycles</h3>
            {hasRole(['payroll_admin']) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowFyModal(true)}>
                <Plus size={14} /> Add Financial Year
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Financial Year</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Periods Count</th>
                  <th>Cycle Status</th>
                </tr>
              </thead>
              <tbody>
                {financialYears.map(fy => (
                  <tr key={fy.id}>
                    <td><strong style={{ fontSize: '1rem' }}>{fy.name}</strong></td>
                    <td>{new Date(fy.startsOn).toLocaleDateString('en-IN')}</td>
                    <td>{new Date(fy.endsOn).toLocaleDateString('en-IN')}</td>
                    <td>{fy._count?.periods || 12} Monthly Periods</td>
                    <td>
                      <span className={`badge ${fy.active ? 'badge-approved' : 'badge-neutral'}`}>
                        {fy.active ? 'Active Cycle' : 'Archived / Upcoming'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: 7th CPC Matrix */}
      {activeTab === 'matrix' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">7th Central Pay Commission (7th CPC) Academic & Ministerial Matrix</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Levels 4 through 14 progression</span>
          </div>
          <div className="table-container" style={{ maxHeight: '550px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pay Level</th>
                  <th>Cell 1 (Entry)</th>
                  <th>Cell 2</th>
                  <th>Cell 3</th>
                  <th>Cell 4</th>
                  <th>Cell 5</th>
                  <th>Cell 6</th>
                  <th>Cell 7</th>
                </tr>
              </thead>
              <tbody>
                {payMatrix.map(lvl => {
                  const cells = lvl.matrixCells || [];
                  return (
                    <tr key={lvl.id}>
                      <td><strong>{lvl.name}</strong></td>
                      {[0, 1, 2, 3, 4, 5, 6].map(idx => (
                        <td key={idx} className="money">
                          {cells[idx] ? `₹${Number(cells[idx].basicAmount).toLocaleString('en-IN')}` : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Salary Heads */}
      {activeTab === 'heads' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Salary Heads Configuration</h3>
            {hasRole(['payroll_admin', 'payroll_pcm']) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowHeadModal(true)}>
                <Plus size={14} /> Add Head
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Head Name</th>
                  <th>Component Type</th>
                  <th>Calculation Basis</th>
                  <th>Taxable?</th>
                  <th>Leave Impacted?</th>
                </tr>
              </thead>
              <tbody>
                {salaryHeads.map(head => (
                  <tr key={head.id}>
                    <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{head.code}</strong></td>
                    <td>{head.name}</td>
                    <td>
                      <span className={`badge ${head.type === 'EARNING' ? 'badge-approved' : (head.type === 'DEDUCTION' ? 'badge-returned' : 'badge-neutral')}`}>
                        {head.type}
                      </span>
                    </td>
                    <td>{head.calculationType}</td>
                    <td>{head.isTaxable ? 'Yes' : 'Exempt'}</td>
                    <td>{head.isLeaveImpacted ? 'Adjusted with LOP' : 'Full'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Salary Structures */}
      {activeTab === 'structures' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Active Salary Structure Templates</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {structures.map(struct => (
              <div key={struct.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{struct.name}</h4>
                  <span className="badge badge-neutral">{struct.employmentType}</span>
                </div>
                <div className="table-container">
                  <table className="data-table" style={{ fontSize: '0.78rem' }}>
                    <thead><tr><th>Head</th><th>Method</th><th>Formula / %</th></tr></thead>
                    <tbody>
                      {struct.lines?.map((line: any) => (
                        <tr key={line.id}>
                          <td><strong>{line.salaryHead?.name}</strong></td>
                          <td>{line.calculationType}</td>
                          <td>{line.percentage ? `${line.percentage}% of ${line.baseHeadCode || 'BASIC'}` : (line.fixedAmount ? `₹${line.fixedAmount}` : 'Configured')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="panel" style={{ maxWidth: '700px' }}>
          <div className="panel-header">
            <h3 className="panel-title">Institutional Identity & Payslip Display Settings</h3>
          </div>

          {settingsSuccess && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.85rem' }}>
              Institutional settings and feature flags updated successfully.
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">Institution Brand Name</label>
              <input className="form-input" value={brandName} onChange={e => setBrandName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Payroll Section Contact Email</label>
              <input className="form-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Mask Employee PAN on Public Payslips & Views</label>
              <select className="form-select" value={maskPan} onChange={e => setMaskPan(e.target.value)}>
                <option value="true">Enabled (e.g. ABCXXXXX4F)</option>
                <option value="false">Disabled (Show full PAN)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mask Bank Account Number on Payslips</label>
              <select className="form-select" value={maskBank} onChange={e => setMaskBank(e.target.value)}>
                <option value="true">Enabled (e.g. XXXXXX5678)</option>
                <option value="false">Disabled (Show full Account Number)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Display Employer NPS / EPF Contributions on Payslip</label>
              <select className="form-select" value={showContributions} onChange={e => setShowContributions(e.target.value)}>
                <option value="true">Enabled (Transparent total compensation)</option>
                <option value="false">Disabled (Employee earnings and deductions only)</option>
              </select>
            </div>

            {hasRole(['payroll_admin']) && (
              <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                Save Institutional Settings
              </button>
            )}
          </form>
        </div>
      )}

      {/* Add FY Modal */}
      {showFyModal && (
        <div className="modal-overlay" onClick={() => setShowFyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Financial Year</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowFyModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateFy}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Year Name (e.g. 2027-2028) *</label>
                  <input className="form-input" required value={fyName} onChange={e => setFyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" required value={fyStart} onChange={e => setFyStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input className="form-input" type="date" required value={fyEnd} onChange={e => setFyEnd(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create FY & 12 Periods</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Head Modal */}
      {showHeadModal && (
        <div className="modal-overlay" onClick={() => setShowHeadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Define Salary Head</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowHeadModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateHead}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Head Code (e.g. SPECIAL_PAY) *</label>
                  <input className="form-input" required value={headCode} onChange={e => setHeadCode(e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="form-label">Head Name *</label>
                  <input className="form-input" required value={headName} onChange={e => setHeadName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Component Type *</label>
                  <select className="form-select" value={headType} onChange={e => setHeadType(e.target.value)}>
                    <option value="EARNING">EARNING</option>
                    <option value="DEDUCTION">DEDUCTION</option>
                    <option value="EMPLOYER_CONTRIBUTION">EMPLOYER_CONTRIBUTION</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Calculation Type *</label>
                  <select className="form-select" value={calcType} onChange={e => setCalcType(e.target.value)}>
                    <option value="FIXED">FIXED AMOUNT</option>
                    <option value="PERCENTAGE_OF_HEAD">PERCENTAGE OF BASE HEAD</option>
                    <option value="FORMULA">COMPUTED FORMULA</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowHeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Salary Head</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
