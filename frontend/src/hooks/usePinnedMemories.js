import { useCallback } from 'react';
import { useToast } from '../components/ToastProvider';
import { normalizeChatEntry, updateChatEntryBranchMessages, MAX_PINNED_MEMORIES } from '../utils/chatHelpers';

/**
 * Hook for toggling pinned messages and persisting their state to the backend.
 *
 * @param {object}   selectedChatRef - ref to the current chat entry
 * @param {function} updateSelectedChatRef - updates the chat ref without rendering the page
 * @param {object}   chatState       - external chat runtime store
 * @param {string}   sessionToken    - auth session token
 */
export function usePinnedMemories({
  selectedChatRef,
  updateSelectedChatRef,
  chatState,
  sessionToken,
}) {
  const toast = useToast();

  const persistPinnedMessage = useCallback(async (message, isPinned, chatSnapshot) => {
    if (!chatSnapshot?.chat_id) return;
    if (!message?.message_id) return;

    const response = await fetch(`${window.API_BASE_URL}/api/chat/pin-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify({
        chat_id: chatSnapshot.chat_id,
        branch_id: chatSnapshot.active_branch_id,
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
  }, [sessionToken]);

  const handleTogglePin = useCallback(async (messageId, nextPinnedState, { silentSuccess = false } = {}) => {
    const messages = chatState.get('messages');
    const targetMessage = messages.find((m) => m?.message_id === messageId);
    const chatSnapshot = selectedChatRef.current;
    if (!targetMessage) return;

    if (!chatSnapshot?.chat_id) {
      toast.show('请先发送一条消息保存对话，再固定记忆。', { type: 'warning' });
      return;
    }

    if (nextPinnedState && !targetMessage.is_pinned) {
      const currentPinnedCount = messages.filter((m) => m?.role !== 'system' && m?.is_pinned).length;
      if (currentPinnedCount >= MAX_PINNED_MEMORIES) {
        toast.show(
          `每个对话最多可固定 ${MAX_PINNED_MEMORIES} 条记忆。`,
          { type: 'warning' }
        );
        return;
      }
    }

    // Optimistic update
    chatState.set('messages', (prev) => prev.map((m) => {
      if (!m || typeof m !== 'object') return m;
      if (m.message_id !== messageId) return m;
      return { ...m, is_pinned: nextPinnedState };
    }));

    const updatePinnedChatEntry = (isPinned) => {
      updateSelectedChatRef((prev) => {
        if (!prev) return prev;
        const normalized = normalizeChatEntry(prev);
        const branchMessages = normalized?.branches?.find(
          (branch) => branch.branch_id === chatSnapshot.active_branch_id,
        )?.messages || [];
        return updateChatEntryBranchMessages(
          prev,
          chatSnapshot.active_branch_id,
          branchMessages.map((m) => {
            if (!m || typeof m !== 'object') return m;
            if (m.message_id !== messageId) return m;
            return { ...m, is_pinned: isPinned };
          }),
          {},
          normalized?.active_branch_id === chatSnapshot.active_branch_id,
        );
      });
    };
    updatePinnedChatEntry(nextPinnedState);

    try {
      await persistPinnedMessage(targetMessage, nextPinnedState, chatSnapshot);
      if (!silentSuccess) {
        toast.show(
          nextPinnedState
            ? '记忆已固定，将始终保留在上下文中。'
            : '已从固定记忆中移除。',
          { type: 'success' }
        );
      }
    } catch (error) {
      // Rollback on failure
      const currentChat = selectedChatRef.current;
      if (
        currentChat?.chat_id === chatSnapshot.chat_id
        && currentChat.active_branch_id === chatSnapshot.active_branch_id
      ) {
        chatState.set('messages', (prev) => prev.map((m) => {
          if (!m || typeof m !== 'object') return m;
          if (m.message_id !== messageId) return m;
          return { ...m, is_pinned: !nextPinnedState };
        }));
      }
      updatePinnedChatEntry(!nextPinnedState);
      toast.show(error.message || '更新固定记忆失败。', { type: 'error' });
    }
  }, [chatState, selectedChatRef, updateSelectedChatRef, persistPinnedMessage, toast]);

  return {
    handleTogglePin,
  };
}
