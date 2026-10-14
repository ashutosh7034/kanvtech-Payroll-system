import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export const ImportsView: React.FC = () => {
  const { hasRole } = useAuth();
  const [importType, setImportType] = useState('SALARY_CONFIG');
  const [csvContent, setCsvContent] = useState(`employeeCode,basicPay,payLevelNumber,effectiveFrom,cityCategory
EMP-1001,135300,13,2026-07-01,X
EMP-1002,82200,12,2026-07-01,X
EMP-1003,46200,7,2026-07-01,X`);

  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const res: any = await api.get(`/imports/template/${importType}`);
      const headers = res.template.headers.join(',');
      const rows = res.template.sampleRows.map((r: any) => Object.values(r).join(',')).join('\n');
      const sample = `${headers}\n${rows}`;
      setCsvContent(sample);
    } catch (err: any) {
      alert(err.message || 'Failed to get template');
    }
  };

  const parseCsvToJson = (csv: string): any[] => {
    const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = parts[idx] ?? '';
      });
      data.push(obj);
    }
    return data;
  };

  const handleValidateDryRun = async () => {
    setValidating(true);
    setValidationResult(null);
    setCommitSuccess(null);
    try {
      const parsedRows = parseCsvToJson(csvContent);
      if (parsedRows.length === 0) {
        alert('Please provide valid CSV content with a header line and at least one data row.');
        setValidating(false);
        return;
      }

      const res: any = await api.post('/imports/validate', {
        importType,
        fileName: `${importType.toLowerCase()}_upload.csv`,
        rows: parsedRows
      });
      setValidationResult(res);
    } catch (err: any) {
      alert(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!validationResult) return;
    setCommitting(true);
    try {
      const parsedRows = parseCsvToJson(csvContent);
      const res: any = await api.post('/imports/commit', {
        jobId: validationResult.jobId,
        rows: parsedRows
      });
      setCommitSuccess(res.message);
      setValidationResult(null);
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Bulk Spreadsheet Upload Engine
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            15-Step Dry-Run Validation, Row-Level Error Isolation & Safe Commit (PDF pp. 12-13, Section 20)
          </p>
        </div>

        <button className="btn btn-outline" onClick={handleDownloadTemplate}>
          <Download size={14} /> Load Preset Template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Input Panel */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">1. Select Category & Data</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Supported Import Category</label>
            <select className="form-select" value={importType} onChange={e => setImportType(e.target.value)}>
              <option value="SALARY_CONFIG">Salary Configuration (Basic, Pay Level, City Category)</option>
              <option value="RECURRING_DATA">Recurring Monthly Adjustments (Special Allowance)</option>
              <option value="ONE_TIME_DATA">One-Time Taxable Payments (Honorarium, Bonus)</option>
              <option value="CITY_CATEGORIES">City Category Assignment (X, Y, Z)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">CSV Content (Headers + Data Rows)</label>
            <textarea
              className="form-textarea"
              rows={12}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
            />
          </div>

          {hasRole(['payroll_admin', 'payroll_pcm']) && (
            <button className="btn btn-primary" onClick={handleValidateDryRun} disabled={validating}>
              <Upload size={16} /> {validating ? 'Running Dry-Run Validation...' : 'Execute Dry-Run Validation'}
            </button>
          )}
        </div>

        {/* Validation Result Panel */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">2. Dry-Run Validation Report</h3>
          </div>

          {commitSuccess && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Import Committed Successfully</strong>
                <p style={{ fontSize: '0.82rem' }}>{commitSuccess}</p>
              </div>
            </div>
          )}

          {!validationResult && !commitSuccess && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <FileSpreadsheet size={42} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>No dry-run performed yet.</p>
              <p style={{ fontSize: '0.8rem' }}>Enter or paste CSV records on the left and click "Execute Dry-Run Validation". No database writes will occur during dry-run.</p>
            </div>
          )}

          {validationResult && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Total Rows: <br /><strong>{validationResult.totalRows} rows</strong>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Valid Rows: <br /><strong style={{ color: 'var(--success)' }}>{validationResult.validRowsCount} rows</strong>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  Errors: <br /><strong style={{ color: validationResult.errorRowsCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{validationResult.errorRowsCount} rows</strong>
                </div>
              </div>

              {validationResult.errors?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <AlertTriangle size={14} /> Isolated Row Errors (Must be resolved or skipped):
                  </h4>
                  <div className="table-container" style={{ maxHeight: '180px' }}>
                    <table className="data-table" style={{ fontSize: '0.78rem' }}>
                      <thead><tr><th>Row #</th><th>Field</th><th>Reason</th></tr></thead>
                      <tbody>
                        {validationResult.errors.map((e: any, i: number) => (
                          <tr key={i}>
                            <td>Row #{e.rowNumber}</td>
                            <td>{e.fieldName || '-'}</td>
                            <td style={{ color: 'var(--danger)' }}>{e.errorReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {validationResult.validRowsCount > 0 && (
                <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                    Ready to commit <strong>{validationResult.validRowsCount}</strong> verified records into the institutional database.
                  </p>
                  <button className="btn btn-success" onClick={handleCommit} disabled={committing}>
                    {committing ? 'Committing Data...' : 'Confirm & Commit Records Safely'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
