import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import CharacterModal from '../components/CharacterModal';
import CharacterSidebar from '../components/CharacterSidebar';
import PersonaModal from '../components/PersonaModal';
import SceneCharacterSelectModal from '../components/SceneCharacterSelectModal';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import {
  DEFAULT_CONTEXT_WINDOW_TIER,
  getContextWindowTokenLimit,
  normalizeContextWindowTier,
} from '../utils/contextWindow';

const WALLPAPER_OPTIONS = [
  { id: 'none', labelKey: 'chat.wallpaper_default', url: null },
  { id: 'aurora', labelKey: 'chat.wallpaper_aurora', url: '/wallpapers/aurora.svg' },
  { id: 'sunrise', labelKey: 'chat.wallpaper_sunrise', url: '/wallpapers/sunrise.svg' },
  { id: 'waves', labelKey: 'chat.wallpaper_waves', url: '/wallpapers/waves.svg' },
];

const MOBILE_LONG_PRESS_MS = 500;
const MAX_PINNED_MEMORIES = 10;
const DEFAULT_BRANCH_ID = 'branch_main';

const generateMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const ensureMessageIds = (messageList = []) => {
  if (!Array.isArray(messageList)) return [];
  return messageList.map((message) => {
    if (!message || typeof message !== 'object') return message;
    if (message.role === 'system') return message;
    const hasValidId = typeof message.message_id === 'string' && message.message_id.trim();
    return {
      ...message,
      message_id: hasValidId ? message.message_id : generateMessageId(),
      is_pinned: !!message.is_pinned,
    };
  });
};

const normalizeChatBranch = (branch, index = 0) => {
  const fallbackBranchId = index === 0 ? DEFAULT_BRANCH_ID : `branch_local_${index + 1}`;
  const branchId = typeof branch?.branch_id === 'string' && branch.branch_id.trim()
    ? branch.branch_id.trim()
    : fallbackBranchId;

  return {
    branch_id: branchId,
    parent_branch_id: typeof branch?.parent_branch_id === 'string' && branch.parent_branch_id.trim()
      ? branch.parent_branch_id.trim()
      : null,
    parent_message_id: typeof branch?.parent_message_id === 'string' && branch.parent_message_id.trim()
      ? branch.parent_message_id.trim()
      : null,
    label: typeof branch?.label === 'string' && branch.label.trim()
      ? branch.label.trim()
      : (index === 0 ? 'Main' : `Branch ${index + 1}`),
    created_at: branch?.created_at || null,
    last_updated: branch?.last_updated || null,
    messages: ensureMessageIds(Array.isArray(branch?.messages) ? branch.messages : []),
  };
};

const normalizeChatEntry = (chat) => {
  if (!chat || typeof chat !== 'object') return null;

  const sourceBranches = Array.isArray(chat.branches) && chat.branches.length > 0
    ? chat.branches
    : [{ branch_id: DEFAULT_BRANCH_ID, label: 'Main', messages: chat.messages || [] }];
  const branches = sourceBranches.map((branch, index) => normalizeChatBranch(branch, index));

  const requestedActiveBranchId = typeof chat.active_branch_id === 'string' && chat.active_branch_id.trim()
    ? chat.active_branch_id.trim()
    : branches[0]?.branch_id || DEFAULT_BRANCH_ID;
  const activeBranch = branches.find((branch) => branch.branch_id === requestedActiveBranchId) || branches[0];

  return {
    ...chat,
    branches,
    active_branch_id: activeBranch?.branch_id || DEFAULT_BRANCH_ID,
    messages: activeBranch?.messages || [],
  };
};

const getActiveBranch = (chat) => {
  const normalized = normalizeChatEntry(chat);
  if (!normalized) return null;
  return normalized.branches.find((branch) => branch.branch_id === normalized.active_branch_id) || normalized.branches[0] || null;
};

const updateChatEntryBranchMessages = (chatEntry, branchId, nextMessages, extraFields = {}, makeActive = true) => {
  const normalized = normalizeChatEntry(chatEntry) || normalizeChatEntry({});
  const normalizedMessages = ensureMessageIds(nextMessages);
  const nextBranchId = branchId || normalized.active_branch_id || DEFAULT_BRANCH_ID;
  let branchFound = false;

  const branches = normalized.branches.map((branch) => {
    if (branch.branch_id !== nextBranchId) return branch;
    branchFound = true;
    return {
      ...branch,
      ...extraFields,
      messages: normalizedMessages,
    };
  });

  const finalBranches = branchFound
    ? branches
    : [
        ...branches,
        normalizeChatBranch({
          branch_id: nextBranchId,
          label: extraFields.label,
          parent_branch_id: extraFields.parent_branch_id,
          parent_message_id: extraFields.parent_message_id,
          created_at: extraFields.created_at || new Date().toISOString(),
          last_updated: extraFields.last_updated || new Date().toISOString(),
          messages: normalizedMessages,
        }, branches.length),
      ];

  const activeBranchId = makeActive ? nextBranchId : normalized.active_branch_id;
  const activeBranch = finalBranches.find((branch) => branch.branch_id === activeBranchId) || finalBranches[0];

  return {
    ...normalized,
    branches: finalBranches,
    active_branch_id: activeBranch?.branch_id || nextBranchId,
    messages: activeBranch?.messages || [],
  };
};

