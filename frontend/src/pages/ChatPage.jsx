import React, { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildSystemMessage } from '../utils/systemTemplate';
import '../styles/ChatBubble.css';
import { AuthContext } from '../components/AuthProvider';
import CharacterModal from '../components/CharacterModal';
import CharacterSidebar from '../components/CharacterSidebar';
import PersonaModal from '../components/PersonaModal';
import SceneCharacterSelectModal from '../components/SceneCharacterSelectModal';
import ConfirmModal from '../components/ConfirmModal';
import PageWrapper from '../components/PageWrapper';
import MessageBubble from '../components/MessageBubble';
import ContextWindowIndicator from '../components/ContextWindowIndicator';
import { CreditLockedBanner, BanBanner } from '../components/ChatBanners';
import ChatWelcomeCard from '../components/ChatWelcomeCard';
import MessageContextMenu from '../components/MessageContextMenu';
import { useToast } from '../components/ToastProvider';
import {
  DEFAULT_CONTEXT_WINDOW_TIER,
  getContextWindowTokenLimit,
  normalizeContextWindowTier,
} from '../utils/contextWindow';
import { getModelConfig, AVAILABLE_MODEL_IDS, ALLOWED_MODEL_SET } from '../utils/modelConfigs';
import { isCreditLocked } from '../utils/creditCheck';
import {
  normalizeChatEntry,
  computeForkNav,
  getMessagePreview,
  ensureMessageIds,
  generateMessageId,
  updateChatEntryBranchMessages,
  MAX_PINNED_MEMORIES,
} from '../utils/chatHelpers';
import { useCreditAndChatLimits } from '../hooks/useCreditAndChatLimits';
import { usePinnedMemories } from '../hooks/usePinnedMemories';
import { cancelVoiceRecording, startVoiceRecording, stopVoiceRecording } from '../utils/voiceRecorder';

const WALLPAPER_OPTIONS = [
  { id: 'none', labelKey: 'chat.wallpaper_default', url: null },
  { id: 'aurora', labelKey: 'chat.wallpaper_aurora', url: '/wallpapers/aurora.svg' },
  { id: 'sunrise', labelKey: 'chat.wallpaper_sunrise', url: '/wallpapers/sunrise.svg' },
  { id: 'waves', labelKey: 'chat.wallpaper_waves', url: '/wallpapers/waves.svg' },
];

const SHARED_TOKEN_LIMITS = { min: 1, max: 8192, defaultValue: 4096 };
const SHARED_TOKEN_TIERS = [1024, 2048, 4096, 6144, 8192];
const getTokenLimits = () => SHARED_TOKEN_LIMITS;
const getTokenTiers = (modelId) => {
  const cfg = getModelConfig(modelId);
  if (!cfg) return SHARED_TOKEN_TIERS;
  return SHARED_TOKEN_TIERS.filter((t) => t <= cfg.maxOutputTokens);
};
const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeTokenTierValue = (modelName, rawValue) => {
  const tokenLimits = getTokenLimits(modelName);
  const tiers = getTokenTiers(modelName);
  const clamped = clamp(rawValue, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue);
  return tiers.reduce((nearest, tier) => (
    Math.abs(tier - clamped) < Math.abs(nearest - clamped) ? tier : nearest
  ), tiers[0]);
};

