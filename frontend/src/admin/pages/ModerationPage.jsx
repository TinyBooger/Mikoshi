import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Link } from 'react-router';
import { AuthContext } from '../../components/AuthProvider';
import PaginationBar from '../../components/PaginationBar';

const TARGET_TYPE_LABELS = {
  character: 'Character',
  scene: 'Scene',
  persona: 'Persona',
  user: 'User',
};

const TARGET_TYPE_BADGE = {
  character: 'bg-primary',
  scene: 'bg-success',
  persona: 'bg-info text-dark',
  user: 'bg-danger',
};

const ACTION_LABELS = {
  warn: 'Warned',
  upload_ban: 'Upload Banned',
  full_ban: 'Full Banned',
  shadow_ban: 'Shadow Banned',
  unban: 'Unbanned',
  ignore: 'Ignored',
  keep: 'Kept',
  hide: 'Hidden',
  delete: 'Deleted',
};

const BAN_REASON_OPTIONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse / Hate Speech' },
  { value: 'underage', label: 'Underage Content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

export default function ModerationPage() {
  const { sessionToken } = useContext(AuthContext);

  // Queue tab state
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actioningId, setActioningId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActioning, setBatchActioning] = useState(false);

  // History tab state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const [activeTab, setActiveTab] = useState('queue');
  const pageSize = 20;

  // Ban dialog state
  const [banDialog, setBanDialog] = useState(null); // { report, action } | null
  const [banDialogBatch, setBanDialogBatch] = useState(null); // { action } | null
  const [banForm, setBanForm] = useState({ ban_reason: '', ban_note: '', days: '' });

  const resetBanForm = () => setBanForm({ ban_reason: '', ban_note: '', days: '' });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/reports?status=pending`,
        { headers: { Authorization: sessionToken } }
      );
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch moderation reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/reports?status=resolved`,
        { headers: { Authorization: sessionToken } }
      );
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch moderation history:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  // ── Single action ──────────────────────────────────────────
  const applyAction = async (report, action, extra = {}) => {
    setActioningId(report.id);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/reports/${report.id}/action`,
        {
          method: 'POST',
          headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Unknown error'}`);
        return;
      }
      fetchReports();
    } catch (err) {
      console.error('Failed to apply moderation action:', err);
      alert('Failed to apply action');
    } finally {
      setActioningId(null);
    }
  };

  // Open the ban dialog for a single report
  const handleOpenBanDialog = (report, action) => {
    resetBanForm();
    setBanDialog({ report, action });
  };

  // Submit ban from dialog (single)
  const handleSubmitBanDialog = () => {
    if (!banDialog) return;
    const { report, action } = banDialog;
    const extra = {
      ban_reason: banForm.ban_reason || undefined,
      ban_note: banForm.ban_note || undefined,
    };
    if (banForm.days) {
      const days = parseInt(banForm.days, 10);
      if (!isNaN(days) && days > 0) {
        extra.ban_until = new Date(Date.now() + days * 86400000).toISOString();
      }
    }
    setBanDialog(null);
    applyAction(report, action, extra);
  };

  // Open ban dialog for batch
  const handleOpenBatchBanDialog = (action) => {
    if (selectedIds.size === 0) return;
    resetBanForm();
    setBanDialogBatch({ action });
  };

  // Submit ban from dialog (batch)
  const handleSubmitBatchBanDialog = () => {
    if (!banDialogBatch) return;
    const { action } = banDialogBatch;
    const extra = {
      ban_reason: banForm.ban_reason || undefined,
      ban_note: banForm.ban_note || undefined,
    };
    if (banForm.days) {
      const days = parseInt(banForm.days, 10);
      if (!isNaN(days) && days > 0) {
        extra.ban_until = new Date(Date.now() + days * 86400000).toISOString();
      }
    }
    setBanDialogBatch(null);
    applyBatchAction(action, extra);
  };

  const handleActionWithNotes = (report, action) => {
    const notes = prompt('Add notes (optional):') || '';
    applyAction(report, action, { notes });
  };

  // ── Batch action ───────────────────────────────────────────
  const applyBatchAction = async (action, extra = {}) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Apply "${action}" to ${selectedIds.size} selected report(s)?`)) return;

    setBatchActioning(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/batch-action`,
        {
          method: 'POST',
          headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_ids: Array.from(selectedIds), action, ...extra }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Unknown error'}`);
        return;
      }
      setSelectedIds(new Set());
      fetchReports();
    } catch (err) {
      console.error('Failed to apply batch action:', err);
      alert('Failed to apply batch action');
    } finally {
      setBatchActioning(false);
    }
  };

  // ── Selection helpers ──────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pagedIds = pagedReports.map((r) => r.id);
    const allSelected = pagedIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allSelected ? pagedIds.forEach((id) => next.delete(id)) : pagedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedReports = reports.filter((r) => selectedIds.has(r.id));
  const allUserSelected = selectedReports.length > 0 && selectedReports.every((r) => r.target_type === 'user');
  const allContentSelected = selectedReports.length > 0 && selectedReports.every((r) => r.target_type !== 'user');

  // ── Formatting helpers ─────────────────────────────────────
  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const renderTargetCell = (report) => {
    const info = report.target_info || {};
    const label = info.name || report.target_name || `#${report.target_id || report.target_string_id || '-'}`;
    const statusBadge = info.exists === false
      ? <span className="badge bg-secondary ms-1">Deleted</span>
      : report.target_type !== 'user'
        ? <span className={`badge ms-1 ${info.is_public ? 'bg-success' : 'bg-warning text-dark'}`}>
            {info.is_public ? 'Public' : 'Hidden'}
          </span>
        : null;
    const banBadge = info.ban_type === 'full_ban'
      ? <span className="badge bg-danger ms-1">Full Banned</span>
      : info.ban_type === 'upload_ban'
        ? <span className="badge bg-warning text-dark ms-1">Upload Banned</span>
        : info.ban_type === 'shadow_ban'
          ? <span className="badge bg-secondary ms-1">Shadow Banned</span>
          : null;
    const profileLink = report.target_type === 'user' && report.target_string_id
      ? <Link className="small" to={`/profile/${report.target_string_id}`} target="_blank" rel="noreferrer">View Profile</Link>
      : null;
    return (
      <div className="small">
        <div className="fw-semibold">{label}</div>
        {info.creator_name && <div className="text-muted">by {info.creator_name}</div>}
        {info.email && <div className="text-muted">{info.email}</div>}
        <div>{statusBadge}{banBadge}</div>
        {info.ban_type && info.ban_reason && (
          <div className="text-muted">Reason: <em>{info.ban_reason}</em></div>
        )}
        {info.ban_type && info.ban_note && (
          <div className="text-muted">Note: <em>{info.ban_note}</em></div>
        )}
        {info.ban_type && info.ban_until && (
          <div className="text-muted">Until: {new Date(info.ban_until).toLocaleDateString()}</div>
        )}
        {profileLink}
      </div>
    );
  };

  const renderActions = (report) => {
    const disabled = actioningId === report.id;
    if (report.target_type === 'user') {
      const isBanned = !!report.target_info?.ban_type;
      return (
        <div className="d-flex flex-wrap gap-1">
          <button className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => handleActionWithNotes(report, 'ignore')}>Ignore</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => handleActionWithNotes(report, 'warn')}>Warn</button>
          <button className="btn btn-sm btn-outline-warning" disabled={disabled} onClick={() => handleOpenBanDialog(report, 'upload_ban')}>Upload Ban</button>
          <button className="btn btn-sm btn-outline-danger" disabled={disabled} onClick={() => handleOpenBanDialog(report, 'full_ban')}>Full Ban</button>
          <button className="btn btn-sm btn-outline-dark" disabled={disabled} onClick={() => handleOpenBanDialog(report, 'shadow_ban')}>Shadow Ban</button>
          <button className="btn btn-sm btn-outline-success" disabled={disabled || !isBanned} onClick={() => applyAction(report, 'unban', {})}>Unban</button>
        </div>
      );
    }
    return (
      <div className="btn-group btn-group-sm">
        <button className="btn btn-outline-secondary" disabled={disabled} onClick={() => handleActionWithNotes(report, 'ignore')}>Ignore</button>
        <button className="btn btn-outline-success" disabled={disabled} onClick={() => handleActionWithNotes(report, 'keep')}>Keep</button>
        <button className="btn btn-outline-warning" disabled={disabled} onClick={() => handleActionWithNotes(report, 'hide')}>Hide</button>
        <button className="btn btn-outline-danger" disabled={disabled} onClick={() => handleActionWithNotes(report, 'delete')}>Delete</button>
      </div>
    );
  };

  const pagedReports = reports.slice((page - 1) * pageSize, page * pageSize);
  const pagedHistory = history.slice((historyPage - 1) * pageSize, historyPage * pageSize);
  const allPageSelected = pagedReports.length > 0 && pagedReports.every((r) => selectedIds.has(r.id));

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
    <div className="container-fluid">
      <h2 className="mb-3">Moderation</h2>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            Report Queue
            {reports.length > 0 && (
              <span className="badge bg-danger ms-2">{reports.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </li>
      </ul>

      {/* ── QUEUE TAB ── */}
      {activeTab === 'queue' && (
        <>
          {/* Batch action bar */}
          {selectedIds.size > 0 && (
            <div className="alert alert-secondary d-flex align-items-center gap-3 mb-3 flex-wrap">
              <span className="fw-semibold">{selectedIds.size} selected</span>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary" disabled={batchActioning} onClick={() => applyBatchAction('ignore', { notes: '' })}>Ignore</button>
                {(allUserSelected || (!allContentSelected)) && (
                  <>
                    <button className="btn btn-sm btn-outline-secondary" disabled={batchActioning || !allUserSelected} onClick={() => applyBatchAction('warn', { notes: '' })}>Warn</button>
                    <button className="btn btn-sm btn-outline-warning" disabled={batchActioning || !allUserSelected} onClick={() => handleOpenBatchBanDialog('upload_ban')}>Upload Ban</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={batchActioning || !allUserSelected} onClick={() => handleOpenBatchBanDialog('full_ban')}>Full Ban</button>
                    <button className="btn btn-sm btn-outline-dark" disabled={batchActioning || !allUserSelected} onClick={() => handleOpenBatchBanDialog('shadow_ban')}>Shadow Ban</button>
                    <button className="btn btn-sm btn-outline-success" disabled={batchActioning || !allUserSelected} onClick={() => applyBatchAction('unban', {})}>Unban</button>
                  </>
                )}
                {(allContentSelected || (!allUserSelected)) && (
                  <>
                    <button className="btn btn-sm btn-outline-success" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('keep', { notes: '' })}>Keep</button>
                    <button className="btn btn-sm btn-outline-warning" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('hide', { notes: '' })}>Hide</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('delete', { notes: '' })}>Delete</button>
                  </>
                )}
              </div>
              <button className="btn btn-sm btn-link ms-auto text-secondary" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
            </div>
          )}

          <div className="d-flex justify-content-end mb-2">
            <span className="text-muted small">Total pending: {reports.length}</span>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="alert alert-success">No pending reports.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={allPageSelected}
                          onChange={toggleSelectAll}
                          title="Select all on this page"
                        />
                      </th>
                      <th>ID</th>
                      <th>Reporter</th>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Reason</th>
                      <th>Description</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedReports.map((report) => (
                      <tr key={report.id} className={selectedIds.has(report.id) ? 'table-active' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedIds.has(report.id)}
                            onChange={() => toggleSelect(report.id)}
                          />
                        </td>
                        <td>#{report.id}</td>
                        <td>
                          <div className="small">
                            <div>{report.reporter_name || '—'}</div>
                            <div className="text-muted">{report.reporter_email || ''}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${TARGET_TYPE_BADGE[report.target_type] || 'bg-secondary'}`}>
                            {TARGET_TYPE_LABELS[report.target_type] || report.target_type}
                          </span>
                        </td>
                        <td>{renderTargetCell(report)}</td>
                        <td><span className="small">{report.reason || '-'}</span></td>
                        <td>
                          <div className="small" style={{ maxWidth: 260, maxHeight: 80, overflow: 'auto' }}>
                            {report.description || '-'}
                          </div>
                        </td>
                        <td className="small">{formatDate(report.created_time)}</td>
                        <td>{renderActions(report)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={page} total={reports.length} pageSize={pageSize} loading={loading} onPageChange={(p) => { setPage(p); setSelectedIds(new Set()); }} />
            </>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">Total resolved: {history.length}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={fetchHistory} disabled={historyLoading}>
              {historyLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {historyLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
            </div>
          ) : history.length === 0 ? (
            <div className="alert alert-info">No resolved reports yet.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Reporter</th>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Reason</th>
                      <th>Action Taken</th>
                      <th>Notes</th>
                      <th>Resolved By</th>
                      <th>Resolved At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHistory.map((report) => (
                      <tr key={report.id}>
                        <td>#{report.id}</td>
                        <td>
                          <div className="small">
                            <div>{report.reporter_name || '—'}</div>
                            <div className="text-muted">{report.reporter_email || ''}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${TARGET_TYPE_BADGE[report.target_type] || 'bg-secondary'}`}>
                            {TARGET_TYPE_LABELS[report.target_type] || report.target_type}
                          </span>
                        </td>
                        <td>{renderTargetCell(report)}</td>
                        <td><span className="small">{report.reason || '-'}</span></td>
                        <td>
                          {report.action_taken ? (
                            <span className="badge bg-secondary">
                              {ACTION_LABELS[report.action_taken] || report.action_taken}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <div className="small" style={{ maxWidth: 200, maxHeight: 60, overflow: 'auto' }}>
                            {report.admin_notes || '-'}
                          </div>
                        </td>
                        <td className="small">{report.resolved_by_name || '-'}</td>
                        <td className="small">{formatDate(report.resolved_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={historyPage} total={history.length} pageSize={pageSize} loading={historyLoading} onPageChange={setHistoryPage} />
            </>
          )}
        </>
      )}
    </div>

    {/* ── Ban Dialog Modal ── */}    {(banDialog || banDialogBatch) && (() => {
      const action = banDialog ? banDialog.action : banDialogBatch.action;
      const title = { upload_ban: 'Upload Ban', full_ban: 'Full Ban', shadow_ban: 'Shadow Ban' }[action] || action;
      const onSubmit = banDialog ? handleSubmitBanDialog : handleSubmitBatchBanDialog;
      const onCancel = banDialog ? () => setBanDialog(null) : () => setBanDialogBatch(null);
      return (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Apply {title}</h5>
                <button type="button" className="btn-close" onClick={onCancel} />
              </div>
              <div className="modal-body">
                {banDialog && (
                  <div className="mb-2 small text-muted">
                    Target: <strong>{banDialog.report.target_info?.name || banDialog.report.target_name || `#${banDialog.report.id}`}</strong>
                    {banDialog.report.target_info?.email && ` (${banDialog.report.target_info.email})`}
                  </div>
                )}
                {banDialogBatch && (
                  <div className="mb-2 small text-muted">Applying to <strong>{selectedIds.size}</strong> selected reports.</div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold">Ban Reason <span className="text-muted fw-normal">(internal tag)</span></label>
                  <select
                    className="form-select"
                    value={banForm.ban_reason}
                    onChange={(e) => setBanForm((f) => ({ ...f, ban_reason: e.target.value }))}
                  >
                    <option value="">— select reason —</option>
                    {BAN_REASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Moderator Note <span className="text-muted fw-normal">(optional, visible to mods)</span></label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Add any additional context..."
                    value={banForm.ban_note}
                    onChange={(e) => setBanForm((f) => ({ ...f, ban_note: e.target.value }))}
                  />
                </div>

                <div className="mb-1">
                  <label className="form-label fw-semibold">Duration <span className="text-muted fw-normal">(days, optional — leave blank for permanent)</span></label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    placeholder="e.g. 7 for one week"
                    value={banForm.days}
                    onChange={(e) => setBanForm((f) => ({ ...f, days: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn btn-danger" onClick={onSubmit}>Apply {title}</button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}