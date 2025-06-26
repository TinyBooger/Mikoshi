import React, { useEffect, useState } from 'react';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function Sidebar() {
  const [user, setUser] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/current-user`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setUser(data));

    fetch(`${API_BASE}/api/recent-characters`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : []))
      .then(setRecent);
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/logout`, {
      method: "POST",
      credentials: 'include'
    });
    location.reload();
  };

  return (
    <aside className="d-flex flex-column h-100 p-3 bg-light border-end">
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
            if (!user) return alert("Please login first");
            window.location.href = "/character-create";
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
              onClick={() => window.location.href = `/chat?character=${c.id}`}
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
        {user ? (
          <div className="dropdown">
            <button
              className="btn btn-outline-light border dropdown-toggle w-100 d-flex align-items-center gap-2"
              data-bs-toggle="dropdown"
            >
              <img
                src={user.profile_pic || defaultAvatar}
                className="rounded-circle"
                width="32"
                height="32"
              />
              <span className="flex-grow-1 text-start text-dark">{user.name}</span>
            </button>
            <ul className="dropdown-menu w-100">
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => window.location.href = "/profile"}
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
          <div className="text-muted text-center small">Failed to load user</div>
        )}
      </div>
    </aside>
  );
}
