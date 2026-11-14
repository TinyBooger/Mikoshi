import { useRef } from 'react';
import { ensureMessageIds, generateMessageId, createLocalMessageTimestamp } from '../utils/chatHelpers';
import { isCreditLocked } from '../utils/creditCheck';
import { getChatErrorMessage, compactMessagesForRequest } from '../utils/chatMessages';
import {
  getChatDraftPendingStorageKey,
  removeChatDraft,
  saveChatDraft,
} from '../utils/chatDraftStorage';

const REQUEST_CONTEXT_MESSAGE_COUNT = 40;

/**
 * Streaming chat turns: builds the request, consumes the SSE stream, and owns
 * the "superseded request" bookkeeping that keeps a stale stream from clobbering
 * state belonging to a newer turn.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken                    - auth session token
 * @param {object}   params.toast                           - toast provider
 * @param {function} params.refreshUserData                 - silent user refresh
 * @param {object}   params.chatState                       - external chat runtime store
 * @param {object}   params.inputRef                        - current input value ref
 * @param {function} params.setInput                        - setter for the input value
 * @param {string}   params.draftStorageKey                 - local-storage key for this conversation's draft
 * @param {object}   params.selectedChatRef                 - ref to the current chat entry
 * @param {object}   params.selectedCharacter               - active character
 * @param {object}   params.selectedScene                   - active scene
 * @param {object}   params.selectedPersona                 - active persona
 * @param {string}   params.characterId                     - fallback character id
 * @param {object}   params.advancedChatConfig              - chat config sent to the API
 * @param {object}   params.creditLimits                    - credit limits (for the lock check)
 * @param {object}   params.abortControllerRef              - ref for the current controller
 * @param {object}   params.pendingChatIdRef                - reserved chat id (shared with init flow)
 * @param {function} params.applyChatLimits                 - chat-limit reminder handler
 * @param {function} params.applyCreditLimits               - credit limit state + toast
 * @param {function} params.syncChatEntryAfterTurn         - syncs saved chat metadata into local history
 * @returns {{ sendChatTurn: function, handleSend: function }}
 */
