import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";
import TagsInput from '../components/TagsInput';
import ImageCropModal from '../components/ImageCropModal';
import { createPortal } from 'react-dom';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from "../components/PageWrapper";
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import { silentExpGain } from '../utils/expUtils';

export default function PersonaFormPage() {
  const { t } = useTranslation();
  const MAX_NAME_LENGTH = 50;
  const MAX_DESC_LENGTH = 1000; // ~1000 words
  const MAX_INTRO_LENGTH = 200; // one sentence
  const MAX_TAGS = 20;

  const params = useParams();
  const id = params.id;
  const mode = id ? 'edit' : 'create';
  const { sessionToken, userData } = useContext(AuthContext);
  const userLevel = Number(userData?.level || 1);
  const canFork = userLevel >= 2;
  const toast = useToast();
  const navigate = useNavigate();
  const [personaData, setPersonaData] = useState({
    name: '',
    description: '',
    intro: '',
    tags: [],
    is_public: true,
    is_forkable: false,
  });
  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    if (!canFork && personaData.is_forkable) {
      setPersonaData(prev => ({ ...prev, is_forkable: false }));
    }
  }, [canFork, personaData.is_forkable]);

  useEffect(() => {
    if (mode === 'edit') {
      if (!id) {
        toast.show(t('persona_form.missing_id'), { type: 'error' });
        navigate("/");
        return;
      }
  if (!sessionToken) {
        navigate("/");
        return;
      }
      fetch(`${window.API_BASE_URL}/api/personas/${id}`, {
  headers: { 'Authorization': sessionToken }
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
            is_public: !!data.is_public,
            is_forkable: !!data.is_forkable,
          });
          setPicture(null);
          setLoading(false);
        });
    }
  }, [mode, id, navigate, sessionToken]);

  const handleChange = (field, value) => {
    setPersonaData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!sessionToken) {
      toast.show(t('persona_form.not_logged_in'), { type: 'error' });
      navigate("/");
      return;
    }
    if (!personaData.name.trim()) {
      toast.show(t('persona_form.name_required'), { type: 'error' });
      return;
    }
    if (!personaData.tags || personaData.tags.length === 0) {
      toast.show(t('persona_form.tags_required'), { type: 'error' });
      return;
    }
    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    formData.append("name", personaData.name.trim());
    formData.append("description", personaData.description.trim());
    formData.append("intro", personaData.intro.trim());
    personaData.tags.forEach(tag => formData.append("tags", tag));
    formData.append("is_public", String(!!personaData.is_public));
    formData.append("is_forkable", String(!!personaData.is_forkable));
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/personas/${id}` : `${window.API_BASE_URL}/api/personas/`, {
        method: mode === 'edit' ? "PUT" : "POST",
  headers: { 'Authorization': sessionToken },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(mode === 'edit' ? t('persona_form.updated') : t('persona_form.created'));
        if (mode === 'create') {
          silentExpGain('create_persona', null, sessionToken).catch(() => {});
        }
        navigate("/profile");
      } else {
        toast.show(data.message || data.detail || t('persona_form.error'), { type: 'error' });
      }
    } catch (error) {
      toast.show(t('persona_form.error'), { type: 'error' });
    }
  };

  const handleDelete = async () => {
  if (!sessionToken) {
      navigate("/");
      return;
    }
    setConfirmModal({ show: true });
  };

  const [confirmModal, setConfirmModal] = useState({ show: false });

  const handleDeleteConfirmed = async () => {
    setConfirmModal({ show: false });
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/personas/${id}`, {
        method: "DELETE",
        headers: { 'Authorization': sessionToken }
      });
      const data = await res.json();
      toast.show(data.message || data.detail || t('persona_form.deleted'));
      if (res.ok) navigate("/profile");
    } catch (err) {
      toast.show(t('persona_form.error'), { type: 'error' });
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
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('persona_form.name')}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t('persona_form.required_marker') || t('character_form.required_marker')}</span>
            </label>
            <input
              className="form-control"
              required
              value={personaData.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t('persona_form.placeholders.name')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('persona_form.description')}
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('persona_form.notes.description')}</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(personaData.description.length / 80)))}
              value={personaData.description}
              maxLength={MAX_DESC_LENGTH}
              placeholder={t('persona_form.placeholders.description')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('persona_form.intro')}
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('persona_form.notes.intro')}</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(1, Math.min(3, Math.ceil(personaData.intro.length / 80)))}
              value={personaData.intro}
              maxLength={MAX_INTRO_LENGTH}
              placeholder={t('persona_form.placeholders.intro')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('persona_form.tags')}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t('persona_form.required_marker') || t('character_form.required_marker')}</span>
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('persona_form.notes.tags')}</small>
            </label>
            <TagsInput
              tags={personaData.tags}
              setTags={tags => handleChange('tags', tags)}
              maxTags={MAX_TAGS}
              placeholder={t('persona_form.placeholders.tags')}
              hint={t('persona_form.tags_input_hint')}
            />
          </div>
          {/* Visibility & Options */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '1rem' }}>
              {t('persona_form.visibility_settings') || 'Visibility & Access'}
            </label>
            
            {/* Public/Private Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canPrivate && !personaData.is_public ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${personaData.is_public ? 'bi-globe2' : 'bi-lock-fill'}`} style={{ fontSize: '1.2rem', color: personaData.is_public ? '#10b981' : '#6b7280' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {personaData.is_public ? (t('persona_form.public') || 'Public') : (t('persona_form.private') || 'Private')}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {personaData.is_public 
                        ? (t('persona_form.public_desc') || 'Visible to everyone')
                        : (t('persona_form.private_desc') || 'Only visible to you')}
                    </div>
                    {!canPrivate && !personaData.is_public && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t('persona_form.level_lock_notice', { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!personaData.is_public}
                    disabled={!canPrivate && !personaData.is_public}
                    onChange={e => handleChange('is_public', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (!canPrivate && !personaData.is_public) ? 'not-allowed' : 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* Forkable Toggle */}
            <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canFork ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-diagram-3-fill" style={{ fontSize: '1.2rem', color: '#22c55e' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {t('persona_form.forkable') || 'Allow Forking'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {t('persona_form.forkable_desc') || 'Users can create their own versions'}
                    </div>
                    {!canFork && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t('persona_form.level_lock_notice', { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!personaData.is_forkable}
                    disabled={!canFork}
                    onChange={e => handleChange('is_forkable', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: canFork ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
          </div>
            {/* Profile Picture (moved to end) */}
            <div className="mb-4">
              <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('persona_form.picture')}</label>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: 96, height: 96, overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                  {picturePreview ? (
                    <img src={picturePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>{t('persona_form.no_picture')}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={e => {
                      const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      if (f) { setRawSelectedFile(f); setShowCrop(true); }
                    }}
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
              </div>
            </div>
            <div className="d-flex gap-3 mt-4 justify-content-end">
              <PrimaryButton type="submit">
                <i className="bi bi-save me-2"></i>{mode === 'edit' ? t('persona_form.save') : t('persona_form.create')}
              </PrimaryButton>
              {mode === 'edit' && (
                <PrimaryButton
                  type="button"
                  style={{
                    background: '#d32f2f',
                    color: '#fff'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#b71c1c';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#d32f2f';
                  }}
                  onClick={handleDelete}
                >
                  <i className="bi bi-trash me-2"></i>{t('persona_form.delete')}
                </PrimaryButton>
              )}
            </div>
        </form>
      </div>
      {showCrop && rawSelectedFile && createPortal(
        <ImageCropModal
          srcFile={rawSelectedFile}
          onCancel={() => { setShowCrop(false); setRawSelectedFile(null); }}
          onSave={({ file, dataUrl }) => { setPicture(file); setPicturePreview(dataUrl); setShowCrop(false); setRawSelectedFile(null); }}
          size={220}
          mode="square"
        />, document.body)
      }
      <ConfirmModal
        show={confirmModal.show}
        title={t('confirm.delete_persona.title')}
        message={t('confirm.delete_persona.message')}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false })}
      />
    </PageWrapper>
  );
}
