import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
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
import { silentExpGain } from '../utils/expUtils';

export default function CharacterFormPage() {
  const { t } = useTranslation();
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 1000;
  const MAX_TAGLINE_LENGTH = 100;
  // Get id param from route
  const params = useParams();
  const id = params.id;
  const location = useLocation();
  const isForkMode = location.pathname.includes('/fork/');
  const mode = id ? (isForkMode ? 'fork' : 'edit') : 'create';
  const MAX_GREETING_LENGTH = 200;
  const MAX_SAMPLE_LENGTH = 1000;
  const MAX_TAGS = 20;
  // Special prompt stored when a character uses an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';

  const { sessionToken, userData } = useContext(AuthContext);
  const userLevel = Number(userData?.level || 1);
  const isProUser = !!userData?.is_pro;
  const canPrivate = userLevel >= 2 || isProUser;
  const canFork = userLevel >= 2 || isProUser;
  const canPaid = userLevel >= 3 || isProUser;
  const navigate = useNavigate();
  const toast = useToast();
  const [charData, setCharData] = useState({
    name: '',
    persona: '',
    sample: '',
    tagline: '',
    tags: [],
    greeting: '',
    is_public: true,
    is_forkable: false,
    is_free: true,
    price: 0,
    forked_from_id: null,
    forked_from_name: null,
  });
  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [isImprovisingGreeting, setIsImprovisingGreeting] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit' || mode === 'fork');
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(null);
  const [assistantGeneratedData, setAssistantGeneratedData] = useState(null);

  // Enforce level locks on fork/paid options
  useEffect(() => {
    setCharData(prev => {
      let next = prev;
      if (!canPrivate && !prev.is_public) {
        next = { ...next, is_public: true };
      }
      if (!canFork && prev.is_forkable) {
        next = { ...next, is_forkable: false };
      }
      if (!canPaid && !prev.is_free) {
        next = { ...next, is_free: true, price: 0 };
      }
      // In fork mode, must be free and forkable
      if (mode === 'fork') {
        next = { ...next, is_free: true, price: 0, is_forkable: true };
      }
      return next;
    });
  }, [canPrivate, canFork, canPaid, mode]);

  useEffect(() => {
    if (mode === 'edit' || mode === 'fork') {
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
          
          if (mode === 'fork') {
            // In fork mode, set forked_from fields and clear the name for new creation
            setCharData({
              name: `${data.name} (Fork)`,
              persona: data.persona || '',
              sample: data.example_messages || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greeting: isImprov ? '' : loadedGreeting,
              is_public: !!data.is_public,
              is_forkable: true,
              is_free: true,
              price: 0,
              forked_from_id: data.id,
              forked_from_name: data.name,
            });
          } else {
            // Edit mode
            setCharData({
              name: data.name || '',
              persona: data.persona || '',
              sample: data.example_messages || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greeting: isImprov ? '' : loadedGreeting,
              is_public: !!data.is_public,
              is_forkable: !!data.is_forkable,
              is_free: data.is_free !== false,
              price: data.price || 0,
              forked_from_id: data.forked_from_id || null,
              forked_from_name: data.forked_from_name || null,
            });
          }
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

    // Check paid character limit for new characters
    if (mode === 'create' && !charData.is_free && !isProUser) {
      try {
        // Fetch user's created characters to count paid ones
        const res = await fetch(`${window.API_BASE_URL}/api/user/characters`, {
          headers: { 'Authorization': sessionToken }
        });
        const characters = await res.json();
        
        // Count paid characters
        const paidCharacterCount = (characters || []).filter(char => !char.is_free).length;
        
        // Level-based limits: L3=1, L4=2, L5+=unlimited
        let maxPaidCharacters = Infinity;
        if (userLevel === 3) {
          maxPaidCharacters = 1;
        } else if (userLevel === 4) {
          maxPaidCharacters = 2;
        }
        
        if (paidCharacterCount >= maxPaidCharacters) {
          const maxMsg = userLevel === 3 
            ? t('character_form.paid_limit_l3') || 'Level 3 allows 1 paid character. Reach level 4 for more.'
            : t('character_form.paid_limit_l4') || 'Level 4 allows 2 paid characters. Reach level 5 for unlimited.';
          toast.show(maxMsg, { type: 'error' });
          return;
        }
      } catch (error) {
        console.error('Error checking paid character limit:', error);
        // Continue anyway if check fails
      }
    }

    const formData = new FormData();
    if (mode === 'edit') formData.append("id", id);
    // In fork mode, don't append id - create a new entity
    if (mode === 'fork') {
      formData.append("forked_from_id", charData.forked_from_id);
      formData.append("forked_from_name", charData.forked_from_name);
    }
    formData.append("name", charData.name.trim());
    formData.append("persona", charData.persona.trim());
    formData.append("tagline", charData.tagline.trim());
    charData.tags.forEach(tag => formData.append("tags", tag));
  // If improvising greeting is enabled, store the special prompt instead of the input value
  const finalGreeting = isImprovisingGreeting ? SPECIAL_IMPROVISING_GREETING : charData.greeting.trim();
  formData.append("greeting", finalGreeting);
    formData.append("sample_dialogue", charData.sample.trim());
    formData.append("is_public", String(!!charData.is_public));
    formData.append("is_forkable", String(!!charData.is_forkable));
    formData.append("is_free", String(!!charData.is_free));
    formData.append("price", String(charData.price || 0));
    if (picture) formData.append("picture", picture);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/update-character` : `${window.API_BASE_URL}/api/create-character`, {
        method: "POST",
  headers: { 'Authorization': sessionToken },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.show(mode === 'edit' ? t('character_form.updated') : mode === 'fork' ? t('character_form.forked', 'Character forked successfully') : t('character_form.created'));
        // Silently award EXP for character creation (backend handles it but we can trigger refresh)
        if (mode === 'create' || mode === 'fork') {
          silentExpGain('create_character', null, sessionToken).catch(() => {});
        }
        navigate(mode === 'edit' ? "/profile" : "/profile");
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
          <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? t('character_form.edit_title') : mode === 'fork' ? t('character_form.fork_title', 'Fork Character') : t('character_form.create_title')}</h2>

        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Forked From - Display only */}
          {charData.forked_from_id && charData.forked_from_name && (
            <div className="alert alert-info mb-4" role="alert">
              <i className="bi bi-code-fork me-2"></i>
              {t('character_form.forked_from', 'This is a fork based on')} <strong>{charData.forked_from_name}</strong>
            </div>
          )}

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

          {/* Visibility & Options */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '1rem' }}>
              {t('character_form.visibility_settings') || 'Visibility & Access'}
            </label>
            
            {/* Public/Private Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canPrivate && !charData.is_public ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${charData.is_public ? 'bi-globe2' : 'bi-lock-fill'}`} style={{ fontSize: '1.2rem', color: charData.is_public ? '#10b981' : '#6b7280' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {charData.is_public ? (t('character_form.public') || 'Public') : (t('character_form.private') || 'Private')}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {charData.is_public 
                        ? (t('character_form.public_desc') || 'Visible to everyone')
                        : (t('character_form.private_desc') || 'Only visible to you')}
                    </div>
                    {!canPrivate && !charData.is_public && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t('character_form.level_lock_notice', { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!charData.is_public}
                    disabled={!canPrivate && !charData.is_public}
                    onChange={e => handleChange('is_public', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (!canPrivate && !charData.is_public) ? 'not-allowed' : 'pointer' }}
                  />
                </div>
              </div>
            </div>

            {/* Forkable Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !charData.is_free || !canFork ? 0.5 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-diagram-3-fill" style={{ fontSize: '1.2rem', color: '#22c55e' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {t('character_form.forkable') || 'Allow Forking'}
                      {!charData.is_free && <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.65rem' }}>{t('character_form.free_only') || 'Free Only'}</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {t('character_form.forkable_desc') || 'Users can create their own versions'}
                    </div>
                    {!canFork && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t('character_form.level_lock_notice', { level: 2 }) || 'This function will be available at level 2'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!charData.is_forkable}
                    disabled={!charData.is_free || !canFork || mode === 'fork'}
                    onChange={e => handleChange('is_forkable', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (charData.is_free && canFork && mode !== 'fork') ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>

            {/* Paid Character Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: (!canPaid || mode === 'fork') ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-currency-dollar" style={{ fontSize: '1.2rem', color: '#f59e0b' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {t('character_form.paid_character') || 'Paid Character?'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.3' }}>
                      {mode === 'fork' 
                        ? t('character_form.fork_must_be_free', 'Forked characters must be free') 
                        : (t('character_form.paid_character_desc') || 'Free users can create 2 paid characters, Pro users unlimited')}
                    </div>
                    {!canPaid && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        {t('character_form.level_lock_notice', { level: 3 }) || 'This function will be available at level 3'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!charData.is_free}
                    disabled={!canPaid || mode === 'fork'}
                    onChange={e => {
                      if (e.target.checked) {
                        // Switching to paid
                        handleChange('is_free', false);
                        if (charData.price === 0) {
                          handleChange('price', 1); // Set default paid price
                        }
                        handleChange('is_forkable', false);
                      } else {
                        // Switching to free
                        handleChange('is_free', true);
                        handleChange('price', 0);
                      }
                    }}
                    style={{ width: '3rem', height: '1.5rem', cursor: (canPaid && mode !== 'fork') ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>

            {/* Pricing Tiers - Show only when Paid is selected */}
            {!charData.is_free && canPaid && (
              <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                <div className="mb-3">
                  <div className="fw-semibold" style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    {t('character_form.pricing') || 'Select Price'}
                  </div>
                  
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {[1, 5, 10, 50].map(price => (
                      <button
                        key={price}
                        type="button"
                        onClick={() => {
                          handleChange('price', price);
                        }}
                        style={{
                          flex: '1 1 calc(25% - 0.5rem)',
                          minWidth: '70px',
                          padding: '0.75rem 0.5rem',
                          borderRadius: '8px',
                          border: charData.price === price ? '2px solid #3b82f6' : '1px solid #d1d5db',
                          background: charData.price === price ? '#eff6ff' : '#fff',
                          color: charData.price === price ? '#3b82f6' : '#6b7280',
                          fontWeight: charData.price === price ? '600' : '500',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          if (charData.price !== price) {
                            e.currentTarget.style.borderColor = '#9ca3af';
                            e.currentTarget.style.background = '#f9fafb';
                          }
                        }}
                        onMouseLeave={e => {
                          if (charData.price !== price) {
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.background = '#fff';
                          }
                        }}
                      >
                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>¥{price}</div>
                        <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.7 }}>CNY</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Price Input */}
                  <div className="d-flex align-items-center gap-2">
                    <label className="text-muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {t('character_form.custom_price') || 'Custom:'}
                    </label>
                    <div className="input-group" style={{ maxWidth: '200px' }}>
                      <span className="input-group-text" style={{ background: '#fff', borderRadius: '8px 0 0 8px', fontSize: '0.9rem' }}>¥</span>
                      <input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.01"
                        value={[1, 5, 10, 50].includes(charData.price) ? '' : charData.price || ''}
                        onChange={e => {
                          let val = parseFloat(e.target.value) || 0;
                          // Enforce range
                          if (val > 0 && val < 0.1) val = 0.1;
                          if (val > 100) val = 100;
                          // Round to 2 decimals
                          val = Math.round(val * 100) / 100;
                          handleChange('price', val);
                        }}
                        placeholder="0.10 - 100.00"
                        style={{
                          borderRadius: '0 8px 8px 0',
                          border: '1px solid #d1d5db',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t('character_form.price_range') || '¥0.1 - ¥100'}</span>
                  </div>
                </div>
              </div>
            )}
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
