import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import CharacterCard from '../components/CharacterCard';
import defaultAvatar from '../assets/images/default-avatar.png';
import { AuthContext } from '../components/AuthProvider';
import PersonaModal from '../components/PersonaModal';

export default function ProfilePage() {
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked',
    PERSONAS: 'Personas'
  };

  const { userData, idToken, refreshUserData } = useContext(AuthContext);
  const [createdCharacters, setCreatedCharacters] = useState([]);
  const [likedCharacters, setLikedCharacters] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_TYPES.CREATED);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState(null);
  const navigate = useNavigate();
  // Replace the showPersonaModal state and related functions with:
  const [personaModal, setPersonaModal] = useState({
    show: false,
    currentPersona: null
  });

  // API call functions
  const fetchPersonas = async () => {
    const res = await fetch('/api/personas', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (res.ok) return await res.json();
    throw new Error('Failed to fetch personas');
  };

  const createPersona = async (persona) => {
    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify(persona)
    });
    if (!res.ok) throw new Error('Failed to create persona');
    return await res.json();
  };

  const updatePersona = async (id, persona) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify(persona)
    });
    if (!res.ok) throw new Error('Failed to update persona');
    return await res.json();
  };

  const deletePersona = async (id) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) throw new Error('Failed to delete persona');
    return await res.json();
  };

  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    if (userData) {
      setEditName(userData.name);
    }

    fetch('/api/characters-created', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    fetch('/api/characters-liked', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setLikedCharacters);

    fetchPersonas()
      .then(setPersonas)
      .catch(console.error);
  }, [navigate, idToken, userData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editName.trim());
    if (editPic) formData.append('profile_pic', editPic);

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) {
      setShowModal(false);
      await refreshUserData();
    }
  };

  const handlePersonaSave = async (personaData) => {
    try {
      if (personaModal.currentPersona) {
        const updated = await updatePersona(personaModal.currentPersona.id, personaData);
        setPersonas(personas.map(p => p.id === updated.id ? updated : p));
      } else {
        const newPersona = await createPersona(personaData);
        setPersonas([...personas, newPersona]);
      }
      setPersonaModal({ show: false, currentPersona: null });
    } catch (error) {
      alert(error.message);
    }
  };

  const editPersona = (persona) => {
    setPersonaModal({
      show: true,
      currentPersona: persona
    });
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
          onClick={() => setPersonaModal({ show: true, currentPersona: null })}
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

  if (!userData) return null;

  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-grow-1 p-4">
          <h2 className="mb-4">My Profile</h2>

          <div className="d-flex align-items-center gap-4 mb-4">
            <img
              src={userData.profile_pic || defaultAvatar}
              alt="Profile"
              className="rounded-circle"
              width="100"
              height="100"
            />
            <div>
              <div className="d-flex align-items-baseline gap-2 mb-1">
                <h3 className="mb-0">{userData.name}</h3>
                <span className="text-muted small">•</span>
                <div className="d-flex gap-2">
                  <span className="badge bg-light text-dark">
                    <i className="bi bi-eye me-1"></i>
                    {userData.views || 0} views
                  </span>
                  <span className="badge bg-light text-dark">
                    <i className="bi bi-heart me-1"></i>
                    {userData.likes || 0} likes
                  </span>
                </div>
              </div>
              <button className="btn btn-outline-primary btn-sm mt-1" onClick={() => setShowModal(true)}>
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
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false, currentPersona: null })}
        onSave={handlePersonaSave}
        currentPersona={personaModal.currentPersona}
      />
    </div>
  );
}