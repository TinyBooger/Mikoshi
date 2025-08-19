import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";
import TagsInput from '../components/TagsInput';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';

export default function CharacterFormPage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 200;
  // Get id param from route
  const params = useParams();
  const id = params.id;
  const mode = id ? 'edit' : 'create';
  // Log the current mode for debugging
  console.log("CharacterFormPage mode:", mode, id ? `(id: ${id})` : '');
  const MAX_GREETING_LENGTH = 500;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;

  const { idToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [charData, setCharData] = useState({
    name: '',
    persona: '',
    sample: '',
    tagline: '',
    tags: [],
    greeting: '',
  });
  const [picture, setPicture] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    if (mode === 'edit') {
      if (!id) {
        alert("Missing character ID");
        navigate("/");
        return;
      }
      if (!idToken) {
        navigate("/");
        return;
      }
      fetch(`/api/character/${id}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => {
          if (!res.ok) {
            navigate("/");
            return;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;
          setCharData({
            name: data.name || '',
            persona: data.persona || '',
            sample: data.example_messages || '',
            tagline: data.tagline || '',
            tags: data.tags || [],
            greeting: data.greeting || '',
          });
          setLoading(false);
        });
    }
  }, [mode, id, navigate, idToken]);

  const handleChange = (field, value) => {
    setCharData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!idToken) {
      alert("You need to be logged in.");
      navigate("/");
      return;
    }
    if (!charData.name.trim() || !charData.persona.trim()) {
      alert("Name and persona are required.");
      return;
    }
    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    formData.append("name", charData.name.trim());
    formData.append("persona", charData.persona.trim());
    formData.append("tagline", charData.tagline.trim());
    charData.tags.forEach(tag => formData.append("tags", tag));
    formData.append("greeting", charData.greeting.trim());
    formData.append("sample_dialogue", charData.sample.trim());
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? "/api/update-character" : "/api/create-character", {
        method: "POST",
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(mode === 'edit' ? "Character updated!" : "Character created!");
        navigate(mode === 'edit' ? "/profile" : "/");
      } else {
        alert(data.message || data.detail || `Failed to ${mode === 'edit' ? 'update' : 'create'} character`);
      }
    } catch (error) {
      alert("An error occurred.");
    }
  };

  const handleDelete = async () => {
    if (!idToken) {
      navigate("/");
      return;
    }
    if (window.confirm("Are you sure you want to delete this character?")) {
      const res = await fetch(`/api/character/${id}/delete`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await res.json();
      alert(data.message || data.detail || "Character deleted");
      if (res.ok) navigate("/profile");
    }
  };

  if (loading) return null;

  return (
    <PageWrapper>
      <div style={{
        width: '100%',
        maxWidth: 700,
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '2.5rem 2rem',
        margin: '0 auto',
      }}>
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? 'Edit Character' : 'Create New Character'}</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Name</label>
            <input
              className="form-control"
              required
              value={charData.name}
              maxLength={MAX_NAME_LENGTH}
              onChange={e => handleChange('name', e.target.value)}
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
              {charData.name.length}/{MAX_NAME_LENGTH}
            </small>
          </div>

          {/* Persona */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Persona</label>
            <textarea
              className="form-control"
              rows="3"
              required
              value={charData.persona}
              maxLength={MAX_PERSONA_LENGTH}
              onChange={e => handleChange('persona', e.target.value)}
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
              {charData.persona.length}/{MAX_PERSONA_LENGTH}
            </small>
          </div>

          {/* Tagline */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Tagline</label>
            <input
              className="form-control"
              value={charData.tagline}
              maxLength={MAX_TAGLINE_LENGTH}
              onChange={e => handleChange('tagline', e.target.value)}
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
              {charData.tagline.length}/{MAX_TAGLINE_LENGTH}
            </small>
          </div>

          {/* Greeting */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Greeting (optional)</label>
            <input
              className="form-control"
              value={charData.greeting}
              maxLength={MAX_GREETING_LENGTH}
              onChange={e => handleChange('greeting', e.target.value)}
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
              {charData.greeting.length}/{MAX_GREETING_LENGTH}
            </small>
          </div>

          {/* Tags */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Tags</label>
            <TagsInput tags={charData.tags} setTags={value => handleChange('tags', value)} maxTags={MAX_TAGS} />
            <small className="text-muted" style={{ top: 0, right: 0 }}>
              {charData.tags.length}/{MAX_TAGS} tags
            </small>
          </div>

          {/* Sample Dialogue */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Sample Dialogue</label>
            <textarea
              className="form-control"
              rows="3"
              value={charData.sample}
              maxLength={MAX_SAMPLE_LENGTH}
              onChange={e => handleChange('sample', e.target.value)}
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
              {charData.sample.length}/{MAX_SAMPLE_LENGTH}
            </small>
          </div>

          {/* Profile Picture */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Profile Picture</label>
            <input
              type="file"
              accept="image/*"
              className="form-control"
              onChange={e => setPicture(e.target.files[0])}
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

          <div className="d-flex gap-3 mt-4 justify-content-end">
            <button
              type="submit"
              className="fw-bold rounded-pill"
              style={{
                background: '#18191a',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                fontSize: '1.08rem',
                padding: '0.5rem 2.2rem',
                letterSpacing: '0.2px',
                transition: 'background 0.18s, color 0.18s',
                outline: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#232323';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#18191a';
              }}
            >
              <i className="bi bi-save me-2"></i>{mode === 'edit' ? 'Save Changes' : 'Save Character'}
            </button>
            {mode === 'edit' && (
              <button
                type="button"
                className="fw-bold rounded-pill"
                style={{
                  background: '#fff',
                  color: '#d32f2f',
                  border: '1.5px solid #d32f2f',
                  boxShadow: 'none',
                  fontSize: '1.08rem',
                  padding: '0.5rem 2.2rem',
                  letterSpacing: '0.2px',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#d32f2f';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = '#d32f2f';
                }}
                onClick={handleDelete}
              >
                <i className="bi bi-trash me-2"></i>Delete Character
              </button>
            )}
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
