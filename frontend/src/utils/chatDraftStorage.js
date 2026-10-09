const CHAT_DRAFT_PREFIX = 'chat_draft_v1';

const encodeKeyPart = (value) => encodeURIComponent(String(value ?? ''));

export const getChatDraftStorageKeys = ({
  userId,
  chatId,
  characterId,
  sceneId,
  personaId,
}) => {
  if (!userId) return { activeKey: null, fallbackKey: null };

  const userKey = encodeKeyPart(userId);
  const contextKey = [
    encodeKeyPart(characterId || 'no-character'),
    encodeKeyPart(sceneId || 'no-scene'),
    encodeKeyPart(personaId || 'no-persona'),
  ].join(':');
  const fallbackKey = `${CHAT_DRAFT_PREFIX}:${userKey}:context:${contextKey}`;

  return chatId
    ? {
        activeKey: `${CHAT_DRAFT_PREFIX}:${userKey}:chat:${encodeKeyPart(chatId)}`,
        fallbackKey,
      }
    : {
        activeKey: fallbackKey,
        fallbackKey: null,
      };
};

export const loadChatDraft = (activeKey, fallbackKey = null) => {
  if (!activeKey) return '';

  try {
    const activeDraft = localStorage.getItem(activeKey);
    const pendingKey = getChatDraftPendingStorageKey(activeKey);
    const pendingDraft = pendingKey ? localStorage.getItem(pendingKey) : null;
    if (pendingDraft !== null) {
      const restoredDraft = activeDraft && activeDraft !== pendingDraft
        ? `${pendingDraft}\n${activeDraft}`
        : pendingDraft;
      localStorage.setItem(activeKey, restoredDraft);
      localStorage.removeItem(pendingKey);
      return restoredDraft;
    }
    if (activeDraft !== null) return activeDraft;

    if (!fallbackKey) return '';
    const fallbackDraft = localStorage.getItem(fallbackKey);
    if (fallbackDraft === null) return '';

    localStorage.setItem(activeKey, fallbackDraft);
    localStorage.removeItem(fallbackKey);
    return fallbackDraft;
  } catch (error) {
    console.warn('Unable to restore chat draft from local storage:', error);
    return '';
  }
};

export const getChatDraftPendingStorageKey = (storageKey) =>
  storageKey ? `${storageKey}:pending-send` : null;

export const saveChatDraft = (storageKey, draft) => {
  if (!storageKey) return;

  try {
    if (draft) {
      localStorage.setItem(storageKey, draft);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.warn('Unable to save chat draft to local storage:', error);
  }
};

export const removeChatDraft = (storageKey) => {
  if (!storageKey) return;

  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Unable to remove chat draft from local storage:', error);
  }
};
