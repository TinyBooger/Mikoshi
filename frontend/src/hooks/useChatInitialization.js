import { useEffect, useRef, useState } from 'react';
import { normalizeChatEntry, ensureMessageIds, generateMessageId } from '../utils/chatHelpers';
import { SPECIAL_IMPROVISING_GREETING, DEFAULT_ADVANCED_CHAT_CONFIG } from '../utils/chatPageConstants';

/**
 * Chat lifecycle controller: route/entry handling, greeting generation, history
 * loading, and the "new chat" action.
 *
 * This intentionally owns several pieces of state that only it writes
 * (`initLoading`, `advancedChatConfirm`) while the rest stays in ChatPage and is
 * passed in — splitting shared state into two copies would risk desync, so the
 * rule here is "one owner per piece of state".
 *
 * @param {object}   params
 * @param {object}   params.searchParams                     - current URL search params
 * @param {function} params.navigate                         - router navigate
 * @param {boolean}  params.loading                          - auth loading flag
 * @param {string}   params.sessionToken                     - auth session token
 * @param {object}   params.userData                         - user (chat_history, default_persona)
 * @param {string}   params.characterId                      - character id from route/state
 * @param {function} params.setCharacterId                   - setter for characterId
 * @param {string}   params.sceneId                          - scene id from route/state
 * @param {function} params.setSceneId                       - setter for sceneId
 * @param {object}   params.selectedCharacter                - active character
 * @param {function} params.setSelectedCharacter             - setter for selectedCharacter
 * @param {object}   params.selectedScene                    - active scene
 * @param {function} params.setSelectedScene                 - setter for selectedScene
 * @param {object}   params.selectedPersona                  - active persona
 * @param {function} params.setSelectedPersona               - setter for selectedPersona
 * @param {function} params.setSelectedChat                  - setter for selectedChat
 * @param {function} params.setMessages                      - setter for messages
 * @param {function} params.setInput                         - setter for the input value
 * @param {function} params.setServerContextWindowUsage      - setter for server usage
 * @param {function} params.setLikes                         - setter for the like count
 * @param {function} params.setHasLiked                      - setter for the liked map
 * @param {function} params.setAdvancedChatConfig            - setter for the chat config
 * @param {function} params.normalizeAdvancedChatConfig      - character ⇒ config normalizer
 * @param {function} params.applyCharacterBackground         - character ⇒ wallpaper applier
 * @param {boolean}  params.isProUser                        - pro status (advanced-char gate)
 * @param {function} params.setInitModal                     - setter for the scene-select modal
 * @param {function} params.setShowChatHistory               - setter for the history drawer
 * @param {function} params.setEditingMessageId              - setter for editingMessageId
 * @param {function} params.setEditingMessageText            - setter for editingMessageText
 * @param {object}   params.isNewChat                        - ref: is this a fresh chat
 * @param {object}   params.initialized                      - ref: init guard
 * @param {object}   params.pendingChatIdRef                 - reserved chat id (shared with send)
 * @param {function} params.sendChatTurn                     - streaming send (from useChatSend)
 * @param {function} params.buildSystemPromptMessage         - builds the system message
 * @param {function} params.buildDisplayMessagesForChat      - branch messages ⇒ display messages
 * @param {function} params.upsertChatHistoryEntryLocally    - history upsert helper
 * @param {object}   params.toast                            - toast provider
 * @returns {object} init flow handlers + state read by the render tree
 */
