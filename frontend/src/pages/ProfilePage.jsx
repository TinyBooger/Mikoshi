import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import CharacterCard from '../components/CharacterCard';
import defaultAvatar from '../assets/images/default-avatar.png';

export default function ProfilePage() {
  const MAX_NAME_LENGTH = 50;
  const TAB_TYPES = {
    CREATED: 'Created',
    LIKED: 'Liked'
  };

  const [user, setUser] = useState(null);
  const [createdCharacters, setCreatedCharacters] = useState([]);
  const [likedCharacters, setLikedCharacters] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_TYPES.CREATED);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/current-user')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        setEditName(data.name);
      })
      .catch(() => navigate('/'));

    fetch('/api/characters-created')
      .then(res => res.ok ? res.json() : [])
      .then(setCreatedCharacters);

    fetch('/api/characters-liked')
      .then(res => res.ok ? res.json() : [])
      .then(setLikedCharacters);
  }, [navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', editName.trim());
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

  const renderCharacters = () => {
    const characters = activeTab === TAB_TYPES.CREATED ? createdCharacters : likedCharacters;
    
    return (
      <div className="d-flex flex-wrap gap-3 mt-3">
        {characters.map(c => (
          <div key={c.id} style={{ width: 150 }}>
            <CharacterCard character={c} />
            {activeTab === TAB_TYPES.CREATED && (
              <button
                className="btn btn-sm btn-outline-secondary w-100 mt-1"
                onClick={() => navigate(`/character-edit?id=${c.id}`)}
              >
                <i className="bi bi-pencil-square"></i> Edit
              </button>
            )}
          </div>
        ))}
        {characters.length === 0 && (
          <p className="text-muted">
            {activeTab === TAB_TYPES.CREATED 
              ? "You haven't created any characters yet." 
              : "You haven't liked any characters yet."}
          </p>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="d-flex" style={{ height: '100vh' }}>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="flex-grow-1 p-4">
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

          <div className="mb-3">
            <ul className="nav nav-tabs">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === TAB_TYPES.CREATED ? 'active' : ''}`}
                  onClick={() => setActiveTab(TAB_TYPES.CREATED)}
                >
                  Created
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === TAB_TYPES.LIKED ? 'active' : ''}`}
                  onClick={() => setActiveTab(TAB_TYPES.LIKED)}
                >
                  Liked
                </button>
              </li>
            </ul>
          </div>

          <h4>{activeTab} Characters</h4>
          {renderCharacters()}
        </div>
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
                <div className="mb-3 position-relative">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ paddingRight: "3rem" }}
                  />
                  <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                    {editName.length}/{MAX_NAME_LENGTH}
                  </small>
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