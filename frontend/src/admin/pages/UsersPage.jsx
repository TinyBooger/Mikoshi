import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../components/AuthProvider";
import Table from "../components/Table";
import EditModal from "../components/EditModal";
import PaginationBar from "../../components/PaginationBar";

const AVAILABLE_BADGES = {
  pioneer: { name: "Pioneer", description: "Early adopter of Mikoshi" },
  bronze_creator: { name: "Bronze Creator", description: "Reached 1,000 views" },
  silver_creator: { name: "Silver Creator", description: "Reached 10,000 views" },
  gold_creator: { name: "Gold Creator", description: "Reached 100,000 views" }
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [managingBadges, setManagingBadges] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;
  const { sessionToken } = useContext(AuthContext);

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
    setEditingUser(user);
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
          bio: userData.bio,
          is_admin: userData.is_admin
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
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'bio', label: 'Bio', type: 'textarea', rows: 3 },
    { name: 'is_admin', label: 'Admin Status', type: 'checkbox', helperText: 'Grant admin privileges' }
  ];

  const handleManageBadges = (user) => {
    setManagingBadges(user);
  };

  const handleAwardBadge = async (badgeKey) => {
    if (!managingBadges) return;

    try {
      const formData = new FormData();
      formData.append('badge_key', badgeKey);

      const response = await fetch(`${window.API_BASE_URL}/api/admin/badges/${managingBadges.id}/award`, {
        method: 'POST',
        headers: {
          'Authorization': sessionToken
        },
        body: formData
      });

      if (response.ok) {
        alert(`Badge awarded successfully`);
        fetchUsers();
        // Update the managingBadges state with the new badge
        setManagingBadges(prev => ({
          ...prev,
          badges: { ...(prev.badges || {}), [badgeKey]: AVAILABLE_BADGES[badgeKey] }
        }));
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to award badge'}`);
      }
    } catch (err) {
      console.error('Error awarding badge:', err);
      alert('Failed to award badge');
    }
  };

  const handleRemoveBadge = async (badgeKey) => {
    if (!managingBadges) return;

    if (!confirm(`Remove badge "${AVAILABLE_BADGES[badgeKey]?.name}" from ${managingBadges.name}?`)) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('badge_key', badgeKey);

      const response = await fetch(`${window.API_BASE_URL}/api/admin/badges/${managingBadges.id}/remove`, {
        method: 'POST',
        headers: {
          'Authorization': sessionToken
        },
        body: formData
      });

      if (response.ok) {
        // If the removed badge was the active badge, clear it
        if (managingBadges.active_badge === badgeKey) {
          await handleSetActiveBadge(null);
        }
        
        alert(`Badge removed successfully`);
        fetchUsers();
        // Update the managingBadges state
        setManagingBadges(prev => {
          const newBadges = { ...(prev.badges || {}) };
          delete newBadges[badgeKey];
          return { 
            ...prev, 
            badges: newBadges,
            active_badge: prev.active_badge === badgeKey ? null : prev.active_badge
          };
        });
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to remove badge'}`);
      }
    } catch (err) {
      console.error('Error removing badge:', err);
      alert('Failed to remove badge');
    }
  };

  const handleSetActiveBadge = async (badgeKey) => {
    if (!managingBadges) return;

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/users/${managingBadges.id}/active-badge`, {
        method: 'PUT',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ badge_key: badgeKey })
      });

      if (response.ok) {
        alert(`Active badge set successfully`);
        fetchUsers();
        setManagingBadges(prev => ({ ...prev, active_badge: badgeKey }));
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to set active badge'}`);
      }
    } catch (err) {
      console.error('Error setting active badge:', err);
      alert('Failed to set active badge');
    }
  };

  // Paginate users
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedUsers = users.slice(startIdx, endIdx);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Users</h2>
        <span className="text-muted">Total: {total} users</span>
      </div>
      
      <div className="table-responsive">
        <Table 
          columns={["id", "email", "name", "is_admin", "status"]} 
          data={paginatedUsers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          customActions={[
            {
              label: "Badges",
              icon: "bi-award",
              onClick: handleManageBadges
            }
          ]}
        />
      </div>

      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />

      {editingUser && (
        <EditModal
          title="Edit User"
          fields={userFields}
          initialData={editingUser}
          onSave={handleSave}
          onClose={() => setEditingUser(null)}
        />
      )}

      {managingBadges && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setManagingBadges(null)}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 className="mb-3">Manage Badges - {managingBadges.name}</h4>
            
            <div className="mb-4">
              <h6 className="text-muted mb-2">Current Badges</h6>
              {managingBadges.badges && Object.keys(managingBadges.badges).length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {Object.entries(managingBadges.badges).map(([key, badge]) => (
                    <div 
                      key={key}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '0.35rem',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
                        <div>
                          <strong>{badge.name}</strong>
                          {managingBadges.active_badge === key && (
                            <span 
                              style={{
                                marginLeft: '0.5rem',
                                padding: '0.15rem 0.5rem',
                                background: '#4CAF50',
                                color: '#fff',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                fontWeight: 600
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                          {badge.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {managingBadges.active_badge !== key && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleSetActiveBadge(key)}
                            title="Set as active display badge"
                          >
                            Set Active
                          </button>
                        )}
                        {managingBadges.active_badge === key && (
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleSetActiveBadge(null)}
                            title="Clear active badge"
                          >
                            Clear Active
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveBadge(key)}
                          title="Remove badge from user"
                        >
                          <i className="bi bi-trash"></i> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>No badges yet</p>
              )}
            </div>

            <div className="mb-3">
              <h6 className="text-muted mb-2">Award New Badge</h6>
              <div className="d-flex flex-column gap-2">
                {Object.entries(AVAILABLE_BADGES).map(([key, badge]) => (
                  <div 
                    key={key}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '0.35rem',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: managingBadges.badges?.[key] ? 0.5 : 1
                    }}
                  >
                    <div>
                      <strong>{badge.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        {badge.description}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAwardBadge(key)}
                      disabled={!!managingBadges.badges?.[key]}
                    >
                      <i className="bi bi-plus-circle"></i> Award
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <button
                className="btn btn-secondary"
                onClick={() => setManagingBadges(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
