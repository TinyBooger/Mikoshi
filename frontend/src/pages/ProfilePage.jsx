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
      fetch('/api/scenes/', { headers: { 'Authorization': `Bearer ${idToken}` } })
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
    const res = await fetch('/api/scenes/', {
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
  // Edit profile modal state
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPic, setEditPic] = useState(null);
  const navigate = useNavigate();
  // Replace the showPersonaModal state and related functions with:
  const [personaModal, setPersonaModal] = useState({
    show: false,
    currentPersona: null
  });


  // API call functions for Persona table endpoints
  const fetchPersonas = async () => {
    const res = await fetch('/api/personas/', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (res.ok) return await res.json();
    throw new Error('Failed to fetch personas');
  };

  const createPersona = async (persona) => {
    // Persona API expects FormData (not JSON)
    const formData = new FormData();
    formData.append('name', persona.name);
    if (persona.description) formData.append('description', persona.description);
    if (persona.intro) formData.append('intro', persona.intro);
    if (persona.tags) {
      // If tags is array, append each
      if (Array.isArray(persona.tags)) {
        persona.tags.forEach(tag => formData.append('tags', tag));
      } else {
        formData.append('tags', persona.tags);
      }
    }
    const res = await fetch('/api/personas/', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || data.message || 'Failed to create persona');
    }
    // Persona API returns {id, message}, so refetch list
    await fetchPersonas().then(setPersonas);
    return true;
  };

  const updatePersona = async (id, persona) => {
    const formData = new FormData();
    if (persona.name) formData.append('name', persona.name);
    if (persona.description) formData.append('description', persona.description);
    if (persona.intro) formData.append('intro', persona.intro);
    if (persona.tags) {
      if (Array.isArray(persona.tags)) {
        persona.tags.forEach(tag => formData.append('tags', tag));
      } else {
        formData.append('tags', persona.tags);
      }
    }
    const res = await fetch(`/api/personas/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || data.message || 'Failed to update persona');
    }
    await fetchPersonas().then(setPersonas);
    return true;
  };

  const deletePersona = async (id) => {
    const res = await fetch(`/api/personas/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || data.message || 'Failed to delete persona');
    }
    await fetchPersonas().then(setPersonas);
    return true;
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

  // Open edit modal and prefill fields
  const openEditProfile = () => {
    setEditName(userData?.name || '');
    setEditBio(userData?.bio || '');
    setEditPic(null);
    setShowModal(true);
  };

  // Save profile changes
  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editName.trim());
    formData.append('bio', editBio);
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
      <div
        className="d-flex flex-wrap align-items-start"
        style={{
          gap: '24px 18px',
          marginTop: 18,
          rowGap: 24,
          columnGap: 18,
          width: '100%',
        }}
      >
        {characters.map(c => (
          <div
            key={c.id}
            style={{
              margin: 0,
              padding: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <CharacterCard character={c} />
              {/* Edit button below the character card for own created characters */}
              {activeTab === TAB_TYPES.CREATED && isOwnProfile && (
                <button
                  className="btn btn-outline-dark btn-sm mt-2"
                  style={{
                    borderRadius: 20,
                    border: '1.5px solid #232323',
                    background: '#fff',
                    color: '#232323',
                    fontWeight: 600,
                    width: '90%',
                    alignSelf: 'center',
                    transition: 'background 0.18s, color 0.18s, border 0.18s',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  title="Edit Character"
                  onClick={() => navigate(`/character/edit/${c.id}`)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#18191a';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.border = '1.5px solid #18191a';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#232323';
                    e.currentTarget.style.border = '1.5px solid #232323';
                  }}
                >
                  <i className="bi bi-pencil-square"></i>
                  Edit
                </button>
              )}
            </div>
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

  // Loading and error state for user data
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState(null);

  useEffect(() => {
    // If own profile, wait for userData
    if (isOwnProfile) {
      if (userData) {
        console.log('[ProfilePage] userData received:', userData);
        setUserLoading(false);
        setUserError(null);
      } else {
        setUserLoading(true);
      }
    } else {
      // For public profile, wait for publicUserData
      if (profileUserId) {
        if (publicUserData === null) {
          setUserLoading(true);
        } else if (publicUserData && publicUserData.id) {
          setUserLoading(false);
          setUserError(null);
        } else {
          setUserLoading(false);
          setUserError('User not found.');
        }
      }
    }
  }, [isOwnProfile, userData, publicUserData, profileUserId]);

  const displayUser = isOwnProfile ? userData : publicUserData;

  if (userLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: 36, height: 36 }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-3 text-muted">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <div className="alert alert-danger" style={{ background: '#fff0f0', color: '#b71c1c', border: 'none', fontSize: '1.1rem' }}>
          {userError}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mt-4" style={{ position: 'relative', zIndex: 1 }}>
        <div className="d-flex align-items-center mb-3">
          <img
            src={displayUser.profile_pic || defaultAvatar}
            alt="Profile"
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2.4px solid #222', marginRight: 24, background: '#fff' }}
          />
          <div>
            <h2 style={{ color: '#111', fontWeight: 700 }}>{displayUser.name}</h2>
            <p className="mb-0" style={{ fontSize: '1.02rem', maxWidth: 400, whiteSpace: 'pre-line', color: '#444' }}>
              {displayUser.bio && displayUser.bio.trim()
                ? displayUser.bio
                : (isOwnProfile
                    ? 'You have not added a bio yet. Click edit to add something about yourself!'
                    : 'This user has not added a bio yet.')}
            </p>
            {isOwnProfile && (
              <button
                className="btn btn-outline-dark btn-sm mt-2"
                style={{ borderRadius: 20, border: '1.5px solid #111', background: '#fff', color: '#111', fontWeight: 600 }}
                onClick={openEditProfile}
              >
                <i className="bi bi-pencil"></i> Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-column" style={{ gap: 24 }}>
          {/* Tabs for navigation */}
          <div className="d-flex" style={{ borderBottom: '2px solid #111', paddingBottom: 8 }}>
            <button
              className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.CREATED ? '' : ''}`}
              style={{
                background: activeTab === TAB_TYPES.CREATED ? '#111' : '#fff',
                color: activeTab === TAB_TYPES.CREATED ? '#fff' : '#111',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                border: '1.5px solid #111',
                borderBottom: activeTab === TAB_TYPES.CREATED ? 'none' : '1.5px solid #111',
                transition: 'background 0.2s, color 0.2s',
              }}
              onClick={() => setActiveTab(TAB_TYPES.CREATED)}
            >
              Created
            </button>
            {isOwnProfile && (
              <button
                className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.LIKED ? '' : ''}`}
                style={{
                  background: activeTab === TAB_TYPES.LIKED ? '#111' : '#fff',
                  color: activeTab === TAB_TYPES.LIKED ? '#fff' : '#111',
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 12,
                  border: '1.5px solid #111',
                  borderBottom: activeTab === TAB_TYPES.LIKED ? 'none' : '1.5px solid #111',
                  transition: 'background 0.2s, color 0.2s',
                }}
                onClick={() => setActiveTab(TAB_TYPES.LIKED)}
              >
                Liked
              </button>
            )}
            <button
              className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.PERSONAS ? '' : ''}`}
              style={{
                background: activeTab === TAB_TYPES.PERSONAS ? '#111' : '#fff',
                color: activeTab === TAB_TYPES.PERSONAS ? '#fff' : '#111',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 12,
                border: '1.5px solid #111',
                borderBottom: activeTab === TAB_TYPES.PERSONAS ? 'none' : '1.5px solid #111',
                opacity: isOwnProfile ? 1 : 0.5,
                transition: 'background 0.2s, color 0.2s',
              }}
              onClick={() => setActiveTab(TAB_TYPES.PERSONAS)}
              disabled={!isOwnProfile}
            >
              Personas
            </button>
            <button
              className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.SCENES ? '' : ''}`}
              style={{
                background: activeTab === TAB_TYPES.SCENES ? '#111' : '#fff',
                color: activeTab === TAB_TYPES.SCENES ? '#fff' : '#111',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 12,
                border: '1.5px solid #111',
                borderBottom: activeTab === TAB_TYPES.SCENES ? 'none' : '1.5px solid #111',
                transition: 'background 0.2s, color 0.2s',
              }}
              onClick={() => setActiveTab(TAB_TYPES.SCENES)}
            >
              Scenes
            </button>
          </div>

          {/* Content based on active tab */}
          <div className="p-4" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '1.5px solid #111' }}>
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showModal && isOwnProfile && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, position: 'fixed', inset: 0, width: '100vw', height: '100vh', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }}>
          <div className="modal-dialog mx-auto" style={{ margin: '7vh auto', maxWidth: 420, width: '100%' }}>
            <form className="modal-content" onSubmit={handleSave} style={{ borderRadius: 18, border: '2px solid #111', background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', margin: 0 }}>
              <div className="modal-header" style={{ borderBottom: '2px solid #111', background: '#fff' }}>
                <h5 className="modal-title fw-bold" style={{ color: '#111' }}>Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label fw-bold" style={{ color: '#111' }}>Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ paddingRight: "3rem", background: '#fff', border: '1.5px solid #111', color: '#111' }}
                  />
                  <small className="position-absolute" style={{ top: 0, right: 0, color: '#888' }}>
                    {editName.length}/{MAX_NAME_LENGTH}
                  </small>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" style={{ color: '#111' }}>Short Bio <span style={{ fontWeight: 400, fontSize: '0.9em', color: '#888' }}>(optional)</span></label>
                  <textarea
                    className="form-control"
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Tell us a little about yourself (max 500 chars)"
                    style={{ background: '#fff', border: '1.5px solid #111', color: '#111' }}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" style={{ color: '#111' }}>Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={e => setEditPic(e.target.files[0])}
                    style={{ background: '#fff', border: '1.5px solid #111', color: '#111' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '2px solid #111', background: '#fff' }}>
                <button
                  type="submit"
                  className="fw-bold rounded-pill"
                  style={{
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    fontSize: '1rem',
                    padding: '0.45rem 1.5rem',
                    letterSpacing: '0.2px',
                    transition: 'background 0.18s, color 0.18s',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#222'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#111'; }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="fw-bold rounded-pill"
                  style={{
                    background: '#fff',
                    color: '#111',
                    border: '1.5px solid #111',
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
    </>
  );
}