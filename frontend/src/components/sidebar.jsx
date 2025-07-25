import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from './AuthProvider.jsx'; // Import the AuthContext
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

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

  return (
    <aside className="d-flex flex-column h-100 p-4" style={{ minHeight: '100vh', maxWidth: 270, background: '#18191a', color: '#fff', borderRight: '1.5px solid #232323', fontFamily: 'Inter, sans-serif' }}>
      {/* Top navigation */}
      <div className="d-flex flex-column gap-3 mb-4">
        <a
          href="/"
          className="d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: 48, height: 48, fontSize: 22, background: '#232323', borderRadius: 16 }}
        >
          <i className="bi bi-house-fill" style={{ color: '#fff' }}></i>
        </a>
        <button
          className="fw-bold shadow-sm w-100"
          style={{ fontSize: '1.08rem', letterSpacing: '0.5px', background: '#fff', color: '#18191a', borderRadius: 24, padding: '10px 0', border: 'none' }}
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
        <h6 className="fw-bold mb-2" style={{ color: '#b0b3b8', fontSize: '1.02rem', letterSpacing: '0.2px' }}>Recent Chats</h6>
        <div className="list-group rounded-4" style={{ background: 'transparent', boxShadow: 'none' }}>
          {recent.length === 0 ? (
            <div className="list-group-item text-center py-3 rounded-4" style={{ background: '#232323', color: '#888', border: 'none' }}>No recent chats</div>
          ) : (
            recent.map(c => (
              <button
                key={c.id}
                className="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 rounded-4 mb-1 fw-bold"
                style={{ background: '#232323', color: '#fff', minHeight: 48, transition: 'background 0.2s, color 0.2s', fontWeight: 600 }}
                onClick={() => navigate(`/chat?character=${c.id}`)}
                onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#232323'; e.currentTarget.style.color = '#fff'; }}
              >
                <img
                  src={c.picture || defaultPicture}
                  alt={c.name}
                  className="rounded-circle border"
                  style={{ width: 36, height: 36, objectFit: 'cover', border: '2px solid #444' }}
                />
                <span className="fw-bold text-truncate" style={{ color: '#fff', fontWeight: 700 }}>{c.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Profile / Login */}
      <div className="mt-auto px-1">
        {currentUser ? (
          <div className="dropdown">
            <button
              className="btn border-0 dropdown-toggle w-100 d-flex align-items-center gap-2 shadow-sm rounded-4 py-2"
              data-bs-toggle="dropdown"
              style={{ fontSize: '1rem', background: '#232323', color: '#fff', fontWeight: 700 }}
            >
              <img
                src={userData?.profile_pic || defaultAvatar}
                className="rounded-circle border"
                width="36"
                height="36"
                alt={userData?.name || 'User'}
                style={{ objectFit: 'cover', border: '2px solid #444' }}
              />
              <span className="flex-grow-1 text-start" style={{ color: '#fff', fontWeight: 700 }}>
                {userData?.name || currentUser.email}
              </span>
            </button>
            <ul className="dropdown-menu w-100 shadow rounded-4" style={{ background: '#232323', color: '#fff', border: 'none' }}>
              <li>
                <button
                  className="dropdown-item rounded-3 fw-bold"
                  style={{ color: '#fff', background: 'transparent' }}
                  onClick={() => navigate("/profile")}
                >
                  <i className="bi bi-person-circle me-2"></i> Profile
                </button>
              </li>
              <li>
                <button className="dropdown-item rounded-3 fw-bold" style={{ color: '#fff', background: 'transparent' }} onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i> Log out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="text-center small py-3">
            <button 
              className="btn rounded-pill px-4 py-2 fw-bold shadow-sm" 
              style={{ background: '#fff', color: '#18191a', fontWeight: 700 }}
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