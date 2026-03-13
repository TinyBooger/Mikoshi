import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import CharacterModal from '../components/CharacterModal';
import CharacterSidebar from '../components/CharacterSidebar';
import PersonaModal from '../components/PersonaModal';
import SceneCharacterSelectModal from '../components/SceneCharacterSelectModal';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';

const WALLPAPER_OPTIONS = [
  { id: 'none', labelKey: 'chat.wallpaper_default', url: null },
  { id: 'aurora', labelKey: 'chat.wallpaper_aurora', url: '/wallpapers/aurora.svg' },
  { id: 'sunrise', labelKey: 'chat.wallpaper_sunrise', url: '/wallpapers/sunrise.svg' },
  { id: 'waves', labelKey: 'chat.wallpaper_waves', url: '/wallpapers/waves.svg' },
];

export default function ChatPage() {
  const { t } = useTranslation();
  // Sentinel used to indicate a character should have an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
  const SUMMARY_PREFIX = 'Summary of previous conversation:';
  const CLIENT_SOFT_TOKEN_LIMIT = 3000;
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const canUseAdvancedChatConfig = !!userData?.is_pro || Number(userData?.level || 1) >= 3;
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedWallpaperId, setSelectedWallpaperId] = useState(() => localStorage.getItem('chat.selectedWallpaper') || 'none');
  const [sending, setSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [chatLimits, setChatLimits] = useState(null);
  const [serverContextWindowUsage, setServerContextWindowUsage] = useState(null);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [hasLiked, setHasLiked] = useState({ character: false, scene: false, persona: false });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Whether the welcome notice has been dismissed (show only once per new chat)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Ref for textarea auto-resize
  const textareaRef = useRef(null);
  // Ref for messages container to enable auto-scrolling
  const messagesEndRef = useRef(null);

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const CHAT_INPUT_MAX_HEIGHT = 200;
  const CHAT_INPUT_BASE_HEIGHT = 44;
  const DEFAULT_ADVANCED_CHAT_CONFIG = {
    model: 'deepseek-chat',
    temperature: 1.3,
    top_p: 0.9,
    max_tokens: 250,
    presence_penalty: 0,
    frequency_penalty: 0,
  };
  const normalizeAdvancedChatConfig = (character) => {
    if (!canUseAdvancedChatConfig) {
      return DEFAULT_ADVANCED_CHAT_CONFIG;
    }
    if (!character) return DEFAULT_ADVANCED_CHAT_CONFIG;
    const clamp = (value, min, max, fallback) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(max, Math.max(min, parsed));
    };
    const model = character.model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    return {
      model,
      temperature: clamp(character.temperature, 0, 2, DEFAULT_ADVANCED_CHAT_CONFIG.temperature),
      top_p: clamp(character.top_p, 0, 1, DEFAULT_ADVANCED_CHAT_CONFIG.top_p),
      max_tokens: Math.round(clamp(character.max_tokens, 1, 8192, DEFAULT_ADVANCED_CHAT_CONFIG.max_tokens)),
      presence_penalty: clamp(character.presence_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.presence_penalty),
      frequency_penalty: clamp(character.frequency_penalty, -2, 2, DEFAULT_ADVANCED_CHAT_CONFIG.frequency_penalty),
    };
  };
  const [advancedChatConfig, setAdvancedChatConfig] = useState(DEFAULT_ADVANCED_CHAT_CONFIG);

  const [characterModal, setCharacterModal] = useState({ show: false });
  const [personaModal, setPersonaModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

  // Loading state for initial data fetch
  const [initLoading, setInitLoading] = useState(false);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup: abort any ongoing streaming request on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const selectedWallpaper = WALLPAPER_OPTIONS.find((option) => option.id === selectedWallpaperId) || WALLPAPER_OPTIONS[0];

  useEffect(() => {
    if (!WALLPAPER_OPTIONS.some((option) => option.id === selectedWallpaperId)) {
      setSelectedWallpaperId('none');
    }
  }, [selectedWallpaperId]);

  useEffect(() => {
    localStorage.setItem('chat.selectedWallpaper', selectedWallpaperId);
  }, [selectedWallpaperId]);

  const handleSelectWallpaper = (wallpaperId) => {
    if (!WALLPAPER_OPTIONS.some((option) => option.id === wallpaperId)) return;
    setSelectedWallpaperId(wallpaperId);
  };

  // Update IDs instantly when URL searchParams change
  useEffect(() => {
    setCharacterId(searchParams.get('character'));
    setSceneId(searchParams.get('scene'));
    if (!searchParams.get('character')) {
      setSelectedCharacter(null);
    }
    if (!searchParams.get('scene')) {
      setSelectedScene(null);
    }
    setSelectedPersona(null);
    setSelectedChat(null);
    setMessages([]);
    setServerContextWindowUsage(null);
    isNewChat.current = true;
    setWelcomeDismissed(false);
    setInitModal(false);
    initialized.current = false;
  }, [searchParams]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle mobile keyboard viewport to prevent layout shift
  useEffect(() => {
    if (window.innerWidth >= 768) return; // Only on mobile

    const handleResize = () => {
      // When keyboard is open, window.innerHeight becomes smaller
      // Lock the main scrollable area to prevent background from showing
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.style.maxHeight = `${window.innerHeight}px`;
      }
    };

    const handleOrientationChange = () => {
      // Reset on orientation change
      setTimeout(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.style.maxHeight = 'unset';
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const navigate = useNavigate();
  const initialized = useRef(false);
  const isNewChat = useRef(true);
  const lastLimitReminderCountRef = useRef(null);

  const maybeShowMessageLimitReminder = (limits) => {
    if (!limits || !limits.is_limited || !limits.approaching_limit || limits.limit_reached) return;

    const currentCount = Number(limits.daily_message_count ?? 0);
    if (lastLimitReminderCountRef.current === currentCount) return;

    lastLimitReminderCountRef.current = currentCount;
    const remaining = Number(limits.remaining_messages ?? 0);
    const cap = Number(limits.daily_message_cap ?? 0);

    toast.show(
      `今日还可发送 ${remaining} 条消息（${currentCount}/${cap}）。升级 Pro 可解锁无限消息。`,
      { type: 'warning' }
    );
  };

  const applyChatLimits = (limits) => {
    if (!limits) return;
    setChatLimits(limits);
    maybeShowMessageLimitReminder(limits);
  };

  const getChatErrorMessage = (errorPayload) => {
    if (errorPayload?.error === 'DAILY_MESSAGE_CAP_REACHED') {
      const remaining = Number(errorPayload?.limits?.remaining_messages ?? 0);
      if (remaining <= 0) {
        return '已达到今日消息上限，请明天再试，或升级 Pro 解锁无限消息。';
      }
      return errorPayload?.message || '已达到今日消息上限。';
    }
    if (typeof errorPayload?.error === 'string') {
      return errorPayload.error;
    }
    return 'Failed to send message. Please try again.';
  };

  const compactMessagesForRequest = (allMessages) => {
    if (!Array.isArray(allMessages)) return [];

    return allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );
  };

  const getContextWindowUsage = (allMessages) => {
    const effectiveSoftTokenLimit = CLIENT_SOFT_TOKEN_LIMIT;

    if (!Array.isArray(allMessages)) {
      return {
        currentTokens: 0,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    const validMessages = allMessages.filter(
      (message) => message && typeof message === 'object' && message.role && typeof message.content === 'string'
    );

    if (serverContextWindowUsage) {
      const serverInputTokens = Number(serverContextWindowUsage.input_tokens || 0);

      return {
        currentTokens: serverInputTokens,
        softLimit: Number(serverContextWindowUsage.soft_token_limit || effectiveSoftTokenLimit),
      };
    }

    for (let i = validMessages.length - 1; i >= 0; i -= 1) {
      const message = validMessages[i];
      if (message.role !== 'assistant' || !message.usage || typeof message.usage !== 'object') {
        continue;
      }

      const usageInputTokens = Number(message.usage.prompt_tokens || 0);
      return {
        currentTokens: usageInputTokens,
        softLimit: effectiveSoftTokenLimit,
      };
    }

    return {
      currentTokens: 0,
      softLimit: effectiveSoftTokenLimit,
    };
  };

  // Fetch initial entity data when modal opens and IDs are present
  useEffect(() => {
    if (initModal && (characterId || sceneId)) {
      setInitLoading(true);
      fetchInitialData().finally(() => {
        setInitLoading(false);
      });
    }
  }, [initModal, characterId, sceneId]);

  const handleCharacterEntry = async () => {
    setInitModal(false);
    isNewChat.current = true;
    setInitLoading(true);
    try {
      const fetchedData = await fetchInitialData();
      const existingChats = userData?.chat_history?.filter(h => {
        const characterMatches = String(h.character_id) === String(characterId);
        const hasNoScene = !h.scene_id; // Only load chats without a scene
        return characterMatches && hasNoScene;
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

      initializeChat(fetchedData);
      initialized.current = true;
    } catch (err) {
      console.error('Error handling scene entry:', err);
    } finally {
      setInitLoading(false);
    }
  };

  // Initialize data based on URL entry (character or scene)
  useEffect(() => {
    if (loading) return;

    if (!loading && !sessionToken) {
      navigate('/');
      return;
    }

    if (initialized.current) return;

    if (sessionToken && sceneId && !initModal) {
      handleSceneEntry();
    }

    if (sessionToken && characterId) {
      handleCharacterEntry();
      return;
    }

  }, [navigate, sessionToken, loading, characterId, sceneId, userData, initModal]);

  // Reusable function to start chat with current selections (used by modal and direct entry)
  const startChatWithSelectedEntities = async () => {
    isNewChat.current = true;
    setWelcomeDismissed(false);
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
    setInitModal(false);
    const existingChats = userData?.chat_history?.filter(h => {
      const characterMatches = String(h.character_id) === String(selectedCharacter.id);
      const sceneMatches = selectedScene ? String(h.scene_id) === String(selectedScene.id) : false;
      return characterMatches && sceneMatches;
    }) || [];

    if (existingChats.length > 0) {
      const mostRecentChat = existingChats.sort(
        (a, b) => new Date(b.last_updated) - new Date(a.last_updated)
      )[0];
      await loadChat(mostRecentChat);
      initialized.current = true;
      return;
    }

    await startChatWithSelectedEntities();
    initialized.current = true;
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
              setLikes(data.likes || 0);
              return data;
            })
            .catch(err => {
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
        } else {
          setSelectedCharacter(null);
          setAdvancedChatConfig(DEFAULT_ADVANCED_CHAT_CONFIG);
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
    const { character, scene, persona } = fetchedData || {};
    const sys = {
      role: "system",
      content: buildSystemMessage(
        character?.name || "",
        character?.persona || "",
        character?.example_messages || "",
        persona?.description || null,
        persona?.name || null,
        scene?.description || null
      )
    };
    // Use the character's greeting if available. Do not emit a special scene greeting here
    // because the scene introduction is now handled by the welcome notice.
    // If the character uses the improvising sentinel, call the backend LLM to generate
    // the initial assistant greeting dynamically.
    // Disable greeting when there's a scene.
    const charGreeting = scene ? null : character?.greeting;
    setSelectedChat(null);
    setInput('');

    if (charGreeting === SPECIAL_IMPROVISING_GREETING) {
      // Start with only the system message while we request an initial assistant reply
      setMessages([sys]);
      // Ask backend to generate a reply (this will also create a chat entry server-side when character_id provided)
      setSending(true);
      setIsStreaming(true);
      
      const controller = new AbortController();
      setAbortController(controller);
      
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': sessionToken
          },
          body: JSON.stringify({
            character_id: characterId,
            scene_id: (scene?.id || selectedScene?.id) || null,
            persona_id: (persona?.id || selectedPersona?.id) || null,
            messages: [sys],
            chat_config: advancedChatConfig,
            stream: true
          }),
          signal: controller.signal
        });
        
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => null);
          if (errorPayload?.limits) {
            applyChatLimits(errorPayload.limits);
          }
          throw new Error(getChatErrorMessage(errorPayload));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedReply = "";
        
        // Add placeholder message
        setMessages([sys, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                toast.show(t('chat.error_generating_greeting') || 'Failed to generate greeting.', { type: 'error' });
                setMessages([sys]); // Reset to just system message
                break;
              }
              
              if (data.chunk) {
                accumulatedReply += data.chunk;
                setMessages([sys, { role: 'assistant', content: accumulatedReply }]);
              }
              
              if (data.done && data.chat_id) {
                applyChatLimits(data.limits);
                if (data.context_window) {
                  setServerContextWindowUsage(data.context_window);
                }
                const newChat = {
                  chat_id: data.chat_id,
                  title: data.chat_title || (accumulatedReply ? accumulatedReply.slice(0, 30) + (accumulatedReply.length > 30 ? '...' : '') : 'New Chat'),
                  character_id: characterId,
                  character_name: selectedCharacter?.name || null,
                  character_picture: selectedCharacter?.picture || null,
                  messages: [{ role: 'assistant', content: accumulatedReply }],
                  last_updated: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  ...((scene?.id || sceneId || selectedScene?.id) && { scene_id: scene?.id || sceneId || selectedScene?.id }),
                  ...(selectedPersona?.id && { persona_id: selectedPersona.id })
                };
                setSelectedChat(newChat);
                if (userData && userData.chat_history) {
                  const filtered = userData.chat_history.filter(h => h.chat_id !== data.chat_id);
                  setUserData(prev => ({ ...prev, chat_history: [newChat, ...filtered].slice(0, 30) }));
                }
              }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
        } else {
          console.error('Error generating improvising greeting:', err);
          toast.show(err.message || t('chat.error_generating_greeting') || 'Failed to generate greeting.', { type: 'error' });
        }
      } finally {
        setSending(false);
        setIsStreaming(false);
        setAbortController(null);
      }
      return;
    }

    // Non-improvising: use greeting if provided
    let greet = null;
    if (charGreeting) {
      greet = {
        role: 'assistant',
        content: charGreeting
      };
    }
    setMessages(greet ? [sys, greet] : [sys]);
  };

  const handleSend = async (event) => {
    event.preventDefault(); // Always prevent default
    if (sending || !input.trim() || !selectedCharacter) return;
    setSending(true);
    setIsStreaming(true);
    
    // If this is the user's first message in a new chat, dismiss the welcome
    if (isNewChat.current && !welcomeDismissed) {
      setWelcomeDismissed(true);
      isNewChat.current = false;
    }
    
    const updatedMessages = [...messages, { role: 'user', content: input.trim() }];
    const requestMessages = compactMessagesForRequest(updatedMessages);
    setMessages(updatedMessages);
    setInput('');
    
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = `${CHAT_INPUT_BASE_HEIGHT}px`;
      textareaRef.current.style.overflowY = 'hidden';
    }

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify({
          character_id: characterId,
          chat_id: selectedChat?.chat_id,
          scene_id: selectedScene?.id || null,
          persona_id: selectedPersona?.id || null,
          messages: requestMessages,
          context_messages: updatedMessages,
          full_messages: updatedMessages,
          chat_config: advancedChatConfig,
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        if (errorPayload?.limits) {
          applyChatLimits(errorPayload.limits);
        }
        throw new Error(getChatErrorMessage(errorPayload));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = "";
      
      // Add a placeholder message for the assistant that we'll update incrementally
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.error) {
              toast.show('Failed to send message. Please try again.', { type: 'error' });
              setMessages(prev => prev.slice(0, -1)); // Remove placeholder
              break;
            }
            
            if (data.chunk) {
              accumulatedReply += data.chunk;
              // Update the last message (assistant's response) incrementally
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { 
                  role: 'assistant', 
                  content: accumulatedReply 
                };
                return newMessages;
              });
            }
            
            if (data.done) {
              applyChatLimits(data.limits);
              if (data.context_window) {
                setServerContextWindowUsage(data.context_window);
              }
              // Stream completed, update chat history
              if (data.chat_id) {
                // Preserve existing chat data or create new
                const existingChat = userData?.chat_history?.find(h => h.chat_id === data.chat_id);
                const newChat = {
                  chat_id: data.chat_id,
                  title: data.chat_title || updatedMessages.find(m => m.role === 'user')?.content || 'New Chat',
                  character_id: characterId,
                  character_name: existingChat?.character_name || selectedCharacter?.name || null,
                  character_picture: existingChat?.character_picture || selectedCharacter?.picture || null,
                  messages: [...updatedMessages, { role: 'assistant', content: accumulatedReply }],
                  last_updated: new Date().toISOString(),
                  created_at: existingChat?.created_at || new Date().toISOString(),
                  ...((selectedScene?.id || sceneId) && { scene_id: selectedScene?.id || sceneId }),
                  ...(selectedPersona?.id && { persona_id: selectedPersona.id })
                };
                setSelectedChat(newChat);
                
                // Update chat history in userData for instant UI
                if (userData && userData.chat_history) {
                  const filtered = userData.chat_history.filter(h => h.chat_id !== data.chat_id);
                  setUserData(prev => ({
                    ...prev,
                    chat_history: [newChat, ...filtered].slice(0, 30)
                  }));
                }
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
      } else {
        toast.show(err.message || 'Failed to send message. Please try again.', { type: 'error' });
      }
      // Remove the incomplete assistant message if there's an error
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setSending(false);
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Handle textarea input and auto-resize
  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(
        CHAT_INPUT_BASE_HEIGHT,
        Math.min(textareaRef.current.scrollHeight, CHAT_INPUT_MAX_HEIGHT)
      );
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY =
        textareaRef.current.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  };

  // Unified new chat action respecting current entry mode
  const handleNewChat = async () => {
    setSelectedChat(null);
    setMessages([]);
    isNewChat.current = true;
    setWelcomeDismissed(false);

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

  // Handle keyboard shortcuts (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Generic like function for character, scene, or persona
  const likeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/like/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: true }));
    }
  };

  // Generic unlike function for character, scene, or persona
  const unlikeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/unlike/${entityType}/${entityId}`, {
      method: 'POST',
  headers: { 'Authorization': sessionToken }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(prev => ({ ...prev, [entityType]: false }));
    }
  };

  const loadChat = async (chat) => {
    try {
      // Update IDs from the chat entry
      setCharacterId(chat.character_id);
      setSceneId(chat.scene_id || null);
      
      // Fetch all required entities in parallel
      const promises = [];
      let character = selectedCharacter;
      let scene = null;
      let persona = null;
      
      // Only fetch if we don't have it or if it's different
      if (!character || character.id !== chat.character_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${chat.character_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              character = data;
              setSelectedCharacter(data);
              if (data) {
                setAdvancedChatConfig(normalizeAdvancedChatConfig(data));
              }
            })
            .catch(err => console.error('Error loading character:', err))
        );
      } else {
        setAdvancedChatConfig(normalizeAdvancedChatConfig(character));
      }
      
      if (chat.scene_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${chat.scene_id}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.ok ? res.json() : null)
            .then(data => { scene = data; setSelectedScene(data); })
            .catch(err => console.error('Error loading scene:', err))
        );
      } else {
        setSelectedScene(null);
      }
      
      if (chat.persona_id) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/personas/${chat.persona_id}`, {
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

      // Refresh liked status for the loaded entities
      const likeParams = [];
      if (chat.character_id) likeParams.push(`character_id=${chat.character_id}`);
      if (chat.scene_id) likeParams.push(`scene_id=${chat.scene_id}`);
      if (chat.persona_id) likeParams.push(`persona_id=${chat.persona_id}`);

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
      
      // Build proper system message with all context
      const sys = {
        role: "system",
        content: buildSystemMessage(
          character?.name || "",
          character?.persona || "",
          character?.example_messages || "",
          persona?.description || null,
          persona?.name || null,
          scene?.description || null
        )
      };
      
      const historyMessages = Array.isArray(chat.messages) ? chat.messages : [];
      const summarySystemMessages = historyMessages.filter(
        (m) => m?.role === 'system' && typeof m?.content === 'string' && m.content.trim().startsWith(SUMMARY_PREFIX)
      );
      const nonSystemMessages = historyMessages.filter((m) => m?.role !== 'system');

      // Keep exactly one live system prompt plus normal dialogue messages
      setMessages([sys, ...summarySystemMessages, ...nonSystemMessages]);
      
      // Set selected chat and mark as existing chat (not new)
      setSelectedChat({
        ...chat,
        last_updated: chat.last_updated || new Date().toISOString()
      });
      
      // Mark as existing chat, dismiss welcome
      isNewChat.current = false;
      setWelcomeDismissed(true);
      setShowChatHistory(false);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.show(t('chat.error_loading_chat') || 'Failed to load chat.', { type: 'error' });
    }
  };

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

  // Local state for confirm modal
  const [confirmModal, setConfirmModal] = useState({ show: false, chatId: null });

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

  // Helper: parse message content into React elements honoring *actions* and (scene) narration
  // This is intentionally lightweight: it looks for *wrapped* tokens and (parenthesis) tokens
  const renderMessageContent = (text) => {
    if (!text) return null;
    // Split by tokens but keep delimiters using regex
    const parts = [];
    const re = /(\*[^*]+\*)|(\([^)]*\))/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      const token = match[0];
      if (token.startsWith('*') && token.endsWith('*')) {
        parts.push({ type: 'action', content: token.slice(1, -1) });
      } else if (token.startsWith('(') && token.endsWith(')')) {
        parts.push({ type: 'scene', content: token.slice(1, -1) });
      } else {
        parts.push({ type: 'text', content: token });
      }
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts.map((p, idx) => {
      // Use inheritable colors so these tokens adapt to the parent bubble's color
      if (p.type === 'action') {
        return <span key={idx} style={{ fontStyle: 'italic', fontWeight: 600, margin: '0 4px', color: 'inherit' }}>{p.content}</span>;
      }
      if (p.type === 'scene') {
        return <span key={idx} style={{ fontStyle: 'italic', color: 'inherit', opacity: 0.9, margin: '0 4px' }}>({p.content})</span>;
      }
      // For text parts, split by newlines and render with <br/> tags
      const lines = p.content.split('\n');
      return <span key={idx}>{lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}</span>;
    });
  };

  const contextWindowUsage = getContextWindowUsage(messages);
  const contextUsageRatio = Math.min(1, contextWindowUsage.currentTokens / Math.max(1, contextWindowUsage.softLimit));
  const contextUsagePercent = Math.round(contextUsageRatio * 100);
  const pieRadius = 7;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const pieStrokeOffset = pieCircumference * (1 - contextUsageRatio);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      background: 'transparent', 
      minHeight: 0,
      position: 'relative',
      width: '100%',
      overflow: 'hidden'
      }}>
      {/* Main Chat Area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0, 
        zIndex: 1,
        background: '#fff',
        backgroundImage: selectedWallpaper?.url ? `url(${selectedWallpaper.url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: isMobile ? '0' : '1.5rem', 
        margin: isMobile ? '0' : '0 0.5rem 0 0.5rem', 
        boxShadow: '0 2px 16px rgba(0,0,0,0.04)', 
        overflow: 'hidden', 
        height: 'auto',
        }}>
        {/* Messages Area */}
        <div
          style={{
            flex: 1,
            padding: '1.2rem',
            overflowY: 'auto',
            background: selectedWallpaper?.url ? 'rgba(255, 255, 255, 0.76)' : '#fff',
            backdropFilter: selectedWallpaper?.url ? 'blur(1.5px)' : 'none',
            minHeight: 0,
          }}
        >
          {(() => {
            const nonSystem = messages.filter(m => m.role !== 'system');
            // Show welcome only when starting a new chat (isNewChat.current)
            // This ensures we still show welcome when nonSystem.length === 0 (no character greeting),
            // but only once per new chat session.
            const showWelcome = isNewChat.current && !welcomeDismissed;

            return (
              <>
                {showWelcome && (
                  (() => {
                    // Build a system-style welcome notice independent from the assistant's greeting message
                    const charName = selectedCharacter?.name;
                    const personaName = selectedPersona?.name;
                    const sceneName = selectedScene?.name;
                    const personaDesc = selectedPersona?.description;
                    const sceneDesc = selectedScene?.description;

                    // Build the translated welcome title and body using i18n with sensible fallbacks
                    const title = t('chat.welcome_title', { name: charName || '' });

                    // For the body, prefer a combined sentence with character/persona data.
                    // Scene information is displayed separately (title + intro) in its own visually distinct block.
                    const mainParts = [];
                    mainParts.push(t('chat.welcome_body_intro', { character: charName || '' }));
                    if (personaName) {
                      mainParts.push(t('chat.welcome_body_persona', { persona: personaName }));
                    }
                    mainParts.push(t('chat.welcome_body_cta'));
                    const welcomeText = mainParts.join(' ');

                    // Scene-specific text (localized)
                    const sceneTitleText = sceneName ? t('chat.welcome_scene_title', { scene: sceneName }) : null;

                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
                        <div style={{ maxWidth: 720, width: '100%', textAlign: 'center', padding: '0 0.6rem' }}>
                          {/* Picture above, centered */}
                          {(selectedCharacter?.avatar_picture || selectedCharacter?.picture) ? (
                            <img
                              src={`${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`}
                              alt={charName || 'Character'}
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: 'cover',
                                borderRadius: '50%',
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                          ) : (
                            <img
                              src={defaultPic}
                              alt={charName || 'Character'}
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: 'cover',
                                borderRadius: '50%',
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                          )}

                          {/* Title centered */}
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#121212', marginTop: 12 }}>
                            {title}
                          </div>

                          {/* Scene block (visually distinct). Shows scene title and scene.intro if available */}
                          {sceneName && (
                            <div style={{
                              marginTop: 12,
                              padding: '0.9rem',
                              background: '#f1f5f9',
                              borderRadius: '0.75rem',
                              border: '1px solid rgba(15, 23, 42, 0.04)',
                              color: '#0f172a',
                              textAlign: 'left'
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{sceneTitleText}</div>
                              {selectedScene?.intro && (
                                <div style={{ marginTop: 6, fontStyle: 'italic', color: '#374151' }}>{selectedScene.intro}</div>
                              )}
                            </div>
                          )}

                          {/* Text centered, transparent background so it appears inline in chat */}
                          <div style={{ marginTop: 8, color: '#4b5563', fontSize: '0.92rem', lineHeight: 1.35 }}>
                            {welcomeText}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}

                {nonSystem.length === 0 ? (
                  <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>{t('chat.no_messages')}</div>
                ) : (
                  nonSystem.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        marginBottom: '1.2rem',
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                        maxWidth: '80%'
                      }}>
                        <img
                          src={
                            m.role === 'user'
                              ? (userData?.profile_pic
                                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}`
                                  : defaultPic)
                                : ((selectedCharacter?.avatar_picture || selectedCharacter?.picture)
                                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`
                                  : defaultPic)
                          }
                          alt={m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                          style={{ width: 77, height: 77, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.6px solid #e9ecef' }}
                        />
                        <div style={{
                          margin: m.role === 'user' ? '0 0.4rem 0 0.88rem' : '0 0.88rem 0 0.4rem',
                          // Use the same light style as the assistant for consistency
                          background: '#f5f6fa',
                          color: '#232323',
                          borderRadius: '0.88rem',
                          padding: '0.68rem 0.96rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          fontSize: '0.82rem',
                          minWidth: 0,
                          wordBreak: 'break-word',
                          maxWidth: '100%'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '0.76rem', marginBottom: 2, opacity: 0.7 }}>
                            {m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                          </div>
                          <div>{renderMessageContent(m.content)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </>
            );
          })()}
        </div>

        {/* Input Area (no form) */}
        <form
          onSubmit={handleSend}
          style={{
            paddingTop: '0.8rem',
            paddingLeft: '1.2rem',
            paddingRight: '1.2rem',
            paddingBottom: isMobile
              ? 'calc(0.8rem + env(safe-area-inset-bottom, 0px))'
              : '0.8rem',
            background: selectedWallpaper?.url ? 'rgba(248, 249, 250, 0.9)' : '#f8f9fa',
            borderTop: '1.2px solid #e9ecef',
            flexShrink: 0
          }}
        >
          <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'flex-end' }}>
            <div
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginBottom: 7 }}
              onMouseEnter={() => setShowContextDetails(true)}
              onMouseLeave={() => setShowContextDetails(false)}
            >
              <button
                type="button"
                onFocus={() => setShowContextDetails(true)}
                onBlur={() => setShowContextDetails(false)}
                onClick={() => setShowContextDetails((prev) => !prev)}
                aria-label="上下文窗口使用情况"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="9" cy="9" r={pieRadius} fill="none" stroke="#e5e7eb" strokeWidth="2" />
                  <circle
                    cx="9"
                    cy="9"
                    r={pieRadius}
                    fill="none"
                    stroke={contextUsagePercent >= 90 ? '#dc3545' : '#18191a'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={pieCircumference}
                    strokeDashoffset={pieStrokeOffset}
                    transform="rotate(-90 9 9)"
                  />
                </svg>
                <span>{contextUsagePercent}%</span>
              </button>

              {showContextDetails && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '140%',
                    left: 0,
                    transform: 'none',
                    minWidth: 220,
                    background: '#111827',
                    color: '#f9fafb',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    zIndex: 20,
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 6 }}>上下文使用情况</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: 8 }}>
                    {`当前 ${contextWindowUsage.currentTokens}/${contextWindowUsage.softLimit} tokens`}
                  </div>

                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${contextUsagePercent}%`,
                        height: '100%',
                        background: contextUsagePercent >= 90 ? '#ef4444' : '#60a5fa',
                      }}
                    />
                  </div>

                  <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                    基于上次请求的上下文使用情况
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: 4 }}>
                    到达上限时聊天记录将被总结。
                  </div>
                  {Number(serverContextWindowUsage?.summary_messages_count || 0) > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#86efac', marginTop: 4 }}>
                      已自动整理旧消息并保留最近 15 条对话。
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '0.64rem', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                style={{
                  flex: 1,
                  borderRadius: '1.2rem',
                  border: '1.2px solid #e9ecef',
                  background: '#fff',
                  padding: '0.6rem 0.96rem',
                  fontSize: '0.82rem',
                  outline: 'none',
                  color: '#232323',
                  boxShadow: 'none',
                  transition: 'border 0.14s',
                  resize: 'none',
                  minHeight: `${CHAT_INPUT_BASE_HEIGHT}px`,
                  maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
                  overflowY: 'hidden',
                  fontFamily: 'inherit',
                  lineHeight: '1.55',
                  boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
                placeholder={t('chat.input_placeholder')}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                required
                onFocus={e => {
                  e.target.style.border = '1.2px solid #18191a';
                  // Prevent viewport shift on mobile
                  if (window.innerWidth < 768) {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                    }, 300);
                  }
                }}
                onBlur={e => e.target.style.border = '1.2px solid #e9ecef'}
                rows={1}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => {
                    if (abortController) {
                      abortController.abort();
                    }
                  }}
                  style={{
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)',
                    transition: 'background 0.14s',
                    cursor: 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#c82333'}
                  onMouseLeave={e => e.currentTarget.style.background = '#dc3545'}
                  title={t('chat.stop_generation') || 'Stop'}
                >
                  <i className="bi bi-stop-fill"></i>
                </button>
              ) : (
                <button
                  type="submit"
                  style={{
                    background: sending ? '#888' : '#18191a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: '0 2px 8px rgba(24,25,26,0.08)',
                    transition: 'background 0.14s',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!sending) e.currentTarget.style.background = '#232323'; }}
                  onMouseLeave={e => { if (!sending) e.currentTarget.style.background = '#18191a'; }}
                  title={t('chat.input_shortcut_hint')}
                  disabled={sending}
                >
                  {sending ? (
                    <span className="spinner-border spinner-border-sm" style={{ color: '#fff' }}></span>
                  ) : (
                    <i className="bi bi-send-fill"></i>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <SceneCharacterSelectModal
        show={initModal}
        loading={initLoading}
        selectedScene={selectedScene}
        onSelectCharacter={() => setCharacterModal({ show: true })}
        selectedCharacter={selectedCharacter}
        setSelectedCharacter={setSelectedCharacter}
        onStartChat={async () => {
          await startChatFromSceneSelection();
        }}
        onCancel={() => {
          if (!initialized.current) {
            navigate(-1);
          } else {
            setInitModal(false);
          }
        }}
        isMobile={isMobile}
      />
      <CharacterSidebar
        characterSidebarVisible={characterSidebarVisible}
        onToggleCharacterSidebar={onToggleCharacterSidebar}
        onNewChat={handleNewChat}
        selectedCharacter={selectedCharacter}
        selectedPersona={selectedPersona}
        selectedScene={selectedScene}
        userData={userData}
        characterId={characterId}
        selectedChat={selectedChat}
        editingChatId={editingChatId}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        setEditingChatId={setEditingChatId}
        menuOpenId={menuOpenId}
        setMenuOpenId={setMenuOpenId}
        handleRename={handleRename}
        handleDelete={handleDelete}
        loadChat={loadChat}
        showChatHistory={showChatHistory}
        setShowChatHistory={setShowChatHistory}
        initializeChat={initializeChat}
        likeEntity={likeEntity}
        unlikeEntity={unlikeEntity}
        hasLiked={hasLiked}
        setSelectedPersona={setSelectedPersona}
        setSelectedScene={setSelectedScene}
        setSelectedCharacter={setSelectedCharacter}
        navigate={navigate}
        advancedChatConfig={advancedChatConfig}
        setAdvancedChatConfig={setAdvancedChatConfig}
        onResetAdvancedChatConfig={() => setAdvancedChatConfig(normalizeAdvancedChatConfig(selectedCharacter))}
        canUseAdvancedChatConfig={canUseAdvancedChatConfig}
        wallpaperOptions={WALLPAPER_OPTIONS}
        selectedWallpaperId={selectedWallpaperId}
        onSelectWallpaper={handleSelectWallpaper}
        isMobile={isMobile}
        setPersonaModalShow={() => setPersonaModal({ show: true })}
      />
      <CharacterModal
        show={characterModal.show}
        onClose={() => setCharacterModal({ show: false })}
        onSelect={character => {
          setSelectedCharacter(character);
          setCharacterId(character?.id || null);
          setCharacterModal({ show: false });
        }}
      />
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false })}
        onSelect={persona => {
          setSelectedPersona(persona);
          setPersonaModal({ show: false });
        }}
        sessionToken={sessionToken}
        refreshUserData={refreshUserData}
        userData={userData}
      />
      <ConfirmModal
        show={confirmModal.show}
        title={t('confirm.delete_chat.title')}
        message={t('confirm.delete_chat.message')}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false, chatId: null })}
      />
    </div>
  );
}