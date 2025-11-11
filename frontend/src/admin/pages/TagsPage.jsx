import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import EditModal from '../components/EditModal';

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [editingTag, setEditingTag] = useState(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const { sessionToken } = useContext(AuthContext);

  const fetchTags = () => {
    fetch(`${window.API_BASE_URL}/api/admin/tags`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => setTags(data))
      .catch(err => console.error('Error fetching tags:', err));
  };

  useEffect(() => {
    fetchTags();
  }, [sessionToken]);

  const handleEdit = (tag) => {
    setEditingTag(tag);
  };

  const handleDelete = async (tag) => {
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/tags/${tag.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Tag deleted successfully');
        fetchTags();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete tag'}`);
      }
    } catch (err) {
      console.error('Error deleting tag:', err);
      alert('Failed to delete tag');
    }
  };

  const handleSave = async (tagData) => {
    try {
      const url = creatingTag 
        ? `${window.API_BASE_URL}/api/admin/tags`
        : `${window.API_BASE_URL}/api/admin/tags/${editingTag.id}`;
      
      const method = creatingTag ? 'POST' : 'PATCH';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tagData.name
        })
      });

      if (response.ok) {
        alert(creatingTag ? 'Tag created successfully' : 'Tag updated successfully');
        setEditingTag(null);
        setCreatingTag(false);
        fetchTags();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to save tag'}`);
      }
    } catch (err) {
      console.error('Error saving tag:', err);
      alert('Failed to save tag');
    }
  };

  const tagFields = [
    { name: 'name', label: 'Tag Name', type: 'text', required: true }
  ];

  const columns = ['id', 'name', 'count', 'likes'];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Tags</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setCreatingTag(true);
            setEditingTag({ name: '' });
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Create Tag
        </button>
      </div>
      <Table 
        columns={columns} 
        data={tags}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {editingTag && (
        <EditModal
          title={creatingTag ? "Create Tag" : "Edit Tag"}
          fields={tagFields}
          initialData={editingTag}
          onSave={handleSave}
          onClose={() => {
            setEditingTag(null);
            setCreatingTag(false);
          }}
        />
      )}
    </div>
  );
}