export function useChatInitialization({
  searchParams,
  navigate,
  loading,
  sessionToken,
  userData,
  characterId,
  setCharacterId,
  sceneId,
  setSceneId,
  selectedCharacter,
  setSelectedCharacter,
  selectedScene,
  setSelectedScene,
  selectedPersona,
  setSelectedPersona,
  setSelectedChat,
  setMessages,
  setInput,
  setServerContextWindowUsage,
  setLikes,
  setHasLiked,
  setAdvancedChatConfig,
  normalizeAdvancedChatConfig,
  applyCharacterBackground,
  isProUser,
  setInitModal,
  setShowChatHistory,
  setEditingMessageId,
  setEditingMessageText,
  isNewChat,
  initialized,
  pendingChatIdRef,
  sendChatTurn,
  buildSystemPromptMessage,
  buildDisplayMessagesForChat,
  upsertChatHistoryEntryLocally,
  toast,
}) {
  // Loading state for initial data fetch. Starts as true when the page opens
  // directly into a character/scene route, so the first paint shows a plain
  // spinner instead of a half-loaded chat (no name, fallback avatar) before
  // the entry handler below kicks off its fetches.
  const [initLoading, setInitLoading] = useState(() =>
    Boolean(searchParams.get('character') || searchParams.get('scene')),
  );

  // Heads-up shown to free users before starting a chat with an advanced
  // character (long description ⇒ higher token/point consumption).
  const [advancedChatConfirm, setAdvancedChatConfirm] = useState(false);
  const pendingAdvancedChatStartRef = useRef(null);
  const prevSearchParamsRef = useRef(searchParams);

  const handleCharacterEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const characterMatches = String(h.character_id) === String(characterId);
        return characterMatches;
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initialized.current = true;
        return;
      }

      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error handling character entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  const handleSceneEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const sceneMatches = String(h.scene_id) === String(sceneId);
        return sceneMatches;
      }) || [];

      if (existingChats.length > 0) {
        const mostRecentChat = existingChats.sort(
          (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
        )[0];
        await loadChat(mostRecentChat);
        initialized.current = true;
        return;
      }

      setInitModal(true);
    } catch (err) {
      console.error('Error handling scene entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Reset chat state on navigation, then trigger initialization once auth is ready.
  // Keeping these in one effect guarantees the reset and the initialization guard
  // are always evaluated in the same React batch — eliminating the race where the
  // reset effect would clear initialized.current while the async handler was
  // mid-flight (most visible as a double-fire in React StrictMode).
  useEffect(() => {
    const searchParamsChanged = searchParams !== prevSearchParamsRef.current;
    prevSearchParamsRef.current = searchParams;

    console.trace('[searchParams effect] fired', { 
      prev: prevSearchParamsRef.current?.toString(), 
      next: searchParams?.toString() 
    });

    if (searchParamsChanged) {
      setCharacterId(searchParams.get('character'));
      setSceneId(searchParams.get('scene'));
      if (!searchParams.get('character')) setSelectedCharacter(null);
      if (!searchParams.get('scene')) setSelectedScene(null);
      setSelectedPersona(null);
      setSelectedChat(null);
      pendingChatIdRef.current = null;
      setMessages([]);
      setEditingMessageId(null);
      setEditingMessageText('');
      setServerContextWindowUsage(null);
      isNewChat.current = true;
      setInitModal(false);
      // Dismiss the advanced-character confirm if the route changes while it
      // is open, so a stale confirm can never start the old character's chat
      // in a new context.
      setAdvancedChatConfirm(false);
      pendingAdvancedChatStartRef.current = null;
      initialized.current = false;
    }

    if (loading) return;
    if (!sessionToken) { navigate('/'); return; }
    if (initialized.current) return;

    // Claim the slot synchronously so concurrent calls (e.g. StrictMode
    // double-fire, rapid auth state changes) see it as taken immediately.
    initialized.current = true;

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

  // Reusable function to start chat with current selections (used by modal and direct entry)
  const startChatWithSelectedEntities = async () => {
    isNewChat.current = true;
    setInitModal(false);
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      initializeChat(fetchedData);
    } catch (err) {
      console.error('Error initializing chat:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Start chat after choosing a character for a scene entry
  const startChatFromSceneSelection = async () => {
    if (!selectedCharacter) return;
    setCharacterId(selectedCharacter.id || null);
    isNewChat.current = true;
    setInitModal(false);
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error initializing chat from scene selection:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Fetch character and scene data if IDs are present
  const fetchInitialData = () => {
    setInitLoading(true);
    return new Promise((resolve, reject) => {
      const promises = [];
      let character = null;
      let scene = null;

      if (characterId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${characterId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => {
              if (!res.ok) throw new Error('Character not found');
              return res.json();
            })
            .then(data => {
              character = data;
              setSelectedCharacter(data);
              setAdvancedChatConfig(normalizeAdvancedChatConfig(data));
              applyCharacterBackground(data.background, data);
              setLikes(data.likes || 0);
              // Fetch user's per-character config delta and merge on top of defaults
              return fetch(`${window.API_BASE_URL}/api/user-character-config/${characterId}`, {
                headers: { 'Authorization': sessionToken }
              }).then(res => res.ok ? res.json() : null).then(configData => {
                const delta = configData?.config || {};
                // Drop the retired context_window_tier key from historical deltas.
                delete delta.context_window_tier;
                if (Object.keys(delta).length > 0) {
                  setAdvancedChatConfig(prev => {
                    const merged = { ...prev };
                    for (const [key, value] of Object.entries(delta)) {
                      if (value !== undefined && value !== null) merged[key] = value;
                    }
                    return merged;
                  });
                }
                return data;
              }).catch(() => data);
            })
            .catch(err => {
              console.error('Error fetching character:', err);
              toast.show('加载角色失败，角色可能已被删除。', { type: 'error' });
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
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              scene = data;
              setSelectedScene(data);
              return data;
            })
            .catch(err => {
              console.error('Error fetching scene:', err);
              setSelectedScene(null);
              return null;
            })
        );
      } else {
        setSelectedScene(null);
      }

      // Load default persona if user has one and no persona is already selected
      let persona = null;
      if (userData?.default_persona && !selectedPersona) {
        persona = userData.default_persona;
        setSelectedPersona(persona);
      } else if (selectedPersona) {
        persona = selectedPersona;
      } else {
        setSelectedPersona(null);
      }

      // Fetch liked status for available entities
      if (characterId || sceneId) {
        const params = [];
        if (characterId) params.push(`character_id=${characterId}`);
        if (sceneId) params.push(`scene_id=${sceneId}`);
        if (persona?.id) params.push(`persona_id=${persona.id}`);
        promises.push(
          fetch(`${window.API_BASE_URL}/api/is-liked-multi?${params.join('&')}`, {
            credentials: 'include',
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.json())
            .then(data => {
              setHasLiked({
                character: data.character ? !!data.character.liked : false,
                scene: data.scene ? !!data.scene.liked : false,
                persona: data.persona ? !!data.persona.liked : false
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

      Promise.all(promises).then(() => {
        setInitLoading(false);
        // Return the persona that was loaded (default or null)
        resolve({ character, scene, persona });
      }).catch(err => {
        setInitLoading(false);
        reject(err);
      });
    });
  };

  const initializeChat = (fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    // Set likes and creator from selectedCharacter
    if (characterId) {
      // Increment views for character, scene, and persona in one call
      const body = {
        ...(character && { character_id: character.id }),
        ...(scene && { scene_id: scene.id }),
        ...(persona && { persona_id: persona.id })
      };
      fetch(`${window.API_BASE_URL}/api/views/increment-multi`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify(body)
      });
    }
    initialized.current = true;
    if(isNewChat.current) {
      startNewChat(fetchedData);
    }
  };

  const startNewChat = async (fetchedData) => {
    const { character } = fetchedData || {};

    // Free users starting a chat with an advanced character (long description
    // ⇒ higher token/point consumption) get a heads-up before the chat begins.
    // This fires after character data has loaded but before the first greeting
    // message is generated/sent.
    if (!isProUser && character?.context_label === 'advanced') {
      pendingAdvancedChatStartRef.current = fetchedData;
      setAdvancedChatConfirm(true);
      return;
    }

    await proceedStartNewChat(fetchedData);
  };

  const proceedStartNewChat = async (fetchedData) => {
    const { character, scene, persona } = fetchedData || {};
    const sys = buildSystemPromptMessage(character, scene, persona);

    // For scenes, keep existing logic (scene.greeting is still a string)
    // For characters, greetings is now a list; pick one randomly
    let openingGreeting = null;
    let useImprovise = false;

    if (scene) {
      const sceneGreeting = typeof scene?.greeting === 'string' && scene.greeting.trim()
        ? scene.greeting.trim()
        : SPECIAL_IMPROVISING_GREETING;
      if (sceneGreeting === SPECIAL_IMPROVISING_GREETING) {
        useImprovise = true;
      } else {
        openingGreeting = sceneGreeting;
      }
    } else if (character?.greetings?.length) {
      const manualGreetings = character.greetings.filter(g => g !== SPECIAL_IMPROVISING_GREETING);
      const hasImprovise = character.greetings.includes(SPECIAL_IMPROVISING_GREETING);

      // Build pool: manual greetings + optional improvise slot
      const pool = [...manualGreetings];
      if (hasImprovise) pool.push(SPECIAL_IMPROVISING_GREETING);

      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick === SPECIAL_IMPROVISING_GREETING) {
          useImprovise = true;
        } else {
          openingGreeting = pick;
        }
      }
    }

    setSelectedChat(null);
    pendingChatIdRef.current = null;
    setInput('');

    if (useImprovise) {
      // Reserve the chat_id up front (mirroring the backend's uuid.uuid4())
      // so a message sent while this greeting is still streaming reuses the
      // same chat instead of minting a second, orphaned chat_id.
      pendingChatIdRef.current = generateMessageId();
      setMessages([sys]);
      await sendChatTurn({
        nextMessages: [sys],
        chatId: pendingChatIdRef.current,
        sourceBranchId: null,
        restoreMessagesOnError: [sys],
        errorMessage: '生成问候失败，请重试。',
        characterOverride: character,
        sceneOverride: scene,
        personaOverride: persona,
      });
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
  };

  const handleAdvancedChatConfirm = () => {
    setAdvancedChatConfirm(false);
    const pending = pendingAdvancedChatStartRef.current;
    pendingAdvancedChatStartRef.current = null;
    if (pending) {
      proceedStartNewChat(pending);
    }
  };

  const handleAdvancedChatExit = () => {
    setAdvancedChatConfirm(false);
    pendingAdvancedChatStartRef.current = null;
    // Exiting means not starting this chat at all — go back to where the
    // user came from. Falls back to the chat page's default state if there
    // is no history entry.
    navigate(-1);
  };

  const loadChat = async (chat) => {
    try {
      const normalizedChat = normalizeChatEntry(chat);
      if (!normalizedChat) return;

      // Update IDs from the chat entry
      setCharacterId(normalizedChat.character_id || null);
      setSceneId(normalizedChat.scene_id || null);

      // Fetch all required entities in parallel
      const promises = [];
      let character = selectedCharacter;
      let scene = null;
      let persona = null;

      // Only fetch if we don't have it or if it's different
      if (!character || character.id !== normalizedChat.character_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${normalizedChat.character_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              character = data;
              setSelectedCharacter(data);
            })
            .catch(err => console.error('Error loading character:', err))
        );
      }

      if (normalizedChat.scene_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${normalizedChat.scene_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => { scene = data; setSelectedScene(data); })
            .catch(err => console.error('Error loading scene:', err))
        );
      } else {
        setSelectedScene(null);
      }

      if (normalizedChat.persona_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/personas/${normalizedChat.persona_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => { persona = data; setSelectedPersona(data); })
            .catch(err => console.error('Error loading persona:', err))
        );
      } else {
        setSelectedPersona(null);
      }

      await Promise.all(promises);

      // Load character defaults + user delta in one atomic state update
      // (avoid the intermediate render with character defaults that
      //  would overwrite the correct config set by fetchInitialData)
      if (character?.id) {
        fetch(`${window.API_BASE_URL}/api/user-character-config/${character.id}`, {
          headers: { 'Authorization': sessionToken }
        }).then(res => res.ok ? res.json() : null).then(data => {
          const defaults = normalizeAdvancedChatConfig(character);
          const delta = data?.config || {};
          // Drop the retired context_window_tier key from historical deltas.
          delete delta.context_window_tier;
          const merged = { ...defaults };
          for (const [key, value] of Object.entries(delta)) {
            if (value !== undefined && value !== null) merged[key] = value;
          }
          setAdvancedChatConfig(merged);
        }).catch(() => {
          setAdvancedChatConfig(normalizeAdvancedChatConfig(character));
        });
      } else {
        setAdvancedChatConfig(normalizeAdvancedChatConfig(character));
      }
      applyCharacterBackground(character?.background, character);

      // Refresh liked status for the loaded entities
      const likeParams = [];
      if (normalizedChat.character_id) likeParams.push(`character_id=${normalizedChat.character_id}`);
      if (normalizedChat.scene_id) likeParams.push(`scene_id=${normalizedChat.scene_id}`);
      if (normalizedChat.persona_id) likeParams.push(`persona_id=${normalizedChat.persona_id}`);

      if (likeParams.length > 0) {
        fetch(`${window.API_BASE_URL}/api/is-liked-multi?${likeParams.join('&')}`, {
          credentials: 'include',
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            setHasLiked({
              character: data?.character ? !!data.character.liked : false,
              scene: data?.scene ? !!data.scene.liked : false,
              persona: data?.persona ? !!data.persona.liked : false,
            });
          })
          .catch(() => setHasLiked({ character: false, scene: false, persona: false }));
      } else {
        setHasLiked({ character: false, scene: false, persona: false });
      }

      const normalizedLoadedChat = normalizeChatEntry({
        ...normalizedChat,
        last_updated: normalizedChat.last_updated || new Date().toISOString(),
      });

      setMessages(buildDisplayMessagesForChat(normalizedLoadedChat, character, scene, persona));
      setSelectedChat(normalizedLoadedChat);

      // Mark as existing chat so the welcome block is not shown for persisted threads
      isNewChat.current = false;
      setShowChatHistory(false);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.show('加载对话失败，请重试。', { type: 'error' });
    }
  };

  // Unified new chat action respecting current entry mode
  const handleNewChat = async () => {
    setSelectedChat(null);
    pendingChatIdRef.current = null;
    setMessages([]);
    setEditingMessageId(null);
    setEditingMessageText('');
    isNewChat.current = true;

    if (sceneId || selectedScene) {
      setSelectedCharacter(null);
      setCharacterId(null);
      setInitModal(true);
      return;
    }

    if (selectedCharacter || characterId) {
      await startChatWithSelectedEntities();
      initialized.current = true;
      return;
    }

    setInitModal(true);
  };

  return {
    initLoading,
    advancedChatConfirm,
    handleCharacterEntry,
    handleSceneEntry,
    startChatWithSelectedEntities,
    startChatFromSceneSelection,
    initializeChat,
    loadChat,
    handleNewChat,
    handleAdvancedChatConfirm,
    handleAdvancedChatExit,
  };
}
