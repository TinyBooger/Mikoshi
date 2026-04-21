import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import TagsInput from '../components/TagsInput';
import ImageCropModal from '../components/ImageCropModal';
import { createPortal } from 'react-dom';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../components/ConfirmModal';
import UgcPolicyModal from '../components/UgcPolicyModal';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import CharacterAssistantModal from '../components/CharacterAssistantModal';
import { silentExpGain } from '../utils/expUtils';
import { getApiErrorMessage } from '../utils/apiErrorUtils';
import { formatCompactTokenCount, getTokenQuotaLabel } from '../utils/tokenDisplay';

export default function CharacterFormPage() {
  const { t } = useTranslation();
  const TOKEN_LIMITS_BY_MODEL = {
    'deepseek-chat': { min: 1, max: 8192, defaultValue: 4096, step: 128 },
    'deepseek-reasoner': { min: 1, max: 65536, defaultValue: 32768, step: 256 },
  };
  const TOKEN_TIERS_BY_MODEL = {
    'deepseek-chat': [
      { value: 1024, labelKey: 'short_sentence' },
      { value: 2048, labelKey: 'paragraph' },
      { value: 4096, labelKey: 'long' },
      { value: 6144, labelKey: 'very_long' },
      { value: 8192, labelKey: 'maximum' },
    ],
    'deepseek-reasoner': [
      { value: 8192, labelKey: 'short_sentence' },
      { value: 16384, labelKey: 'paragraph' },
      { value: 32768, labelKey: 'long' },
      { value: 49152, labelKey: 'very_long' },
      { value: 65536, labelKey: 'maximum' },
    ],
  };
  const getTokenLimits = (modelName) => TOKEN_LIMITS_BY_MODEL[modelName] || TOKEN_LIMITS_BY_MODEL['deepseek-chat'];
  const getTokenTiers = (modelName) => TOKEN_TIERS_BY_MODEL[modelName] || TOKEN_TIERS_BY_MODEL['deepseek-chat'];
  const clampValue = (value, min, max, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const normalizeTokenTierValue = (modelName, rawValue) => {
    const tokenLimits = getTokenLimits(modelName);
    const tiers = getTokenTiers(modelName);
    const clamped = clampValue(rawValue, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue);
    return tiers.reduce((nearest, tier) => (
      Math.abs(tier.value - clamped) < Math.abs(nearest.value - clamped) ? tier : nearest
    ), tiers[0]).value;
  };
  const InfoHint = ({ text }) => (
    <span
      title={text}
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 6,
        color: '#6b7280',
        cursor: 'help',
      }}
    >
      <i className="bi bi-info-circle" style={{ fontSize: '0.9rem' }}></i>
    </span>
  );
  const DEFAULT_CHAT_CONFIG = {
    model: 'deepseek-chat',
    temperature: 1.3,
    top_p: 0.9,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
  };
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 400;
  const MAX_TAGLINE_LENGTH = 100;
  const ADVANCED_MAX_LONG_DESCRIPTION_LENGTH = 10000;
  // Get id param from route
  const params = useParams();
  const id = params.id;
  const location = useLocation();
  const isForkMode = location.pathname.includes('/fork/');
  const mode = id ? (isForkMode ? 'fork' : 'edit') : 'create';
  const MAX_GREETING_LENGTH = 200;
  const MAX_SAMPLE_LENGTH = 200;
  const MAX_TAGS = 20;
  // Special prompt stored when a character uses an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';

  const { sessionToken, userData, refreshUserData } = useContext(AuthContext);
  const userLevel = Number(userData?.level || 1);
  const isProUser = !!userData?.is_pro;
  const canUseAdvancedConfig = userLevel >= 3 || isProUser;
  const canUseAdvancedCharacter = isProUser;
  const canPrivate = userLevel >= 2 || isProUser;
  const canFork = userLevel >= 2 || isProUser;
  const navigate = useNavigate();
  const toast = useToast();
  const [charData, setCharData] = useState({
    name: '',
    persona: '',
    context_label: 'standard',
    sample: '',
    long_description: '',
    tagline: '',
    tags: [],
    greeting: '',
    is_public: true,
    is_forkable: false,
    is_free: true,
    price: 0,
    forked_from_id: null,
    forked_from_name: null,
    model: DEFAULT_CHAT_CONFIG.model,
    temperature: DEFAULT_CHAT_CONFIG.temperature,
    top_p: DEFAULT_CHAT_CONFIG.top_p,
    max_tokens: DEFAULT_CHAT_CONFIG.max_tokens,
    presence_penalty: DEFAULT_CHAT_CONFIG.presence_penalty,
    frequency_penalty: DEFAULT_CHAT_CONFIG.frequency_penalty,
  });
  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [avatarPicture, setAvatarPicture] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isImprovisingGreeting, setIsImprovisingGreeting] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit' || mode === 'fork');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(null);
  const [assistantGeneratedData, setAssistantGeneratedData] = useState(null);
  const selectedTokenLimits = getTokenLimits(charData.model || DEFAULT_CHAT_CONFIG.model);
  const selectedTokenTiers = getTokenTiers(charData.model || DEFAULT_CHAT_CONFIG.model);
  const effectiveContextLabel = charData.context_label === 'advanced' ? 'advanced' : 'standard';

  const formatTokenCapError = (payload) => {
    const tokenPayload = payload?.error === 'TOKEN_CAP_REACHED'
      ? payload
      : (payload?.detail?.error === 'TOKEN_CAP_REACHED' ? payload.detail : null);

    if (!tokenPayload) return null;

    const limits = tokenPayload?.token_limits || {};
    const scopeLabel = getTokenQuotaLabel(limits?.cap_scope);
    const cap = Number(limits?.token_cap || 0);
    const remaining = Number(limits?.remaining_tokens || 0);

    if (cap > 0) {
      return `${tokenPayload.message || '已达到 token 上限。'} (${scopeLabel}: 剩余 ${formatCompactTokenCount(remaining)} / ${formatCompactTokenCount(cap)})`;
    }

    return tokenPayload.message || '已达到 token 上限。';
  };

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
      if (!canUseAdvancedCharacter && prev.context_label === 'advanced') {
        next = { ...next, context_label: 'standard' };
      }
      // In fork mode, must be free and forkable
      if (mode === 'fork') {
        next = { ...next, is_free: true, price: 0, is_forkable: true };
      }
      return next;
    });
  }, [canPrivate, canFork, canUseAdvancedCharacter, mode]);

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
            const loadedModel = data.model || DEFAULT_CHAT_CONFIG.model;
            // In fork mode, set forked_from fields and clear the name for new creation
            setCharData({
              name: `${data.name} (Fork)`,
              persona: data.persona || '',
              context_label: data.context_label === 'advanced' ? 'advanced' : 'standard',
              sample: data.example_messages || '',
              long_description: data.long_description || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greeting: isImprov ? '' : loadedGreeting,
              is_public: !!data.is_public,
              is_forkable: true,
              is_free: true,
              price: 0,
              forked_from_id: data.id,
              forked_from_name: data.name,
              model: loadedModel,
              temperature: clampValue(data.temperature, 0, 2, DEFAULT_CHAT_CONFIG.temperature),
              top_p: clampValue(data.top_p, 0, 1, DEFAULT_CHAT_CONFIG.top_p),
              max_tokens: normalizeTokenTierValue(loadedModel, data.max_tokens),
              presence_penalty: clampValue(data.presence_penalty, -2, 2, DEFAULT_CHAT_CONFIG.presence_penalty),
              frequency_penalty: clampValue(data.frequency_penalty, -2, 2, DEFAULT_CHAT_CONFIG.frequency_penalty),
            });
          } else {
            const loadedModel = data.model || DEFAULT_CHAT_CONFIG.model;
            // Edit mode
            setCharData({
              name: data.name || '',
              persona: data.persona || '',
              context_label: data.context_label === 'advanced' ? 'advanced' : 'standard',
              sample: data.example_messages || '',
              long_description: data.long_description || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greeting: isImprov ? '' : loadedGreeting,
              is_public: !!data.is_public,
              is_forkable: !!data.is_forkable,
              is_free: true,
              price: 0,
              forked_from_id: data.forked_from_id || null,
              forked_from_name: data.forked_from_name || null,
              model: loadedModel,
              temperature: clampValue(data.temperature, 0, 2, DEFAULT_CHAT_CONFIG.temperature),
              top_p: clampValue(data.top_p, 0, 1, DEFAULT_CHAT_CONFIG.top_p),
              max_tokens: normalizeTokenTierValue(loadedModel, data.max_tokens),
              presence_penalty: clampValue(data.presence_penalty, -2, 2, DEFAULT_CHAT_CONFIG.presence_penalty),
              frequency_penalty: clampValue(data.frequency_penalty, -2, 2, DEFAULT_CHAT_CONFIG.frequency_penalty),
            });
          }
          setLoading(false);
          if (data.picture) {
            setPicturePreview(`${window.API_BASE_URL.replace(/\/$/, '')}/${String(data.picture).replace(/^\//, '')}`);
          } else {
            setPicturePreview(null);
          }
          if (data.avatar_picture) {
            setAvatarPreview(`${window.API_BASE_URL.replace(/\/$/, '')}/${String(data.avatar_picture).replace(/^\//, '')}`);
          } else if (data.picture) {
            setAvatarPreview(`${window.API_BASE_URL.replace(/\/$/, '')}/${String(data.picture).replace(/^\//, '')}`);
          } else {
            setAvatarPreview(null);
          }
        });
    }
  }, [mode, id, navigate, sessionToken]);

  const handleChange = (field, value) => {
    setCharData(prev => ({ ...prev, [field]: value }));
  };

  const updateConfig = (key, value, min, max, fallback) => {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    handleChange(key, nextValue);
  };

  const handleModelChange = (nextModel) => {
    const nextTokenLimits = getTokenLimits(nextModel);
    setCharData(prev => ({
      ...prev,
      model: nextModel,
      // Reset to model default for predictable UX when switching models.
      max_tokens: normalizeTokenTierValue(nextModel, nextTokenLimits.defaultValue),
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (isSubmitting) return;
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
    if (charData.persona.length > MAX_PERSONA_LENGTH) {
      toast.show(`Persona too long (max ${MAX_PERSONA_LENGTH})`, { type: 'error' });
      return;
    }
    if (charData.sample.length > MAX_SAMPLE_LENGTH) {
      toast.show(`Sample dialogue too long (max ${MAX_SAMPLE_LENGTH})`, { type: 'error' });
      return;
    }
    if (effectiveContextLabel === 'advanced' && charData.long_description.length > ADVANCED_MAX_LONG_DESCRIPTION_LENGTH) {
      toast.show(`Long description too long (max ${ADVANCED_MAX_LONG_DESCRIPTION_LENGTH})`, { type: 'error' });
      return;
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
    formData.append("context_label", effectiveContextLabel);
    formData.append("tagline", charData.tagline.trim());
    charData.tags.forEach(tag => formData.append("tags", tag));
  // If improvising greeting is enabled, store the special prompt instead of the input value
  const finalGreeting = isImprovisingGreeting ? SPECIAL_IMPROVISING_GREETING : charData.greeting.trim();
  formData.append("greeting", finalGreeting);
    formData.append("sample_dialogue", charData.sample.trim());
    if (effectiveContextLabel === 'advanced') {
      formData.append("long_description", charData.long_description.trim());
    }
    const finalModel = charData.model || DEFAULT_CHAT_CONFIG.model;
  const finalTokenLimits = getTokenLimits(finalModel);
  const safeMaxTokens = clampValue(charData.max_tokens, finalTokenLimits.min, finalTokenLimits.max, finalTokenLimits.defaultValue);
  formData.append("model", finalModel);
    formData.append("temperature", String(canUseAdvancedConfig ? (charData.temperature ?? DEFAULT_CHAT_CONFIG.temperature) : DEFAULT_CHAT_CONFIG.temperature));
    formData.append("top_p", String(canUseAdvancedConfig ? (charData.top_p ?? DEFAULT_CHAT_CONFIG.top_p) : DEFAULT_CHAT_CONFIG.top_p));
  formData.append("max_tokens", String(canUseAdvancedConfig ? safeMaxTokens : DEFAULT_CHAT_CONFIG.max_tokens));
    formData.append("presence_penalty", String(canUseAdvancedConfig ? (charData.presence_penalty ?? DEFAULT_CHAT_CONFIG.presence_penalty) : DEFAULT_CHAT_CONFIG.presence_penalty));
    formData.append("frequency_penalty", String(canUseAdvancedConfig ? (charData.frequency_penalty ?? DEFAULT_CHAT_CONFIG.frequency_penalty) : DEFAULT_CHAT_CONFIG.frequency_penalty));
    if (!canUseAdvancedConfig) {
      formData.set("model", DEFAULT_CHAT_CONFIG.model);
    }
    formData.append("is_public", String(!!charData.is_public));
    formData.append("is_forkable", String(!!charData.is_forkable));
    if (picture) formData.append("picture", picture);
    if (avatarPicture) formData.append("avatar_picture", avatarPicture);
    setIsSubmitting(true);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/update-character` : `${window.API_BASE_URL}/api/create-character`, {
        method: "POST",
  headers: { 'Authorization': sessionToken },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (refreshUserData) {
          refreshUserData({ silent: true });
        }
        toast.show(mode === 'edit' ? t('character_form.updated') : mode === 'fork' ? t('character_form.forked') : t('character_form.created'));
        // Silently award EXP for character creation (backend handles it but we can trigger refresh)
        if (mode === 'create' || mode === 'fork') {
          silentExpGain('create_character', null, sessionToken).catch(() => {});
        }
        navigate(mode === 'edit' ? "/profile" : "/profile");
      } else {
        const tokenCapMessage = formatTokenCapError(data);
        if (tokenCapMessage) {
          toast.show(tokenCapMessage, { type: 'error' });
        } else {
          toast.show(getApiErrorMessage(data, t('character_form.error'), t), { type: 'error' });
        }
      }
    } catch (error) {
      toast.show(t('character_form.error'), { type: 'error' });
    } finally {
      setIsSubmitting(false);
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
  const [showUgcPolicyModal, setShowUgcPolicyModal] = useState(false);

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
      long_description: generatedData.long_description || prev.long_description,
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
      <div className="character-form-page" style={{ position: 'relative', width: '100%' }}>
        {userData?.token_cap !== null && (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 10,
              padding: '0.55rem 0.75rem',
              border: userData?.token_cap_reached ? '1px solid #fecaca' : '1px solid #fde68a',
              background: userData?.token_cap_reached ? '#fff1f2' : '#fffbeb',
              color: userData?.token_cap_reached ? '#b91c1c' : '#92400e',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            {(() => {
              const scopeLabel = getTokenQuotaLabel(userData?.token_cap_scope);
              const used = Number(userData?.token_cap_scope === 'monthly' ? userData?.monthly_token_usage : userData?.daily_token_usage) || 0;
              const cap = Number(userData?.token_cap || 0);
              const remaining = Number(userData?.remaining_tokens || 0);

              if (userData?.token_cap_reached) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <span>{scopeLabel}已达上限：{formatCompactTokenCount(used)} / {formatCompactTokenCount(cap)}，相关功能将受限。</span>
                    {userData?.token_cap_scope !== 'monthly' && (
                      <button
                        type="button"
                        onClick={() => navigate('/pro-upgrade')}
                        style={{
                          flexShrink: 0,
                          padding: '0.15rem 0.55rem',
                          borderRadius: 6,
                          border: 'none',
                          background: '#b91c1c',
                          color: '#fff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        升级 Pro
                      </button>
                    )}
                  </div>
                );
              }

              return `${scopeLabel}：${formatCompactTokenCount(used)} / ${formatCompactTokenCount(cap)}，剩余 ${formatCompactTokenCount(remaining)}`;
            })()}
          </div>
        )}
        <style>{`
          .character-form-page .form-control::placeholder,
          .character-form-page textarea::placeholder {
            color: #c5ccd3;
            opacity: 1;
          }
        `}</style>
        <div style={{
          width: '100%',
          maxWidth: 700,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '2.5rem 2rem',
          margin: '0 auto',
        }}>
          <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>{mode === 'edit' ? t('character_form.edit_title') : mode === 'fork' ? t('character_form.fork_title') : t('character_form.create_title')}</h2>

        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          {/* Forked From - Display only */}
          {charData.forked_from_id && charData.forked_from_name && (
            <div className="alert alert-info mb-4" role="alert">
              <i className="bi bi-code-fork me-2"></i>
              {t('character_form.forked_from')} <strong>{charData.forked_from_name}</strong>
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

          <div className="mb-4">
            <button
              type="button"
              className="w-100 d-flex align-items-center justify-content-between"
              onClick={() => setShowAdvancedOptions(prev => !prev)}
              aria-expanded={showAdvancedOptions}
              style={{
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: 14,
                color: '#232323',
                padding: '0.9rem 1rem',
                fontWeight: 700,
              }}
            >
              <span>{t('character_form.advanced_options')}</span>
              <span className="d-inline-flex align-items-center gap-2" style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.92rem' }}>
                {showAdvancedOptions ? t('character_form.collapse_advanced') : t('character_form.expand_advanced')}
                <i className={`bi ${showAdvancedOptions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </span>
            </button>
          </div>

          {showAdvancedOptions && (
            <>
              {/* Context Label */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '0.5rem', display: 'block' }}>
                  角色类型
                </label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e9ecef', width: 'fit-content' }}>
                  <button
                    type="button"
                    onClick={() => handleChange('context_label', 'standard')}
                    style={{
                      padding: '0.5rem 1.4rem',
                      fontSize: '1rem',
                      fontWeight: effectiveContextLabel === 'standard' ? 700 : 400,
                      background: effectiveContextLabel === 'standard' ? '#232323' : '#f5f6fa',
                      color: effectiveContextLabel === 'standard' ? '#fff' : '#555',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    标准
                  </button>
                  <button
                    type="button"
                    onClick={() => canUseAdvancedCharacter && handleChange('context_label', 'advanced')}
                    disabled={!canUseAdvancedCharacter}
                    title={!canUseAdvancedCharacter ? '升级为Pro用户后可用' : ''}
                    style={{
                      padding: '0.5rem 1.4rem',
                      fontSize: '1rem',
                      fontWeight: effectiveContextLabel === 'advanced' ? 700 : 400,
                      background: effectiveContextLabel === 'advanced' ? '#7c3aed' : '#f5f6fa',
                      color: effectiveContextLabel === 'advanced' ? '#fff' : (!canUseAdvancedCharacter ? '#bbb' : '#555'),
                      border: 'none',
                      cursor: canUseAdvancedCharacter ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s, color 0.15s',
                      opacity: !canUseAdvancedCharacter ? 0.7 : 1,
                    }}
                  >
                    高级
                    {!canUseAdvancedCharacter && (
                      <span style={{ marginLeft: 4, fontSize: '0.75rem' }}>🔒</span>
                    )}
                  </button>
                </div>
                {!canUseAdvancedCharacter ? (
                  <small style={{ display: 'block', marginTop: 8, color: '#9333ea' }}>
                    升级为Pro用户可以增加最多10000字的详细人物设定
                  </small>
                ) : effectiveContextLabel === 'advanced' ? (
                  <small style={{ display: 'block', marginTop: 8, color: '#7c3aed' }}>
                    高级角色可填写最多10000字的详细人物设定，用于构建更丰富的角色背景
                  </small>
                ) : (
                  <small style={{ display: 'block', marginTop: 8, color: '#888' }}>
                    选择「高级」后可额外填写最多10000字的详细人物设定
                  </small>
                )}
              </div>

              {/* Long Description (advanced only) */}
              {effectiveContextLabel === 'advanced' && (
                <div className="mb-4 position-relative">
                  <label className="form-label fw-bold" style={{ color: '#232323' }}>
                    {t('character_form.long_description')}
                    <small className="text-muted" style={{ marginLeft: 8 }}>
                      {t('character_form.notes.long_description')}
                    </small>
                  </label>
                  <textarea
                    className="form-control"
                    rows={Math.max(6, Math.min(30, Math.ceil((charData.long_description || '').length / 80)))}
                    value={charData.long_description || ''}
                    maxLength={ADVANCED_MAX_LONG_DESCRIPTION_LENGTH}
                    placeholder={t('character_form.placeholders.long_description')}
                    onChange={e => handleChange('long_description', e.target.value)}
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
                  <small style={{ display: 'block', marginTop: 8, color: '#7c3aed' }}>
                    创建角色时处理详细人物设定会消耗少量的token
                  </small>
                  <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                    {(charData.long_description || '').length}/{ADVANCED_MAX_LONG_DESCRIPTION_LENGTH}
                  </small>
                </div>
              )}

              {/* Advanced Chat Config */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '0.75rem' }}>
                  {t('character_form.advanced.title')}
                </label>
                <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: '0.9rem' }}>
                      {t('character_form.advanced.model')}
                      <InfoHint text={t('character_form.advanced_help.model')} />
                    </label>
                    <select
                      className="form-select"
                      value={charData.model || DEFAULT_CHAT_CONFIG.model}
                      onChange={e => handleModelChange(e.target.value)}
                      disabled={!canUseAdvancedConfig}
                      style={{ borderRadius: 12 }}
                    >
                      <option value="deepseek-chat">deepseek-chat</option>
                      <option value="deepseek-reasoner">deepseek-reasoner</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: '0.9rem' }}>
                      {t('character_form.advanced.temperature')}: {charData.temperature ?? DEFAULT_CHAT_CONFIG.temperature}
                      <InfoHint text={t('character_form.advanced_help.temperature')} />
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      className="form-range"
                      value={charData.temperature ?? DEFAULT_CHAT_CONFIG.temperature}
                      onChange={e => updateConfig('temperature', e.target.value, 0, 2, DEFAULT_CHAT_CONFIG.temperature)}
                      disabled={!canUseAdvancedConfig}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: '0.9rem' }}>
                      {t('character_form.advanced.top_p')}: {charData.top_p ?? DEFAULT_CHAT_CONFIG.top_p}
                      <InfoHint text={t('character_form.advanced_help.top_p')} />
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      className="form-range"
                      value={charData.top_p ?? DEFAULT_CHAT_CONFIG.top_p}
                      onChange={e => updateConfig('top_p', e.target.value, 0, 1, DEFAULT_CHAT_CONFIG.top_p)}
                      disabled={!canUseAdvancedConfig}
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label" style={{ fontSize: '0.9rem' }}>
                        {t('character_form.advanced.max_tokens')}: {charData.max_tokens ?? selectedTokenLimits.defaultValue}
                        <InfoHint text={t('character_form.advanced_help.max_tokens')} />
                      </label>
                      <select
                        className="form-select"
                        value={normalizeTokenTierValue(charData.model || DEFAULT_CHAT_CONFIG.model, charData.max_tokens ?? selectedTokenLimits.defaultValue)}
                        onChange={e => handleChange('max_tokens', Number(e.target.value))}
                        disabled={!canUseAdvancedConfig}
                        style={{ borderRadius: 12 }}
                      >
                        {selectedTokenTiers.map(tier => (
                          <option key={tier.value} value={tier.value}>
                            {t(`character_form.advanced_token_tiers.${tier.labelKey}`)} ({tier.value})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label" style={{ fontSize: '0.9rem' }}>
                        {t('character_form.advanced.presence_penalty')}: {charData.presence_penalty ?? DEFAULT_CHAT_CONFIG.presence_penalty}
                        <InfoHint text={t('character_form.advanced_help.presence_penalty')} />
                      </label>
                      <input
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        className="form-range"
                        value={charData.presence_penalty ?? DEFAULT_CHAT_CONFIG.presence_penalty}
                        onChange={e => updateConfig('presence_penalty', e.target.value, -2, 2, DEFAULT_CHAT_CONFIG.presence_penalty)}
                        disabled={!canUseAdvancedConfig}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label" style={{ fontSize: '0.9rem' }}>
                        {t('character_form.advanced.frequency_penalty')}: {charData.frequency_penalty ?? DEFAULT_CHAT_CONFIG.frequency_penalty}
                        <InfoHint text={t('character_form.advanced_help.frequency_penalty')} />
                      </label>
                      <input
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        className="form-range"
                        value={charData.frequency_penalty ?? DEFAULT_CHAT_CONFIG.frequency_penalty}
                        onChange={e => updateConfig('frequency_penalty', e.target.value, -2, 2, DEFAULT_CHAT_CONFIG.frequency_penalty)}
                        disabled={!canUseAdvancedConfig}
                      />
                    </div>
                  </div>
                  {!canUseAdvancedConfig && (
                    <div className="mt-2" style={{ fontSize: '0.82rem', color: '#b45309' }}>
                      {t('character_form.advanced.locked_notice')}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canFork ? 0.5 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-diagram-3-fill" style={{ fontSize: '1.2rem', color: '#22c55e' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {t('character_form.forkable') || 'Allow Forking'}
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
                    disabled={!canFork || mode === 'fork'}
                    onChange={e => handleChange('is_forkable', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: (canFork && mode !== 'fork') ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cover + Avatar Pictures */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>{t('character_form.picture')}</label>
            <div className="d-flex align-items-center gap-3" style={{ flexWrap: 'wrap' }}>
              <div style={{ width: 148, height: 96, overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #e9ecef' }}>
                {picturePreview ? (
                  <img src={picturePreview} alt={t('character_form.alt_preview')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>{t('character_form.no_picture')}</div>
                )}
              </div>
              <div style={{ width: 72, height: 72, overflow: 'hidden', borderRadius: '50%', background: '#fff', border: '1px solid #e9ecef' }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt={t('character_form.alt_preview')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.75rem' }}>{t('character_form.avatar_label')}</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={e => {
                    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                    if (!f) return;
                    setPicture(f);
                    const reader = new FileReader();
                    reader.onload = () => {
                      setPicturePreview(reader.result);
                    };
                    reader.readAsDataURL(f);
                    setRawSelectedFile(f);
                    setShowCrop(true);
                    // Reset so selecting the same file again still triggers onChange.
                    e.target.value = '';
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
            <div className="text-muted mt-2" style={{ fontSize: '0.78rem' }}>
              {t('character_form.cover_avatar_hint')}
            </div>
          </div>

          {mode === 'create' && (
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '1rem' }}>
              点击创建即视为同意{' '}
              <button
                type="button"
                onClick={() => setShowUgcPolicyModal(true)}
                style={{ border: 'none', background: 'transparent', color: '#9a5b20', fontSize: '0.82rem', textDecoration: 'underline', padding: 0 }}
              >
                《版权与用户生成内容（UGC）发布须知》
              </button>
            </p>
          )}

          <div className="d-flex gap-3 mt-4 justify-content-end">
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {t('character_form.processing')}
                </>
              ) : (
                <>
                  <i className="bi bi-save me-2"></i>{mode === 'edit' ? t('character_form.save') : t('character_form.create')}
                </>
              )}
            </PrimaryButton>
            {mode === 'edit' && (
              <PrimaryButton
                type="button"
                disabled={isSubmitting}
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

      {isSubmitting && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              padding: '1.25rem 1.2rem',
              textAlign: 'center',
            }}
          >
            <div className="spinner-border" role="status" aria-hidden="true" style={{ width: '2.2rem', height: '2.2rem', color: '#736B92' }}></div>
            <div style={{ marginTop: '0.9rem', fontWeight: 700, color: '#1f2937', fontSize: '1rem' }}>
              {t('character_form.processing')}
            </div>
            <div style={{ marginTop: '0.45rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {t('character_form.processing_tip')}
            </div>
          </div>
        </div>,
        document.body
      )}

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
            onClick={() => {
              if (!isSubmitting) setShowAssistant(true);
            }}
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '-4px 4px 16px rgba(102, 126, 234, 0.4)',
              zIndex: 1000,
              transition: 'all 0.3s ease',
              gap: '0.5rem',
              opacity: isSubmitting ? 0.6 : 1,
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
          onSave={({ file, dataUrl }) => {
            setAvatarPicture(file);
            setAvatarPreview(dataUrl);
            setShowCrop(false);
            setRawSelectedFile(null);
          }}
          size={160}
          mode="avatar"
        />, document.body)
      }
      <ConfirmModal
        show={confirmModal.show}
        title={t('confirm.delete_character.title')}
        message={t('confirm.delete_character.message')}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false })}
      />

      <UgcPolicyModal
        show={showUgcPolicyModal}
        onClose={() => setShowUgcPolicyModal(false)}
        onAgree={() => setShowUgcPolicyModal(false)}
      />

      {showAssistant && (
        <CharacterAssistantModal
          onApply={handleApplyAssistant}
          onHide={() => setShowAssistant(false)}
          currentCharData={charData}
          initialMessages={assistantMessages}
          initialGeneratedData={assistantGeneratedData}
          onMessagesChange={setAssistantMessages}
          onGeneratedDataChange={setAssistantGeneratedData}
        />
      )}
    </PageWrapper>
  );
}
