import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AuthContext } from './AuthProvider.jsx'; // Import the AuthContext
import { useToast } from './ToastProvider.jsx';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';
import logo from '../assets/images/logo.png';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import TextButton from './TextButton';

export default function Sidebar() {
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const navigate = useNavigate();
  const { userData, sessionToken, loading } = useContext(AuthContext); // Get user data from context
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    const fetchRecentCharacters = async () => {
      if (!sessionToken) {
        setRecent([]);
        return;
      }

      setLoadingRecent(true);
      try {
        const response = await fetch(`${window.API_BASE_URL}/api/recent-characters`, {
          headers: {
            'Authorization': sessionToken
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setRecent(data);
        } else {
          console.error('Failed to fetch recent characters');
          setRecent([]);
        }
      } catch (error) {
        console.error('Error fetching recent characters:', error);
        setRecent([]);
      } finally {
        setLoadingRecent(false);
      }
    };

    fetchRecentCharacters();
  }, [sessionToken]);

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
      className="d-flex flex-column h-100 p-3"
      style={{
        minHeight: '80vh',
        background: 'rgba(255, 255, 255, 0.90)',
        color: '#232323',
        borderRight: '1.2px solid #e9ecef',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '1.5rem',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {/* Logo at top */}
      <div className="mb-3 d-flex align-items-center justify-content-center" style={{ minHeight: 144 }}>
        <a href="/" style={{ display: 'inline-block' }}>
          <img src={logo} alt="Logo" style={{ height: 138, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: 160 }} />
        </a>
      </div>
      {/* Top navigation */}
      <div className="d-flex flex-column gap-2 mb-1 position-relative">
        <div className="create-dropdown-area" style={{ position: 'relative' }}>
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
              left: '100%',
              top: 0,
              minWidth: 160,
              fontSize: '0.86rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
            }}
          >
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { setCreateOpen(false); if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); navigate('/character/create'); }}
              >
                <i className="bi bi-person-plus me-2"></i> {t('sidebar.create_character')}
              </button>
            </li>
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { setCreateOpen(false); if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); navigate('/scene/create'); }}
              >
                <i className="bi bi-easel2 me-2"></i> {t('sidebar.create_scene')}
              </button>
            </li>
            <li>
              <button
                className="dropdown-item rounded-3 fw-bold"
                style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.86rem' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                onClick={() => { setCreateOpen(false); if (!userData) return toast.show(t('sidebar.login_first'), { type: 'info' }); navigate('/persona/create'); }}
              >
                <i className="bi bi-person-badge me-2"></i> {t('sidebar.create_persona')}
              </button>
            </li>
          </ul>
        </div>
      </div>
      <button
        className="fw-bold shadow-sm w-100 d-flex align-items-center justify-content-center"
        style={{ fontSize: '0.86rem', letterSpacing: '0.4px', background: '#fff', color: '#232323', borderRadius: 19, padding: '9px 0', border: 'none', fontWeight: 700, transition: 'background 0.2s', marginBottom: 8 }}
        onClick={() => navigate('/browse/popular')}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
        tabIndex={0}
      >
        <span className="d-flex align-items-center justify-content-center w-100"><i className="bi bi-compass me-2"></i> {t('sidebar.browse')}</span>
      </button>

      {/* Recent chats */}
      <div className="mb-3 d-flex flex-column" style={{ minHeight: 0, flex: '1 1 auto', overflow: 'hidden' }}>
  <h6 className="fw-bold mb-1" style={{ color: '#6c757d', fontSize: '0.82rem', letterSpacing: '0.16px', flexShrink: 0 }}>{t('sidebar.recent_chats')}</h6>
        <div className="list-group rounded-4" style={{ background: 'transparent', boxShadow: 'none', overflowY: 'auto', minHeight: 0 }}>
          {recent.length === 0 ? (
            <div className="list-group-item text-center py-2 rounded-4" style={{ background: '#e9ecef', color: '#888', border: 'none', fontSize: '0.8rem' }}>{t('sidebar.no_recent_chats')}</div>
          ) : (
            recent.map(c => (
              <button
                key={c.id}
                className="list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 rounded-4 mb-1 fw-bold"
                style={{ background: '#fff', color: '#232323', minHeight: 38, transition: 'background 0.16s, color 0.16s', fontWeight: 600, fontSize: '0.8rem' }}
                onClick={() => navigate(`/chat?character=${c.id}`)}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#232323'; }}
              >
                <img
                  src={c.picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${c.picture.replace(/^\//, '')}` : defaultPicture}
                  alt={c.name}
                  className="rounded-circle border"
                  style={{ width: 38, height: 38, objectFit: 'cover', border: '1.6px solid #e9ecef' }}
                />
                <span className="fw-bold text-truncate" style={{ color: '#232323', fontWeight: 700 }}>{c.name}</span>
              </button>
            ))
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
              <img
                src={userData?.profile_pic ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}` : defaultAvatar}
                className="rounded-circle border"
                width="32"
                height="32"
                alt={userData?.name || 'User'}
                style={{ objectFit: 'cover', border: '1.6px solid #e9ecef' }}
              />
              <span className="flex-grow-1 text-start" style={{ color: '#232323', fontWeight: 700, fontSize: '0.8rem' }}>
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
                fontSize: '0.8rem'
              }}
            >
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                >
                  <i className="bi bi-person-circle me-2"></i> {t('sidebar.profile')}
                </button>
              </li>
              {userData?.is_admin && (
                <li>
                  <button
                    className="dropdown-item rounded-3 fw-bold"
                    style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                    onClick={() => { setProfileOpen(false); navigate("/admin"); }}
                  >
                    <i className="bi bi-shield-lock me-2"></i> {t('sidebar.admin_panel')}
                  </button>
                </li>
              )}
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.12s, color 0.12s', fontSize: '0.8rem' }}
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
              onClick={() => navigate('/login')}
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