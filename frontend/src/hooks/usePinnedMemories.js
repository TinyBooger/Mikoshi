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
    const storedPinnedMessages = chatState.get('storedPinnedMessages') || [];
    // A pinned memory can sit above the loaded window and only be present in
    // the server-provided pin list.
    const targetMessage = messages.find((m) => m?.message_id === messageId)
      || storedPinnedMessages.find((m) => m?.message_id === messageId);
    const chatSnapshot = selectedChatRef.current;
    if (!targetMessage) return;

    if (!chatSnapshot?.chat_id) {
      toast.show('请先发送一条消息保存对话，再固定记忆。', { type: 'warning' });
      return;
    }

    if (nextPinnedState && !targetMessage.is_pinned) {
      const pinnedIds = new Set([
        ...messages.filter((m) => m?.role !== 'system' && m?.is_pinned).map((m) => m?.message_id),
        ...storedPinnedMessages.map((m) => m?.message_id),
      ]);
      if (pinnedIds.size >= MAX_PINNED_MEMORIES) {
        toast.show(
          `每个对话最多可固定 ${MAX_PINNED_MEMORIES} 条记忆。`,
          { type: 'warning' }
        );
        return;
      }
    }

    const withPinnedState = (message) => {
      if (!message || typeof message !== 'object') return message;
      if (message.message_id !== messageId) return message;
      return { ...message, is_pinned: nextPinnedState };
    };

    // Optimistic update
    chatState.set('messages', (previousMessages) => previousMessages.map(withPinnedState));
    chatState.set('storedPinnedMessages', (previousMessages) => {
      const list = Array.isArray(previousMessages) ? previousMessages : [];
      if (nextPinnedState) {
        if (list.some((m) => m?.message_id === messageId)) return list.map(withPinnedState);
        return [...list, { ...targetMessage, is_pinned: true }];
      }
      return list.filter((m) => m?.message_id !== messageId);
    });

    const updatePinnedChatEntry = (isPinned) => {
      updateSelectedChatRef((prev) => {
        if (!prev) return prev;
        const normalized = normalizeChatEntry(prev);
        const branch = normalized?.branches?.find(
          (b) => b.branch_id === chatSnapshot.active_branch_id,
        );
        const branchMessages = branch?.messages || [];
        const pinnedMessages = Array.isArray(branch?.pinned_messages) ? branch.pinned_messages : [];
        const nextPinnedMessages = isPinned
          ? (pinnedMessages.some((m) => m?.message_id === messageId)
            ? pinnedMessages.map((m) => (m?.message_id === messageId ? { ...m, is_pinned: true } : m))
            : [...pinnedMessages, { ...targetMessage, is_pinned: true }])
          : pinnedMessages.filter((m) => m?.message_id !== messageId);
        return updateChatEntryBranchMessages(
          prev,
          chatSnapshot.active_branch_id,
          branchMessages.map(withPinnedState),
          { pinned_messages: nextPinnedMessages },
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
        chatState.set('messages', (previousMessages) => previousMessages.map((m) => {
          if (!m || typeof m !== 'object') return m;
          if (m.message_id !== messageId) return m;
          return { ...m, is_pinned: !nextPinnedState };
        }));
        chatState.set('storedPinnedMessages', (previousMessages) => {
          const list = Array.isArray(previousMessages) ? previousMessages : [];
          if (!nextPinnedState) {
            if (list.some((m) => m?.message_id === messageId)) return list;
            return [...list, { ...targetMessage, is_pinned: true }];
          }
          return list.filter((m) => m?.message_id !== messageId);
        });
      }
      updatePinnedChatEntry(!nextPinnedState);
      toast.show(error.message || '更新固定记忆失败。', { type: 'error' });
    }
  }, [chatState, selectedChatRef, updateSelectedChatRef, persistPinnedMessage, toast]);

  return {
    handleTogglePin,
  };
}
