import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ChatInputBar from './ChatInputBar';
import ChatMessagesList from './ChatMessagesList';
import ChatSelectionActionBar from './ChatSelectionActionBar';
import { useToast } from '../ToastProvider';
import { useChatRuntimeValue } from '../../hooks/useChatRuntimeState';
import { computeForkNav, MAX_PINNED_MEMORIES } from '../../utils/chatHelpers';
import { MAX_SHARE_MESSAGES } from '../../utils/shareData';

const ChatSelectionControls = React.memo(function ChatSelectionControls({
  chatState,
  selectedMessageIds,
  selectedWallpaper,
  isMobile,
  chatContentRailStyle,
  chatId,
  onTogglePin,
  onCopyMessages,
  onShare,
  onCancel,
}) {
  const messages = useChatRuntimeValue(chatState, 'messages');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const selectedMessages = useMemo(() => {
    const selectedIds = new Set(selectedMessageIds);
    return messages.filter((message) => selectedIds.has(message?.message_id));
  }, [messages, selectedMessageIds]);
  const selectedUnpinnedMessages = useMemo(
    () => selectedMessages.filter((message) => !message.is_pinned),
    [selectedMessages],
  );
  const pinnedMessageCount = useMemo(
    () => messages.filter((message) => message?.role !== 'system' && message?.is_pinned).length,
    [messages],
  );
  const allSelectedMessagesPinned = selectedMessages.length > 0
    && selectedMessages.every((message) => message.is_pinned);
  const pinWouldExceedLimit = !allSelectedMessagesPinned
    && pinnedMessageCount + selectedUnpinnedMessages.length > MAX_PINNED_MEMORIES;

  const handleCopy = useCallback(() => {
    onCopyMessages(selectedMessages);
  }, [onCopyMessages, selectedMessages]);

  const handlePin = useCallback(async () => {
    if (!selectedMessages.length || busy) return;
    if (!chatId) {
      toast.show('请先发送一条消息保存对话，再固定记忆。', { type: 'warning' });
      return;
    }
    if (pinWouldExceedLimit) {
      toast.show(`每个对话最多可固定 ${MAX_PINNED_MEMORIES} 条记忆。`, { type: 'warning' });
      return;
    }

    const nextPinnedState = !allSelectedMessagesPinned;
    const messagesToUpdate = allSelectedMessagesPinned ? selectedMessages : selectedUnpinnedMessages;
    setBusy(true);
    try {
      for (const message of messagesToUpdate) {
        await onTogglePin(message.message_id, nextPinnedState, { silentSuccess: true });
      }
    } finally {
      setBusy(false);
    }
  }, [
    allSelectedMessagesPinned,
    busy,
    chatId,
    onTogglePin,
    pinWouldExceedLimit,
    selectedMessages,
    selectedUnpinnedMessages,
    toast,
  ]);

  return (
    <ChatSelectionActionBar
      selectedCount={selectedMessages.length}
      pinLabel={allSelectedMessagesPinned ? '取消固定' : '固定'}
      pinDisabled={busy || pinWouldExceedLimit || !chatId}
      busy={busy}
      selectedWallpaper={selectedWallpaper}
      isMobile={isMobile}
      chatContentRailStyle={chatContentRailStyle}
      onCopy={handleCopy}
      onPin={handlePin}
      onShare={onShare}
      onCancel={onCancel}
    />
  );
});

