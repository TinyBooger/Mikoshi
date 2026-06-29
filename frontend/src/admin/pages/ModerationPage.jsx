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
  restrict: 'Restricted',
  takedown: 'Taken Down',
  delete: 'Deleted',
  // legacy
  hide: 'Hidden',
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

  // Appeal queue state
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsPage, setAppealsPage] = useState(1);
  const [appealActioningId, setAppealActioningId] = useState(null);
  const [appealDialog, setAppealDialog] = useState(null); // { appeal, action } | null
  const [appealReply, setAppealReply] = useState('');

  // Content appeal queue state
  const [contentAppeals, setContentAppeals] = useState([]);
  const [contentAppealsLoading, setContentAppealsLoading] = useState(false);
  const [contentAppealsPage, setContentAppealsPage] = useState(1);
  const [contentAppealActioningId, setContentAppealActioningId] = useState(null);
  const [contentAppealDialog, setContentAppealDialog] = useState(null); // { appeal, action } | null
  const [contentAppealReply, setContentAppealReply] = useState('');

  const [activeTab, setActiveTab] = useState('queue');
  const pageSize = 20;

  // Ban dialog state
  const [banDialog, setBanDialog] = useState(null); // { report, action } | null
  const [banDialogBatch, setBanDialogBatch] = useState(null); // { action } | null
  const [banForm, setBanForm] = useState({ ban_reason: '', ban_note: '', days: '' });

  // Violation history modal
  const [violationModal, setViolationModal] = useState(null); // { userId, userName, data } | null
  const [violationModalLoading, setViolationModalLoading] = useState(false);
  const [violationTab, setViolationTab] = useState('account');

  const resetBanForm = () => setBanForm({ ban_reason: '', ban_note: '', days: '' });

  const fetchAppeals = useCallback(async () => {
    setAppealsLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/appeals?status=pending`,
        { headers: { Authorization: sessionToken } }
      );
      const data = await res.json();
      setAppeals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch appeals:', err);
      setAppeals([]);
    } finally {
      setAppealsLoading(false);
    }
  }, [sessionToken]);

  const fetchContentAppeals = useCallback(async () => {
    setContentAppealsLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/content-appeals?status=pending`,
        { headers: { Authorization: sessionToken } }
      );
      const data = await res.json();
      setContentAppeals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch content appeals:', err);
      setContentAppeals([]);
    } finally {
      setContentAppealsLoading(false);
    }
  }, [sessionToken]);

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

  useEffect(() => {
    if (activeTab === 'appeals') fetchAppeals();
  }, [activeTab, fetchAppeals]);

  useEffect(() => {
    if (activeTab === 'contentAppeals') fetchContentAppeals();
  }, [activeTab, fetchContentAppeals]);

  // ── Violation history modal ────────────────────────────────
  const openViolationHistory = async (userId, userName) => {
    setViolationTab('account');
    setViolationModal({ userId, userName, data: null });
    setViolationModalLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/users/${userId}/violation-history`,
        { headers: { Authorization: sessionToken } }
      );
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setViolationModal({ userId, userName, data });
    } catch (err) {
      console.error(err);
      alert('Failed to load violation history');
      setViolationModal(null);
    } finally {
      setViolationModalLoading(false);
    }
  };

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

  // ── Appeal actions ─────────────────────────────────────────
  const handleOpenAppealDialog = (appeal, action) => {
    setAppealReply('');
    setAppealDialog({ appeal, action });
  };

  const handleSubmitAppealDialog = async () => {
    if (!appealDialog) return;
    const { appeal, action } = appealDialog;
    const reply = appealReply.trim();
    setAppealActioningId(appeal.id);
    setAppealDialog(null);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/appeals/${appeal.id}/action`,
        {
          method: 'POST',
          headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reply }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Unknown error'}`);
        return;
      }
      fetchAppeals();
    } catch (err) {
      console.error('Failed to resolve appeal:', err);
      alert('Failed to resolve appeal');
    } finally {
      setAppealActioningId(null);
    }
  };

  // ── Content appeal actions ─────────────────────────────────
  const handleOpenContentAppealDialog = (appeal, action) => {
    setContentAppealReply('');
    setContentAppealDialog({ appeal, action });
  };

  const handleSubmitContentAppealDialog = async () => {
    if (!contentAppealDialog) return;
    const { appeal, action } = contentAppealDialog;
    const reply = contentAppealReply.trim();
    setContentAppealActioningId(appeal.id);
    setContentAppealDialog(null);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/moderation/content-appeals/${appeal.id}/action`,
        {
          method: 'POST',
          headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reply }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Unknown error'}`);
        return;
      }
      fetchContentAppeals();
    } catch (err) {
      console.error('Failed to resolve content appeal:', err);
      alert('Failed to resolve content appeal');
    } finally {
      setContentAppealActioningId(null);
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

    let contentStatusBadge = null;
    if (report.target_type !== 'user' && info.exists !== false) {
      if (info.moderation_status === 'takedown') {
        contentStatusBadge = <span className="badge bg-danger ms-1">Taken Down</span>;
      } else if (info.moderation_status === 'restricted') {
        contentStatusBadge = <span className="badge bg-warning text-dark ms-1">Restricted</span>;
      } else if (info.is_public) {
        contentStatusBadge = <span className="badge bg-success ms-1">Public</span>;
      } else {
        contentStatusBadge = <span className="badge bg-secondary ms-1">Private</span>;
      }
    }
    const statusBadge = info.exists === false
      ? <span className="badge bg-secondary ms-1">Deleted</span>
      : contentStatusBadge;
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

    // Determine which user ID to use for violation history
    const historyUserId = report.target_type === 'user'
      ? report.target_string_id
      : info.creator_id || null;
    const historyUserName = report.target_type === 'user'
      ? (info.name || report.target_name)
      : info.creator_name || null;

    const snapshot = info.violation_snapshot;
    const totalViolations = snapshot
      ? (snapshot.account_action_count || 0) + (snapshot.content_action_count || 0)
      : null;

    const ACCT_ACTION_BADGE = {
      warn:        { label: 'Warn',       cls: 'bg-warning text-dark' },
      upload_ban:  { label: 'Upload Ban', cls: 'bg-warning text-dark' },
      full_ban:    { label: 'Full Ban',   cls: 'bg-danger' },
      shadow_ban:  { label: 'Shadow Ban', cls: 'bg-secondary' },
      unban:       { label: 'Unban',      cls: 'bg-success' },
    };

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

        {/* Violation snapshot */}
        {snapshot && totalViolations !== null && (
          <div className="mt-1 pt-1" style={{ borderTop: '1px dashed #dee2e6' }}>
            {totalViolations === 0 ? (
              <span className="text-success" style={{ fontSize: '0.75rem' }}>✓ No prior violations</span>
            ) : (
              <span className="text-danger fw-semibold" style={{ fontSize: '0.75rem' }}>
                ⚠ {totalViolations} prior violation{totalViolations !== 1 ? 's' : ''}
              </span>
            )}
            {snapshot.account_action_count > 0 && (
              <span className="text-muted ms-1" style={{ fontSize: '0.72rem' }}>
                ({snapshot.account_action_count} acct
                {snapshot.content_action_count > 0 ? `, ${snapshot.content_action_count} content` : ''})
              </span>
            )}
            {snapshot.last_action && (
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                Last:{' '}
                <span className={`badge ${(ACCT_ACTION_BADGE[snapshot.last_action] || {}).cls || 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                  {(ACCT_ACTION_BADGE[snapshot.last_action] || {}).label || snapshot.last_action}
                </span>
                {' '}{snapshot.last_action_at ? new Date(snapshot.last_action_at).toLocaleDateString() : ''}
              </div>
            )}
            {historyUserId && (
              <div className="mt-1">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => openViolationHistory(historyUserId, historyUserName)}
                >
                  <i className="bi bi-clock-history me-1" />Full History
                </button>
                <Link
                  className="ms-2"
                  style={{ fontSize: '0.75rem' }}
                  to={`/admin/users`}
                  state={{ highlightUserId: historyUserId }}
                  title="Go to Users panel"
                >
                  Users Panel ↗
                </Link>
              </div>
            )}
          </div>
        )}
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
      <div className="d-flex flex-wrap gap-1">
        <button className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => handleActionWithNotes(report, 'ignore')}>Ignore</button>
        <button className="btn btn-sm btn-outline-success" disabled={disabled} onClick={() => handleActionWithNotes(report, 'keep')}>Keep</button>
        <button className="btn btn-sm btn-outline-warning" disabled={disabled} onClick={() => handleActionWithNotes(report, 'restrict')}>Restrict</button>
        <button className="btn btn-sm btn-outline-danger" disabled={disabled} onClick={() => handleActionWithNotes(report, 'takedown')}>Takedown</button>
        <button className="btn btn-sm btn-outline-dark" disabled={disabled} onClick={() => handleActionWithNotes(report, 'delete')}>Delete</button>
        {report.target_info?.moderation_status && (
          <button className="btn btn-sm btn-outline-info" disabled={disabled} onClick={() => handleActionWithNotes(report, 'unban')}>Unban</button>
        )}
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
            className={`nav-link ${activeTab === 'appeals' ? 'active' : ''}`}
            onClick={() => setActiveTab('appeals')}
          >
            Appeal Queue
            {appeals.length > 0 && (
              <span className="badge bg-warning text-dark ms-2">{appeals.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'contentAppeals' ? 'active' : ''}`}
            onClick={() => setActiveTab('contentAppeals')}
          >
            Content Appeals
            {contentAppeals.length > 0 && (
              <span className="badge bg-warning text-dark ms-2">{contentAppeals.length}</span>
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
                    <button className="btn btn-sm btn-outline-warning" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('restrict', { notes: '' })}>Restrict</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('takedown', { notes: '' })}>Takedown</button>
                    <button className="btn btn-sm btn-outline-dark" disabled={batchActioning || !allContentSelected} onClick={() => applyBatchAction('delete', { notes: '' })}>Delete</button>
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

      {/* ── APPEALS TAB ── */}
      {activeTab === 'appeals' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">Pending appeals: {appeals.length}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={fetchAppeals} disabled={appealsLoading}>
              {appealsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {appealsLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
            </div>
          ) : appeals.length === 0 ? (
            <div className="alert alert-success">No pending appeals.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Ban Type</th>
                      <th>Ban Reason</th>
                      <th>Appeal Reason</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appeals.slice((appealsPage - 1) * pageSize, appealsPage * pageSize).map((appeal) => {
                      const disabled = appealActioningId === appeal.id;
                      const BAN_TYPE_LABELS = { full_ban: 'Full Ban', upload_ban: 'Upload Ban', shadow_ban: 'Shadow Ban' };
                      return (
                        <tr key={appeal.id}>
                          <td>#{appeal.id}</td>
                          <td>
                            <div className="small">
                              <div className="fw-semibold">{appeal.user_name || '—'}</div>
                              <div className="text-muted">{appeal.user_email || ''}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${appeal.ban_type === 'full_ban' ? 'bg-danger' : appeal.ban_type === 'upload_ban' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                              {BAN_TYPE_LABELS[appeal.ban_type] || appeal.ban_type}
                            </span>
                          </td>
                          <td>
                            <div className="small">
                              {appeal.ban_reason || <span className="text-muted">—</span>}
                              {appeal.ban_note && <div className="text-muted">{appeal.ban_note}</div>}
                              {appeal.ban_until && <div className="text-muted">Until: {new Date(appeal.ban_until).toLocaleDateString()}</div>}
                            </div>
                          </td>
                          <td>
                            <div className="small" style={{ maxWidth: 300, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                              {appeal.reason}
                            </div>
                          </td>
                          <td className="small">{formatDate(appeal.created_at)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-outline-success"
                                disabled={disabled}
                                onClick={() => handleOpenAppealDialog(appeal, 'approve')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                disabled={disabled}
                                onClick={() => handleOpenAppealDialog(appeal, 'reject')}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={appealsPage} total={appeals.length} pageSize={pageSize} loading={appealsLoading} onPageChange={setAppealsPage} />
            </>
          )}
        </>
      )}

      {/* ── CONTENT APPEALS TAB ── */}
      {activeTab === 'contentAppeals' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">Pending content appeals: {contentAppeals.length}</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={fetchContentAppeals} disabled={contentAppealsLoading}>
              {contentAppealsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {contentAppealsLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
            </div>
          ) : contentAppeals.length === 0 ? (
            <div className="alert alert-success">No pending content appeals.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Content</th>
                      <th>Creator</th>
                      <th>Status</th>
                      <th>Appeal Reason</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentAppeals.slice((contentAppealsPage - 1) * pageSize, contentAppealsPage * pageSize).map((appeal) => {
                      const disabled = contentAppealActioningId === appeal.id;
                      const ENTITY_TYPE_BADGE = { character: 'bg-primary', scene: 'bg-success', persona: 'bg-info text-dark' };
                      return (
                        <tr key={appeal.id}>
                          <td>#{appeal.id}</td>
                          <td>
                            <span className={`badge ${ENTITY_TYPE_BADGE[appeal.entity_type] || 'bg-secondary'}`}>
                              {appeal.entity_type}
                            </span>
                          </td>
                          <td>
                            <div className="small">
                              <a href={`/${appeal.entity_type}/${appeal.entity_id}`} target="_blank" rel="noopener noreferrer" className="fw-semibold text-decoration-none">
                                {appeal.entity_name || `#${appeal.entity_id}`}
                              </a>
                              {appeal.entity_moderation_status && (
                                <span className={`badge ms-1 ${appeal.entity_moderation_status === 'takedown' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {appeal.entity_moderation_status}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="small">
                              <div className="fw-semibold">{appeal.creator_name || '—'}</div>
                              <div className="text-muted">{appeal.creator_email || ''}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${appeal.status === 'pending' ? 'bg-warning text-dark' : appeal.status === 'approved' ? 'bg-success' : 'bg-danger'}`}>
                              {appeal.status}
                            </span>
                          </td>
                          <td>
                            <div className="small" style={{ maxWidth: 300, maxHeight: 80, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                              {appeal.appeal_reason}
                            </div>
                          </td>
                          <td className="small">{formatDate(appeal.created_at)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-outline-success"
                                disabled={disabled}
                                onClick={() => handleOpenContentAppealDialog(appeal, 'approve')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                disabled={disabled}
                                onClick={() => handleOpenContentAppealDialog(appeal, 'reject')}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={contentAppealsPage} total={contentAppeals.length} pageSize={pageSize} loading={contentAppealsLoading} onPageChange={setContentAppealsPage} />
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

    {/* ── Appeal Action Dialog ── */}
    {appealDialog && (() => {
      const { appeal, action } = appealDialog;
      const isApprove = action === 'approve';
      const BAN_TYPE_LABELS = { full_ban: 'Full Ban', upload_ban: 'Upload Ban', shadow_ban: 'Shadow Ban' };
      return (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isApprove ? '✅ Approve Appeal' : '❌ Reject Appeal'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setAppealDialog(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 small text-muted">
                  <div><strong>{appeal.user_name || '—'}</strong>{appeal.user_email && ` (${appeal.user_email})`}</div>
                  <div>Ban type: {BAN_TYPE_LABELS[appeal.ban_type] || appeal.ban_type}</div>
                </div>
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">User's Appeal Reason</div>
                  <div
                    className="border rounded p-2 small bg-light"
                    style={{ whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}
                  >
                    {appeal.reason}
                  </div>
                </div>
                <div className="mb-1">
                  <label className="form-label fw-semibold">
                    Reply to User
                    <span className="text-muted fw-normal ms-1">(选填，将作为站内信发送)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder={isApprove
                      ? 'e.g. We have reviewed your appeal and determined the ban was applied in error. Your account has been reinstated.'
                      : 'e.g. We have reviewed your appeal but our decision stands because the violation was confirmed.'}
                    value={appealReply}
                    onChange={(e) => setAppealReply(e.target.value)}
                  />
                </div>
                {isApprove && (
                  <div className="alert alert-success small py-2 mt-3 mb-0">
                    The user's ban will be lifted and they will receive your reply as an inbox message.
                  </div>
                )}
                {!isApprove && (
                  <div className="alert alert-warning small py-2 mt-3 mb-0">
                    The ban will remain in effect. The user will receive your reply as an inbox message.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setAppealDialog(null)}>Cancel</button>
                <button
                  className={`btn ${isApprove ? 'btn-success' : 'btn-danger'}`}
                  onClick={handleSubmitAppealDialog}
                >
                  {isApprove ? 'Approve & Unban' : 'Reject Appeal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Content Appeal Action Dialog ── */}
    {contentAppealDialog && (() => {
      const { appeal, action } = contentAppealDialog;
      const isApprove = action === 'approve';
      return (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isApprove ? '✅ Approve Content Appeal' : '❌ Reject Content Appeal'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setContentAppealDialog(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3 small text-muted">
                  <div>
                    <strong>{appeal.creator_name || '—'}</strong>{appeal.creator_email && ` (${appeal.creator_email})`}
                  </div>
                  <div>
                    {appeal.entity_type} —{' '}
                    <a href={`/${appeal.entity_type}/${appeal.entity_id}`} target="_blank" rel="noopener noreferrer">
                      {appeal.entity_name || `#${appeal.entity_id}`}
                    </a>
                    {appeal.entity_moderation_status && (
                      <span className={`badge ms-1 ${appeal.entity_moderation_status === 'takedown' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        {appeal.entity_moderation_status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="fw-semibold small mb-1">Creator's Appeal Reason</div>
                  <div
                    className="border rounded p-2 small bg-light"
                    style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}
                  >
                    {appeal.appeal_reason}
                  </div>
                </div>
                {appeal.snapshot && (
                  <div className="mb-3">
                    <details>
                      <summary className="fw-semibold small mb-1" style={{ cursor: 'pointer' }}>Content Snapshot at Submission</summary>
                      <pre className="border rounded p-2 small bg-light mt-1" style={{ maxHeight: 180, overflow: 'auto' }}>
                        {JSON.stringify(appeal.snapshot, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
                <div className="mb-1">
                  <label className="form-label fw-semibold">
                    Reply to Creator
                    <span className="text-muted fw-normal ms-1">(选填，将作为站内信发送)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder={isApprove
                      ? 'e.g. Your revised content meets our guidelines. The restriction has been lifted.'
                      : 'e.g. The content still violates our guidelines. Please review our rules and try again.'}
                    value={contentAppealReply}
                    onChange={(e) => setContentAppealReply(e.target.value)}
                  />
                </div>
                {isApprove && (
                  <div className="alert alert-success small py-2 mt-3 mb-0">
                    The content restriction will be lifted and the creator will receive your reply.
                  </div>
                )}
                {!isApprove && (
                  <div className="alert alert-warning small py-2 mt-3 mb-0">
                    The restriction stays in effect. The creator will receive your reply as an inbox message.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setContentAppealDialog(null)}>Cancel</button>
                <button
                  className={`btn ${isApprove ? 'btn-success' : 'btn-danger'}`}
                  onClick={handleSubmitContentAppealDialog}
                >
                  {isApprove ? 'Approve & Lift Restriction' : 'Reject Appeal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Violation History Modal ── */}
    {violationModal && (
      <ViolationHistoryModal
        userId={violationModal.userId}
        userName={violationModal.userName}
        data={violationModal.data}
        loading={violationModalLoading}
        tab={violationTab}
        onTabChange={setViolationTab}
        onClose={() => setViolationModal(null)}
      />
    )}
    </>
  );
}

// Violation history modal (shared between moderation queue & history)
export function ViolationHistoryModal({ userId, userName, data, loading, tab, onTabChange, onClose }) {
  const ACCT_BADGE = {
    warn:       { label: 'Warn',       cls: 'bg-warning text-dark' },
    upload_ban: { label: 'Upload Ban', cls: 'bg-warning text-dark' },
    full_ban:   { label: 'Full Ban',   cls: 'bg-danger' },
    shadow_ban: { label: 'Shadow Ban', cls: 'bg-secondary' },
    unban:      { label: 'Unban',      cls: 'bg-success' },
  };
  const CONTENT_BADGE = {
    restrict: { label: 'Restricted', cls: 'bg-warning text-dark' },
    takedown: { label: 'Taken Down', cls: 'bg-danger' },
    delete:   { label: 'Deleted',    cls: 'bg-dark' },
    hide:     { label: 'Hidden',     cls: 'bg-secondary' },
    unban:    { label: 'Restored',   cls: 'bg-success' },
  };
  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-clock-history me-2 text-secondary" />
              Violation History: <strong>{userName || userId}</strong>
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-secondary" role="status" />
                <div className="mt-2 text-muted">Loading…</div>
              </div>
            ) : data ? (
              <>
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button className={`nav-link${tab === 'account' ? ' active' : ''}`} onClick={() => onTabChange('account')}>
                      Account Actions
                      <span className="badge bg-secondary ms-1">{data.account_actions.length}</span>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link${tab === 'content' ? ' active' : ''}`} onClick={() => onTabChange('content')}>
                      Content Bans
                      <span className="badge bg-secondary ms-1">{data.content_actions.length}</span>
                    </button>
                  </li>
                </ul>

                {tab === 'account' && (
                  data.account_actions.length === 0
                    ? <p className="text-muted text-center py-3">No account-level actions recorded.</p>
                    : <div className="list-group">
                        {data.account_actions.map(log => {
                          const b = ACCT_BADGE[log.action] || { label: log.action, cls: 'bg-secondary' };
                          return (
                            <div key={log.id} className="list-group-item flex-column align-items-start py-3">
                              <div className="d-flex justify-content-between align-items-start mb-1">
                                <span>
                                  <span className={`badge ${b.cls}`}>{b.label}</span>
                                  {log.ban_reason && <span className="badge bg-light text-dark border ms-1" style={{ fontSize: '0.75rem' }}>{log.ban_reason}</span>}
                                </span>
                                <small className="text-muted ms-3 text-nowrap">{new Date(log.created_at).toLocaleString()}</small>
                              </div>
                              {log.ban_until && <div style={{ fontSize: '0.83rem', color: '#888' }}>Until: {new Date(log.ban_until).toLocaleDateString()}</div>}
                              {(log.ban_note || log.notes) && <div style={{ fontSize: '0.83rem', color: '#555' }}>{log.ban_note || log.notes}</div>}
                              <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '0.2rem' }}>
                                By <strong>{log.admin_name || '—'}</strong>
                                {log.source === 'report' && log.source_report_id && <> · Report #{log.source_report_id}</>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                )}

                {tab === 'content' && (
                  data.content_actions.length === 0
                    ? <p className="text-muted text-center py-3">No content moderation actions recorded.</p>
                    : <div className="list-group">
                        {data.content_actions.map(log => {
                          const b = CONTENT_BADGE[log.action] || { label: log.action, cls: 'bg-secondary' };
                          return (
                            <div key={log.id} className="list-group-item flex-column align-items-start py-3">
                              <div className="d-flex justify-content-between align-items-start mb-1">
                                <span>
                                  <span className={`badge ${b.cls}`}>{b.label}</span>
                                  <span className="badge bg-light text-dark border ms-1" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>{log.entity_type}</span>
                                  <span className="ms-1" style={{ fontSize: '0.88rem', fontWeight: 500 }}>{log.entity_name || `#${log.entity_id}`}</span>
                                </span>
                                <small className="text-muted ms-3 text-nowrap">{new Date(log.created_at).toLocaleString()}</small>
                              </div>
                              {log.notes && <div style={{ fontSize: '0.83rem', color: '#555' }}>{log.notes}</div>}
                              <div style={{ fontSize: '0.78rem', color: '#999', marginTop: '0.2rem' }}>
                                By <strong>{log.admin_name || '—'}</strong>
                                {log.source === 'report' && log.source_report_id && <> · Report #{log.source_report_id}</>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                )}
              </>
            ) : null}
          </div>
          <div className="modal-footer d-flex justify-content-between">
            <Link to="/admin/users" state={{ highlightUserId: userId }} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-people me-1" />Open in Users Panel
            </Link>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}