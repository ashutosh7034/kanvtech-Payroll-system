import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Play, CheckCheck, Lock, CheckCircle, RotateCcw, FileText, Printer, X } from 'lucide-react';

export const PayrollProcessingView: React.FC = () => {
  const { hasRole } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipData, setPayslipData] = useState<any | null>(null);

  // Generate form state
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [generateRemarks, setGenerateRemarks] = useState('');
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rejection modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState('');

  const fetchRuns = async () => {
    try {
      const res: any = await api.get('/payroll/runs');
      setRuns(res.runs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPeriods = async () => {
    try {
      const fyRes: any = await api.get('/masters/financial-years');
      const activeFy = fyRes.financialYears.find((f: any) => f.active) || fyRes.financialYears[0];
      if (activeFy) {
        const periodRes: any = await api.get(`/masters/financial-years/${activeFy.id}/periods`);
        setPeriods(periodRes.periods);
        if (periodRes.periods[0]) setSelectedPeriodId(periodRes.periods[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchPeriods();
  }, []);

  const handlePreview = async () => {
    if (!selectedPeriodId) return;
    setPreviewing(true);
    try {
      const res: any = await api.post('/payroll/runs/preview', { periodId: selectedPeriodId });
      setPreviewData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to preview payroll');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriodId) return;
    setSubmitting(true);
    try {
      await api.post('/payroll/runs/generate', {
        periodId: selectedPeriodId,
        remarks: generateRemarks
      });
      setShowGenerateModal(false);
      setPreviewData(null);
      fetchRuns();
    } catch (err: any) {
      alert(err.message || 'Failed to generate payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const viewRunDetails = async (runId: string) => {
    try {
      const res: any = await api.get(`/payroll/runs/${runId}`);
      setSelectedRun(res.run);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify = async (runId: string) => {
    try {
      await api.post(`/payroll/runs/${runId}/verify`, { remarks: 'Verified by PVO officer' });
      fetchRuns();
      if (selectedRun?.id === runId) viewRunDetails(runId);
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    }
  };

  const handleFinalize = async (runId: string) => {
    try {
      await api.post(`/payroll/runs/${runId}/finalize`, { remarks: 'Finalized calculation frozen by PFO' });
      fetchRuns();
      if (selectedRun?.id === runId) viewRunDetails(runId);
    } catch (err: any) {
      alert(err.message || 'Finalization failed');
    }
  };

  const handleApprove = async (runId: string) => {
    try {
      await api.post(`/payroll/runs/${runId}/approve`, { remarks: 'Approved by AR Salary for bank disbursement' });
      fetchRuns();
      if (selectedRun?.id === runId) viewRunDetails(runId);
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReturn = async () => {
    if (!selectedRun || !returnRemarks) return;
    try {
      await api.post(`/payroll/runs/${selectedRun.id}/return`, { remarks: returnRemarks });
      setShowReturnModal(false);
      setReturnRemarks('');
      fetchRuns();
      viewRunDetails(selectedRun.id);
    } catch (err: any) {
      alert(err.message || 'Return failed');
    }
  };

  const openPayslip = async (recordId: string) => {
    try {
      const res: any = await api.get(`/self-service/payslips/${recordId}`);
      setPayslipData(res.payslip);
      setShowPayslipModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Payroll Lifecycle Operations
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Generated → Verified → Finalized → Approved (PDF pp. 19-20)
          </p>
        </div>

        {hasRole(['payroll_pda', 'payroll_admin']) && (
          <button className="btn btn-primary" onClick={() => { setShowGenerateModal(true); setPreviewData(null); }}>
            <Play size={16} /> Generate Monthly Payroll
          </button>
        )}
      </div>

      {/* Runs Table */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Financial Year</th>
                <th>Employees</th>
                <th className="money">Gross Total</th>
                <th className="money">Deductions</th>
                <th className="money">Net Payable</th>
                <th>Status</th>
                <th>Workflow Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No payroll runs found. Click "Generate Monthly Payroll" to start a cycle.
                  </td>
                </tr>
              ) : (
                runs.map(run => {
                  const badgeClass =
                    run.status === 'GENERATED' ? 'badge-generated' :
                    run.status === 'VERIFIED' ? 'badge-verified' :
                    run.status === 'FINALIZED' ? 'badge-finalized' :
                    run.status === 'APPROVED' ? 'badge-approved' : 'badge-returned';

                  return (
                    <tr key={run.id} style={{ cursor: 'pointer' }} onClick={() => viewRunDetails(run.id)}>
                      <td><strong>{run.period?.name}</strong></td>
                      <td>{run.financialYear?.name}</td>
                      <td>{run.totalEmployees} staff</td>
                      <td className="money">₹{Number(run.grossTotal).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--danger)' }}>₹{Number(run.deductionsTotal).toLocaleString('en-IN')}</td>
                      <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>₹{Number(run.netTotal).toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{run.status}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => viewRunDetails(run.id)}>
                            Inspect
                          </button>

                          {run.status === 'GENERATED' && hasRole(['payroll_pvo', 'payroll_admin']) && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleVerify(run.id)}>
                              <CheckCheck size={12} /> Verify
                            </button>
                          )}

                          {run.status === 'VERIFIED' && hasRole(['payroll_pfo', 'payroll_admin']) && (
                            <button className="btn btn-secondary btn-sm" style={{ background: '#d97706', color: '#fff' }} onClick={() => handleFinalize(run.id)}>
                              <Lock size={12} /> Finalize
                            </button>
                          )}

                          {run.status === 'FINALIZED' && hasRole(['payroll_ar_salary', 'payroll_admin']) && (
                            <button className="btn btn-success btn-sm" onClick={() => handleApprove(run.id)}>
                              <CheckCircle size={12} /> Approve
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

      {/* Selected Run Drawer / Drilldown */}
      {selectedRun && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <div className="panel-header">
            <div>
              <span className="badge badge-approved" style={{ marginRight: '8px' }}>Cycle: {selectedRun.period?.name}</span>
              <strong style={{ fontSize: '1.1rem' }}>Run #{selectedRun.id.slice(-6)} Details</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Generated by {selectedRun.generatedBy} • Verified by {selectedRun.verifiedBy || 'Pending'} • Finalized by {selectedRun.finalizedBy || 'Pending'} • Approved by {selectedRun.approvedBy || 'Pending'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedRun.status !== 'APPROVED' && hasRole(['payroll_pvo', 'payroll_pfo', 'payroll_ar_salary', 'payroll_admin']) && (
                <button className="btn btn-danger btn-sm" onClick={() => setShowReturnModal(true)}>
                  <RotateCcw size={14} /> Return for Correction
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedRun(null)}>
                <X size={16} /> Close
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Code</th>
                  <th>Employee Name</th>
                  <th>Designation</th>
                  <th>Days (Pay/LOP)</th>
                  <th className="money">Basic Pay</th>
                  <th className="money">Gross Salary</th>
                  <th className="money">Deductions</th>
                  <th className="money">Net Salary</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {selectedRun.records?.map((rec: any) => (
                  <tr key={rec.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{rec.employee?.employeeCode}</td>
                    <td><strong>{rec.employee?.firstName} {rec.employee?.lastName}</strong></td>
                    <td>{rec.employee?.designation?.name}</td>
                    <td>{rec.payableDays} / {Number(rec.leaveLossOfPayDays)}</td>
                    <td className="money">₹{Number(rec.basicPay).toLocaleString('en-IN')}</td>
                    <td className="money">₹{Number(rec.grossAmount).toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--danger)' }}>₹{Number(rec.deductionAmount).toLocaleString('en-IN')}</td>
                    <td className="money" style={{ color: 'var(--success)', fontWeight: 700 }}>₹{Number(rec.netAmount).toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRecord(rec)}>
                          Breakdown
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => openPayslip(rec.id)}>
                          <FileText size={12} /> Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Payroll Preview Modal */}
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Monthly Institutional Payroll</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowGenerateModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Select Payroll Period *</label>
                  <select className="form-select" value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Generation Remarks</label>
                  <input className="form-input" placeholder="e.g. Regular monthly pay run" value={generateRemarks} onChange={e => setGenerateRemarks(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePreview} disabled={previewing}>
                  {previewing ? 'Computing previews...' : 'Run Pre-Processing Calculation Preview'}
                </button>
              </div>

              {previewData && (
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Pre-Processing Financial Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <div>Eligible Staff: <br /><strong>{previewData.totalEmployees} employees</strong></div>
                    <div>Gross Total: <br /><strong className="money" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>₹{previewData.totals?.gross.toLocaleString('en-IN')}</strong></div>
                    <div>Deductions Total: <br /><strong className="money" style={{ color: 'var(--danger)', fontSize: '1rem' }}>₹{previewData.totals?.deductions.toLocaleString('en-IN')}</strong></div>
                    <div>Net Payable: <br /><strong className="money" style={{ color: 'var(--success)', fontSize: '1.1rem' }}>₹{previewData.totals?.net.toLocaleString('en-IN')}</strong></div>
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Staff</th>
                          <th>LOP Days</th>
                          <th className="money">Gross</th>
                          <th className="money">Deductions</th>
                          <th className="money">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.preview?.map((p: any) => (
                          <tr key={p.employee.id}>
                            <td>{p.employee.name} ({p.employee.code})</td>
                            <td>{p.lopDays}</td>
                            <td className="money">₹{p.summary.gross.toLocaleString('en-IN')}</td>
                            <td className="money" style={{ color: 'var(--danger)' }}>₹{p.summary.deductions.toLocaleString('en-IN')}</td>
                            <td className="money" style={{ color: 'var(--success)', fontWeight: 600 }}>₹{p.summary.net.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={submitting || !selectedPeriodId}>
                {submitting ? 'Generating Payroll...' : 'Confirm & Generate (PDA)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Employee Breakdown Modal */}
      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Salary Calculation Breakdown: {selectedRecord.employee?.firstName} {selectedRecord.employee?.lastName}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedRecord(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ color: 'var(--success)', marginBottom: '10px' }}>Earnings & Allowances</h4>
                  <table className="data-table">
                    <thead><tr><th>Head</th><th className="money">Amount</th></tr></thead>
                    <tbody>
                      {selectedRecord.lines?.filter((l: any) => l.headType === 'EARNING').map((l: any) => (
                        <tr key={l.id}>
                          <td>
                            <strong>{l.headName}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.formulaNote}</div>
                          </td>
                          <td className="money">₹{Number(l.amount).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 style={{ color: 'var(--danger)', marginBottom: '10px' }}>Deductions & Recoveries</h4>
                  <table className="data-table">
                    <thead><tr><th>Head</th><th className="money">Amount</th></tr></thead>
                    <tbody>
                      {selectedRecord.lines?.filter((l: any) => l.headType === 'DEDUCTION').map((l: any) => (
                        <tr key={l.id}>
                          <td>
                            <strong>{l.headName}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.formulaNote}</div>
                          </td>
                          <td className="money" style={{ color: 'var(--danger)' }}>₹{Number(l.amount).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Return for Correction Modal */}
      {showReturnModal && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Return Payroll for Correction</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowReturnModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Please provide the specific discrepancy or blocking audit exception that requires adjustment:
              </p>
              <textarea
                className="form-textarea"
                rows={4}
                required
                placeholder="Reason for return..."
                value={returnRemarks}
                onChange={e => setReturnRemarks(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReturn} disabled={!returnRemarks.trim()}>
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Payslip Modal */}
      {showPayslipModal && payslipData && (
        <div className="modal-overlay" onClick={() => setShowPayslipModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()} style={{ background: '#f1f5f9' }}>
            <div className="modal-header" style={{ background: '#ffffff', color: '#0f172a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} />
                <h3 style={{ color: '#0f172a' }}>Institutional Payslip Document</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowPayslipModal(false)}><X size={16} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div className="payslip-sheet">
                <div className="payslip-header">
                  <h2>{payslipData.institution?.name}</h2>
                  <p>{payslipData.institution?.brandName} • Official Salary Slip for {payslipData.period}</p>
                </div>

                <div className="payslip-emp-grid">
                  <div className="payslip-emp-row"><span>Employee Code:</span> <strong>{payslipData.employee?.code}</strong></div>
                  <div className="payslip-emp-row"><span>Designation:</span> <strong>{payslipData.employee?.designation}</strong></div>
                  <div className="payslip-emp-row"><span>Name:</span> <strong>{payslipData.employee?.name}</strong></div>
                  <div className="payslip-emp-row"><span>Department:</span> <strong>{payslipData.employee?.department}</strong></div>
                  <div className="payslip-emp-row"><span>Bank A/C:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{payslipData.employee?.accountNumber} ({payslipData.employee?.bankName})</strong></div>
                  <div className="payslip-emp-row"><span>PAN:</span> <strong style={{ fontFamily: 'var(--font-mono)' }}>{payslipData.employee?.pan}</strong></div>
                  <div className="payslip-emp-row"><span>Working Days:</span> <strong>{payslipData.attendance?.workingDays}</strong></div>
                  <div className="payslip-emp-row"><span>Payable Days:</span> <strong>{payslipData.attendance?.payableDays}</strong></div>
                </div>

                <div className="payslip-salary-split">
                  <div>
                    <h4 style={{ color: '#1e3a8a', marginBottom: '8px' }}>Earnings & Allowances</h4>
                    <table className="payslip-table">
                      <thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Amount (₹)</th></tr></thead>
                      <tbody>
                        {payslipData.earnings?.map((e: any, i: number) => (
                          <tr key={i}><td>{e.name}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(e.amount).toLocaleString('en-IN')}</td></tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>Gross Earnings</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{Number(payslipData.grossAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 style={{ color: '#991b1b', marginBottom: '8px' }}>Deductions & Recoveries</h4>
                    <table className="payslip-table">
                      <thead><tr><th>Component</th><th style={{ textAlign: 'right' }}>Amount (₹)</th></tr></thead>
                      <tbody>
                        {payslipData.deductions?.map((d: any, i: number) => (
                          <tr key={i}><td>{d.name}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Number(d.amount).toLocaleString('en-IN')}</td></tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>Total Deductions</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#991b1b' }}>₹{Number(payslipData.deductionAmount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="payslip-net-box">
                  <h4>Net Payable Salary for {payslipData.period}</h4>
                  <div className="net-val">₹{Number(payslipData.netAmount).toLocaleString('en-IN')}</div>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                    Certified that this is an electronically generated pay bill snapshot authorized by the university finance section.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
