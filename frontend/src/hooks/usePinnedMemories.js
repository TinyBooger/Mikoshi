import { useCallback } from 'react';
import { useToast } from '../components/ToastProvider';
import { AuthContext } from '../components/AuthProvider';
import { normalizeChatEntry, updateChatEntryBranchMessages, MAX_PINNED_MEMORIES } from '../utils/chatHelpers';

/**
 * Hook for toggling pinned messages and persisting their state to the backend.
 *
 * @param {object}   selectedChat    - current chat entry
 * @param {function} setSelectedChat - setter for selectedChat
 * @param {object}   chatState       - external chat runtime store
 * @param {string}   sessionToken    - auth session token
 */
export function usePinnedMemories({
  selectedChat,
  setSelectedChat,
  chatState,
  sessionToken,
}) {
  const toast = useToast();

  const persistPinnedMessage = useCallback(async (message, isPinned) => {
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
  }, [selectedChat?.chat_id, selectedChat?.active_branch_id, sessionToken]);

  const handleTogglePin = useCallback(async (messageId, nextPinnedState, { silentSuccess = false } = {}) => {
    const messages = chatState.get('messages');
    const targetMessage = messages.find((m) => m?.message_id === messageId);
    if (!targetMessage) return;

    if (!selectedChat?.chat_id) {
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

    try {
      await persistPinnedMessage(targetMessage, nextPinnedState);
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
      chatState.set('messages', (prev) => prev.map((m) => {
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
      toast.show(error.message || '更新固定记忆失败。', { type: 'error' });
    }
  }, [chatState, selectedChat?.chat_id, setSelectedChat, persistPinnedMessage, toast]);

  return {
    handleTogglePin,
  };
}
