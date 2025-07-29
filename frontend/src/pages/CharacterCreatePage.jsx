import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import TagsInput from '../components/TagsInput'; // adjust path as needed
import { AuthContext } from '../components/AuthProvider';

export default function CharacterCreatePage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 200;
  const MAX_GREETING_LENGTH = 500;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;

  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [greeting, setGreeting] = useState('');
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState([]);
  const [sample, setSample] = useState('');
  const [picture, setPicture] = useState(null);
  const navigate = useNavigate();
  const { idToken } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!idToken) {
      alert("You need to be logged in to create a character.");
      navigate('/');
      return;
    }

    if (!name.trim() || !persona.trim()) {
      alert("Name and persona are required.");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("persona", persona.trim());
    formData.append("tagline", tagline.trim());
    tags.forEach(tag => formData.append("tags", tag));
    formData.append("greeting", greeting.trim());
    formData.append("sample_dialogue", sample.trim());
    if (picture) formData.append("picture", picture);

    try {
      const res = await fetch("/api/create-character", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert("Character created successfully!");
        navigate("/");
      } else {
        alert(data.message || data.detail || "Failed to create character");
      }
    } catch (error) {
      console.error("Error creating character:", error);
      alert("An error occurred while creating the character");
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
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Create New Character</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Name</label>
            <input
              className="form-control"
              required
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
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

          {/* Persona */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Persona</label>
            <textarea
              className="form-control"
              rows="3"
              required
              value={persona}
              maxLength={MAX_PERSONA_LENGTH}
              onChange={(e) => setPersona(e.target.value)}
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
              {persona.length}/{MAX_PERSONA_LENGTH}
            </small>
          </div>

          {/* Tagline */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Tagline</label>
            <input
              className="form-control"
              value={tagline}
              maxLength={MAX_TAGLINE_LENGTH}
              onChange={(e) => setTagline(e.target.value)}
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
              {tagline.length}/{MAX_TAGLINE_LENGTH}
            </small>
          </div>

          {/* Greeting */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Greeting (optional)</label>
            <input
              className="form-control"
              value={greeting}
              maxLength={MAX_GREETING_LENGTH}
              onChange={(e) => setGreeting(e.target.value)}
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
              {greeting.length}/{MAX_GREETING_LENGTH}
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

          {/* Sample Dialogue */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Sample Dialogue</label>
            <textarea
              className="form-control"
              rows="3"
              value={sample}
              maxLength={MAX_SAMPLE_LENGTH}
              onChange={(e) => setSample(e.target.value)}
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
              {sample.length}/{MAX_SAMPLE_LENGTH}
            </small>
          </div>

          {/* Profile Picture */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Profile Picture</label>
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={(e) => setPicture(e.target.files[0])}
              style={{
                background: '#f5f6fa',
                color: '#232323',
                border: '1.5px solid #e9ecef',
                borderRadius: 16,
                fontSize: '1.08rem',
                padding: '0.7rem 1.2rem',
                boxShadow: 'none',
                outline: 'none',
              }}
            />
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
            <i className="bi bi-save me-2"></i>Save Character
          </button>
        </form>
      </div>
    </div>
  );
}