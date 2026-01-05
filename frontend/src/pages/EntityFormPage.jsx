import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
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

export default function EntityFormPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = params.id;
  const location = useLocation();
  const isForkMode = location.pathname.includes('/fork/');
  const mode = id ? (isForkMode ? 'fork' : 'edit') : 'create';
  
  // Determine entity type from route
  const entityType = location.pathname.includes('persona') ? 'persona' : location.pathname.includes('scene') ? 'scene' : null;

  if (!entityType) {
    return null;
  }

  // Configuration for each entity type
  const config = {
    persona: {
      maxNameLength: 50,
      maxDescLength: 1000,
      maxIntroLength: 200,
      maxTags: 20,
      apiEndpoint: 'personas',
      expGainAction: 'create_persona',
      transactionKeyPrefix: 'persona_form',
      requiredFields: ['name', 'tags'],
    },
    scene: {
      maxNameLength: 50,
      maxDescLength: 1000,
      maxIntroLength: 100,
      maxTags: 20,
      apiEndpoint: 'scenes',
      expGainAction: 'create_scene',
      transactionKeyPrefix: 'scene_form',
      requiredFields: ['name', 'description', 'tags'],
    },
  };

  const entityConfig = config[entityType];
  const MAX_NAME_LENGTH = entityConfig.maxNameLength;
  const MAX_DESC_LENGTH = entityConfig.maxDescLength;
  const MAX_INTRO_LENGTH = entityConfig.maxIntroLength;
  const MAX_TAGS = entityConfig.maxTags;

  const { sessionToken, userData } = useContext(AuthContext);
  const userLevel = Number(userData?.level || 1);
  const canPrivate = userLevel >= 2;
  const canFork = userLevel >= 2;
  const navigate = useNavigate();
  const toast = useToast();

  const [entityData, setEntityData] = useState({
    name: '',
    description: '',
    intro: '',
    tags: [],
    is_public: true,
    is_forkable: false,
    forked_from_id: null,
    forked_from_name: null,
  });

  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit' || mode === 'fork');
  const [confirmModal, setConfirmModal] = useState({ show: false });

  // Enforce level locks
  useEffect(() => {
    setEntityData(prev => {
      let next = prev;
      if (!canPrivate && !prev.is_public) {
        next = { ...next, is_public: true };
      }
      if (!canFork && prev.is_forkable) {
        next = { ...next, is_forkable: false };
      }
      // In fork mode, must be forkable
      if (mode === 'fork') {
        next = { ...next, is_forkable: true };
      }
      return next;
    });
  }, [canPrivate, canFork, mode]);

  // Fetch entity data in edit mode
  useEffect(() => {
    if (mode === 'edit' || mode === 'fork') {
      if (!id) {
        toast.show(t(`${entityConfig.transactionKeyPrefix}.missing_id`), { type: 'error' });
        navigate("/");
        return;
      }
      if (!sessionToken) {
        navigate("/");
        return;
      }
      fetch(`${window.API_BASE_URL}/api/${entityConfig.apiEndpoint}/${id}`, {
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
          if (mode === 'fork') {
            // In fork mode, set forked_from fields
            setEntityData({
              name: `${data.name} (Fork)`,
              description: data.description || '',
              intro: data.intro || '',
              tags: data.tags || [],
              is_public: !!data.is_public,
              is_forkable: true,
              forked_from_id: data.id,
              forked_from_name: data.name,
            });
          } else {
            // Edit mode
            setEntityData({
              name: data.name || '',
              description: data.description || '',
              intro: data.intro || '',
              tags: data.tags || [],
              is_public: !!data.is_public,
              is_forkable: !!data.is_forkable,
              forked_from_id: data.forked_from_id || null,
              forked_from_name: data.forked_from_name || null,
            });
          }
          setPicture(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [mode, id, navigate, sessionToken, entityType, toast]);

  const handleChange = (field, value) => {
    setEntityData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!sessionToken) {
      toast.show(t(`${entityConfig.transactionKeyPrefix}.not_logged_in`), { type: 'error' });
      navigate("/");
      return;
    }

    // Validate required fields
    for (const field of entityConfig.requiredFields) {
      if (!entityData[field] || (typeof entityData[field] === 'string' && !entityData[field].trim()) || (Array.isArray(entityData[field]) && entityData[field].length === 0)) {
        toast.show(t(`${entityConfig.transactionKeyPrefix}.${field}_required`), { type: 'error' });
        return;
      }
    }

    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    // In fork mode, don't append id - create a new entity
    if (mode === 'fork') {
      formData.append("forked_from_id", entityData.forked_from_id);
      formData.append("forked_from_name", entityData.forked_from_name);
    }
    formData.append("name", entityData.name.trim());
    if (entityType === 'scene' || entityType === 'persona') {
      formData.append("description", entityData.description.trim());
    }
    formData.append("intro", entityData.intro.trim());
    entityData.tags.forEach(tag => formData.append("tags", tag));
    formData.append("is_public", String(!!entityData.is_public));
    formData.append("is_forkable", String(!!entityData.is_forkable));
    if (picture) formData.append("picture", picture);

    try {
      const res = await fetch(
        mode === 'edit'
          ? `${window.API_BASE_URL}/api/${entityConfig.apiEndpoint}/${id}`
          : `${window.API_BASE_URL}/api/${entityConfig.apiEndpoint}/`,
        {
          method: mode === 'edit' ? "PUT" : "POST",
          headers: { 'Authorization': sessionToken },
          body: formData,
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.show(mode === 'edit' ? t(`${entityConfig.transactionKeyPrefix}.updated`) : mode === 'fork' ? t(`${entityConfig.transactionKeyPrefix}.forked`, `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} forked successfully`) : t(`${entityConfig.transactionKeyPrefix}.created`));
        if (mode === 'create' || mode === 'fork') {
          silentExpGain(entityConfig.expGainAction, null, sessionToken).catch(() => {});
        }
        navigate("/profile");
      } else {
        toast.show(data.message || data.detail || t(`${entityConfig.transactionKeyPrefix}.error`), { type: 'error' });
      }
    } catch (error) {
      toast.show(t(`${entityConfig.transactionKeyPrefix}.error`), { type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!sessionToken) {
      navigate("/");
      return;
    }
    setConfirmModal({ show: true });
  };

  const handleDeleteConfirmed = async () => {
    setConfirmModal({ show: false });
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/${entityConfig.apiEndpoint}/${id}`, {
        method: "DELETE",
        headers: { 'Authorization': sessionToken }
      });
      const data = await res.json();
      toast.show(data.message || data.detail || t(`${entityConfig.transactionKeyPrefix}.deleted`));
      if (res.ok) navigate("/profile");
    } catch (err) {
      toast.show(t(`${entityConfig.transactionKeyPrefix}.error`), { type: 'error' });
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
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>
          {mode === 'edit' ? t(`${entityConfig.transactionKeyPrefix}.edit_title`) : mode === 'fork' ? t(`${entityConfig.transactionKeyPrefix}.fork_title`, `Fork ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`) : t(`${entityConfig.transactionKeyPrefix}.create_title`)}
        </h2>
        
        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Forked From - Display only */}
          {entityData.forked_from_id && entityData.forked_from_name && (
            <div className="alert alert-info mb-4" role="alert">
              <i className="bi bi-code-fork me-2"></i>
              {t(`${entityConfig.transactionKeyPrefix}.forked_from`, 'This is a fork based on')} <strong>{entityData.forked_from_name}</strong>
            </div>
          )}
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t(`${entityConfig.transactionKeyPrefix}.name`)}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t(`${entityConfig.transactionKeyPrefix}.required_marker`) || t('character_form.required_marker')}</span>
            </label>
            <input
              className="form-control"
              required
              value={entityData.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t(`${entityConfig.transactionKeyPrefix}.placeholders.name`)}
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
              {entityData.name.length}/{MAX_NAME_LENGTH}
            </small>
          </div>

          {/* Description */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t(`${entityConfig.transactionKeyPrefix}.description`)}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t(`${entityConfig.transactionKeyPrefix}.required_marker`) || t('character_form.required_marker')}</span>
              <small className="text-muted" style={{ marginLeft: 8 }}>{t(`${entityConfig.transactionKeyPrefix}.notes.description`)}</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(entityData.description.length / 80)))}
              value={entityData.description}
              maxLength={MAX_DESC_LENGTH}
              placeholder={t(`${entityConfig.transactionKeyPrefix}.placeholders.description`)}
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
              {entityData.description.length}/{MAX_DESC_LENGTH}
            </small>
          </div>

          {/* Intro */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t(`${entityConfig.transactionKeyPrefix}.intro`)}
              <small className="text-muted" style={{ marginLeft: 8 }}>{t(`${entityConfig.transactionKeyPrefix}.notes.intro`)}</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(1, Math.min(3, Math.ceil(entityData.intro.length / 80)))}
              value={entityData.intro}
              maxLength={MAX_INTRO_LENGTH}
              placeholder={t(`${entityConfig.transactionKeyPrefix}.placeholders.intro`)}
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
              {entityData.intro.length}/{MAX_INTRO_LENGTH}
            </small>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t(`${entityConfig.transactionKeyPrefix}.tags`)}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t(`${entityConfig.transactionKeyPrefix}.required_marker`) || t('character_form.required_marker')}</span>
              <small className="text-muted" style={{ marginLeft: 8 }}>{t(`${entityConfig.transactionKeyPrefix}.notes.tags`)}</small>
            </label>
            <TagsInput
              tags={entityData.tags}
              setTags={tags => handleChange('tags', tags)}
              maxTags={MAX_TAGS}
              placeholder={t(`${entityConfig.transactionKeyPrefix}.placeholders.tags`)}
              hint={t(`${entityConfig.transactionKeyPrefix}.tags_input_hint`)}
            />
          </div>

          {/* Visibility & Options */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '1rem' }}>
              {t(`${entityConfig.transactionKeyPrefix}.visibility_settings`) || 'Visibility & Access'}
            </label>
            
            {/* Public/Private Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canPrivate && !entityData.is_public ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${entityData.is_public ? 'bi-globe2' : 'bi-lock-fill'}`} style={{ fontSize: '1.2rem', color: entityData.is_public ? '#10b981' : '#6b7280' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {entityData.is_public ? (t(`${entityConfig.transactionKeyPrefix}.public`) || 'Public') : (t(`${entityConfig.transactionKeyPrefix}.private`) || 'Private')}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {entityData.is_public 
                        ? (t(`${entityConfig.transactionKeyPrefix}.public_desc`) || 'Visible to everyone')
                        : (t(`${entityConfig.transactionKeyPrefix}.private_desc`) || 'Only visible to you')}
                    </div>
                    {!canPrivate && !entityData.is_public && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t(`${entityConfig.transactionKeyPrefix}.level_lock_notice`, { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!entityData.is_public}
                    disabled={!canPrivate && !entityData.is_public}
                    onChange={e => handleChange('is_public', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (!canPrivate && !entityData.is_public) ? 'not-allowed' : 'pointer' }}
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
                      {t(`${entityConfig.transactionKeyPrefix}.forkable`) || 'Allow Forking'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {t(`${entityConfig.transactionKeyPrefix}.forkable_desc`) || 'Users can create their own versions'}
                    </div>
                    {!canFork && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t(`${entityConfig.transactionKeyPrefix}.level_lock_notice`, { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!entityData.is_forkable}
                    disabled={!canFork || mode === 'fork'}
                    onChange={e => handleChange('is_forkable', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (canFork && mode !== 'fork') ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Profile Picture */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t(`${entityConfig.transactionKeyPrefix}.picture`)}</label>
            <div className="d-flex align-items-center gap-3">
              <div style={{ width: 96, height: 96, overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                {picturePreview ? (
                  <img src={picturePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>{t(`${entityConfig.transactionKeyPrefix}.no_picture`)}</div>
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

          {/* Action Buttons */}
          <div className="d-flex gap-3 mt-4 justify-content-end">
            <PrimaryButton type="submit">
              <i className="bi bi-save me-2"></i>{mode === 'edit' ? t(`${entityConfig.transactionKeyPrefix}.save`) : t(`${entityConfig.transactionKeyPrefix}.create`)}
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
                <i className="bi bi-trash me-2"></i>{t(`${entityConfig.transactionKeyPrefix}.delete`)}
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
        title={t(`confirm.delete_${entityType}.title`)}
        message={t(`confirm.delete_${entityType}.message`)}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false })}
      />
    </PageWrapper>
  );
}
