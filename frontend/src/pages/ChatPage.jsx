import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import ReactMarkdown from 'react-markdown';
import { buildSystemMessage } from '../utils/systemTemplate';
import '../styles/ChatBubble.css';
import { AuthContext } from '../components/AuthProvider';
import CharacterSidebar from '../components/CharacterSidebar';
import PageWrapper from '../components/PageWrapper';
import SidebarToggleButton from '../components/chat/SidebarToggleButton';
import ChatMessagesList from '../components/chat/ChatMessagesList';
import ChatInputBar from '../components/chat/ChatInputBar';
import ChatModals from '../components/chat/ChatModals';
import ShareScreenshotDialog from '../components/share/ShareScreenshotDialog';
import { useToast } from '../components/ToastProvider';
import {
  normalizeChatEntry,
  computeForkNav,
  getMessagePreview,
  ensureMessageIds,
  MAX_PINNED_MEMORIES,
} from '../utils/chatHelpers';
import {
  REMARK_PLUGINS,
  REHYPE_PLUGINS,
  MARKDOWN_COMPONENTS,
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
import { useCreditAndChatLimits } from '../hooks/useCreditAndChatLimits';
import { usePinnedMemories } from '../hooks/usePinnedMemories';
import { useIsMobile } from '../hooks/useIsMobile';
import { useChatSettingsHint } from '../hooks/useChatSettingsHint';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { useChatSend } from '../hooks/useChatSend';
import { useMessageEditing } from '../hooks/useMessageEditing';
import { useChatInitialization } from '../hooks/useChatInitialization';
import { useChatHistoryActions } from '../hooks/useChatHistoryActions';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useContextWindowUsage } from '../hooks/useContextWindowUsage';
import { useLikeEntity } from '../hooks/useLikeEntity';
import { NAV_WIDTH, SIDEBAR_WIDTH, CHAT_CONTENT_PADDING } from '../constants/layout';

export default function ChatPage() {
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const canUseAdvancedChatConfig = !!userData?.is_pro;
  const isProUser = !!userData?.is_pro;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { isRecording, isTranscribing, handleVoiceToggle, closeVoiceConnection } = useVoiceInput({
    sessionToken,
    input,
    setInput,
    toast,
  });
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
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [branchSelectionPending, setBranchSelectionPending] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  // Ref for textarea auto-resize
  const textareaRef = useRef(null);
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
      temperature: canUseAdvancedChatConfig ? clamp(character.temperature, 0, 2, DEFAULT_ADVANCED_CHAT_CONFIG.temperature) : DEFAULT_ADVANCED_CHAT_CONFIG.temperature,
      top_p: canUseAdvancedChatConfig ? clamp(character.top_p, 0, 1, DEFAULT_ADVANCED_CHAT_CONFIG.top_p) : DEFAULT_ADVANCED_CHAT_CONFIG.top_p,
      max_tokens: canUseAdvancedChatConfig ? normalizeTokenTierValue(model, clamp(character.max_tokens, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue)) : tokenLimits.defaultValue,
      presence_penalty: canUseAdvancedChatConfig ? clamp(character.presence_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty) : DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty,
      frequency_penalty: canUseAdvancedChatConfig ? clamp(character.frequency_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty) : DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty,
      interface_preference: character.interface_preference === 'clean' ? 'clean' : 'bubbles',
    };
  };
  const [advancedChatConfig, setAdvancedChatConfig] = useState(DEFAULT_ADVANCED_CHAT_CONFIG);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

  // Mobile breakpoint tracking + the one-off mobile "chat settings" hint.
  const isMobile = useIsMobile();
  const { showChatSettingsHint, hideChatSettingsHint } = useChatSettingsHint(isMobile);

  // Cleanup: tear down the voice session and abort any ongoing streaming
  // request. This runs on unmount AND every time `abortController` changes —
  // the latter is deliberate (and pre-existing) so that starting or finishing
  // a turn also drops any voice websocket left behind by a finished
  // transcription. `closeVoiceConnection` is stable, so it is a safe dep.
  useEffect(() => {
    return () => {
      closeVoiceConnection();
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController, closeVoiceConnection]);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
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
    input,
    setInput,
    textareaRef,
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
    buildDisplayMessagesForChat,
    upsertChatHistoryEntryLocally,
    setServerContextWindowUsage,
  });

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
    setEditingMessageId,
    setEditingMessageText,
    branchSelectionPending,
    setBranchSelectionPending,
    sendChatTurn,
    buildDisplayMessagesForChat,
    upsertChatHistoryEntryLocally,
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

  // Textarea sizing: the effect inside the hook handles programmatic updates
  // (voice transcription), the returned handler handles typing.
  const { handleInputChange } = useAutoResizeTextarea({ textareaRef, input, setInput });

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

  // Parse message content as standard Markdown via react-markdown + GFM,
  // LaTeX math ($inline$ / $$display$$) and syntax-highlighted code fences.
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
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

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
          onCancelEditing={handleCancelEditingMessage}
          onSaveEditedMessage={handleSaveEditedMessage}
          onResendMessage={handleResendMessage}
          onStartEditing={handleStartEditingMessage}
          onSelectBranch={handleSelectBranch}
          onEditTextChange={setEditingMessageText}
        />

        <ChatInputBar
          handleSend={handleSend}
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
          input={input}
          handleInputChange={handleInputChange}
          handleKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          handleVoiceToggle={handleVoiceToggle}
          isStreaming={isStreaming}
          sending={sending}
          onAbort={() => {
            if (abortController) {
              abortController.abort();
            }
          }}
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
        onOpenShareScreenshot={() => setShowShareScreenshot(true)}
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
        messages={messages}
        character={selectedCharacter}
        scene={selectedScene}
        persona={selectedPersona}
        userData={userData}
        wallpaperUrl={selectedWallpaper?.url || null}
        wallpaperId={wallpaper.id}
        interfacePreference={advancedChatConfig?.interface_preference}
      />
    </PageWrapper>
  );
}