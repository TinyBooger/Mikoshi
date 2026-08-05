import { useContext } from 'react';
import { useToast } from '../components/ToastProvider';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import { normalizeChatEntry, updateChatEntryBranchMessages, MAX_PINNED_MEMORIES } from '../utils/chatHelpers';

/**
 * Hook for pinned message/memory operations: toggle pin, sync pinned state
 * in user history, and persist to the backend.
 *
 * @param {object}   selectedChat    - current chat entry
 * @param {function} setSelectedChat - setter for selectedChat
 * @param {array}    messages        - current message list
 * @param {function} setMessages     - setter for messages
 * @param {function} setUserData     - setter for userData (from AuthContext)
 * @param {string}   sessionToken    - auth session token
 */
export function usePinnedMemories({
  selectedChat,
  setSelectedChat,
  messages,
  setMessages,
  setUserData,
  sessionToken,
}) {
  const toast = useToast();
  const { t } = useTranslation();

  const syncPinnedStateInUserHistory = (chatId, messageId, isPinned) => {
    if (!chatId || !messageId) return;

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

    // Optimistic update
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
      // Rollback on failure
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

  return {
    handleTogglePin,
    syncPinnedStateInUserHistory,
  };
}
