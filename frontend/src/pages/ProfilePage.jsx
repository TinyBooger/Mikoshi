import React, { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import defaultAvatar from '../assets/images/default-avatar.png';
import ImageCropModal from '../components/ImageCropModal';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';

import EntityCard from '../components/EntityCard';
import CardSection from '../components/CardSection';
import PaginationBar from '../components/PaginationBar';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import { getApiErrorMessage } from '../utils/apiErrorUtils';
import { formatCompactTokenCount } from '../utils/tokenDisplay';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
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
  const ENTITY_SORTS = {
    RECENT: 'recent',
    POPULAR: 'popular',
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
  const [characterSort, setCharacterSort] = useState(ENTITY_SORTS.RECENT);
  const [sceneSort, setSceneSort] = useState(ENTITY_SORTS.RECENT);
  const [personaSort, setPersonaSort] = useState(ENTITY_SORTS.RECENT);
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
  
  const [showProBenefits, setShowProBenefits] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep own-profile stats (including monthly token usage) fresh when returning to this page.
  useEffect(() => {
    if (!isOwnProfile || !refreshUserData) return;

    refreshUserData({ silent: true });

    const handleFocus = () => {
      refreshUserData({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUserData({ silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOwnProfile, refreshUserData]);

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
    fetch(`${window.API_BASE_URL}/api/characters-created${userIdParam}${userIdParam ? '&' : '?'}sort=${characterSort}&page=${createdCharactersPage}&page_size=${pageSize}`, {
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
    fetch(`${window.API_BASE_URL}/api/scenes-created${userIdParam}${userIdParam ? '&' : '?'}sort=${sceneSort}&page=${scenesPage}&page_size=${pageSize}`, {
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
    fetch(`${window.API_BASE_URL}/api/personas-created${userIdParam}${userIdParam ? '&' : '?'}sort=${personaSort}&page=${personasPage}&page_size=${pageSize}`, {
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
      fetch(`${window.API_BASE_URL}/api/characters-liked?sort=${characterSort}&page=${likedCharactersPage}&page_size=${pageSize}`, {
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
      fetch(`${window.API_BASE_URL}/api/scenes-liked?sort=${sceneSort}&page=${likedScenesPage}&page_size=${pageSize}`, {
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
      fetch(`${window.API_BASE_URL}/api/personas-liked?sort=${personaSort}&page=${likedPersonasPage}&page_size=${pageSize}`, {
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
  }, [navigate, sessionToken, userData, profileUserId, isOwnProfile, createdCharactersPage, likedCharactersPage, scenesPage, likedScenesPage, personasPage, likedPersonasPage, characterSort, sceneSort, personaSort]);

  useEffect(() => {
    setCreatedCharactersPage(1);
    setLikedCharactersPage(1);
  }, [characterSort]);

  useEffect(() => {
    setScenesPage(1);
    setLikedScenesPage(1);
  }, [sceneSort]);

  useEffect(() => {
    setPersonasPage(1);
    setLikedPersonasPage(1);
  }, [personaSort]);

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
    const renderEntityCardSection = (entities, type, showEdit, editUrlPrefix, emptyMsg, page, total, onPageChange) => (
      <>
        <CardSection>
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
                  <EntityCard
                    type={type}
                    entity={entity}
                    hideDetailButton={true}
                  />
                  {showEdit && (
                    <button
                      type="button"
                      onClick={() => navigate(`/${editUrlPrefix}/edit/${entity.id}`)}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#7c3aed'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        width: 'fit-content',
                        margin: '0 auto',
                        padding: '0.3rem 0',
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'color 0.18s ease',
                      }}
                    >
                      <i className="bi bi-pencil" style={{ fontSize: '0.75rem' }}></i>
                      {t('profile.edit')}
                    </button>
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
        emptyMsg = t('profile.no_characters_created');
        page = createdCharactersPage;
        total = createdCharactersTotal;
        onPageChange = setCreatedCharactersPage;
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = scenes;
        type = 'scene';
        showEdit = isOwnProfile;
        editUrlPrefix = 'scene';
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
        emptyMsg = t('profile.no_liked_characters');
        page = likedCharactersPage;
        total = likedCharactersTotal;
        onPageChange = setLikedCharactersPage;
      } else if (activeSubtab === SUBTAB_TYPES.SCENES) {
        entities = likedScenes;
        type = 'scene';
        showEdit = false;
        editUrlPrefix = 'scene';
        emptyMsg = t('profile.no_liked_scenes');
        page = likedScenesPage;
        total = likedScenesTotal;
        onPageChange = setLikedScenesPage;
      } else if (activeSubtab === SUBTAB_TYPES.PERSONAS) {
        entities = likedPersonas;
        type = 'persona';
        showEdit = false;
        editUrlPrefix = 'persona';
        emptyMsg = t('profile.no_liked_personas');
        page = likedPersonasPage;
        total = likedPersonasTotal;
        onPageChange = setLikedPersonasPage;
      }
    }
    return renderEntityCardSection(entities, type, showEdit, editUrlPrefix, emptyMsg, page, total, onPageChange);
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
      toast.show(data.message || data.detail);
      setShowModal(false);
      await refreshUserData();
    } else {
      toast.show(getApiErrorMessage(data, t('profile.update_failed'), t));
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
  const isActivePro = Boolean(displayUser?.pro_active);
  const activeLocale = i18n?.resolvedLanguage || i18n?.language;
  const formattedProExpireDate = displayUser?.pro_expire_date
    ? new Date(displayUser.pro_expire_date).toLocaleDateString(activeLocale)
    : null;
  const tokenScope = displayUser?.token_cap_scope;
  const tokenUsed = Number(tokenScope === 'monthly' ? displayUser?.monthly_token_usage : displayUser?.daily_token_usage) || 0;
  const tokenCap = Number(displayUser?.token_cap || 0);
  const tokenUsageValue = tokenCap > 0
    ? `${formatCompactTokenCount(tokenUsed)} / ${formatCompactTokenCount(tokenCap)}`
    : formatCompactTokenCount(tokenUsed);
  const tokenProgressPercent = tokenCap > 0
    ? Math.min(100, Math.max(0, (tokenUsed / tokenCap) * 100))
    : 0;
  const tokenProgressLabel = `${tokenProgressPercent.toFixed(1)}%`;
  const nextTokenResetDate = displayUser?.token_reset_at ? new Date(displayUser.token_reset_at) : null;
  const formattedNextTokenResetDate = nextTokenResetDate ? nextTokenResetDate.toLocaleDateString(activeLocale) : null;
  const proExpireDateObj = displayUser?.pro_expire_date ? new Date(displayUser.pro_expire_date) : null;
  const isProDueBeforeNextReset = Boolean(proExpireDateObj && nextTokenResetDate && proExpireDateObj <= nextTokenResetDate);
  const tokenNoticeText = !isActivePro
    ? t('profile.token_resets_daily')
    : isProDueBeforeNextReset
    ? t('profile.pro_due_no_token_reset_notice', {
      date: formattedProExpireDate,
    })
    : t('profile.next_token_reset_notice', {
      date: formattedNextTokenResetDate,
    });

  useEffect(() => {
    setShowProBenefits(false);
  }, [displayUser?.id, isActivePro]);

  const activeSort = activeSubtab === SUBTAB_TYPES.CHARACTERS
    ? characterSort
    : activeSubtab === SUBTAB_TYPES.SCENES
    ? sceneSort
    : personaSort;

  const setActiveSort = (sortValue) => {
    if (activeSubtab === SUBTAB_TYPES.CHARACTERS) {
      setCharacterSort(sortValue);
      return;
    }
    if (activeSubtab === SUBTAB_TYPES.SCENES) {
      setSceneSort(sortValue);
      return;
    }
    setPersonaSort(sortValue);
  };

  const sortToggleTranslatePercent = activeSort === ENTITY_SORTS.RECENT ? 0 : 100;
  const subtabPillIndex = activeSubtab === SUBTAB_TYPES.CHARACTERS ? 0 : activeSubtab === SUBTAB_TYPES.SCENES ? 1 : 2;

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
            aria-label={t('profile.settings')}
            title={t('profile.settings')}
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
            <img
              src={displayUser.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${displayUser.profile_pic.replace(/^\//, '')}` : defaultAvatar}
              alt={t('profile.alt_profile')}
              style={{ width: isMobile ? 72 : 104, height: isMobile ? 72 : 104, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }}
            />

            <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 10 }}>
                <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                  <h2
                    style={{
                      color: isActivePro ? '#6f42c1' : '#111',
                      fontWeight: 800,
                      fontSize: isMobile ? '1.2rem' : '1.5rem',
                      marginBottom: 0,
                    }}
                  >
                    {displayUser.name}
                  </h2>
                  {isActivePro && (
                    <span
                      className="fw-bold"
                      style={{
                        position: 'relative',
                        fontSize: '0.62rem',
                        lineHeight: 1,
                        padding: '0.2rem 0.36rem',
                        borderRadius: '999px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        flexShrink: 0,
                        cursor: 'default',
                      }}
                      title={formattedProExpireDate
                        ? `${t('profile.pro_remaining_date')}: ${formattedProExpireDate}`
                        : t('profile.pro_no_expire_date')}
                    >
                      PRO
                    </span>
                  )}
                </div>

              </div>

              <p className="mb-0" style={{ fontSize: isMobile ? '0.88rem' : '1.02rem', lineHeight: 1.5, maxWidth: 640, whiteSpace: 'pre-line', color: '#3a3a3a' }}>
                {displayUser.bio && displayUser.bio.trim()
                  ? displayUser.bio
                  : (isOwnProfile
                      ? t('profile.bio_prompt')
                      : t('profile.bio_not_set'))}
              </p>
              {isOwnProfile && (
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={openEditProfile}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(167, 139, 250, 0.25)';
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(167, 139, 250, 0.3), inset 0 1px 0 rgba(255,255,255,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(167, 139, 250, 0.15)';
                      e.currentTarget.style.boxShadow = '0 10px 24px rgba(111,66,193,0.08), inset 0 1px 0 rgba(255,255,255,0.35)';
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      padding: '0.68rem 1.2rem',
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.48)',
                      background: 'rgba(167, 139, 250, 0.15)',
                      color: '#6f42c1',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      letterSpacing: '0.01em',
                      boxShadow: '0 10px 24px rgba(111,66,193,0.08), inset 0 1px 0 rgba(255,255,255,0.35)',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      transition: 'background 0.2s ease, box-shadow 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{t('profile.edit_profile')}</span>
                    <i
                      className="bi bi-pencil"
                      aria-hidden="true"
                      style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0, opacity: 0.9 }}
                    ></i>
                  </button>
                </div>
              )}

              {!isMobile && (
              <div style={{ marginTop: 12, width: '100%', maxWidth: 640 }}>
                <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#5b2f9b' }}>
                    {tokenProgressLabel}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700 }}>
                    {tokenNoticeText}
                  </span>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: 'rgba(167, 139, 250, 0.16)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${tokenProgressPercent}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)',
                      transition: 'width 0.25s ease',
                    }}
                  ></div>
                </div>
              </div>
              )}
            </div>

            {isMobile && (
              <div style={{ flex: '1 1 100%', width: '100%', marginTop: 2 }}>
                <div style={{ width: '100%', maxWidth: '100%' }}>
                  <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#5b2f9b' }}>
                      {tokenProgressLabel}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700 }}>
                      {tokenNoticeText}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: 'rgba(167, 139, 250, 0.16)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${tokenProgressPercent}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)',
                        transition: 'width 0.25s ease',
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                flex: isMobile ? '1 1 100%' : '0 1 300px',
                minWidth: isMobile ? 0 : 240,
                marginLeft: isMobile ? 0 : 'auto',
                marginRight: isMobile ? 0 : '5rem',
                alignSelf: 'flex-start',
                display: 'flex',
                justifyContent: isMobile ? 'stretch' : 'flex-end',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: isMobile ? '100%' : 300,
                  padding: isMobile ? '0.7rem 0.85rem' : '1rem 1.05rem',
                  borderRadius: 22,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.12))',
                  border: '1px solid rgba(255,255,255,0.45)',
                  boxShadow: '0 20px 40px rgba(17,17,17,0.08), inset 0 1px 0 rgba(255,255,255,0.45)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems: isMobile ? 'center' : 'stretch',
                  gap: isMobile ? 0 : 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: isMobile ? 1 : undefined }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>
                      {t('profile.total_chats')}
                    </div>
                    <div style={{ fontSize: isMobile ? '1.3rem' : '1.8rem', lineHeight: 1, fontWeight: 800, color: '#111', marginTop: 4 }}>
                      {totalChats.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      width: isMobile ? 34 : 44,
                      height: isMobile ? 34 : 44,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.28)',
                      border: '1px solid rgba(255,255,255,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#111',
                      flexShrink: 0,
                    }}
                  >
                    <i className="bi bi-chat-dots" style={{ fontSize: isMobile ? '0.9rem' : '1.15rem' }}></i>
                  </div>
                </div>

                <div style={isMobile
                  ? { width: 1, alignSelf: 'stretch', margin: '0 12px', background: 'linear-gradient(180deg, rgba(17,17,17,0.08), rgba(255,255,255,0.55), rgba(17,17,17,0.08))' }
                  : { height: 1, background: 'linear-gradient(90deg, rgba(17,17,17,0.08), rgba(255,255,255,0.55), rgba(17,17,17,0.08))' }
                }></div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: isMobile ? 1 : undefined }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>
                      {t('profile.total_likes')}
                    </div>
                    <div style={{ fontSize: isMobile ? '1.3rem' : '1.8rem', lineHeight: 1, fontWeight: 800, color: '#111', marginTop: 4 }}>
                      {totalLikes.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      width: isMobile ? 34 : 44,
                      height: isMobile ? 34 : 44,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.28)',
                      border: '1px solid rgba(255,255,255,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#111',
                      flexShrink: 0,
                    }}
                  >
                    <i className="bi bi-heart" style={{ fontSize: isMobile ? '0.9rem' : '1.15rem' }}></i>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-column w-100" style={{ gap: isMobile ? 3 : 10 }}>
          {/* Tabs for navigation */}
          <div className="d-flex w-100" style={{ borderBottom: '1px solid #e8e7f2', paddingBottom: 2, gap: 18 }}>
            <button
              className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.CREATED ? '' : ''}`}
              style={{
                background: 'transparent',
                color: activeTab === TAB_TYPES.CREATED ? '#2f2447' : '#6f6b80',
                fontWeight: activeTab === TAB_TYPES.CREATED ? 800 : 700,
                borderRadius: 0,
                border: 'none',
                boxShadow: activeTab === TAB_TYPES.CREATED ? 'inset 0 -2px 0 #b59cf3' : 'inset 0 -2px 0 transparent',
                padding: '0.6rem 0.4rem',
                transition: 'color 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={() => { setActiveTab(TAB_TYPES.CREATED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); }}
            >
              {t('profile.created')}
            </button>
            {isOwnProfile && (
              <button
                className={`flex-fill fw-bold py-2 border-0 ${activeTab === TAB_TYPES.LIKED ? '' : ''}`}
                style={{
                  background: 'transparent',
                  color: activeTab === TAB_TYPES.LIKED ? '#2f2447' : '#6f6b80',
                  fontWeight: activeTab === TAB_TYPES.LIKED ? 800 : 700,
                  borderRadius: 0,
                  border: 'none',
                  boxShadow: activeTab === TAB_TYPES.LIKED ? 'inset 0 -2px 0 #b59cf3' : 'inset 0 -2px 0 transparent',
                  padding: '0.6rem 0.4rem',
                  transition: 'color 0.2s ease, box-shadow 0.2s ease',
                }}
                onClick={() => { setActiveTab(TAB_TYPES.LIKED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); }}
              >
                {t('profile.liked')}
              </button>
            )}
          </div>
          {/* Subtabs for Created/Liked */}
          {(
          <div className="d-flex w-100 align-items-center" style={{ borderBottom: '1px solid #e8e7f2', paddingBottom: isMobile ? 8 : 10, marginTop: 10, columnGap: isMobile ? 10 : 14, flexWrap: 'nowrap', overflowX: isMobile ? 'auto' : 'visible', justifyContent: isMobile ? 'flex-start' : 'space-between' }}>
            <div
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                alignItems: 'center',
                flexShrink: 0,
                minWidth: isMobile ? 220 : 300,
                borderRadius: 14,
                padding: 4,
                background: 'rgba(255, 255, 255, 0.42)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                boxShadow: '0 10px 28px rgba(114, 124, 150, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                overflow: 'hidden',
              }}
            >
              {/* sliding pill */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 4,
                  top: 4,
                  bottom: 4,
                  width: 'calc((100% - 8px) / 3)',
                  borderRadius: 10,
                  background: 'linear-gradient(180deg, #f3eef9 0%, #ebe5f1 100%)',
                  boxShadow: '0 8px 18px rgba(124, 109, 158, 0.2), inset 0 1px 0 rgba(255,255,255,0.82), inset 0 -1px 2px rgba(124,109,158,0.06)',
                  transform: `translateX(${subtabPillIndex * 100}%)`,
                  transition: 'transform 220ms cubic-bezier(0.35, 0, 0.25, 1)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              {[
                { key: SUBTAB_TYPES.CHARACTERS, label: t('profile.characters') },
                { key: SUBTAB_TYPES.SCENES,     label: t('profile.scenes') },
                { key: SUBTAB_TYPES.PERSONAS,   label: t('profile.personas') },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className="border-0"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    background: 'transparent',
                    color: activeSubtab === tab.key ? '#5C5178' : '#7a748a',
                    borderRadius: 10,
                    fontSize: isMobile ? '0.82rem' : '0.9rem',
                    padding: isMobile ? '0.38rem 0.45rem' : '0.46rem 0.6rem',
                    fontWeight: activeSubtab === tab.key ? 700 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'color 180ms ease',
                  }}
                  onClick={() => setActiveSubtab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="d-flex align-items-center" style={{ gap: 8, flexWrap: 'nowrap', justifyContent: 'flex-end', flexShrink: 0, marginLeft: isMobile ? 2 : 'auto' }}>
              {!isMobile && (
                <span
                title={t('browse.sort_by')}
                aria-label={t('browse.sort_by')}
                style={{ color: '#555', fontSize: isMobile ? '0.78rem' : '0.84rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                <i className="bi bi-sort-down" aria-hidden="true" style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1 }}></i>
                <span className="visually-hidden">{t('browse.sort_by')}</span>
              </span>
              )}
              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  alignItems: 'center',
                  minWidth: isMobile ? 124 : 148,
                  borderRadius: 8,
                  padding: 2,
                  background: 'rgba(0,0,0,0.06)',
                  flexShrink: 0,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: 2,
                    bottom: 2,
                    width: 'calc((100% - 4px) / 2)',
                    borderRadius: 6,
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    transform: `translateX(${sortToggleTranslatePercent}%)`,
                    transition: 'transform 200ms ease',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                ></div>
                <button
                  type="button"
                  className="border-0"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    background: 'transparent',
                    color: activeSort === ENTITY_SORTS.RECENT ? '#2f2447' : '#9088a4',
                    borderRadius: 6,
                    fontSize: isMobile ? '0.79rem' : '0.86rem',
                    fontWeight: activeSort === ENTITY_SORTS.RECENT ? 700 : 500,
                    padding: isMobile ? '0.28rem 0.5rem' : '0.32rem 0.65rem',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.18s ease, font-weight 0.18s ease',
                  }}
                  onClick={() => setActiveSort(ENTITY_SORTS.RECENT)}
                >
                  {t('browse.recent')}
                </button>
                <button
                  type="button"
                  className="border-0"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    background: 'transparent',
                    color: activeSort === ENTITY_SORTS.POPULAR ? '#2f2447' : '#9088a4',
                    borderRadius: 6,
                    fontSize: isMobile ? '0.79rem' : '0.86rem',
                    fontWeight: activeSort === ENTITY_SORTS.POPULAR ? 700 : 500,
                    padding: isMobile ? '0.28rem 0.5rem' : '0.32rem 0.65rem',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.18s ease, font-weight 0.18s ease',
                  }}
                  onClick={() => setActiveSort(ENTITY_SORTS.POPULAR)}
                >
                  {t('browse.popular')}
                </button>
              </div>
            </div>
          </div>
          )}
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
                        <img src={editPicPreview || (userData?.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}` : defaultAvatar)} alt={t('profile.preview_image')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                            // Reset so selecting the same file again still fires onChange.
                            e.target.value = '';
                          }}
                          style={{ background: '#fff', border: '1.5px solid #111', color: '#111' }}
                        />
                      </div>
                    </div>
                  </div>
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