import React, { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router'; // useParams instead of useLocation
import defaultAvatar from '../assets/images/default-avatar.png';
import ImageCropModal from '../components/ImageCropModal';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';

import EntityCard from '../components/EntityCard';
import ButtonRounded from '../components/ButtonRounded';
import CardSection from '../components/CardSection';
import PaginationBar from '../components/PaginationBar';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import LevelProgress from '../components/LevelProgress';
import AvatarFrame from '../components/AvatarFrame';

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
  const { userData, sessionToken, refreshUserData } = useContext(AuthContext);
  const toast = useToast();

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

  // Pagination state for each entity type
  const [createdCharactersPage, setCreatedCharactersPage] = useState(1);
  const [createdCharactersTotal, setCreatedCharactersTotal] = useState(0);
  const [likedCharactersPage, setLikedCharactersPage] = useState(1);
  const [likedCharactersTotal, setLikedCharactersTotal] = useState(0);
  const [scenesPage, setScenesPage] = useState(1);
  const [scenesTotal, setScenesTotal] = useState(0);
  const [likedScenesPage, setLikedScenesPage] = useState(1);
  const [likedScenesTotal, setLikedScenesTotal] = useState(0);
  const [personasPage, setPersonasPage] = useState(1);
  const [personasTotal, setPersonasTotal] = useState(0);
  const [likedPersonasPage, setLikedPersonasPage] = useState(1);
  const [likedPersonasTotal, setLikedPersonasTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // Total stats for all created characters
  const [totalChats, setTotalChats] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  
  // Badge award modal state
  const [newlyAwardedBadges, setNewlyAwardedBadges] = useState([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  
  // Badge selection modal state
  const [showBadgeSelector, setShowBadgeSelector] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(userData?.active_badge || null);

  // Sync selectedBadge with userData when it changes
  useEffect(() => {
    if (userData?.active_badge !== undefined) {
      setSelectedBadge(userData.active_badge);
    }
  }, [userData?.active_badge]);

  // Check and award badges when user visits their own profile
  useEffect(() => {
    if (isOwnProfile && sessionToken) {
      fetch(`${window.API_BASE_URL}/api/user/badges/check-and-award`, {
        method: 'POST',
        headers: { 'Authorization': sessionToken }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.newly_awarded && data.newly_awarded.length > 0) {
            setNewlyAwardedBadges(data.newly_awarded);
            setShowBadgeModal(true);
            // Refresh user data to get updated badges
            if (refreshUserData) {
              refreshUserData();
            }
          }
        })
        .catch(err => console.error('Error checking badges:', err));
    }
  }, [isOwnProfile, sessionToken, refreshUserData]);

  // Fetch created and liked entities for profile
  useEffect(() => {
    if (!sessionToken && !profileUserId) {
      navigate('/');
      return;
    }
    setLoading(true);
    // If public profile, fetch user data for that user
    if (profileUserId && (!userData || String(userData.id) !== String(profileUserId))) {
      fetch(`${window.API_BASE_URL}/api/users/${profileUserId}`)
        .then(res => res.ok ? res.json() : null)
        .then(setPublicUserData);
    }

    const userIdParam = profileUserId ? `?userId=${profileUserId}` : '';

    // Created Characters
    fetch(`${window.API_BASE_URL}/api/characters-created${userIdParam}${userIdParam ? '&' : '?'}page=${createdCharactersPage}&page_size=${pageSize}`, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.items) {
          setCreatedCharacters(data.items);
          setCreatedCharactersTotal(data.total || 0);
        } else if (Array.isArray(data)) {
          setCreatedCharacters(data);
          setCreatedCharactersTotal(data.length);
        }
      });

    // Created Scenes
    fetch(`${window.API_BASE_URL}/api/scenes-created${userIdParam}${userIdParam ? '&' : '?'}page=${scenesPage}&page_size=${pageSize}`, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.items) {
          setScenes(data.items);
          setScenesTotal(data.total || 0);
        } else if (Array.isArray(data)) {
          setScenes(data);
          setScenesTotal(data.length);
        }
      });

    // Created Personas
    fetch(`${window.API_BASE_URL}/api/personas-created${userIdParam}${userIdParam ? '&' : '?'}page=${personasPage}&page_size=${pageSize}`, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.items) {
          setPersonas(data.items);
          setPersonasTotal(data.total || 0);
        } else if (Array.isArray(data)) {
          setPersonas(data);
          setPersonasTotal(data.length);
        }
      })
      .catch(() => setPersonas([]));

    // Liked Characters (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/characters-liked?page=${likedCharactersPage}&page_size=${pageSize}`, {
        headers: { 'Authorization': sessionToken }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.items) {
            setLikedCharacters(data.items);
            setLikedCharactersTotal(data.total || 0);
          } else if (Array.isArray(data)) {
            setLikedCharacters(data);
            setLikedCharactersTotal(data.length);
          }
        });
    } else {
      setLikedCharacters([]);
    }

    // Liked Scenes (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/scenes-liked?page=${likedScenesPage}&page_size=${pageSize}`, {
        headers: { 'Authorization': sessionToken }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.items) {
            setLikedScenes(data.items);
            setLikedScenesTotal(data.total || 0);
          } else if (Array.isArray(data)) {
            setLikedScenes(data);
            setLikedScenesTotal(data.length);
          }
        });
    } else {
      setLikedScenes([]);
    }

    // Liked Personas (only for own profile)
    if (isOwnProfile) {
      fetch(`${window.API_BASE_URL}/api/personas-liked?page=${likedPersonasPage}&page_size=${pageSize}`, {
        headers: { 'Authorization': sessionToken }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.items) {
            setLikedPersonas(data.items);
            setLikedPersonasTotal(data.total || 0);
          } else if (Array.isArray(data)) {
            setLikedPersonas(data);
            setLikedPersonasTotal(data.length);
          }
        });
    } else {
      setLikedPersonas([]);
    }
    setLoading(false);
  }, [navigate, sessionToken, userData, profileUserId, isOwnProfile, createdCharactersPage, likedCharactersPage, scenesPage, likedScenesPage, personasPage, likedPersonasPage]);

  // Calculate total chats and likes from all created characters
  useEffect(() => {
    if (createdCharacters.length > 0) {
      const chatsSum = createdCharacters.reduce((sum, char) => sum + (char.views || 0), 0);
      const likesSum = createdCharacters.reduce((sum, char) => sum + (char.likes || 0), 0);
      setTotalChats(chatsSum);
      setTotalLikes(likesSum);
    } else {
      setTotalChats(0);
      setTotalLikes(0);
    }
  }, [createdCharacters]);

  // Unified content renderer for all tabs and subtabs
  const renderTabContent = () => {
    // Helper for CardSection grid
    const renderEntityCardSection = (entities, type, showEdit, editUrlPrefix, title, emptyMsg, page, total, onPageChange) => (
      <>
        <CardSection title={title}>
          {loading ? (
            <div className="text-center my-5" style={{ gridColumn: '1/-1' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('profile.loading')}</span>
              </div>
            </div>
          ) : entities && entities.length === 0 ? (
            <div className="text-center my-5" style={{ gridColumn: '1/-1' }}>
              <div className="alert alert-info" style={{ background: '#f5f6fa', color: '#232323', border: 'none', display: 'inline-block' }}>
                {emptyMsg}
              </div>
            </div>
          ) : (
            <>
              {entities && entities.map(entity => (
                <div 
                  key={entity.id}
                  style={{
                    display: 'grid',
                    gridTemplateRows: '1fr auto',
                    gap: '8px'
                  }}
                >
                  <EntityCard type={type} entity={entity} />
                  {showEdit && (
                    <ButtonRounded
                      title={`Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                      onClick={() => navigate(`/${editUrlPrefix}/edit/${entity.id}`)}
                      style={{ 
                        width: '100%', 
                        fontSize: '0.85rem', 
                        padding: '0.4rem 0.8rem'
                      }}
                    >
                      <i className="bi bi-pencil-square"></i> {t('profile.edit')}
                    </ButtonRounded>
                  )}
                </div>
              ))}
            </>
          )}
        </CardSection>
        <PaginationBar
          page={page}
          total={total}
          pageSize={pageSize}
          loading={loading}
          onPageChange={onPageChange}
        />
      </>
    );

    // Subtab logic
    let entities = [];
    let type = '';
    let showEdit = false;
    let editUrlPrefix = '';
    let title = '';
    let emptyMsg = '';
    let page = 1;
    let total = 0;
    let onPageChange = () => {};

    if (activeTab === TAB_TYPES.CREATED) {
      if (activeSubtab === SUBTAB_TYPES.CHARACTERS) {
        entities = createdCharacters;
        type = 'character';
        showEdit = isOwnProfile;
        editUrlPrefix = 'character';
        title = t('profile.created_characters');
        emptyMsg = t('profile.no_characters_created');
        page = createdCharactersPage;
        total = createdCharactersTotal;
        onPageChange = setCreatedCharactersPage;
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = scenes;
        type = 'scene';
        showEdit = isOwnProfile;
        editUrlPrefix = 'scene';
        title = t('profile.created_scenes');
        emptyMsg = t('profile.no_scenes_created');
        page = scenesPage;
        total = scenesTotal;
        onPageChange = setScenesPage;
      } else if (activeSubtab === SUBTAB_TYPES.PERSONAS) {
        // Personas are public (same behavior as characters and scenes)
        entities = personas;
        type = 'persona';
        showEdit = isOwnProfile;
        editUrlPrefix = 'persona';
        title = t('profile.created_personas');
        emptyMsg = t('profile.no_personas_created');
        page = personasPage;
        total = personasTotal;
        onPageChange = setPersonasPage;
      }
    } else if (activeTab === TAB_TYPES.LIKED) {
      if (activeSubtab === SUBTAB_TYPES.CHARACTERS) {
        entities = likedCharacters;
        type = 'character';
        showEdit = false;
        editUrlPrefix = 'character';
        title = t('profile.liked_characters');
        emptyMsg = t('profile.no_liked_characters');
        page = likedCharactersPage;
        total = likedCharactersTotal;
        onPageChange = setLikedCharactersPage;
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = likedScenes;
        type = 'scene';
        showEdit = false;
        editUrlPrefix = 'scene';
        title = t('profile.liked_scenes');
        emptyMsg = t('profile.no_liked_scenes');
        page = likedScenesPage;
        total = likedScenesTotal;
        onPageChange = setLikedScenesPage;
      } else if (activeSubtab === SUBTAB_TYPES.PERSONAS) {
        entities = likedPersonas;
        type = 'persona';
        showEdit = false;
        editUrlPrefix = 'persona';
        title = t('profile.liked_personas');
        emptyMsg = t('profile.no_liked_personas');
        page = likedPersonasPage;
        total = likedPersonasTotal;
        onPageChange = setLikedPersonasPage;
      }
    }
    return renderEntityCardSection(entities, type, showEdit, editUrlPrefix, title, emptyMsg, page, total, onPageChange);
  };
  // Edit profile modal state
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPic, setEditPic] = useState(null);
  const [editPicPreview, setEditPicPreview] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  // ...existing code...



  // (No duplicate persona fetch here — personas are handled in the main useEffect above)

  // Open edit modal and prefill fields
  const openEditProfile = () => {
    setEditName(userData?.name || '');
    setEditBio(userData?.bio || '');
    setEditPic(null);
    setShowModal(true);
  };

  // Handle setting active badge
  const handleSetActiveBadge = async (badgeKey) => {
    setSelectedBadge(badgeKey);
    
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/user/active-badge`, {
        method: 'POST',
        headers: {
          'Authorization': sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ badge_key: badgeKey })
      });

      if (res.ok) {
        const data = await res.json();
        toast.show(data.message);
        
        // Update user data with new active badge
        if (refreshUserData) {
          refreshUserData();
        }
      } else {
        const error = await res.json();
        toast.show(error.detail || 'Failed to update badge');
      }
    } catch (err) {
      console.error('Error setting badge:', err);
      toast.show('Error updating badge');
    }
  };

  // Save profile changes
  const handleSave = async (e) => {
    e.preventDefault();
    
    // Save profile data
    const formData = new FormData();
    formData.append('name', editName.trim());
    formData.append('bio', editBio);
    if (editPic) formData.append('profile_pic', editPic);

    const res = await fetch(`${window.API_BASE_URL}/api/update-profile`, {
      method: 'POST',
        headers: { 'Authorization': sessionToken },
      body: formData
    });

    const data = await res.json();
    
    if (res.ok) {
      // Also update the active badge if changed
      if (selectedBadge !== userData?.active_badge) {
        await handleSetActiveBadge(selectedBadge);
      }
      
      toast.show(data.message || data.detail);
      setShowModal(false);
      await refreshUserData();
    } else {
      toast.show(data.message || data.detail);
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
          setUserError(t('common.user_not_found'));
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
      {/* Badge Award Modal */}
      {showBadgeModal && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={() => setShowBadgeModal(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                animation: 'slideUp 0.3s ease-out',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ color: '#111', margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
                  {t('profile.congratulations', 'Congratulations!')}
                </h2>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#666', fontSize: '1rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  {t('profile.earned_badge', 'You have earned a new achievement!')}
                </p>
                
                {/* Display each newly awarded badge */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {newlyAwardedBadges.map(badgeKey => {
                    const badgeData = userData?.badges?.[badgeKey];
                    if (!badgeData) return null;
                    return (
                      <div
                        key={badgeKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1rem',
                          background: '#f9f9f9',
                          borderRadius: '0.75rem',
                          border: '2px solid #e9ecef',
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            background: getBadgeColorProfile(badgeKey),
                            color: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {getBadgeEmojiProfile(badgeKey)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', marginBottom: '0.25rem' }}>
                            {badgeData.name}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            {badgeData.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setShowBadgeModal(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  background: '#111',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={e => e.target.style.background = '#333'}
                onMouseOut={e => e.target.style.background = '#111'}
              >
                {t('profile.awesome', 'Awesome!')}
              </button>
            </div>
            
            <style>{`
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        </ModalPortal>
      )}

      {/* Badge Selector Modal */}
      {showBadgeSelector && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
            onClick={() => setShowBadgeSelector(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ color: '#111', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
                {t('profile.select_badge', 'Select Display Badge')}
              </h2>

              {/* No badge option */}
              <div
                onClick={() => handleSetActiveBadge(null)}
                style={{
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: selectedBadge === null ? '#f0f0f0' : '#fafafa',
                  border: selectedBadge === null ? '2px solid #111' : '2px solid #e0e0e0',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.background = selectedBadge === null ? '#f0f0f0' : '#f5f5f5'}
                onMouseOut={e => e.currentTarget.style.background = selectedBadge === null ? '#f0f0f0' : '#fafafa'}
              >
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111' }}>
                  {t('profile.no_badge', 'No Badge')}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                  {t('profile.no_badge_desc', 'Don\'t display any badge')}
                </div>
              </div>

              {/* Badge options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {userData?.badges && Object.entries(userData.badges).map(([badgeKey, badgeData]) => (
                  <div
                    key={badgeKey}
                    onClick={() => handleSetActiveBadge(badgeKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: selectedBadge === badgeKey ? '#f0f0f0' : '#fafafa',
                      border: selectedBadge === badgeKey ? '2px solid #111' : '2px solid #e0e0e0',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = selectedBadge === badgeKey ? '#f0f0f0' : '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = selectedBadge === badgeKey ? '#f0f0f0' : '#fafafa'}
                  >
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        background: getBadgeColorProfile(badgeKey),
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {getBadgeEmojiProfile(badgeKey)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111' }}>
                        {badgeData.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                        {badgeData.description}
                      </div>
                    </div>
                    {selectedBadge === badgeKey && (
                      <div style={{ color: '#111', fontSize: '1.2rem' }}>
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowBadgeSelector(false)}
                style={{
                  width: '100%',
                  marginTop: '1.5rem',
                  padding: '0.75rem 1.5rem',
                  background: '#111',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={e => e.target.style.background = '#333'}
                onMouseOut={e => e.target.style.background = '#111'}
              >
                {t('common.done', 'Done')}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      <div
        className="flex-grow-1 d-flex flex-column align-items-center"
        style={{
          padding: '2rem 1rem',
          width: '100%',
          maxWidth: 1400,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Minimal top-right settings gear for own profile */}
        {isOwnProfile && (
          <button
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title={t('profile.settings') || 'Settings'}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              border: 'none',
              background: 'transparent',
              padding: 10,
              cursor: 'pointer',
              color: '#111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              borderRadius: 8,
              zIndex: 10,
            }}
          >
            <i className="bi bi-gear" style={{ fontSize: 26, lineHeight: 1 }}></i>
          </button>
        )}
        <div
          className="w-100 mb-3"
          style={{
            borderRadius: 16,
            padding: '18px 20px',
          }}
        >
          <div
            className="d-flex flex-wrap align-items-start"
            style={{ rowGap: 14, columnGap: 18 }}
          >
            <AvatarFrame badge={displayUser?.active_badge} size={104}>
              <img
                src={displayUser.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${displayUser.profile_pic.replace(/^\//, '')}` : defaultAvatar}
                alt={t('profile.alt_profile')}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AvatarFrame>

            <div style={{ flex: '1 1 340px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                <h2 style={{ color: '#111', fontWeight: 800, fontSize: '1.5rem', marginBottom: 0 }}>{displayUser.name}</h2>
              </div>
              <p className="mb-0" style={{ fontSize: '1.02rem', lineHeight: 1.5, maxWidth: 640, whiteSpace: 'pre-line', color: '#3a3a3a' }}>
                {displayUser.bio && displayUser.bio.trim()
                  ? displayUser.bio
                  : (isOwnProfile
                      ? t('profile.bio_prompt')
                      : t('profile.bio_not_set'))}
              </p>
              {isOwnProfile && (
                <div style={{ marginTop: 6 }}>
                  <ButtonRounded onClick={openEditProfile} style={{ padding: '0.5rem 1rem', fontSize: '0.95rem', width: 'fit-content' }}>
                    <i className="bi bi-pencil"></i> {t('profile.edit_profile')}
                  </ButtonRounded>
                </div>
              )}
            </div>

            <div style={{ flex: '0 0 240px', minWidth: 220 }}>
              <div className="d-flex flex-column" style={{ gap: 10 }}>
                <div
                  className="d-flex align-items-center justify-content-start flex-wrap"
                  style={{ gap: 12, fontSize: '0.96rem', color: '#222' }}
                >
                  <span
                    className="d-flex align-items-center gap-2"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  >
                    <i className="bi bi-chat" style={{ fontSize: '1.05rem' }}></i>
                    <div className="d-flex flex-column" style={{ lineHeight: 1.15 }}>
                      <strong style={{ fontSize: '1.05rem' }}>{totalChats.toLocaleString()}</strong>
                      <span style={{ fontSize: '0.83rem', color: '#555' }}>{t('profile.total_chats') || 'total chats'}</span>
                    </div>
                  </span>
                  <span
                    className="d-flex align-items-center gap-2"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  >
                    <i className="bi bi-heart" style={{ fontSize: '1.05rem' }}></i>
                    <div className="d-flex flex-column" style={{ lineHeight: 1.15 }}>
                      <strong style={{ fontSize: '1.05rem' }}>{totalLikes.toLocaleString()}</strong>
                      <span style={{ fontSize: '0.83rem', color: '#555' }}>{t('profile.total_likes') || 'total likes'}</span>
                    </div>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Level & EXP Progress below header row */}
          <div className="mt-3">
            {typeof displayUser?.level !== 'undefined' && typeof displayUser?.exp !== 'undefined' && (
              <LevelProgress level={displayUser.level} exp={displayUser.exp} />
            )}
          </div>
          
          {/* Badges Section */}
          {displayUser?.badges && Object.keys(displayUser.badges).length > 0 && (
            <div className="mt-3">
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111' }}>
                {t('profile.badges', 'Badges')}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {Object.entries(displayUser.badges).map(([badgeKey, badgeData]) => (
                  <div
                    key={badgeKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#f5f5f5',
                      borderRadius: '0.5rem',
                      border: '1px solid #ddd',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title={badgeData.description}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        background: getBadgeColorProfile(badgeKey),
                        color: '#fff',
                      }}
                    >
                      {getBadgeEmojiProfile(badgeKey)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111' }}>
                        {badgeData.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        {badgeData.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="d-flex flex-column w-100" style={{ gap: 24 }}>
          {/* Tabs for navigation */}
          <div className="d-flex w-100" style={{ borderBottom: '2px solid #111', paddingBottom: 8 }}>
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
          <div className="d-flex w-100" style={{ borderBottom: '1.5px solid #aaa', paddingBottom: 4, marginTop: 8, gap: 8 }}>
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

      {/* Profile Edit Modal - rendered into <main> via portal so it overlays the content area only */}
      {showModal && isOwnProfile && (
        <ModalPortal>
          <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', boxSizing: 'border-box', paddingTop: '2rem' }}>
            <div className="modal-dialog mx-auto" style={{ margin: 0, maxWidth: 420, width: '100%' }}>
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
                    <label className="form-label fw-bold" style={{ color: '#111' }}>{t('profile.short_bio')} <span style={{ fontWeight: 400, fontSize: '0.9em', color: '#888' }}>{t('profile.optional')}</span></label>
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
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '2px solid #e9ecef', background: '#fff' }}>
                        <img src={editPicPreview || (userData?.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}` : defaultAvatar)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="file"
                          className="form-control"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                            if (f) {
                              setRawSelectedFile(f);
                              setShowCrop(true);
                            }
                          }}
                          style={{ background: '#fff', border: '1.5px solid #111', color: '#111' }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Badge Selection */}
                  {userData?.badges && Object.keys(userData.badges).length > 0 && (
                    <div className="mb-3">
                      <label className="form-label fw-bold" style={{ color: '#111' }}>
                        {t('profile.display_badge', 'Display Badge')}
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* No badge option */}
                        <div
                          onClick={() => setSelectedBadge(null)}
                          style={{
                            padding: '0.75rem',
                            background: selectedBadge === null ? '#f0f0f0' : '#fff',
                            border: selectedBadge === null ? '2px solid #111' : '1.5px solid #ddd',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ fontSize: '0.9rem', color: '#111' }}>
                            {t('profile.no_badge', 'No Badge')}
                          </span>
                          {selectedBadge === null && <span style={{ color: '#111' }}>✓</span>}
                        </div>
                        
                        {/* Badge options */}
                        {Object.entries(userData.badges).map(([badgeKey, badgeData]) => (
                          <div
                            key={badgeKey}
                            onClick={() => setSelectedBadge(badgeKey)}
                            style={{
                              padding: '0.75rem',
                              background: selectedBadge === badgeKey ? '#f0f0f0' : '#fff',
                              border: selectedBadge === badgeKey ? '2px solid #111' : '1.5px solid #ddd',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                background: getBadgeColorProfile(badgeKey),
                                color: '#fff',
                                flexShrink: 0,
                              }}
                            >
                              {getBadgeEmojiProfile(badgeKey)}
                            </div>
                            <span style={{ fontSize: '0.9rem', color: '#111', flex: 1 }}>
                              {badgeData.name}
                            </span>
                            {selectedBadge === badgeKey && <span style={{ color: '#111' }}>✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer" style={{ borderTop: '2px solid #111', background: '#fff' }}>
                  <PrimaryButton type="submit">
                    {t('profile.save')}
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => setShowModal(false)}
                  >
                    {t('profile.cancel')}
                  </SecondaryButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {showCrop && rawSelectedFile && (
        <ModalPortal>
          <ImageCropModal
            srcFile={rawSelectedFile}
            onCancel={() => { setShowCrop(false); setRawSelectedFile(null); }}
            onSave={({ file, dataUrl }) => {
              setEditPic(file);
              setEditPicPreview(dataUrl);
              setShowCrop(false);
              setRawSelectedFile(null);
            }}
            size={96}
          />
        </ModalPortal>
      )}


    </PageWrapper>
  );
}

// ModalPortal component renders children into the <main> element or document.body
function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  const main = document.querySelector('main');
  return createPortal(children, main || document.body);
}

// Helper function to get badge color for profile page
function getBadgeColorProfile(badgeKey) {
  const colors = {
    pioneer: '#FF6B6B',        // Red for Pioneer
    bronze_creator: '#CD7F32',  // Bronze
    silver_creator: '#C0C0C0',  // Silver
    gold_creator: '#FFD700',    // Gold
  };
  return colors[badgeKey] || '#999';
}

// Helper function to get badge emoji/symbol for profile page
function getBadgeEmojiProfile(badgeKey) {
  const emojis = {
    pioneer: '⭐',
    bronze_creator: '1K+',
    silver_creator: '🥈',
    gold_creator: '🥇',
  };
  return emojis[badgeKey] || '✓';
}

// Helper function to get badge background color for text badge
function getBadgeBackgroundColor(badgeKey) {
  const colors = {
    pioneer: '#FF6B6B',
    bronze_creator: '#CD7F32',
    silver_creator: '#C0C0C0',
    gold_creator: '#FFD700',
  };
  return colors[badgeKey] || '#999';
}

// Exporting ModalPortal isn't necessary; it is used internally by ProfilePage via JSX