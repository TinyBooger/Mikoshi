import React, { useCallback, useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import MarkdownMessage from '../components/MarkdownMessage';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import CharacterSidebar from '../components/CharacterSidebar';
import PageWrapper from '../components/PageWrapper';
import SidebarToggleButton from '../components/chat/SidebarToggleButton';
import ChatMessagesList from '../components/chat/ChatMessagesList';
import ChatInputBar from '../components/chat/ChatInputBar';
import ChatSelectionActionBar from '../components/chat/ChatSelectionActionBar';
import ChatModals from '../components/chat/ChatModals';
import ShareScreenshotDialog from '../components/share/ShareScreenshotDialog';
import ShareCharacterDialog from '../components/share/ShareCharacterDialog';
import { useToast } from '../components/ToastProvider';
import {
  normalizeChatEntry,
  computeForkNav,
  getMessagePreview,
  ensureMessageIds,
  MAX_PINNED_MEMORIES,
} from '../utils/chatHelpers';
import { MAX_SHARE_MESSAGES } from '../utils/shareData';
import {
  SUMMARY_PREFIX,
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
import { useCreditAndChatLimits } from '../hooks/useCreditAndChatLimits';
import { usePinnedMemories } from '../hooks/usePinnedMemories';
import { useIsMobile } from '../hooks/useIsMobile';
import { useChatSettingsHint } from '../hooks/useChatSettingsHint';
import { useChatSend } from '../hooks/useChatSend';
import { useMessageEditing } from '../hooks/useMessageEditing';
import { useChatInitialization } from '../hooks/useChatInitialization';
import { useChatHistoryActions } from '../hooks/useChatHistoryActions';
import { useContextWindowUsage } from '../hooks/useContextWindowUsage';
import { useLikeEntity } from '../hooks/useLikeEntity';
import { NAV_WIDTH, SIDEBAR_WIDTH, CHAT_CONTENT_PADDING } from '../constants/layout';

export default function ChatPage() {
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const isProUser = !!userData?.is_pro;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const inputRef = useRef('');
  const inputSetterRef = useRef(null);
  const setInput = useCallback((nextInput) => {
    const value = typeof nextInput === 'function' ? nextInput(inputRef.current) : nextInput;
    inputRef.current = value;
    inputSetterRef.current?.(value);
  }, []);
  const [wallpaper, setWallpaper] = useState({ id: 'none', url: null });
  const [characterBackground, setCharacterBackground] = useState(null);
  const [sending, setSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [chatLimits, setChatLimits] = useState(null);
  const [creditLimits, setCreditLimits] = useState(null);
  const [serverContextWindowUsage, setServerContextWindowUsage] = useState(null);
  const { hasLiked, setHasLiked, likeEntity, unlikeEntity } = useLikeEntity({ sessionToken, setLikes });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showShareScreenshot, setShowShareScreenshot] = useState(false);
  const [showShareCharacter, setShowShareCharacter] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [branchSelectionPending, setBranchSelectionPending] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [bulkPinning, setBulkPinning] = useState(false);

  // Ref for messages container to enable auto-scrolling
  const messagesEndRef = useRef(null);
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

  useEffect(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  }, [selectedChat?.chat_id, selectedChat?.active_branch_id]);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

  // Mobile breakpoint tracking + the one-off mobile "chat settings" hint.
  const isMobile = useIsMobile();
  const { showChatSettingsHint, hideChatSettingsHint } = useChatSettingsHint(isMobile);

  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const draftKeys = getChatDraftStorageKeys({
    userId: userData?.id,
    chatId: selectedChat?.chat_id,
    characterId: selectedChat?.character_id || characterId || searchParams.get('character') || selectedCharacter?.id,
    sceneId: selectedChat?.scene_id || sceneId || searchParams.get('scene') || selectedScene?.id,
    personaId: selectedChat?.persona_id || selectedPersona?.id,
  });

  const selectedWallpaper = getSelectedWallpaper(wallpaper);

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

  const buildSystemPromptMessage = (character = selectedCharacter, scene = selectedScene, persona = selectedPersona) => ({
    role: 'system',
    content: buildSystemMessage(
      character?.name || '',
      character?.description || '',
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

  const syncChatEntryAfterTurn = ({
    metadata,
    messages: turnMessages,
    assistantMessage,
    contextSummaryUpdated,
  }) => {
    const branchMetadata = metadata?.branch;
    if (!metadata?.chat_id || !branchMetadata?.branch_id) return;

    const cachedEntry = selectedChat?.chat_id === metadata.chat_id
      ? selectedChat
      : userData?.chat_history?.find((entry) => entry?.chat_id === metadata.chat_id);
    const existingEntry = normalizeChatEntry(cachedEntry || {
      ...metadata,
      branches: [{ ...branchMetadata, messages: [] }],
    });
    const summaryPrefix = SUMMARY_PREFIX;
    const savedMessages = (Array.isArray(turnMessages) ? turnMessages : []).filter((message) => (
      message?.role === 'user'
      || message?.role === 'assistant'
      || (
        !contextSummaryUpdated
        && message?.role === 'system'
        && typeof message?.content === 'string'
        && message.content.trim().startsWith(summaryPrefix)
      )
    ));
    const branchMessages = [...savedMessages, assistantMessage];
    let branchUpdated = false;
    const branches = existingEntry.branches.map((branch) => {
      if (branch.branch_id !== branchMetadata.branch_id) return branch;
      branchUpdated = true;
      return { ...branch, ...branchMetadata, messages: branchMessages };
    });
    if (!branchUpdated) {
      branches.push({ ...branchMetadata, messages: branchMessages });
    }

    upsertChatHistoryEntryLocally({
      ...existingEntry,
      ...metadata,
      branches,
      active_branch_id: metadata.active_branch_id,
      active_context_summary: metadata.active_context_summary,
    });
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

  const {
    contextWindowUsage,
    contextUsagePercent,
    pieRadius,
    pieCircumference,
    pieStrokeOffset,
  } = useContextWindowUsage({ messages, advancedChatConfig, serverContextWindowUsage });

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

  // ---- Streaming send pipeline ----
  // Owns the abort controller, the SSE reader and the generation-token guard
  // that discards events from superseded turns.
  const { sendChatTurn, handleSend } = useChatSend({
    sessionToken,
    toast,
    refreshUserData,
    messages,
    setMessages,
    inputRef,
    setInput,
    draftStorageKey: draftKeys.activeKey,
    selectedChat,
    selectedCharacter,
    selectedScene,
    selectedPersona,
    characterId,
    advancedChatConfig,
    creditLimits,
    sending,
    setSending,
    setIsStreaming,
    abortController,
    setAbortController,
    pendingChatIdRef,
    applyChatLimits,
    applyCreditLimits,
    syncChatEntryAfterTurn,
    setServerContextWindowUsage,
  });

  const handleSendMessage = async (event) => {
    event.preventDefault();
    await handleSend(event);
  };

  // ---- Message editing, forking and branch switching ----
  const {
    handleStartEditingMessage,
    handleCancelEditingMessage,
    handleResendMessage,
    handleSaveEditedMessage,
    handleSelectBranch,
    handleCopyMessage,
  } = useMessageEditing({
    messages,
    setMessages,
    selectedChat,
    setSelectedChat,
    selectedCharacter,
    sending,
    sessionToken,
    toast,
    editingMessageId,
    editingMessageText,
    setEditingMessageId,
    setEditingMessageText,
    branchSelectionPending,
    setBranchSelectionPending,
    sendChatTurn,
    buildDisplayMessagesForChat,
    upsertChatHistoryEntryLocally,
  });

  const selectableMessages = messages.filter((message) =>
    message?.message_id
    && (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string'
    && message.content.trim()
  );
  const selectedMessages = selectableMessages.filter((message) =>
    selectedMessageIds.includes(message.message_id)
  );
  const selectedUnpinnedMessages = selectedMessages.filter((message) => !message.is_pinned);
  const pinnedMessageCount = messages.filter((message) =>
    message?.role !== 'system' && message?.is_pinned
  ).length;
  const allSelectedMessagesPinned = selectedMessages.length > 0
    && selectedMessages.every((message) => message.is_pinned);
  const pinWouldExceedLimit = !allSelectedMessagesPinned
    && pinnedMessageCount + selectedUnpinnedMessages.length > MAX_PINNED_MEMORIES;

  const handleStartMultiSelect = (messageId) => {
    if (!messageId) return;
    if (editingMessageId) handleCancelEditingMessage();
    setSelectionMode(true);
    setSelectedMessageIds([messageId]);
  };

  const handleToggleMessageSelection = (messageId) => {
    setSelectedMessageIds((previous) => {
      if (previous.includes(messageId)) return previous.filter((id) => id !== messageId);
      if (previous.length >= MAX_SHARE_MESSAGES) {
        toast.show(`最多可选择 ${MAX_SHARE_MESSAGES} 条消息分享。`, { type: 'info' });
        return previous;
      }
      return [...previous, messageId];
    });
  };

  const handleCopySelectedMessages = () => {
    const text = selectedMessages.map((message) => message.content.trim()).join('\n\n');
    if (text) handleCopyMessage({ content: text });
  };

  const handlePinSelectedMessages = async () => {
    if (!selectedMessages.length || bulkPinning) return;
    if (!selectedChat?.chat_id) {
      toast.show('请先发送一条消息保存对话，再固定记忆。', { type: 'warning' });
      return;
    }
    if (pinWouldExceedLimit) {
      toast.show(`每个对话最多可固定 ${MAX_PINNED_MEMORIES} 条记忆。`, { type: 'warning' });
      return;
    }

    const nextPinnedState = allSelectedMessagesPinned ? false : true;
    const messagesToUpdate = allSelectedMessagesPinned ? selectedMessages : selectedUnpinnedMessages;
    setBulkPinning(true);
    try {
      for (const message of messagesToUpdate) {
        await handleTogglePin(message.message_id, nextPinnedState, { silentSuccess: true });
      }
    } finally {
      setBulkPinning(false);
    }
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  };

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

  const handleImportChat = async (file) => {
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
      refreshUserData({ silent: true });
      toast.show('对话导入成功。', { type: 'success' });
    } catch (error) {
      console.error('Error importing chat:', error);
      toast.show(error.message || '导入对话失败，请重试。', { type: 'error' });
    }
  };

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
    selectedChat,
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
  const renderMessageContent = (text, role) => <MarkdownMessage content={text} role={role} />;

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

  // Centered content rail — keeps messages, avatars and input fixed-width and centered
  // regardless of sidebar toggle state. Baseline when both sidebars are open:
  // left nav + character sidebar + message area side-padding on each side.
  const chatContentRailStyle = {
    width: '100%',
    maxWidth: isMobile
      ? '100%'
      : characterSidebarVisible
        ? `min(calc(100vw - ${NAV_WIDTH} - ${SIDEBAR_WIDTH} - ${CHAT_CONTENT_PADDING} - ${CHAT_CONTENT_PADDING}), 100%)`
        : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
  };

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
        <ChatMessagesList
          chatContentRailStyle={chatContentRailStyle}
          selectedWallpaper={selectedWallpaper}
          messages={messages}
          showWelcome={showWelcome}
          serverContextWindowUsage={serverContextWindowUsage}
          selectedCharacter={selectedCharacter}
          selectedScene={selectedScene}
          selectedPersona={selectedPersona}
          userData={userData}
          isMobile={isMobile}
          cleanMode={advancedChatConfig?.interface_preference === 'clean'}
          timestampGapSeconds={selectedChat?.timestamp_gap_seconds}
          editingMessageId={editingMessageId}
          editingMessageText={editingMessageText}
          hoveredMessageId={hoveredMessageId}
          forkNavMap={forkNavMap}
          branchSelectionPending={branchSelectionPending}
          sending={sending}
          renderMessageContent={renderMessageContent}
          messagesEndRef={messagesEndRef}
          onHoverMessage={setHoveredMessageId}
          onTogglePin={handleTogglePin}
          onCopyMessage={handleCopyMessage}
          selectionMode={selectionMode}
          selectedMessageIds={selectedMessageIds}
          onStartMultiSelect={handleStartMultiSelect}
          onToggleSelection={handleToggleMessageSelection}
          onCancelEditing={handleCancelEditingMessage}
          onSaveEditedMessage={handleSaveEditedMessage}
          onResendMessage={handleResendMessage}
          onStartEditing={handleStartEditingMessage}
          onSelectBranch={handleSelectBranch}
          onEditTextChange={setEditingMessageText}
        />

        {selectionMode ? (
          <ChatSelectionActionBar
            selectedCount={selectedMessages.length}
            pinLabel={allSelectedMessagesPinned ? '取消固定' : '固定'}
            pinDisabled={bulkPinning || pinWouldExceedLimit || !selectedChat?.chat_id}
            busy={bulkPinning}
            selectedWallpaper={selectedWallpaper}
            isMobile={isMobile}
            chatContentRailStyle={chatContentRailStyle}
            onCopy={handleCopySelectedMessages}
            onPin={handlePinSelectedMessages}
            onShare={() => setShowShareScreenshot(true)}
            onCancel={handleExitSelectionMode}
          />
        ) : (
          <ChatInputBar
            selectedWallpaper={selectedWallpaper}
            isMobile={isMobile}
            chatContentRailStyle={chatContentRailStyle}
            userData={userData}
            creditLimits={creditLimits}
            contextWindowUsage={contextWindowUsage}
            serverContextWindowUsage={serverContextWindowUsage}
            contextUsagePercent={contextUsagePercent}
            pieRadius={pieRadius}
            pieCircumference={pieCircumference}
            pieStrokeOffset={pieStrokeOffset}
            sessionToken={sessionToken}
            toast={toast}
            draftStorageKey={draftKeys.activeKey}
            draftFallbackKey={draftKeys.fallbackKey}
            inputRef={inputRef}
            inputSetterRef={inputSetterRef}
            onSend={handleSendMessage}
            isStreaming={isStreaming}
            sending={sending}
            onAbort={() => {
              if (abortController) {
                abortController.abort();
              }
            }}
          />
        )}
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
        onResetAdvancedChatConfig={() => setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter))}
        onSaveAdvancedChatConfig={saveUserCharacterConfig}
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
        onOpenCharacterShare={() => setShowShareCharacter(true)}
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
        messages={selectedMessages}
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