export default function ChatPage() {
  const { t } = useTranslation();
  // Sentinel used to indicate a character should have an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
  const SUMMARY_PREFIX = 'Summary of previous conversation:';
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const canUseAdvancedChatConfig = !!userData?.is_pro;
  const isProUser = !!userData?.is_pro;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const voiceSocketRef = useRef(null);
  const voicePrefixRef = useRef('');
  const voiceTranscriptRef = useRef('');
  const voicePartialRef = useRef('');
  const [wallpaper, setWallpaper] = useState({ id: 'none', url: null });
  const [characterBackground, setCharacterBackground] = useState(null);
  const [sending, setSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [chatLimits, setChatLimits] = useState(null);
  const [creditLimits, setCreditLimits] = useState(null);
  const [serverContextWindowUsage, setServerContextWindowUsage] = useState(null);
  const [hasLiked, setHasLiked] = useState({ character: false, scene: false, persona: false });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [branchSelectionPending, setBranchSelectionPending] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [messageMenu, setMessageMenu] = useState({ open: false, messageId: null, x: 0, y: 0 });
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  // Ref for textarea auto-resize
  const textareaRef = useRef(null);
  // Ref for messages container to enable auto-scrolling
  const messagesEndRef = useRef(null);
  const messageMenuRef = useRef(null);
  // Monotonic counter used to invalidate superseded chat turns so a stale
  // stream can never clobber state from a newer request.
  const chatGenerationIdRef = useRef(0);
  // Reserved chat_id for a brand-new chat whose opening greeting is still
  // streaming. Lets a message sent mid-greeting reuse the same chat instead
  // of minting a second (orphaned) chat_id on the backend.
  const pendingChatIdRef = useRef(null);

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const CHAT_INPUT_MAX_HEIGHT = 200;
  const CHAT_INPUT_BASE_HEIGHT = 44;
  const DEFAULT_ADVANCED_CHAT_CONFIG = {
    model: 'qwen-plus-character',
    presence_penalty: 0,
    frequency_penalty: 0,
    context_window_tier: DEFAULT_CONTEXT_WINDOW_TIER,
  };
  const normalizeChatModel = (modelName) => (ALLOWED_MODEL_SET.has(modelName) ? modelName : DEFAULT_ADVANCED_CHAT_CONFIG.model);
  
  const applyCharacterBackground = (bgConfig, character) => {
    setCharacterBackground(bgConfig || null);
    // Always reset wallpaper first so a previous chat's background doesn't leak
    // into a new chat that has no background configured.
    setWallpaper({ id: 'none', url: null });
    if (!bgConfig || bgConfig.type === 'none') return;
    if (bgConfig.type === 'preset') {
      if (bgConfig.preset_id && bgConfig.preset_id !== 'none') {
        setWallpaper({ id: bgConfig.preset_id, url: null });
      }
      return;
    }
    if (bgConfig.type === 'upload' && bgConfig.url) {
      setWallpaper({ id: 'character_upload', url: `${window.API_BASE_URL.replace(/\/$/, '')}/${String(bgConfig.url).replace(/\\/g, '/').replace(/^\//, '')}` });
    } else if (bgConfig.type === 'character_picture') {
      const charPic = character?.picture;
      if (charPic) {
        setWallpaper({ id: 'character_picture', url: `${window.API_BASE_URL.replace(/\/$/, '')}/${String(charPic).replace(/\\/g, '/').replace(/^\//, '')}` });
      }
    }
  };

  const normalizeAdvancedChatConfig = (character) => {
    if (!character) return DEFAULT_ADVANCED_CHAT_CONFIG;
    const model = normalizeChatModel(character.model);
    const tokenLimits = getTokenLimits(model);
    const normalizedContextWindowTier = normalizeContextWindowTier(character.context_window_tier, model);
    return {
      model,
      context_window_tier: normalizedContextWindowTier,
      temperature: canUseAdvancedChatConfig ? clamp(character.temperature, 0, 2, DEFAULT_ADVANCED_CHAT_CONFIG.temperature) : DEFAULT_ADVANCED_CHAT_CONFIG.temperature,
      top_p: canUseAdvancedChatConfig ? clamp(character.top_p, 0, 1, DEFAULT_ADVANCED_CHAT_CONFIG.top_p) : DEFAULT_ADVANCED_CHAT_CONFIG.top_p,
      max_tokens: canUseAdvancedChatConfig ? normalizeTokenTierValue(model, clamp(character.max_tokens, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue)) : tokenLimits.defaultValue,
      presence_penalty: canUseAdvancedChatConfig ? clamp(character.presence_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty) : DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty,
      frequency_penalty: canUseAdvancedChatConfig ? clamp(character.frequency_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty) : DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty,
    };
  };
  const [advancedChatConfig, setAdvancedChatConfig] = useState(DEFAULT_ADVANCED_CHAT_CONFIG);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);
  // Heads-up shown to free users before starting a chat with an advanced
  // character (long description ⇒ higher token/point consumption).
  const [advancedChatConfirm, setAdvancedChatConfirm] = useState(false);
  const pendingAdvancedChatStartRef = useRef(null);

  // Loading state for initial data fetch
  const [initLoading, setInitLoading] = useState(false);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showChatSettingsHint, setShowChatSettingsHint] = useState(false);
  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowChatSettingsHint(false);
      return;
    }

    setShowChatSettingsHint(true);
    const hideTimer = setTimeout(() => setShowChatSettingsHint(false), 3000);
    return () => clearTimeout(hideTimer);
  }, [isMobile]);

  // Cleanup: abort any ongoing streaming request on unmount
  useEffect(() => {
    return () => {
      cancelVoiceRecording();
      voiceSocketRef.current?.close();
      voiceSocketRef.current = null;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!messageMenu.open) return;
      if (messageMenuRef.current && messageMenuRef.current.contains(event.target)) {
        return;
      }
      setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [messageMenu.open]);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const selectedWallpaper = (() => {
    if (wallpaper.id === 'none' || !wallpaper.url) {
      const preset = WALLPAPER_OPTIONS.find((o) => o.id === wallpaper.id);
      return preset || WALLPAPER_OPTIONS[0];
    }
    return { id: wallpaper.id, url: wallpaper.url };
  })();

  useEffect(() => {
    if (!userData) return;

    applyCreditLimits({
      plan: userData.is_pro ? 'pro' : 'free',
      cap_scope: userData.credit_cap_scope,
      credit_cap: userData.credit_cap,
      remaining_credits: userData.remaining_credits,
      cap_reached: !!userData.credit_cap_reached,
      daily_credit_usage: Number(userData.daily_credit_usage || 0),
      monthly_credit_usage: Number(userData.monthly_credit_usage || 0),
      free_daily_credit_cap: Number(userData.free_daily_credit_cap || 0),
      pro_monthly_credit_cap: Number(userData.pro_monthly_credit_cap || 0),
      reset_at: userData.credit_reset_at,
      is_limited: userData.credit_cap !== null,
      purchased_credit_balance: userData.purchased_credit_balance ?? 0,
    });
  }, [
    userData?.purchased_credit_balance,
    userData?.daily_credit_usage,
    userData?.monthly_credit_usage,
    userData?.credit_reset_at,
  ]);

  // Scroll to bottom when messages change.
  // Use smooth only for the initial jump when a new message is sent;
  // while streaming, use instant to avoid constant scroll-animation
  // restarts that cause visible stutter on every token.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isStreaming ? 'instant' : 'smooth',
    });
  }, [messages, isStreaming]);

  // Scroll to bottom when the keyboard appears/disappears on mobile.
  // Keyboard detection/repositioning is centralized in Layout.jsx, which
  // dispatches a single 'layout-keyboard-adjusted' event after its DOM write.
  // We only respond here by re-anchoring the latest message.
  useEffect(() => {
    const scrollToBottom = () => {
      // Use requestAnimationFrame to run after Layout's height/position write
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
      });
    };

    window.addEventListener('layout-keyboard-adjusted', scrollToBottom);
    return () => window.removeEventListener('layout-keyboard-adjusted', scrollToBottom);
  }, []);

  const navigate = useNavigate();
  const initialized = useRef(false);
  const isNewChat = useRef(true);
  const prevSearchParamsRef = useRef(searchParams);

  const {
    applyChatLimits: applyChatLimitsToast,
    applyCreditLimits: applyCreditLimitsToast,
  } = useCreditAndChatLimits();

  const applyChatLimits = (limits) => {
    if (!limits) return;
    setChatLimits(limits);
    applyChatLimitsToast(limits);
  };

  const applyCreditLimits = (limits) => {
    if (!limits) return;
    setCreditLimits(limits);
    applyCreditLimitsToast(limits);
  };

  const getChatErrorMessage = (errorPayload) => {
    if (errorPayload?.error === 'ACCOUNT_BANNED') {
      const until = errorPayload?.ban_until
        ? `，封禁将于 ${new Date(errorPayload.ban_until).toLocaleDateString()} 解除`
        : '，该封禁为永久封禁';
      return `您的账号已被封禁${until}，无法发送消息。`;
    }
    if (errorPayload?.error === 'CREDIT_CAP_REACHED') {
      return errorPayload?.message || '已达到点数额度上限，当前点数相关操作已受限。';
    }
    if (errorPayload?.error === 'DAILY_MESSAGE_CAP_REACHED') {
      const remaining = Number(errorPayload?.limits?.remaining_messages ?? 0);
      if (remaining <= 0) {
        return '已达到今日消息上限，请明天再试，或升级 Pro 解锁无限消息。';
      }
      return errorPayload?.message || '已达到今日消息上限。';
    }
    if (typeof errorPayload?.error === 'string') {
      return errorPayload.error;
    }
    return 'Failed to send message. Please try again.';
  };

  const buildSystemPromptMessage = (character = selectedCharacter, scene = selectedScene, persona = selectedPersona) => ({
    role: 'system',
    content: buildSystemMessage(
      character?.name || '',
      character?.persona || '',
      character?.example_messages || '',
      persona?.description || null,
      persona?.name || null,
      scene?.description || null,
      character?.long_description || null
    )
  });

  const buildDisplayMessagesForChat = (chatEntry, character = selectedCharacter, scene = selectedScene, persona = selectedPersona) => {
    const normalizedChat = normalizeChatEntry(chatEntry);
    if (!normalizedChat) return [];
    const sys = buildSystemPromptMessage(character, scene, persona);
    const branchMessages = Array.isArray(normalizedChat.messages) ? normalizedChat.messages : [];
    const summarySystemMessages = branchMessages.filter(
      (m) => m?.role === 'system' && typeof m?.content === 'string' && m.content.trim().startsWith(SUMMARY_PREFIX)
    );
    const nonSystemMessages = branchMessages.filter((m) => m?.role !== 'system');
    return ensureMessageIds([sys, ...summarySystemMessages, ...nonSystemMessages]);
  };

  const upsertChatHistoryEntryLocally = (rawChatEntry, { selectChat = true } = {}) => {
    const nextChatEntry = normalizeChatEntry(rawChatEntry);
    if (!nextChatEntry) return null;

    if (selectChat) {
      setSelectedChat(nextChatEntry);
    }

    setUserData((prev) => {
      if (!prev) return prev;
      const previousHistory = Array.isArray(prev.chat_history) ? prev.chat_history : [];
      const filtered = previousHistory.filter((entry) => entry?.chat_id !== nextChatEntry.chat_id);
      return {
        ...prev,
        chat_history: [nextChatEntry, ...filtered].slice(0, 30),
      };
    });

    return nextChatEntry;
  };

  const compactMessagesForRequest = (allMessages) => {
    if (!Array.isArray(allMessages)) return [];

    return allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );
  };

  const saveUserCharacterConfig = async () => {
    if (!characterId || !sessionToken) return;
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/user-character-config/${characterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify(advancedChatConfig),
      });
      if (!res.ok) throw new Error('Failed to save config');
      toast.show('配置已保存', { type: 'success' });
    } catch (err) {
      console.error('Error saving user config:', err);
      toast.show('配置保存失败，请重试。', { type: 'error' });
    }
  };

  const getContextWindowUsage = (allMessages) => {
    const effectiveSoftTokenLimit = getContextWindowTokenLimit(advancedChatConfig?.context_window_tier);

    if (!Array.isArray(allMessages)) {
      return {
        currentTokens: 0,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    if (serverContextWindowUsage) {
      const serverInputTokens = Number(serverContextWindowUsage.input_tokens || 0);

      return {
        currentTokens: serverInputTokens,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    const validMessages = allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );

    for (let i = validMessages.length - 1; i >= 0; i -= 1) {
      const message = validMessages[i];
      if (message.role !== 'assistant' || !message.usage || typeof message.usage !== 'object') {
        continue;
      }

      const usageInputTokens = Number(message.usage.prompt_tokens || 0);
      return {
        currentTokens: usageInputTokens,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    return {
      currentTokens: 0,
      softLimit: effectiveSoftTokenLimit,
    };
  };

  const {
    handleTogglePin,
    syncPinnedStateInUserHistory,
  } = usePinnedMemories({
    selectedChat,
    setSelectedChat,
    messages,
    setMessages,
    setUserData,
    sessionToken,
  });

  const openMessageMenu = (event, messageId) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMessageMenu({
      open: true,
      messageId,
      x: rect.left,
      y: rect.bottom,
    });
  };

  const jumpToMessage = (messageId) => {
    if (!messageId) return;
    const target = document.getElementById(`message-${messageId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'box-shadow 0.2s ease';
    target.style.boxShadow = '0 0 0 2px rgba(24,25,26,0.25)';
    window.setTimeout(() => {
      target.style.boxShadow = 'none';
    }, 1100);
  };

  const handleCharacterEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const characterMatches = String(h.character_id) === String(characterId);
        return characterMatches;
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initialized.current = true;
        return;
      }

      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error handling character entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  const handleSceneEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const sceneMatches = String(h.scene_id) === String(sceneId);
        return sceneMatches;
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initialized.current = true;
        return;
      }

      setInitModal(true);
    } catch (err) {
      console.error('Error handling scene entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Reset chat state on navigation, then trigger initialization once auth is ready.
  // Keeping these in one effect guarantees the reset and the initialization guard
  // are always evaluated in the same React batch — eliminating the race where the
  // reset effect would clear initialized.current while the async handler was
  // mid-flight (most visible as a double-fire in React StrictMode).
  useEffect(() => {
    const searchParamsChanged = searchParams !== prevSearchParamsRef.current;
    prevSearchParamsRef.current = searchParams;

    console.trace('[searchParams effect] fired', { 
      prev: prevSearchParamsRef.current?.toString(), 
      next: searchParams?.toString() 
    });

    if (searchParamsChanged) {
      setCharacterId(searchParams.get('character'));
      setSceneId(searchParams.get('scene'));
      if (!searchParams.get('character')) setSelectedCharacter(null);
      if (!searchParams.get('scene')) setSelectedScene(null);
      setSelectedPersona(null);
      setSelectedChat(null);
      pendingChatIdRef.current = null;
      setMessages([]);
      setEditingMessageId(null);
      setEditingMessageText('');
      setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
      setServerContextWindowUsage(null);
      isNewChat.current = true;
      setInitModal(false);
      // Dismiss the advanced-character confirm if the route changes while it
      // is open, so a stale confirm can never start the old character's chat
      // in a new context.
      setAdvancedChatConfirm(false);
      pendingAdvancedChatStartRef.current = null;
      initialized.current = false;
    }

    if (loading) return;
    if (!sessionToken) { navigate('/'); return; }
    if (initialized.current) return;

    // Claim the slot synchronously so concurrent calls (e.g. StrictMode
    // double-fire, rapid auth state changes) see it as taken immediately.
    initialized.current = true;

    const entryMode = searchParams.get('scene')
      ? 'scene'
      : (searchParams.get('character') ? 'character' : null);

    switch (entryMode) {
      case 'scene':
        handleSceneEntry();
        return;
      case 'character':
        handleCharacterEntry();
        return;
      default:
        return;
    }
  }, [navigate, sessionToken, loading, searchParams]);

  // Reusable function to start chat with current selections (used by modal and direct entry)
  const startChatWithSelectedEntities = async () => {
    isNewChat.current = true;
    setInitModal(false);
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      initializeChat(fetchedData);
    } catch (err) {
      console.error('Error initializing chat:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Start chat after choosing a character for a scene entry
  const startChatFromSceneSelection = async () => {
    if (!selectedCharacter) return;
    setCharacterId(selectedCharacter.id || null);
    isNewChat.current = true;
    setInitModal(false);
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error initializing chat from scene selection:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Fetch character and scene data if IDs are present
  const fetchInitialData = () => {
    setInitLoading(true);
    return new Promise((resolve, reject) => {
      const promises = [];
      let character = null;
      let scene = null;
      
      if (characterId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${characterId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => {
              if (!res.ok) throw new Error('Character not found');
              return res.json();
            })
            .then(data => {
              character = data;
              setSelectedCharacter(data);
              setAdvancedChatConfig(normalizeAdvancedChatConfig(data));
              applyCharacterBackground(data.background, data);
              setLikes(data.likes || 0);
              // Fetch user's per-character config delta and merge on top of defaults
              return fetch(`${window.API_BASE_URL}/api/user-character-config/${characterId}`, {
                headers: { 'Authorization': sessionToken }
              }).then(res => res.ok ? res.json() : null).then(configData => {
                const delta = configData?.config || {};
                if (Object.keys(delta).length > 0) {
                  setAdvancedChatConfig(prev => {
                    const merged = { ...prev };
                    for (const [key, value] of Object.entries(delta)) {
                      if (value !== undefined && value !== null) merged[key] = value;
                    }
                    return merged;
                  });
                }
                return data;
              }).catch(() => data);
            })
            .catch(err => {
              console.error('Error fetching character:', err);
              toast.show('加载角色失败，角色可能已被删除。', { type: 'error' });
              setSelectedCharacter(null);
              return null;
            })
        );
      } else {
        if (selectedCharacter?.id) {
          character = selectedCharacter;
          setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter));
          applyCharacterBackground(selectedCharacter?.background, selectedCharacter);
        } else {
          setSelectedCharacter(null);
          setAdvancedChatConfig(DEFAULT_ADVANCED_CHAT_CONFIG);
          applyCharacterBackground(null, null);
        }
      }
      
      if (sceneId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${sceneId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              scene = data;
              setSelectedScene(data);
              return data;
            })
            .catch(err => {
              console.error('Error fetching scene:', err);
              setSelectedScene(null);
              return null;
            })
        );
      } else {
        setSelectedScene(null);
      }
      
      // Load default persona if user has one and no persona is already selected
      let persona = null;
      if (userData?.default_persona && !selectedPersona) {
        persona = userData.default_persona;
        setSelectedPersona(persona);
      } else if (selectedPersona) {
        persona = selectedPersona;
      } else {
        setSelectedPersona(null);
      }

      // Fetch liked status for available entities
      if (characterId || sceneId) {
        const params = [];
        if (characterId) params.push(`character_id=${characterId}`);
        if (sceneId) params.push(`scene_id=${sceneId}`);
        if (persona?.id) params.push(`persona_id=${persona.id}`);
        promises.push(
          fetch(`${window.API_BASE_URL}/api/is-liked-multi?${params.join('&')}`, {
            credentials: 'include',
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.json())
            .then(data => {
              setHasLiked({
                character: data.character ? !!data.character.liked : false,
                scene: data.scene ? !!data.scene.liked : false,
                persona: data.persona ? !!data.persona.liked : false
              });
              return data;
            })
            .catch(() => {
              setHasLiked({ character: false, scene: false, persona: false });
              return null;
            })
        );
      } else {
        setHasLiked({ character: false, scene: false, persona: false });
      }
      
      Promise.all(promises).then(() => {
        setInitLoading(false);
        // Return the persona that was loaded (default or null)
        resolve({ character, scene, persona });
      }).catch(err => {
        setInitLoading(false);
        reject(err);
      });
    });
  };





  const initializeChat = (fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    // Set likes and creator from selectedCharacter
    if (characterId) {
      // Increment views for character, scene, and persona in one call
      const body = {
        ...(character && { character_id: character.id }),
        ...(scene && { scene_id: scene.id }),
        ...(persona && { persona_id: persona.id })
      };
      fetch(`${window.API_BASE_URL}/api/views/increment-multi`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify(body)
      });
    }
    initialized.current = true;
    if(isNewChat.current) {
      startNewChat(fetchedData);
    }
  };

  const startNewChat = async (fetchedData) => {
    const { character } = fetchedData || {};

    // Free users starting a chat with an advanced character (long description
    // ⇒ higher token/point consumption) get a heads-up before the chat begins.
    // This fires after character data has loaded but before the first greeting
    // message is generated/sent.
    if (!isProUser && character?.context_label === 'advanced') {
      pendingAdvancedChatStartRef.current = fetchedData;
      setAdvancedChatConfirm(true);
      return;
    }

    await proceedStartNewChat(fetchedData);
  };

  const proceedStartNewChat = async (fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    const sys = buildSystemPromptMessage(character, scene, persona);

    // For scenes, keep existing logic (scene.greeting is still a string)
    // For characters, greetings is now a list; pick one randomly
    let openingGreeting = null;
    let useImprovise = false;

    if (scene) {
      const sceneGreeting = typeof scene?.greeting === 'string' && scene.greeting.trim()
        ? scene.greeting.trim()
        : SPECIAL_IMPROVISING_GREETING;
      if (sceneGreeting === SPECIAL_IMPROVISING_GREETING) {
        useImprovise = true;
      } else {
        openingGreeting = sceneGreeting;
      }
    } else if (character?.greetings?.length) {
      const manualGreetings = character.greetings.filter(g => g !== SPECIAL_IMPROVISING_GREETING);
      const hasImprovise = character.greetings.includes(SPECIAL_IMPROVISING_GREETING);

      // Build pool: manual greetings + optional improvise slot
      const pool = [...manualGreetings];
      if (hasImprovise) pool.push(SPECIAL_IMPROVISING_GREETING);

      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick === SPECIAL_IMPROVISING_GREETING) {
          useImprovise = true;
        } else {
          openingGreeting = pick;
        }
      }
    }

    setSelectedChat(null);
    pendingChatIdRef.current = null;
    setInput('');

    if (useImprovise) {
      // Reserve the chat_id up front (mirroring the backend's uuid.uuid4())
      // so a message sent while this greeting is still streaming reuses the
      // same chat instead of minting a second, orphaned chat_id.
      pendingChatIdRef.current = generateMessageId();
      setMessages([sys]);
      await sendChatTurn({
        nextMessages: [sys],
        chatId: pendingChatIdRef.current,
        sourceBranchId: null,
        restoreMessagesOnError: [sys],
        errorMessage: '生成问候失败，请重试。',
        characterOverride: character,
        sceneOverride: scene,
        personaOverride: persona,
      });
      return;
    }

    let greet = null;
    if (openingGreeting) {
      greet = {
        role: 'assistant',
        content: openingGreeting,
        message_id: generateMessageId(),
        is_pinned: false,
      };
    }
    setMessages(ensureMessageIds(greet ? [sys, greet] : [sys]));
  };

  const handleAdvancedChatConfirm = () => {
    setAdvancedChatConfirm(false);
    const pending = pendingAdvancedChatStartRef.current;
    pendingAdvancedChatStartRef.current = null;
    if (pending) {
      proceedStartNewChat(pending);
    }
  };

  const handleAdvancedChatExit = () => {
    setAdvancedChatConfirm(false);
    pendingAdvancedChatStartRef.current = null;
    // Exiting means not starting this chat at all — go back to where the
    // user came from. Falls back to the chat page's default state if there
    // is no history entry.
    navigate(-1);
  };

  const sendChatTurn = async ({
    nextMessages,
    chatId = selectedChat?.chat_id || pendingChatIdRef.current,
    forkFromMessageId = null,
    sourceBranchId = selectedChat?.active_branch_id || null,
    restoreMessagesOnError = nextMessages,
    errorMessage = 'Failed to send message. Please try again.',
    characterOverride = selectedCharacter,
    sceneOverride = selectedScene,
    personaOverride = selectedPersona,
  }) => {
    if (!characterOverride) return;

    // Cancel any in-flight turn for this chat before starting a new one.
    if (abortController) {
      abortController.abort();
    }

    // Claim a new generation token so any response from the cancelled request
    // (chunk, done, error, or finally) is treated as stale and ignored.
    const requestGenerationId = ++chatGenerationIdRef.current;

    setSending(true);
    setIsStreaming(true);

    const requestMessages = compactMessagesForRequest(nextMessages);
    const baseMessageCount = Array.isArray(nextMessages) ? nextMessages.length : 0;
    const controller = new AbortController();
    const assistantMessageId = generateMessageId();
    setAbortController(controller);
    setMessages(ensureMessageIds([...nextMessages, { role: 'assistant', content: '', message_id: assistantMessageId, is_pinned: false }]));

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          character_id: characterOverride?.id || characterId,
          chat_id: chatId,
          branch_id: sourceBranchId,
          fork_from_message_id: forkFromMessageId,
          base_message_count: baseMessageCount,
          scene_id: sceneOverride?.id || null,
          persona_id: personaOverride?.id || null,
          messages: requestMessages,
          context_messages: nextMessages,
          full_messages: nextMessages,
          chat_config: advancedChatConfig,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        if (errorPayload?.limits) {
          applyChatLimits(errorPayload.limits);
        }
        if (errorPayload?.credit_limits) {
          applyCreditLimits(errorPayload.credit_limits);
        }
        throw new Error(getChatErrorMessage(errorPayload));
      }

      if (!response.body) {
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = '';
      let pendingEventBuffer = '';

      const processEventPayload = (rawPayload) => {
        // Ignore any event from a superseded request. A new turn has been
        // started, so this response is stale and must not touch state.
        if (requestGenerationId !== chatGenerationIdRef.current) {
          return;
        }

        const payload = rawPayload
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice(6))
          .join('\n');

        if (!payload) {
          return;
        }

        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          // Malformed SSE payload — ignore silently rather than crashing the stream
          return;
        }

        if (data.error) {
          const friendlyMessage = getChatErrorMessage(data);
          toast.show(friendlyMessage, { type: 'error' });
          if (data.credit_limits) {
            applyCreditLimits(data.credit_limits);
          }
          if (data.limits) {
            applyChatLimits(data.limits);
          }
          return;
        }

        if (data.chunk) {
          console.log('[RAW chunk]', data.chunk);
          accumulatedReply += data.chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: accumulatedReply,
              message_id: assistantMessageId,
              is_pinned: false,
            };
            return ensureMessageIds(newMessages);
          });
        }

        if (data.done) {
          console.log('[RAW chat_entry]', JSON.stringify(data.chat_entry));
          applyChatLimits(data.limits);
          applyCreditLimits(data.credit_limits);
          if (refreshUserData) {
            refreshUserData({ silent: true });
          }
          if (data.context_window) {
            setServerContextWindowUsage(data.context_window);
          }
          if (data.chat_entry) {
            const nextChatEntry = upsertChatHistoryEntryLocally(data.chat_entry);
            setMessages(buildDisplayMessagesForChat(nextChatEntry, characterOverride, sceneOverride, personaOverride));
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        pendingEventBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const events = pendingEventBuffer.split('\n\n');
        pendingEventBuffer = events.pop() || '';

        for (const eventPayload of events) {
          processEventPayload(eventPayload);
        }

        if (done) {
          break;
        }
      }

      if (pendingEventBuffer.trim()) {
        processEventPayload(pendingEventBuffer);
      }
    } catch (err) {
      // A superseded request must not show errors or restore stale messages.
      if (requestGenerationId !== chatGenerationIdRef.current) {
        return;
      }
      if (err.name !== 'AbortError') {
        toast.show(err.message || errorMessage, { type: 'error' });
      }
      setMessages(ensureMessageIds(restoreMessagesOnError));
    } finally {
      // Only the latest request may clear sending/streaming state.
      if (requestGenerationId === chatGenerationIdRef.current) {
        setSending(false);
        setIsStreaming(false);
        setAbortController(null);
      }
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (isCreditLocked(creditLimits)) {
      toast.show('已达到点数上限，暂时无法继续对话。', { type: 'warning' });
      return;
    }
    if (sending || !input.trim() || !selectedCharacter) return;
    const updatedMessages = ensureMessageIds([...messages, { role: 'user', content: input.trim(), message_id: generateMessageId(), is_pinned: false }]);
    setMessages(updatedMessages);
    setInput('');
    
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = `${CHAT_INPUT_BASE_HEIGHT}px`;
      textareaRef.current.style.overflowY = 'hidden';
    }

    await sendChatTurn({
      nextMessages: updatedMessages,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: updatedMessages,
    });
  };

  // Handle textarea input and auto-resize
  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(
        CHAT_INPUT_BASE_HEIGHT,
        Math.min(textareaRef.current.scrollHeight, CHAT_INPUT_MAX_HEIGHT)
      );
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY =
        textareaRef.current.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  };

  // Auto-resize the textarea whenever the input changes, including
  // programmatic updates (e.g. voice-to-text transcription results).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.max(
      CHAT_INPUT_BASE_HEIGHT,
      Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT)
    );
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  // Voice-to-text: record audio and transcribe it into the input field.
  const handleVoiceToggle = async () => {
    if (isRecording) {
      const socket = voiceSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'stop' }));
      }
      await stopVoiceRecording();
      setIsRecording(false);
      setIsTranscribing(true);
      return;
    }
    try {
      const apiUrl = new URL(window.API_BASE_URL || window.location.origin);
      const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${apiUrl.host}/api/chat/voice-to-text/stream`);
      voiceSocketRef.current = socket;
      voicePrefixRef.current = input.trim() ? `${input.trim()}\n` : '';
      voiceTranscriptRef.current = '';
      voicePartialRef.current = '';

      await new Promise((resolve, reject) => {
        socket.onopen = () => {
          socket.send(JSON.stringify({ token: sessionToken }));
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'ready') {
            resolve();
          } else if (message.type === 'transcript') {
            if (message.is_final) {
              voiceTranscriptRef.current += message.text;
              voicePartialRef.current = '';
            } else {
              voicePartialRef.current = message.text;
            }
            setInput(`${voicePrefixRef.current}${voiceTranscriptRef.current}${voicePartialRef.current}`);
          } else if (message.type === 'complete') {
            setIsTranscribing(false);
          } else if (message.type === 'charged') {
            setIsTranscribing(false);
            socket.close();
          } else if (message.type === 'error') {
            reject(new Error(message.message || '语音识别失败，请重试。'));
          }
        };
        socket.onerror = () => reject(new Error('无法连接语音识别服务，请重试。'));
      });

      await startVoiceRecording((frame) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(frame);
      });
      setIsRecording(true);
    } catch (err) {
      voiceSocketRef.current?.close();
      voiceSocketRef.current = null;
      toast.show(err?.message || '无法启动麦克风录音，请检查权限。', { type: 'error' });
    }
  };

  // Unified new chat action respecting current entry mode
  const handleNewChat = async () => {
    setSelectedChat(null);
    pendingChatIdRef.current = null;
    setMessages([]);
    setEditingMessageId(null);
    setEditingMessageText('');
    isNewChat.current = true;

    if (sceneId || selectedScene) {
      setSelectedCharacter(null);
      setCharacterId(null);
      setInitModal(true);
      return;
    }

    if (selectedCharacter || characterId) {
      await startChatWithSelectedEntities();
      initialized.current = true;
      return;
    }

    setInitModal(true);
  };

  // Handle keyboard shortcuts.
  // Desktop: Enter sends, Shift+Enter inserts a new line.
  // Mobile: Enter inserts a new line (send via the send button), since
  // virtual keyboards have no accessible Shift key.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (isMobile) {
        // Let the textarea's native behavior insert a newline.
        return;
      }
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend(e);
      }
    }
  };

  // Generic like function for character, scene, or persona
  const likeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/like/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: true }));
    }
  };

  // Generic unlike function for character, scene, or persona
  const unlikeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/unlike/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: false }));
    }
  };

  const loadChat = async (chat) => {
    try {
      const normalizedChat = normalizeChatEntry(chat);
      if (!normalizedChat) return;

      // Update IDs from the chat entry
      setCharacterId(normalizedChat.character_id || null);
      setSceneId(normalizedChat.scene_id || null);
      
      // Fetch all required entities in parallel
      const promises = [];
      let character = selectedCharacter;
      let scene = null;
      let persona = null;
      
      // Only fetch if we don't have it or if it's different
      if (!character || character.id !== normalizedChat.character_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${normalizedChat.character_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              character = data;
              setSelectedCharacter(data);
            })
            .catch(err => console.error('Error loading character:', err))
        );
      }
      
      if (normalizedChat.scene_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${normalizedChat.scene_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => { scene = data; setSelectedScene(data); })
            .catch(err => console.error('Error loading scene:', err))
        );
      } else {
        setSelectedScene(null);
      }
      
      if (normalizedChat.persona_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/personas/${normalizedChat.persona_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => { persona = data; setSelectedPersona(data); })
            .catch(err => console.error('Error loading persona:', err))
        );
      } else {
        setSelectedPersona(null);
      }
      
      await Promise.all(promises);

      // Load character defaults + user delta in one atomic state update
      // (avoid the intermediate render with character defaults that
      //  would overwrite the correct config set by fetchInitialData)
      if (character?.id) {
        fetch(`${window.API_BASE_URL}/api/user-character-config/${character.id}`, {
          headers: { 'Authorization': sessionToken }
        }).then(res => res.ok ? res.json() : null).then(data => {
          const defaults = normalizeAdvancedChatConfig(character);
          const delta = data?.config || {};
          const merged = { ...defaults };
          for (const [key, value] of Object.entries(delta)) {
            if (value !== undefined && value !== null) merged[key] = value;
          }
          setAdvancedChatConfig(merged);
        }).catch(() => {
          setAdvancedChatConfig(normalizeAdvancedChatConfig(character));
        });
      } else {
        setAdvancedChatConfig(normalizeAdvancedChatConfig(character));
      }
      applyCharacterBackground(character?.background, character);

      // Refresh liked status for the loaded entities
      const likeParams = [];
      if (normalizedChat.character_id) likeParams.push(`character_id=${normalizedChat.character_id}`);
      if (normalizedChat.scene_id) likeParams.push(`scene_id=${normalizedChat.scene_id}`);
      if (normalizedChat.persona_id) likeParams.push(`persona_id=${normalizedChat.persona_id}`);

      if (likeParams.length > 0) {
        fetch(`${window.API_BASE_URL}/api/is-liked-multi?${likeParams.join('&')}`, {
          credentials: 'include',
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            setHasLiked({
              character: data?.character ? !!data.character.liked : false,
              scene: data?.scene ? !!data.scene.liked : false,
              persona: data?.persona ? !!data.persona.liked : false,
            });
          })
          .catch(() => setHasLiked({ character: false, scene: false, persona: false }));
      } else {
        setHasLiked({ character: false, scene: false, persona: false });
      }
      
      const normalizedLoadedChat = normalizeChatEntry({
        ...normalizedChat,
        last_updated: normalizedChat.last_updated || new Date().toISOString(),
      });

      setMessages(buildDisplayMessagesForChat(normalizedLoadedChat, character, scene, persona));
      setSelectedChat(normalizedLoadedChat);
      
      // Mark as existing chat so the welcome block is not shown for persisted threads
      isNewChat.current = false;
      setShowChatHistory(false);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.show('加载对话失败，请重试。', { type: 'error' });
    }
  };

  const handleSelectBranch = async (branchId) => {
    if (!selectedChat?.chat_id || !branchId || branchSelectionPending) return;

    const normalizedChat = normalizeChatEntry(selectedChat);
    const targetBranch = normalizedChat?.branches?.find((branch) => branch.branch_id === branchId);
    if (!normalizedChat || !targetBranch) return;

    const nextChatEntry = {
      ...normalizedChat,
      active_branch_id: targetBranch.branch_id,
      messages: targetBranch.messages,
    };

    setBranchSelectionPending(true);
    setSelectedChat(nextChatEntry);
    setMessages(buildDisplayMessagesForChat(nextChatEntry));
    setEditingMessageId(null);
    setEditingMessageText('');

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat/select-branch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify({
          chat_id: normalizedChat.chat_id,
          branch_id: targetBranch.branch_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch branch.');
      }

      const payload = await response.json();
      if (payload?.chat) {
        const updatedChat = upsertChatHistoryEntryLocally(payload.chat);
        setMessages(buildDisplayMessagesForChat(updatedChat));
      }
    } catch (error) {
      setSelectedChat(normalizedChat);
      setMessages(buildDisplayMessagesForChat(normalizedChat));
      toast.show(error.message || 'Failed to switch branch.', { type: 'error' });
    } finally {
      setBranchSelectionPending(false);
    }
  };

  const handleStartEditingMessage = (message) => {
    if (!message?.message_id || message.role !== 'user' || sending) return;
    setEditingMessageId(message.message_id);
    setEditingMessageText(message.content || '');
    setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
  };

  const handleCancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const buildForkedMessagesFromUserMessage = (messageId, replacementContent = null) => {
    const originalMessages = ensureMessageIds(messages);
    const targetIndex = originalMessages.findIndex((message) => message?.message_id === messageId);
    if (targetIndex < 0) return null;

    const targetMessage = originalMessages[targetIndex];
    if (targetMessage?.role !== 'user') return null;

    const nextContent = typeof replacementContent === 'string' ? replacementContent : targetMessage.content || '';
    const forkedMessages = ensureMessageIds(
      originalMessages.slice(0, targetIndex + 1).map((message) => {
        if (!message || typeof message !== 'object') return message;
        if (message.message_id !== messageId) return message;
        return {
          ...message,
          content: nextContent,
          message_id: generateMessageId(),
          is_pinned: false,
        };
      })
    );

    return { originalMessages, targetMessage, forkedMessages };
  };

  const handleResendMessage = async (message) => {
    if (!message?.message_id || message.role !== 'user' || !selectedCharacter || !!editingMessageId || sending) return;

    const forkData = buildForkedMessagesFromUserMessage(message.message_id);
    if (!forkData) return;

    setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
    await sendChatTurn({
      nextMessages: forkData.forkedMessages,
      forkFromMessageId: message.message_id,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: forkData.originalMessages,
      errorMessage: 'Failed to resend from this message.',
    });
  };

  const handleSaveEditedMessage = async () => {
    if (!editingMessageId || !selectedCharacter || sending) return;

    const trimmedContent = editingMessageText.trim();
    if (!trimmedContent) {
      toast.show('消息不能为空。', { type: 'warning' });
      return;
    }

    const forkData = buildForkedMessagesFromUserMessage(editingMessageId, trimmedContent);
    if (!forkData) return;

    handleCancelEditingMessage();
    await sendChatTurn({
      nextMessages: forkData.forkedMessages,
      forkFromMessageId: editingMessageId,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: forkData.originalMessages,
      errorMessage: '从该消息创建分支失败。',
    });
  };

  const handleRename = async (chatId, currentTitle) => {
    if (!newTitle.trim()) {
      setEditingChatId(null);
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/rename`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify({
          chat_id: chatId,
          new_title: newTitle.trim()
        })
      });

      if (res.ok) {
        setEditingChatId(null);
        setNewTitle('');
        // Update selected chat if it's the one being renamed
        if (selectedChat?.chat_id === chatId) {
          setSelectedChat(prev => ({
            ...prev,
            title: newTitle.trim()
          }));
        }
        // Update chat title in userData.chat_history immutably and update context for instant UI
        if (userData && userData.chat_history) {
          setUserData(prev => ({
            ...prev,
            chat_history: prev.chat_history.map(c =>
              c.chat_id === chatId ? { ...c, title: newTitle.trim() } : c
            )
          }));
        }
        // Optionally refresh from backend for consistency
        refreshUserData();
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleDelete = async (chatId) => {
    // Open confirmation modal instead of using window.confirm
    setConfirmModal({ show: true, chatId });
  };

  // Local state for confirm modal
  const [confirmModal, setConfirmModal] = useState({ show: false, chatId: null });

  const handleDeleteConfirmed = async () => {
    const chatId = confirmModal.chatId;
    setConfirmModal({ show: false, chatId: null });
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify({ chat_id: chatId })
      });

      if (res.ok) {
        // Remove chat from userData.chat_history immutably and update context for instant UI
        if (userData && userData.chat_history) {
          setUserData(prev => ({
            ...prev,
            chat_history: prev.chat_history.filter(c => c.chat_id !== chatId)
          }));
        }
        // If deleted chat was the selected one, reset to new chat state
        if (selectedChat?.chat_id === chatId) {
          await handleNewChat();
        }
        // Optionally refresh from backend for consistency
        refreshUserData();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // Parse message content as standard Markdown via react-markdown + GFM.
  // Italic (*text*), bold (**text**), lists, code blocks, line breaks, etc.
  // are all handled natively.
  const renderMessageContent = (text, role) => {
    if (!text) return null;
    // User messages are typed input where literal newlines matter, so convert
    // single newlines into Markdown hard breaks (two trailing spaces). Character
    // messages are left as-is to preserve their existing formatting.
    const content = role === 'user' ? text.replace(/([^\n])\n(?!\n)/g, '$1  \n') : text;
    return (
      <div className="chat-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const contextWindowUsage = getContextWindowUsage(messages);
  const pinnedMemories = messages
    .filter((m) => m?.role !== 'system' && m?.message_id && m?.is_pinned)
    .map((m) => ({
      message_id: m.message_id,
      role: m.role,
      content: m.content,
      preview: getMessagePreview(m.content),
    }));
  const activeChatBranches = normalizeChatEntry(selectedChat)?.branches || [];
  const forkNavMap = computeForkNav(activeChatBranches, selectedChat?.active_branch_id);
  const activeMessageForMenu = messageMenu.messageId
    ? messages.find((m) => m?.message_id === messageMenu.messageId)
    : null;
  const contextUsageRatio = Math.min(1, contextWindowUsage.currentTokens / Math.max(1, contextWindowUsage.softLimit));
  const contextUsagePercent = Math.round(contextUsageRatio * 100);
  const pieRadius = 7;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const pieStrokeOffset = pieCircumference * (1 - contextUsageRatio);

  // Centered content rail — keeps messages, avatars and input fixed-width and centered
  // regardless of sidebar toggle state. Baseline: both sidebars open = left nav (15rem)
  // + character sidebar (19rem) + message area side-padding (1.2rem × 2) = 36.4rem.
  const chatContentRailStyle = {
    width: '100%',
    maxWidth: isMobile
      ? '100%'
      : characterSidebarVisible
        ? 'min(calc(100vw - 36.4rem), 100%)'
        : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
  };

  return (
    <PageWrapper>
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      background: '#fff', 
      minHeight: 0,
      position: 'relative',
      width: '100%',
      overflow: 'hidden'
      }}>
      {!characterSidebarVisible && createPortal(
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1200 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {showChatSettingsHint && isMobile && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: '-0.35rem',
                  transform: 'translateY(0)',
                  background: '#232323',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.78rem',
                  lineHeight: 1.25,
                  width: 'clamp(170px, 48vw, 230px)',
                  maxWidth: 'calc(100vw - 1rem)',
                  whiteSpace: 'normal',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                  zIndex: 1200,
                }}
              >
                点击这里打开聊天设置
                <span
                  style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    top: '-7px',
                    right: '12px',
                    borderWidth: '0 7px 7px 7px',
                    borderColor: 'transparent transparent #232323 transparent',
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowChatSettingsHint(false);
                onToggleCharacterSidebar();
              }}
              aria-label={characterSidebarVisible ? '隐藏角色侧边栏' : '显示角色侧边栏'}
              style={{
                border: 'none',
                background: 'transparent',
                width: '2.35rem',
                height: '2.35rem',
                padding: 0,
                margin: 0,
                color: '#232323',
                fontSize: '1.4rem',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.16s, color 0.15s',
                lineHeight: 1,
                borderRadius: '50%',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <i
                className={`bi ${characterSidebarVisible ? 'bi-chat-square-text-fill' : 'bi-chat-square-text'}`}
                style={{ fontSize: '1.4rem', pointerEvents: 'none' }}
              ></i>
            </button>
          </div>
        </div>,
        document.body,
      )}
      {/* Main Chat Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0, 
        zIndex: 1,
        background: '#fff',
        backgroundImage: selectedWallpaper?.url ? `url(${selectedWallpaper.url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: 0,
        margin: 0,
        boxShadow: 'none',
        overflow: 'hidden', 
        height: 'auto',
        }}>
        {/* Messages Area */}
        <div
          style={{
            flex: 1,
            padding: '1.2rem',
            overflowY: 'auto',
            background: selectedWallpaper?.url ? 'rgba(255, 255, 255, 0.76)' : '#fff',
            backdropFilter: selectedWallpaper?.url ? 'blur(1.5px)' : 'none',
            minHeight: 0,
          }}
        >
          <div style={chatContentRailStyle}>
          {(() => {
            const nonSystem = messages.filter(m => m.role !== 'system');
            // Show welcome for the full lifetime of a new chat so it scrolls with the conversation.
            const showWelcome = isNewChat.current;

            return (
              <>
                {Number(serverContextWindowUsage?.summary_messages_count || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.9rem' }}>
                    <div
                      style={{
                        maxWidth: 760,
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        color: '#334155',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        padding: '0.45rem 0.7rem',
                      }}
                    >
                      为控制上下文窗口已压缩。
                    </div>
                  </div>
                )}

                {showWelcome && (
                  <ChatWelcomeCard
                    selectedCharacter={selectedCharacter}
                    selectedScene={selectedScene}
                  />
                )}

                {nonSystem.length === 0 ? (
                  <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>暂无消息，快来开始对话吧！</div>
                ) : (
                  nonSystem.map((m, i) => (
                    <MessageBubble
                      key={m.message_id || i}
                      message={m}
                      index={i}
                      isMobile={isMobile}
                      selectedCharacter={selectedCharacter}
                      selectedPersona={selectedPersona}
                      userData={userData}
                      editingMessageId={editingMessageId}
                      editingMessageText={editingMessageText}
                      hoveredMessageId={hoveredMessageId}
                      forkNavMap={forkNavMap}
                      branchSelectionPending={branchSelectionPending}
                      sending={sending}
                      t={t}
                      renderMessageContent={renderMessageContent}
                      onHoverMessage={setHoveredMessageId}
                      onOpenMessageMenu={openMessageMenu}
                      onCancelEditing={handleCancelEditingMessage}
                      onSaveEditedMessage={handleSaveEditedMessage}
                      onResendMessage={handleResendMessage}
                      onStartEditing={handleStartEditingMessage}
                      onSelectBranch={handleSelectBranch}
                      onEditTextChange={setEditingMessageText}
                    />
                  ))
                )}
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </>
            );
          })()}
          </div>
        </div>

        <MessageContextMenu
          menuState={messageMenu}
          activeMessage={activeMessageForMenu}
          menuRef={messageMenuRef}
          onTogglePin={handleTogglePin}
          onClose={() => setMessageMenu({ open: false, messageId: null, x: 0, y: 0 })}
        />

        {/* Input Area (no form) */}
        <form
          onSubmit={handleSend}
          style={{
            paddingTop: '0.8rem',
            paddingLeft: '1.2rem',
            paddingRight: '1.2rem',
            paddingBottom: isMobile
              ? 'calc(0.8rem + env(safe-area-inset-bottom, 0px))'
              : '0.8rem',
            background: selectedWallpaper?.url ? 'rgba(255, 255, 255, 0.76)' : '#fff',
            flexShrink: 0
          }}
        >
          <div style={chatContentRailStyle}>
          {userData?.ban_type === 'full_ban' && (
            <BanBanner userData={userData} />
          )}
          {isCreditLocked(creditLimits) && (
            <CreditLockedBanner creditLimits={creditLimits} />
          )}
          <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'center' }}>
            <ContextWindowIndicator
              contextWindowUsage={contextWindowUsage}
              serverContextWindowUsage={serverContextWindowUsage}
              contextUsagePercent={contextUsagePercent}
              pieRadius={pieRadius}
              pieCircumference={pieCircumference}
              pieStrokeOffset={pieStrokeOffset}
              inputHeight={CHAT_INPUT_BASE_HEIGHT}
            />

            <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <textarea
                ref={textareaRef}
                style={{
                  flex: 1,
                  width: '100%',
                  borderRadius: `${CHAT_INPUT_BASE_HEIGHT / 2}px`,
                  border: '1.2px solid #e9ecef',
                  background: '#fff',
                  padding: '0.6rem 0.96rem',
                  paddingRight: '5.7rem',
                  fontSize: '16px',
                  outline: 'none',
                  color: '#232323',
                  boxShadow: 'none',
                  transition: 'border 0.14s',
                  resize: 'none',
                  minHeight: `${CHAT_INPUT_BASE_HEIGHT}px`,
                  maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
                  overflowY: 'hidden',
                  fontFamily: 'inherit',
                  lineHeight: '1.55',
                  boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
                placeholder={'输入您的消息...'}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                required
                disabled={isCreditLocked(creditLimits)}
                onFocus={e => {
                  e.target.style.border = '1.2px solid #18191a';
                }}
                onBlur={e => e.target.style.border = '1.2px solid #e9ecef'}
                rows={1}
              />
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={isTranscribing || isCreditLocked(creditLimits)}
                style={{
                  position: 'absolute',
                  right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2 + 38 + 6}px`,
                  bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
                  background: isRecording
                    ? 'linear-gradient(180deg, #ffe3e3 0%, #ffd0d0 100%)'
                    : 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)',
                  color: isRecording ? '#c0392b' : '#5f567f',
                  border: '1px solid rgba(255, 255, 255, 0.78)',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  boxShadow: isRecording
                    ? '0 8px 16px rgba(220, 53, 69, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)'
                    : '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
                  transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease',
                  cursor: isTranscribing ? 'wait' : 'pointer',
                  outline: 'none',
                  flexShrink: 0,
                }}
                title={isRecording ? '点击结束并识别' : '语音输入'}
              >
                {isTranscribing ? (
                  <span className="spinner-border spinner-border-sm" style={{ color: '#6d638e' }}></span>
                ) : (
                  <i className={`bi ${isRecording ? 'bi-stop-fill' : 'bi-mic-fill'}`}></i>
                )}
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => {
                    if (abortController) {
                      abortController.abort();
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
                    bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)',
                    transition: 'background 0.14s',
                    cursor: 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c82333'}
                  onMouseLeave={e => e.currentTarget.style.background = '#dc3545'}
                  title={'停止生成'}
                >
                  <i className="bi bi-stop-fill"></i>
                </button>
              ) : (
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
                    bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
                    background: sending
                      ? 'rgba(222, 215, 236, 0.82)'
                      : 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)',
                    color: sending ? '#958faa' : '#5f567f',
                    border: '1px solid rgba(255, 255, 255, 0.78)',
                    borderRadius: '50%',
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: sending
                      ? '0 4px 10px rgba(141, 125, 176, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.65)'
                      : '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!sending) {
                      e.currentTarget.style.background = 'linear-gradient(180deg, rgba(246, 241, 251, 0.98) 0%, rgba(239, 233, 246, 0.92) 100%)';
                      e.currentTarget.style.color = '#554d73';
                      e.currentTarget.style.boxShadow = '0 10px 18px rgba(141, 125, 176, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.88)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!sending) {
                      e.currentTarget.style.background = 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)';
                      e.currentTarget.style.color = '#5f567f';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  title={'按 Enter 发送，Shift+Enter 换行。'}
                  disabled={sending || isCreditLocked(creditLimits)}
                >
                  {sending ? (
                    <span className="spinner-border spinner-border-sm" style={{ color: '#6d638e' }}></span>
                  ) : (
                    <i className="bi bi-send-fill"></i>
                  )}
                </button>
              )}
            </div>
          </div>
          </div>
        </form>
      </div>
      <CharacterSidebar
        characterSidebarVisible={characterSidebarVisible}
        onToggleCharacterSidebar={onToggleCharacterSidebar}
        onNewChat={handleNewChat}
        selectedCharacter={selectedCharacter}
        selectedPersona={selectedPersona}
        selectedScene={selectedScene}
        userData={userData}
        characterId={characterId}
        selectedChat={selectedChat}
        editingChatId={editingChatId}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        setEditingChatId={setEditingChatId}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        handleRename={handleRename}
        handleDelete={handleDelete}
        loadChat={loadChat}
        showChatHistory={showChatHistory}
        setShowChatHistory={setShowChatHistory}
        initializeChat={initializeChat}
        likeEntity={likeEntity}
        unlikeEntity={unlikeEntity}
        hasLiked={hasLiked}
        setSelectedPersona={setSelectedPersona}
        setSelectedScene={setSelectedScene}
        setSelectedCharacter={setSelectedCharacter}
        navigate={navigate}
        advancedChatConfig={advancedChatConfig}
        setAdvancedChatConfig={setAdvancedChatConfig}
        onResetAdvancedChatConfig={() => setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter))}
        onSaveAdvancedChatConfig={saveUserCharacterConfig}
        canUseAdvancedChatConfig={canUseAdvancedChatConfig}
        wallpaper={wallpaper}
        onSetWallpaper={setWallpaper}
        characterPicture={selectedCharacter?.picture}
        characterBackground={characterBackground}
        pinnedMemories={pinnedMemories}
        maxPinnedMemories={MAX_PINNED_MEMORIES}
        onJumpToPinnedMemory={jumpToMessage}
        onUnpinMemory={(messageId) => handleTogglePin(messageId, false)}
        isMobile={isMobile}
        setPersonaModalShow={() => setPersonaModal({ show: true })}
        onShareChatLink={(toast) => {
          try {
            const url = window.location.href;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url);
              toast.show('聊天链接已复制到剪贴板', { type: 'success' });
            } else {
              // fallback
              const input = document.createElement('input');
              input.value = url;
              document.body.appendChild(input);
              input.select();
              document.execCommand('copy');
              document.body.removeChild(input);
              toast.show('聊天链接已复制到剪贴板', { type: 'success' });
            }
          } catch {
            toast.show('复制失败，请手动复制链接', { type: 'error' });
          }
        }}
      />
    </div>

      <SceneCharacterSelectModal
        show={initModal}
        loading={initLoading}
        selectedScene={selectedScene}
        onSelectCharacter={() => setCharacterModal({ show: true })}
        selectedCharacter={selectedCharacter}
        setSelectedCharacter={setSelectedCharacter}
        onStartChat={async () => {
          await startChatFromSceneSelection();
        }}
        onCancel={() => {
          if (!initialized.current) {
            navigate(-1);
          } else {
            setInitModal(false);
          }
        }}
        isMobile={isMobile}
      />
      <CharacterModal
        show={characterModal.show}
        onClose={() => setCharacterModal({ show: false })}
        onSelect={character => {
          setSelectedCharacter(character);
          setCharacterId(character?.id || null);
          setCharacterModal({ show: false });
        }}
      />
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false })}
        onSelect={persona => {
          setSelectedPersona(persona);
          setPersonaModal({ show: false });
        }}
        sessionToken={sessionToken}
        refreshUserData={refreshUserData}
        userData={userData}
      />
      <ConfirmModal
        show={confirmModal.show}
        title="删除会话"
        message="您确定要删除此会话吗？"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false, chatId: null })}
      />
      <ConfirmModal
        show={advancedChatConfirm}
        title="进阶角色提醒"
        message="该角色是进阶角色，点数消耗量大，推荐Pro用户使用"
        confirmText="继续对话"
        cancelText="退出"
        onConfirm={handleAdvancedChatConfirm}
        onCancel={handleAdvancedChatExit}
      />
    </PageWrapper>
  );
}