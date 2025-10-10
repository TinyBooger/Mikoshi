import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";
import TagsInput from '../components/TagsInput';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from "../components/PageWrapper";
import { useTranslation } from 'react-i18next';

export default function PersonaFormPage() {
  const { t } = useTranslation();
  const MAX_NAME_LENGTH = 50;
  const MAX_DESC_LENGTH = 500;
  const MAX_INTRO_LENGTH = 1000;
  const MAX_TAGS = 20;

  const params = useParams();
  const id = params.id;
  const mode = id ? 'edit' : 'create';
  console.log("PersonaFormPage mode:", mode, id ? `(id: ${id})` : '');

  const { idToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const [personaData, setPersonaData] = useState({
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
        alert("Missing persona ID");
        navigate("/");
        return;
      }
      if (!idToken) {
        navigate("/");
        return;
      }
      fetch(`${window.API_BASE_URL}/api/personas/${id}`, {
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
          setPersonaData({
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
    setPersonaData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!idToken) {
      alert("You need to be logged in.");
      navigate("/");
      return;
    }
    if (!personaData.name.trim()) {
      alert("Name is required.");
      return;
    }
    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    formData.append("name", personaData.name.trim());
    formData.append("description", personaData.description.trim());
    formData.append("intro", personaData.intro.trim());
    personaData.tags.forEach(tag => formData.append("tags", tag));
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/personas/${id}` : `${window.API_BASE_URL}/api/personas/`, {
        method: mode === 'edit' ? "PUT" : "POST",
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert(mode === 'edit' ? "Persona updated!" : "Persona created!");
        navigate("/profile");
      } else {
        alert(data.message || data.detail || `Failed to ${mode === 'edit' ? 'update' : 'create'} persona`);
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
    if (window.confirm("Are you sure you want to delete this persona?")) {
      const res = await fetch(`${window.API_BASE_URL}/api/personas/${id}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await res.json();
      alert(data.message || data.detail || "Persona deleted");
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
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? t('persona_form.edit_title') : t('persona_form.create_title')}</h2>
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Profile Picture */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.picture')}</label>
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.name')}</label>
            <input
              className="form-control"
              required
              value={personaData.name}
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
              {personaData.name.length}/{MAX_NAME_LENGTH}
            </small>
          </div>

          {/* Description */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.description')}</label>
            <textarea
              className="form-control"
              rows="2"
              value={personaData.description}
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
              {personaData.description.length}/{MAX_DESC_LENGTH}
            </small>
          </div>

          {/* Intro */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.intro')}</label>
            <textarea
              className="form-control"
              rows="3"
              value={personaData.intro}
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
              {personaData.intro.length}/{MAX_INTRO_LENGTH}
            </small>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.tags')}</label>
            <TagsInput
              tags={personaData.tags}
              setTags={tags => handleChange('tags', tags)}
              maxTags={MAX_TAGS}
            />
          </div>
          <div className="d-flex gap-3 mt-4">
            <button type="submit" className="btn btn-dark px-4 fw-bold">
              {mode === 'edit' ? t('persona_form.save') : t('persona_form.create')}
            </button>
            {mode === 'edit' && (
              <button type="button" className="btn btn-outline-danger px-4 fw-bold" onClick={handleDelete}>
                {t('persona_form.delete')}
              </button>
            )}
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
