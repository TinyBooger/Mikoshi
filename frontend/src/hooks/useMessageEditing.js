import { useCallback } from 'react';
import { normalizeChatEntry, ensureMessageIds, generateMessageId } from '../utils/chatHelpers';
import { copyTextToClipboard } from '../utils/clipboard';

/**
 * Message-level actions: editing a sent message (which forks a branch), resending,
 * switching branches, and copying content.
 *
 * @param {object}   params
 * @param {object}   params.chatState                   - external chat runtime store
 * @param {object}   params.selectedChatRef             - ref to the current chat entry
 * @param {function} params.updateSelectedChatRef       - updates the current chat without rendering the page
 * @param {object}   params.selectedCharacter           - active character
 * @param {string}   params.sessionToken                - auth session token
 * @param {object}   params.toast                       - toast provider
 * @param {object}   params.editingMessageIdRef         - ref to the message id being edited
 * @param {object}   params.editingMessageTextRef       - ref holding the current edited message content
 * @param {function} params.setEditingMessageId         - setter for editingMessageId
 * @param {function} params.setEditingMessageText       - setter for editingMessageText
 * @param {object}   params.branchSelectionPendingRef   - ref to the branch switch guard
 * @param {function} params.setBranchSelectionPending   - setter for the branch guard
 * @param {function} params.sendChatTurn                - streaming send (from useChatSend)
 * @param {function} params.buildDisplayMessagesForChat - branch messages ⇒ display messages
 * @returns {{ handleStartEditingMessage, handleCancelEditingMessage, handleResendMessage, handleSaveEditedMessage, handleSelectBranch, handleCopyMessage }}
 */
export function useMessageEditing({
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
}) {
  const handleStartEditingMessage = useCallback((message) => {
    if (!message?.message_id || message.role !== 'user' || chatState.get('sendStatus').sending) return;
    setEditingMessageId(message.message_id);
    setEditingMessageText(message.content || '');
  }, [chatState, setEditingMessageId, setEditingMessageText]);

  const handleCancelEditingMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingMessageText('');
  }, [setEditingMessageId, setEditingMessageText]);

  const buildForkedMessagesFromUserMessage = useCallback((messageId, replacementContent = null) => {
    const originalMessages = ensureMessageIds(chatState.get('messages'));
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
  }, [chatState]);

  const handleResendMessage = useCallback(async (message) => {
    if (!message?.message_id || message.role !== 'user' || !selectedCharacter || !!editingMessageIdRef.current || chatState.get('sendStatus').sending) return;

    const forkData = buildForkedMessagesFromUserMessage(message.message_id);
    if (!forkData) return;

    const selectedChat = selectedChatRef.current;
    await sendChatTurn({
      nextMessages: forkData.forkedMessages,
      forkFromMessageId: message.message_id,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: forkData.originalMessages,
      errorMessage: '从这条消息重新发送失败，请重试。',
    });
  }, [chatState, selectedCharacter, editingMessageIdRef, selectedChatRef, buildForkedMessagesFromUserMessage, sendChatTurn]);

  const handleSaveEditedMessage = useCallback(async () => {
    const editingMessageId = editingMessageIdRef.current;
    if (!editingMessageId || !selectedCharacter || chatState.get('sendStatus').sending) return;

    const trimmedContent = editingMessageTextRef.current.trim();
    if (!trimmedContent) {
      toast.show('消息不能为空。', { type: 'warning' });
      return;
    }

    const forkData = buildForkedMessagesFromUserMessage(editingMessageId, trimmedContent);
    if (!forkData) return;

    const selectedChat = selectedChatRef.current;
    handleCancelEditingMessage();
    await sendChatTurn({
      nextMessages: forkData.forkedMessages,
      forkFromMessageId: editingMessageId,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: forkData.originalMessages,
      errorMessage: '从该消息创建分支失败。',
    });
  }, [chatState, editingMessageIdRef, selectedCharacter, editingMessageTextRef, buildForkedMessagesFromUserMessage, handleCancelEditingMessage, sendChatTurn, selectedChatRef]);

  const handleSelectBranch = useCallback(async (branchId) => {
    const selectedChat = selectedChatRef.current;
    if (!selectedChat?.chat_id || !branchId || branchSelectionPendingRef.current) return false;

    const normalizedChat = normalizeChatEntry(selectedChat);
    const targetBranch = normalizedChat?.branches?.find((branch) => branch.branch_id === branchId);
    if (!normalizedChat || !targetBranch) return false;

    const nextChatEntry = {
      ...normalizedChat,
      active_branch_id: targetBranch.branch_id,
      messages: targetBranch.messages,
    };

    setBranchSelectionPending(true);
    updateSelectedChatRef(nextChatEntry);
    chatState.set('messages', buildDisplayMessagesForChat(nextChatEntry));
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
        const updatedChat = normalizeChatEntry(payload.chat);
        if (!updatedChat) throw new Error('Invalid chat data returned after switching branches.');
        updateSelectedChatRef(updatedChat);
        chatState.set('messages', buildDisplayMessagesForChat(updatedChat));
      }
      return true;
    } catch (error) {
      updateSelectedChatRef(normalizedChat);
      chatState.set('messages', buildDisplayMessagesForChat(normalizedChat));
      toast.show(error.message || 'Failed to switch branch.', { type: 'error' });
      return false;
    } finally {
      setBranchSelectionPending(false);
    }
  }, [selectedChatRef, branchSelectionPendingRef, setBranchSelectionPending, updateSelectedChatRef, chatState, buildDisplayMessagesForChat, setEditingMessageId, setEditingMessageText, sessionToken, toast]);

  const handleCopyMessage = useCallback(async (message) => {
    const content = message?.content;
    if (typeof content !== 'string' || !content.trim()) return;
    const copied = await copyTextToClipboard(content);
    if (copied) {
      toast.show('已复制到剪贴板。', { type: 'success' });
    } else {
      toast.show('复制失败，请手动复制。', { type: 'error' });
    }
  }, [toast]);

  return {
    handleStartEditingMessage,
    handleCancelEditingMessage,
    handleResendMessage,
    handleSaveEditedMessage,
    handleSelectBranch,
    handleCopyMessage,
  };
}
