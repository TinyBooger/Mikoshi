import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import TagsInput from '../components/TagsInput';
import { AuthContext } from '../components/AuthProvider';

export default function SceneCreatePage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_DESCRIPTION_LENGTH = 1000;
  const MAX_INTRO_LENGTH = 255;
  const MAX_TAGS = 20;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intro, setIntro] = useState('');
  const [tags, setTags] = useState([]);
  const navigate = useNavigate();
  const { idToken } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idToken) {
      alert('You need to be logged in to create a scene.');
      navigate('/');
      return;
    }
    if (!name.trim() || !description.trim()) {
      alert('Name and description are required.');
      return;
    }
    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('description', description.trim());
    formData.append('intro', intro.trim());
    tags.forEach(tag => formData.append('tags', tag));
    try {
      const res = await fetch('/api/scenes/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('Scene created successfully!');
        navigate('/');
      } else {
        alert(data.message || data.detail || 'Failed to create scene');
      }
    } catch (error) {
      console.error('Error creating scene:', error);
      alert('An error occurred while creating the scene');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bs-body-bg, #f8f9fa)',
      color: '#18191a',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '2.5rem 0',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 700,
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '2.5rem 2rem',
        margin: '0 auto',
      }}>
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Create New Scene</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Name</label>
            <input
              className="form-control"
              required
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={e => setName(e.target.value)}
              style={{
                background: '#f5f6fa',
                color: '#18191a',
                border: '1.5px solid #e9ecef',
                borderRadius: 16,
                fontSize: '1.08rem',
                padding: '0.7rem 1.2rem',
                boxShadow: 'none',
                outline: 'none',
                paddingRight: '3rem',
              }}
            />
            <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
              {name.length}/{MAX_NAME_LENGTH}
            </small>
          </div>

          {/* Description */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Description</label>
            <textarea
              className="form-control"
              rows="3"
              required
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={e => setDescription(e.target.value)}
              style={{
                background: '#f5f6fa',
                color: '#18191a',
                border: '1.5px solid #e9ecef',
                borderRadius: 16,
                fontSize: '1.08rem',
                padding: '0.7rem 1.2rem',
                boxShadow: 'none',
                outline: 'none',
                paddingRight: '3rem',
                resize: 'vertical',
              }}
            />
            <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </small>
          </div>


          {/* Intro */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Intro <span className="text-muted">(short, optional)</span></label>
            <input
              className="form-control"
              value={intro}
              maxLength={MAX_INTRO_LENGTH}
              onChange={e => setIntro(e.target.value)}
              style={{
                background: '#f5f6fa',
                color: '#18191a',
                border: '1.5px solid #e9ecef',
                borderRadius: 16,
                fontSize: '1.08rem',
                padding: '0.7rem 1.2rem',
                boxShadow: 'none',
                outline: 'none',
                paddingRight: '3rem',
              }}
            />
            <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
              {intro.length}/{MAX_INTRO_LENGTH}
            </small>
          </div>

          {/* Tags */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Tags</label>
            <TagsInput tags={tags} setTags={setTags} maxTags={MAX_TAGS} />
            <small className="text-muted" style={{ top: 0, right: 0 }}>
              {tags.length}/{MAX_TAGS} tags
            </small>
          </div>

          <button type="submit" className="fw-bold rounded-pill mt-2" style={{
            background: '#18191a',
            color: '#fff',
            border: 'none',
            fontSize: '1.08rem',
            padding: '0.5rem 2rem',
            letterSpacing: '0.2px',
            transition: 'background 0.18s, color 0.18s',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
          >
            <i className="bi bi-save me-2"></i>Save Scene
          </button>
        </form>
      </div>
    </div>
  );
}