// Computes branch navigator info for each message that sits at a branch divergence point.
// Returns a Map<messageId, { currentIdx, options: Branch[] }>
const computeForkNav = (allBranches, activeBranchId) => {
  if (!allBranches || allBranches.length <= 1) return new Map();
  const activeBranch = allBranches.find((b) => b.branch_id === activeBranchId);
  if (!activeBranch) return new Map();
  const result = new Map();

  // Case 1: active branch has direct children — show navigator at the fork-source message
  const childrenByParentMsg = {};
  for (const branch of allBranches) {
    if (branch.parent_branch_id === activeBranchId && branch.parent_message_id) {
      if (!childrenByParentMsg[branch.parent_message_id]) {
        childrenByParentMsg[branch.parent_message_id] = [];
      }
      childrenByParentMsg[branch.parent_message_id].push(branch);
    }
  }
  for (const [parentMsgId, children] of Object.entries(childrenByParentMsg)) {
    result.set(parentMsgId, { currentIdx: 0, options: [activeBranch, ...children] });
  }

  // Case 2: active branch is a child — show navigator at its first diverging message
  if (activeBranch.parent_message_id && activeBranch.parent_branch_id) {
    const parentBranch = allBranches.find((b) => b.branch_id === activeBranch.parent_branch_id);
    const siblings = allBranches.filter(
      (b) =>
        b.parent_branch_id === activeBranch.parent_branch_id &&
        b.parent_message_id === activeBranch.parent_message_id,
    );
    const options = parentBranch ? [parentBranch, ...siblings] : [...siblings];
    const currentIdx = options.findIndex((b) => b?.branch_id === activeBranchId);
    const parentMsgIds = new Set(
      (parentBranch?.messages || []).map((m) => m?.message_id).filter(Boolean),
    );
    let forkMessageId = null;
    for (const msg of activeBranch.messages || []) {
      if (msg?.message_id && !parentMsgIds.has(msg.message_id)) {
        forkMessageId = msg.message_id;
        break;
      }
    }
    if (forkMessageId && !result.has(forkMessageId)) {
      result.set(forkMessageId, { currentIdx, options });
    }
  }

  return result;
};

