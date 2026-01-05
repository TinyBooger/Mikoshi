import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useOutletContext } from 'react-router';
import { AuthContext } from './AuthProvider.jsx'; // Import the AuthContext
import { useToast } from './ToastProvider.jsx';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';
import logo from '../assets/images/logo.png';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import TextButton from './TextButton';
import AvatarFrame from './AvatarFrame';

export default function Sidebar({ isMobile, setSidebarVisible }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, sessionToken, loading } = useContext(AuthContext); // Get user data from context
  const { t } = useTranslation();
  const toast = useToast();
  
  // Helper function to close sidebar and navigate immediately
  const handleNavigate = (path) => {
    // Only close sidebar on mobile devices
    if (isMobile && setSidebarVisible) {
      setSidebarVisible(false);
    }
    navigate(path);
  };

  // Derive recent chats mixed (scene and character) in time order
  const recentChats = useMemo(() => {
    if (!userData?.chat_history) return [];

    // Sort chats by last_updated descending
    const sorted = [...userData.chat_history].sort(
      (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
    );

    // Keep only the most recent item per entity (scene or character)
    const seen = new Set();
    const items = [];

    for (const chat of sorted) {
      const isScene = !!chat.scene_id;
      const key = isScene ? `scene:${chat.scene_id}` : (chat.character_id ? `character:${chat.character_id}` : null);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      if (isScene) {
        items.push({
          type: 'scene',
          id: chat.scene_id,
          character_id: chat.character_id,
          name: chat.scene_name || 'Unknown Scene',
          picture: chat.scene_picture,
          character_picture: chat.character_picture,
          last_updated: chat.last_updated,
        });
      } else if (chat.character_id) {
        items.push({
          type: 'character',
          id: chat.character_id,
          name: chat.character_name || 'Unknown Character',
          picture: chat.character_picture,
          last_updated: chat.last_updated,
        });
      }
    }

    return items.slice(0, 10);
  }, [userData?.chat_history]);

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
        borderRadius: '1.5rem',
        width: '100%',
        maxWidth: '100%',
        padding: isMobile ? '0.75rem' : '1rem',
        overflow: 'visible',
      }}
    >
      {/* Logo at top */}
      <div className="mb-3 d-flex align-items-center justify-content-center" style={{ minHeight: isMobile ? 100 : 144 }}>
        <a 
          href="/" 
          style={{ display: 'inline-block' }}
          onClick={(e) => {
            e.preventDefault();
            handleNavigate('/');
          }}
        >
          <img src={logo} alt="Logo" style={{ height: isMobile ? 90 : 138, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: isMobile ? 120 : 160 }} />
        </a>
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
      <div className="mb-3 d-flex flex-column" style={{ minHeight: 0, flex: '1 1 auto', overflowX: 'hidden', overflowY: 'auto' }}>
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
                item.type === 'scene' ? (
                  <button
                    key={`scene-${item.id}`}
                    className="list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 rounded-4 mb-1 fw-bold"
                    style={{ background: '#fff', color: '#232323', minHeight: 38, transition: 'background 0.16s, color 0.16s', fontWeight: 600, fontSize: '0.8rem' }}
                    onClick={() => {
                      handleNavigate(`/chat?scene=${item.id}`);
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#232323'; }}
                  >
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
                    <span className="fw-bold text-truncate" style={{ color: '#232323', fontWeight: 700 }}>{item.name}</span>
                  </button>
                ) : (
                  <button
                    key={`character-${item.id}`}
                    className="list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 rounded-4 mb-1 fw-bold"
                    style={{ background: '#fff', color: '#232323', minHeight: 38, transition: 'background 0.16s, color 0.16s', fontWeight: 600, fontSize: '0.8rem' }}
                    onClick={() => {
                      handleNavigate(`/chat?character=${item.id}`);
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#232323'; }}
                  >
                    <img
                      src={item.picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${item.picture.replace(/^\//, '')}` : defaultPicture}
                      alt={item.name}
                      className="rounded-circle border"
                      style={{ width: 38, height: 38, objectFit: 'cover', border: '1.6px solid #e9ecef' }}
                    />
                    <span className="fw-bold text-truncate" style={{ color: '#232323', fontWeight: 700 }}>{item.name}</span>
                  </button>
                )
              ))}
            </>
          )}
        </div>
      </div>

      {/* Profile / Login */}
      <div className="mt-auto px-1" style={{ fontSize: '0.8rem', flexShrink: 0 }}>
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
              <span className="flex-grow-1 text-start text-truncate" style={{ color: '#232323', fontWeight: 700, fontSize: '0.8rem' }}>
                {userData?.name || userData?.email}
              </span>
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