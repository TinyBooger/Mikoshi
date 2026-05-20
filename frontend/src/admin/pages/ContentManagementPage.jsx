import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import EditModal from '../components/EditModal';
import PaginationBar from '../../components/PaginationBar';

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

// ─── Characters Sub-tab ───────────────────────────────────────────────────────

function CharactersTab() {
  const { sessionToken } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modTarget, setModTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const fetchItems = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/characters`, {
      headers: { Authorization: sessionToken },
    })
      .then((r) => r.json())
      .then((data) => { setItems(data); setTotal(data.length); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [sessionToken]);

  const handleDelete = async (item) => {
    if (!confirm(`Delete character "${item.name}"?`)) return;
    const res = await fetch(`${window.API_BASE_URL}/api/admin/characters/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: sessionToken },
    });
    if (res.ok) { fetchItems(); } else { const e = await res.json(); alert(e.detail || 'Delete failed'); }
  };

  const handleSave = async (data) => {
    const res = await fetch(`${window.API_BASE_URL}/api/admin/characters/${editing.id}`, {
      method: 'PATCH',
      headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name, tagline: data.tagline, persona: data.persona,
        greeting: data.greeting, example_messages: data.example_messages,
        tags: data.tags, is_public: data.is_public, is_forkable: data.is_forkable,
      }),
    });
    if (res.ok) { setEditing(null); fetchItems(); }
    else { const e = await res.json(); alert(e.detail || 'Update failed'); }
  };

  const fields = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'tagline', label: 'Tagline', type: 'text' },
    { name: 'is_public', label: 'Public', type: 'checkbox' },
    { name: 'is_forkable', label: 'Forkable', type: 'checkbox' },
    { name: 'persona', label: 'Persona', type: 'textarea', rows: 5, required: true },
    { name: 'greeting', label: 'Greeting', type: 'textarea', rows: 3 },
    { name: 'example_messages', label: 'Example Messages', type: 'textarea', rows: 4 },
    { name: 'tags', label: 'Tags', type: 'tags' },
  ];

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.creator_name && i.creator_name.toLowerCase().includes(search.toLowerCase()))
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const displayRows = paged.map((i) => ({
    ...i,
    'Status': (
      <div className="d-flex gap-1 flex-wrap" style={{ fontSize: '0.82rem' }}>
        {i.is_public ? <span className="badge bg-success">Public</span> : <span className="badge bg-secondary">Private</span>}
        {i.moderation_status && MODERATION_STATUS_BADGES[i.moderation_status] && (
          <span className={`badge ${MODERATION_STATUS_BADGES[i.moderation_status].cls}`}>
            {MODERATION_STATUS_BADGES[i.moderation_status].label}
          </span>
        )}
      </div>
    ),
  }));

  return (
    <div>
      <div className="d-flex gap-3 mb-3 align-items-center">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name or creator..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 360 }}
        />
        <small className="text-muted">{filtered.length} characters</small>
      </div>

      <div className="table-responsive">
        <Table
          columns={['id', 'name', 'creator_name', 'Status', 'views', 'likes']}
          data={displayRows}
          onEdit={(row) => setEditing(paged.find((i) => i.id === row.id))}
          onDelete={(row) => handleDelete(paged.find((i) => i.id === row.id))}
          customActions={[{
            icon: 'bi-shield-exclamation',
            text: 'Moderate',
            className: 'btn-outline-warning',
            onClick: (row) => setModTarget(paged.find((i) => i.id === row.id)),
          }]}
        />
      </div>

      <PaginationBar page={page} total={filtered.length} pageSize={pageSize} loading={loading} onPageChange={setPage} />

      {editing && (
        <EditModal title={`Edit Character: ${editing.name}`} fields={fields} initialData={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {modTarget && (
        <ContentModerationModal
          item={modTarget}
          contentType="character"
          sessionToken={sessionToken}
          onClose={() => setModTarget(null)}
          onDone={() => { setModTarget(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

// ─── Scenes Sub-tab ───────────────────────────────────────────────────────────

function ScenesTab() {
  const { sessionToken } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modTarget, setModTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const fetchItems = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/scenes`, {
      headers: { Authorization: sessionToken },
    })
      .then((r) => r.json())
      .then((data) => { setItems(data); setTotal(data.length); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [sessionToken]);

  const handleDelete = async (item) => {
    if (!confirm(`Delete scene "${item.name}"?`)) return;
    const res = await fetch(`${window.API_BASE_URL}/api/admin/scenes/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: sessionToken },
    });
    if (res.ok) { fetchItems(); } else { const e = await res.json(); alert(e.detail || 'Delete failed'); }
  };

  const handleSave = async (data) => {
    const res = await fetch(`${window.API_BASE_URL}/api/admin/scenes/${editing.id}`, {
      method: 'PATCH',
      headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name, description: data.description, intro: data.intro,
        greeting: data.greeting, tags: data.tags, is_public: data.is_public, is_forkable: data.is_forkable,
      }),
    });
    if (res.ok) { setEditing(null); fetchItems(); }
    else { const e = await res.json(); alert(e.detail || 'Update failed'); }
  };

  const fields = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'intro', label: 'Intro', type: 'text' },
    { name: 'is_public', label: 'Public', type: 'checkbox' },
    { name: 'is_forkable', label: 'Forkable', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 5, required: true },
    { name: 'greeting', label: 'Greeting', type: 'textarea', rows: 3 },
    { name: 'tags', label: 'Tags', type: 'tags' },
  ];

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.creator_name && i.creator_name.toLowerCase().includes(search.toLowerCase()))
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const displayRows = paged.map((i) => ({
    ...i,
    'Status': (
      <div className="d-flex gap-1 flex-wrap" style={{ fontSize: '0.82rem' }}>
        {i.is_public ? <span className="badge bg-success">Public</span> : <span className="badge bg-secondary">Private</span>}
        {i.moderation_status && MODERATION_STATUS_BADGES[i.moderation_status] && (
          <span className={`badge ${MODERATION_STATUS_BADGES[i.moderation_status].cls}`}>
            {MODERATION_STATUS_BADGES[i.moderation_status].label}
          </span>
        )}
      </div>
    ),
  }));

  return (
    <div>
      <div className="d-flex gap-3 mb-3 align-items-center">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name or creator..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 360 }}
        />
        <small className="text-muted">{filtered.length} scenes</small>
      </div>

      <div className="table-responsive">
        <Table
          columns={['id', 'name', 'creator_name', 'Status', 'views', 'likes']}
          data={displayRows}
          onEdit={(row) => setEditing(paged.find((i) => i.id === row.id))}
          onDelete={(row) => handleDelete(paged.find((i) => i.id === row.id))}
          customActions={[{
            icon: 'bi-shield-exclamation',
            text: 'Moderate',
            className: 'btn-outline-warning',
            onClick: (row) => setModTarget(paged.find((i) => i.id === row.id)),
          }]}
        />
      </div>

      <PaginationBar page={page} total={filtered.length} pageSize={pageSize} loading={loading} onPageChange={setPage} />

      {editing && (
        <EditModal title={`Edit Scene: ${editing.name}`} fields={fields} initialData={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {modTarget && (
        <ContentModerationModal
          item={modTarget}
          contentType="scene"
          sessionToken={sessionToken}
          onClose={() => setModTarget(null)}
          onDone={() => { setModTarget(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

// ─── Personas Sub-tab ─────────────────────────────────────────────────────────

function PersonasTab() {
  const { sessionToken } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modTarget, setModTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const fetchItems = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/personas`, {
      headers: { Authorization: sessionToken },
    })
      .then((r) => r.json())
      .then((data) => { setItems(data); setTotal(data.length); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [sessionToken]);

  const handleDelete = async (item) => {
    if (!confirm(`Delete persona "${item.name}"?`)) return;
    const res = await fetch(`${window.API_BASE_URL}/api/admin/personas/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: sessionToken },
    });
    if (res.ok) { fetchItems(); } else { const e = await res.json(); alert(e.detail || 'Delete failed'); }
  };

  const handleSave = async (data) => {
    const res = await fetch(`${window.API_BASE_URL}/api/admin/personas/${editing.id}`, {
      method: 'PATCH',
      headers: { Authorization: sessionToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name, description: data.description, intro: data.intro,
        tags: data.tags, is_public: data.is_public, is_forkable: data.is_forkable,
      }),
    });
    if (res.ok) { setEditing(null); fetchItems(); }
    else { const e = await res.json(); alert(e.detail || 'Update failed'); }
  };

  const fields = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'intro', label: 'Intro', type: 'text' },
    { name: 'is_public', label: 'Public', type: 'checkbox' },
    { name: 'is_forkable', label: 'Forkable', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea', rows: 5 },
    { name: 'tags', label: 'Tags', type: 'tags' },
  ];

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.creator_name && i.creator_name.toLowerCase().includes(search.toLowerCase()))
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const displayRows = paged.map((i) => ({
    ...i,
    'Status': (
      <div className="d-flex gap-1 flex-wrap" style={{ fontSize: '0.82rem' }}>
        {i.is_public ? <span className="badge bg-success">Public</span> : <span className="badge bg-secondary">Private</span>}
        {i.moderation_status && MODERATION_STATUS_BADGES[i.moderation_status] && (
          <span className={`badge ${MODERATION_STATUS_BADGES[i.moderation_status].cls}`}>
            {MODERATION_STATUS_BADGES[i.moderation_status].label}
          </span>
        )}
      </div>
    ),
  }));

  return (
    <div>
      <div className="d-flex gap-3 mb-3 align-items-center">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name or creator..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 360 }}
        />
        <small className="text-muted">{filtered.length} personas</small>
      </div>

      <div className="table-responsive">
        <Table
          columns={['id', 'name', 'creator_name', 'Status', 'views', 'likes']}
          data={displayRows}
          onEdit={(row) => setEditing(paged.find((i) => i.id === row.id))}
          onDelete={(row) => handleDelete(paged.find((i) => i.id === row.id))}
          customActions={[{
            icon: 'bi-shield-exclamation',
            text: 'Moderate',
            className: 'btn-outline-warning',
            onClick: (row) => setModTarget(paged.find((i) => i.id === row.id)),
          }]}
        />
      </div>

      <PaginationBar page={page} total={filtered.length} pageSize={pageSize} loading={loading} onPageChange={setPage} />

      {editing && (
        <EditModal title={`Edit Persona: ${editing.name}`} fields={fields} initialData={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
      {modTarget && (
        <ContentModerationModal
          item={modTarget}
          contentType="persona"
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
  { key: 'characters', label: 'Characters', icon: 'bi-person-badge' },
  { key: 'scenes', label: 'Scenes', icon: 'bi-map' },
  { key: 'personas', label: 'Personas', icon: 'bi-person-bounding-box' },
];

export default function ContentManagementPage() {
  const [activeTab, setActiveTab] = useState('characters');

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Content Management</h2>
        <small className="text-muted">Manage characters, scenes, and personas</small>
      </div>

      <ul className="nav nav-tabs mb-4">
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

      {activeTab === 'characters' && <CharactersTab />}
      {activeTab === 'scenes' && <ScenesTab />}
      {activeTab === 'personas' && <PersonasTab />}
    </div>
  );
}
