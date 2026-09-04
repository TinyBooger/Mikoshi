import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import ContentEditModal from '../components/ContentEditModal';
import PaginationBar from '../../components/PaginationBar';
import './ContentManagementPage.css';

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTENT_MODERATION_ACTIONS = [
  { key: 'restrict', label: 'Restrict', cls: 'outline-warning' },
  { key: 'takedown', label: 'Takedown', cls: 'outline-danger' },
  { key: 'unban', label: 'Restore', cls: 'outline-success' },
  { key: 'delete', label: 'Delete', cls: 'outline-dark' },
];

const MODERATION_STATUS_BADGES = {
  restricted: { label: 'Restricted', cls: 'bg-warning text-dark' },
  takedown: { label: 'Takedown', cls: 'bg-danger' },
};

// ─── Moderation Modal (shared) ────────────────────────────────────────────────

function ContentModerationModal({ item, contentType, onClose, onDone, sessionToken }) {
  const [action, setAction] = useState('restrict');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${window.API_BASE_URL}/api/admin/content/${contentType}/${item.id}/moderate`,
        {
          method: 'POST',
          headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, notes: notes || null }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Moderation failed'}`);
        return;
      }
      onDone();
    } catch (e) {
      console.error(e);
      alert('Moderation request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-shield-exclamation me-2 text-warning" />
              Moderate: <strong>{item.name}</strong>
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {item.moderation_status && MODERATION_STATUS_BADGES[item.moderation_status] && (
              <div className="alert alert-warning py-2 mb-3">
                Current status:{' '}
                <strong>{MODERATION_STATUS_BADGES[item.moderation_status].label}</strong>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label fw-semibold">Action</label>
              <div className="d-flex flex-wrap gap-1">
                {CONTENT_MODERATION_ACTIONS.map(({ key, label, cls }) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm btn-${action === key ? cls.replace('outline-', '') : cls}`}
                    onClick={() => setAction(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <small className="text-muted mt-1 d-block">
                {action === 'restrict' && 'Hide content and mark as restricted (notifies creator)'}
                {action === 'takedown' && 'Hide content with takedown notice (notifies creator)'}
                {action === 'unban' && 'Restore content visibility and clear moderation status'}
                {action === 'delete' && 'Permanently delete this content (notifies creator)'}
              </small>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">Moderator Note</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Optional note / reason sent to creator"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className={`btn ${action === 'delete' ? 'btn-danger' : 'btn-primary'}`}
              disabled={loading}
              onClick={apply}
            >
              {loading ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status helpers / filters ────────────────────────────────────────────────

const CONTENT_STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'takedown', label: 'Takedown' },
];

function ContentStatusBadges({ item }) {
  return (
    <div className="d-flex gap-1 flex-wrap" style={{ fontSize: '0.82rem' }}>
      {item.is_public
        ? <span className="badge bg-success">Public</span>
        : <span className="badge bg-secondary">Private</span>}
      {item.moderation_status && MODERATION_STATUS_BADGES[item.moderation_status] && (
        <span className={`badge ${MODERATION_STATUS_BADGES[item.moderation_status].cls}`}>
          {MODERATION_STATUS_BADGES[item.moderation_status].label}
        </span>
      )}
      {item.appeal_under_review && (
        <span className="badge bg-info text-dark">Appeal</span>
      )}
    </div>
  );
}

function matchesStatusFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'public') return !!item.is_public;
  if (filter === 'private') return !item.is_public;
  return item.moderation_status === filter;
}

// ─── Generic content panel (characters / scenes / personas) ──────────────────

const CONTENT_TABLE_COLUMNS = ['ID', 'Name', 'Creator', 'Status', 'Views', 'Likes'];

function ContentTypePanel({ config }) {
  const { sessionToken } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [modTarget, setModTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const pageSize = 20;

  const fetchItems = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/${config.endpoint}`, {
      headers: { Authorization: sessionToken },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) { setLoading(false); return; }
        setItems(data);
        setTotal(data.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [sessionToken]);

  // Patch a single row in place after the edit modal saves (avoids a full reload).
  const handleItemUpdated = (updated) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete ${config.itemType} "${item.name}"?`)) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/${config.endpoint}/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: sessionToken },
      });
      if (res.ok) { fetchItems(); }
      else { const e = await res.json(); alert(e.detail || 'Delete failed'); }
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }
  };

  const filtered = items.filter((i) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.creator_name && i.creator_name.toLowerCase().includes(q));
    return matchesSearch && matchesStatusFilter(i, statusFilter);
  });
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const displayRows = paged.map((i) => ({
    ID: i.id,
    Name: i.name,
    Creator: i.creator_name || '—',
    Status: <ContentStatusBadges item={i} />,
    Views: i.views ?? 0,
    Likes: i.likes ?? 0,
  }));

  return (
    <div>
      {/* Toolbar: search + status filter + total + refresh */}
      <div className="content-filters mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-lg-5 col-md-6">
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder={`Search ${config.label.toLowerCase()} by name or creator...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ borderRadius: '0.5rem' }}
            />
          </div>
          <div className="col-lg-3 col-md-4">
            <select
              className="form-select form-select-lg"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ borderRadius: '0.5rem' }}
            >
              {CONTENT_STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 col-md-2">
            <div className="d-flex align-items-center justify-content-md-end gap-3 flex-wrap">
              <div className="content-stat-card">
                <div className="content-stat-label">Total {config.label}</div>
                <div className="content-stat-value">{total}</div>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={fetchItems}
                disabled={loading}
                title="Refresh list"
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading
                  ? <span className="spinner-border spinner-border-sm me-2" />
                  : <i className="bi bi-arrow-clockwise me-2" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
        <small style={{ color: '#999', marginTop: '0.5rem', display: 'block' }}>
          Found {filtered.length} {filtered.length === 1 ? config.label.toLowerCase().slice(0, -1) : config.label.toLowerCase()}
        </small>
      </div>

      {/* Table */}
      <div className="content-table-section mb-4">
        <div className="table-responsive">
          <Table
            columns={CONTENT_TABLE_COLUMNS}
            data={displayRows}
            onEdit={(row) => setEditingItem(paged.find((i) => i.id === row.ID))}
            onDelete={(row) => handleDelete(paged.find((i) => i.id === row.ID))}
            customActions={[{
              icon: 'bi-shield-exclamation',
              text: 'Moderate',
              className: 'btn-outline-warning',
              onClick: (row) => setModTarget(paged.find((i) => i.id === row.ID)),
            }]}
          />
        </div>
      </div>

      <PaginationBar page={page} total={filtered.length} pageSize={pageSize} loading={loading} onPageChange={setPage} />

      {editingItem && (
        <ContentEditModal
          contentType={config.itemType}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onContentUpdated={handleItemUpdated}
        />
      )}
      {modTarget && (
        <ContentModerationModal
          item={modTarget}
          contentType={config.itemType}
          sessionToken={sessionToken}
          onClose={() => setModTarget(null)}
          onDone={() => { setModTarget(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'characters', label: 'Characters', icon: 'bi-person-badge', itemType: 'character', endpoint: 'characters' },
  { key: 'scenes', label: 'Scenes', icon: 'bi-map', itemType: 'scene', endpoint: 'scenes' },
  { key: 'personas', label: 'Personas', icon: 'bi-person-bounding-box', itemType: 'persona', endpoint: 'personas' },
];

export default function ContentManagementPage() {
  const [activeTab, setActiveTab] = useState('characters');
  const activeConfig = TABS.find((t) => t.key === activeTab);

  return (
    <div className="content-page-container">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2>
          <i className="bi bi-collection me-2" />
          Content Management
        </h2>
        <small className="text-muted">Manage characters, scenes, and personas</small>
      </div>

      <ul className="nav content-tabs mb-4">
        {TABS.map(({ key, label, icon }) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link${activeTab === key ? ' active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <i className={`bi ${icon} me-1`} />
              {label}
            </button>
          </li>
        ))}
      </ul>

      <ContentTypePanel key={activeConfig.key} config={activeConfig} />
    </div>
  );
}
