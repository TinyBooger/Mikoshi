import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router";
import TagsInput from '../components/TagsInput';
import ImageCropModal from '../components/ImageCropModal';
import { createPortal } from 'react-dom';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import CharacterAssistantModal from '../components/CharacterAssistantModal';

export default function CharacterFormPage() {
  const { t } = useTranslation();
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 100;
  // Get id param from route
  const params = useParams();
  const id = params.id;
  const mode = id ? 'edit' : 'create';
  const MAX_GREETING_LENGTH = 200;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;
  // Special prompt stored when a character uses an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';

  const { sessionToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
  const [charData, setCharData] = useState({
    name: '',
    persona: '',
    sample: '',
    tagline: '',
    tags: [],
    greeting: '',
  });
  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [isImprovisingGreeting, setIsImprovisingGreeting] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(null);
  const [assistantGeneratedData, setAssistantGeneratedData] = useState(null);

  useEffect(() => {
    if (mode === 'edit') {
      if (!id) {
        toast.show(t('character_form.missing_id'), { type: 'error' });
        navigate("/");
        return;
      }
  if (!sessionToken) {
        navigate("/");
        return;
      }
      fetch(`${window.API_BASE_URL}/api/character/${id}`, {
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
          // If greeting equals our special improvising marker, set the checkbox and clear greeting input
          const loadedGreeting = data.greeting || '';
          const isImprov = loadedGreeting && loadedGreeting.indexOf(SPECIAL_IMPROVISING_GREETING) !== -1;
          setIsImprovisingGreeting(!!isImprov);
          setCharData({
            name: data.name || '',
            persona: data.persona || '',
            sample: data.example_messages || '',
            tagline: data.tagline || '',
            tags: data.tags || [],
            greeting: isImprov ? '' : loadedGreeting,
          });
          setLoading(false);
        });
    }
  }, [mode, id, navigate, sessionToken]);

  const handleChange = (field, value) => {
    setCharData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
  if (!sessionToken) {
      toast.show(t('character_form.not_logged_in'), { type: 'error' });
      navigate("/");
      return;
    }
    if (!charData.name.trim() || !charData.persona.trim()) {
      toast.show(t('character_form.name_required'), { type: 'error' });
      return;
    }
    if (!charData.tags || charData.tags.length === 0) {
      toast.show(t('character_form.tags_required'), { type: 'error' });
      return;
    }
    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    formData.append("name", charData.name.trim());
    formData.append("persona", charData.persona.trim());
    formData.append("tagline", charData.tagline.trim());
    charData.tags.forEach(tag => formData.append("tags", tag));
  // If improvising greeting is enabled, store the special prompt instead of the input value
  const finalGreeting = isImprovisingGreeting ? SPECIAL_IMPROVISING_GREETING : charData.greeting.trim();
  formData.append("greeting", finalGreeting);
    formData.append("sample_dialogue", charData.sample.trim());
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/update-character` : `${window.API_BASE_URL}/api/create-character`, {
        method: "POST",
  headers: { 'Authorization': sessionToken },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(mode === 'edit' ? t('character_form.updated') : t('character_form.created'));
        navigate(mode === 'edit' ? "/profile" : "/");
      } else {
        toast.show(data.message || data.detail || t('character_form.error'), { type: 'error' });
      }
    } catch (error) {
      toast.show(t('character_form.error'), { type: 'error' });
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
      const res = await fetch(`${window.API_BASE_URL}/api/character/${id}/delete`, {
        method: "DELETE",
        headers: { 'Authorization': sessionToken }
      });
      const data = await res.json();
      toast.show(data.message || data.detail || t('character_form.deleted'));
      if (res.ok) navigate("/profile");
    } catch (err) {
      toast.show(t('character_form.error'), { type: 'error' });
    }
  };

  const handleApplyAssistant = (generatedData) => {
    setCharData(prev => ({
      ...prev,
      name: generatedData.name || prev.name,
      persona: generatedData.persona || prev.persona,
      tagline: generatedData.tagline || prev.tagline,
      greeting: generatedData.greeting || prev.greeting,
      sample: generatedData.sample_dialogue || prev.sample,
    }));
    // Don't close the assistant window, keep the conversation going
  };

  // Cleanup conversation when leaving page
  useEffect(() => {
    return () => {
      // Clear conversation state on unmount
      setAssistantMessages(null);
      setAssistantGeneratedData(null);
    };
  }, []);

  if (loading) return null;
  return (
    <PageWrapper>
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          width: '100%',
          maxWidth: 700,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '2.5rem 2rem',
          margin: '0 auto',
        }}>
          <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? t('character_form.edit_title') : t('character_form.create_title')}</h2>

        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('character_form.name')}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t('character_form.required_marker')}</span>
            </label>
            <input
              className="form-control"
              required
              value={charData.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t('character_form.placeholders.name')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('character_form.persona')}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t('character_form.required_marker')}</span>
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('character_form.notes.persona')}</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(charData.persona.length / 80)))}
              required
              value={charData.persona}
              maxLength={MAX_PERSONA_LENGTH}
              placeholder={t('character_form.placeholders.persona')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('character_form.tagline')}
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('character_form.notes.tagline')}</small>
            </label>
            <input
              className="form-control"
              value={charData.tagline}
              maxLength={MAX_TAGLINE_LENGTH}
              placeholder={t('character_form.placeholders.tagline')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('character_form.greeting')}
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('character_form.notes.greeting')}</small>
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input
                  className="form-control"
                  value={charData.greeting}
                  maxLength={MAX_GREETING_LENGTH}
                  onChange={e => handleChange('greeting', e.target.value)}
                  disabled={isImprovisingGreeting}
                  placeholder={isImprovisingGreeting ? t('character_form.greeting_improvising_placeholder') : t('character_form.placeholders.greeting')}
                  style={{
                    background: isImprovisingGreeting ? '#f0f0f0' : '#f5f6fa',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  id="improviseGreeting"
                  type="checkbox"
                  checked={isImprovisingGreeting}
                  onChange={e => setIsImprovisingGreeting(e.target.checked)}
                />
                <label htmlFor="improviseGreeting" style={{ margin: 0, fontSize: '0.95rem' }}>{t('character_form.improvise_greeting')}</label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              {t('character_form.tags')}
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>{t('character_form.required_marker')}</span>
              <small className="text-muted" style={{ marginLeft: 8 }}>{t('character_form.notes.tags')}</small>
            </label>
            <TagsInput tags={charData.tags} setTags={value => handleChange('tags', value)} maxTags={MAX_TAGS} placeholder={t('character_form.placeholders.tags')} hint={t('character_form.tags_input_hint')} />
            <small className="text-muted" style={{ top: 0, right: 0 }}>
              {charData.tags.length}/{MAX_TAGS} {t('character_form.tags_suffix')}
            </small>
          </div>

          {/* Sample Dialogue */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('character_form.sample_dialogue')}</label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(charData.sample.length / 80)))}
              value={charData.sample}
              maxLength={MAX_SAMPLE_LENGTH}
              placeholder={t('character_form.placeholders.sample_dialogue')}
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
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('character_form.picture')}</label>
            <div className="d-flex align-items-center gap-3">
              <div style={{ width: 96, height: 96, overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                {picturePreview ? (
                  <img src={picturePreview} alt={t('character_form.alt_preview')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>{t('character_form.no_picture')}</div>
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
              <i className="bi bi-save me-2"></i>{mode === 'edit' ? t('character_form.save') : t('character_form.create')}
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
                <i className="bi bi-trash me-2"></i>{t('character_form.delete')}
              </PrimaryButton>
            )}
          </div>
        </form>
      </div>
      
      </div>

      {/* AI Assistant Floating Button - Fixed position using portal */}
      {createPortal(
        <>
          <style>{`
            @keyframes pulse {
              0%, 100% {
                box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
              }
              50% {
                box-shadow: 0 0 0 12px rgba(102, 126, 234, 0);
              }
            }
            @keyframes fadeInTooltip {
              from {
                opacity: 0;
                transform: translateX(-10px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            .ai-assistant-button {
              animation: pulse 2s infinite;
            }
            .ai-assistant-button:hover {
              animation: none;
            }
            .ai-tooltip {
              position: absolute;
              right: 100%;
              top: 50%;
              transform: translateY(-50%);
              margin-right: 12px;
              background: rgba(0, 0, 0, 0.85);
              color: white;
              padding: 8px 16px;
              border-radius: 8px;
              white-space: nowrap;
              font-size: 0.9rem;
              font-weight: 500;
              pointer-events: none;
              animation: fadeInTooltip 0.3s ease-out;
              z-index: 10000;
            }
            .ai-tooltip::after {
              content: '';
              position: absolute;
              left: 100%;
              top: 50%;
              transform: translateY(-50%);
              border: 6px solid transparent;
              border-left-color: rgba(0, 0, 0, 0.85);
            }
            @media (max-width: 768px) {
              .ai-assistant-button {
                bottom: 20px !important;
                top: auto !important;
                right: 50% !important;
                transform: translateX(50%) !important;
                width: 56px !important;
                height: 56px !important;
                border-radius: 50% !important;
                flex-direction: row !important;
              }
              .ai-assistant-button .ai-text {
                display: none !important;
              }
              .ai-assistant-button i {
                font-size: 1.75rem !important;
              }
              .ai-tooltip {
                right: auto;
                left: 50%;
                top: auto;
                bottom: 100%;
                transform: translateX(-50%);
                margin-right: 0;
                margin-bottom: 12px;
              }
              .ai-tooltip::after {
                left: 50%;
                top: 100%;
                transform: translateX(-50%);
                border-left-color: transparent;
                border-top-color: rgba(0, 0, 0, 0.85);
              }
            }
          `}</style>
          <div
            className="ai-assistant-button"
            onClick={() => setShowAssistant(true)}
            style={{
              position: 'fixed',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '120px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '-4px 4px 16px rgba(102, 126, 234, 0.4)',
              zIndex: 1000,
              transition: 'all 0.3s ease',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (window.innerWidth > 768) {
                e.currentTarget.style.width = '56px';
                e.currentTarget.style.boxShadow = '-6px 6px 20px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (window.innerWidth > 768) {
                e.currentTarget.style.width = '48px';
                e.currentTarget.style.boxShadow = '-4px 4px 16px rgba(102, 126, 234, 0.4)';
              }
            }}
          >
            <i className="bi bi-magic" style={{ color: '#fff', fontSize: '1.5rem' }}></i>
            <div
              className="ai-text"
              style={{
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: '600',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '1px',
              }}
            >
              AI
            </div>
            {!showAssistant && (
              <div className="ai-tooltip">
                {t('character_assistant.tooltip') || '✨ AI Assistant - Click to create your character!'}
              </div>
            )}
          </div>
        </>,
        document.body
      )}

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
        title={t('confirm.delete_character.title')}
        message={t('confirm.delete_character.message')}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false })}
      />

      {showAssistant && (
        <CharacterAssistantModal
          onApply={handleApplyAssistant}
          onHide={() => setShowAssistant(false)}
          initialMessages={assistantMessages}
          initialGeneratedData={assistantGeneratedData}
          onMessagesChange={setAssistantMessages}
          onGeneratedDataChange={setAssistantGeneratedData}
        />
      )}
    </PageWrapper>
  );
}
