import { useState } from 'react';

/**
 * Chat history actions surfaced from the sidebar: rename and delete, plus the
 * delete-confirmation modal state that backs them.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken     - auth session token
 * @param {object}   params.userData         - current user (owns chat_history)
 * @param {function} params.setUserData      - setter for userData
 * @param {object}   params.selectedChat     - current chat entry
 * @param {function} params.setSelectedChat  - setter for selectedChat
 * @param {function} params.refreshUserData  - user refresh
 * @param {function} params.handleNewChat    - resets to a fresh chat when the
 *                                             active chat is the one deleted
 * @param {string}   params.newTitle         - title draft being edited
 * @param {function} params.setNewTitle      - setter for newTitle
 * @param {string}   params.editingChatId    - id of the chat whose title is being edited
 * @param {function} params.setEditingChatId - setter for editingChatId
 * @returns {{ confirmModal, setConfirmModal, handleRename, handleDelete, handleDeleteConfirmed }}
 */
export function useChatHistoryActions({
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
}) {
  // Local state for confirm modal
  const [confirmModal, setConfirmModal] = useState({ show: false, chatId: null });

  const handleRename = async (chatId, currentTitle) => {
    if (!newTitle.trim()) {
      setEditingChatId(null);
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          chat_id: chatId,
          new_title: newTitle.trim()
        })
      });

      if (res.ok) {
        setEditingChatId(null);
        setNewTitle('');
        // Update selected chat if it's the one being renamed
        if (selectedChat?.chat_id === chatId) {
          setSelectedChat(prev => ({
            ...prev,
            title: newTitle.trim()
          }));
        }
        // Update chat title in userData.chat_history immutably and update context for instant UI
        if (userData && userData.chat_history) {
          setUserData(prev => ({
            ...prev,
            chat_history: prev.chat_history.map(c =>
              c.chat_id === chatId ? { ...c, title: newTitle.trim() } : c
            )
          }));
        }
        // Optionally refresh from backend for consistency
        refreshUserData();
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleDelete = async (chatId) => {
    // Open confirmation modal instead of using window.confirm
    setConfirmModal({ show: true, chatId });
  };

  const handleDeleteConfirmed = async () => {
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
        // Remove chat from userData.chat_history immutably and update context for instant UI
        if (userData && userData.chat_history) {
          setUserData(prev => ({
            ...prev,
            chat_history: prev.chat_history.filter(c => c.chat_id !== chatId)
          }));
        }
        // If deleted chat was the selected one, reset to new chat state
        if (selectedChat?.chat_id === chatId) {
          await handleNewChat();
        }
        // Optionally refresh from backend for consistency
        refreshUserData();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  return {
    confirmModal,
    setConfirmModal,
    handleRename,
    handleDelete,
    handleDeleteConfirmed,
  };
}
