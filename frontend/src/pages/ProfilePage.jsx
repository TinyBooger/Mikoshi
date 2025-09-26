import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router'; // useParams instead of useLocation
import defaultAvatar from '../assets/images/default-avatar.png';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';

import EntityCard from '../components/EntityCard';
import ButtonRounded from '../components/ButtonRounded';
import CardSection from '../components/CardSection';

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked',
  };
  const SUBTAB_TYPES = {
    CHARACTERS: 'characters',
    SCENES: 'scenes',
    PERSONAS: 'personas',
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
  const [likedPersonas, setLikedPersonas] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_TYPES.CREATED);
  const [activeSubtab, setActiveSubtab] = useState(SUBTAB_TYPES.CHARACTERS);
  const [scenes, setScenes] = useState([]);
  const [likedScenes, setLikedScenes] = useState([]);


  // Fetch created and liked entities for profile
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

    // Created Characters
    fetch(`${window.API_BASE_URL}/api/characters-created${profileUserId ? `?userId=${profileUserId}` : ''}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    // Created Scenes
    fetch(`${window.API_BASE_URL}/api/scenes-created${profileUserId ? `?userId=${profileUserId}` : ''}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(setScenes);

    // Created Personas (private, only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/personas-created`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(setPersonas)
        .catch(() => setPersonas([]));
    } else {
      setPersonas([]); // hide personas for public view
    }

    // Liked Characters (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/characters-liked`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(setLikedCharacters);
    } else {
      setLikedCharacters([]);
    }

    // Liked Scenes (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/scenes-liked`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(setLikedScenes);
    } else {
      setLikedScenes([]);
    }

    // Liked Personas (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/personas-liked`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(setLikedPersonas);
    } else {
      setLikedPersonas([]);
    }
  }, [navigate, idToken, userData, profileUserId, isOwnProfile]);




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
            {t('profile.no_scenes_created')}
          </p>
        )}
        {scenes.map(scene => (
          <div key={scene.id} style={{ margin: 0, padding: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <EntityCard type="scene" entity={scene} />
              {isOwnProfile && (
                <ButtonRounded
                  title={t('profile.edit_scene')}
                  onClick={() => navigate(`/scene/edit/${scene.id}`)}
                >
                  <i className="bi bi-pencil-square"></i>
                  {t('profile.edit')}
                </ButtonRounded>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  // Unified content renderer for all tabs and subtabs
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
                  <i className="bi bi-pencil-square"></i> {t('profile.edit')}
                </ButtonRounded>
              )}
            </div>
          ))
        )}
      </CardSection>
    );

    // Subtab logic
    let entities = [];
    let type = '';
    let showEdit = false;
    let editUrlPrefix = '';
    let title = '';
    let emptyMsg = '';

    if (activeTab === TAB_TYPES.CREATED) {
      if (activeSubtab === SUBTAB_TYPES.CHARACTERS) {
        entities = createdCharacters;
        type = 'character';
        showEdit = isOwnProfile;
        editUrlPrefix = 'character';
        title = t('profile.created_characters');
        emptyMsg = t('profile.no_characters_created');
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = scenes;
        type = 'scene';
        showEdit = isOwnProfile;
        editUrlPrefix = 'scene';
        title = t('profile.created_scenes');
        emptyMsg = t('profile.no_scenes_created');
      } else if (activeSubtab === SUBTAB_TYPES.PERSONAS) {
        if (!isOwnProfile) {
          return (
            <div className="alert alert-warning" style={{ background: '#fffbe6', color: '#856404', border: 'none' }}>
              {t('profile.personas_private')}
            </div>
          );
        }
        entities = personas;
        type = 'persona';
        showEdit = true;
        editUrlPrefix = 'persona';
        title = t('profile.created_personas');
        emptyMsg = t('profile.no_personas_created');
      }
    } else if (activeTab === TAB_TYPES.LIKED) {
      if (activeSubtab === SUBTAB_TYPES.CHARACTERS) {
        entities = likedCharacters;
        type = 'character';
        showEdit = false;
        editUrlPrefix = 'character';
        title = t('profile.liked_characters');
        emptyMsg = t('profile.no_liked_characters');
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = likedScenes; // Placeholder, not implemented
        type = 'scene';
        showEdit = false;
        editUrlPrefix = 'scene';
        title = t('profile.liked_scenes');
        emptyMsg = t('profile.no_liked_scenes');
      } else if (activeSubtab === SUBTAB_TYPES.PERSONAS) {
        entities = likedPersonas; // Placeholder, not implemented
        type = 'persona';
        showEdit = false;
        editUrlPrefix = 'persona';
        title = t('profile.liked_personas');
        emptyMsg = t('profile.no_liked_personas');
      }
    }
    return renderEntityCardSection(entities, type, showEdit, editUrlPrefix, title, emptyMsg);
  };
  // Edit profile modal state
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPic, setEditPic] = useState(null);
  // ...existing code...



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
            <span className="visually-hidden">{t('profile.loading')}</span>
          </div>
          <div className="mt-3 text-muted">{t('profile.loading_profile')}</div>
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
            src={displayUser.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${displayUser.profile_pic.replace(/^\//, '')}` : defaultAvatar}
            alt="Profile"
            style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2.4px solid #222', marginRight: 24, background: '#fff' }}
          />
          <div>
            <h2 style={{ color: '#111', fontWeight: 700 }}>{displayUser.name}</h2>
            <p className="mb-0" style={{ fontSize: '1.02rem', maxWidth: 400, whiteSpace: 'pre-line', color: '#444' }}>
              {displayUser.bio && displayUser.bio.trim()
                ? displayUser.bio
                : (isOwnProfile
                    ? t('profile.bio_prompt')
                    : t('profile.bio_not_set'))}
            </p>
            {isOwnProfile && (
              <ButtonRounded onClick={openEditProfile} style={{ marginTop: 8, width: 160 }}>
                <i className="bi bi-pencil"></i> {t('profile.edit_profile')}
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
              onClick={() => { setActiveTab(TAB_TYPES.CREATED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); }}
            >
              {t('profile.created')}
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
                onClick={() => { setActiveTab(TAB_TYPES.LIKED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); }}
              >
                {t('profile.liked')}
              </button>
            )}
          </div>
          {/* Subtabs for Created/Liked */}
          <div className="d-flex" style={{ borderBottom: '1.5px solid #aaa', paddingBottom: 4, marginTop: 8, gap: 8 }}>
            <button
              className={`fw-bold py-1 px-3 border-0 ${activeSubtab === SUBTAB_TYPES.CHARACTERS ? '' : ''}`}
              style={{
                background: activeSubtab === SUBTAB_TYPES.CHARACTERS ? '#222' : '#f5f5f5',
                color: activeSubtab === SUBTAB_TYPES.CHARACTERS ? '#fff' : '#222',
                borderRadius: 8,
                border: '1.2px solid #222',
                borderBottom: activeSubtab === SUBTAB_TYPES.CHARACTERS ? 'none' : '1.2px solid #222',
                marginRight: 8,
                transition: 'background 0.18s, color 0.18s',
              }}
              onClick={() => setActiveSubtab(SUBTAB_TYPES.CHARACTERS)}
            >
              {t('profile.characters')}
            </button>
            <button
              className={`fw-bold py-1 px-3 border-0 ${activeSubtab === SUBTAB_TYPES.SCENES ? '' : ''}`}
              style={{
                background: activeSubtab === SUBTAB_TYPES.SCENES ? '#222' : '#f5f5f5',
                color: activeSubtab === SUBTAB_TYPES.SCENES ? '#fff' : '#222',
                borderRadius: 8,
                border: '1.2px solid #222',
                borderBottom: activeSubtab === SUBTAB_TYPES.SCENES ? 'none' : '1.2px solid #222',
                marginRight: 8,
                transition: 'background 0.18s, color 0.18s',
              }}
              onClick={() => setActiveSubtab(SUBTAB_TYPES.SCENES)}
            >
              {t('profile.scenes')}
            </button>
            <button
              className={`fw-bold py-1 px-3 border-0 ${activeSubtab === SUBTAB_TYPES.PERSONAS ? '' : ''}`}
              style={{
                background: activeSubtab === SUBTAB_TYPES.PERSONAS ? '#222' : '#f5f5f5',
                color: activeSubtab === SUBTAB_TYPES.PERSONAS ? '#fff' : '#222',
                borderRadius: 8,
                border: '1.2px solid #222',
                borderBottom: activeSubtab === SUBTAB_TYPES.PERSONAS ? 'none' : '1.2px solid #222',
                marginRight: 8,
                transition: 'background 0.18s, color 0.18s',
              }}
              onClick={() => setActiveSubtab(SUBTAB_TYPES.PERSONAS)}
            >
              {t('profile.personas')}
            </button>
          </div>
          {/* Content based on active tab and subtab */}
          {renderTabContent()}
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showModal && isOwnProfile && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, position: 'fixed', inset: 0, width: '100vw', height: '100vh', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }}>
          <div className="modal-dialog mx-auto" style={{ margin: '7vh auto', maxWidth: 420, width: '100%' }}>
            <form className="modal-content" onSubmit={handleSave} style={{ borderRadius: 18, border: '2px solid #111', background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', margin: 0 }}>
              <div className="modal-header" style={{ borderBottom: '2px solid #111', background: '#fff' }}>
                <h5 className="modal-title fw-bold" style={{ color: '#111' }}>{t('profile.edit_profile')}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 position-relative">
                  <label className="form-label fw-bold" style={{ color: '#111' }}>{t('profile.name')}</label>
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
                  <label className="form-label fw-bold" style={{ color: '#111' }}>{t('profile.short_bio')} <span style={{ fontWeight: 400, fontSize: '0.9em', color: '#888' }}>(optional)</span></label>
                  <textarea
                    className="form-control"
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={t('profile.bio_placeholder')}
                    style={{ background: '#fff', border: '1.5px solid #111', color: '#111' }}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold" style={{ color: '#111' }}>{t('profile.profile_picture')}</label>
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
                  {t('profile.save')}
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
                  {t('profile.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </PageWrapper>
  );
}