import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useOutletContext } from 'react-router';
import { AuthContext } from './AuthProvider.jsx'; // Import the AuthContext
import { useToast } from './ToastProvider.jsx';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import TextButton from './TextButton';
import AvatarFrame from './AvatarFrame';
import { formatCompactTokenCount, getTokenQuotaLabel } from '../utils/tokenDisplay';

export default function Sidebar({ isMobile, setSidebarVisible }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, setUserData, refreshUserData, sessionToken, loading } = useContext(AuthContext); // Get user data from context
  const { t } = useTranslation();
  const toast = useToast();
  const isActivePro = Boolean(userData?.pro_active);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [homeIconFocused, setHomeIconFocused] = useState(false);
  
  // Helper function to close sidebar and navigate immediately
  const handleNavigate = (path) => {
    // Only close sidebar on mobile devices
    if (isMobile && setSidebarVisible) {
      setSidebarVisible(false);
    }
    navigate(path);
  };

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (isMobile && setSidebarVisible) {
      setSidebarVisible(false);
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionToken) return;
      if (query.trim() === '') {
        fetch(`${window.API_BASE_URL}/api/search-suggestions/popular`, {
          headers: { Authorization: sessionToken },
        })
          .then((res) => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`${window.API_BASE_URL}/api/search-suggestions?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: sessionToken },
        })
          .then((res) => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, sessionToken]);

  // Derive recent chats mixed (scene and character) in time order
  const recentChats = useMemo(() => {
    if (!userData?.chat_history) return [];

    // Sort pinned chats first, then by recency.
    const sorted = [...userData.chat_history].sort(
      (a, b) => {
        const pinDelta = Number(Boolean(b?.is_pinned)) - Number(Boolean(a?.is_pinned));
        if (pinDelta !== 0) return pinDelta;
        return new Date(b.last_updated) - new Date(a.last_updated);
      }
    );

    // Keep only the most recent item per entity (scene or character)
    const seen = new Set();
    const items = [];

    for (const chat of sorted) {
      const isScene = !!chat.scene_id;
      const key = isScene ? `scene:${chat.scene_id}_character:${chat.character_id}` : (chat.character_id ? `character:${chat.character_id}` : null);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      if (isScene) {
        items.push({
          type: 'scene',
          chat_id: chat.chat_id,
          id: chat.scene_id,
          character_id: chat.character_id,
          name: chat.scene_name || 'Unknown Scene',
          picture: chat.scene_picture,
          character_picture: chat.character_picture,
          is_pinned: !!chat.is_pinned,
          last_updated: chat.last_updated,
        });
      } else if (chat.character_id) {
        items.push({
          type: 'character',
          chat_id: chat.chat_id,
          id: chat.character_id,
          name: chat.character_name || 'Unknown Character',
          picture: chat.character_picture,
          is_pinned: !!chat.is_pinned,
          last_updated: chat.last_updated,
        });
      }
    }

    return items.slice(0, 10);
  }, [userData?.chat_history]);

  const [chatMenuOpenId, setChatMenuOpenId] = useState(null);
  const [chatMenuPosition, setChatMenuPosition] = useState(null);
  const chatMenuButtonRefs = useRef(new Map());

  const activeChatMenuItem = useMemo(
    () => recentChats.find((item) => item.chat_id === chatMenuOpenId) || null,
    [recentChats, chatMenuOpenId]
  );

  const updateChatMenuPosition = (chatId) => {
    if (!chatId) {
      setChatMenuPosition(null);
      return;
    }

    const triggerButton = chatMenuButtonRefs.current.get(chatId);
    if (!triggerButton) {
      setChatMenuPosition(null);
      return;
    }

    const rect = triggerButton.getBoundingClientRect();
    const menuWidth = 172;
    const viewportPadding = 8;

    setChatMenuPosition({
      top: rect.bottom - 2,
      left: Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      ),
      minWidth: menuWidth,
    });
  };

  const handleToggleRecentChatPin = async (chatItem) => {
    const chatId = chatItem?.chat_id;
    if (!sessionToken || !chatId) return;

    const nextPinnedState = !chatItem?.is_pinned;

    // Optimistic UI update for instant feedback.
    setUserData((prev) => {
      if (!prev?.chat_history) return prev;
      return {
        ...prev,
        chat_history: prev.chat_history.map((entry) => {
          if (entry.chat_id !== chatId) return entry;
          return { ...entry, is_pinned: nextPinnedState };
        }),
      };
    });

    setChatMenuOpenId(null);

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify({
          chat_id: chatId,
          is_pinned: nextPinnedState,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat pin state');
      }

      toast.show(
        nextPinnedState
          ? (t('sidebar.chat_pinned_success') || 'Chat pinned.')
          : (t('sidebar.chat_unpinned_success') || 'Chat unpinned.'),
        { type: 'success' }
      );
    } catch (error) {
      setUserData((prev) => {
        if (!prev?.chat_history) return prev;
        return {
          ...prev,
          chat_history: prev.chat_history.map((entry) => {
            if (entry.chat_id !== chatId) return entry;
            return { ...entry, is_pinned: !nextPinnedState };
          }),
        };
      });
      toast.show(t('sidebar.chat_action_failed') || 'Failed to update chat.', { type: 'error' });
    }
  };

  const handleDeleteRecentChat = async (chatItem) => {
    const chatId = chatItem?.chat_id;
    if (!sessionToken || !chatId) return;

    const confirmed = window.confirm(
      t('sidebar.confirm_delete_chat') || 'Delete this recent chat? This action cannot be undone.'
    );
    if (!confirmed) return;

    setChatMenuOpenId(null);

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify({ chat_id: chatId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      setUserData((prev) => {
        if (!prev?.chat_history) return prev;
        return {
          ...prev,
          chat_history: prev.chat_history.filter((entry) => entry.chat_id !== chatId),
        };
      });

      toast.show(t('sidebar.chat_deleted_success') || 'Chat deleted.', { type: 'success' });
      refreshUserData?.({ silent: true });
    } catch (error) {
      toast.show(t('sidebar.chat_action_failed') || 'Failed to update chat.', { type: 'error' });
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('sessionToken');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      toast.show(t('sidebar.logout_failed'), { type: 'error' });
    }
  };


  if (loading) {
    return (
      <aside className="d-flex flex-column h-100 p-3 bg-light border-end" style={{ minHeight: '100vh' }}>
        <div className="text-center py-5">
          <div className="spinner-border text-secondary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </aside>
    );
  }
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.profile-dropdown-area')) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  // Close create dropdown on outside click
  useEffect(() => {
    if (!createOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.create-dropdown-area')) setCreateOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [createOpen]);

  useEffect(() => {
    if (!chatMenuOpenId) return;
    const handleClick = (e) => {
      if (!e.target.closest('.recent-chat-menu-area') && !e.target.closest('.recent-chat-context-menu')) {
        setChatMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [chatMenuOpenId]);

  useEffect(() => {
    if (!chatMenuOpenId) {
      setChatMenuPosition(null);
      return;
    }

    updateChatMenuPosition(chatMenuOpenId);

    const handleViewportChange = () => updateChatMenuPosition(chatMenuOpenId);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [chatMenuOpenId, recentChats]);

  useEffect(() => {
    if (!chatMenuOpenId) return;
    const stillExists = recentChats.some((item) => item.chat_id === chatMenuOpenId);
    if (!stillExists) {
      setChatMenuOpenId(null);
      setChatMenuPosition(null);
    }
  }, [recentChats, chatMenuOpenId]);

  // Width is now controlled entirely by parent Layout; child fills available space.
  // (Bug fix) Removed internal fixed width that prevented desktop toggle from hiding the sidebar.

  return (
    <aside
      className="d-flex flex-column h-100"
      style={{
        minHeight: '80vh',
        background: 'rgba(255, 255, 255, 0.98)',
        color: '#232323',
        borderRight: '1.2px solid #e9ecef',
        fontFamily: 'Inter, sans-serif',
        borderRadius: 0,
        width: '100%',
        maxWidth: '100%',
        padding: isMobile ? '0.75rem' : '1rem',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {/* Sidebar Header: logo left, collapse toggle right */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '2.5rem',
        marginBottom: '0.75rem',
        flexShrink: 0,
      }}>
        <a
          href="/"
          aria-label={t('sidebar.home')}
          title={t('sidebar.home')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#232323',
            textDecoration: 'none',
            fontSize: '1.35rem',
            lineHeight: 1,
          }}
          onClick={(e) => {
            e.preventDefault();
            handleNavigate('/');
          }}
          onMouseEnter={() => setHomeIconFocused(true)}
          onMouseLeave={() => setHomeIconFocused(false)}
          onFocus={() => setHomeIconFocused(true)}
          onBlur={() => setHomeIconFocused(false)}
        >
          <i className={`bi ${homeIconFocused ? 'bi-house-door-fill' : 'bi-house-door'}`} style={{ pointerEvents: 'none' }}></i>
        </a>
        <button
          type="button"
          onClick={() => setSidebarVisible?.(false)}
          aria-label={t('topbar.hide_sidebar')}
          title={t('topbar.hide_sidebar')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '0.2rem',
            margin: 0,
            color: '#232323',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            borderRadius: 8,
            transition: 'background 0.16s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="bi bi-chevron-left" style={{ pointerEvents: 'none' }}></i>
        </button>
      </div>
      <div className="mb-2" style={{ position: 'relative' }}>
        <div
          className="input-group rounded-pill"
          style={{
            background: '#f5f6fa',
            borderRadius: 20,
            border: `1.2px solid ${searchFocused ? '#736B92' : 'transparent'}`,
            boxShadow: searchFocused ? '0 0 0 3px rgba(115,107,146,0.14)' : 'none',
            transition: 'box-shadow 120ms ease, border-color 120ms ease',
          }}
        >
          <input
            type="text"
            className="form-control border-0 rounded-pill"
            style={{
              background: 'transparent',
              fontSize: '0.85rem',
              paddingLeft: 12,
              color: '#232323',
              outline: 'none',
              boxShadow: 'none',
            }}
            placeholder={t('topbar.search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            onFocus={() => {
              setShowSuggestions(true);
              setSearchFocused(true);
            }}
            onBlur={() => setTimeout(() => {
              setShowSuggestions(false);
              setSearchFocused(false);
            }, 100)}
            aria-autocomplete="list"
            aria-haspopup="true"
          />
          <button
            className="btn rounded-pill px-2"
            style={{
              fontSize: '0.85rem',
              background: '#736B92',
              color: '#fff',
              borderColor: '#736B92',
              outline: 'none',
              boxShadow: 'none',
            }}
            onClick={() => handleSearch()}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 100)}
          >
            <i className="bi bi-search"></i>
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute w-100 shadow rounded-4"
            style={{
              top: '100%',
              zIndex: 2100,
              maxHeight: 176,
              overflowY: 'auto',
              background: '#fff',
              color: '#232323',
              border: 'none',
              fontSize: '0.78rem',
            }}
          >
            {suggestions.map(({ keyword, count }) => (
              <li
                key={keyword}
                className="list-group-item list-group-item-action rounded-3"
                style={{
                  cursor: 'pointer',
                  transition: 'background 0.16s',
                  background: 'transparent',
                  color: '#232323',
                  border: 'none',
                  fontSize: '0.78rem',
                }}
                onClick={() => handleSearch(keyword)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#232323';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#232323';
                }}
              >
                <span className="fw-semibold">{keyword}</span>{' '}
                <small className="text-muted">{t('topbar.suggestion_count', { count })}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Top navigation */}
      <div className="d-flex flex-column gap-2 mb-1 position-relative">
        <div className="create-dropdown-area" style={{ position: 'relative' }}>
          <div style={{ 
            position: 'relative',
            padding: '2px',
            borderRadius: 21,
            background: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #ff6b6b)',
            backgroundSize: '300% 100%',
            animation: 'rainbow-slide 4s linear infinite'
          }} 
          title={t('sidebar.create_tooltip')}>
            <button
              className={`fw-bold shadow-sm w-100 d-flex align-items-center justify-content-center${createOpen ? ' active' : ''}`}
              style={{ fontSize: '0.86rem', letterSpacing: '0.4px', background: createOpen ? '#dbeafe' : '#fff', color: '#232323', borderRadius: 19, padding: '9px 0', border: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700, transition: 'background 0.2s' }}
              onClick={() => setCreateOpen(v => !v)}
              onMouseEnter={e => { if (!createOpen) e.currentTarget.style.background = '#f5f6fa'; }}
              onMouseLeave={e => { if (!createOpen) e.currentTarget.style.background = '#fff'; }}
              aria-expanded={createOpen}
              aria-haspopup="true"
              tabIndex={0}
            >
              <span className="d-flex align-items-center justify-content-center w-100"><i className="bi bi-plus-circle me-2"></i> {t('sidebar.create')}</span>
            </button>
          </div>
          <style>{`
            @keyframes rainbow-slide {
              0% { background-position: 0% 50%; }
              100% { background-position: 100% 50%; }
            }

            .recent-chats-scroll {
              scrollbar-width: none;
              scrollbar-color: rgba(35, 35, 35, 0.18) transparent;
            }

            .recent-chats-scroll:hover {
              scrollbar-width: thin;
            }

            .recent-chats-scroll::-webkit-scrollbar {
              width: 0;
            }

            .recent-chats-scroll:hover::-webkit-scrollbar {
              width: 6px;
            }

            .recent-chats-scroll::-webkit-scrollbar-track {
              background: transparent;
            }

            .recent-chats-scroll::-webkit-scrollbar-thumb {
              background: transparent;
              border-radius: 999px;
            }

            .recent-chats-scroll:hover::-webkit-scrollbar-thumb {
              background: rgba(35, 35, 35, 0.18);
            }

            .recent-chats-scroll::-webkit-scrollbar-thumb:active {
              background: rgba(35, 35, 35, 0.3);
            }
          `}</style>
          <ul
            className="dropdown-menu shadow rounded-4 show"
            style={{
              background: '#fff',
              color: '#232323',
              border: 'none',
              display: createOpen ? 'block' : 'none',
              opacity: createOpen ? 1 : 0,
              transform: createOpen ? 'translateX(0)' : 'translateX(8px)',
              transition: 'opacity 0.14s, transform 0.14s',
              zIndex: 2000,
              position: 'absolute',
              left: isMobile ? 0 : '100%',
              top: isMobile ? '100%' : 0,
              marginTop: isMobile ? '0.25rem' : 0,
              marginLeft: isMobile ? 0 : '0.5rem',
              minWidth: isMobile ? '100%' : 160,
              maxWidth: isMobile ? '100%' : 'none',
              width: isMobile ? '100%' : 'auto',
              fontSize: '0.86rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
            }}
          >
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { 
                  setCreateOpen(false); 
                  if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); 
                  handleNavigate('/character/create'); 
                }}
              >
                <i className="bi bi-person-plus me-2"></i> {t('sidebar.create_character')}
              </button>
            </li>
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { 
                  setCreateOpen(false); 
                  if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); 
                  handleNavigate('/scene/create'); 
                }}
              >
                <i className="bi bi-easel2 me-2"></i> {t('sidebar.create_scene')}
              </button>
            </li>
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { 
                  setCreateOpen(false); 
                  if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); 
                  handleNavigate('/persona/create'); 
                }}
              >
                <i className="bi bi-person-badge me-2"></i> {t('sidebar.create_persona')}
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        className="fw-bold shadow-sm w-100 d-flex align-items-center justify-content-center"
        style={{ fontSize: '0.86rem', letterSpacing: '0.4px', background: '#fff', color: '#232323', borderRadius: 19, padding: '9px 0', border: 'none', fontWeight: 700, transition: 'background 0.2s', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        onClick={() => {
          handleNavigate('/browse/popular');
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        tabIndex={0}
        title={t('sidebar.browse_tooltip')}
      >
        <span className="d-flex align-items-center justify-content-center w-100"><i className="bi bi-compass me-2"></i> {t('sidebar.browse')}</span>
      </button>

      {/* Recent chats */}
      <div className="recent-chats-scroll mb-3 d-flex flex-column" style={{ minHeight: 0, flex: '1 1 auto', overflowX: 'hidden', overflowY: 'auto' }}>
        <h6 className="fw-bold mb-1" style={{ color: '#6c757d', fontSize: '0.82rem', letterSpacing: '0.16px', flexShrink: 0 }}>{t('sidebar.recent_chats')}</h6>
        <div className="list-group rounded-4" style={{ background: 'transparent', boxShadow: 'none', minHeight: 0 }}>
          {recentChats.length === 0 ? (
            <div className="rounded-4 p-3" style={{ 
              background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)',
              border: '1px solid rgba(115, 107, 146, 0.15)'
            }}>
              <div className="text-center mb-2" style={{ fontSize: '1.5rem' }}>👋</div>
              <h6 className="fw-bold text-center mb-2" style={{ fontSize: '0.85rem', color: '#736B92' }}>
                {t('sidebar.empty_state_title')}
              </h6>
              <div className="d-flex flex-column gap-2 mb-3" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                <div className="d-flex align-items-start gap-2">
                  <span style={{ color: '#736B92' }}>→</span>
                  <span>{t('sidebar.empty_state_step1')}</span>
                </div>
                <div className="d-flex align-items-start gap-2">
                  <span style={{ color: '#736B92' }}>→</span>
                  <span>{t('sidebar.empty_state_step2')}</span>
                </div>
                <div className="d-flex align-items-start gap-2">
                  <span style={{ color: '#736B92' }}>→</span>
                  <span>{t('sidebar.empty_state_step3')}</span>
                </div>
              </div>
              <button
                className="btn btn-sm w-100 fw-bold"
                style={{ 
                  background: '#736B92', 
                  color: '#fff', 
                  fontSize: '0.75rem',
                  borderRadius: '12px',
                  padding: '0.4rem 0.8rem',
                  border: 'none',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  handleNavigate('/browse/popular');
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#5d5675'}
                onMouseLeave={e => e.currentTarget.style.background = '#736B92'}
              >
                {t('sidebar.browse_characters')}
              </button>
            </div>
          ) : (
            <>
              {/* Mixed recent chats (scenes and characters) */}
              {recentChats.map(item => (
                <div
                  key={`${item.type}-${item.id}-${item.chat_id || 'unknown'}`}
                  className="recent-chat-menu-area list-group-item border-0 rounded-4 mb-1 p-0"
                  style={{ background: '#fff', position: 'relative', width: '100%' }}
                >
                  <div className="d-flex align-items-center" style={{ minHeight: 38, width: '100%' }}>
                    <button
                      type="button"
                      className="list-group-item-action d-flex align-items-center gap-2 border-0 rounded-4 fw-bold"
                      style={{
                        background: '#fff',
                        color: '#232323',
                        transition: 'background 0.16s, color 0.16s',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        width: '100%',
                        minWidth: 0,
                        textAlign: 'left',
                        padding: '0.28rem 2.2rem 0.28rem 0.4rem',
                      }}
                      onClick={() => {
                        if (item.type === 'scene') {
                          handleNavigate(`/chat?scene=${item.id}`);
                        } else {
                          handleNavigate(`/chat?character=${item.id}`);
                        }
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#232323'; }}
                    >
                      {item.type === 'scene' ? (
                        <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
                          <img
                            src={item.picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${item.picture.replace(/^\//, '')}` : defaultPicture}
                            alt={item.name}
                            className="rounded-circle border"
                            style={{ width: 38, height: 38, objectFit: 'cover', border: '1.6px solid #e9ecef' }}
                          />
                          {item.character_picture && (
                            <img
                              src={`${window.API_BASE_URL.replace(/\/$/, '')}/${item.character_picture.replace(/^\//, '')}`}
                              alt="Character"
                              className="rounded-circle border"
                              style={{
                                width: 18,
                                height: 18,
                                objectFit: 'cover',
                                border: '1.2px solid #fff',
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <img
                          src={item.picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${item.picture.replace(/^\//, '')}` : defaultPicture}
                          alt={item.name}
                          className="rounded-circle border"
                          style={{ width: 38, height: 38, objectFit: 'cover', border: '1.6px solid #e9ecef', flexShrink: 0 }}
                        />
                      )}
                      <span className="fw-bold text-truncate" style={{ color: '#232323', fontWeight: 700, flex: 1, minWidth: 0 }}>{item.name}</span>
                      {item.is_pinned && (
                        <i className="bi bi-pin-angle-fill" style={{ fontSize: '0.7rem', color: '#334155', flexShrink: 0 }}></i>
                      )}
                    </button>
                    <button
                      ref={(element) => {
                        if (element) {
                          chatMenuButtonRefs.current.set(item.chat_id, element);
                        } else {
                          chatMenuButtonRefs.current.delete(item.chat_id);
                        }
                      }}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setChatMenuOpenId((prev) => {
                          const nextId = prev === item.chat_id ? null : item.chat_id;
                          if (nextId) {
                            updateChatMenuPosition(nextId);
                          } else {
                            setChatMenuPosition(null);
                          }
                          return nextId;
                        });
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#6b7280',
                        cursor: 'pointer',
                        position: 'absolute',
                        top: '50%',
                        right: 6,
                        transform: 'translateY(-50%)',
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        zIndex: 2,
                      }}
                      aria-label={t('sidebar.chat_options') || 'Chat options'}
                      title={t('sidebar.chat_options') || 'Chat options'}
                    >
                      <i className="bi bi-three-dots"></i>
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {chatMenuOpenId && activeChatMenuItem && chatMenuPosition && createPortal(
        <div
          className="recent-chat-context-menu"
          style={{
            position: 'fixed',
            top: chatMenuPosition.top,
            left: chatMenuPosition.left,
            minWidth: chatMenuPosition.minWidth,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
            zIndex: 5000,
            padding: 6,
          }}
        >
          <button
            type="button"
            className="dropdown-item"
            style={{ borderRadius: 8, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleToggleRecentChatPin(activeChatMenuItem);
            }}
          >
            <i className={activeChatMenuItem.is_pinned ? 'bi bi-pin-angle' : 'bi bi-pin-angle-fill'}></i>
            {activeChatMenuItem.is_pinned
              ? (t('sidebar.unpin_chat') || 'Unpin chat')
              : (t('sidebar.pin_chat') || 'Pin chat')}
          </button>
          <button
            type="button"
            className="dropdown-item text-danger"
            style={{ borderRadius: 8, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDeleteRecentChat(activeChatMenuItem);
            }}
          >
            <i className="bi bi-trash"></i>
            {t('sidebar.delete_chat') || 'Delete chat'}
          </button>
        </div>,
        document.body
      )}

      {/* Pro Upgrade Button */}
      {userData && !userData?.pro_active && (
        <div className="px-1 mb-3" style={{ flexShrink: 0 }}>
          <div
            style={{
              position: 'relative',
              padding: '2px',
              borderRadius: 21,
              background: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #ff6b6b)',
              backgroundSize: '300% 100%',
              animation: 'rainbow-slide 4s linear infinite'
            }}
            title={t('sidebar.upgrade_to_pro_tooltip')}
          >
            <button
              className="fw-bold shadow-sm w-100 d-flex align-items-center justify-content-center"
              style={{
                fontSize: '0.86rem',
                letterSpacing: '0.4px',
                background: '#fff',
                borderRadius: 19,
                padding: '9px 0',
                border: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 700,
                transition: 'all 0.2s',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff'
              }}
              onClick={() => {
                handleNavigate('/pro-upgrade');
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
              }}
              tabIndex={0}
            >
              <span className="d-flex align-items-center justify-content-center w-100">
                <i className="bi bi-star-fill me-2"></i> {t('sidebar.upgrade_to_pro')}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Profile / Login */}
      <div className="mt-auto px-1" style={{ fontSize: '0.8rem', flexShrink: 0 }}>
        {userData && (
          <div className="rounded-4 mb-2" style={{ background: '#fff', border: '1px solid #eef0f3', padding: '0.45rem 0.65rem' }}>
            <div
              className="d-flex align-items-center justify-content-between"
              style={{
                color: '#4b5563',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <span>
                {getTokenQuotaLabel(userData?.token_cap_scope)}
              </span>
              <span>
                {(() => {
                  const used = Number(
                    userData?.token_cap_scope === 'monthly'
                      ? (userData?.monthly_token_usage || 0)
                      : (userData?.daily_token_usage || 0)
                  );
                  const cap = Number(userData?.token_cap || 0);
                  if (cap > 0) {
                    return `${formatCompactTokenCount(used)} / ${formatCompactTokenCount(cap)}`;
                  }
                  return formatCompactTokenCount(used);
                })()}
              </span>
            </div>
            <div
              className="d-flex align-items-center justify-content-between mt-1"
              style={{
                color: '#334155',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              <span>钱包Token</span>
              <span>{formatCompactTokenCount(Number(userData?.purchased_token_balance || 0))}</span>
            </div>
            <button
              type="button"
              className="btn btn-sm w-100 mt-2"
              onClick={() => handleNavigate('/token-topup')}
              style={{
                borderRadius: 8,
                background: '#111827',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.28rem 0.45rem',
                border: 'none',
              }}
            >
              充值 Token
            </button>
          </div>
        )}
  {userData ? (
          <div className="profile-dropdown-area position-relative">
            <button
              className={`btn border-0 w-100 d-flex align-items-center gap-3 shadow-sm rounded-4 py-2${profileOpen ? ' active' : ''}`}
              style={{ fontSize: '1rem', background: profileOpen ? '#dbeafe' : '#fff', color: '#232323', fontWeight: 700, transition: 'background 0.2s' }}
              onClick={() => setProfileOpen((v) => !v)}
              onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = '#f5f6fa'; }}
              onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = '#fff'; }}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              tabIndex={0}
            >
              <AvatarFrame badge={userData?.active_badge} size={32}>
                <img
                  src={userData?.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}` : defaultAvatar}
                  alt={userData?.name || 'User'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </AvatarFrame>
              <div className="flex-grow-1 text-start d-flex" style={{ minWidth: 0, lineHeight: 1.2 }}>
                <span
                  className="text-truncate"
                  style={{
                    color: isActivePro ? '#6f42c1' : '#232323',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    minWidth: 0,
                  }}
                >
                  {userData?.name || userData?.email}
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                {isActivePro && (
                  <span
                    className="fw-bold"
                    style={{
                      fontSize: '0.62rem',
                      lineHeight: 1,
                      padding: '0.2rem 0.36rem',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    PRO
                  </span>
                )}
              </div>
              <i className={`bi ms-auto ${profileOpen ? 'bi-chevron-down' : 'bi-chevron-up'}`} style={{ fontSize: '0.8rem' }}></i>
            </button>
            <ul
              className="dropdown-menu w-100 shadow rounded-4 show"
              style={{
                background: '#fff',
                color: '#232323',
                border: 'none',
                display: profileOpen ? 'block' : 'none',
                opacity: profileOpen ? 1 : 0,
                transform: profileOpen ? 'translateY(0)' : 'translateY(-8px)',
                transition: 'opacity 0.14s, transform 0.14s',
                marginBottom: 3,
                zIndex: 2000,
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '100%',
                fontSize: '0.8rem',
                maxWidth: '100%'
              }}
            >
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  onClick={() => { 
                    setProfileOpen(false); 
                    handleNavigate("/profile"); 
                  }}
                >
                  <i className="bi bi-person-circle me-2"></i> {t('sidebar.profile')}
                </button>
              </li>
              {userData?.is_admin && (
                <li>
                  <button
                    className="dropdown-item rounded-3 fw-bold"
                    style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                    onClick={() => { 
                      setProfileOpen(false); 
                      handleNavigate("/admin"); 
                    }}
                  >
                    <i className="bi bi-shield-lock me-2"></i> {t('sidebar.admin_panel')}
                  </button>
                </li>
              )}
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem', whiteSpace: 'normal', wordWrap: 'break-word' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                >
                  <i className="bi bi-box-arrow-right me-2"></i> {t('sidebar.logout')}
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="text-center small py-2">
            <button 
              className="btn rounded-pill px-3 py-1 fw-bold shadow-sm" 
              style={{ background: '#fff', color: '#232323', fontWeight: 700, fontSize: '0.8rem' }}
              onClick={() => {
                handleNavigate('/login');
              }}
            >
              <i className="bi bi-person-circle me-2" style={{ fontSize: '0.8rem' }}></i> {t('sidebar.login_to_continue')}
            </button>
          </div>
        )}
      </div>
      {/* Language Toggle moved to Topbar */}
    </aside>
  );
}