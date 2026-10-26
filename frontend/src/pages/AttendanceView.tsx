import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Clock, AlertCircle, Calendar, Check, X, Download, Table, Layers, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';

export const AttendanceView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly_matrix'>('daily');
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [regularizations, setRegularizations] = useState<any[]>([]);
  const [, setLoading] = useState(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);

  // Monthly Matrix State (Saral PayPack Parity)
  const currentDate = new Date();
  const [matrixMonth, setMatrixMonth] = useState<number>(currentDate.getMonth() + 1);
  const [matrixYear, setMatrixYear] = useState<number>(currentDate.getFullYear());
  const [matrixRows, setMatrixRows] = useState<any[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, dailyRes, regRes]: any = await Promise.all([
        api.get('/attendance/shifts'),
        api.get('/attendance/daily'),
        api.get('/attendance/regularizations')
      ]);
      setShifts(shiftsRes.shifts || []);
      setAttendances(dailyRes.attendances || []);
      setRegularizations(regRes.regularizations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyMatrix = async (m: number, y: number) => {
    setLoadingMatrix(true);
    try {
      const res: any = await api.get(`/attendance/monthly-matrix?month=${m}&year=${y}`);
      setMatrixRows(res.matrix || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    loadData();
    loadMonthlyMatrix(matrixMonth, matrixYear);
  }, []);

  const handlePunch = async (punchType: 'IN' | 'OUT') => {
    try {
      const res: any = await api.post('/attendance/punch', { punchType, source: 'WEB' });
      setPunchMsg(res.message);
      loadData();
      setTimeout(() => setPunchMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Clock-in failed');
    }
  };

  const handleActionReg = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/attendance/regularizations/${id}/action`, { status });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const exportMatrixCSV = () => {
    if (matrixRows.length === 0) return;
    const headers = [
      'Emp Code',
      'Employee Name',
      'Department',
      'Calendar Days',
      'Present Days',
      'Absent Days',
      'Paid Leaves',
      'LOP Days',
      'Overtime Hours',
      'Payable Days'
    ];
    const rows = matrixRows.map(r => [
      `"${r.employeeCode}"`,
      `"${r.employeeName}"`,
      `"${r.department || 'N/A'}"`,
      r.calendarDays,
      r.presentDays,
      r.absentDays,
      r.paidLeaves,
      r.lopDays,
      r.overtimeHours,
      r.payableDays
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PayFlow_Attendance_Matrix_${matrixMonth}_${matrixYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const months = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standardized PageHeader */}
      <PageHeader
        title="Corporate Time & Attendance"
        subtitle="Shift Rostering, Web Clock-In, Biometric Logging & Monthly Attendance Ledger"
        breadcrumbs={[
          { label: 'Time Management' },
          { label: 'Shifts & Attendance' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Attendance Hub</span>}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {punchMsg && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {punchMsg}
              </span>
            )}
            {Boolean(user?.employee || user?.employeeId) ? (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => handlePunch('IN')}>
                  <Clock size={14} /> Web Clock In
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => handlePunch('OUT')}>
                  Clock Out
                </button>
              </>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                Admin Supervisor View
              </span>
            )}
          </div>
        }
      />

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'daily' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('daily')}
        >
          <Layers size={14} /> Daily Rostering & Punches
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'monthly_matrix' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setActiveTab('monthly_matrix');
            loadMonthlyMatrix(matrixMonth, matrixYear);
          }}
        >
          <Table size={14} /> Monthly Attendance Matrix (Saral Ledger)
        </button>
      </div>

      {activeTab === 'daily' ? (
        <>
          {/* Shifts Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {shifts.map(s => (
              <div key={s.id} className="panel" style={{ padding: '16px', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-brand">{s.code}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grace: {s.graceMinutes}m</span>
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-main)' }}>{s.name}</h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Working Window: <strong>{s.startTime}</strong> – <strong>{s.endTime}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Regularizations Approval Section */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
                Attendance Regularization Requests ({regularizations.filter(r => r.status === 'PENDING').length} Pending)
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Missing punch & onsite duty regularization approvals</span>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Attendance Date</th>
                    <th>Reason Category</th>
                    <th>Notes</th>
                    <th>Requested Status</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No attendance regularization requests pending.
                      </td>
                    </tr>
                  ) : (
                    regularizations.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.employee?.firstName} {r.employee?.lastName}</strong> ({r.employee?.employeeCode})</td>
                        <td>{new Date(r.attendanceDate).toLocaleDateString('en-IN')}</td>
                        <td><span className="badge badge-neutral">{r.reasonCode}</span></td>
                        <td style={{ fontSize: '0.8125rem' }}>{r.reasonNotes}</td>
                        <td><span className="badge badge-brand">{r.requestedStatus}</span></td>
                        <td>
                          <span className={`badge ${r.status === 'APPROVED' ? 'badge-approved' : r.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {r.status === 'PENDING' ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleActionReg(r.id, 'APPROVED')}
                                title="Approve Regularization"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                                onClick={() => handleActionReg(r.id, 'REJECTED')}
                                title="Reject Regularization"
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decided</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Punch Ledger */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="panel-title">
                <Clock size={15} color="var(--primary)" />
                Daily Swipes & Biometric Punches ({attendances.length})
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time terminal and web clock-ins</span>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Shift</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Total Hours</th>
                    <th>Overtime</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No daily punches recorded for today. Clock in using the button above.
                      </td>
                    </tr>
                  ) : (
                    attendances.map(a => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.employee?.firstName} {a.employee?.lastName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.employee?.employeeCode}</div>
                        </td>
                        <td>{a.shift?.name || 'General Shift'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{a.checkIn ? new Date(a.checkIn).toLocaleTimeString('en-IN') : '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{a.checkOut ? new Date(a.checkOut).toLocaleTimeString('en-IN') : '—'}</td>
                        <td>{Number(a.workHours || 0).toFixed(1)} hrs</td>
                        <td style={{ color: Number(a.overtimeHours) > 0 ? 'var(--primary)' : 'inherit' }}>
                          {Number(a.overtimeHours || 0).toFixed(1)} hrs
                        </td>
                        <td><span className="badge badge-neutral">{a.source || 'WEB'}</span></td>
                        <td>
                          <span className={`badge ${a.status === 'PRESENT' ? 'badge-approved' : a.status === 'ABSENT' ? 'badge-danger' : 'badge-warning'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Monthly Matrix View */
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="panel-title">
              <Table size={15} color="var(--primary)" />
              Monthly Attendance Ledger Matrix ({matrixRows.length} Staff Enrolled)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                className="form-select"
                value={matrixMonth}
                onChange={e => {
                  const m = Number(e.target.value);
                  setMatrixMonth(m);
                  loadMonthlyMatrix(m, matrixYear);
                }}
                style={{ width: '130px', height: '30px', padding: '0 8px', fontSize: '0.8125rem' }}
              >
                {months.map(m => (
                  <option key={m.num} value={m.num}>{m.name}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={matrixYear}
                onChange={e => {
                  const y = Number(e.target.value);
                  setMatrixYear(y);
                  loadMonthlyMatrix(matrixMonth, y);
                }}
                style={{ width: '90px', height: '30px', padding: '0 8px', fontSize: '0.8125rem' }}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
              <button
                className="btn btn-outline btn-sm"
                onClick={exportMatrixCSV}
                disabled={matrixRows.length === 0}
                title="Download Attendance Matrix CSV"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <strong>Saral PayPack Attendance Ledger Parity:</strong> Payable Days = Calendar Days − Loss of Pay (LOP) Days. Tracks Present Days, Paid Leaves, Absenteeism, and Overtime Hours used directly in monthly payroll calculation.
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th style={{ textAlign: 'center' }}>Calendar</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Paid Leaves</th>
                  <th style={{ textAlign: 'center', color: 'var(--danger)' }}>LOP Days</th>
                  <th style={{ textAlign: 'center' }}>OT (Hrs)</th>
                  <th style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>Payable Days</th>
                </tr>
              </thead>
              <tbody>
                {loadingMatrix ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Loading monthly attendance ledger...
                    </td>
                  </tr>
                ) : matrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No employee attendance records found for this period.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map(row => (
                    <tr key={row.employeeId}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.employeeCode}</td>
                      <td><strong>{row.employeeName}</strong></td>
                      <td>{row.department || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{row.calendarDays}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{row.presentDays}</td>
                      <td style={{ textAlign: 'center' }}>{row.absentDays}</td>
                      <td style={{ textAlign: 'center' }}>{row.paidLeaves}</td>
                      <td style={{ textAlign: 'center', color: row.lopDays > 0 ? 'var(--danger)' : 'inherit', fontWeight: row.lopDays > 0 ? 700 : 400 }}>
                        {row.lopDays}
                      </td>
                      <td style={{ textAlign: 'center' }}>{row.overtimeHours}</td>
                      <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700, background: '#eff6ff' }}>
                        {row.payableDays}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
