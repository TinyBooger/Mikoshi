import React, { useEffect, useState } from 'react';
import defaultAvatar from '../assets/images/default-avatar.png';
import defaultPicture from '../assets/images/default-picture.png';
import Sidebar from '../components/sidebar';
import Topbar from '../components/topbar';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState(null);

  useEffect(() => {
    fetch('/api/current-user')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        setEditName(data.name);
      })
      .catch(() => window.location.href = '/');

    fetch('/api/characters-created')
      .then(res => res.ok ? res.json() : [])
      .then(setCharacters);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editName);
    if (editPic) formData.append('profile_pic', editPic);

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const data = await res.json();
    alert(data.message || data.detail);
    if (res.ok) {
      setShowModal(false);
      window.location.reload();
    }
  };

  if (!user) return null;

  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <div style={{ width: 250, flexShrink: 0 }}>
        <Sidebar />
      </div>

      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <Topbar />
        <main className="flex-grow-1 p-4">
          <h2 className="mb-4">My Profile</h2>

          <div className="d-flex align-items-center gap-4 mb-4">
            <img
              src={user.profile_pic || defaultAvatar}
              alt="Profile"
              className="rounded-circle"
              width="100"
              height="100"
            />
            <div>
              <h3 className="mb-2">{user.name}</h3>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setShowModal(true)}>
                Edit Profile
              </button>
            </div>
          </div>

          <h4>Characters</h4>
          <div className="d-flex flex-wrap gap-3 mt-3">
            {characters.map(c => (
              <div
                key={c.id}
                className="card"
                style={{ width: 150, cursor: 'pointer' }}
                onClick={() => window.location.href = `/chat?character=${c.id}`}
              >
                <img
                  src={c.picture || defaultPicture}
                  className="card-img-top"
                  alt={c.name}
                  style={{ borderRadius: 8 }}
                />
                <div className="card-body p-2">
                  <h6 className="card-title mb-1 d-flex justify-content-between align-items-center">
                    {c.name}
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={e => {
                        e.stopPropagation();
                        window.location.href = `/edit-character?id=${c.id}`;
                      }}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  </h6>
                  <p className="text-muted mb-0" style={{ fontSize: 12 }}>
                    ❤️ {c.views}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleSave}>
              <div className="modal-header">
                <h5 className="modal-title">Edit Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Profile Picture</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={e => setEditPic(e.target.files[0])}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