const ChatConversationArea = React.memo(function ChatConversationArea({
  chatId,
  activeBranchId,
  chatContentRailStyle,
  selectedWallpaper,
  chatState,
  showWelcome,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  userProfilePicture,
  userBanType,
  userBanUntil,
  isMobile,
  cleanMode,
  timestampGapSeconds,
  branches,
  editingMessageIdRef,
  editingMessageIdSetterRef,
  editingMessageTextRef,
  editingMessageTextSetterRef,
  branchSelectionPendingRef,
  branchSelectionPendingSetterRef,
  renderMessageContent,
  messagesEndRef,
  revealMessageRef,
  hasOlderMessages,
  onLoadOlderMessages,
  onTogglePin,
  onCopyMessage,
  onCancelEditing,
  onSaveEditedMessage,
  onResendMessage,
  onStartEditing,
  onSelectBranch,
  creditLimits,
  advancedChatConfig,
  sessionToken,
  toast,
  draftStorageKey,
  draftFallbackKey,
  inputRef,
  inputSetterRef,
  onSend,
  onAbort,
  onShareSelection,
}) {
  const [editingMessageId, setEditingMessageId] = useState(() => editingMessageIdRef.current);
  const [displayedBranchId, setDisplayedBranchId] = useState(activeBranchId);
  const [branchSelectionPending, setBranchSelectionPending] = useState(
    () => branchSelectionPendingRef.current,
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const toastContext = useToast();

  useEffect(() => {
    editingMessageIdSetterRef.current = setEditingMessageId;
    return () => {
      if (editingMessageIdSetterRef.current === setEditingMessageId) {
        editingMessageIdSetterRef.current = null;
      }
    };
  }, [editingMessageIdSetterRef]);

  useEffect(() => {
    branchSelectionPendingSetterRef.current = setBranchSelectionPending;
    return () => {
      if (branchSelectionPendingSetterRef.current === setBranchSelectionPending) {
        branchSelectionPendingSetterRef.current = null;
      }
    };
  }, [branchSelectionPendingSetterRef]);

  useEffect(() => {
    setDisplayedBranchId(activeBranchId);
  }, [chatId, activeBranchId]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  }, [chatId, displayedBranchId]);

  const forkNavMap = useMemo(
    () => computeForkNav(branches, displayedBranchId),
    [branches, displayedBranchId],
  );

  const handleStartMultiSelect = useCallback((messageId) => {
    if (!messageId) return;
    if (editingMessageId) onCancelEditing();
    setSelectionMode(true);
    setSelectedMessageIds([messageId]);
  }, [editingMessageId, onCancelEditing]);

  const handleToggleSelection = useCallback((messageId) => {
    setSelectedMessageIds((previous) => {
      if (previous.includes(messageId)) return previous.filter((id) => id !== messageId);
      if (previous.length >= MAX_SHARE_MESSAGES) {
        toastContext.show(`最多可选择 ${MAX_SHARE_MESSAGES} 条消息分享。`, { type: 'info' });
        return previous;
      }
      return [...previous, messageId];
    });
  }, [toastContext]);

  const handleExitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
  }, []);

  const handleCopySelectedMessages = useCallback((selectedMessages) => {
    const text = selectedMessages.map((message) => message.content.trim()).join('\n\n');
    if (text) onCopyMessage({ content: text });
  }, [onCopyMessage]);

  const handleAbort = useCallback(() => {
    onAbort();
  }, [onAbort]);
  const handleSelectBranch = useCallback(async (branchId) => {
    if (branchSelectionPending) return;
    const previousBranchId = displayedBranchId;
    setDisplayedBranchId(branchId);
    const switched = await onSelectBranch(branchId);
    if (!switched) setDisplayedBranchId(previousBranchId);
  }, [branchSelectionPending, displayedBranchId, onSelectBranch]);

  return (
    <>
      <ChatMessagesList
        key={`${chatId || 'new'}:${displayedBranchId || ''}`}
        chatContentRailStyle={chatContentRailStyle}
        selectedWallpaper={selectedWallpaper}
        chatState={chatState}
        showWelcome={showWelcome}
        selectedCharacter={selectedCharacter}
        selectedScene={selectedScene}
        selectedPersona={selectedPersona}
        userProfilePicture={userProfilePicture}
        isMobile={isMobile}
        cleanMode={cleanMode}
        timestampGapSeconds={timestampGapSeconds}
        editingMessageId={editingMessageId}
        editingMessageTextRef={editingMessageTextRef}
        editingMessageTextSetterRef={editingMessageTextSetterRef}
        forkNavMap={forkNavMap}
        branchSelectionPending={branchSelectionPending}
        renderMessageContent={renderMessageContent}
        messagesEndRef={messagesEndRef}
        revealMessageRef={revealMessageRef}
        hasOlderMessages={hasOlderMessages}
        onLoadOlderMessages={onLoadOlderMessages}
        onTogglePin={onTogglePin}
        onCopyMessage={onCopyMessage}
        selectionMode={selectionMode}
        selectedMessageIds={selectedMessageIds}
        onStartMultiSelect={handleStartMultiSelect}
        onToggleSelection={handleToggleSelection}
        onCancelEditing={onCancelEditing}
        onSaveEditedMessage={onSaveEditedMessage}
        onResendMessage={onResendMessage}
        onStartEditing={onStartEditing}
        onSelectBranch={handleSelectBranch}
      />
      {selectionMode ? (
        <ChatSelectionControls
          chatState={chatState}
          selectedMessageIds={selectedMessageIds}
          selectedWallpaper={selectedWallpaper}
          isMobile={isMobile}
          chatContentRailStyle={chatContentRailStyle}
          chatId={chatId}
          onTogglePin={onTogglePin}
          onCopyMessages={handleCopySelectedMessages}
          onShare={onShareSelection}
          onCancel={handleExitSelectionMode}
        />
      ) : (
        <ChatInputBar
          selectedWallpaper={selectedWallpaper}
          isMobile={isMobile}
          chatContentRailStyle={chatContentRailStyle}
          userBanType={userBanType}
          userBanUntil={userBanUntil}
          creditLimits={creditLimits}
          chatState={chatState}
          advancedChatConfig={advancedChatConfig}
          sessionToken={sessionToken}
          toast={toast}
          draftStorageKey={draftStorageKey}
          draftFallbackKey={draftFallbackKey}
          inputRef={inputRef}
          inputSetterRef={inputSetterRef}
          onSend={onSend}
          onAbort={handleAbort}
        />
      )}
    </>
  );
});

export default ChatConversationArea;
