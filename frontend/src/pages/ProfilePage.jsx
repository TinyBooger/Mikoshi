import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router'; // useParams instead of useLocation
import CharacterCard from '../components/CharacterCard';
import defaultAvatar from '../assets/images/default-avatar.png';
import { AuthContext } from '../components/AuthProvider';
import PersonaModal from '../components/PersonaModal';
import SceneModal from '../components/SceneModal';

export default function ProfilePage() {
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked',
    PERSONAS: 'Personas',
    SCENES: 'Scenes'
  };

  const { userId: profileUserId } = useParams(); // get userId from route params
  const { userData, idToken, refreshUserData } = useContext(AuthContext);

  // Determine if this is the current user's own profile
  const isOwnProfile = !profileUserId || (userData && String(userData.id) === String(profileUserId));
  // If public view, fetch userData for the profile being viewed
  const [publicUserData, setPublicUserData] = useState(null);
  const [createdCharacters, setCreatedCharacters] = useState([]);
  const [likedCharacters, setLikedCharacters] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_TYPES.CREATED);
  const [scenes, setScenes] = useState([]); // Placeholder for scenes
  // Placeholder for scene modal state
  const [showSceneModal, setShowSceneModal] = useState(false);

  // Fetch scenes from API
  useEffect(() => {
    if (idToken) {
      fetch('/api/scenes', { headers: { 'Authorization': `Bearer ${idToken}` } })
        .then(res => res.ok ? res.json() : [])
        .then(setScenes)
        .catch(() => setScenes([]));
    }
  }, [idToken]);

  // Create scene handler
  const handleCreateScene = async (sceneData) => {
    const formData = new FormData();
    formData.append('name', sceneData.name);
    formData.append('description', sceneData.description);
    const res = await fetch('/api/scenes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || data.message || 'Failed to create scene');
      return;
    }
    const newScene = await res.json();
    setScenes([...scenes, newScene]);
    setShowSceneModal(false);
  };

  // Delete scene handler
  const handleDeleteScene = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scene?')) return;
    const res = await fetch(`/api/scenes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || data.message || 'Failed to delete scene');
      return;
    }
    setScenes(scenes.filter(s => s.id !== id));
  };

  // Render scenes
  const renderScenes = () => {
    return (
      <div className="mt-3">
        {isOwnProfile && (
          <button
            className="fw-bold rounded-pill mb-3"
            style={{
              background: '#18191a',
              color: '#fff',
              border: 'none',
              fontSize: '1rem',
              padding: '0.45rem 1.5rem',
              letterSpacing: '0.2px',
              transition: 'background 0.18s, color 0.18s',
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
            onClick={() => setShowSceneModal(true)}
          >
            <i className="bi bi-plus"></i> Create New Scene
          </button>
        )}
        {scenes.length === 0 ? (
          <div className="alert alert-info" style={{ background: '#f5f6fa', color: '#232323', border: 'none' }}>
            No scenes created yet. {isOwnProfile ? 'Click "Create New Scene" to add one.' : ''}
          </div>
        ) : (
          <div className="list-group">
            {scenes.map(scene => (
              <div key={scene.id} className="list-group-item" style={{ background: '#fff', border: '1.5px solid #e9ecef', borderRadius: 12, marginBottom: 10 }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 style={{ color: '#18191a', fontWeight: 600 }}>{scene.name}</h5>
                    <p className="mb-0 text-muted">{scene.description}</p>
                  </div>
                  {isOwnProfile && (
                    <div>
                      <button className="btn btn-sm btn-outline-dark me-2" style={{ borderRadius: 20, border: '1.5px solid #232323', background: '#fff', color: '#232323' }}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" style={{ borderRadius: 20, border: '1.5px solid #e53935', background: '#fff', color: '#e53935' }} onClick={() => handleDeleteScene(scene.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!isOwnProfile && (
          <div className="alert alert-warning mt-3" style={{ background: '#fffbe6', color: '#856404', border: 'none' }}>
            Only the profile owner can create or edit scenes.
          </div>
        )}
      </div>
    );
  };
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
    if (!idToken && !profileUserId) {
      navigate('/');
      return;
    }
    // If public profile, fetch user data for that user
    if (profileUserId && (!userData || String(userData.id) !== String(profileUserId))) {
      fetch(`/api/users/${profileUserId}`)
        .then(res => res.ok ? res.json() : null)
        .then(setPublicUserData);
    }

    fetch(`/api/characters-created${profileUserId ? `?userId=${profileUserId}` : ''}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    // Only fetch liked characters if own profile
    if (isOwnProfile) {
      fetch('/api/characters-liked', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(setLikedCharacters);
    }

    // Only fetch personas if own profile
    if (isOwnProfile) {
      fetchPersonas()
        .then(setPersonas)
        .catch(console.error);
    } else {
      setPersonas([]); // hide personas for public view
    }
  }, [navigate, idToken, userData, profileUserId, isOwnProfile]);

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
            {activeTab === TAB_TYPES.CREATED && isOwnProfile && (
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
              ? "No characters created yet." 
              : "No liked characters yet."}
          </p>
        )}
      </div>
    );
  };

  const renderPersonas = () => {
    if (!isOwnProfile) {
      return (
        <div className="alert alert-warning" style={{ background: '#fffbe6', color: '#856404', border: 'none' }}>
          Personas are private and only visible to the profile owner.
        </div>
      );
    }
    return (
      <div className="mt-3">
        <button 
          className="fw-bold rounded-pill mb-3"
          style={{
            background: '#18191a',
            color: '#fff',
            border: 'none',
            fontSize: '1rem',
            padding: '0.45rem 1.5rem',
            letterSpacing: '0.2px',
            transition: 'background 0.18s, color 0.18s',
            outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
          onClick={() => setPersonaModal({ show: true, currentPersona: null })}
        >
          <i className="bi bi-plus"></i> Create New Persona
        </button>

        {personas.length === 0 ? (
          <div className="alert alert-info" style={{ background: '#f5f6fa', color: '#232323', border: 'none' }}>
            No personas created yet. Click "Create New Persona" to add one.
          </div>
        ) : (
          <div className="list-group">
            {personas.map(persona => (
              <div key={persona.id} className="list-group-item" style={{ background: '#fff', border: '1.5px solid #e9ecef', borderRadius: 12, marginBottom: 10 }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 style={{ color: '#18191a', fontWeight: 600 }}>{persona.name}</h5>
                    <p className="mb-0 text-muted">{persona.description}</p>
                  </div>
                  <div>
                    <button 
                      className="btn btn-sm btn-outline-dark me-2"
                      style={{ borderRadius: 20, border: '1.5px solid #232323', background: '#fff', color: '#232323' }}
                      onClick={() => editPersona(persona)}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger"
                      style={{ borderRadius: 20, border: '1.5px solid #e53935', background: '#fff', color: '#e53935' }}
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
      case TAB_TYPES.SCENES:
        return (
          <>
            <h4>My Scenes</h4>
            {renderScenes()}
          </>
        );
      default:
        return null;
    }
  };

  // Use correct user data for display
  const displayUser = isOwnProfile ? userData : publicUserData;
  if (!displayUser) return null;

  return (
    <div className="d-flex" style={{ height: '100vh', background: '#f8f9fa' }}>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-grow-1 p-4" style={{ background: '#fff', borderRadius: 18, margin: '2rem auto', maxWidth: 1100, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
          <h2 className="mb-4 fw-bold" style={{ color: '#18191a', fontSize: '2.1rem', letterSpacing: '0.5px' }}>My Profile</h2>
          {!isOwnProfile && (
            <div className="alert alert-info" style={{ background: '#f5f6fa', color: '#232323', border: 'none' }}>
              <strong>Public Profile View:</strong> You are viewing this profile as a visitor. Editing and some private sections are disabled.
            </div>
          )}
          <div className="d-flex align-items-center gap-4 mb-4">
            <img
              src={displayUser.profile_pic || defaultAvatar}
              alt="Profile"
              className="rounded-circle"
              width="100"
              height="100"
              style={{ border: '3px solid #e9ecef', background: '#fff' }}
            />
            <div>
              <div className="d-flex align-items-baseline gap-2 mb-1">
                <h3 className="mb-0 fw-bold" style={{ color: '#18191a' }}>{displayUser.name}</h3>
                <span className="text-muted small">•</span>
                <div className="d-flex gap-2">
                  <span className="badge" style={{ background: '#f5f6fa', color: '#232323', fontWeight: 600 }}>
                    <i className="bi bi-eye me-1"></i>
                    {displayUser.views || 0} views
                  </span>
                  <span className="badge" style={{ background: '#f5f6fa', color: '#232323', fontWeight: 600 }}>
                    <i className="bi bi-heart me-1"></i>
                    {displayUser.likes || 0} likes
                  </span>
                </div>
              </div>
              {isOwnProfile && (
                <button
                  className="fw-bold rounded-pill btn-sm mt-1"
                  style={{
                    background: '#18191a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '1rem',
                    padding: '0.35rem 1.2rem',
                    letterSpacing: '0.2px',
                    transition: 'background 0.18s, color 0.18s',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
                  onClick={() => setShowModal(true)}
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>
          <div className="mb-3">
            <ul className="nav nav-tabs" style={{ borderBottom: '2px solid #e9ecef' }}>
              <li className="nav-item">
                <button
                  className={`nav-link fw-bold ${activeTab === TAB_TYPES.CREATED ? 'active' : ''}`}
                  style={{
                    background: activeTab === TAB_TYPES.CREATED ? '#18191a' : '#fff',
                    color: activeTab === TAB_TYPES.CREATED ? '#fff' : '#232323',
                    border: 'none',
                    borderRadius: '18px 18px 0 0',
                    marginRight: 4,
                    fontSize: '1.08rem',
                    padding: '0.6rem 2.2rem',
                    transition: 'background 0.18s, color 0.18s',
                  }}
                  onClick={() => setActiveTab(TAB_TYPES.CREATED)}
                >
                  Created
                </button>
              </li>
              {isOwnProfile && (
                <li className="nav-item">
                  <button
                    className={`nav-link fw-bold ${activeTab === TAB_TYPES.LIKED ? 'active' : ''}`}
                    style={{
                      background: activeTab === TAB_TYPES.LIKED ? '#18191a' : '#fff',
                      color: activeTab === TAB_TYPES.LIKED ? '#fff' : '#232323',
                      border: 'none',
                      borderRadius: '18px 18px 0 0',
                      marginRight: 4,
                      fontSize: '1.08rem',
                      padding: '0.6rem 2.2rem',
                      transition: 'background 0.18s, color 0.18s',
                    }}
                    onClick={() => setActiveTab(TAB_TYPES.LIKED)}
                  >
                    Liked
                  </button>
                </li>
              )}
              <li className="nav-item">
                <button
                  className={`nav-link fw-bold ${activeTab === TAB_TYPES.PERSONAS ? 'active' : ''}`}
                  style={{
                    background: activeTab === TAB_TYPES.PERSONAS ? '#18191a' : '#fff',
                    color: activeTab === TAB_TYPES.PERSONAS ? '#fff' : '#232323',
                    border: 'none',
                    borderRadius: '18px 18px 0 0',
                    marginRight: 4,
                    fontSize: '1.08rem',
                    padding: '0.6rem 2.2rem',
                    transition: 'background 0.18s, color 0.18s',
                    opacity: isOwnProfile ? 1 : 0.5,
                  }}
                  onClick={() => setActiveTab(TAB_TYPES.PERSONAS)}
                  disabled={!isOwnProfile}
                >
                  Personas
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link fw-bold ${activeTab === TAB_TYPES.SCENES ? 'active' : ''}`}
                  style={{
                    background: activeTab === TAB_TYPES.SCENES ? '#18191a' : '#fff',
                    color: activeTab === TAB_TYPES.SCENES ? '#fff' : '#232323',
                    border: 'none',
                    borderRadius: '18px 18px 0 0',
                    marginRight: 4,
                    fontSize: '1.08rem',
                    padding: '0.6rem 2.2rem',
                    transition: 'background 0.18s, color 0.18s',
                  }}
                  onClick={() => setActiveTab(TAB_TYPES.SCENES)}
                >
                  Scenes
                </button>
              </li>
              {/* Scene Create/Edit Modal */}
              {isOwnProfile && (
                <SceneModal show={showSceneModal} onClose={() => setShowSceneModal(false)} onSubmit={handleCreateScene} />
              )}
            </ul>
          </div>

          {renderContent()}
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showModal && isOwnProfile && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleSave} style={{ borderRadius: 18, border: 'none', background: '#fff' }}>
              <div className="modal-header" style={{ borderBottom: '1.5px solid #e9ecef' }}>
                <h5 className="modal-title fw-bold" style={{ color: '#18191a' }}>Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label fw-bold" style={{ color: '#232323' }}>Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ paddingRight: "3rem", background: '#f5f6fa', border: '1.5px solid #e9ecef', color: '#232323' }}
                  />
                  <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                    {editName.length}/{MAX_NAME_LENGTH}
                  </small>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" style={{ color: '#232323' }}>Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={e => setEditPic(e.target.files[0])}
                    style={{ background: '#f5f6fa', border: '1.5px solid #e9ecef', color: '#232323' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1.5px solid #e9ecef' }}>
                <button
                  type="submit"
                  className="fw-bold rounded-pill"
                  style={{
                    background: '#18191a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '1rem',
                    padding: '0.45rem 1.5rem',
                    letterSpacing: '0.2px',
                    transition: 'background 0.18s, color 0.18s',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="fw-bold rounded-pill"
                  style={{
                    background: '#fff',
                    color: '#232323',
                    border: '1.5px solid #e9ecef',
                    fontSize: '1rem',
                    padding: '0.45rem 1.5rem',
                    letterSpacing: '0.2px',
                    transition: 'background 0.18s, color 0.18s',
                    outline: 'none',
                  }}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persona Edit/Create Modal */}
      {isOwnProfile && (
        <PersonaModal
          show={personaModal.show}
          onClose={() => setPersonaModal({ show: false, currentPersona: null })}
          onSave={handlePersonaSave}
          currentPersona={personaModal.currentPersona}
        />
      )}
    </div>
  );
}