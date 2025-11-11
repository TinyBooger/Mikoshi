import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../components/AuthProvider";
import Table from "../components/Table";
import EditModal from "../components/EditModal";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const { sessionToken } = useContext(AuthContext);

  const fetchUsers = () => {
    fetch(`${window.API_BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(setUsers)
      .catch(err => console.error('Error fetching users:', err));
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Users</h2>
      </div>
      <Table 
        columns={["id", "email", "name", "is_admin", "status"]} 
        data={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
    </div>
  );
}