const getMessagePreview = (content = '', max = 88) => {
  if (typeof content !== 'string') return '';
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}...`;
};

export default function ChatPage() {
  const { t } = useTranslation();
  // Sentinel used to indicate a character should have an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
  const SUMMARY_PREFIX = 'Summary of previous conversation:';
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const canUseAdvancedChatConfig = !!userData?.is_pro || Number(userData?.level || 1) >= 3;
  const isProUser = !!userData?.is_pro;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedWallpaperId, setSelectedWallpaperId] = useState(() => localStorage.getItem('chat.selectedWallpaper') || 'none');
  const [sending, setSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [chatLimits, setChatLimits] = useState(null);
  const [serverContextWindowUsage, setServerContextWindowUsage] = useState(null);
  const [showContextDetails, setShowContextDetails] = useState(false);
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

  // Whether the welcome notice has been dismissed (show only once per new chat)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Ref for textarea auto-resize
  const textareaRef = useRef(null);
  // Ref for messages container to enable auto-scrolling
  const messagesEndRef = useRef(null);
  const messageLongPressTimerRef = useRef(null);
  const messageMenuRef = useRef(null);

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const CHAT_INPUT_MAX_HEIGHT = 200;
  const CHAT_INPUT_BASE_HEIGHT = 44;
  const DEFAULT_ADVANCED_CHAT_CONFIG = {
    model: 'deepseek-chat',
    temperature: 1.3,
    top_p: 0.9,
    max_tokens: 250,
    presence_penalty: 0,
    frequency_penalty: 0,
    context_window_tier: DEFAULT_CONTEXT_WINDOW_TIER,
  };
  const normalizeAdvancedChatConfig = (character) => {
    if (!canUseAdvancedChatConfig) {
      return DEFAULT_ADVANCED_CHAT_CONFIG;
    }
    if (!character) return DEFAULT_ADVANCED_CHAT_CONFIG;
    const clamp = (value, min, max, fallback) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(max, Math.max(min, parsed));
    };
    const model = character.model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    const normalizedContextWindowTier = normalizeContextWindowTier(character.context_window_tier, {
      canUseAdvancedConfig: canUseAdvancedChatConfig,
      isProUser,
    });
    return {
      model,
      temperature: clamp(character.temperature, 0, 2, DEFAULT_ADVANCED_CHAT_CONFIG.temperature),
      top_p: clamp(character.top_p, 0, 1, DEFAULT_ADVANCED_CHAT_CONFIG.top_p),
      max_tokens: Math.round(clamp(character.max_tokens, 1, 8192, DEFAULT_ADVANCED_CHAT_CONFIG.max_tokens)),
      presence_penalty: clamp(character.presence_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty),
      frequency_penalty: clamp(character.frequency_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty),
      context_window_tier: normalizedContextWindowTier,
    };
  };
  const normalizeAdvancedChatConfigFromEntry = (rawConfig, fallbackCharacter = null) => {
    const fallback = normalizeAdvancedChatConfig(fallbackCharacter);
    if (!canUseAdvancedChatConfig) {
      return DEFAULT_ADVANCED_CHAT_CONFIG;
    }
    if (!rawConfig || typeof rawConfig !== 'object') {
      return fallback;
    }

    const clamp = (value, min, max, fallbackValue) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallbackValue;
      return Math.min(max, Math.max(min, parsed));
    };

    const model = rawConfig.model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    const normalizedContextWindowTier = normalizeContextWindowTier(rawConfig.context_window_tier, {
      canUseAdvancedConfig: canUseAdvancedChatConfig,
      isProUser,
    });

    return {
      model,
      temperature: clamp(rawConfig.temperature, 0, 2, fallback.temperature),
      top_p: clamp(rawConfig.top_p, 0, 1, fallback.top_p),
      max_tokens: Math.round(clamp(rawConfig.max_tokens, 1, 8192, fallback.max_tokens)),
      presence_penalty: clamp(rawConfig.presence_penalty, -2, 2, fallback.presence_penalty),
      frequency_penalty: clamp(rawConfig.frequency_penalty, -2, 2, fallback.frequency_penalty),
      context_window_tier: normalizedContextWindowTier,
    };
  };
  const [advancedChatConfig, setAdvancedChatConfig] = useState(DEFAULT_ADVANCED_CHAT_CONFIG);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

  // Loading state for initial data fetch
  const [initLoading, setInitLoading] = useState(false);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup: abort any ongoing streaming request on unmount
  useEffect(() => {
    return () => {
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

  useEffect(() => () => {
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  }, []);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const selectedWallpaper = WALLPAPER_OPTIONS.find((option) => option.id === selectedWallpaperId) || WALLPAPER_OPTIONS[0];

  useEffect(() => {
    if (!WALLPAPER_OPTIONS.some((option) => option.id === selectedWallpaperId)) {
      setSelectedWallpaperId('none');
    }
  }, [selectedWallpaperId]);

  useEffect(() => {
    localStorage.setItem('chat.selectedWallpaper', selectedWallpaperId);
  }, [selectedWallpaperId]);

  const handleSelectWallpaper = (wallpaperId) => {
    if (!WALLPAPER_OPTIONS.some((option) => option.id === wallpaperId)) return;
    setSelectedWallpaperId(wallpaperId);
  };

  // Update IDs instantly when URL searchParams change
  useEffect(() => {
    setCharacterId(searchParams.get('character'));
    setSceneId(searchParams.get('scene'));
    if (!searchParams.get('character')) {
      setSelectedCharacter(null);
    }
    if (!searchParams.get('scene')) {
      setSelectedScene(null);
    }
    setSelectedPersona(null);
    setSelectedChat(null);
    setMessages([]);
    setEditingMessageId(null);
    setEditingMessageText('');
    setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
    setServerContextWindowUsage(null);
    isNewChat.current = true;
    setWelcomeDismissed(false);
    setInitModal(false);
    initialized.current = false;
  }, [searchParams]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle mobile keyboard viewport to prevent layout shift
  useEffect(() => {
    if (window.innerWidth >= 768) return; // Only on mobile

    const handleResize = () => {
      // When keyboard is open, window.innerHeight becomes smaller
      // Lock the main scrollable area to prevent background from showing
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.style.maxHeight = `${window.innerHeight}px`;
      }
    };

    const handleOrientationChange = () => {
      // Reset on orientation change
      setTimeout(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.style.maxHeight = 'unset';
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const navigate = useNavigate();
  const initialized = useRef(false);
  const isNewChat = useRef(true);
  const lastLimitReminderCountRef = useRef(null);

  const maybeShowMessageLimitReminder = (limits) => {
    if (!limits || !limits.is_limited || !limits.approaching_limit || limits.limit_reached) return;

    const currentCount = Number(limits.daily_message_count ?? 0);
    if (lastLimitReminderCountRef.current === currentCount) return;

    lastLimitReminderCountRef.current = currentCount;
    const remaining = Number(limits.remaining_messages ?? 0);
    const cap = Number(limits.daily_message_cap ?? 0);

    toast.show(
      `今日还可发送 ${remaining} 条消息（${currentCount}/${cap}）。升级 Pro 可解锁无限消息。`,
      { type: 'warning' }
    );
  };

  const applyChatLimits = (limits) => {
    if (!limits) return;
    setChatLimits(limits);
    maybeShowMessageLimitReminder(limits);
  };

  const getChatErrorMessage = (errorPayload) => {
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
      scene?.description || null
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

  const getContextWindowUsage = (allMessages) => {
    const effectiveSoftTokenLimit = getContextWindowTokenLimit(advancedChatConfig?.context_window_tier, {
      canUseAdvancedConfig: canUseAdvancedChatConfig,
      isProUser,
    });

    if (!Array.isArray(allMessages)) {
      return {
        currentTokens: 0,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    const validMessages = allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );

    if (serverContextWindowUsage) {
      const serverInputTokens = Number(serverContextWindowUsage.input_tokens || 0);

      return {
        currentTokens: serverInputTokens,
        softLimit: Number(serverContextWindowUsage.soft_token_limit || effectiveSoftTokenLimit),
      };
    }

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

  const syncPinnedStateInUserHistory = (chatId, messageId, isPinned) => {
    if (!chatId || !messageId) return;
    if (!userData?.chat_history) return;

    setUserData((prev) => {
      if (!prev?.chat_history) return prev;
      return {
        ...prev,
        chat_history: prev.chat_history.map((chatEntry) => {
          if (chatEntry.chat_id !== chatId) return chatEntry;
          const normalizedChat = normalizeChatEntry(chatEntry);
          if (!normalizedChat) return chatEntry;
          const activeBranchId = normalizedChat.active_branch_id;
          return updateChatEntryBranchMessages(
            normalizedChat,
            activeBranchId,
            normalizedChat.messages.map((msg) => {
              if (!msg || typeof msg !== 'object') return msg;
              if (msg.message_id !== messageId) return msg;
              return { ...msg, is_pinned: isPinned };
            }),
            {},
            true
          );
        }),
      };
    });
  };

  const persistPinnedMessage = async (message, isPinned) => {
    if (!selectedChat?.chat_id) return;
    if (!message?.message_id) return;

    const response = await fetch(`${window.API_BASE_URL}/api/chat/pin-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify({
        chat_id: selectedChat.chat_id,
        branch_id: selectedChat.active_branch_id,
        message_id: message.message_id,
        is_pinned: !!isPinned,
        message_role: message.role,
        message_content: message.content,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.error || 'Failed to update pinned memory');
    }
  };

  const handleTogglePin = async (messageId, nextPinnedState) => {
    const targetMessage = messages.find((m) => m?.message_id === messageId);
    if (!targetMessage) return;

    if (!selectedChat?.chat_id) {
      toast.show(t('chat.pin_requires_saved_chat') || 'Send a message first to save and pin memories.', { type: 'warning' });
      return;
    }

    if (nextPinnedState && !targetMessage.is_pinned) {
      const currentPinnedCount = messages.filter((m) => m?.role !== 'system' && m?.is_pinned).length;
      if (currentPinnedCount >= MAX_PINNED_MEMORIES) {
        toast.show(
          t('chat.memory_pin_limit_reached', { max: MAX_PINNED_MEMORIES }) || `You can pin up to ${MAX_PINNED_MEMORIES} memories.`,
          { type: 'warning' }
        );
        return;
      }
    }

    setMessages((prev) => prev.map((m) => {
      if (!m || typeof m !== 'object') return m;
      if (m.message_id !== messageId) return m;
      return { ...m, is_pinned: nextPinnedState };
    }));

    setSelectedChat((prev) => {
      if (!prev) return prev;
      return updateChatEntryBranchMessages(
        prev,
        prev.active_branch_id,
        prev.messages.map((m) => {
          if (!m || typeof m !== 'object') return m;
          if (m.message_id !== messageId) return m;
          return { ...m, is_pinned: nextPinnedState };
        }),
        {},
        true
      );
    });

    syncPinnedStateInUserHistory(selectedChat?.chat_id, messageId, nextPinnedState);

    try {
      await persistPinnedMessage(targetMessage, nextPinnedState);
      toast.show(
        nextPinnedState
          ? (t('chat.memory_pinned_success') || 'Memory pinned.')
          : (t('chat.memory_unpinned_success') || 'Memory unpinned.'),
        { type: 'success' }
      );
    } catch (error) {
      setMessages((prev) => prev.map((m) => {
        if (!m || typeof m !== 'object') return m;
        if (m.message_id !== messageId) return m;
        return { ...m, is_pinned: !nextPinnedState };
      }));
      setSelectedChat((prev) => {
        if (!prev) return prev;
        return updateChatEntryBranchMessages(
          prev,
          prev.active_branch_id,
          prev.messages.map((m) => {
            if (!m || typeof m !== 'object') return m;
            if (m.message_id !== messageId) return m;
            return { ...m, is_pinned: !nextPinnedState };
          }),
          {},
          true
        );
      });
      syncPinnedStateInUserHistory(selectedChat?.chat_id, messageId, !nextPinnedState);
      toast.show(error.message || (t('chat.memory_pin_failed') || 'Failed to update memory pin.'), { type: 'error' });
    }
  };

  const openMessageMenu = (event, messageId) => {
    event.preventDefault();
    event.stopPropagation();
    const clientX = Number(event.clientX || 0);
    const clientY = Number(event.clientY || 0);
    setMessageMenu({
      open: true,
      messageId,
      x: clientX,
      y: clientY,
    });
  };

  const startMessageLongPress = (touchEvent, messageId) => {
    if (!isMobile) return;
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }

    const touch = touchEvent.touches?.[0];
    const clientX = Number(touch?.clientX || 0);
    const clientY = Number(touch?.clientY || 0);

    messageLongPressTimerRef.current = window.setTimeout(() => {
      setMessageMenu({
        open: true,
        messageId,
        x: clientX,
        y: clientY,
      });
      messageLongPressTimerRef.current = null;
    }, MOBILE_LONG_PRESS_MS);
  };

  const stopMessageLongPress = () => {
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
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

  // Fetch initial entity data when modal opens and IDs are present
  useEffect(() => {
    if (initModal && (characterId || sceneId)) {
      setInitLoading(true);
      fetchInitialData().finally(() => {
        setInitLoading(false);
      });
    }
  }, [initModal, characterId, sceneId]);

  const handleCharacterEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const characterMatches = String(h.character_id) === String(characterId);
        const hasNoScene = !h.scene_id; // Only load chats without a scene
        return characterMatches && hasNoScene;
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

      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error handling scene entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Initialize data based on URL entry (character or scene)
  useEffect(() => {
    if (loading) return;

    if (!loading && !sessionToken) {
      navigate('/');
      return;
    }

    if (initialized.current) return;

    if (sessionToken && sceneId && !initModal) {
      handleSceneEntry();
    }

    if (sessionToken && characterId) {
      handleCharacterEntry();
      return;
    }

  }, [navigate, sessionToken, loading, characterId, sceneId, userData, initModal]);

  // Reusable function to start chat with current selections (used by modal and direct entry)
  const startChatWithSelectedEntities = async () => {
    isNewChat.current = true;
    setWelcomeDismissed(false);
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
    setInitModal(false);
    const existingChats = userData?.chat_history?.filter(h => {
      const characterMatches = String(h.character_id) === String(selectedCharacter.id);
      const sceneMatches = selectedScene ? String(h.scene_id) === String(selectedScene.id) : false;
      return characterMatches && sceneMatches;
    }) || [];

    if (existingChats.length > 0) {
      const mostRecentChat = existingChats.sort(
        (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
      )[0];
      await loadChat(mostRecentChat);
      initialized.current = true;
      return;
    }

    await startChatWithSelectedEntities();
    initialized.current = true;
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
              setLikes(data.likes || 0);
              return data;
            })
            .catch(err => {
              console.error('Error fetching character:', err);
              toast.show(t('chat.error_loading_character') || 'Failed to load character.', { type: 'error' });
              setSelectedCharacter(null);
              return null;
            })
        );
      } else {
        if (selectedCharacter?.id) {
          character = selectedCharacter;
          setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter));
        } else {
          setSelectedCharacter(null);
          setAdvancedChatConfig(DEFAULT_ADVANCED_CHAT_CONFIG);
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
    const { character, scene, persona } = fetchedData || {};
    const sys = buildSystemPromptMessage(character, scene, persona);
    // Use the character's greeting if available. Do not emit a special scene greeting here
    // because the scene introduction is now handled by the welcome notice.
    // If the character uses the improvising sentinel, call the backend LLM to generate
    // the initial assistant greeting dynamically.
    // Disable greeting when there's a scene.
    const charGreeting = scene ? null : character?.greeting;
    setSelectedChat(null);
    setInput('');

    if (charGreeting === SPECIAL_IMPROVISING_GREETING) {
      setMessages([sys]);
      await sendChatTurn({
        nextMessages: [sys],
        sourceBranchId: null,
        restoreMessagesOnError: [sys],
        shouldDismissWelcome: false,
        errorMessage: t('chat.error_generating_greeting') || 'Failed to generate greeting.',
        characterOverride: character,
        sceneOverride: scene,
        personaOverride: persona,
      });
      return;
    }

    // Non-improvising: use greeting if provided
    let greet = null;
    if (charGreeting) {
      greet = {
        role: 'assistant',
        content: charGreeting,
        message_id: generateMessageId(),
        is_pinned: false,
      };
    }
    setMessages(ensureMessageIds(greet ? [sys, greet] : [sys]));
  };

  const sendChatTurn = async ({
    nextMessages,
    forkFromMessageId = null,
    sourceBranchId = selectedChat?.active_branch_id || null,
    restoreMessagesOnError = nextMessages,
    shouldDismissWelcome = true,
    errorMessage = 'Failed to send message. Please try again.',
    characterOverride = selectedCharacter,
    sceneOverride = selectedScene,
    personaOverride = selectedPersona,
  }) => {
    if (!characterOverride) return;

    if (shouldDismissWelcome && isNewChat.current && !welcomeDismissed) {
      setWelcomeDismissed(true);
      isNewChat.current = false;
    }

    setSending(true);
    setIsStreaming(true);

    const requestMessages = compactMessagesForRequest(nextMessages);
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
          chat_id: selectedChat?.chat_id,
          branch_id: sourceBranchId,
          fork_from_message_id: forkFromMessageId,
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
        throw new Error(getChatErrorMessage(errorPayload));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.chunk) {
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
            applyChatLimits(data.limits);
            if (refreshUserData) {
              refreshUserData({ silent: true });
            }
            if (data.context_window) {
              setServerContextWindowUsage(data.context_window);
            }
            if (data.chat_entry) {
              const nextChatEntry = upsertChatHistoryEntryLocally(data.chat_entry);
              setMessages(buildDisplayMessagesForChat(nextChatEntry));
            } else {
              setMessages(ensureMessageIds([...nextMessages, { role: 'assistant', content: accumulatedReply, message_id: assistantMessageId, is_pinned: false }]));
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.show(err.message || errorMessage, { type: 'error' });
      }
      setMessages(ensureMessageIds(restoreMessagesOnError));
    } finally {
      setSending(false);
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
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

  // Unified new chat action respecting current entry mode
  const handleNewChat = async () => {
    setSelectedChat(null);
    setMessages([]);
    setEditingMessageId(null);
    setEditingMessageText('');
    isNewChat.current = true;
    setWelcomeDismissed(false);

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

  // Handle keyboard shortcuts (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
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
      setCharacterId(normalizedChat.character_id);
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

      // History config always has precedence; character defaults are only fallback.
      setAdvancedChatConfig(normalizeAdvancedChatConfigFromEntry(normalizedChat?.chat_config, character));

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
      
      // Mark as existing chat, dismiss welcome
      isNewChat.current = false;
      setWelcomeDismissed(true);
      setShowChatHistory(false);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.show(t('chat.error_loading_chat') || 'Failed to load chat.', { type: 'error' });
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

  const handleSaveEditedMessage = async () => {
    if (!editingMessageId || !selectedCharacter || sending) return;

    const trimmedContent = editingMessageText.trim();
    if (!trimmedContent) {
      toast.show(t('chat.empty_message_error') || 'Message cannot be empty.', { type: 'warning' });
      return;
    }

    const originalMessages = ensureMessageIds(messages);
    const targetIndex = originalMessages.findIndex((message) => message?.message_id === editingMessageId);
    if (targetIndex < 0) return;

    const targetMessage = originalMessages[targetIndex];
    if (targetMessage?.role !== 'user') return;

    const forkedMessages = ensureMessageIds(
      originalMessages.slice(0, targetIndex + 1).map((message) => {
        if (!message || typeof message !== 'object') return message;
        if (message.message_id !== editingMessageId) return message;
        return {
          ...message,
          content: trimmedContent,
          message_id: generateMessageId(),
          is_pinned: false,
        };
      })
    );

    handleCancelEditingMessage();
    await sendChatTurn({
      nextMessages: forkedMessages,
      forkFromMessageId: editingMessageId,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: originalMessages,
      errorMessage: t('chat.edit_branch_failed') || 'Failed to create a new branch from this message.',
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

  // Helper: parse message content into React elements honoring *actions* and (scene) narration
  // This is intentionally lightweight: it looks for *wrapped* tokens and (parenthesis) tokens
  const renderMessageContent = (text) => {
    if (!text) return null;
    // Resolve escaped asterisks before parsing so \* is never treated as an action delimiter
    const normalized = text.replace(/\\\*/g, '\x00LITERAL_STAR\x00');
    // Split by tokens but keep delimiters using regex
    const parts = [];
    const re = /(\*[^*]+\*)|(\([^)]*\))/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(normalized)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: normalized.slice(lastIndex, match.index) });
      }
      const token = match[0];
      if (token.startsWith('*') && token.endsWith('*')) {
        parts.push({ type: 'action', content: token.slice(1, -1) });
      } else if (token.startsWith('(') && token.endsWith(')')) {
        parts.push({ type: 'scene', content: token.slice(1, -1) });
      } else {
        parts.push({ type: 'text', content: token });
      }
      lastIndex = re.lastIndex;
    }
    if (lastIndex < normalized.length) {
      parts.push({ type: 'text', content: normalized.slice(lastIndex) });
    }

    const restoreStar = (str) => str.split('\x00LITERAL_STAR\x00').join('*');

    return parts.map((p, idx) => {
      // Use inheritable colors so these tokens adapt to the parent bubble's color
      if (p.type === 'action') {
        return <span key={idx} style={{ fontStyle: 'italic', fontWeight: 600, margin: '0 4px', color: 'inherit' }}>{restoreStar(p.content)}</span>;
      }
      if (p.type === 'scene') {
        return <span key={idx} style={{ fontStyle: 'italic', color: 'inherit', opacity: 0.9, margin: '0 4px' }}>({restoreStar(p.content)})</span>;
      }
      // For text parts, split by newlines and render with <br/> tags
      const lines = restoreStar(p.content).split('\n');
      return <span key={idx}>{lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}</span>;
    });
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

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      background: 'transparent', 
      minHeight: 0,
      position: 'relative',
      width: '100%',
      overflow: 'hidden'
      }}>
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
        borderRadius: isMobile ? '0' : '1.5rem', 
        margin: isMobile ? '0' : '0 0.5rem 0 0.5rem', 
        boxShadow: '0 2px 16px rgba(0,0,0,0.04)', 
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
          {(() => {
            const nonSystem = messages.filter(m => m.role !== 'system');
            // Show welcome only when starting a new chat (isNewChat.current)
            // This ensures we still show welcome when nonSystem.length === 0 (no character greeting),
            // but only once per new chat session.
            const showWelcome = isNewChat.current && !welcomeDismissed;

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
                  (() => {
                    // Build a system-style welcome notice independent from the assistant's greeting message
                    const charName = selectedCharacter?.name;
                    const personaName = selectedPersona?.name;
                    const sceneName = selectedScene?.name;
                    const personaDesc = selectedPersona?.description;
                    const sceneDesc = selectedScene?.description;

                    // Build the translated welcome title and body using i18n with sensible fallbacks
                    const title = t('chat.welcome_title', { name: charName || '' });

                    // For the body, prefer a combined sentence with character/persona data.
                    // Scene information is displayed separately (title + intro) in its own visually distinct block.
                    const mainParts = [];
                    mainParts.push(t('chat.welcome_body_intro', { character: charName || '' }));
                    if (personaName) {
                      mainParts.push(t('chat.welcome_body_persona', { persona: personaName }));
                    }
                    mainParts.push(t('chat.welcome_body_cta'));
                    const welcomeText = mainParts.join(' ');

                    // Scene-specific text (localized)
                    const sceneTitleText = sceneName ? t('chat.welcome_scene_title', { scene: sceneName }) : null;

                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
                        <div style={{ maxWidth: 720, width: '100%', textAlign: 'center', padding: '0 0.6rem' }}>
                          {/* Picture above, centered */}
                          {(selectedCharacter?.avatar_picture || selectedCharacter?.picture) ? (
                            <img
                              src={`${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`}
                              alt={charName || 'Character'}
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: 'cover',
                                borderRadius: '50%',
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                          ) : (
                            <img
                              src={defaultPic}
                              alt={charName || 'Character'}
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: 'cover',
                                borderRadius: '50%',
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                          )}

                          {/* Title centered */}
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#121212', marginTop: 12 }}>
                            {title}
                          </div>

                          {/* Scene block (visually distinct). Shows scene title and scene.intro if available */}
                          {sceneName && (
                            <div style={{
                              marginTop: 12,
                              padding: '0.9rem',
                              background: '#f1f5f9',
                              borderRadius: '0.75rem',
                              border: '1px solid rgba(15, 23, 42, 0.04)',
                              color: '#0f172a',
                              textAlign: 'left'
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{sceneTitleText}</div>
                              {selectedScene?.intro && (
                                <div style={{ marginTop: 6, fontStyle: 'italic', color: '#374151' }}>{selectedScene.intro}</div>
                              )}
                            </div>
                          )}

                          {/* Text centered, transparent background so it appears inline in chat */}
                          <div style={{ marginTop: 8, color: '#4b5563', fontSize: '0.92rem', lineHeight: 1.35 }}>
                            {welcomeText}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {nonSystem.length === 0 ? (
                  <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>{t('chat.no_messages')}</div>
                ) : (
                  nonSystem.map((m, i) => (
                    <div
                      key={m.message_id || i}
                      id={m.message_id ? `message-${m.message_id}` : undefined}
                      style={{
                        display: 'flex',
                        marginBottom: '1.2rem',
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                      onTouchStart={(event) => {
                        if (!m?.message_id) return;
                        startMessageLongPress(event, m.message_id);
                      }}
                      onTouchEnd={stopMessageLongPress}
                      onTouchCancel={stopMessageLongPress}
                    >
                      {/* Column: avatar+bubble row, then below-bubble controls */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: editingMessageId === m.message_id && m.role === 'user'
                          ? (isMobile ? '96%' : '92%')
                          : '80%',
                      }}>
                        {/* Avatar + bubble row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                        }}>
                          <img
                            src={
                              m.role === 'user'
                                ? (userData?.profile_pic
                                    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}`
                                    : defaultPic)
                                  : ((selectedCharacter?.avatar_picture || selectedCharacter?.picture)
                                    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`
                                    : defaultPic)
                            }
                            alt={m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                            style={{ width: 77, height: 77, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.6px solid #e9ecef' }}
                          />
                          <div style={{
                            margin: m.role === 'user' ? '0 0.4rem 0 0.88rem' : '0 0.88rem 0 0.4rem',
                            background: '#f5f6fa',
                            color: '#232323',
                            borderRadius: '0.88rem',
                            padding: '0.68rem 0.96rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            fontSize: '0.82rem',
                            minWidth: 0,
                            wordBreak: 'break-word',
                            maxWidth: '100%',
                            width: editingMessageId === m.message_id && m.role === 'user'
                              ? (isMobile ? '100%' : 'min(70vw, 760px)')
                              : 'auto',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.76rem', opacity: 0.7 }}>
                                {m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                                {m.is_pinned && (
                                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#334155' }}>
                                    <i className="bi bi-pin-angle-fill" style={{ marginRight: 4 }}></i>
                                    {t('chat.pinned_memory') || 'Pinned'}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  if (!m?.message_id) return;
                                  openMessageMenu(event, m.message_id);
                                }}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#6b7280',
                                  cursor: 'pointer',
                                  width: 22,
                                  height: 22,
                                  borderRadius: 999,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  flexShrink: 0,
                                }}
                                aria-label={t('chat.message_options') || 'Message options'}
                                title={t('chat.message_options') || 'Message options'}
                              >
                                <i className="bi bi-three-dots"></i>
                              </button>
                            </div>
                            {editingMessageId === m.message_id && m.role === 'user' ? (
                              <textarea
                                value={editingMessageText}
                                onChange={(event) => setEditingMessageText(event.target.value)}
                                rows={4}
                                autoFocus
                                style={{
                                  width: '100%',
                                  borderRadius: 10,
                                  border: '1px solid #d1d5db',
                                  padding: '0.7rem 0.8rem',
                                  fontSize: '0.82rem',
                                  resize: 'vertical',
                                  minHeight: 96,
                                }}
                              />
                            ) : (
                              <div>{renderMessageContent(m.content)}</div>
                            )}
                          </div>
                        </div>

                        {/* Below-bubble controls — only for user messages */}
                        {m.role === 'user' && m?.message_id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {/* Edit pencil button / Cancel + Save when editing */}
                            {editingMessageId === m.message_id ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={handleCancelEditingMessage}
                                  disabled={sending}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-dark"
                                  onClick={handleSaveEditedMessage}
                                  disabled={sending || !editingMessageText.trim()}
                                >
                                  发送
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEditingMessage(m)}
                                disabled={!!editingMessageId || sending}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#9ca3af',
                                  cursor: !!editingMessageId || sending ? 'not-allowed' : 'pointer',
                                  width: 26,
                                  height: 26,
                                  borderRadius: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  fontSize: '0.82rem',
                                }}
                                title={t('chat.edit_into_branch') || 'Edit into new branch'}
                                aria-label={t('chat.edit_into_branch') || 'Edit into new branch'}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {/* Branch navigator — < X / Y > */}
                            {(() => {
                              const nav = forkNavMap.get(m.message_id);
                              if (!nav) return null;
                              const prevIdx = (nav.currentIdx - 1 + nav.options.length) % nav.options.length;
                              const nextIdx = (nav.currentIdx + 1) % nav.options.length;
                              const navBtnStyle = {
                                border: 'none',
                                background: 'transparent',
                                color: '#374151',
                                borderRadius: 6,
                                width: 24,
                                height: 24,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                cursor: branchSelectionPending || sending ? 'not-allowed' : 'pointer',
                                opacity: branchSelectionPending || sending ? 0.5 : 1,
                                fontSize: '0.9rem',
                                lineHeight: 1,
                              };
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <button
                                    type="button"
                                    style={navBtnStyle}
                                    disabled={branchSelectionPending || sending}
                                    onClick={() => handleSelectBranch(nav.options[prevIdx].branch_id)}
                                    title={nav.options[prevIdx]?.label || `Branch ${prevIdx + 1}`}
                                  >‹</button>
                                  <span style={{ fontSize: '0.74rem', color: '#6b7280', minWidth: 36, textAlign: 'center', userSelect: 'none' }}>
                                    {nav.currentIdx + 1}&nbsp;/&nbsp;{nav.options.length}
                                  </span>
                                  <button
                                    type="button"
                                    style={navBtnStyle}
                                    disabled={branchSelectionPending || sending}
                                    onClick={() => handleSelectBranch(nav.options[nextIdx].branch_id)}
                                    title={nav.options[nextIdx]?.label || `Branch ${nextIdx + 1}`}
                                  >›</button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </>
            );
          })()}
        </div>

        {messageMenu.open && activeMessageForMenu && (
          <div
            ref={messageMenuRef}
            style={{
              position: 'fixed',
              top: Math.max(8, messageMenu.y + 8),
              left: Math.max(8, Math.min(window.innerWidth - 200, messageMenu.x - 20)),
              width: 190,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              boxShadow: '0 10px 28px rgba(0,0,0,0.16)',
              zIndex: 1200,
              padding: 6,
            }}
          >
            <button
              type="button"
              className="dropdown-item"
              style={{ borderRadius: 8, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={async () => {
                const nextPinnedState = !activeMessageForMenu.is_pinned;
                const targetId = activeMessageForMenu.message_id;
                setMessageMenu({ open: false, messageId: null, x: 0, y: 0 });
                if (!targetId) return;
                await handleTogglePin(targetId, nextPinnedState);
              }}
            >
              <i className={activeMessageForMenu.is_pinned ? 'bi bi-pin-angle' : 'bi bi-pin-angle-fill'}></i>
              {activeMessageForMenu.is_pinned
                ? (t('chat.unpin_memory') || 'Unpin memory')
                : (t('chat.pin_memory') || 'Pin as memory')}
            </button>
          </div>
        )}

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
            background: selectedWallpaper?.url ? 'rgba(248, 249, 250, 0.9)' : '#f8f9fa',
            borderTop: '1.2px solid #e9ecef',
            flexShrink: 0
          }}
        >
          <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'flex-end' }}>
            <div
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginBottom: 7 }}
              onMouseEnter={() => setShowContextDetails(true)}
              onMouseLeave={() => setShowContextDetails(false)}
            >
              <button
                type="button"
                onFocus={() => setShowContextDetails(true)}
                onBlur={() => setShowContextDetails(false)}
                onClick={() => setShowContextDetails((prev) => !prev)}
                aria-label="上下文窗口使用情况"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="9" cy="9" r={pieRadius} fill="none" stroke="#e5e7eb" strokeWidth="2" />
                  <circle
                    cx="9"
                    cy="9"
                    r={pieRadius}
                    fill="none"
                    stroke={contextUsagePercent >= 90 ? '#dc3545' : '#18191a'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={pieCircumference}
                    strokeDashoffset={pieStrokeOffset}
                    transform="rotate(-90 9 9)"
                  />
                </svg>
                <span>{contextUsagePercent}%</span>
              </button>

              {showContextDetails && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '140%',
                    left: 0,
                    transform: 'none',
                    minWidth: 220,
                    background: '#111827',
                    color: '#f9fafb',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    zIndex: 20,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 6 }}>上下文使用情况</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: 8 }}>
                    {`当前 ${contextWindowUsage.currentTokens}/${contextWindowUsage.softLimit} tokens`}
                  </div>

                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${contextUsagePercent}%`,
                        height: '100%',
                        background: contextUsagePercent >= 90 ? '#ef4444' : '#60a5fa',
                      }}
                    />
                  </div>

                  <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                    基于上次请求的上下文使用情况
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: 4 }}>
                    到达 95% 上下文窗口时，系统会开始压缩上下文。
                  </div>
                  {Number(serverContextWindowUsage?.summary_messages_count || 0) > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#86efac', marginTop: 4 }}>
                      已自动整理旧消息并保留最近 2 条对话用于请求上下文。
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '0.64rem', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                style={{
                  flex: 1,
                  borderRadius: '1.2rem',
                  border: '1.2px solid #e9ecef',
                  background: '#fff',
                  padding: '0.6rem 0.96rem',
                  fontSize: '0.82rem',
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
                placeholder={t('chat.input_placeholder')}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                required
                onFocus={e => {
                  e.target.style.border = '1.2px solid #18191a';
                  // Prevent viewport shift on mobile
                  if (window.innerWidth < 768) {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                    }, 300);
                  }
                }}
                onBlur={e => e.target.style.border = '1.2px solid #e9ecef'}
                rows={1}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => {
                    if (abortController) {
                      abortController.abort();
                    }
                  }}
                  style={{
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
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
                  title={t('chat.stop_generation') || 'Stop'}
                >
                  <i className="bi bi-stop-fill"></i>
                </button>
              ) : (
                <button
                  type="submit"
                  style={{
                    background: sending ? '#888' : '#18191a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: '0 2px 8px rgba(24,25,26,0.08)',
                    transition: 'background 0.14s',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!sending) e.currentTarget.style.background = '#232323'; }}
                  onMouseLeave={e => { if (!sending) e.currentTarget.style.background = '#18191a'; }}
                  title={t('chat.input_shortcut_hint')}
                  disabled={sending}
                >
                  {sending ? (
                    <span className="spinner-border spinner-border-sm" style={{ color: '#fff' }}></span>
                  ) : (
                    <i className="bi bi-send-fill"></i>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
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
        canUseAdvancedChatConfig={canUseAdvancedChatConfig}
        wallpaperOptions={WALLPAPER_OPTIONS}
        selectedWallpaperId={selectedWallpaperId}
        onSelectWallpaper={handleSelectWallpaper}
        pinnedMemories={pinnedMemories}
        maxPinnedMemories={MAX_PINNED_MEMORIES}
        onJumpToPinnedMemory={jumpToMessage}
        onUnpinMemory={(messageId) => handleTogglePin(messageId, false)}
        isMobile={isMobile}
        setPersonaModalShow={() => setPersonaModal({ show: true })}
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
        title={t('confirm.delete_chat.title')}
        message={t('confirm.delete_chat.message')}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false, chatId: null })}
      />
    </div>
  );
}