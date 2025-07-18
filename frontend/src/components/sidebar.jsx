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
    <aside className="d-flex flex-column h-100 p-3 bg-light border-end" style={{ minHeight: '100vh' }}>
      <div className="d-flex flex-column gap-3">
        <a
          href="/"
          className="btn btn-light rounded-circle p-2 d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: 40, height: 40 }}
        >
          <i className="bi bi-house-fill text-dark"></i>
        </a>
        <button
          className="btn btn-outline-secondary mb-3 w-100"
          onClick={() => {
            if (!currentUser) return alert("Please login first");
            navigate("/character-create");
          }}
        >
          + Create Character
        </button>
      </div>

      <ul className="list-group mb-3">
        {recent.length === 0 ? (
          <li className="list-group-item text-muted">No recent chats</li>
        ) : (
          recent.map(c => (
            <button
              key={c.id}
              className="list-group-item list-group-item-action d-flex align-items-center gap-2"
              onClick={() => navigate(`/chat?character=${c.id}`)}
            >
              <img
                src={c.picture || defaultPicture}
                alt={c.name}
                className="rounded-circle"
                style={{ width: 30, height: 30 }}
              />
              <span>{c.name}</span>
            </button>
          ))
        )}
      </ul>

      <div className="mt-auto px-2">
        {currentUser ? (
          <div className="dropdown">
            <button
              className="btn btn-outline-light border dropdown-toggle w-100 d-flex align-items-center gap-2"
              data-bs-toggle="dropdown"
            >
              <img
                src={userData?.profile_pic || defaultAvatar}
                className="rounded-circle"
                width="32"
                height="32"
                alt={userData?.name || 'User'}
              />
              <span className="flex-grow-1 text-start text-dark">
                {userData?.name || currentUser.email}
              </span>
            </button>
            <ul className="dropdown-menu w-100">
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => navigate("/profile")}
                >
                  Profile
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Log out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <div className="text-muted text-center small">
            <button 
              className="btn btn-link p-0" 
              onClick={() => navigate('/login')}
            >
              Log in to continue
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}