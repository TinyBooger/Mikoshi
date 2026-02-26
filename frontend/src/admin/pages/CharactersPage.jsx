import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import EditModal from '../components/EditModal';
import PaginationBar from '../../components/PaginationBar';

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;
  const { sessionToken } = useContext(AuthContext);

  const fetchCharacters = () => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/admin/characters`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setCharacters(data);
        setTotal(data.length);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching characters:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCharacters();
  }, [sessionToken]);

  const handleEdit = (character) => {
    setEditingCharacter(character);
  };

  const handleDelete = async (character) => {
    if (!confirm(`Are you sure you want to delete character "${character.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/characters/${character.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken
        }
      });

      if (response.ok) {
        alert('Character deleted successfully');
        fetchCharacters();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to delete character'}`);
      }
    } catch (err) {
      console.error('Error deleting character:', err);
      alert('Failed to delete character');
    }
  };

  const handleSave = async (characterData) => {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/characters/${editingCharacter.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: characterData.name,
          tagline: characterData.tagline,
          persona: characterData.persona,
          greeting: characterData.greeting,
          example_messages: characterData.example_messages,
          tags: characterData.tags,
          is_public: characterData.is_public,
          is_forkable: characterData.is_forkable,
          is_free: characterData.is_free,
          price: Number(characterData.price || 0)
        })
      });

      if (response.ok) {
        alert('Character updated successfully');
        setEditingCharacter(null);
        fetchCharacters();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || 'Failed to update character'}`);
      }
    } catch (err) {
      console.error('Error updating character:', err);
      alert('Failed to update character');
    }
  };

  const characterFields = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'tagline', label: 'Tagline', type: 'text' },
    { name: 'is_public', label: 'Public', type: 'checkbox', helperText: 'Visible to all users' },
    { name: 'is_forkable', label: 'Open-source (Forkable)', type: 'checkbox', helperText: 'Allow users to fork this character' },
    { name: 'is_free', label: 'Free Character', type: 'checkbox', helperText: 'Disable for paid character' },
    { name: 'price', label: 'Price (CNY)', type: 'number', min: 0, helperText: 'Used when Free Character is unchecked' },
    { name: 'persona', label: 'Persona', type: 'textarea', rows: 5, required: true },
    { name: 'greeting', label: 'Greeting', type: 'textarea', rows: 3 },
    { name: 'example_messages', label: 'Example Messages', type: 'textarea', rows: 4 },
    { name: 'tags', label: 'Tags', type: 'tags', helperText: 'Separate tags with commas' }
  ];

  const columns = ['id', 'name', 'is_free', 'price', 'is_forkable', 'is_public', 'creator_name', 'views', 'likes'];

  // Paginate characters
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedCharacters = characters.slice(startIdx, endIdx);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Characters</h2>
        <span className="text-muted">Total: {total} characters</span>
      </div>
      
      <div className="table-responsive">
        <Table 
          columns={columns} 
          data={paginatedCharacters}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />

      {editingCharacter && (
        <EditModal
          title="Edit Character"
          fields={characterFields}
          initialData={editingCharacter}
          onSave={handleSave}
          onClose={() => setEditingCharacter(null)}
        />
      )}
    </div>
  );
}