export function useChatSend({
  sessionToken,
  toast,
  refreshUserData,
  chatState,
  inputRef,
  setInput,
  draftStorageKey,
  selectedChatRef,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  characterId,
  advancedChatConfig,
  creditLimits,
  abortControllerRef,
  pendingChatIdRef,
  applyChatLimits,
  applyCreditLimits,
  syncChatEntryAfterTurn,
}) {
  // Monotonic counter used to invalidate superseded chat turns so a stale
  // stream can never clobber state from a newer request.
  const chatGenerationIdRef = useRef(0);

  const sendChatTurn = async ({
    nextMessages,
    chatId = selectedChatRef.current?.chat_id || pendingChatIdRef.current,
    forkFromMessageId = null,
    sourceBranchId = selectedChatRef.current?.active_branch_id || null,
    restoreMessagesOnError = nextMessages,
    clearDraftOnComplete = false,
    draftInputToClear = '',
    draftKeyToClear = draftStorageKey,
    errorMessage = 'Failed to send message. Please try again.',
    characterOverride = selectedCharacter,
    sceneOverride = selectedScene,
    personaOverride = selectedPersona,
  }) => {
    if (!characterOverride) return;
    const selectedChat = selectedChatRef.current;

    const pendingDraftKey = clearDraftOnComplete
      ? getChatDraftPendingStorageKey(draftKeyToClear)
      : null;
    let sentDraftRestored = false;
    const restoreSentDraft = () => {
      if (!clearDraftOnComplete || sentDraftRestored) return;
      sentDraftRestored = true;

      const currentInput = inputRef.current;
      const restoredDraft = currentInput && currentInput !== draftInputToClear
        ? `${draftInputToClear}\n${currentInput}`
        : draftInputToClear;
      setInput(restoredDraft);
      saveChatDraft(draftKeyToClear, restoredDraft);
      removeChatDraft(pendingDraftKey);
    };

    // Cancel any in-flight turn for this chat before starting a new one.
    abortControllerRef.current?.abort();

    // Claim a new generation token so any response from the cancelled request
    // (chunk, done, error, or finally) is treated as stale and ignored.
    const requestGenerationId = ++chatGenerationIdRef.current;

    chatState.set('sendStatus', { sending: true, isStreaming: true });

    if (clearDraftOnComplete) {
      saveChatDraft(pendingDraftKey, draftInputToClear);
      setInput('');
    }

    const requestMessages = compactMessagesForRequest(nextMessages);
    const usesStoredHistory = !!selectedChat?.chat_id && selectedChat.chat_id === chatId;
    const turnMessage = usesStoredHistory && !forkFromMessageId
      && requestMessages[requestMessages.length - 1]?.role === 'user'
      ? requestMessages[requestMessages.length - 1]
      : null;
    const requestContextMessages = usesStoredHistory
      ? [
        ...requestMessages.filter((message) => message.role === 'system'),
        ...requestMessages
          .filter((message) => message.role !== 'system' && message !== turnMessage)
          .slice(-REQUEST_CONTEXT_MESSAGE_COUNT),
      ]
      : requestMessages;
    const forkMessage = usesStoredHistory && forkFromMessageId
      ? [...requestMessages].reverse().find((message) => (
        message.role === 'user' && message.message_id !== forkFromMessageId
      ))
      : null;
    const loadedBranch = usesStoredHistory && Array.isArray(selectedChat.branches)
      ? selectedChat.branches.find((branch) => branch?.branch_id === sourceBranchId)
      : null;
    // A stored chat may ship only the newest slice of its transcript, so the
    // server's own count is the baseline; the loaded length is only a floor.
    const storedMessageCount = Number(loadedBranch?.message_count);
    const baseMessageCount = usesStoredHistory && Array.isArray(selectedChat.messages)
      ? (Number.isFinite(storedMessageCount)
        ? Math.max(storedMessageCount, selectedChat.messages.length)
        : selectedChat.messages.length)
      : (Array.isArray(nextMessages) ? nextMessages.length : 0);
    const controller = new AbortController();
    const assistantMessageId = generateMessageId();
    const assistantCreatedAt = createLocalMessageTimestamp();
    abortControllerRef.current = controller;
    chatState.set('messages', ensureMessageIds([...nextMessages, { role: 'assistant', content: '', message_id: assistantMessageId, is_pinned: false, created_at: assistantCreatedAt }]));

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          character_id: characterOverride?.id || characterId,
          chat_id: chatId,
          branch_id: sourceBranchId,
          fork_from_message_id: forkFromMessageId,
          assistant_message_id: assistantMessageId,
          base_message_count: baseMessageCount,
          scene_id: sceneOverride?.id || null,
          persona_id: personaOverride?.id || null,
          messages: requestContextMessages,
          ...(usesStoredHistory ? { history_mode: 'stored_branch' } : {}),
          ...(turnMessage ? { turn_message: turnMessage } : {}),
          ...(forkMessage ? { fork_message: forkMessage } : {}),
          chat_config: advancedChatConfig,
          // Minutes east of UTC so the backend can stamp the user's local
          // wall clock on the request copy (prompt-only, never stored).
          timezone_offset_minutes: -new Date().getTimezoneOffset(),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('对话内容超过单次请求大小限制，请分段导入较小的对话后重试。');
        }
        const errorPayload = await response.json().catch(() => null);
        if (errorPayload?.limits) {
          applyChatLimits(errorPayload.limits);
        }
        if (errorPayload?.credit_limits) {
          applyCreditLimits(errorPayload.credit_limits);
        }
        throw new Error(getChatErrorMessage(errorPayload));
      }

      if (!response.body) {
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = '';
      let pendingEventBuffer = '';
      let streamConfirmed = false;
      let streamFailed = false;

      const processEventPayload = (rawPayload) => {
        // Ignore any event from a superseded request. A new turn has been
        // started, so this response is stale and must not touch state.
        if (requestGenerationId !== chatGenerationIdRef.current) {
          return;
        }

        const payload = rawPayload
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice(6))
          .join('\n');

        if (!payload) {
          return;
        }

        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          // Malformed SSE payload — ignore silently rather than crashing the stream
          return;
        }

        if (data.error) {
          const friendlyMessage = getChatErrorMessage(data);
          toast.show(friendlyMessage, { type: 'error' });
          chatState.set('messages', ensureMessageIds(restoreMessagesOnError));
          streamFailed = true;
          if (data.credit_limits) {
            applyCreditLimits(data.credit_limits);
          }
          if (data.limits) {
            applyChatLimits(data.limits);
          }
          return;
        }

        if (data.chunk) {
          accumulatedReply += data.chunk;
          chatState.updateMessage(assistantMessageId, (previousMessage) => ({
            // Preserve the timestamp and other fields created for the placeholder.
            ...previousMessage,
            role: 'assistant',
            content: accumulatedReply,
            message_id: assistantMessageId,
            is_pinned: false,
          }));
        }

        if (data.done) {
          streamConfirmed = !streamFailed;
          if (clearDraftOnComplete) {
            removeChatDraft(pendingDraftKey);
            saveChatDraft(draftKeyToClear, inputRef.current);
          }
          applyChatLimits(data.limits);
          applyCreditLimits(data.credit_limits);
          if (refreshUserData) {
            refreshUserData({ silent: true });
          }
          if (data.context_window) {
            chatState.set('serverContextWindowUsage', data.context_window);
            if (data.context_window.context_truncated) {
              const omittedCount = Number(data.context_window.omitted_message_count || 0);
              const notice = omittedCount > 0
                ? `已为本次回复省略 ${omittedCount} 条较早的上下文消息；原聊天记录未更改。`
                : '已为本次回复省略部分较早的上下文；原聊天记录未更改。';
              toast.show(notice, { type: 'warning' });
            }
          }
          if (data.chat_metadata && typeof syncChatEntryAfterTurn === 'function') {
            if (data.chat_metadata.turn_saved === false) {
              toast.show('对话已在其他请求中更新；本次回复未保存，请重新加载对话。', { type: 'warning' });
              refreshUserData?.({ silent: true });
            } else {
              syncChatEntryAfterTurn({
                metadata: data.chat_metadata,
                messages: nextMessages,
                assistantMessage: {
                  role: 'assistant',
                  content: accumulatedReply,
                  message_id: data.assistant_message_id || assistantMessageId,
                  is_pinned: false,
                  created_at: assistantCreatedAt,
                  usage: data.assistant_usage,
                },
              });
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        pendingEventBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const events = pendingEventBuffer.split('\n\n');
        pendingEventBuffer = events.pop() || '';

        for (const eventPayload of events) {
          processEventPayload(eventPayload);
        }

        if (done) {
          break;
        }
      }

      if (pendingEventBuffer.trim()) {
        processEventPayload(pendingEventBuffer);
      }
      if ((!streamConfirmed || streamFailed) && clearDraftOnComplete) {
        chatState.set('messages', ensureMessageIds(restoreMessagesOnError));
        restoreSentDraft();
      }
    } catch (err) {
      // A superseded request must not show errors or restore stale messages.
      if (requestGenerationId !== chatGenerationIdRef.current) {
        return;
      }
      if (err.name !== 'AbortError') {
        toast.show(err.message || errorMessage, { type: 'error' });
      }
      chatState.set('messages', ensureMessageIds(restoreMessagesOnError));
      restoreSentDraft();
    } finally {
      // Only the latest request may clear sending/streaming state.
      if (requestGenerationId === chatGenerationIdRef.current) {
        chatState.refreshContextUsage();
        chatState.set('sendStatus', { sending: false, isStreaming: false });
        abortControllerRef.current = null;
      }
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (isCreditLocked(creditLimits)) {
      toast.show('已达到点数上限，暂时无法继续对话。', { type: 'warning' });
      return;
    }
    const input = inputRef.current;
    const currentMessages = chatState.get('messages');
    if (chatState.get('sendStatus').sending || !input.trim() || !selectedCharacter) return;
    saveChatDraft(draftStorageKey, input);
    const updatedMessages = ensureMessageIds([...currentMessages, { role: 'user', content: input.trim(), message_id: generateMessageId(), is_pinned: false, created_at: createLocalMessageTimestamp() }]);
    chatState.set('messages', updatedMessages);
    await sendChatTurn({
      nextMessages: updatedMessages,
      sourceBranchId: selectedChatRef.current?.active_branch_id || null,
      restoreMessagesOnError: currentMessages,
      clearDraftOnComplete: true,
      draftInputToClear: input,
      draftKeyToClear: draftStorageKey,
    });
  };

  return { sendChatTurn, handleSend };
}
