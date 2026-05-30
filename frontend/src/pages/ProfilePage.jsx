import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
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
import ProblemReportModal from '../components/ProblemReportModal';
import { getApiErrorMessage } from '../utils/apiErrorUtils';
import { formatCompactTokenCount } from '../utils/tokenDisplay';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked',
    MY_PERSONAS: 'MyPersonas',
    CHAT_HISTORY: 'ChatHistory',
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
  const [createdExpanded, setCreatedExpanded] = useState(true);
  const [likedExpanded, setLikedExpanded] = useState(false);
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

  // Chat history tab state (own profile only)
  const [chatHistoryItems, setChatHistoryItems] = useState([]);
  const [chatHistoryPage, setChatHistoryPage] = useState(1);
  const [chatHistoryTotal, setChatHistoryTotal] = useState(0);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [clearingUnavailable, setClearingUnavailable] = useState(false);
  const pageSize = 20;

  // Total stats for all created characters
  const [totalChats, setTotalChats] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  // Animated display values for stats
  const [displayChats, setDisplayChats] = useState(0);
  const [displayLikes, setDisplayLikes] = useState(0);
  const chatsAnimRef = useRef(null);
  const likesAnimRef = useRef(null);

  // Session delta: value + animation trigger key (incrementing key remounts element → replays animation)
  const [sessionDeltaChats, setSessionDeltaChats] = useState(0);
  const [sessionDeltaLikes, setSessionDeltaLikes] = useState(0);
  const [deltaChatKey, setDeltaChatKey] = useState(0);
  const [deltaLikeKey, setDeltaLikeKey] = useState(0);
  const [sproutHearts, setSproutHearts] = useState([]);

  // Generate a burst of 3–5 hearts spreading outward whenever likes increase
  useEffect(() => {
    if (deltaLikeKey === 0) {
      setSproutHearts([]);
      return;
    }
    // Use the number of likes received in this session as the number of hearts
    let count = Math.max(1, sessionDeltaLikes);
    count = Math.min(count, 60);
    // Delay per heart: more hearts = less delay, fewer hearts = more delay
    // Range: 0.08s (many) to 0.18s (few)
    const minDelay = 0.08, maxDelay = 0.18;
    const delayPerHeart = count > 1 ? (maxDelay - minDelay) / Math.max(1, count - 1) + minDelay : minDelay;
    // Generate random directions (angles) and shuffle for more randomness
    const angles = Array.from({ length: count }, () => Math.random() * 360);
    // Optionally, shuffle the angles array for even more randomness (Fisher-Yates)
    for (let i = angles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [angles[i], angles[j]] = [angles[j], angles[i]];
    }
    const minDist = 44, maxDist = 80;
    const hearts = Array.from({ length: count }, (_, i) => {
      const angleRad = angles[i] * (Math.PI / 180);
      const dist = minDist + Math.random() * (maxDist - minDist) * (count < 20 ? 1 : 0.7);
      return {
        id: i,
        tx: Math.cos(angleRad) * dist,
        ty: Math.sin(angleRad) * dist,
        delay: i * delayPerHeart,
      };
    });
    setSproutHearts(hearts);
  }, [deltaLikeKey]);

  const [showProBenefits, setShowProBenefits] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showReportUser, setShowReportUser] = useState(false);
  const [reportIconHovered, setReportIconHovered] = useState(false);
  const [followCounts, setFollowCounts] = useState({ following_count: 0, follower_count: 0 });
  const [followModal, setFollowModal] = useState(null); // 'following' | 'followers' | null
  const [followModalUsers, setFollowModalUsers] = useState([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch follow status when viewing another user's profile
  useEffect(() => {
    if (isOwnProfile || !sessionToken || !profileUserId) return;
    fetch(`${window.API_BASE_URL}/api/users/me/following-ids`, {
      headers: { Authorization: sessionToken },
    })
      .then(res => res.json())
      .then(data => setIsFollowing((data.following_ids || []).includes(profileUserId)))
      .catch(() => {});
  }, [isOwnProfile, sessionToken, profileUserId]);

  const handleFollowToggle = async () => {
    if (!sessionToken || !profileUserId || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${window.API_BASE_URL}/api/users/${profileUserId}/follow`, {
        method,
        headers: { Authorization: sessionToken },
      });
      if (res.ok) {
        setIsFollowing(f => !f);
        setFollowCounts(c => ({
          ...c,
          follower_count: c.follower_count + (isFollowing ? -1 : 1),
        }));
      }
    } catch { /* ignore */ } finally {
      setFollowLoading(false);
    }
  };

  // Fetch follow counts for the profile being viewed
  useEffect(() => {
    const targetId = profileUserId || userData?.id;
    if (!targetId) return;
    fetch(`${window.API_BASE_URL}/api/users/${targetId}/follow-counts`)
      .then(res => res.json())
      .then(data => setFollowCounts(data))
      .catch(() => {});
  }, [profileUserId, userData?.id]);

  const openFollowModal = async (type) => {
    const targetId = profileUserId || userData?.id;
    if (!targetId) return;
    setFollowModal(type);
    setFollowModalUsers([]);
    setFollowModalLoading(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/users/${targetId}/${type}`);
      const data = await res.json();
      setFollowModalUsers(data.items || []);
    } catch { /* ignore */ } finally {
      setFollowModalLoading(false);
    }
  };

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
      // Reset immediately so the guard catches it while the fetch is in-flight
      setPublicUserData(null);
      setUserLoading(true);
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

  // Fetch chat history when own-profile tab is active
  useEffect(() => {
    if (!isOwnProfile || activeTab !== TAB_TYPES.CHAT_HISTORY || !sessionToken) return;
    setChatHistoryLoading(true);
    fetch(`${window.API_BASE_URL}/api/chat/history-by-character?page=${chatHistoryPage}&page_size=20`, {
      headers: { Authorization: sessionToken },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setChatHistoryItems(data.items || []);
          setChatHistoryTotal(data.total || 0);
        }
      })
      .finally(() => setChatHistoryLoading(false));
  }, [isOwnProfile, activeTab, chatHistoryPage, sessionToken]);

  const handleDeleteChatByCharacter = async (characterId, characterName) => {
    const label = characterName || t('profile.this_character') || 'this character';
    if (!window.confirm(
      (t('profile.confirm_delete_all_chats') || 'Permanently delete all chats with {character}? This cannot be undone.')
        .replace('{character}', label)
    )) return;
    setDeletingChatId(characterId ?? characterName);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/delete-by-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: sessionToken },
        body: JSON.stringify({ character_id: characterId, character_name: characterName }),
      });
      if (res.ok) {
        setChatHistoryItems(prev => prev.filter(c =>
          characterId ? c.character_id !== characterId : c.character_name !== characterName
        ));
        setChatHistoryTotal(prev => Math.max(0, prev - 1));
        toast.show(t('profile.all_chats_deleted') || 'All chats deleted.', { type: 'success' });
      }
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleClearUnavailable = async () => {
    setClearingUnavailable(true);
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/delete-unavailable`, {
        method: 'POST',
        headers: { Authorization: sessionToken },
      });
      if (res.ok) {
        const removedCount = chatHistoryItems.filter(c => c.character_deleted || c.character_moderation_status).length;
        setChatHistoryItems(prev => prev.filter(c => !c.character_deleted && !c.character_moderation_status));
        setChatHistoryTotal(prev => Math.max(0, prev - removedCount));
        toast.show(t('profile.unavailable_chats_cleared') || 'Unavailable chats cleared.', { type: 'success' });
      }
    } finally {
      setClearingUnavailable(false);
    }
  };

  // Fetch total chats and likes for all created characters (true total, not just current page)
  useEffect(() => {
    const userId = profileUserId || userData?.id;
    if (!userId) {
      setTotalChats(0);
      setTotalLikes(0);
      return;
    }
    fetch(`${window.API_BASE_URL}/api/user/${userId}/character-stats`)
      .then(res => res.ok ? res.json() : { total_chats: 0, total_likes: 0 })
      .then(data => {
        setTotalChats(data.total_views || 0);
        setTotalLikes(data.total_likes || 0);
      })
      .catch(() => {
        setTotalChats(0);
        setTotalLikes(0);
      });
  }, [profileUserId, userData?.id]);

  // Smooth count-up animation for a stat value
  const animateCount = useCallback((from, to, setter, rafRef) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (from === to) { setter(to); return; }
    const duration = 1200;
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setter(Math.round(from + (to - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);
  
  const displayUser = isOwnProfile ? userData : publicUserData;

  // Trigger count-up when totals change, and compute session delta
  useEffect(() => {
    if (!isOwnProfile || !displayUser) return;
    const storageKey = `profile_stats_${displayUser.id}`;
    const stored = (() => { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } })();
    const prevChats = typeof stored.chats === 'number' ? stored.chats : null;
    const prevLikes = typeof stored.likes === 'number' ? stored.likes : null;

    // If first visit, just show current stats and store them
    if (prevChats === null || prevLikes === null) {
      setDisplayChats(totalChats);
      setDisplayLikes(totalLikes);
      setSessionDeltaChats(0);
      setSessionDeltaLikes(0);
      // Only persist if we have real data, to avoid overwriting with 0 on mount
      if (totalChats > 0 || totalLikes > 0) {
        localStorage.setItem(storageKey, JSON.stringify({ chats: totalChats, likes: totalLikes }));
      }
      return;
    }

    const deltaChats = Math.max(0, totalChats - prevChats);
    const deltaLikes = Math.max(0, totalLikes - prevLikes);

    // Only animate and show delta if there is an increase
    if (deltaChats > 0 || deltaLikes > 0) {
      animateCount(prevChats, totalChats, setDisplayChats, chatsAnimRef);
      animateCount(prevLikes, totalLikes, setDisplayLikes, likesAnimRef);
      const showDelay = setTimeout(() => {
        if (deltaChats > 0) { setSessionDeltaChats(deltaChats); setDeltaChatKey(k => k + 1); }
        if (deltaLikes > 0) { setSessionDeltaLikes(deltaLikes); setDeltaLikeKey(k => k + 1); }
        // Save new stats after animation completes
        localStorage.setItem(storageKey, JSON.stringify({ chats: totalChats, likes: totalLikes }));
      }, 1250);
      return () => clearTimeout(showDelay);
    } else {
      setDisplayChats(totalChats);
      setDisplayLikes(totalLikes);
      setSessionDeltaChats(0);
      setSessionDeltaLikes(0);
      // Only persist if we have real data, to avoid overwriting with 0 on mount
      if (totalChats > 0 || totalLikes > 0) {
        localStorage.setItem(storageKey, JSON.stringify({ chats: totalChats, likes: totalLikes }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalChats, totalLikes]);

  // (Removed redundant persist-after-animation effect)

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
    } else if (activeTab === TAB_TYPES.MY_PERSONAS) {
      // Merge created + liked personas, deduplicate by id
      const seen = new Set();
      entities = [...personas, ...likedPersonas].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      type = 'persona';
      showEdit = isOwnProfile;
      editUrlPrefix = 'persona';
      emptyMsg = t('profile.no_all_personas');
      page = 1;
      total = 0;
      onPageChange = () => {};
    } else if (activeTab === TAB_TYPES.CHAT_HISTORY) {
      const hasUnavailable = chatHistoryItems.some(c => c.character_deleted || c.character_moderation_status);
      return (
        <div>
          {!chatHistoryLoading && hasUnavailable && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button
                type="button"
                disabled={clearingUnavailable}
                onClick={handleClearUnavailable}
                onMouseEnter={e => { if (!clearingUnavailable) e.currentTarget.style.background = '#e5e7eb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 8, border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: clearingUnavailable ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: clearingUnavailable ? 0.6 : 1 }}
              >
                {clearingUnavailable ? (t('profile.loading') || 'Loading…') : (t('profile.clear_unavailable') || 'Clear Unavailable')}
              </button>
            </div>
          )}
          {chatHistoryLoading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : chatHistoryItems.length === 0 ? (
            <div className="text-center" style={{ color: '#9ca3af', padding: '3rem 0', fontSize: '0.95rem' }}>
              {t('profile.no_chat_history') || 'No chat history yet.'}
            </div>
          ) : (() => {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterdayStart = todayStart - 86400000;

            const formatChatDate = (iso) => {
              if (!iso) return '—';
              const d = new Date(iso);
              const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
              if (dayStart === todayStart)
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (dayStart === yesterdayStart)
                return t('profile.yesterday') || 'Yesterday';
              return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            };

            const getBucket = (iso) => {
              if (!iso) return 'earlier';
              const dayStart = new Date(new Date(iso)).setHours(0, 0, 0, 0);
              if (dayStart === todayStart) return 'today';
              if (dayStart === yesterdayStart) return 'yesterday';
              return 'earlier';
            };

            const bucketLabels = {
              today: t('profile.today') || 'Today',
              yesterday: t('profile.yesterday') || 'Yesterday',
              earlier: t('profile.earlier') || 'Earlier',
            };

            const groups = ['today', 'yesterday', 'earlier']
              .map(key => ({ key, label: bucketLabels[key], items: chatHistoryItems.filter(c => getBucket(c.last_updated) === key) }))
              .filter(g => g.items.length > 0);

            const renderCard = (chat) => (
              <div
                key={chat.character_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
                  padding: '10px 14px',
                  opacity: chat.character_deleted ? 0.75 : 1,
                }}
              >
                {/* Avatar: character big, scene small overlay */}
                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  {chat.character_picture ? (
                    <img
                      src={`${window.API_BASE_URL.replace(/\/$/, '')}/${chat.character_picture.replace(/^\//, '')}`}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', filter: chat.character_deleted ? 'grayscale(1)' : 'none' }}
                    />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="bi bi-person" style={{ color: '#9d7fcf', fontSize: '1.3rem' }} />
                    </div>
                  )}
                  {chat.scene_picture && (
                    <img
                      src={`${window.API_BASE_URL.replace(/\/$/, '')}/${chat.scene_picture.replace(/^\//, '')}`}
                      alt=""
                      style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover', border: '1.5px solid #fff', position: 'absolute', bottom: -3, right: -3, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: chat.character_deleted ? '#9ca3af' : '#18191a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.character_name || t('chat.unknown_character') || 'Unknown Character'}
                  </div>
                  <div style={{ fontSize: '0.77rem', color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {chat.character_deleted ? (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{t('profile.character_deleted') || 'Deleted'}</span>
                    ) : chat.character_moderation_status ? (
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{t('profile.character_moderated') || 'Unavailable'}</span>
                    ) : chat.scene_name ? (
                      <>
                        <span style={{ color: '#9d7fcf', fontWeight: 500 }}>{chat.scene_name}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                      </>
                    ) : null}
                    <span>{chat.chat_count} {chat.chat_count === 1 ? (t('profile.session') || 'session') : (t('profile.sessions') || 'sessions')}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>{formatChatDate(chat.last_updated)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {!chat.character_deleted && !chat.character_moderation_status && (
                    <button
                      type="button"
                      title={t('profile.open_chat') || 'Open'}
                      onClick={() => navigate(`/chat?character=${chat.character_id}`)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: '#7c5cbf', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <i className="bi bi-arrow-right" />
                    </button>
                  )}
                  <button
                    type="button"
                    title={t('common.delete') || 'Delete'}
                    disabled={deletingChatId === (chat.character_id ?? chat.character_name)}
                    onClick={() => handleDeleteChatByCharacter(chat.character_id, chat.character_name)}
                    style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', opacity: deletingChatId === (chat.character_id ?? chat.character_name) ? 0.4 : 1 }}
                    onMouseEnter={e => { if (deletingChatId !== (chat.character_id ?? chat.character_name)) e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>
            );

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {groups.map((group, gi) => (
                  <div key={group.key}>
                    {gi > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>{group.label}</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                      </div>
                    )}
                    {gi === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>{group.label}</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.items.map(renderCard)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {chatHistoryTotal > 20 && (
            <PaginationBar
              page={chatHistoryPage}
              total={chatHistoryTotal}
              pageSize={20}
              loading={chatHistoryLoading}
              onPageChange={setChatHistoryPage}
            />
          )}
        </div>
      );
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

  if (!displayUser) return null;

  return (
    <PageWrapper>
      <style>{`
        @keyframes statDeltaFloat {
          0%   { transform: translateY(-50%) scale(0.65); opacity: 0; }
          20%  { transform: translateY(-65%) scale(1.1); opacity: 0.55; }
          60%  { opacity: 0.45; }
          100% { transform: translateY(-160%) scale(1); opacity: 0; }
        }
        @keyframes heartSproutDir {
          0%   { transform: translate(calc(-50% + 0px), calc(-50% + 0px)) scale(1);                                 opacity: 0.45; }
          100% { transform: translate(calc(-50% + var(--htx)),        calc(-50% + var(--hty)))        scale(0.85);     opacity: 0; }
        }

      `}</style>
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
                  {!isOwnProfile && sessionToken && (
                    <button
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      style={{
                        padding: '0.28rem 0.9rem',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        borderRadius: '999px',
                        border: 'none',
                        background: isFollowing ? 'rgba(200,193,225,0.18)' : 'rgba(200,193,225,0.55)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        color: isFollowing ? '#a09abf' : '#736B92',
                        cursor: followLoading ? 'default' : 'pointer',
                        opacity: followLoading ? 0.5 : 1,
                        transition: 'background 0.18s ease, color 0.18s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => {
                        if (followLoading) return;
                        e.currentTarget.style.background = isFollowing ? 'rgba(200,193,225,0.32)' : 'rgba(200,193,225,0.78)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isFollowing ? 'rgba(200,193,225,0.18)' : 'rgba(200,193,225,0.55)';
                      }}
                    >
                      {isFollowing ? t('user_card.unfollow') : t('user_card.follow')}
                    </button>
                  )}
                  {!isOwnProfile && sessionToken && (
                    <button
                      type="button"
                      onClick={() => setShowReportUser(true)}
                      title={t('topbar.report_problem')}
                      aria-label={t('topbar.report_problem')}
                      onMouseEnter={() => setReportIconHovered(true)}
                      onMouseLeave={() => setReportIconHovered(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.28rem 0.7rem',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        borderRadius: '999px',
                        border: '1.5px solid rgba(220,53,69,0.25)',
                        background: reportIconHovered ? 'rgba(220,53,69,0.08)' : 'transparent',
                        color: '#dc3545',
                        cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <i
                        className={`bi ${reportIconHovered ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-triangle'}`}
                        style={{ fontSize: '0.85rem' }}
                      />
                      {t('problem_report.report_button', 'Report')}
                    </button>
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

              {/* Following / Followers counts */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 2 }}>
                <button
                  onClick={() => openFollowModal('following')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                  onMouseEnter={e => e.currentTarget.querySelector('span:last-child').style.color = '#736B92'}
                  onMouseLeave={e => e.currentTarget.querySelector('span:last-child').style.color = '#6b7280'}
                >
                  <span style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: '#111', lineHeight: 1 }}>
                    {followCounts.following_count.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, transition: 'color 0.15s' }}>
                    {t('profile.following')}
                  </span>
                </button>
                <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.1)' }} />
                <button
                  onClick={() => openFollowModal('followers')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                  onMouseEnter={e => e.currentTarget.querySelector('span:last-child').style.color = '#736B92'}
                  onMouseLeave={e => e.currentTarget.querySelector('span:last-child').style.color = '#6b7280'}
                >
                  <span style={{ fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, color: '#111', lineHeight: 1 }}>
                    {followCounts.follower_count.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, transition: 'color 0.15s' }}>
                    {t('profile.followers')}
                  </span>
                </button>
              </div>
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
                    <div style={{ position: 'relative', display: 'inline-block', fontSize: isMobile ? '1.3rem' : '1.8rem', lineHeight: 1, fontWeight: 800, color: '#111', marginTop: 4 }}>
                      {(isOwnProfile ? displayChats : totalChats).toLocaleString()}
                      {isOwnProfile && deltaChatKey > 0 && (
                        <span
                          key={deltaChatKey}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: 'calc(100% + 5px)',
                            pointerEvents: 'none',
                            animation: 'statDeltaFloat 1.8s ease-out forwards',
                            fontSize: isMobile ? '0.82rem' : '1rem',
                            fontWeight: 800,
                            color: '#6d28d9',
                            whiteSpace: 'nowrap',
                            opacity: 0.5,
                          }}
                        >
                          +{sessionDeltaChats.toLocaleString()}
                        </span>
                      )}
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
                    <i className="bi bi-chat-dots-fill" style={{ fontSize: isMobile ? '0.9rem' : '1.15rem' }}></i>
                  </div>
                </div>

                <div style={isMobile
                  ? { width: 1, alignSelf: 'stretch', margin: '0 12px', background: 'linear-gradient(180deg, rgba(17,17,17,0.08), rgba(255,255,255,0.55), rgba(17,17,17,0.08))' }
                  : { height: 1, background: 'linear-gradient(90deg, rgba(17,17,17,0.08), rgba(255,255,255,0.55), rgba(17,17,17,0.08))' }
                }></div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: isMobile ? 1 : undefined, position: 'relative' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>
                      {t('profile.total_likes')}
                    </div>
                    <div style={{ position: 'relative', display: 'inline-block', fontSize: isMobile ? '1.3rem' : '1.8rem', lineHeight: 1, fontWeight: 800, color: '#111', marginTop: 4 }}>
                      {(isOwnProfile ? displayLikes : totalLikes).toLocaleString()}
                      {isOwnProfile && deltaLikeKey > 0 && (
                        <span
                          key={deltaLikeKey}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: 'calc(100% + 5px)',
                            pointerEvents: 'none',
                            animation: 'statDeltaFloat 1.8s ease-out forwards',
                            fontSize: isMobile ? '0.82rem' : '1rem',
                            fontWeight: 800,
                            color: '#e11d48',
                            whiteSpace: 'nowrap',
                            opacity: 0.5,
                          }}
                        >
                          +{sessionDeltaLikes.toLocaleString()}
                        </span>
                      )}
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
                      color: '#ef4444',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    <i className="bi bi-heart-fill" style={{ fontSize: isMobile ? '0.9rem' : '1.15rem' }}></i>
                    {isOwnProfile && deltaLikeKey > 0 && sproutHearts.map(h => (
                      <i
                        key={`${deltaLikeKey}-${h.id}`}
                        className="bi bi-heart-fill"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          fontSize: isMobile ? '0.9rem' : '1.15rem',
                          color: '#ef4444',
                          pointerEvents: 'none',
                          opacity: 0,
                          '--htx': `${h.tx}px`,
                          '--hty': `${h.ty}px`,
                          animation: `heartSproutDir 1.8s ease-out ${h.delay}s forwards`,
                        }}
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ── Workstation layout: sidebar + content ── */}
        <div className="d-flex w-100" style={{ gap: isMobile ? 0 : 20, alignItems: 'flex-start', marginTop: 8 }}>

          {/* Desktop sidebar */}
          {!isMobile && (
            <aside style={{
              width: 152,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingRight: 12,
              borderRight: '1px solid rgba(0,0,0,0.07)',
            }}>
              {/* 我的创作 */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!createdExpanded) {
                      setCreatedExpanded(true);
                      setActiveTab(TAB_TYPES.CREATED);
                      setActiveSubtab(SUBTAB_TYPES.CHARACTERS);
                    } else {
                      setCreatedExpanded(false);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.44rem 0.6rem', borderRadius: 8, border: 'none',
                    background: 'transparent',
                    color: activeTab === TAB_TYPES.CREATED ? '#5b2f9b' : '#3a3a3a',
                    fontSize: '0.875rem', fontWeight: activeTab === TAB_TYPES.CREATED ? 700 : 600,
                    cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{t('profile.my_creations')}</span>
                  <i className={`bi bi-chevron-${createdExpanded ? 'down' : 'right'}`} style={{ fontSize: '0.65rem', opacity: 0.5, flexShrink: 0 }} />
                </button>
                {createdExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 10, marginTop: 1 }}>
                    {[
                      { key: SUBTAB_TYPES.CHARACTERS, label: t('profile.characters') },
                      { key: SUBTAB_TYPES.SCENES,     label: t('profile.scenes') },
                      { key: SUBTAB_TYPES.PERSONAS,   label: t('profile.personas') },
                    ].map(sub => {
                      const isActive = activeTab === TAB_TYPES.CREATED && activeSubtab === sub.key;
                      return (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => { setActiveTab(TAB_TYPES.CREATED); setActiveSubtab(sub.key); }}
                          style={{
                            display: 'block', width: '100%', padding: '0.33rem 0.55rem',
                            borderRadius: 7, border: 'none',
                            background: isActive ? 'rgba(167,139,250,0.15)' : 'transparent',
                            color: isActive ? '#5b2f9b' : '#555',
                            fontSize: '0.82rem', fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(167,139,250,0.07)'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {isOwnProfile && <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 2px' }} />}

              {/* 喜欢 */}
              {isOwnProfile && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!likedExpanded) {
                        setLikedExpanded(true);
                        setActiveTab(TAB_TYPES.LIKED);
                        setActiveSubtab(SUBTAB_TYPES.CHARACTERS);
                      } else {
                        setLikedExpanded(false);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '0.44rem 0.6rem', borderRadius: 8, border: 'none',
                      background: 'transparent',
                      color: activeTab === TAB_TYPES.LIKED ? '#5b2f9b' : '#3a3a3a',
                      fontSize: '0.875rem', fontWeight: activeTab === TAB_TYPES.LIKED ? 700 : 600,
                      cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{t('profile.liked')}</span>
                    <i className={`bi bi-chevron-${likedExpanded ? 'down' : 'right'}`} style={{ fontSize: '0.65rem', opacity: 0.5, flexShrink: 0 }} />
                  </button>
                  {likedExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 10, marginTop: 1 }}>
                      {[
                        { key: SUBTAB_TYPES.CHARACTERS, label: t('profile.characters') },
                        { key: SUBTAB_TYPES.SCENES,     label: t('profile.scenes') },
                      ].map(sub => {
                        const isActive = activeTab === TAB_TYPES.LIKED && activeSubtab === sub.key;
                        return (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() => { setActiveTab(TAB_TYPES.LIKED); setActiveSubtab(sub.key); }}
                            style={{
                              display: 'block', width: '100%', padding: '0.33rem 0.55rem',
                              borderRadius: 7, border: 'none',
                              background: isActive ? 'rgba(167,139,250,0.15)' : 'transparent',
                              color: isActive ? '#5b2f9b' : '#555',
                              fontSize: '0.82rem', fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(167,139,250,0.07)'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {isOwnProfile && <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 2px' }} />}

              {/* 我的人设 */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => { setActiveTab(TAB_TYPES.MY_PERSONAS); setCreatedExpanded(false); setLikedExpanded(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '0.44rem 0.6rem',
                    borderRadius: 8, border: 'none',
                    background: activeTab === TAB_TYPES.MY_PERSONAS ? 'rgba(167,139,250,0.15)' : 'transparent',
                    color: activeTab === TAB_TYPES.MY_PERSONAS ? '#5b2f9b' : '#3a3a3a',
                    fontSize: '0.875rem', fontWeight: activeTab === TAB_TYPES.MY_PERSONAS ? 700 : 600,
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (activeTab !== TAB_TYPES.MY_PERSONAS) e.currentTarget.style.background = 'rgba(167,139,250,0.06)'; }}
                  onMouseLeave={e => { if (activeTab !== TAB_TYPES.MY_PERSONAS) e.currentTarget.style.background = 'transparent'; }}
                >
                  {t('profile.my_personas')}
                </button>
              )}

              {/* Chat History */}
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => { setActiveTab(TAB_TYPES.CHAT_HISTORY); setChatHistoryPage(1); setCreatedExpanded(false); setLikedExpanded(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '0.44rem 0.6rem',
                    borderRadius: 8, border: 'none',
                    background: activeTab === TAB_TYPES.CHAT_HISTORY ? 'rgba(167,139,250,0.15)' : 'transparent',
                    color: activeTab === TAB_TYPES.CHAT_HISTORY ? '#5b2f9b' : '#3a3a3a',
                    fontSize: '0.875rem', fontWeight: activeTab === TAB_TYPES.CHAT_HISTORY ? 700 : 600,
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (activeTab !== TAB_TYPES.CHAT_HISTORY) e.currentTarget.style.background = 'rgba(167,139,250,0.06)'; }}
                  onMouseLeave={e => { if (activeTab !== TAB_TYPES.CHAT_HISTORY) e.currentTarget.style.background = 'transparent'; }}
                >
                  {t('profile.chat_history') || 'Chat History'}
                </button>
              )}
            </aside>
          )}

          {/* Mobile top nav */}
          {isMobile && (
            <div style={{ width: '100%', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab(TAB_TYPES.CREATED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); setCreatedExpanded(true); setLikedExpanded(false); }}
                  style={{
                    flexShrink: 0, padding: '0.35rem 0.8rem', borderRadius: 999, border: 'none',
                    background: activeTab === TAB_TYPES.CREATED ? 'rgba(167,139,250,0.18)' : 'rgba(0,0,0,0.05)',
                    color: activeTab === TAB_TYPES.CREATED ? '#5b2f9b' : '#555',
                    fontSize: '0.82rem', fontWeight: activeTab === TAB_TYPES.CREATED ? 700 : 500,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t('profile.my_creations')}
                </button>
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab(TAB_TYPES.LIKED); setActiveSubtab(SUBTAB_TYPES.CHARACTERS); setLikedExpanded(true); setCreatedExpanded(false); }}
                    style={{
                      flexShrink: 0, padding: '0.35rem 0.8rem', borderRadius: 999, border: 'none',
                      background: activeTab === TAB_TYPES.LIKED ? 'rgba(167,139,250,0.18)' : 'rgba(0,0,0,0.05)',
                      color: activeTab === TAB_TYPES.LIKED ? '#5b2f9b' : '#555',
                      fontSize: '0.82rem', fontWeight: activeTab === TAB_TYPES.LIKED ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {t('profile.liked')}
                  </button>
                )}
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab(TAB_TYPES.MY_PERSONAS); setCreatedExpanded(false); setLikedExpanded(false); }}
                    style={{
                      flexShrink: 0, padding: '0.35rem 0.8rem', borderRadius: 999, border: 'none',
                      background: activeTab === TAB_TYPES.MY_PERSONAS ? 'rgba(167,139,250,0.18)' : 'rgba(0,0,0,0.05)',
                      color: activeTab === TAB_TYPES.MY_PERSONAS ? '#5b2f9b' : '#555',
                      fontSize: '0.82rem', fontWeight: activeTab === TAB_TYPES.MY_PERSONAS ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {t('profile.my_personas')}
                  </button>
                )}
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab(TAB_TYPES.CHAT_HISTORY); setChatHistoryPage(1); setCreatedExpanded(false); setLikedExpanded(false); }}
                    style={{
                      flexShrink: 0, padding: '0.35rem 0.8rem', borderRadius: 999, border: 'none',
                      background: activeTab === TAB_TYPES.CHAT_HISTORY ? 'rgba(167,139,250,0.18)' : 'rgba(0,0,0,0.05)',
                      color: activeTab === TAB_TYPES.CHAT_HISTORY ? '#5b2f9b' : '#555',
                      fontSize: '0.82rem', fontWeight: activeTab === TAB_TYPES.CHAT_HISTORY ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {t('profile.chat_history') || 'Chat History'}
                  </button>
                )}
              </div>
              {(activeTab === TAB_TYPES.CREATED || activeTab === TAB_TYPES.LIKED) && (
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4, marginTop: 2 }}>
                  {(activeTab === TAB_TYPES.CREATED
                    ? [
                        { key: SUBTAB_TYPES.CHARACTERS, label: t('profile.characters') },
                        { key: SUBTAB_TYPES.SCENES,     label: t('profile.scenes') },
                        { key: SUBTAB_TYPES.PERSONAS,   label: t('profile.personas') },
                      ]
                    : [
                        { key: SUBTAB_TYPES.CHARACTERS, label: t('profile.characters') },
                        { key: SUBTAB_TYPES.SCENES,     label: t('profile.scenes') },
                      ]
                  ).map(sub => {
                    const isActive = activeSubtab === sub.key;
                    return (
                      <button
                        key={sub.key}
                        type="button"
                        onClick={() => setActiveSubtab(sub.key)}
                        style={{
                          flexShrink: 0, padding: '0.26rem 0.65rem', borderRadius: 999, border: 'none',
                          background: isActive ? 'rgba(167,139,250,0.15)' : 'transparent',
                          color: isActive ? '#5b2f9b' : '#777',
                          fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Content area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Sort toggle (hidden for MY_PERSONAS and CHAT_HISTORY) */}
            {activeTab !== TAB_TYPES.MY_PERSONAS && activeTab !== TAB_TYPES.CHAT_HISTORY && (
              <div className="d-flex align-items-center justify-content-end" style={{ marginBottom: 12, gap: 8 }}>
                <span
                  title={t('browse.sort_by')}
                  aria-label={t('browse.sort_by')}
                  style={{ color: '#555', fontSize: '0.84rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <i className="bi bi-sort-down" aria-hidden="true" style={{ fontSize: '0.95rem', lineHeight: 1 }} />
                  <span className="visually-hidden">{t('browse.sort_by')}</span>
                </span>
                <div
                  style={{
                    position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    alignItems: 'center', minWidth: isMobile ? 124 : 148,
                    borderRadius: 8, padding: 2, background: 'rgba(0,0,0,0.06)', flexShrink: 0,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute', left: 2, top: 2, bottom: 2,
                      width: 'calc((100% - 4px) / 2)', borderRadius: 6, background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      transform: `translateX(${sortToggleTranslatePercent}%)`,
                      transition: 'transform 200ms ease', pointerEvents: 'none', zIndex: 0,
                    }}
                  />
                  <button
                    type="button"
                    className="border-0"
                    style={{
                      position: 'relative', zIndex: 1, background: 'transparent',
                      color: activeSort === ENTITY_SORTS.RECENT ? '#2f2447' : '#9088a4',
                      borderRadius: 6, fontSize: isMobile ? '0.79rem' : '0.86rem',
                      fontWeight: activeSort === ENTITY_SORTS.RECENT ? 700 : 500,
                      padding: isMobile ? '0.28rem 0.5rem' : '0.32rem 0.65rem',
                      whiteSpace: 'nowrap', transition: 'color 0.18s ease',
                    }}
                    onClick={() => setActiveSort(ENTITY_SORTS.RECENT)}
                  >
                    {t('browse.recent')}
                  </button>
                  <button
                    type="button"
                    className="border-0"
                    style={{
                      position: 'relative', zIndex: 1, background: 'transparent',
                      color: activeSort === ENTITY_SORTS.POPULAR ? '#2f2447' : '#9088a4',
                      borderRadius: 6, fontSize: isMobile ? '0.79rem' : '0.86rem',
                      fontWeight: activeSort === ENTITY_SORTS.POPULAR ? 700 : 500,
                      padding: isMobile ? '0.28rem 0.5rem' : '0.32rem 0.65rem',
                      whiteSpace: 'nowrap', transition: 'color 0.18s ease',
                    }}
                    onClick={() => setActiveSort(ENTITY_SORTS.POPULAR)}
                  >
                    {t('browse.popular')}
                  </button>
                </div>
              </div>
            )}
            {renderTabContent()}
          </div>
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
            hideOriginal
          />
        </ModalPortal>
      )}

      {/* Follow / Followers modal */}
      {followModal && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1050,
              background: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setFollowModal(null)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                width: '100%',
                maxWidth: 420,
                maxHeight: '75vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #f0f0f4' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#18191a' }}>
                  {followModal === 'following' ? t('profile.following') : t('profile.followers')}
                  <span style={{ marginLeft: 8, fontSize: '0.82rem', color: '#9ca3af', fontWeight: 500 }}>
                    {followModal === 'following' ? followCounts.following_count : followCounts.follower_count}
                  </span>
                </span>
                <button
                  onClick={() => setFollowModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem', padding: '2px 6px', borderRadius: 8, lineHeight: 1, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
              {/* List */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
                {followModalLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                    <div className="spinner-border" style={{ width: 28, height: 28, color: '#736B92' }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : followModalUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2.5rem 1rem', fontSize: '0.9rem' }}>
                    {followModal === 'following' ? t('profile.no_following') : t('profile.no_followers')}
                  </div>
                ) : (
                  followModalUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => { setFollowModal(null); navigate(`/profile/${u.id}`); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '0.6rem 1.25rem',
                        cursor: 'pointer',
                        transition: 'background 0.14s',
                        borderRadius: 12,
                        margin: '1px 8px',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f5f4fa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <img
                        src={u.profile_pic
                          ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(u.profile_pic).replace(/^\//, '')}`
                          : defaultAvatar}
                        alt={u.name}
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#18191a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.name}
                        </div>
                        {u.bio ? (
                          <div style={{ fontSize: '0.77rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.bio}
                          </div>
                        ) : null}
                      </div>
                      {typeof u.characters_created === 'number' && u.characters_created > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#c4b5d6', fontWeight: 600, flexShrink: 0 }}>
                          {u.characters_created} {t('user_card.characters_created')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <ProblemReportModal
        show={showReportUser}
        onClose={() => setShowReportUser(false)}
        targetType="user"
        targetName={displayUser?.name}
        targetStringId={displayUser?.id}
      />

    </PageWrapper>
  );
}

// ModalPortal component renders children into the <main> element or document.body
function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  const main = document.querySelector('main');
  return createPortal(children, main || document.body);
}