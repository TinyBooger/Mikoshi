import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import CharacterCard from '../components/CharacterCard';
import defaultAvatar from '../assets/images/default-avatar.png';

export default function ProfilePage() {
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked',
    PERSONAS: 'Personas'
  };

  const [user, setUser] = useState(null);
  const [createdCharacters, setCreatedCharacters] = useState([]);
  const [likedCharacters, setLikedCharacters] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_TYPES.CREATED);
  const [showModal, setShowModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState(null);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [personaName, setPersonaName] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const navigate = useNavigate();

  // API call functions
  const fetchPersonas = async () => {
    const res = await fetch('/api/personas');
    if (res.ok) return await res.json();
    throw new Error('Failed to fetch personas');
  };

  const createPersona = async (persona) => {
    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(persona),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to create persona');
    return await res.json();
  };

  const updatePersona = async (id, persona) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(persona),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update persona');
    return await res.json();
  };

  const deletePersona = async (id) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete persona');
    return await res.json();
  };

  useEffect(() => {
    fetch('/api/current-user')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        setEditName(data.name);
      })
      .catch(() => navigate('/'));

    fetch('/api/characters-created')
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    fetch('/api/characters-liked')
      .then(res => res.ok ? res.json() : [])
      .then(setLikedCharacters);

    fetchPersonas()
      .then(setPersonas)
      .catch(console.error);
  }, [navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editName.trim());
    if (editPic) formData.append('profile_pic', editPic);

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) {
      setShowModal(false);
      window.location.reload();
    }
  };

  const handlePersonaSave = async (e) => {
    e.preventDefault();
    try {
      const personaData = {
        name: personaName,
        description: personaDescription
      };

      if (currentPersona) {
        const updated = await updatePersona(currentPersona.id, personaData);
        setPersonas(personas.map(p => p.id === updated.id ? updated : p));
      } else {
        const newPersona = await createPersona(personaData);
        setPersonas([...personas, newPersona]);
      }
      setShowPersonaModal(false);
      resetPersonaForm();
    } catch (error) {
      alert(error.message);
    }
  };

  const editPersona = (persona) => {
    setCurrentPersona(persona);
    setPersonaName(persona.name);
    setPersonaDescription(persona.description);
    setShowPersonaModal(true);
  };

  const handleDeletePersona = async (id) => {
    if (window.confirm('Are you sure you want to delete this persona?')) {
      try {
        await deletePersona(id);
        setPersonas(personas.filter(p => p.id !== id));
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const resetPersonaForm = () => {
    setCurrentPersona(null);
    setPersonaName('');
    setPersonaDescription('');
  };

  const renderCharacters = () => {
    const characters = activeTab === TAB_TYPES.CREATED ? createdCharacters : likedCharacters;
    
    return (
      <div className="d-flex flex-wrap gap-3 mt-3">
        {characters.map(c => (
          <div key={c.id} style={{ width: 150 }}>
            <CharacterCard character={c} />
            {activeTab === TAB_TYPES.CREATED && (
              <button
                className="btn btn-sm btn-outline-secondary w-100 mt-1"
                onClick={() => navigate(`/character-edit?id=${c.id}`)}
              >
                <i className="bi bi-pencil-square"></i> Edit
              </button>
            )}
          </div>
        ))}
        {characters.length === 0 && (
          <p className="text-muted">
            {activeTab === TAB_TYPES.CREATED 
              ? "You haven't created any characters yet." 
              : "You haven't liked any characters yet."}
          </p>
        )}
      </div>
    );
  };

  const renderPersonas = () => {
    return (
      <div className="mt-3">
        <button 
          className="btn btn-primary mb-3"
          onClick={() => {
            resetPersonaForm();
            setShowPersonaModal(true);
          }}
        >
          <i className="bi bi-plus"></i> Create New Persona
        </button>

        {personas.length === 0 ? (
          <div className="alert alert-info">
            No personas created yet. Click "Create New Persona" to add one.
          </div>
        ) : (
          <div className="list-group">
            {personas.map(persona => (
              <div key={persona.id} className="list-group-item">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5>{persona.name}</h5>
                    <p className="mb-0 text-muted">{persona.description}</p>
                  </div>
                  <div>
                    <button 
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => editPersona(persona)}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeletePersona(persona.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case TAB_TYPES.CREATED:
      case TAB_TYPES.LIKED:
        return (
          <>
            <h4>{activeTab} Characters</h4>
            {renderCharacters()}
          </>
        );
      case TAB_TYPES.PERSONAS:
        return (
          <>
            <h4>My Personas</h4>
            {renderPersonas()}
          </>
        );
      default:
        return null;
    }
  };

  if (!user) return null;

  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-grow-1 p-4">
          <h2 className="mb-4">My Profile</h2>

          <div className="d-flex align-items-center gap-4 mb-4">
            <img
              src={user.profile_pic || defaultAvatar}
              alt="Profile"
              className="rounded-circle"
              width="100"
              height="100"
            />
            <div>
              <h3 className="mb-2">{user.name}</h3>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setShowModal(true)}>
                Edit Profile
              </button>
            </div>
          </div>

          <div className="mb-3">
            <ul className="nav nav-tabs">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === TAB_TYPES.CREATED ? 'active' : ''}`}
                  onClick={() => setActiveTab(TAB_TYPES.CREATED)}
                >
                  Created
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === TAB_TYPES.LIKED ? 'active' : ''}`}
                  onClick={() => setActiveTab(TAB_TYPES.LIKED)}
                >
                  Liked
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === TAB_TYPES.PERSONAS ? 'active' : ''}`}
                  onClick={() => setActiveTab(TAB_TYPES.PERSONAS)}
                >
                  Personas
                </button>
              </li>
            </ul>
          </div>

          {renderContent()}
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showModal && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleSave}>
              <div className="modal-header">
                <h5 className="modal-title">Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ paddingRight: "3rem" }}
                  />
                  <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                    {editName.length}/{MAX_NAME_LENGTH}
                  </small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={e => setEditPic(e.target.files[0])}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persona Edit/Create Modal */}
      {showPersonaModal && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handlePersonaSave}>
              <div className="modal-header">
                <h5 className="modal-title">
                  {currentPersona ? 'Edit Persona' : 'Create New Persona'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPersonaModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={personaName}
                    onChange={e => setPersonaName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Persona Description</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    value={personaDescription}
                    onChange={e => setPersonaDescription(e.target.value)}
                    required
                  />
                  <small className="text-muted">
                    This will be appended to the system message when chatting with characters.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {currentPersona ? 'Save Changes' : 'Create Persona'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPersonaModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}