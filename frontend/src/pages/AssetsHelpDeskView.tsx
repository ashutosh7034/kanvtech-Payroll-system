import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/common/PageHeader';
import { FormModal } from '../components/common/FormModal';
import { SideDrawer } from '../components/common/SideDrawer';
import { Laptop, HelpCircle, Plus, Check, MessageSquare, User, CheckCircle2, AlertCircle } from 'lucide-react';

export const AssetsHelpDeskView: React.FC = () => {
  const { user, canViewTab, canPerformAction } = useAuth();
  const canViewInventory = canViewTab('tab:assets:inventory');
  const canCreateAsset = canPerformAction('asset:create');
  const canAllocateAsset = canPerformAction('asset:allocate');

  const [activeTab, setActiveTab] = useState<'assets' | 'helpdesk'>(() => {
    return canViewTab('tab:assets:inventory') ? 'assets' : 'helpdesk';
  });

  // Safety guard: If activeTab is assets but user cannot view inventory, auto-switch to helpdesk
  useEffect(() => {
    if (activeTab === 'assets' && !canViewInventory) {
      setActiveTab('helpdesk');
    }
  }, [activeTab, canViewInventory]);

  const [assets, setAssets] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New Asset Modal (Pattern B)
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetTag, setAssetTag] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('LAPTOP');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetCondition, setAssetCondition] = useState('NEW');
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);

  // Allocate Asset Modal (Pattern B)
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [allocateEmployeeId, setAllocateEmployeeId] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);

  // New Ticket Modal (Pattern B)
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategoryId, setTicketCategoryId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Ticket Comment Drawer (Pattern C)
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [newComment, setNewComment] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetRes, ticketRes, catRes, empRes]: any = await Promise.all([
        api.get('/assets').catch(() => ({ assets: [] })),
        api.get('/helpdesk/tickets').catch(() => ({ tickets: [] })),
        api.get('/helpdesk/categories').catch(() => ({ categories: [] })),
        api.get('/employees').catch(() => ({ employees: [] }))
      ]);
      setAssets(assetRes.assets || []);
      setTickets(ticketRes.tickets || []);
      setCategories(catRes.categories || []);
      setEmployees(empRes.employees || []);
      if (catRes.categories && catRes.categories.length > 0 && !ticketCategoryId) {
        setTicketCategoryId(catRes.categories[0].id);
      }
      if (empRes.employees && empRes.employees.length > 0 && !allocateEmployeeId) {
        setAllocateEmployeeId(empRes.employees[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAsset(true);
    try {
      await api.post('/assets', {
        assetTag,
        name: assetName,
        category: assetCategory,
        serialNumber,
        condition: assetCondition
      });
      setShowAssetModal(false);
      setAssetTag('');
      setAssetName('');
      setSerialNumber('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create asset');
    } finally {
      setIsCreatingAsset(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setIsAllocating(true);
    try {
      await api.post(`/assets/${selectedAsset.id}/allocate`, {
        employeeId: allocateEmployeeId,
        assignedDate: new Date().toISOString()
      });
      setShowAllocateModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate asset');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleReturnAsset = async (assetId: string) => {
    try {
      await api.post(`/assets/${assetId}/return`, {});
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to return asset');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTicket(true);
    try {
      await api.post('/helpdesk/tickets', {
        categoryId: ticketCategoryId,
        subject: ticketSubject,
        priority: ticketPriority,
        description: ticketDesc
      });
      setShowTicketModal(false);
      setTicketSubject('');
      setTicketDesc('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to raise ticket');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !newComment.trim()) return;
    try {
      await api.post(`/helpdesk/tickets/${activeTicket.id}/comments`, {
        message: newComment
      });
      setNewComment('');
      // Refresh active ticket details
      const res: any = await api.get('/helpdesk/tickets');
      const updated = (res.tickets || []).find((t: any) => t.id === activeTicket.id);
      if (updated) setActiveTicket(updated);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard PageHeader */}
      <PageHeader
        title="Hardware Asset Management & IT Help Desk"
        subtitle="Hardware Allocations, Serial Tracking & Employee IT Support Desk"
        breadcrumbs={[
          { label: 'Business Operations' },
          { label: 'Assets & Help Desk' }
        ]}
        badge={<span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>Service Desk</span>}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'assets' && canCreateAsset && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssetModal(true)}>
                <Plus size={14} /> Register New Asset
              </button>
            )}
            {activeTab === 'helpdesk' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowTicketModal(true)}>
                <Plus size={14} /> Raise Ticket
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {canViewInventory && (
          <button
            className={`btn btn-sm ${activeTab === 'assets' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('assets')}
          >
            <Laptop size={14} /> Hardware Assets ({assets.length})
          </button>
        )}
        <button
          className={`btn btn-sm ${activeTab === 'helpdesk' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('helpdesk')}
        >
          <HelpCircle size={14} /> Support Tickets ({tickets.length})
        </button>
      </div>

      {activeTab === 'assets' && canViewInventory ? (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="panel-title">Asset Inventory & Employee Custody</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time hardware allocation state</span>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Device / Model</th>
                  <th>Category</th>
                  <th>Serial Number</th>
                  <th>Status</th>
                  <th>Current Custodian</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No corporate assets found.
                    </td>
                  </tr>
                ) : (
                  assets.map(asset => {
                    const currentAlloc = asset.allocations?.find((a: any) => !a.returnedDate);
                    return (
                      <tr key={asset.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{asset.assetTag}</td>
                        <td><strong>{asset.name}</strong></td>
                        <td><span className="badge badge-neutral">{asset.category}</span></td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{asset.serialNumber || '—'}</td>
                        <td>
                          <span className={`badge ${asset.status === 'ALLOCATED' ? 'badge-approved' : asset.status === 'AVAILABLE' ? 'badge-finalized' : 'badge-neutral'}`}>
                            {asset.status}
                          </span>
                        </td>
                        <td>
                          {currentAlloc ? (
                            <div>
                              <strong>{currentAlloc.employee?.firstName} {currentAlloc.employee?.lastName}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentAlloc.employee?.employeeCode}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>In Stock</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {asset.status === 'AVAILABLE' && canAllocateAsset && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowAllocateModal(true);
                              }}
                            >
                              Assign
                            </button>
                          )}
                          {asset.status === 'ALLOCATED' && canAllocateAsset && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleReturnAsset(asset.id)}
                            >
                              De-allocate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="panel-title">Employee Support Tickets</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active issue resolutions</span>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Requester</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Discussion</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No support tickets logged. Click "Raise Ticket" to log an issue.
                    </td>
                  </tr>
                ) : (
                  tickets.map(ticket => (
                    <tr key={ticket.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {ticket.ticketNumber || `TICK-${ticket.id.slice(-6).toUpperCase()}`}
                      </td>
                      <td>
                        <strong>{ticket.subject}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.description}
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">{ticket.category?.name || 'General'}</span></td>
                      <td>
                        <div>{ticket.employee?.firstName} {ticket.employee?.lastName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ticket.employee?.employeeCode}</div>
                      </td>
                      <td>
                        <span className={`badge ${ticket.priority === 'HIGH' ? 'badge-danger' : ticket.priority === 'MEDIUM' ? 'badge-warning' : 'badge-neutral'}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'badge-approved' : 'badge-neutral'}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setActiveTicket(ticket)}>
                          <MessageSquare size={12} /> Discuss ({ticket.comments?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Asset Modal (Pattern B) */}
      <FormModal
        isOpen={showAssetModal && canCreateAsset}
        onClose={() => setShowAssetModal(false)}
        title="Register IT / Hardware Asset"
        subtitle="Catalog corporate inventory item for serial and warranty tracking"
        icon={<Laptop size={18} />}
        width="md"
        onSubmit={handleCreateAsset}
        submitLabel="Save Asset"
        isSubmitting={isCreatingAsset}
      >
        <div className="form-group">
          <label className="form-label">Asset Tag *</label>
          <input
            type="text"
            className="form-input"
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            placeholder="e.g. AG-LAP-042"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Make & Model *</label>
          <input
            type="text"
            className="form-input"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            placeholder="e.g. Dell Latitude 7420 16GB Core i7"
            required
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)}>
              <option value="LAPTOP">Laptop</option>
              <option value="MONITOR">Monitor</option>
              <option value="PHONE">Mobile Phone</option>
              <option value="ACCESS_CARD">Access Card</option>
              <option value="OTHER">Other Peripheral</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Condition</label>
            <select className="form-select" value={assetCondition} onChange={(e) => setAssetCondition(e.target.value)}>
              <option value="NEW">New</option>
              <option value="GOOD">Good / Working</option>
              <option value="REPAIRED">Repaired</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Serial Number</label>
          <input
            type="text"
            className="form-input"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="e.g. 5CD2348ABC"
          />
        </div>
      </FormModal>

      {/* Allocate Modal (Pattern B) */}
      {selectedAsset && (
        <FormModal
          isOpen={showAllocateModal && canAllocateAsset}
          onClose={() => setShowAllocateModal(false)}
          title="Assign Asset Custody"
          subtitle={`Assign ${selectedAsset.name} (${selectedAsset.assetTag}) to employee`}
          icon={<User size={18} />}
          width="sm"
          onSubmit={handleAllocate}
          submitLabel="Confirm Allocation"
          isSubmitting={isAllocating}
        >
          <div className="form-group">
            <label className="form-label">Assign To Employee *</label>
            <select className="form-select" value={allocateEmployeeId} onChange={(e) => setAllocateEmployeeId(e.target.value)} required>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </FormModal>
      )}

      {/* Raise Ticket Modal (Pattern B) */}
      <FormModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        title="Raise Support / Help Desk Ticket"
        subtitle="Log corporate IT or administrative ticket for institutional resolution"
        icon={<HelpCircle size={18} />}
        width="md"
        onSubmit={handleCreateTicket}
        submitLabel="Submit Ticket"
        isSubmitting={isSubmittingTicket}
      >
        <div className="form-group">
          <label className="form-label">Ticket Category *</label>
          <select className="form-select" value={ticketCategoryId} onChange={(e) => setTicketCategoryId(e.target.value)} required>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Subject *</label>
          <input
            type="text"
            className="form-input"
            placeholder="Brief summary of the issue..."
            value={ticketSubject}
            onChange={(e) => setTicketSubject(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-select" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High / Urgent</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Description / Details *</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Detailed description of the technical or facilities problem..."
            value={ticketDesc}
            onChange={(e) => setTicketDesc(e.target.value)}
            required
          />
        </div>
      </FormModal>

      {/* Ticket Discussion Drawer (Pattern C) */}
      <SideDrawer
        isOpen={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        title={activeTicket?.subject || 'Support Ticket'}
        subtitle={`Status: ${activeTicket?.status || ''} • Priority: ${activeTicket?.priority || ''}`}
        width="520px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setActiveTicket(null)}>
              Close
            </button>
          </div>
        }
      >
        {activeTicket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-main)' }}>Original Description:</div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{activeTicket.description}</p>
            </div>

            <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginTop: '4px' }}>Responses & Activity:</div>
            {(activeTicket.comments || []).length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>No responses logged yet.</div>
            ) : (
              activeTicket.comments.map((c: any) => (
                <div key={c.id} style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <strong>{c.author?.firstName} {c.author?.lastName}</strong>
                    <span>{new Date(c.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '0.8125rem', color: 'var(--text-main)' }}>{c.message}</div>
                </div>
              ))
            )}

            <form onSubmit={handleAddComment} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Write a response..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Check size={14} /> Send
              </button>
            </form>
          </div>
        )}
      </SideDrawer>
    </div>
  );
};