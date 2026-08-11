import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
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
import { getApiErrorMessage } from '../utils/apiErrorUtils';
import { formatCompactTokenCount, getTokenQuotaLabel } from '../utils/creditDisplay';

import { getModelConfig, AVAILABLE_MODEL_IDS } from '../utils/modelConfigs';
import { DEFAULT_CONTEXT_WINDOW_TIER, getFilteredContextWindowTierOptions, normalizeContextWindowTier } from '../utils/contextWindow';
import ModelSelect from '../components/ModelSelect';
import BanNotice from '../components/BanNotice';

export default function CharacterFormPage() {
  const { t } = useTranslation();
  const SHARED_TOKEN_LIMITS = { min: 1, max: 8192, defaultValue: 4096, step: 128 };
  const SHARED_TOKEN_TIERS = [
    { value: 1024, labelKey: 'short_sentence' },
    { value: 2048, labelKey: 'paragraph' },
    { value: 4096, labelKey: 'long' },
    { value: 6144, labelKey: 'very_long' },
    { value: 8192, labelKey: 'maximum' },
  ];
  const normalizeModelName = (modelName) => (
    AVAILABLE_MODEL_IDS.includes(modelName)
      ? modelName
      : DEFAULT_CHAT_CONFIG.model
  );
  const getTokenLimits = () => SHARED_TOKEN_LIMITS;
  const getTokenTiers = (modelId) => {
    const cfg = getModelConfig(modelId);
    if (!cfg) return SHARED_TOKEN_TIERS;
    return SHARED_TOKEN_TIERS.filter((t) => t.value <= cfg.maxOutputTokens);
  };
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
  const InfoHint = ({ text }) => {
    const [visible, setVisible] = useState(false);
    return (
      <span
        aria-label={text}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, color: '#6b7280', cursor: 'help', position: 'relative' }}
      >
        <i className="bi bi-info-circle" style={{ fontSize: '0.9rem' }}></i>
        {visible && (
          <span style={{
            position: 'absolute',
            bottom: '130%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#232323',
            color: '#fff',
            borderRadius: 8,
            padding: '0.35rem 0.7rem',
            fontSize: '0.82rem',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}>
            {text}
          </span>
        )}
      </span>
    );
  };
  const DEFAULT_CHAT_CONFIG = {
    model: 'qwen-plus-character',
    temperature: 1.3,
    top_p: 0.9,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
    context_window_tier: DEFAULT_CONTEXT_WINDOW_TIER,
  };
  const WALLPAPER_OPTIONS = [
    { id: 'none', labelKey: 'chat.wallpaper_default', url: null },
    { id: 'aurora', labelKey: 'chat.wallpaper_aurora', url: '/wallpapers/aurora.svg' },
    { id: 'sunrise', labelKey: 'chat.wallpaper_sunrise', url: '/wallpapers/sunrise.svg' },
    { id: 'waves', labelKey: 'chat.wallpaper_waves', url: '/wallpapers/waves.svg' },
  ];
  const MAX_NAME_LENGTH = 50;
  const MAX_PERSONA_LENGTH = 400;
  const MAX_TAGLINE_LENGTH = 100;
  const ADVANCED_MAX_LONG_DESCRIPTION_LENGTH = 15000;

  // Get id param from route
  const params = useParams();
  const id = params.id;
  const location = useLocation();
  const isForkMode = location.pathname.includes('/fork/');
  const mode = id ? (isForkMode ? 'fork' : 'edit') : 'create';
  const [isAppealMode, setIsAppealMode] = useState(false);
  const [hasPendingAppeal, setHasPendingAppeal] = useState(false);
  const MAX_GREETING_LENGTH = 200;
  const MAX_SAMPLE_LENGTH = 200;
  const MAX_TAGS = 20;
  // Special prompt stored when a character uses an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';

  const { sessionToken, userData, refreshUserData } = useContext(AuthContext);

  // ── Draft helpers ──────────────────────────────────────────────
  const getDraftKey = useCallback(() => {
    const uid = userData?.id || 'anonymous';
    if (mode === 'edit' && id) return `cf_draft_edit_${id}_${uid}`;
    if (mode === 'fork' && id) return `cf_draft_fork_${id}_${uid}`;
    return `cf_draft_create_${uid}`;
  }, [userData?.id, mode, id]);

  const saveDraft = useCallback((data) => {
    try {
      const serializable = {
        charData: data.charData,
        isImprovisingGreeting: data.isImprovisingGreeting,
        mode,
        id: id || null,
        savedAt: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(serializable));
    } catch (_) { /* quota exceeded */ }
  }, [getDraftKey, mode, id]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(getDraftKey()); } catch (_) {}
  }, [getDraftKey]);

  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(getDraftKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Ignore drafts older than 7 days
      if (Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getDraftKey());
        return null;
      }
      return parsed;
    } catch (_) { return null; }
  }, [getDraftKey]);

  const isProUser = !!userData?.is_pro;

  const canUseAdvancedConfig = isProUser;
  // Advanced character context (long description) is available to all users
  const canUseAdvancedCharacter = true;
  const canPrivate = true;
  const canFork = isProUser;
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
    greetings: [],
    is_public: true,
    is_forkable: false,
    is_free: true,
    price: 0,
    forked_from_id: null,
    forked_from_name: null,
    forked_from_creator_id: null,
    forked_from_creator_name: null,
    forked_from_creator_profile_pic: null,
    model: DEFAULT_CHAT_CONFIG.model,
    temperature: DEFAULT_CHAT_CONFIG.temperature,
    top_p: DEFAULT_CHAT_CONFIG.top_p,
    max_tokens: DEFAULT_CHAT_CONFIG.max_tokens,
    presence_penalty: DEFAULT_CHAT_CONFIG.presence_penalty,
    frequency_penalty: DEFAULT_CHAT_CONFIG.frequency_penalty,
    context_window_tier: null,
    background: JSON.stringify({ type: 'preset', preset_id: 'none' }),
  });
  const [picture, setPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [pictureAspectRatio, setPictureAspectRatio] = useState(1);
  const [avatarPicture, setAvatarPicture] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedDefaultPicture, setSelectedDefaultPicture] = useState(null);
  const [backgroundPicture, setBackgroundPicture] = useState(null);
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const DEFAULT_PICTURES = [
    { name: 'male_1', src: '/default/male_1.png', label: 'Male 1' },
    { name: 'male_2', src: '/default/male_2.png', label: 'Male 2' },
    { name: 'female_1', src: '/default/female_1.png', label: 'Female 1' },
    { name: 'female_2', src: '/default/female_2.png', label: 'Female 2' },
  ];
  const handleSelectDefaultPicture = async (src) => {
    if (selectedDefaultPicture === src) {
      // Deselect
      setSelectedDefaultPicture(null);
      setPicture(null);
      setPicturePreview(null);
      setAvatarPicture(null);
      setAvatarPreview(null);
      return;
    }
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const filename = src.split('/').pop();
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      setPicture(file);
      setAvatarPicture(file);
      setPicturePreview(src);
      setAvatarPreview(src);
      setPictureAspectRatio(1);
      setSelectedDefaultPicture(src);
      setRawSelectedFile(null);
      setShowCrop(false);
    } catch (err) {
      toast.show('加载默认图片失败', { type: 'error' });
    }
  };
  const [isImprovisingGreeting, setIsImprovisingGreeting] = useState(false);
  const greetingRefs = useRef(new Map());
  const autoResizeGreeting = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  // Auto-resize all greeting textareas when greetings array changes
  useEffect(() => {
    greetingRefs.current.forEach((el) => autoResizeGreeting(el));
  }, [charData.greetings]);
  const [showCrop, setShowCrop] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit' || mode === 'fork');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const draftTimerRef = useRef(null);
  const draftRestoredRef = useRef(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const selectedTokenLimits = getTokenLimits(charData.model || DEFAULT_CHAT_CONFIG.model);
  const selectedTokenTiers = getTokenTiers(charData.model || DEFAULT_CHAT_CONFIG.model);
  const effectiveContextLabel = charData.context_label === 'advanced' ? 'advanced' : 'standard';

  const formatTokenCapError = (payload) => {
    const tokenPayload = payload?.error === 'CREDIT_CAP_REACHED'
      ? payload
      : (payload?.detail?.error === 'CREDIT_CAP_REACHED' ? payload.detail : null);

    if (!tokenPayload) return null;

    const limits = tokenPayload?.credit_limits || {};
    const scopeLabel = getTokenQuotaLabel(limits?.cap_scope);
    const cap = Number(limits?.credit_cap || 0);
    const remaining = Number(limits?.remaining_credits || 0);

    if (cap > 0) {
      return `${tokenPayload.message || '已达到点数额度上限。'} (${scopeLabel}: 剩余 ${formatCompactTokenCount(remaining)} / ${formatCompactTokenCount(cap)})`;
    }

    return tokenPayload.message || '已达到点数额度上限。';
  };

  // ── Debounced draft auto-save ─────────────────────────────────
  useEffect(() => {
    // Don't save while still loading existing character data
    if (loading) return;
    // Don't save before draft has been restored (avoids overwriting stored draft)
    if (!draftRestoredRef.current) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraft({ charData, isImprovisingGreeting });
    }, 800);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [charData, isImprovisingGreeting, loading, mode, saveDraft]);

  // ── Restore draft on mount (create / edit / fork) ─────────────
  useEffect(() => {
    // For edit/fork modes, wait until server data finishes loading
    if ((mode === 'edit' || mode === 'fork') && loading) return;
    if (draftRestoredRef.current) return;
    const draft = loadDraft();
    if (draft && draft.charData) {
      setShowDraftBanner(true);
      // Don't set draftRestoredRef.current here — wait until the user
      // actually restores or discards, so autosave can't clobber it first.
    } else {
      draftRestoredRef.current = true;
    }
  }, [mode, loadDraft, loading]);

  // ── beforeunload warning for unsaved changes ──────────────────
  useEffect(() => {
    const hasContent = charData.name.trim() || charData.persona.trim() || charData.greetings.some(g => g.trim());
    if (!hasContent) return;

    const handler = (e) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires this
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [charData.name, charData.persona, charData.greetings]);

  // Enforce level locks on fork/paid options
  useEffect(() => {
    setCharData(prev => {
      let next = prev;
      if (!canPrivate && !prev.is_public) {
        next = { ...next, is_public: true };
      }
      // In fork mode, must be free and forkable
      if (mode === 'fork') {
        next = { ...next, is_free: true, price: 0, is_forkable: true };
      }
      return next;
    });
  }, [canPrivate, mode]);

  useEffect(() => {
    if (mode === 'edit' || mode === 'fork') {
      if (!id) {
        toast.show('缺少角色 ID', { type: 'error' });
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
          if (mode === 'edit' && String(data.creator_id) !== String(userData?.id)) {
            toast.show('您只能编辑自己创建的内容。', { type: 'error' });
            navigate('/profile');
            return;
          }
          // If greeting equals our special improvising marker, set the checkbox
          const loadedGreetings = Array.isArray(data.greetings) ? data.greetings : (data.greeting ? [data.greeting] : []);
          const hasImprov = loadedGreetings.includes(SPECIAL_IMPROVISING_GREETING);
          setIsImprovisingGreeting(hasImprov);
          const manualGreetings = loadedGreetings.filter(g => g !== SPECIAL_IMPROVISING_GREETING);
          
          if (mode === 'fork') {
            const sourceIsAdvanced = data.context_label === 'advanced';
            const loadedModel = normalizeModelName(data.model);
            // In fork mode, set forked_from fields and clear the name for new creation
            setCharData({
              name: data.name,
              persona: data.persona || '',
              context_label: sourceIsAdvanced ? 'advanced' : 'standard',
              sample: data.example_messages || '',
              long_description: data.long_description || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greetings: manualGreetings,
              is_public: !!data.is_public,
              is_forkable: true,
              is_free: true,
              price: 0,
              forked_from_id: data.id,
              forked_from_name: data.name,
              forked_from_creator_id: data.creator_id || null,
              forked_from_creator_name: data.creator_name || null,
              forked_from_creator_profile_pic: data.creator_profile_pic || null,
              model: loadedModel,
              temperature: clampValue(data.temperature, 0, 2, DEFAULT_CHAT_CONFIG.temperature),
              top_p: clampValue(data.top_p, 0, 1, DEFAULT_CHAT_CONFIG.top_p),
              max_tokens: normalizeTokenTierValue(loadedModel, data.max_tokens),
              presence_penalty: clampValue(data.presence_penalty, -2, 2, DEFAULT_CHAT_CONFIG.presence_penalty),
              frequency_penalty: clampValue(data.frequency_penalty, -2, 2, DEFAULT_CHAT_CONFIG.frequency_penalty),
              context_window_tier: normalizeContextWindowTier(data.context_window_tier, loadedModel),
              background: data.background ? JSON.stringify(data.background) : JSON.stringify({ type: 'preset', preset_id: 'none' }),
            });
          } else {
            const loadedModel = normalizeModelName(data.model);
            // Edit mode
            setCharData({
              name: data.name || '',
              persona: data.persona || '',
              context_label: data.context_label === 'advanced' ? 'advanced' : 'standard',
              sample: data.example_messages || '',
              long_description: data.long_description || '',
              tagline: data.tagline || '',
              tags: data.tags || [],
              greetings: manualGreetings,
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
              context_window_tier: normalizeContextWindowTier(data.context_window_tier, loadedModel),
              background: data.background ? JSON.stringify(data.background) : JSON.stringify({ type: 'preset', preset_id: 'none' }),
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
          // Load background preview for uploaded backgrounds
          if (data.background && data.background.type === 'upload' && data.background.url) {
            setBackgroundPreview(`${window.API_BASE_URL.replace(/\/$/, '')}/${String(data.background.url).replace(/^\//, '')}`);
          }
          if (mode === 'edit' && data.moderation_status) {
            setIsAppealMode(true);
            fetch(`${window.API_BASE_URL}/api/content-ban-appeal/character/${id}`, {
              headers: { 'Authorization': sessionToken }
            })
              .then(res => res.ok ? res.json() : [])
              .then(appeals => {
                if (Array.isArray(appeals) && appeals.some(a => a.status === 'pending')) {
                  setHasPendingAppeal(true);
                }
              })
              .catch(() => {});
          }
        });
    }
  }, [mode, id, navigate, sessionToken, t, userData?.id]);

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
    const nextContextTier = normalizeContextWindowTier(
      charData.context_window_tier,
      nextModel,
    );
    setCharData(prev => ({
      ...prev,
      model: nextModel,
      // Reset to model default for predictable UX when switching models.
      max_tokens: normalizeTokenTierValue(nextModel, nextTokenLimits.defaultValue),
      context_window_tier: nextContextTier,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (isSubmitting) return;
  if (!sessionToken) {
      toast.show('您需要登录才能操作。', { type: 'error' });
      navigate("/");
      return;
    }
    if (!charData.name.trim() || !charData.persona.trim()) {
      toast.show('名称和人设为必填项。', { type: 'error' });
      return;
    }
    if (!charData.tags || charData.tags.length === 0) {
      toast.show('请至少添加一个标签。', { type: 'error' });
      return;
    }
    const hasAnyManualGreeting = charData.greetings.some(g => g.trim());
    if (!isImprovisingGreeting && !hasAnyManualGreeting) {
      toast.show('请至少添加一条问候语，或启用 AI 生成问候语。', { type: 'error' });
      return;
    }
    if (!picture && !selectedDefaultPicture && !picturePreview) {
      toast.show('请上传或选择角色封面图片', { type: 'error' });
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
    const trimmedLongDescription = charData.long_description.trim();
    if (effectiveContextLabel === 'advanced' && trimmedLongDescription.length > ADVANCED_MAX_LONG_DESCRIPTION_LENGTH) {
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
  // Build greetings list: manual greetings + optional improvise sentinel
  const finalGreetings = [...charData.greetings.filter(g => g.trim())];
  if (isImprovisingGreeting) {
    finalGreetings.push(SPECIAL_IMPROVISING_GREETING);
  }
  formData.append("greetings", JSON.stringify(finalGreetings));
    formData.append("sample_dialogue", charData.sample.trim());
    if (effectiveContextLabel === 'advanced') {
      formData.append("long_description", trimmedLongDescription);
    }
    const finalModel = charData.model || DEFAULT_CHAT_CONFIG.model;
  const finalTokenLimits = getTokenLimits(finalModel);
  const safeMaxTokens = clampValue(charData.max_tokens, finalTokenLimits.min, finalTokenLimits.max, finalTokenLimits.defaultValue);
  formData.append("model", finalModel);
    formData.append("context_window_tier", String(normalizeContextWindowTier(charData.context_window_tier, finalModel)));
    formData.append("temperature", String(canUseAdvancedConfig ? (charData.temperature ?? DEFAULT_CHAT_CONFIG.temperature) : DEFAULT_CHAT_CONFIG.temperature));
    formData.append("top_p", String(canUseAdvancedConfig ? (charData.top_p ?? DEFAULT_CHAT_CONFIG.top_p) : DEFAULT_CHAT_CONFIG.top_p));
  formData.append("max_tokens", String(canUseAdvancedConfig ? safeMaxTokens : DEFAULT_CHAT_CONFIG.max_tokens));
    formData.append("presence_penalty", String(canUseAdvancedConfig ? (charData.presence_penalty ?? DEFAULT_CHAT_CONFIG.presence_penalty) : DEFAULT_CHAT_CONFIG.presence_penalty));
    formData.append("frequency_penalty", String(canUseAdvancedConfig ? (charData.frequency_penalty ?? DEFAULT_CHAT_CONFIG.frequency_penalty) : DEFAULT_CHAT_CONFIG.frequency_penalty));
    formData.append("is_public", String(!!charData.is_public));
    formData.append("is_forkable", String(!!charData.is_forkable));
    if (picture) formData.append("picture", picture);
    if (avatarPicture) formData.append("avatar_picture", avatarPicture);
    // Background
    const bgConfig = (() => {
      try { return JSON.parse(charData.background); } catch (_) { return { type: 'none' }; }
    })();
    formData.append("background", JSON.stringify(bgConfig));
    if (bgConfig.type === 'upload' && backgroundPicture) {
      formData.append("background_picture", backgroundPicture);
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(mode === 'edit' ? `${window.API_BASE_URL}/api/update-character` : `${window.API_BASE_URL}/api/create-character`, {
        method: "POST",
  headers: { 'Authorization': sessionToken },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        clearDraft();
        if (refreshUserData) {
          refreshUserData({ silent: true });
        }
        // If in appeal mode and no pending appeal, submit the content ban appeal after saving
        if (isAppealMode && !hasPendingAppeal) {
          try {
            await fetch(`${window.API_BASE_URL}/api/content-ban-appeal`, {
              method: 'POST',
              headers: { 'Authorization': sessionToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity_type: 'character', entity_id: Number(id), appeal_reason: appealReason.trim() }),
            });
          } catch (_) { /* best effort */ }
          toast.show('内容已保存并提交申诉。');
          navigate(`/character/${id}`);
        } else {
          toast.show(mode === 'edit' ? '角色已更新！' : mode === 'fork' ? '角色已衍生！' : '角色已创建！');
          navigate(mode === 'edit' ? "/profile" : "/profile");
        }
      } else {
        const tokenCapMessage = formatTokenCapError(data);
        if (tokenCapMessage) {
          toast.show(tokenCapMessage, { type: 'error' });
        } else {
          toast.show(getApiErrorMessage(data, '发生错误。', t), { type: 'error' });
        }
      }
    } catch (error) {
      toast.show('发生错误。', { type: 'error' });
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
      toast.show(data.message || data.detail || '已删除角色');
      if (res.ok) navigate("/profile");
    } catch (err) {
      toast.show('发生错误。', { type: 'error' });
    }
  };

  if (loading) return null;
  return (
    <PageWrapper>
      <div className="character-form-page flex-grow-1 d-flex flex-column align-items-center" style={{ padding: '2rem 1rem', width: '100%', maxWidth: 800, margin: '0 auto' }}>
        <style>{`
          .character-form-page .form-control::placeholder,
          .character-form-page textarea::placeholder {
            color: #c5ccd3;
            opacity: 1;
          }
        `}</style>
          <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px', textAlign: 'left', width: '100%' }}>{isAppealMode ? '修改并申诉' : mode === 'edit' ? '编辑角色' : mode === 'fork' ? '衍生角色' : '新建角色'}</h2>

        <form onSubmit={handleSubmit} className="w-100" encType="multipart/form-data">
          <BanNotice banType={userData?.ban_type} banUntil={userData?.ban_until} context="upload" />

          {/* Draft restore banner */}
          {showDraftBanner && (
            <div
              className="alert d-flex align-items-center justify-content-between mb-4"
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 12,
                padding: '0.75rem 1rem',
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-file-earmark-text" style={{ fontSize: '1.1rem', color: '#d97706' }}></i>
                <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>
                  检测到未保存的草稿，是否需要恢复？
                </span>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: '#f59e0b',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 600,
                    padding: '0.3rem 0.8rem',
                  }}
                  onClick={() => {
                    const draft = loadDraft();
                    if (draft && draft.charData) {
                      setCharData(draft.charData);
                      if (typeof draft.isImprovisingGreeting === 'boolean') {
                        setIsImprovisingGreeting(draft.isImprovisingGreeting);
                      }
                      toast.show('草稿已恢复', { type: 'success' });
                    }
                    draftRestoredRef.current = true;
                    setShowDraftBanner(false);
                  }}
                >
                  恢复
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: 'transparent',
                    color: '#92400e',
                    borderRadius: 8,
                    border: '1px solid #d97706',
                    fontWeight: 500,
                    padding: '0.3rem 0.8rem',
                  }}
                  onClick={() => {
                    clearDraft();
                    draftRestoredRef.current = true;
                    setShowDraftBanner(false);
                  }}
                >
                  丢弃
                </button>
              </div>
            </div>
          )}

          {isAppealMode && (
            <div className="alert alert-warning mb-4" role="alert" style={{ borderRadius: 10 }}>
              <i className="bi bi-megaphone-fill me-2"></i>
              <strong>申诉模式</strong>
              <div className="mt-1" style={{ fontSize: '0.88rem' }}>
                您可以修改内容后提交申诉。管理员将审核修改后的版本并决定是否解除限制。
              </div>
            </div>
          )}
          {/* Forked From - Display only */}
          {charData.forked_from_id && charData.forked_from_name && (
            <div
              className="mb-4 d-flex align-items-center gap-3"
              style={{
                padding: '0.75rem 1rem',
                background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
                border: '1px solid #d0d7f5',
                borderRadius: '10px',
              }}
            >
              <i className="bi bi-diagram-3-fill" style={{ fontSize: '1.1rem', color: '#7c6abf', flexShrink: 0 }}></i>
              <div className="d-flex flex-column" style={{ gap: '2px', minWidth: 0 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#7c6abf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  参考自
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d2d2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {charData.forked_from_name}
                </span>
                {charData.forked_from_creator_name && (
                  <button
                    type="button"
                    onClick={() => charData.forked_from_creator_id && navigate(`/profile/${encodeURIComponent(charData.forked_from_creator_id)}`)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: 'none', border: 'none', padding: 0, cursor: charData.forked_from_creator_id ? 'pointer' : 'default',
                      color: '#555', fontSize: '0.8rem', fontWeight: 500,
                    }}
                  >
                    {charData.forked_from_creator_profile_pic ? (
                      <img
                        src={`${window.API_BASE_URL.replace(/\/$/, '')}/${String(charData.forked_from_creator_profile_pic).replace(/^\//, '')}`}
                        alt={charData.forked_from_creator_name}
                        style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <i className="bi bi-person-circle" style={{ fontSize: '0.85rem' }}></i>
                    )}
                    {charData.forked_from_creator_name}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 角色图片 (mandatory) */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              角色图片
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>*</span>
            </label>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 'min(360px, 100%)',
                aspectRatio: picturePreview ? String(pictureAspectRatio || 1) : '1 / 1',
                marginBottom: 12,
              }}
            >
              <label
                htmlFor="character-picture-upload"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'block',
                  borderRadius: 16,
                  background: '#f5f6fa',
                  border: '1.5px solid #e9ecef',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {picturePreview ? (
                  <img
                    src={picturePreview}
                    alt="预览"
                    onLoad={e => {
                      const nextRatio = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                      if (Number.isFinite(nextRatio) && nextRatio > 0) {
                        setPictureAspectRatio(nextRatio);
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#eef2f7' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      color: '#94a3b8',
                      gap: 8,
                      fontSize: '0.95rem',
                    }}
                  >
                    <i className="bi bi-image" style={{ fontSize: '1.7rem' }}></i>
                    <span>点击上传封面图片</span>
                    <span style={{ fontSize: '0.82rem' }}>支持 JPG / PNG / GIF / WebP / BMP / TIFF</span>
                  </div>
                )}
                <input
                  id="character-picture-upload"
                  type="file"
                  accept="image/*"
                  className="d-none"
                  onChange={e => {
                    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                    if (!f) return;
                    setPicture(f);
                    setSelectedDefaultPicture(null);
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
                />
              </label>

              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    overflow: 'hidden',
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1px solid #e9ecef',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
                  }}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.75rem' }}>头像</div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    lineHeight: 1,
                    color: '#475569',
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 999,
                    padding: '0.18rem 0.45rem',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  头像预览
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {DEFAULT_PICTURES.map(pic => (
                <div
                  key={pic.name}
                  onClick={() => handleSelectDefaultPicture(pic.src)}
                  title={selectedDefaultPicture === pic.src ? `${pic.label} — 点击取消选择` : pic.label}
                  style={{
                    position: 'relative',
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: selectedDefaultPicture === pic.src ? '3px solid #7c3aed' : '2px solid #e9ecef',
                    boxShadow: selectedDefaultPicture === pic.src ? '0 0 0 3px rgba(124, 58, 237, 0.25)' : 'none',
                    transition: 'border 0.15s, box-shadow 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }}>
                    <img
                      src={pic.src}
                      alt={pic.label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  {selectedDefaultPicture === pic.src && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#7c3aed',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        pointerEvents: 'none',
                      }}
                    >
                      ×
                    </div>
                  )}
                </div>
              ))}
            </div>
            <small className="text-muted" style={{ display: 'block', marginTop: 6 }}>
              或选择默认图片，将同时用作封面和头像
            </small>
          </div>

          {/* Name */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              名称
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>*</span>
            </label>
            <input
              className="form-control"
              required
              value={charData.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="例如：威廉·莎士比亚"
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

          {/* Tagline */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              简介
              <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>仅用于展示，不影响角色性格和对话风格</small>
            </label>
            <input
              className="form-control"
              value={charData.tagline}
              maxLength={MAX_TAGLINE_LENGTH}
              placeholder=""
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

          {/* Persona */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              设定
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>*</span>
              <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>设定决定了角色的行为方式和说话风格，仅自己可见</small>
            </label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(charData.persona.length / 80)))}
              required
              value={charData.persona}
              maxLength={MAX_PERSONA_LENGTH}
              placeholder="描述角色的特质、背景和说话风格。例如：文艺复兴时期的剧作家，语言华丽，喜欢用隐喻。"
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

          {/* Greetings */}
          <div className="mb-4">
            <label className="form-label fw-bold d-flex align-items-center gap-3" style={{ color: '#232323' }}>
              <span>
                问候语
                <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, whiteSpace: 'nowrap' }}>
                <input
                  id="improviseGreeting"
                  type="checkbox"
                  checked={isImprovisingGreeting}
                  onChange={e => setIsImprovisingGreeting(e.target.checked)}
                />
                <label htmlFor="improviseGreeting" style={{ margin: 0, fontSize: '0.95rem', cursor: 'pointer' }}>启用AI生成问候语</label>
              </span>
            </label>

            {/* Manual greeting entries */}
            {charData.greetings.map((g, idx) => (
              <div key={idx} className="d-flex gap-2 mb-2 align-items-start">
                <span style={{ minWidth: 24, textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '0.88rem', lineHeight: 2.2 }}>#{idx + 1}</span>
                <textarea
                  className="form-control"
                  rows={1}
                  ref={el => {
                    if (el) {
                      greetingRefs.current.set(idx, el);
                      autoResizeGreeting(el);
                    } else {
                      greetingRefs.current.delete(idx);
                    }
                  }}
                  value={g}
                  maxLength={MAX_GREETING_LENGTH}
                  onInput={e => autoResizeGreeting(e.target)}
                  onChange={e => {
                    const updated = [...charData.greetings];
                    updated[idx] = e.target.value;
                    handleChange('greetings', updated);
                  }}
                  placeholder=""
                  style={{
                    background: '#f5f6fa',
                    color: '#18191a',
                    border: '1.5px solid #e9ecef',
                    borderRadius: 12,
                    fontSize: '1.02rem',
                    padding: '0.5rem 0.9rem',
                    boxShadow: 'none',
                    outline: 'none',
                    resize: 'none',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                />
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    const updated = charData.greetings.filter((_, i) => i !== idx);
                    handleChange('greetings', updated);
                  }}
                  style={{ borderRadius: 8, padding: '0.3rem 0.6rem', flexShrink: 0, marginTop: 2 }}
                  title="删除"
                >
                  <i className="bi bi-trash"></i>
                </button>
                <small className="text-muted" style={{ minWidth: 45, textAlign: 'right', lineHeight: 2.2 }}>
                  {g.length}/{MAX_GREETING_LENGTH}
                </small>
              </div>
            ))}

            {/* Add greeting button */}
            {charData.greetings.length < 20 && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mt-1"
                onClick={() => handleChange('greetings', [...charData.greetings, ''])}
                style={{ borderRadius: 10 }}
              >
                <i className="bi bi-plus-lg me-1"></i>
                添加问候语
              </button>
            )}

            {/* Show placeholder when list is empty and improvise is off */}
            {charData.greetings.length === 0 && !isImprovisingGreeting && (
              <div className="text-muted mt-2" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                请至少添加一条问候语，或启用 AI 生成问候语。
              </div>
            )}

            {/* AI-generated entry indicator */}
            {isImprovisingGreeting && (
              <div className="mt-2 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem', color: '#7c3aed' }}>
                <i className="bi bi-magic"></i>
                <span>AI 生成的问候语将作为一个随机选项。</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>
              标签
              <span style={{ color: '#d32f2f', marginLeft: 6 }}>*</span>
              <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>第一个标签会显示在封面上</small>
            </label>
            <TagsInput tags={charData.tags} setTags={value => handleChange('tags', value)} maxTags={MAX_TAGS} placeholder="输入标签后按Enter确认" hint="输入标签后点按Enter确认" />
            <small className="text-muted" style={{ top: 0, right: 0 }}>
              {charData.tags.length}/{MAX_TAGS} 个标签
            </small>
          </div>

          {/* Sample Dialogue */}
          <div className="mb-4 position-relative">
            <label className="form-label fw-bold" style={{ color: '#232323' }}>示例对话（可选）</label>
            <textarea
              className="form-control"
              rows={Math.max(5, Math.min(20, Math.ceil(charData.sample.length / 80)))}
              value={charData.sample}
              maxLength={MAX_SAMPLE_LENGTH}
              placeholder="添加 2–3 句示例台词来体现语气。"
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

          {/* Detailed Description Toggle */}
          <div className="mb-3 d-flex align-items-center justify-content-between" style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 14, padding: '0.75rem 1rem' }}>
            <div>
              <span style={{ fontWeight: 700, color: '#232323', fontSize: '0.97rem' }}>启用详细人物设定</span>
              {effectiveContextLabel === 'advanced' ? (
                <small style={{ display: 'block', color: '#7c3aed', marginTop: 2 }}>可填写最多15000字的详细人物设定，用于构建更丰富的角色背景</small>
              ) : (
                <small style={{ display: 'block', color: '#888', marginTop: 2 }}>开启后可额外填写最多15000字的详细人物设定</small>
              )}
            </div>
            <div className="form-check form-switch mb-0" style={{ paddingLeft: 0 }}>
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="detailedDescriptionToggle"
                checked={effectiveContextLabel === 'advanced'}
                onChange={e => handleChange('context_label', e.target.checked ? 'advanced' : 'standard')}
                style={{ width: '2.5em', height: '1.4em', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Long Description (shown when detailed description is enabled) */}
          {effectiveContextLabel === 'advanced' && (
            <div className="mb-4 position-relative">
              <label className="form-label fw-bold" style={{ color: '#232323' }}>
                详细设定
                <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>
                  用于补充更完整的背景、经历、关系与规则，仅自己可见
                </small>
              </label>
              <textarea
                className="form-control"
                rows={Math.max(6, Math.min(30, Math.ceil((charData.long_description || '').length / 80)))}
                value={charData.long_description || ''}
                maxLength={ADVANCED_MAX_LONG_DESCRIPTION_LENGTH}
                placeholder=""
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
              <small className="text-muted position-absolute" style={{ top: 0, right: 0 }}>
                {(charData.long_description || '').trim().length}/{ADVANCED_MAX_LONG_DESCRIPTION_LENGTH}
              </small>
            </div>
          )}

          {/* Model & Context Window — available to all users */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '0.75rem' }}>
              聊天配置
            </label>
            <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '0.9rem' }}>
                  模型
                  <InfoHint text={t('character_form.advanced_help.model')} />
                </label>
                <ModelSelect
                  className="form-select"
                  value={charData.model || DEFAULT_CHAT_CONFIG.model}
                  onChange={handleModelChange}
                  style={{ borderRadius: 12 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.9rem' }}>
                  上下文长度
                  <InfoHint text={'更长的上下文长度可以保留更多的历史消息，但是会加速token消耗'} />
                </label>
                {(() => {
                  const ctxOptions = getFilteredContextWindowTierOptions(
                    charData.model || DEFAULT_CHAT_CONFIG.model,
                  );
                  const selectedCtx = normalizeContextWindowTier(
                    charData.context_window_tier,
                    charData.model || DEFAULT_CHAT_CONFIG.model,
                  );
                  return (
                    <select
                      className="form-select"
                      value={selectedCtx}
                      onChange={e => {
                        const normalized = normalizeContextWindowTier(
                          e.target.value,
                          charData.model || DEFAULT_CHAT_CONFIG.model,
                        );
                        handleChange('context_window_tier', normalized);
                      }}
                      style={{ borderRadius: 12 }}
                    >
                      {ctxOptions.map(tier => (
                        <option key={tier.key} value={tier.key}>
                          {`${tier.tokens / 1000}k tokens`}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          </div>

          <hr style={{ borderTop: '2px solid #e9ecef', margin: '1.5rem 0' }} />

          {/* Pro-Gated Advanced Options */}
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
              <span>高级选项</span>
              <span className="d-inline-flex align-items-center gap-2" style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.92rem' }}>
                {showAdvancedOptions ? '收起' : '展开'}
                <i className={`bi ${showAdvancedOptions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </span>
            </button>
          </div>

          {showAdvancedOptions && (
            <div style={{ position: 'relative' }}>
              {!canUseAdvancedConfig && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(248, 249, 250, 0.90)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                  <a href="/pro-upgrade" onClick={e => { e.preventDefault(); navigate('/pro-upgrade'); }} style={{ color: '#7c3aed', fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="bi bi-lock-fill" style={{ fontSize: '0.85rem' }}></i>
                    升级 Pro 解锁高级选项
                  </a>
                </div>
              )}
              {/* Pro-Gated Sampling Config */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '0.75rem' }}>
                  采样参数
                </label>
                <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: '0.9rem' }}>
                      温度: {charData.temperature ?? DEFAULT_CHAT_CONFIG.temperature}
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
                      Top P: {charData.top_p ?? DEFAULT_CHAT_CONFIG.top_p}
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
                        最大输出 Token: {charData.max_tokens ?? selectedTokenLimits.defaultValue}
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
                        存在惩罚: {charData.presence_penalty ?? DEFAULT_CHAT_CONFIG.presence_penalty}
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
                        频率惩罚: {charData.frequency_penalty ?? DEFAULT_CHAT_CONFIG.frequency_penalty}
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
                </div>
              </div>
            </div>
          )}

          {/* Background Configuration */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '0.75rem' }}>
              聊天背景
            </label>
            <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
              {/* Background type cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
                {(() => {
                  const currentType = (() => {
                    try { return JSON.parse(charData.background).type; } catch (_) { return 'none'; }
                  })();
                  const cards = [
                    { type: 'preset', icon: 'bi-images', title: '预设背景' },
                    { type: 'character_picture', icon: 'bi-person-bounding-box', title: '与角色图片相同' },
                    { type: 'upload', icon: 'bi-cloud-upload', title: '上传自定义' },
                  ];
                  return cards.map(card => {
                    const isActive = currentType === card.type;
                    return (
                      <button
                        key={card.type}
                        type="button"
                        onClick={() => {
                          if (card.type === 'preset') {
                            handleChange('background', JSON.stringify({ type: 'preset', preset_id: 'none' }));
                          } else if (card.type === 'upload') {
                            handleChange('background', JSON.stringify({ type: 'upload' }));
                          } else {
                            handleChange('background', JSON.stringify({ type: card.type }));
                          }
                          setBackgroundPicture(null);
                          setBackgroundPreview(null);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          padding: '0.85rem 0.6rem',
                          borderRadius: 12,
                          border: isActive ? '2px solid #7c3aed' : '1px solid #d1d5db',
                          background: isActive ? '#f5f3ff' : '#fff',
                          cursor: 'pointer',
                          transition: 'border 0.15s, background 0.15s',
                          textAlign: 'center',
                        }}
                      >
                        <i
                          className={`bi ${card.icon}`}
                          style={{
                            fontSize: '1.5rem',
                            color: isActive ? '#7c3aed' : '#6b7280',
                            transition: 'color 0.15s',
                          }}
                        ></i>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isActive ? '#7c3aed' : '#232323' }}>
                          {card.title}
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Preset selection (shown when type is preset) */}
              {(() => {
                try { return JSON.parse(charData.background).type === 'preset'; } catch (_) { return false; }
              })() && (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    选择预设背景
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                    {/* Default (no wallpaper) as first option */}
                    {(() => {
                      const selected = (() => {
                        try { return JSON.parse(charData.background).preset_id === 'none'; } catch (_) { return true; }
                      })();
                      return (
                        <button
                          key="none"
                          type="button"
                          onClick={() => handleChange('background', JSON.stringify({ type: 'preset', preset_id: 'none' }))}
                          style={{
                            border: selected ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            borderRadius: 10,
                            background: '#fff',
                            padding: 6,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'border 0.15s',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 60,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg,#f8fafc,#e5e7eb)',
                              border: '1px solid rgba(0,0,0,0.06)',
                              marginBottom: 6,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#9ca3af',
                              fontSize: '0.7rem',
                            }}
                          >
                            默认
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>
                            默认
                          </div>
                        </button>
                      );
                    })()}
                    {WALLPAPER_OPTIONS.filter(w => w.id !== 'none').map(wallpaper => {
                      const selected = (() => {
                        try { return JSON.parse(charData.background).preset_id === wallpaper.id; } catch (_) { return false; }
                      })();
                      return (
                        <button
                          key={wallpaper.id}
                          type="button"
                          onClick={() => handleChange('background', JSON.stringify({ type: 'preset', preset_id: wallpaper.id }))}
                          style={{
                            border: selected ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                            borderRadius: 10,
                            background: '#fff',
                            padding: 6,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'border 0.15s',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 60,
                              borderRadius: 8,
                              background: wallpaper.url ? `url(${wallpaper.url}) center/cover no-repeat` : 'linear-gradient(135deg,#f8fafc,#e5e7eb)',
                              border: '1px solid rgba(0,0,0,0.06)',
                              marginBottom: 6,
                            }}
                          />
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>
                            {wallpaper.id === 'aurora' ? '极光' : wallpaper.id === 'sunrise' ? '日出' : '波浪'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload background (shown when type is upload) */}
              {(() => {
                try { return JSON.parse(charData.background).type === 'upload'; } catch (_) { return false; }
              })() && (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                    上传背景图片
                  </div>
                  {backgroundPreview ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={backgroundPreview}
                        alt="背景预览"
                        style={{ maxWidth: 280, maxHeight: 140, borderRadius: 10, border: '1px solid #e5e7eb' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBackgroundPicture(null);
                          setBackgroundPreview(null);
                        }}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          lineHeight: 1,
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '1.5rem 1rem',
                        borderRadius: 12,
                        border: '2px dashed #d1d5db',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'border 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
                    >
                      <i className="bi bi-cloud-arrow-up" style={{ fontSize: '1.6rem', color: '#9ca3af' }}></i>
                      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>点击选择图片</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBackgroundPicture(file);
                            setBackgroundPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Visibility & Options */}
          <div className="mb-4">
            <label className="form-label fw-bold" style={{ color: '#232323', marginBottom: '1rem' }}>
              可见性与访问权限
            </label>
            
            {/* Public/Private Toggle */}
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef', opacity: !canPrivate && !charData.is_public ? 0.55 : 1 }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className={`bi ${charData.is_public ? 'bi-globe2' : 'bi-lock-fill'}`} style={{ fontSize: '1.2rem', color: charData.is_public ? '#10b981' : '#6b7280' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {charData.is_public ? '公开' : '私密'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {charData.is_public 
                        ? '所有人可见'
                        : '仅自己可见'}
                    </div>
                    {!canPrivate && !charData.is_public && (
                      <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                        该功能将在达到等级 2 后开放
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
            <div className="mb-3 p-3" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-diagram-3-fill" style={{ fontSize: '1.2rem', color: '#22c55e' }}></i>
                  <div>
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      开源
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      允许其他用户在此基础上创作
                    </div>
                    {mode === 'fork' && (
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' }}>
                        衍生作品必须保持开源
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
                    disabled={mode === 'fork'}
                    onChange={e => handleChange('is_forkable', e.target.checked)}
                    style={{ width: '3rem', height: '1.5rem', cursor: mode !== 'fork' ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>
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

          {/* Appeal reason — shown only in appeal mode */}
          {isAppealMode && (
            <div className="mb-4">
              {hasPendingAppeal ? (
                <div className="alert alert-info" role="alert" style={{ borderRadius: 10 }}>
                  <i className="bi bi-hourglass-split me-2"></i>
                  <strong>申诉审核中</strong>
                  <div className="mt-1" style={{ fontSize: '0.88rem' }}>
                    您已有一份申诉正在审核中。您仍可保存内容修改，但无法再次提交申诉，直到当前申诉处理完毕。
                  </div>
                </div>
              ) : (
                <>
                  <label className="form-label fw-bold" style={{ color: '#232323' }}>
                    申诉理由
                    <small style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9ca3af', fontWeight: 400 }}>
                      (选填) 请说明您已如何修改内容，以及为何认为应解除限制
                    </small>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={appealReason}
                    maxLength={1000}
                    placeholder="请描述您对内容的修改，以及申诉理由…"
                    onChange={e => setAppealReason(e.target.value)}

                    style={{
                      background: '#fffbeb',
                      border: '1.5px solid #f59e0b',
                      borderRadius: 16,
                      fontSize: '1rem',
                      padding: '0.7rem 1.2rem',
                      resize: 'vertical',
                    }}
                  />
                  <small className="text-muted">{appealReason.length}/1000</small>
                </>
              )}
            </div>
          )}

          <div className="d-flex gap-3 mt-4 justify-content-end">
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  处理中...
                </>
              ) : (
                <>
                  <i className={`bi ${isAppealMode && !hasPendingAppeal ? 'bi-megaphone' : 'bi-save'} me-2`}></i>
                  {isAppealMode && !hasPendingAppeal ? '保存并提交申诉' : mode === 'edit' ? '保存' : '创建'}
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
                <i className="bi bi-trash me-2"></i>删除
              </PrimaryButton>
            )}
          </div>
        </form>
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
              处理中...
            </div>
            <div style={{ marginTop: '0.45rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>
              角色正在处理中，请稍候。
            </div>
          </div>
        </div>,
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
    </PageWrapper>
  );
}
