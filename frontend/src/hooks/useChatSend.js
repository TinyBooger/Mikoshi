import { useRef } from 'react';
import { ensureMessageIds, generateMessageId, createLocalMessageTimestamp } from '../utils/chatHelpers';
import { isCreditLocked } from '../utils/creditCheck';
import { getChatErrorMessage, compactMessagesForRequest } from '../utils/chatMessages';
import {
  getChatDraftPendingStorageKey,
  removeChatDraft,
  saveChatDraft,
} from '../utils/chatDraftStorage';

/**
 * Streaming chat turns: builds the request, consumes the SSE stream, and owns
 * the "superseded request" bookkeeping that keeps a stale stream from clobbering
 * state belonging to a newer turn.
 *
 * @param {object}   params
 * @param {string}   params.sessionToken                    - auth session token
 * @param {object}   params.toast                           - toast provider
 * @param {function} params.refreshUserData                 - silent user refresh
 * @param {array}    params.messages                        - current message list
 * @param {function} params.setMessages                     - setter for messages
 * @param {string}   params.input                           - current input value
 * @param {function} params.setInput                        - setter for the input value
 * @param {string}   params.draftStorageKey                 - local-storage key for this conversation's draft
 * @param {object}   params.selectedChat                    - current chat entry
 * @param {object}   params.selectedCharacter               - active character
 * @param {object}   params.selectedScene                   - active scene
 * @param {object}   params.selectedPersona                 - active persona
 * @param {string}   params.characterId                     - fallback character id
 * @param {object}   params.advancedChatConfig              - chat config sent to the API
 * @param {object}   params.creditLimits                    - credit limits (for the lock check)
 * @param {boolean}  params.sending                         - in-flight turn guard
 * @param {function} params.setSending                      - setter for `sending`
 * @param {function} params.setIsStreaming                  - setter for `isStreaming`
 * @param {object}   params.abortController                 - current controller, if any
 * @param {function} params.setAbortController              - setter for the controller
 * @param {object}   params.pendingChatIdRef                - reserved chat id (shared with init flow)
 * @param {function} params.applyChatLimits                 - chat limit state + toast
 * @param {function} params.applyCreditLimits               - credit limit state + toast
 * @param {function} params.buildDisplayMessagesForChat     - branch messages ⇒ display messages
 * @param {function} params.upsertChatHistoryEntryLocally   - history upsert helper
 * @param {function} params.setServerContextWindowUsage     - setter for server usage
 * @returns {{ sendChatTurn: function, handleSend: function }}
 */
export function useChatSend({
  sessionToken,
  toast,
  refreshUserData,
  messages,
  setMessages,
  input,
  setInput,
  draftStorageKey,
  selectedChat,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  characterId,
  advancedChatConfig,
  creditLimits,
  sending,
  setSending,
  setIsStreaming,
  abortController,
  setAbortController,
  pendingChatIdRef,
  applyChatLimits,
  applyCreditLimits,
  buildDisplayMessagesForChat,
  upsertChatHistoryEntryLocally,
  setServerContextWindowUsage,
}) {
  // Monotonic counter used to invalidate superseded chat turns so a stale
  // stream can never clobber state from a newer request.
  const chatGenerationIdRef = useRef(0);
  const inputRef = useRef(input);
  inputRef.current = input;

  const sendChatTurn = async ({
    nextMessages,
    chatId = selectedChat?.chat_id || pendingChatIdRef.current,
    forkFromMessageId = null,
    sourceBranchId = selectedChat?.active_branch_id || null,
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
    if (abortController) {
      abortController.abort();
    }

    // Claim a new generation token so any response from the cancelled request
    // (chunk, done, error, or finally) is treated as stale and ignored.
    const requestGenerationId = ++chatGenerationIdRef.current;

    setSending(true);
    setIsStreaming(true);

    if (clearDraftOnComplete) {
      saveChatDraft(pendingDraftKey, draftInputToClear);
      setInput('');
    }

    const requestMessages = compactMessagesForRequest(nextMessages);
    const baseMessageCount = Array.isArray(nextMessages) ? nextMessages.length : 0;
    const controller = new AbortController();
    const assistantMessageId = generateMessageId();
    setAbortController(controller);
    setMessages(ensureMessageIds([...nextMessages, { role: 'assistant', content: '', message_id: assistantMessageId, is_pinned: false, created_at: createLocalMessageTimestamp() }]));

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
          base_message_count: baseMessageCount,
          scene_id: sceneOverride?.id || null,
          persona_id: personaOverride?.id || null,
          messages: requestMessages,
          context_messages: nextMessages,
          full_messages: nextMessages,
          chat_config: advancedChatConfig,
          // Minutes east of UTC so the backend can stamp the user's local
          // wall clock on the request copy (prompt-only, never stored).
          timezone_offset_minutes: -new Date().getTimezoneOffset(),
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
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
          setMessages(ensureMessageIds(restoreMessagesOnError));
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
          setMessages((prev) => {
            const newMessages = [...prev];
            // Spread the placeholder so the timestamp it was created with (and
            // anything else the message carries) survives the stream.
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              role: 'assistant',
              content: accumulatedReply,
              message_id: assistantMessageId,
              is_pinned: false,
            };
            return ensureMessageIds(newMessages);
          });
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
            setServerContextWindowUsage(data.context_window);
          }
          if (data.chat_entry) {
            const nextChatEntry = upsertChatHistoryEntryLocally(data.chat_entry);
            setMessages(buildDisplayMessagesForChat(nextChatEntry, characterOverride, sceneOverride, personaOverride));
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
        setMessages(ensureMessageIds(restoreMessagesOnError));
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
      setMessages(ensureMessageIds(restoreMessagesOnError));
      restoreSentDraft();
    } finally {
      // Only the latest request may clear sending/streaming state.
      if (requestGenerationId === chatGenerationIdRef.current) {
        setSending(false);
        setIsStreaming(false);
        setAbortController(null);
      }
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (isCreditLocked(creditLimits)) {
      toast.show('已达到点数上限，暂时无法继续对话。', { type: 'warning' });
      return;
    }
    if (sending || !input.trim() || !selectedCharacter) return;
    saveChatDraft(draftStorageKey, input);
    const updatedMessages = ensureMessageIds([...messages, { role: 'user', content: input.trim(), message_id: generateMessageId(), is_pinned: false, created_at: createLocalMessageTimestamp() }]);
    setMessages(updatedMessages);
    await sendChatTurn({
      nextMessages: updatedMessages,
      sourceBranchId: selectedChat?.active_branch_id || null,
      restoreMessagesOnError: messages,
      clearDraftOnComplete: true,
      draftInputToClear: input,
      draftKeyToClear: draftStorageKey,
    });
  };

  return { sendChatTurn, handleSend };
}
