import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";
import TagsInput from '../components/TagsInput';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from "../components/PageWrapper";

export default function SceneFormPage() {
  const MAX_NAME_LENGTH = 50;
  const MAX_DESC_LENGTH = 500;
  const MAX_INTRO_LENGTH = 1000;
  const MAX_TAGS = 20;

  const params = useParams();
  const id = params.id;
  const mode = id ? 'edit' : 'create';
  console.log("SceneFormPage mode:", mode, id ? `(id: ${id})` : '');

  const { idToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sceneData, setSceneData] = useState({
    name: '',
    description: '',
    intro: '',
    tags: [],
  });
  const [picture, setPicture] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    if (mode === 'edit') {
      if (!id) {
        alert("Missing scene ID");
        navigate("/");
        return;
      }
      if (!idToken) {
        navigate("/");
        return;
      }
      fetch(`/api/scenes/${id}`, {
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
          setSceneData({
            name: data.name || '',
            description: data.description || '',
            intro: data.intro || '',
            tags: data.tags || [],
          });
          setPicture(null);
          setLoading(false);
        });
    }
  }, [mode, id, navigate, idToken]);

  const handleChange = (field, value) => {
    setSceneData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!idToken) {
      alert("You need to be logged in.");
      navigate("/");
      return;
    }
    if (!sceneData.name.trim() || !sceneData.description.trim()) {
      alert("Name and description are required.");
      return;
    }
    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    formData.append("name", sceneData.name.trim());
    formData.append("description", sceneData.description.trim());
    formData.append("intro", sceneData.intro.trim());
    sceneData.tags.forEach(tag => formData.append("tags", tag));
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? `/api/scenes/${id}` : "/api/scenes/", {
        method: mode === 'edit' ? "PUT" : "POST",
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(mode === 'edit' ? "Scene updated!" : "Scene created!");
        navigate("/profile");
      } else {
        alert(data.message || data.detail || `Failed to ${mode === 'edit' ? 'update' : 'create'} scene`);
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
    if (window.confirm("Are you sure you want to delete this scene?")) {
      const res = await fetch(`/api/scenes/${id}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await res.json();
      alert(data.message || data.detail || "Scene deleted");
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
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? 'Edit Scene' : 'Create New Scene'}</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Profile Picture */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Scene Picture</label>
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
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Name</label>
            <input
              className="form-control"
              required
              value={sceneData.name}
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
              {sceneData.name.length}/{MAX_NAME_LENGTH}
            </small>
          </div>

          {/* Description */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Description</label>
            <textarea
              className="form-control"
              rows="2"
              required
              value={sceneData.description}
              maxLength={MAX_DESC_LENGTH}
              onChange={e => handleChange('description', e.target.value)}
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
              {sceneData.description.length}/{MAX_DESC_LENGTH}
            </small>
          </div>

          {/* Intro */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Intro (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={sceneData.intro}
              maxLength={MAX_INTRO_LENGTH}
              onChange={e => handleChange('intro', e.target.value)}
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
              {sceneData.intro.length}/{MAX_INTRO_LENGTH}
            </small>
          </div>

          {/* Tags */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>Tags</label>
            <TagsInput tags={sceneData.tags} setTags={value => handleChange('tags', value)} maxTags={MAX_TAGS} />
            <small className="text-muted" style={{ top: 0, right: 0 }}>
              {sceneData.tags.length}/{MAX_TAGS} tags
            </small>
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
              <i className="bi bi-save me-2"></i>{mode === 'edit' ? 'Save Changes' : 'Save Scene'}
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
                <i className="bi bi-trash me-2"></i>Delete Scene
              </button>
            )}
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
