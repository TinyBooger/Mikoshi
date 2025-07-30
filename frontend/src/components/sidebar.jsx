import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from './AuthProvider.jsx'; // Import the AuthContext
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';
import logo from '../assets/images/logo.png';

export default function Sidebar() {
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const navigate = useNavigate();
  const { currentUser, userData, idToken, loading } = useContext(AuthContext); // Get user data from context

  useEffect(() => {
    const fetchRecentCharacters = async () => {
      if (!currentUser) {
        setRecent([]);
        return;
      }

      setLoadingRecent(true);
      try {
        const response = await fetch('/api/recent-characters', {
          headers: {
            'Authorization': `Bearer ${idToken}`
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
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth); // Firebase sign out
      navigate('/'); // Redirect to login page
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
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
  // Close dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.profile-dropdown-area')) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  return (
    <aside className="d-flex flex-column h-100 p-4" style={{ minHeight: '100vh', maxWidth: 340, background: '#f5f6fa', color: '#232323', borderRight: '1.5px solid #e9ecef', fontFamily: 'Inter, sans-serif', width: 340 }}>
      {/* Logo at top */}
      <div className="mb-4 d-flex align-items-center justify-content-center" style={{ minHeight: 180 }}>
        <a href="/" style={{ display: 'inline-block' }}>
          <img src={logo} alt="Logo" style={{ height: 172, width: 'auto', objectFit: 'contain', display: 'block', maxWidth: 200 }} />
        </a>
      </div>
      {/* Top navigation */}
      <div className="d-flex flex-column gap-3 mb-4">
        <button
          className="fw-bold shadow-sm w-100"
          style={{ fontSize: '1.08rem', letterSpacing: '0.5px', background: '#fff', color: '#232323', borderRadius: 24, padding: '12px 0 12px 0', border: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          onClick={() => {
            if (!currentUser) return alert("Please login first");
            navigate("/character-create");
          }}
        >
          <i className="bi bi-plus-circle me-2"></i> Create Character
        </button>
      </div>

      {/* Recent chats */}
      <div className="mb-4">
        <h6 className="fw-bold mb-2" style={{ color: '#6c757d', fontSize: '1.02rem', letterSpacing: '0.2px' }}>Recent Chats</h6>
        <div className="list-group rounded-4" style={{ background: 'transparent', boxShadow: 'none' }}>
          {recent.length === 0 ? (
            <div className="list-group-item text-center py-3 rounded-4" style={{ background: '#e9ecef', color: '#888', border: 'none' }}>No recent chats</div>
          ) : (
            recent.map(c => (
              <button
                key={c.id}
                className="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 rounded-4 mb-1 fw-bold"
                style={{ background: '#fff', color: '#232323', minHeight: 48, transition: 'background 0.2s, color 0.2s', fontWeight: 600 }}
                onClick={() => navigate(`/chat?character=${c.id}`)}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#232323'; }}
              >
                <img
                  src={c.picture || defaultPicture}
                  alt={c.name}
                  className="rounded-circle border"
                  style={{ width: 48, height: 48, objectFit: 'cover', border: '2px solid #e9ecef' }}
                />
                <span className="fw-bold text-truncate" style={{ color: '#232323', fontWeight: 700 }}>{c.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Profile / Login */}
      <div className="mt-auto px-1">
        {currentUser ? (
          <div className="profile-dropdown-area position-relative">
            <button
              className={`btn border-0 w-100 d-flex align-items-center gap-2 shadow-sm rounded-4 py-2${profileOpen ? ' active' : ''}`}
              style={{ fontSize: '1rem', background: profileOpen ? '#dbeafe' : '#e9ecef', color: '#232323', fontWeight: 700, transition: 'background 0.2s' }}
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              tabIndex={0}
            >
              <img
                src={userData?.profile_pic || defaultAvatar}
                className="rounded-circle border"
                width="36"
                height="36"
                alt={userData?.name || 'User'}
                style={{ objectFit: 'cover', border: '2px solid #e9ecef' }}
              />
              <span className="flex-grow-1 text-start" style={{ color: '#232323', fontWeight: 700 }}>
                {userData?.name || currentUser.email}
              </span>
              <i className={`bi ms-auto ${profileOpen ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
            </button>
            <ul
              className="dropdown-menu w-100 shadow rounded-4 show"
              style={{
                background: '#fff',
                color: '#232323',
                border: 'none',
                display: profileOpen ? 'block' : 'none',
                opacity: profileOpen ? 1 : 0,
                transform: profileOpen ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'opacity 0.18s, transform 0.18s',
                marginBottom: 4,
                zIndex: 2000,
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '100%'
              }}
            >
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  onClick={() => { setProfileOpen(false); navigate("/profile"); }}
                >
                  <i className="bi bi-person-circle me-2"></i> Profile
                </button>
              </li>
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#232323', background: 'transparent', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; e.currentTarget.style.color = '#232323'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                >
                  <i className="bi bi-box-arrow-right me-2"></i> Log out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="text-center small py-3">
            <button 
              className="btn rounded-pill px-4 py-2 fw-bold shadow-sm" 
              style={{ background: '#fff', color: '#232323', fontWeight: 700 }}
              onClick={() => navigate('/login')}
            >
              <i className="bi bi-person-circle me-2"></i> Log in to continue
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}