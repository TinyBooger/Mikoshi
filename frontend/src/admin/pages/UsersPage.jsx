import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../components/AuthProvider";
import Table from "../components/Table";
import EditModal from "../components/EditModal";
import PaginationBar from "../../components/PaginationBar";
import "./UsersPage.css";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
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

  const userFields = [
    { name: 'email', label: 'Email', type: 'email', required: true, readOnly: true },
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
          <span style={{
            background: '#ff9800',
            color: '#fff',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontWeight: 600
          }}>Admin</span>
        )}
        {user.is_pro && (
          <span style={{
            background: '#4CAF50',
            color: '#fff',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontWeight: 600
          }}>Pro</span>
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

    </div>
  );
}
