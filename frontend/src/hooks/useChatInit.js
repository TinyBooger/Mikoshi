import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastProvider';
import { buildSystemMessage } from '../utils/systemTemplate';
import {
  ensureMessageIds,
  generateMessageId,
  normalizeChatEntry,
  normalizeChatBranch,
} from '../utils/chatHelpers';

const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
const SUMMARY_PREFIX = 'Summary of previous conversation:';

/**
 * Hook that encapsulates all chat initialization logic:
 * - fetchInitialData
 * - initializeChat
 * - startNewChat
 * - handleCharacterEntry / handleSceneEntry
 * - the main init useEffect
 */
export function useChatInit({
  // State (read + write)
  characterId, setCharacterId,
  sceneId, setSceneId,
  selectedCharacter, setSelectedCharacter,
  selectedScene, setSelectedScene,
  selectedPersona, setSelectedPersona,
  selectedChat, setSelectedChat,
  messages, setMessages,
  advancedChatConfig, setAdvancedChatConfig,
  likes, setLikes,
  hasLiked, setHasLiked,
  wallpaper, setWallpaper,
  characterBackground, setCharacterBackground,

  // Auth
  userData, setUserData, sessionToken, loading, refreshUserData,

  // Config helpers
  normalizeAdvancedChatConfig,
  applyCharacterBackground,
  buildSystemPromptMessage,
  buildDisplayMessagesForChat,

  // Modals
  setInitModal, setCharacterModal, setPersonaModal,
  initModal,

  // Other
  sendChatTurn,
  isNewChatRef,
  initializedRef,
  searchParams,
  prevSearchParamsRef,
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  // ---- fetchInitialData ----
  const fetchInitialData = useCallback(() => {
    return new Promise((resolve, reject) => {
      const promises = [];
      let character = null;
      let scene = null;

      if (characterId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${characterId}`, {
            headers: { 'Authorization': sessionToken },
          })
            .then((res) => {
              if (!res.ok) throw new Error('Character not found');
              return res.json();
            })
            .then((data) => {
              character = data;
              setSelectedCharacter(data);
              setAdvancedChatConfig(normalizeAdvancedChatConfig(data));
              applyCharacterBackground(data.background, data);
              setLikes(data.likes || 0);
              return data;
            })
            .catch((err) => {
              console.error('Error fetching character:', err);
              toast.show(t('chat.error_loading_character') || 'Failed to load character.', { type: 'error' });
              setSelectedCharacter(null);
              return null;
            })
        );
      } else {
        if (selectedCharacter?.id) {
          character = selectedCharacter;
          setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter));
          applyCharacterBackground(selectedCharacter?.background, selectedCharacter);
        } else {
          setSelectedCharacter(null);
          setAdvancedChatConfig(DEFAULT_ADVANCED_CHAT_CONFIG);
          applyCharacterBackground(null, null);
        }
      }

      if (sceneId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${sceneId}`, {
            headers: { 'Authorization': sessionToken },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              scene = data;
              setSelectedScene(data);
              return data;
            })
            .catch((err) => {
              console.error('Error fetching scene:', err);
              setSelectedScene(null);
              return null;
            })
        );
      } else {
        setSelectedScene(null);
      }

      // Load default persona
      let persona = null;
      if (userData?.default_persona && !selectedPersona) {
        persona = userData.default_persona;
        setSelectedPersona(persona);
      } else if (selectedPersona) {
        persona = selectedPersona;
      } else {
        setSelectedPersona(null);
      }

      // Fetch liked status
      if (characterId || sceneId) {
        const params = [];
        if (characterId) params.push(`character_id=${characterId}`);
        if (sceneId) params.push(`scene_id=${sceneId}`);
        if (persona?.id) params.push(`persona_id=${persona.id}`);
        promises.push(
          fetch(`${window.API_BASE_URL}/api/is-liked-multi?${params.join('&')}`, {
            credentials: 'include',
            headers: { 'Authorization': sessionToken },
          })
            .then((res) => res.json())
            .then((data) => {
              setHasLiked({
                character: data.character ? !!data.character.liked : false,
                scene: data.scene ? !!data.scene.liked : false,
                persona: data.persona ? !!data.persona.liked : false,
              });
              return data;
            })
            .catch(() => {
              setHasLiked({ character: false, scene: false, persona: false });
              return null;
            })
        );
      } else {
        setHasLiked({ character: false, scene: false, persona: false });
      }

      Promise.all(promises)
        .then(() => resolve({ character, scene, persona }))
        .catch(reject);
    });
  }, [
    characterId, sceneId, selectedCharacter, selectedPersona,
    sessionToken, userData, t, toast,
    normalizeAdvancedChatConfig, applyCharacterBackground,
    setSelectedCharacter, setSelectedScene, setSelectedPersona,
    setAdvancedChatConfig, setLikes, setHasLiked,
  ]);

  // ---- initializeChat ----
  const initializeChat = useCallback((fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    if (characterId) {
      const body = {
        ...(character && { character_id: character.id }),
        ...(scene && { scene_id: scene.id }),
        ...(persona && { persona_id: persona.id }),
      };
      fetch(`${window.API_BASE_URL}/api/views/increment-multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken,
        },
        body: JSON.stringify(body),
      });
    }
    initializedRef.current = true;
    if (isNewChatRef.current) {
      startNewChat(fetchedData);
    }
  }, [characterId, sessionToken]);

  // ---- startNewChat ----
  const startNewChat = useCallback(async (fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    const sys = buildSystemPromptMessage(character, scene, persona);
    const openingGreeting = scene
      ? (typeof scene?.greeting === 'string' && scene.greeting.trim()
          ? scene.greeting.trim()
          : SPECIAL_IMPROVISING_GREETING)
      : character?.greeting;

    setSelectedChat(null);
    setInput('');

    if (openingGreeting === SPECIAL_IMPROVISING_GREETING) {
      setMessages([sys]);
      const result = await sendChatTurn({
        nextMessages: [sys],
        chatId: null,
        sourceBranchId: null,
        restoreMessagesOnError: [sys],
        errorMessage: t('chat.error_generating_greeting') || 'Failed to generate greeting.',
        characterOverride: character,
        sceneOverride: scene,
        personaOverride: persona,
      });
      if (result?.execute) {
        await result.execute({
          setMessages,
          setSending: () => {},
          setIsStreaming: () => {},
          setServerContextWindowUsage: () => {},
        });
      }
      return;
    }

    let greet = null;
    if (openingGreeting) {
      greet = {
        role: 'assistant',
        content: openingGreeting,
        message_id: generateMessageId(),
        is_pinned: false,
      };
    }
    setMessages(ensureMessageIds(greet ? [sys, greet] : [sys]));
  }, [t, sendChatTurn, buildSystemPromptMessage]);

  // ---- handleCharacterEntry ----
  const handleCharacterEntry = useCallback(async () => {
    setInitModal(false);
    isNewChatRef.current = true;
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter((h) => {
        return String(h.character_id) === String(characterId);
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initializedRef.current = true;
        return;
      }

      initializeChat(fetchedData);
      initializedRef.current = true;
    } catch (err) {
      console.error('Error handling character entry:', err);
    }
  }, [characterId, userData, fetchInitialData, initializeChat]);

  // ---- handleSceneEntry ----
  const handleSceneEntry = useCallback(async () => {
    setInitModal(false);
    isNewChatRef.current = true;
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter((h) => {
        return String(h.scene_id) === String(sceneId);
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initializedRef.current = true;
        return;
      }

      setInitModal(true);
    } catch (err) {
      console.error('Error handling scene entry:', err);
    }
  }, [sceneId, userData, fetchInitialData]);

  // ---- Main init useEffect ----
  useEffect(() => {
    const searchParamsChanged = searchParams !== prevSearchParamsRef.current;
    prevSearchParamsRef.current = searchParams;

    if (searchParamsChanged) {
      setCharacterId(searchParams.get('character'));
      setSceneId(searchParams.get('scene'));
      if (!searchParams.get('character')) setSelectedCharacter(null);
      if (!searchParams.get('scene')) setSelectedScene(null);
      setSelectedPersona(null);
      setSelectedChat(null);
      setMessages([]);
      setServerContextWindowUsage(null);
      isNewChatRef.current = true;
      setInitModal(false);
      initializedRef.current = false;
    }

    if (loading) return;
    if (!sessionToken) { navigate('/'); return; }
    if (initializedRef.current) return;

    initializedRef.current = true;

    const entryMode = searchParams.get('scene')
      ? 'scene'
      : (searchParams.get('character') ? 'character' : null);

    switch (entryMode) {
      case 'scene':
        handleSceneEntry();
        return;
      case 'character':
        handleCharacterEntry();
        return;
      default:
        return;
    }
  }, [navigate, sessionToken, loading, searchParams]);

  return {
    fetchInitialData,
    initializeChat,
    startNewChat,
    handleCharacterEntry,
    handleSceneEntry,
  };
}

// Need these to be in scope for fetchInitialData; define here since they are constant
const DEFAULT_ADVANCED_CHAT_CONFIG = {
  model: 'deepseek-v4-flash',
  presence_penalty: 0,
  frequency_penalty: 0,
  context_window_tier: 'default',
};
