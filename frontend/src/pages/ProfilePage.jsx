import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router'; // useParams instead of useLocation
import defaultAvatar from '../assets/images/default-avatar.png';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';

import EntityCard from '../components/EntityCard';
import ButtonRounded from '../components/ButtonRounded';
import CardSection from '../components/CardSection';

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


  // Fetch scenes from API
  useEffect(() => {
    if (idToken) {
      fetch(`${window.API_BASE_URL}/api/scenes/`, { headers: { 'Authorization': `Bearer ${idToken}` } })
        .then(res => res.ok ? res.json() : [])
        .then(setScenes)
        .catch(() => setScenes([]));
    }
  }, [idToken]);




  // Render scenes using SceneCard, with edit for owner
  const renderScenes = () => {
    return (
      <div
        className="d-flex flex-wrap align-items-start"
        style={{
          gap: '24px 18px',
          marginTop: 18,
          rowGap: 24,
          columnGap: 18,
          width: '100%',
        }}>
        {scenes.length === 0 && (
          <p className="text-muted" style={{ width: 320 }}>
            No scenes created yet.
          </p>
        )}
        {scenes.map(scene => (
          <div key={scene.id} style={{ margin: 0, padding: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <EntityCard type="scene" entity={scene} />
              {isOwnProfile && (
                <ButtonRounded
                  title="Edit Scene"
                  onClick={() => navigate(`/scene/edit/${scene.id}`)}
                >
                  <i className="bi bi-pencil-square"></i>
                  Edit
                </ButtonRounded>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  // Unified content renderer for all tabs
  const renderTabContent = () => {
    // Helper for CardSection grid
    const renderEntityCardSection = (entities, type, showEdit, editUrlPrefix, title, emptyMsg) => (
      <CardSection title={title}>
        {entities && entities.length === 0 ? (
          <div className="alert alert-info" style={{ background: '#f5f6fa', color: '#232323', border: 'none', gridColumn: '1/-1' }}>
            {emptyMsg}
          </div>
        ) : (
          entities && entities.map(entity => (
            <div key={entity.id} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <EntityCard type={type} entity={entity} />
              {showEdit && (
                <ButtonRounded
                  title={`Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                  onClick={() => navigate(`/${editUrlPrefix}/edit/${entity.id}`)}
                  style={{ marginTop: 8, width: 140 }}
                >
                  <i className="bi bi-pencil-square"></i> Edit
                </ButtonRounded>
              )}
            </div>
          ))
        )}
      </CardSection>
    );

    // Personas tab (private)
    if (activeTab === TAB_TYPES.PERSONAS) {
      if (!isOwnProfile) {
        return (
          <div className="alert alert-warning" style={{ background: '#fffbe6', color: '#856404', border: 'none' }}>
            Personas are private and only visible to the profile owner.
          </div>
        );
      }
      return renderEntityCardSection(personas, 'persona', true, 'persona', 'My Personas', 'No personas created yet.');
    }

    // Scenes tab
    if (activeTab === TAB_TYPES.SCENES) {
      return renderEntityCardSection(
        scenes,
        'scene',
        isOwnProfile,
        'scene',
        'My Scenes',
        'No scenes created yet.'
      );
    }

    // Characters tabs (Created or Liked)
    if (activeTab === TAB_TYPES.CREATED || activeTab === TAB_TYPES.LIKED) {
      const characters = activeTab === TAB_TYPES.CREATED ? createdCharacters : likedCharacters;
      const showEdit = activeTab === TAB_TYPES.CREATED && isOwnProfile;
      return renderEntityCardSection(
        characters,
        'character',
        showEdit,
        'character',
        `${activeTab} Characters`,
        activeTab === TAB_TYPES.CREATED ? 'No characters created yet.' : 'No liked characters yet.'
      );
    }
    return null;
  };
  // Edit profile modal state
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPic, setEditPic] = useState(null);
  const navigate = useNavigate();



  // API call functions for Persona table endpoints
  const fetchPersonas = async () => {
    const res = await fetch(`${window.API_BASE_URL}/api/personas/`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (res.ok) return await res.json();
    throw new Error('Failed to fetch personas');
  };

  useEffect(() => {
    if (!idToken && !profileUserId) {
      navigate('/');
      return;
    }
    // If public profile, fetch user data for that user
    if (profileUserId && (!userData || String(userData.id) !== String(profileUserId))) {
      fetch(`${window.API_BASE_URL}/api/users/${profileUserId}`)
        .then(res => res.ok ? res.json() : null)
        .then(setPublicUserData);
    }

    fetch(`${window.API_BASE_URL}/api/characters-created${profileUserId ? `?userId=${profileUserId}` : ''}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    // Only fetch liked characters if own profile
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/characters-liked`, {
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

    const res = await fetch(`${window.API_BASE_URL}/api/update-profile`, {
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

  // (Old renderCharacters, renderPersonas, renderScenes, renderContent removed and replaced by renderTabContent)

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
    <PageWrapper>
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
              <ButtonRounded onClick={openEditProfile} style={{ marginTop: 8, width: 160 }}>
                <i className="bi bi-pencil"></i> Edit Profile
              </ButtonRounded>
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
          {renderTabContent()}
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


    </PageWrapper>
  );
}