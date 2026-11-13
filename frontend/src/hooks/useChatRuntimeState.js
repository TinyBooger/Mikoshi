import { useCallback, useSyncExternalStore } from 'react';

const createChatRuntimeState = () => ({
  messages: [],
  // The list subscribes to row structure; each bubble subscribes to its own
  // message so content chunks do not re-render the list.
  messageList: [],
  // Updated after a turn, not on each streaming chunk.
  contextUsageMessages: [],
  sendStatus: { sending: false, isStreaming: false },
  serverContextWindowUsage: null,
});

export function createChatRuntimeStore() {
  let state = createChatRuntimeState();
  const listeners = new Map(['messages', 'messageList', 'contextUsageMessages', 'sendStatus', 'serverContextWindowUsage']
    .map((key) => [key, new Set()]));
  const messageListeners = new Map();
  let messagesById = new Map();
  let messageIndexes = new Map();

  const notify = (key) => listeners.get(key)?.forEach((listener) => listener());
  const indexMessages = (messages) => new Map(
    messages
      .filter((message) => message?.message_id)
      .map((message) => [message.message_id, message]),
  );
  const hasSameMessageStructure = (previous, next) => (
    previous.length === next.length
    && previous.every((message, index) => {
      const nextMessage = next[index];
      if (!message?.message_id || !nextMessage?.message_id) return message === nextMessage;
      return message.message_id === nextMessage.message_id
        && message.role === nextMessage.role
        && message.created_at === nextMessage.created_at;
    })
  );
  const setMessages = (update, { updateContextUsage = true } = {}) => {
    const previousMessages = state.messages;
    const nextMessages = typeof update === 'function' ? update(previousMessages) : update;
    if (Object.is(previousMessages, nextMessages)) return;

    const previousById = messagesById;
    messagesById = indexMessages(nextMessages);
    messageIndexes = new Map();
    nextMessages.forEach((message, index) => {
      if (message?.message_id) messageIndexes.set(message.message_id, index);
    });
    state = { ...state, messages: nextMessages };
    notify('messages');

    const changedMessageIds = new Set([...previousById.keys(), ...messagesById.keys()]);
    changedMessageIds.forEach((messageId) => {
      if (Object.is(previousById.get(messageId), messagesById.get(messageId))) return;
      messageListeners.get(messageId)?.forEach((listener) => listener());
    });

    if (!hasSameMessageStructure(state.messageList, nextMessages)) {
      state = { ...state, messageList: nextMessages };
      notify('messageList');
    }

    if (updateContextUsage && !Object.is(state.contextUsageMessages, nextMessages)) {
      state = { ...state, contextUsageMessages: nextMessages };
      notify('contextUsageMessages');
    }
  };
  const updateMessage = (messageId, update) => {
    const index = messageIndexes.get(messageId);
    if (index === undefined) return;

    const previousMessage = state.messages[index];
    const nextMessage = typeof update === 'function' ? update(previousMessage) : update;
    if (Object.is(previousMessage, nextMessage)) return;

    messagesById.set(messageId, nextMessage);
    const nextMessages = state.messages.slice();
    nextMessages[index] = nextMessage;
    state = { ...state, messages: nextMessages };
    notify('messages');
    messageListeners.get(messageId)?.forEach((listener) => listener());
  };

  return {
    get(key) {
      return state[key];
    },
    set(key, update) {
      if (key === 'messages') {
        setMessages(update);
        return;
      }
      const previousValue = state[key];
      const nextValue = typeof update === 'function' ? update(previousValue) : update;
      if (Object.is(previousValue, nextValue)) return;

      state = { ...state, [key]: nextValue };
      notify(key);
    },
    setMessages,
    updateMessage,
    getMessage(messageId) {
      return messagesById.get(messageId) || null;
    },
    subscribe(key, listener) {
      const keyListeners = listeners.get(key);
      if (!keyListeners) return () => {};
      keyListeners.add(listener);
      return () => keyListeners.delete(listener);
    },
    subscribeMessage(messageId, listener) {
      if (!messageId) return () => {};
      let keyListeners = messageListeners.get(messageId);
      if (!keyListeners) {
        keyListeners = new Set();
        messageListeners.set(messageId, keyListeners);
      }
      keyListeners.add(listener);
      return () => {
        keyListeners.delete(listener);
        if (keyListeners.size === 0) messageListeners.delete(messageId);
      };
    },
    refreshContextUsage() {
      if (Object.is(state.contextUsageMessages, state.messages)) return;
      state = { ...state, contextUsageMessages: state.messages };
      notify('contextUsageMessages');
    },
  };
}

export function useChatRuntimeValue(store, key) {
  const subscribe = useCallback(
    (listener) => store.subscribe(key, listener),
    [store, key],
  );
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useChatRuntimeMessage(store, messageId) {
  const subscribe = useCallback(
    (listener) => store.subscribeMessage(messageId, listener),
    [store, messageId],
  );
  const getSnapshot = useCallback(
    () => store.getMessage(messageId),
    [store, messageId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
