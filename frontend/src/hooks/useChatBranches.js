import { useRef } from 'react';
import { useToast } from '../components/ToastProvider';
import { normalizeChatEntry, updateChatEntryBranchMessages, ensureMessageIds } from '../utils/chatHelpers';

/**
 * Hook for branch switching and fork navigation.
 *
 * @param {object}   selectedChat     - current chat entry
 * @param {function} setSelectedChat  - setter for selectedChat
 * @param {function} setMessages      - setter for messages
 * @param {function} buildDisplayMessagesForChat - builds display messages from a chat entry
 * @param {function} setUserData      - setter for userData (from AuthContext)
 * @param {function} upsertChatHistoryEntryLocally - upserts a chat entry into local state
 * @param {string}   sessionToken     - auth session token
 */
export function useChatBranches({
  selectedChat,
  setSelectedChat,
  setMessages,
  buildDisplayMessagesForChat,
  setUserData,
  upsertChatHistoryEntryLocally,
  sessionToken,
}) {
  const toast = useToast();
  const branchSelectionPending = useRef(false);

  const handleSelectBranch = async (branchId) => {
    if (!selectedChat?.chat_id || !branchId || branchSelectionPending.current) return;

    const normalizedChat = normalizeChatEntry(selectedChat);
    const targetBranch = normalizedChat?.branches?.find((branch) => branch.branch_id === branchId);
    if (!normalizedChat || !targetBranch) return;

    const nextChatEntry = {
      ...normalizedChat,
      active_branch_id: targetBranch.branch_id,
      messages: targetBranch.messages,
    };

    branchSelectionPending.current = true;
    setSelectedChat(nextChatEntry);
    setMessages(buildDisplayMessagesForChat(nextChatEntry));
    // Note: the caller must also handle editingMessageId/editingMessageText reset

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
      branchSelectionPending.current = false;
    }
  };

  return {
    handleSelectBranch,
    branchSelectionPending,
  };
}
