import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizeChatEntry,
  updateChatEntryBranchMessages,
  ensureMessageIds,
} from '../utils/chatHelpers';

// Matches INITIAL_VISIBLE_MESSAGES in ChatMessagesList and the server's
// CHAT_OPEN_MESSAGE_LIMIT: the transcript opens with the newest page and grows
// one page per scrollback request.
export const OLDER_MESSAGE_PAGE_SIZE = 50;
// Bounds the scrollback walk done to reveal a pinned message that is not loaded.
const SEEK_PAGE_LIMIT = 20;

const stripSystemMessages = (messageList) => (Array.isArray(messageList) ? messageList : [])
  .filter((message) => message && message.role !== 'system');

const resolveActiveBranch = (chatEntry) => {
  const normalized = normalizeChatEntry(chatEntry);
  if (!normalized) return null;
  return normalized.branches.find(
    (branch) => branch.branch_id === normalized.active_branch_id,
  ) || normalized.branches[0] || null;
};

/**
 * Reads older transcript pages on demand.
 *
 * The chat is opened with its newest messages only, so anything above that
 * window has to be requested explicitly. Pages are anchored on `oldest_seq`,
 * which keeps them contiguous while new turns are appended at the far end.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken  - auth token
 * @param {object}   params.selectedChatRef - ref holding the open chat entry
 * @param {function} params.setSelectedChat - chat entry setter (also renders)
 * @param {object}   params.chatState      - external chat runtime store
 * @param {object}   params.toast          - toast context
 * @returns {{ loadOlderMessages: function, ensureMessageLoaded: function, hasOlderMessages: boolean }}
 */
export function useChatHistoryPaging({
  sessionToken,
  selectedChatRef,
  setSelectedChat,
  chatState,
  toast,
}) {
  const loadingRef = useRef(false);
  // Mirrors `has_more` of the branch on screen. Branch payloads are often
  // swapped through `selectedChatRef` without a page render (branch switch,
  // fork), so the value is re-read whenever the transcript changes.
  const [hasOlderMessages, setHasOlderMessages] = useState(false);

  const syncPagingState = useCallback(() => {
    const nextHasOlderMessages = !!resolveActiveBranch(selectedChatRef.current)?.has_more;
    setHasOlderMessages((previous) => (previous === nextHasOlderMessages ? previous : nextHasOlderMessages));
  }, [selectedChatRef]);

  useEffect(() => {
    syncPagingState();
    return chatState.subscribe('messages', syncPagingState);
  }, [chatState, syncPagingState]);

  const fetchPage = useCallback(async ({ chatId, branchId, beforeSeq, limit }) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', branchId);
    if (Number.isFinite(beforeSeq)) params.set('before_seq', String(beforeSeq));
    params.set('limit', String(limit));

    const response = await fetch(
      `${window.API_BASE_URL}/api/chat/history/${encodeURIComponent(chatId)}/messages?${params.toString()}`,
      { headers: { Authorization: sessionToken } },
    );
    if (!response.ok) {
      throw new Error(`Failed to load older messages (${response.status})`);
    }
    return response.json();
  }, [sessionToken]);

  const applyPage = useCallback((page) => {
    const olderMessages = ensureMessageIds(stripSystemMessages(page?.messages));

    if (olderMessages.length > 0) {
      chatState.set('messages', (previousMessages) => {
        const currentList = Array.isArray(previousMessages) ? previousMessages : [];
        const knownIds = new Set(
          currentList.map((message) => message?.message_id).filter(Boolean),
        );
        const additions = olderMessages.filter((message) => !knownIds.has(message.message_id));
        if (additions.length === 0) return previousMessages;

        const leadingSystem = [];
        let index = 0;
        while (index < currentList.length && currentList[index]?.role === 'system') {
          leadingSystem.push(currentList[index]);
          index += 1;
        }
        return [...leadingSystem, ...additions, ...currentList.slice(index)];
      });
    }

    setSelectedChat((previousChat) => {
      if (!previousChat) return previousChat;
      const normalized = normalizeChatEntry(previousChat);
      const branch = normalized?.branches?.find(
        (candidate) => candidate.branch_id === page?.branch_id,
      );
      if (!branch) return previousChat;

      const knownIds = new Set(branch.messages.map((message) => message?.message_id).filter(Boolean));
      const additions = olderMessages.filter((message) => !knownIds.has(message.message_id));

      return updateChatEntryBranchMessages(
        normalized,
        page.branch_id,
        [...additions, ...branch.messages],
        {
          message_count: page.message_count,
          oldest_seq: page.oldest_seq,
          has_more: !!page.has_more,
          pinned_messages: page.pinned_messages,
        },
        normalized.active_branch_id === page.branch_id,
      );
    });

    // `setSelectedChat` updates the ref synchronously, so the freshly returned
    // `has_more` is visible right away.
    syncPagingState();

    return olderMessages.length;
  }, [chatState, setSelectedChat, syncPagingState]);

  /**
   * Loads the page immediately before the messages already held.
   *
   * @returns {Promise<number>} how many messages were prepended
   */
  const loadOlderMessages = useCallback(async () => {
    if (loadingRef.current) return 0;
    const chatSnapshot = selectedChatRef.current;
    if (!chatSnapshot?.chat_id) return 0;

    const branch = resolveActiveBranch(chatSnapshot);
    if (!branch?.has_more || !Number.isFinite(branch.oldest_seq)) return 0;

    loadingRef.current = true;
    try {
      const page = await fetchPage({
        chatId: chatSnapshot.chat_id,
        branchId: branch.branch_id,
        beforeSeq: branch.oldest_seq,
        limit: OLDER_MESSAGE_PAGE_SIZE,
      });
      return applyPage(page);
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast.show('加载更早的消息失败，请重试。', { type: 'error' });
      return 0;
    } finally {
      loadingRef.current = false;
    }
  }, [applyPage, fetchPage, selectedChatRef, toast]);

  /**
   * Pages back until `messageId` is part of the loaded transcript.
   *
   * A pinned memory can sit far above the open window; the pin list has to be
   * able to reveal it without the whole history being loaded.
   */
  const ensureMessageLoaded = useCallback(async (messageId) => {
    if (!messageId) return false;
    const isLoaded = () => (chatState.get('messages') || [])
      .some((message) => message?.message_id === messageId);
    if (isLoaded()) return true;

    for (let attempt = 0; attempt < SEEK_PAGE_LIMIT; attempt += 1) {
      const loadedCount = await loadOlderMessages();
      if (loadedCount === 0) break;
      if (isLoaded()) return true;
    }
    return isLoaded();
  }, [chatState, loadOlderMessages]);

  return { loadOlderMessages, ensureMessageLoaded, hasOlderMessages };
}
