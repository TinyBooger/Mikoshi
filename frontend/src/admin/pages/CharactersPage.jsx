import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../components/AuthProvider';
import Table from '../components/Table';
import EditModal from '../components/EditModal';

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const { sessionToken } = useContext(AuthContext);

  const fetchCharacters = () => {
    fetch(`${window.API_BASE_URL}/api/admin/characters`, {
      headers: {
        'Authorization': sessionToken
      }
    })
      .then(res => res.json())
      .then(data => {
        setCharacters(data);
      })
      .catch(err => console.error('Error fetching characters:', err));
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
          tags: characterData.tags
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
    { name: 'persona', label: 'Persona', type: 'textarea', rows: 5, required: true },
    { name: 'greeting', label: 'Greeting', type: 'textarea', rows: 3 },
    { name: 'example_messages', label: 'Example Messages', type: 'textarea', rows: 4 },
    { name: 'tags', label: 'Tags', type: 'tags', helperText: 'Separate tags with commas' }
  ];

  const columns = ['id', 'name', 'tagline', 'creator_name', 'views', 'likes'];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Characters</h2>
      </div>
      <Table 
        columns={columns} 
        data={characters}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
