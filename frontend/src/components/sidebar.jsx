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
    <aside className="d-flex flex-column h-100 p-4 bg-white border-end shadow-sm" style={{ minHeight: '100vh', maxWidth: 270 }}>
      {/* Top navigation */}
      <div className="d-flex flex-column gap-3 mb-4">
        <a
          href="/"
          className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: 48, height: 48, fontSize: 22 }}
        >
          <i className="bi bi-house-fill text-primary"></i>
        </a>
        <button
          className="btn btn-primary rounded-pill fw-semibold shadow-sm w-100"
          style={{ fontSize: '1rem', letterSpacing: '0.5px' }}
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
        <h6 className="fw-bold text-secondary mb-2">Recent Chats</h6>
        <div className="list-group rounded-4 shadow-sm">
          {recent.length === 0 ? (
            <div className="list-group-item text-muted text-center py-3 rounded-4">No recent chats</div>
          ) : (
            recent.map(c => (
              <button
                key={c.id}
                className="list-group-item list-group-item-action d-flex align-items-center gap-3 border-0 rounded-4 mb-1"
                style={{ transition: 'background 0.2s', minHeight: 48 }}
                onClick={() => navigate(`/chat?character=${c.id}`)}
              >
                <img
                  src={c.picture || defaultPicture}
                  alt={c.name}
                  className="rounded-circle border"
                  style={{ width: 36, height: 36, objectFit: 'cover' }}
                />
                <span className="fw-semibold text-dark">{c.name}</span>
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
              className="btn btn-light border-0 dropdown-toggle w-100 d-flex align-items-center gap-2 shadow-sm rounded-4 py-2"
              data-bs-toggle="dropdown"
              style={{ fontSize: '1rem' }}
            >
              <img
                src={userData?.profile_pic || defaultAvatar}
                className="rounded-circle border"
                width="36"
                height="36"
                alt={userData?.name || 'User'}
                style={{ objectFit: 'cover' }}
              />
              <span className="flex-grow-1 text-start text-dark fw-semibold">
                {userData?.name || currentUser.email}
              </span>
            </button>
            <ul className="dropdown-menu w-100 shadow rounded-4">
              <li>
                <button
                  className="dropdown-item rounded-3"
                  onClick={() => navigate("/profile")}
                >
                  <i className="bi bi-person-circle me-2"></i> Profile
                </button>
              </li>
              <li>
                <button className="dropdown-item rounded-3" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i> Log out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="text-muted text-center small py-3">
            <button 
              className="btn btn-outline-primary rounded-pill px-4 py-2 fw-semibold shadow-sm" 
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