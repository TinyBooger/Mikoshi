import React, { useCallback, useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import MarkdownMessage from '../components/MarkdownMessage';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import CharacterSidebar from '../components/CharacterSidebar';
import PageWrapper from '../components/PageWrapper';
import SidebarToggleButton from '../components/chat/SidebarToggleButton';
import ChatConversationArea from '../components/chat/ChatConversationArea';
import ChatModals from '../components/chat/ChatModals';
import ShareScreenshotDialog from '../components/share/ShareScreenshotDialog';
import ShareCharacterDialog from '../components/share/ShareCharacterDialog';
import { useToast } from '../components/ToastProvider';
import {
  normalizeChatEntry,
  ensureMessageIds,
  MAX_PINNED_MEMORIES,
} from '../utils/chatHelpers';
import {
  DEFAULT_ADVANCED_CHAT_CONFIG,
} from '../utils/chatPageConstants';
import {
  getTokenLimits,
  clamp,
  normalizeTokenTierValue,
  normalizeChatModel,
} from '../utils/chatConfigHelpers';
import { getSelectedWallpaper } from '../utils/chatMessages';
import { getChatDraftStorageKeys } from '../utils/chatDraftStorage';
import { toChatHistoryMetadata } from '../utils/chatHistoryMetadata';
import { useCreditAndChatLimits } from '../hooks/useCreditAndChatLimits';
import { usePinnedMemories } from '../hooks/usePinnedMemories';
import { useChatHistoryPaging } from '../hooks/useChatHistoryPaging';
import { useIsMobile } from '../hooks/useIsMobile';
import { useChatSettingsHint } from '../hooks/useChatSettingsHint';
import { useChatSend } from '../hooks/useChatSend';
import { useMessageEditing } from '../hooks/useMessageEditing';
import { useChatInitialization } from '../hooks/useChatInitialization';
import { useChatHistoryActions } from '../hooks/useChatHistoryActions';
import { useLikeEntity } from '../hooks/useLikeEntity';
import { createChatRuntimeStore } from '../hooks/useChatRuntimeState';
import { NAV_WIDTH, SIDEBAR_WIDTH, CHAT_CONTENT_PADDING } from '../constants/layout';

// Resolves after the browser has painted the next commit: messages loaded on
// demand only reach the DOM on the render that follows the fetch.
const waitForNextPaint = () => new Promise((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
});

export default function ChatPage() {
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const isProUser = !!userData?.is_pro;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const chatStateRef = useRef(null);
  if (!chatStateRef.current) {
    chatStateRef.current = createChatRuntimeStore();
  }
  const chatState = chatStateRef.current;
  const setMessages = useCallback(
    (update) => chatState.setMessages(update),
    [chatState],
  );
  const setServerContextWindowUsage = useCallback(
    (update) => chatState.set('serverContextWindowUsage', update),
    [chatState],
  );
  const inputRef = useRef('');
  const inputSetterRef = useRef(null);
  const setInput = useCallback((nextInput) => {
    const value = typeof nextInput === 'function' ? nextInput(inputRef.current) : nextInput;
    inputRef.current = value;
    inputSetterRef.current?.(value);
  }, []);
  const [wallpaper, setWallpaper] = useState({ id: 'none', url: null });
  const [characterBackground, setCharacterBackground] = useState(null);
  const abortControllerRef = useRef(null);
  const [creditLimits, setCreditLimits] = useState(null);
  const { hasLiked, setHasLiked, likeEntity, unlikeEntity } = useLikeEntity({ sessionToken, setLikes });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showShareScreenshot, setShowShareScreenshot] = useState(false);
  const [selectedMessagesForShare, setSelectedMessagesForShare] = useState([]);
  const [showShareCharacter, setShowShareCharacter] = useState(false);
  const selectedChatRef = useRef(null);
  const [selectedChat, setSelectedChatState] = useState(null);
  const setSelectedChat = useCallback((update) => {
    const previous = selectedChatRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (Object.is(previous, next)) return;
    selectedChatRef.current = next;
    setSelectedChatState(next);
  }, []);
  const updateSelectedChatRef = useCallback((update) => {
    const previous = selectedChatRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    selectedChatRef.current = next;
    return next;
  }, []);
  const [editingChatId, setEditingChatId] = useState(null);
  const editingMessageIdRef = useRef(null);
  const editingMessageIdSetterRef = useRef(null);
  const setEditingMessageId = useCallback((nextValue) => {
    const value = typeof nextValue === 'function'
      ? nextValue(editingMessageIdRef.current)
      : nextValue;
    editingMessageIdRef.current = value;
    editingMessageIdSetterRef.current?.(value);
  }, []);
  // The draft lives inside the editing bubble (same pattern as the input box):
  // the page only keeps the current value in a ref so keystrokes never render
  // the page, and actions that need the text (save) read it from there.
  const editingMessageTextRef = useRef('');
  const editingMessageTextSetterRef = useRef(null);
  const setEditingMessageText = useCallback((nextValue) => {
    const value = typeof nextValue === 'function'
      ? nextValue(editingMessageTextRef.current)
      : nextValue;
    const text = typeof value === 'string' ? value : '';
    editingMessageTextRef.current = text;
    editingMessageTextSetterRef.current?.(text);
  }, []);
  const branchSelectionPendingRef = useRef(false);
  const branchSelectionPendingSetterRef = useRef(null);
  const setBranchSelectionPending = useCallback((nextValue) => {
    const value = typeof nextValue === 'function'
      ? nextValue(branchSelectionPendingRef.current)
      : nextValue;
    branchSelectionPendingRef.current = !!value;
    branchSelectionPendingSetterRef.current?.(!!value);
  }, []);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Ref for messages container to enable auto-scrolling
  const messagesEndRef = useRef(null);
  const revealMessageRef = useRef(null);
  // Reserved chat_id for a brand-new chat whose opening greeting is still
  // streaming. Lets a message sent mid-greeting reuse the same chat instead
  // of minting a second (orphaned) chat_id on the backend.
  const pendingChatIdRef = useRef(null);

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

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
    return {
      model,
      temperature: clamp(character.temperature, 0, 2, DEFAULT_ADVANCED_CHAT_CONFIG.temperature),
      top_p: clamp(character.top_p, 0, 1, DEFAULT_ADVANCED_CHAT_CONFIG.top_p),
      max_tokens: normalizeTokenTierValue(model, clamp(character.max_tokens, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue)),
      presence_penalty: clamp(character.presence_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty),
      frequency_penalty: clamp(character.frequency_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty),
      interface_preference: character.interface_preference === 'clean' ? 'clean' : 'bubbles',
      // Defaults to on, so anything other than an explicit `false` (null from an
      // older API response, undefined from a stale draft) means enabled.
      time_awareness: character.time_awareness !== false,
    };
  };
  const [advancedChatConfig, setAdvancedChatConfig] = useState(DEFAULT_ADVANCED_CHAT_CONFIG);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

  // Mobile breakpoint tracking + the one-off mobile "chat settings" hint.
  const isMobile = useIsMobile();
  const { showChatSettingsHint, hideChatSettingsHint } = useChatSettingsHint(isMobile);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const draftKeys = getChatDraftStorageKeys({
    userId: userData?.id,
    chatId: selectedChat?.chat_id,
    characterId: selectedChat?.character_id || characterId || searchParams.get('character') || selectedCharacter?.id,
    sceneId: selectedChat?.scene_id || sceneId || searchParams.get('scene') || selectedScene?.id,
    personaId: selectedChat?.persona_id || selectedPersona?.id,
  });

  const selectedWallpaper = useMemo(() => getSelectedWallpaper(wallpaper), [wallpaper]);

  useEffect(() => {
    if (!userData) return;

    applyCreditLimits({
      plan: userData.is_pro ? 'pro' : 'free',
      cap_scope: userData.credit_cap_scope,
      credit_cap: userData.credit_cap,
      used_credits: Number(userData.used_credits || 0),
      remaining_credits: userData.remaining_credits,
      cap_reached: !!userData.credit_cap_reached,
      daily_credit_usage: Number(userData.daily_credit_usage || 0),
      monthly_credit_usage: Number(userData.monthly_credit_usage || 0),
      monthly_cap_reached: !!userData.monthly_cap_reached,
      broke: !!userData.broke,
      free_daily_cap_reached: !!userData.free_daily_cap_reached,
      next_free_daily_reset_at: userData.next_free_daily_reset_at,
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

  const {
    applyChatLimits: applyChatLimitsToast,
    applyCreditLimits: applyCreditLimitsToast,
  } = useCreditAndChatLimits();

  const applyChatLimits = (limits) => {
    if (!limits) return;
    applyChatLimitsToast(limits);
  };

  const applyCreditLimits = (limits) => {
    if (!limits) return;
    setCreditLimits(limits);
    applyCreditLimitsToast(limits);
  };

  const buildSystemPromptMessage = useCallback((character = selectedCharacter, scene = selectedScene, persona = selectedPersona) => ({
    role: 'system',
    content: buildSystemMessage(
      character?.name || '',
      character?.description || '',
      character?.example_messages || '',
      persona?.description || null,
      persona?.name || null,
      scene?.description || null
    )
  }), [selectedCharacter, selectedScene, selectedPersona]);

  const buildDisplayMessagesForChat = useCallback((chatEntry, character = selectedCharacter, scene = selectedScene, persona = selectedPersona) => {
    const normalizedChat = normalizeChatEntry(chatEntry);
    if (!normalizedChat) return [];
    const sys = buildSystemPromptMessage(character, scene, persona);
    const branchMessages = Array.isArray(normalizedChat.messages) ? normalizedChat.messages : [];
    const nonSystemMessages = branchMessages.filter((m) => m?.role !== 'system');
    return ensureMessageIds([sys, ...nonSystemMessages]);
  }, [buildSystemPromptMessage]);

  const upsertChatHistoryEntryLocally = useCallback((rawChatEntry, { selectChat = true } = {}) => {
    const nextChatEntry = normalizeChatEntry(rawChatEntry);
    if (!nextChatEntry) return null;

    if (selectChat) {
      setSelectedChat(nextChatEntry);
    }

    const nextChatMetadata = toChatHistoryMetadata(nextChatEntry);
    setUserData((prev) => {
      if (!prev) return prev;
      const previousHistory = Array.isArray(prev.chat_history) ? prev.chat_history : [];
      const filtered = previousHistory.filter((entry) => entry?.chat_id !== nextChatEntry.chat_id);
      return {
        ...prev,
        chat_history: [nextChatMetadata, ...filtered],
      };
    });

    return nextChatEntry;
  }, [setSelectedChat, setUserData]);

  const syncChatEntryAfterTurn = ({
    metadata,
    messages: turnMessages,
    assistantMessage,
  }) => {
    const branchMetadata = metadata?.branch;
    if (!metadata?.chat_id || !branchMetadata?.branch_id) return;

    const currentChat = selectedChatRef.current;
    const activeChat = currentChat?.chat_id === metadata.chat_id
      ? currentChat
      : null;
    const existingEntry = normalizeChatEntry(activeChat || {
      ...metadata,
      branches: [{ ...branchMetadata, messages: [] }],
    });
    const savedMessages = (Array.isArray(turnMessages) ? turnMessages : []).filter((message) => (
      message?.role === 'user' || message?.role === 'assistant'
    ));
    const branchMessages = [...savedMessages, assistantMessage];
    let branchUpdated = false;
    const branches = existingEntry.branches.map((branch) => {
      if (branch.branch_id !== branchMetadata.branch_id) return branch;
      branchUpdated = true;
      // A turn appends at the tail, so the scrollback cursor of an existing
      // branch does not move; spreading `branch` first keeps it.
      return { ...branch, ...branchMetadata, messages: branchMessages };
    });
    if (!branchUpdated) {
      // A fresh branch inherits the stored prefix, which is longer than the tail
      // window the client sent: `message_count` from the server counts it, so the
      // difference is what still has to be fetched before rendering from the top.
      const branchMessageCount = Number.isFinite(branchMetadata.message_count)
        ? branchMetadata.message_count
        : branchMessages.length;
      const oldestSeq = Math.max(0, branchMessageCount - branchMessages.length);
      branches.push({
        ...branchMetadata,
        messages: branchMessages,
        oldest_seq: oldestSeq,
        has_more: oldestSeq > 0,
      });
    }

    upsertChatHistoryEntryLocally({
      ...existingEntry,
      ...metadata,
      branches,
      active_branch_id: metadata.active_branch_id,
    });
  };

  const saveUserCharacterConfig = useCallback(async () => {
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
  }, [advancedChatConfig, characterId, sessionToken, toast]);

  const { handleTogglePin } = usePinnedMemories({
    selectedChatRef,
    updateSelectedChatRef,
    chatState,
    sessionToken,
  });

  const { loadOlderMessages, ensureMessageLoaded, hasOlderMessages } = useChatHistoryPaging({
    sessionToken,
    selectedChatRef,
    setSelectedChat,
    chatState,
    toast,
  });

  const jumpToMessage = useCallback(async (messageId) => {
    if (!messageId) return;
    // Pinned memories can sit above the loaded window: page back until the
    // message is part of the transcript before scrolling to it.
    const loaded = await ensureMessageLoaded(messageId);
    if (loaded) await waitForNextPaint();
    let target = loaded ? document.getElementById(`message-${messageId}`) : null;
    if (loaded && !target) {
      // Loaded but outside the rendered window: ask the list to widen it.
      revealMessageRef.current?.(messageId);
      await waitForNextPaint();
      target = document.getElementById(`message-${messageId}`);
    }
    if (!target) {
      toast.show('该消息尚未加载，请先加载更早的消息。', { type: 'info' });
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'box-shadow 0.2s ease';
    target.style.boxShadow = '0 0 0 2px rgba(24,25,26,0.25)';
    window.setTimeout(() => {
      target.style.boxShadow = 'none';
    }, 1100);
  }, [ensureMessageLoaded, toast]);

  // ---- Streaming send pipeline ----
  // Owns the abort controller, the SSE reader and the generation-token guard
  // that discards events from superseded turns.
  const { sendChatTurn: sendChatTurnImplementation, handleSend: handleSendImplementation } = useChatSend({
    sessionToken,
    toast,
    refreshUserData,
    chatState,
    inputRef,
    setInput,
    draftStorageKey: draftKeys.activeKey,
    selectedChatRef,
    selectedCharacter,
    selectedScene,
    selectedPersona,
    characterId,
    advancedChatConfig,
    creditLimits,
    abortControllerRef,
    pendingChatIdRef,
    applyChatLimits,
    applyCreditLimits,
    syncChatEntryAfterTurn,
  });

  const sendChatTurnRef = useRef(sendChatTurnImplementation);
  sendChatTurnRef.current = sendChatTurnImplementation;
  const sendChatTurn = useCallback((options) => sendChatTurnRef.current(options), []);
  const handleSendRef = useRef(handleSendImplementation);
  handleSendRef.current = handleSendImplementation;
  const handleSendMessage = useCallback((event) => handleSendRef.current(event), []);

  const handleAbortSend = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ---- Message editing, forking and branch switching ----
  const {
    handleStartEditingMessage,
    handleCancelEditingMessage,
    handleResendMessage,
    handleSaveEditedMessage,
    handleSelectBranch,
    handleCopyMessage,
  } = useMessageEditing({
    chatState,
    selectedChatRef,
    updateSelectedChatRef,
    selectedCharacter,
    sessionToken,
    toast,
    editingMessageIdRef,
    editingMessageTextRef,
    setEditingMessageId,
    setEditingMessageText,
    branchSelectionPendingRef,
    setBranchSelectionPending,
    sendChatTurn,
    buildDisplayMessagesForChat,
  });

  // ---- Entry / greeting / chat loading ----
  const {
    initLoading,
    advancedChatConfirm,
    initializeChat,
    loadChat,
    handleNewChat,
    handleAdvancedChatConfirm,
    handleAdvancedChatExit,
    startChatFromSceneSelection,
  } = useChatInitialization({
    searchParams,
    navigate,
    loading,
    sessionToken,
    userData,
    characterId,
    setCharacterId,
    sceneId,
    setSceneId,
    selectedCharacter,
    setSelectedCharacter,
    selectedScene,
    setSelectedScene,
    selectedPersona,
    setSelectedPersona,
    setSelectedChat,
    setMessages,
    setInput,
    setServerContextWindowUsage,
    setLikes,
    setHasLiked,
    setAdvancedChatConfig,
    normalizeAdvancedChatConfig,
    applyCharacterBackground,
    isProUser,
    setInitModal,
    setShowChatHistory,
    setEditingMessageId,
    setEditingMessageText,
    isNewChat,
    initialized,
    pendingChatIdRef,
    sendChatTurn,
    buildSystemPromptMessage,
    buildDisplayMessagesForChat,
    upsertChatHistoryEntryLocally,
    toast,
  });

  const handleImportChat = useCallback(async (file) => {
    if (!file.name.toLowerCase().endsWith('.jsonl')) {
      toast.show('仅支持导入 .jsonl 格式的对话文件。', { type: 'error' });
      return;
    }

    if (!selectedCharacter?.id || !sessionToken) {
      toast.show('请先选择角色后再导入对话。', { type: 'error' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('character_id', String(selectedCharacter.id));

      const response = await fetch(`${window.API_BASE_URL}/api/chat/import`, {
        method: 'POST',
        headers: { Authorization: sessionToken },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || result.error || '导入对话失败，请检查 JSONL 文件后重试。');
      }

      const importedChat = normalizeChatEntry(result);
      if (!importedChat) {
        throw new Error('导入成功，但服务器返回的对话数据无效。');
      }

      const activeChat = upsertChatHistoryEntryLocally(importedChat);
      setMessages(buildDisplayMessagesForChat(activeChat, selectedCharacter, null, null));
      pendingChatIdRef.current = null;
      isNewChat.current = false;
      setShowChatHistory(true);
      toast.show('对话导入成功。', { type: 'success' });
    } catch (error) {
      console.error('Error importing chat:', error);
      toast.show(error.message || '导入对话失败，请重试。', { type: 'error' });
    }
  }, [
    buildDisplayMessagesForChat,
    isNewChat,
    pendingChatIdRef,
    selectedCharacter,
    sessionToken,
    setMessages,
    setShowChatHistory,
    toast,
    upsertChatHistoryEntryLocally,
  ]);

  // ---- Chat history actions (rename / delete + confirm modal state) ----
  const {
    confirmModal,
    setConfirmModal,
    handleRename,
    handleDelete,
    handleDeleteConfirmed,
  } = useChatHistoryActions({
    sessionToken,
    userData,
    setUserData,
    selectedChatRef,
    setSelectedChat,
    refreshUserData,
    handleNewChat,
    newTitle,
    setNewTitle,
    editingChatId,
    setEditingChatId,
  });

  // Message bodies are rendered by the shared markdown renderer, which the
  // share card uses too — see `components/MarkdownMessage.jsx`. Keeping the
  // `(text, role)` signature means the memoized `MessageBubble` prop is passed
  // exactly as before.
  const renderMessageContent = useCallback((text, role) => <MarkdownMessage content={text} role={role} />, []);
  const handleShareSelection = useCallback((selectedMessages) => {
    setSelectedMessagesForShare(selectedMessages);
    setShowShareScreenshot(true);
  }, []);

  const activeChatBranches = useMemo(() => normalizeChatEntry(selectedChat)?.branches || [], [selectedChat]);

  // Pinned memories live in the branch payload and may sit far above the loaded
  // window, so they are mirrored into the runtime store for the memory manager.
  // The branch payload is frequently swapped through `selectedChatRef` without a
  // page render (branch switch, fork), so the mirror also follows the transcript.
  useEffect(() => {
    const syncPinnedMessages = () => {
      const normalized = normalizeChatEntry(selectedChatRef.current);
      const branch = normalized
        ? normalized.branches.find(
          (candidate) => candidate.branch_id === normalized.active_branch_id,
        ) || normalized.branches[0] || null
        : null;
      const nextPinnedMessages = (branch?.pinned_messages || []).slice(0, MAX_PINNED_MEMORIES);
      const currentPinnedMessages = chatState.get('storedPinnedMessages');
      const unchanged = Array.isArray(currentPinnedMessages)
        && currentPinnedMessages.length === nextPinnedMessages.length
        && nextPinnedMessages.every(
          (message, index) => message?.message_id === currentPinnedMessages[index]?.message_id,
        );
      if (unchanged) return;
      chatState.set('storedPinnedMessages', nextPinnedMessages);
    };

    syncPinnedMessages();
    return chatState.subscribe('messages', syncPinnedMessages);
  }, [chatState]);

  // Centered content rail — keeps messages, avatars and input fixed-width and centered
  // regardless of sidebar toggle state. Baseline when both sidebars are open:
  // left nav + character sidebar + message area side-padding on each side.
  const chatContentRailStyle = useMemo(() => ({
    width: '100%',
    maxWidth: isMobile
      ? '100%'
      : characterSidebarVisible
        ? `min(calc(100vw - ${NAV_WIDTH} - ${SIDEBAR_WIDTH} - ${CHAT_CONTENT_PADDING} - ${CHAT_CONTENT_PADDING}), 100%)`
        : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
  }), [characterSidebarVisible, isMobile]);
  const handleResetAdvancedChatConfig = useCallback(() => {
    setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter));
  }, [selectedCharacter]);
  const handleUnpinMemory = useCallback((messageId) => {
    return handleTogglePin(messageId, false);
  }, [handleTogglePin]);
  const handleOpenPersonaModal = useCallback(() => {
    setPersonaModal({ show: true });
  }, []);
  const handleOpenCharacterShare = useCallback(() => {
    setShowShareCharacter(true);
  }, []);

  // Initialization gate: until the entry data (character/scene/persona) for
  // this chat has been fetched, show a standard centered spinner instead of a
  // partially-loaded chat UI.
  if (initLoading) {
    return (
      <PageWrapper>
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ height: '100%', width: '100%', background: '#fff' }}
        >
          <div className="spinner-border text-primary" role="status" style={{ width: 40, height: 40 }}>
            <span className="visually-hidden">加载中...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Show welcome for the full lifetime of a new chat so it scrolls with the conversation.
  const showWelcome = isNewChat.current;

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
      {!characterSidebarVisible && (
        <SidebarToggleButton
          showHint={showChatSettingsHint}
          isMobile={isMobile}
          characterSidebarVisible={characterSidebarVisible}
          onToggle={() => {
            hideChatSettingsHint();
            onToggleCharacterSidebar();
          }}
        />
      )}
      {/* Main Chat Area */}
      <div style={{ 
        flex: 1, 
        minWidth: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0, 
        zIndex: 1,
        // One shorthand on purpose: a gradient lives in `background-image`, so
        // pairing a `background` shorthand with a separate `backgroundImage:
        // 'none'` would wipe the gradient for every preset.
        background: selectedWallpaper?.url
          ? `#fff url(${selectedWallpaper.url}) center/cover no-repeat`
          : (selectedWallpaper?.css || '#fff'),
        borderRadius: 0,
        margin: 0,
        boxShadow: 'none',
        overflow: 'hidden', 
        height: 'auto',
        }}>
        <ChatConversationArea
          chatId={selectedChat?.chat_id}
          activeBranchId={selectedChat?.active_branch_id}
          chatContentRailStyle={chatContentRailStyle}
          selectedWallpaper={selectedWallpaper}
          chatState={chatState}
          showWelcome={showWelcome}
          selectedCharacter={selectedCharacter}
          selectedScene={selectedScene}
          selectedPersona={selectedPersona}
          userProfilePicture={userData?.profile_pic}
          userBanType={userData?.ban_type}
          userBanUntil={userData?.ban_until}
          isMobile={isMobile}
          cleanMode={advancedChatConfig?.interface_preference === 'clean'}
          timestampGapSeconds={selectedChat?.timestamp_gap_seconds}
          branches={activeChatBranches}
          editingMessageIdRef={editingMessageIdRef}
          editingMessageIdSetterRef={editingMessageIdSetterRef}
          editingMessageTextRef={editingMessageTextRef}
          editingMessageTextSetterRef={editingMessageTextSetterRef}
          branchSelectionPendingRef={branchSelectionPendingRef}
          branchSelectionPendingSetterRef={branchSelectionPendingSetterRef}
          renderMessageContent={renderMessageContent}
          messagesEndRef={messagesEndRef}
          revealMessageRef={revealMessageRef}
          hasOlderMessages={hasOlderMessages}
          onLoadOlderMessages={loadOlderMessages}
          onTogglePin={handleTogglePin}
          onCopyMessage={handleCopyMessage}
          onCancelEditing={handleCancelEditingMessage}
          onSaveEditedMessage={handleSaveEditedMessage}
          onResendMessage={handleResendMessage}
          onStartEditing={handleStartEditingMessage}
          onSelectBranch={handleSelectBranch}
          creditLimits={creditLimits}
          advancedChatConfig={advancedChatConfig}
          sessionToken={sessionToken}
          toast={toast}
          draftStorageKey={draftKeys.activeKey}
          draftFallbackKey={draftKeys.fallbackKey}
          inputRef={inputRef}
          inputSetterRef={inputSetterRef}
          onSend={handleSendMessage}
          onAbort={handleAbortSend}
          onShareSelection={handleShareSelection}
        />
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
        onImportChat={handleImportChat}
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
        onResetAdvancedChatConfig={handleResetAdvancedChatConfig}
        onSaveAdvancedChatConfig={saveUserCharacterConfig}
        wallpaper={wallpaper}
        onSetWallpaper={setWallpaper}
        characterPicture={selectedCharacter?.picture}
        characterBackground={characterBackground}
        chatState={chatState}
        maxPinnedMemories={MAX_PINNED_MEMORIES}
        onJumpToPinnedMemory={jumpToMessage}
        onUnpinMemory={handleUnpinMemory}
        isMobile={isMobile}
        setPersonaModalShow={handleOpenPersonaModal}
        onOpenCharacterShare={handleOpenCharacterShare}
      />
    </div>

      <ChatModals
        initModal={initModal}
        initLoading={initLoading}
        selectedScene={selectedScene}
        selectedCharacter={selectedCharacter}
        setSelectedCharacter={setSelectedCharacter}
        startChatFromSceneSelection={startChatFromSceneSelection}
        initialized={initialized}
        navigate={navigate}
        setInitModal={setInitModal}
        isMobile={isMobile}
        characterModal={characterModal}
        setCharacterModal={setCharacterModal}
        setCharacterId={setCharacterId}
        personaModal={personaModal}
        setPersonaModal={setPersonaModal}
        setSelectedPersona={setSelectedPersona}
        sessionToken={sessionToken}
        refreshUserData={refreshUserData}
        userData={userData}
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
        handleDeleteConfirmed={handleDeleteConfirmed}
        advancedChatConfirm={advancedChatConfirm}
        handleAdvancedChatConfirm={handleAdvancedChatConfirm}
        handleAdvancedChatExit={handleAdvancedChatExit}
      />

      <ShareScreenshotDialog
        show={showShareScreenshot}
        onClose={() => setShowShareScreenshot(false)}
        messages={selectedMessagesForShare}
        character={selectedCharacter}
        scene={selectedScene}
        persona={selectedPersona}
        userData={userData}
        wallpaperUrl={selectedWallpaper?.url || null}
        wallpaperId={wallpaper.id}
        interfacePreference={advancedChatConfig?.interface_preference}
      />

      {/* Shares the entity itself as a card — the replacement for the old
          "copy chat link" action. A scene wins over its character, matching how
          the chat's own title and share payload resolve the entity. */}
      <ShareCharacterDialog
        show={showShareCharacter}
        onClose={() => setShowShareCharacter(false)}
        entity={selectedScene || selectedCharacter}
        type={selectedScene ? 'scene' : 'character'}
        id={(selectedScene || selectedCharacter)?.id}
      />
    </PageWrapper>
  );
}