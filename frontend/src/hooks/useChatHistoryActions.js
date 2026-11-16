import { useCallback, useState } from 'react';

/**
 * Chat history actions surfaced from the sidebar: rename and delete, plus the
 * delete-confirmation modal state that backs them.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken     - auth session token
 * @param {function} params.setUserData      - setter for userData
 * @param {object}   params.selectedChatRef  - ref to the current chat entry
 * @param {function} params.setSelectedChat  - setter for selectedChat
 * @param {function} params.handleNewChat    - resets to a fresh chat when the
 *                                             active chat is deleted and nothing
 *                                             is left to fall back to
 * @param {function} params.loadChat         - loads a chat entry; used to fall
 *                                             back to the next-most-recent chat
 *                                             after the active one is deleted
 * @param {function} params.getFallbackChat  - `(deletedChatId) => chat|null`,
 *                                             the next chat of the current
 *                                             对话历史 group
 * @param {string}   params.newTitle         - title draft being edited
 * @param {function} params.setNewTitle      - setter for newTitle
 * @param {string}   params.editingChatId    - id of the chat whose title is being edited
 * @param {function} params.setEditingChatId - setter for editingChatId
 * @returns {{ confirmModal, setConfirmModal, handleRename, handleDelete, handleDeleteConfirmed }}
 */
export function useChatHistoryActions({
  sessionToken,
  setUserData,
  selectedChatRef,
  setSelectedChat,
  handleNewChat,
  loadChat,
  getFallbackChat,
  newTitle,
  setNewTitle,
  editingChatId,
  setEditingChatId,
}) {
  // Local state for confirm modal
  const [confirmModal, setConfirmModal] = useState({ show: false, chatId: null });

  const handleRename = useCallback(async (chatId, currentTitle) => {
    if (!newTitle.trim()) {
      setEditingChatId(null);
      return;
    }

    const nextTitle = newTitle.trim();

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          chat_id: chatId,
          new_title: nextTitle
        })
      });

      if (res.ok) {
        setEditingChatId(null);
        setNewTitle('');
        // Update selected chat if it's the one being renamed
        if (selectedChatRef.current?.chat_id === chatId) {
          setSelectedChat(prev => ({
            ...prev,
            title: nextTitle
          }));
        }
        // This is the only writer of the new title: a follow-up refresh would
        // re-read `/api/users/me` and stamp that snapshot over it, which is a
        // no-op at best and reverts the rename when the read is stale.
        setUserData(prev => {
          if (!prev?.chat_history) return prev;
          return {
            ...prev,
            chat_history: prev.chat_history.map(c =>
              c.chat_id === chatId ? { ...c, title: nextTitle } : c
            )
          };
        });
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  }, [newTitle, setEditingChatId, sessionToken, selectedChatRef, setSelectedChat, setNewTitle, setUserData]);

  const handleDelete = useCallback(async (chatId) => {
    // Open confirmation modal instead of using window.confirm
    setConfirmModal({ show: true, chatId });
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    const chatId = confirmModal.chatId;
    setConfirmModal({ show: false, chatId: null });
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({ chat_id: chatId })
      });

      if (res.ok) {
        // This is the only writer of the deletion: a follow-up refresh would
        // re-read `/api/users/me` and stamp that snapshot over it, which is a
        // no-op at best and resurrects the row when the read is stale.
        setUserData(prev => {
          if (!prev?.chat_history) return prev;
          return {
            ...prev,
            chat_history: prev.chat_history.filter(c => c.chat_id !== chatId)
          };
        });
        // Deleting the active chat falls back to the most recent remaining chat
        // of the same group. Starting a new chat instead would repopulate 对话历史
        // immediately, so the list never shrinks.
        if (selectedChatRef.current?.chat_id === chatId) {
          const fallbackChat = getFallbackChat?.(chatId);
          if (fallbackChat) {
            await loadChat(fallbackChat);
          } else {
            await handleNewChat();
          }
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }, [confirmModal.chatId, sessionToken, setUserData, selectedChatRef, loadChat, getFallbackChat, handleNewChat]);

  return {
    confirmModal,
    setConfirmModal,
    handleRename,
    handleDelete,
    handleDeleteConfirmed,
  };
}
