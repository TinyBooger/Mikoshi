import { useRef, useCallback } from 'react';
import { useToast } from '../components/ToastProvider';
import { ensureMessageIds, generateMessageId } from '../utils/chatHelpers';
import { isCreditLocked } from '../utils/creditCheck';

/**
 * Hook for sending chat turns with SSE streaming.
 *
 * Parameters are all provided as a config object so the hook stays pure
 * and doesn't directly couple to ChatPage's state.
 */
export function useChatStream({
  selectedChat,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  advancedChatConfig,
  characterId,
  sessionToken,
  applyChatLimits,
  applyCreditLimits,
  refreshUserData,
  upsertChatHistoryEntryLocally,
  buildDisplayMessagesForChat,
  compactMessagesForRequest,
  getChatErrorMessage,
}) {
  const toast = useToast();

  // ---- Abort management ----
  const abortControllerRef = useRef(null);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // ---- The core SSE send function ----
  const sendChatTurn = useCallback(async ({
    nextMessages,
    chatId = selectedChat?.chat_id,
    forkFromMessageId = null,
    sourceBranchId = selectedChat?.active_branch_id || null,
    restoreMessagesOnError = nextMessages,
    errorMessage = 'Failed to send message. Please try again.',
    characterOverride = selectedCharacter,
    sceneOverride = selectedScene,
    personaOverride = selectedPersona,
  }) => {
    if (!characterOverride) return;

    const requestMessages = compactMessagesForRequest(nextMessages);
    const controller = new AbortController();
    const assistantMessageId = generateMessageId();
    abortControllerRef.current = controller;

    // We need setMessages / setSending / setIsStreaming from the caller.
    // Return a thunk so the caller can wire in state setters.
    return {
      controller,
      assistantMessageId,
      execute: async ({ setMessages, setSending, setIsStreaming, setServerContextWindowUsage }) => {
        setSending(true);
        setIsStreaming(true);

        const initialMessages = ensureMessageIds([
          ...nextMessages,
          { role: 'assistant', content: '', message_id: assistantMessageId, is_pinned: false },
        ]);
        setMessages(initialMessages);

        try {
          const response = await fetch(`${window.API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': sessionToken,
            },
            body: JSON.stringify({
              character_id: characterOverride?.id || characterId,
              chat_id: chatId,
              branch_id: sourceBranchId,
              fork_from_message_id: forkFromMessageId,
              scene_id: sceneOverride?.id || null,
              persona_id: personaOverride?.id || null,
              messages: requestMessages,
              context_messages: nextMessages,
              full_messages: nextMessages,
              chat_config: advancedChatConfig,
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

          const processEventPayload = (rawPayload) => {
            const payload = rawPayload
              .split('\n')
              .filter((line) => line.startsWith('data: '))
              .map((line) => line.slice(6))
              .join('\n');

            if (!payload) return;

            let data;
            try {
              data = JSON.parse(payload);
            } catch {
              // Malformed SSE payload — ignore silently
              return;
            }

            if (data.error) {
              const friendlyMessage = getChatErrorMessage(data);
              toast.show(friendlyMessage, { type: 'error' });
              if (data.credit_limits) applyCreditLimits(data.credit_limits);
              if (data.limits) applyChatLimits(data.limits);
              return;
            }

            if (data.chunk) {
              accumulatedReply += data.chunk;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: accumulatedReply,
                  message_id: assistantMessageId,
                  is_pinned: false,
                };
                return ensureMessageIds(newMessages);
              });
            }

            if (data.done) {
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
                setMessages(buildDisplayMessagesForChat(nextChatEntry));
              } else {
                setMessages(ensureMessageIds([
                  ...nextMessages,
                  { role: 'assistant', content: accumulatedReply, message_id: assistantMessageId, is_pinned: false },
                ]));
              }
            }
          };

          // ---- SSE read loop ----
          while (true) {
            const { done, value } = await reader.read();
            pendingEventBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            const events = pendingEventBuffer.split('\n\n');
            pendingEventBuffer = events.pop() || '';

            for (const eventPayload of events) {
              processEventPayload(eventPayload);
            }

            if (done) break;
          }

          if (pendingEventBuffer.trim()) {
            processEventPayload(pendingEventBuffer);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            toast.show(err.message || errorMessage, { type: 'error' });
          }
          setMessages(ensureMessageIds(restoreMessagesOnError));
        } finally {
          setSending(false);
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      },
    };
  }, [
    selectedChat, selectedCharacter, selectedScene, selectedPersona,
    advancedChatConfig, characterId, sessionToken,
    applyChatLimits, applyCreditLimits, refreshUserData,
    upsertChatHistoryEntryLocally, buildDisplayMessagesForChat,
    compactMessagesForRequest, getChatErrorMessage, toast,
  ]);

  return {
    sendChatTurn,
    abortStream,
    abortControllerRef,
  };
}
