import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../components/AuthProvider";
import Table from "../components/Table";
import EditModal from "../components/EditModal";
import PaginationBar from "../../components/PaginationBar";
import "./UsersPage.css";

const BAN_REASON_OPTIONS = [
  { value: 'harassment', label: 'Harassment / Bullying' },
  { value: 'spam', label: 'Spam / Flooding' },
  { value: 'abuse', label: 'Platform Abuse' },
  { value: 'underage', label: 'Underage / NSFW' },
  { value: 'other', label: 'Other Violation' },
];

const BAN_TYPE_LABELS = {
  upload_ban: { label: 'Upload Ban', cls: 'bg-warning text-dark' },
  full_ban: { label: 'Full Ban', cls: 'bg-danger' },
  shadow_ban: { label: 'Shadow Ban', cls: 'bg-secondary' },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [modDialog, setModDialog] = useState(null); // { user }
  const [modForm, setModForm] = useState({ action: 'warn', ban_reason: '', ban_note: '', days: '' });
  const [modLoading, setModLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPro, setFilterPro] = useState("all");
  const pageSize = 20;
  const { sessionToken } = useContext(AuthContext);

  const toDateTimeLocalValue = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const toIsoOrNull = (dateValue) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setTotal(data.length);
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching users:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, [sessionToken]);

  const handleEdit = (user) => {
    setEditingUser({
      ...user,
      pro_start_date: toDateTimeLocalValue(user.pro_start_date),
      pro_expire_date: toDateTimeLocalValue(user.pro_expire_date),
    });
  };

  const handleDelete = async (user) => {
    if (!confirm(`Are you sure you want to delete user "${user.name}" (${user.email})?`)) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('User deleted successfully');
        fetchUsers();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete user'}`);
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user');
    }
  };

  const handleSave = async (userData) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: userData.name,
          phone_number: userData.phone_number,
          bio: userData.bio,
          is_admin: userData.is_admin,
          is_pro: userData.is_pro,
          pro_start_date: toIsoOrNull(userData.pro_start_date),
          pro_expire_date: toIsoOrNull(userData.pro_expire_date)
        })
      });

      if (response.ok) {
        alert('User updated successfully');
        setEditingUser(null);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to update user'}`);
      }
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user');
    }
  };

  const applyModerationAction = async () => {
    const { action, ban_reason, ban_note, days } = modForm;
    const user = modDialog?.user;
    if (!user) return;
    const isBanAction = ['upload_ban', 'full_ban', 'shadow_ban'].includes(action);
    let ban_until = null;
    if (isBanAction && days) {
      const d = new Date();
      d.setDate(d.getDate() + Number(days));
      ban_until = d.toISOString();
    }
    setModLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/admin/users/${user.id}/moderate`, {
        method: 'POST',
        headers: { 'Authorization': sessionToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ban_reason: isBanAction ? ban_reason || null : null,
          ban_note: ban_note || null,
          ban_until,
          notes: ban_note || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Moderation failed'}`);
        return;
      }
      setModDialog(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Moderation request failed');
    } finally {
      setModLoading(false);
    }
  };

  const userFields = [
    { name: 'phone_number', label: 'Phone Number', type: 'tel' },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'bio', label: 'Bio', type: 'textarea', rows: 3 },
    { name: 'is_admin', label: 'Admin Status', type: 'checkbox', helperText: 'Grant admin privileges' },
    { name: 'is_pro', label: 'Pro Status', type: 'checkbox', helperText: 'Mark as premium user' },
    { name: 'pro_start_date', label: 'Pro Start Date', type: 'datetime-local', helperText: 'Optional: when Pro membership started' },
    { name: 'pro_expire_date', label: 'Pro Expire Date', type: 'datetime-local', helperText: 'Optional: when Pro membership expires' }
  ];


  // Filter and search users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone_number && user.phone_number.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = 
      filterPro === 'all' || 
      (filterPro === 'pro' && user.is_pro) ||
      (filterPro === 'free' && !user.is_pro);
    
    return matchesSearch && matchesFilter;
  });

  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedUsers = filteredUsers.slice(startIdx, endIdx);

  // Transform user data for display
  const displayUsers = paginatedUsers.map(user => ({
    ...user,
    'Email/Phone': (
      <div style={{ fontSize: '0.9rem' }}>
        <div><strong>{user.email}</strong></div>
        {user.phone_number && <div style={{ color: '#666' }}>{user.phone_number}</div>}
      </div>
    ),
    'Status': (
      <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {user.is_admin && (
          <span className="badge bg-warning text-dark">Admin</span>
        )}
        {user.is_pro && (
          <span className="badge bg-success">Pro</span>
        )}
        {user.ban_type && BAN_TYPE_LABELS[user.ban_type] && (
          <span className={`badge ${BAN_TYPE_LABELS[user.ban_type].cls}`}>
            {BAN_TYPE_LABELS[user.ban_type].label}
          </span>
        )}
      </div>
    ),
    'User ID': (
      <div style={{ textAlign: 'left', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {user.id}
      </div>
    )
  }));

  return (
    <div className="users-page-container">
      <div className="users-header mb-4">
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>👥 User Management</h2>
          <p style={{ marginBottom: 0, color: '#666' }}>
            Manage users and update permissions
          </p>
        </div>
        <div style={{
          background: '#f5f5f5',
          padding: '1rem',
          borderRadius: '0.5rem',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Users</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2196F3' }}>
            {total}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="filters-section mb-4">
        <div className="row g-3">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="🔍 Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ borderRadius: '0.5rem' }}
            />
          </div>
          <div className="col-md-6">
            <select
              className="form-select form-select-lg"
              value={filterPro}
              onChange={(e) => {
                setFilterPro(e.target.value);
                setPage(1);
              }}
              style={{ borderRadius: '0.5rem' }}
            >
              <option value="all">All Users</option>
              <option value="pro">Pro Users Only</option>
              <option value="free">Free Users Only</option>
            </select>
          </div>
        </div>
        <small style={{ color: '#999', marginTop: '0.5rem', display: 'block' }}>
          Found {filteredUsers.length} users
        </small>
      </div>

      {/* Table */}
      <div className="table-section mb-4">
        <div style={{
          background: '#fff',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div className="table-responsive">
            <Table 
              columns={["id", "name", "Email/Phone", "Status", "User ID"]} 
              data={displayUsers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              customActions={[
                {
                  icon: 'bi-shield-exclamation',
                  text: 'Moderate',
                  className: 'btn-outline-warning',
                  onClick: (row) => {
                    const user = paginatedUsers.find(u => u.id === row.id);
                    setModForm({ action: 'warn', ban_reason: '', ban_note: '', days: '' });
                    setModDialog({ user });
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>

      <PaginationBar
        page={page}
        total={filteredUsers.length}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />

      {editingUser && (
        <EditModal
          title={`Edit User: ${editingUser.name}`}
          fields={userFields}
          initialData={editingUser}
          onSave={handleSave}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Moderation Modal */}
      {modDialog && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) setModDialog(null); }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-shield-exclamation me-2 text-warning" />
                  Moderate: <strong>{modDialog.user.name}</strong>
                </h5>
                <button type="button" className="btn-close" onClick={() => setModDialog(null)} />
              </div>
              <div className="modal-body">
                {/* Current ban status */}
                {modDialog.user.ban_type && (
                  <div className="alert alert-warning py-2 mb-3">
                    Currently: <strong>{BAN_TYPE_LABELS[modDialog.user.ban_type]?.label || modDialog.user.ban_type}</strong>
                    {modDialog.user.ban_until && <> until {new Date(modDialog.user.ban_until).toLocaleDateString()}</>}
                  </div>
                )}

                {/* Action selector */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Action</label>
                  <div className="d-flex flex-wrap gap-1">
                    {[
                      { key: 'warn', label: 'Warn', cls: 'outline-secondary' },
                      { key: 'upload_ban', label: 'Upload Ban', cls: 'outline-warning' },
                      { key: 'full_ban', label: 'Full Ban', cls: 'outline-danger' },
                      { key: 'shadow_ban', label: 'Shadow Ban', cls: 'outline-dark' },
                      { key: 'unban', label: 'Unban', cls: 'outline-success' },
                    ].map(({ key, label, cls }) => (
                      <button
                        key={key}
                        type="button"
                        className={`btn btn-sm btn-${modForm.action === key ? cls.replace('outline-', '') : cls}`}
                        onClick={() => setModForm(f => ({ ...f, action: key }))}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Ban reason — only for ban actions */}
                {['upload_ban', 'full_ban', 'shadow_ban'].includes(modForm.action) && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Reason</label>
                      <select
                        className="form-select"
                        value={modForm.ban_reason}
                        onChange={e => setModForm(f => ({ ...f, ban_reason: e.target.value }))}
                      >
                        <option value="">— select reason —</option>
                        {BAN_REASON_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Duration (days, blank = permanent)</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        placeholder="Leave blank for permanent ban"
                        value={modForm.days}
                        onChange={e => setModForm(f => ({ ...f, days: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                {/* Moderator note — always visible */}
                {modForm.action !== 'unban' && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Moderator Note</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Optional internal note / message to user"
                      value={modForm.ban_note}
                      onChange={e => setModForm(f => ({ ...f, ban_note: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModDialog(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={modLoading}
                  onClick={applyModerationAction}
                >
                  {modLoading ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
