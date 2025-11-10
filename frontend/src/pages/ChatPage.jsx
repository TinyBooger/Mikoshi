import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import PersonaModal from '../components/PersonaModal';
import SceneModal from '../components/SceneModal';
import CharacterModal from '../components/CharacterModal';
import CharacterSidebar from '../components/CharacterSidebar';
import ChatInitModal from '../components/ChatInitModal';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';

export default function ChatPage() {
  const { t } = useTranslation();
  // Sentinel used to indicate a character should have an improvising greeting
  const SPECIAL_IMPROVISING_GREETING = '[IMPROVISE_GREETING]';
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, sessionToken, refreshUserData, loading } = useContext(AuthContext);
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasLiked, setHasLiked] = useState({ character: false, scene: false, persona: false });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Whether the welcome notice has been dismissed (show only once per new chat)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const [personaModal, setPersonaModal] = useState({ show: false });
  const [sceneModal, setSceneModal] = useState({ show: false });
  const [characterModal, setCharacterModal] = useState({ show: false });
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

  const [characterId, setCharacterId] = useState(searchParams.get('character'));
  const [sceneId, setSceneId] = useState(searchParams.get('scene'));
  const [personaId, setPersonaId] = useState(searchParams.get('persona'));

  // Update IDs instantly when URL searchParams change
  useEffect(() => {
    setCharacterId(searchParams.get('character'));
    setSceneId(searchParams.get('scene'));
    setPersonaId(searchParams.get('persona'));
    initialized.current = false;
  }, [searchParams]);

  const navigate = useNavigate();
  const initialized = useRef(false);
  const isNewChat = useRef(true);

  // Fetch initial entity data when modal opens and IDs are present
  useEffect(() => {
    if (initModal && (characterId || sceneId || personaId)) {
      setInitLoading(true);
      fetchInitialData().then(() => {
        setInitLoading(false);
      });
    }
  }, [initModal, characterId, sceneId, personaId]);

  // Initialize character data (runs once when characterId changes)
  useEffect(() => {
    if (loading) return;

  // Only navigate if loading is false and sessionToken is still null (i.e., auth check finished and user is not logged in)
  if (!loading && !sessionToken) {
      navigate('/');
      return;
    }

  if (!initialized.current && sessionToken) {
      if(checkChatHistory()) {
        fetchInitialData().then(() => {
          initializeChat();
        });
      }
      
      return;
    }
  }, [navigate, sessionToken, loading, initialized, characterId, sceneId, personaId]);

  // Fetch character, scene, and persona data if IDs are present
  const fetchInitialData = () => {
    setInitLoading(true);
    return new Promise((resolve) => {
      const promises = [];
      if (characterId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/character/${characterId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.json())
            .then(character => {
              setSelectedCharacter(character);
              setLikes(character.likes || 0);
            })
        );
      }
      if (sceneId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/scenes/${sceneId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.json())
            .then(scene => {
              setSelectedScene(scene);
            })
        );
      }
      if (personaId) {
        promises.push(
          fetch(`${window.API_BASE_URL}/api/personas/${personaId}`, {
            headers: { 'Authorization': sessionToken }
          })
            .then(res => res.json())
            .then(persona => {
              setSelectedPersona(persona);
            })
        );
      }

      // Fetch liked status for all at once
      if (characterId || sceneId || personaId) {
        const params = [];
        if (characterId) params.push(`character_id=${characterId}`);
        if (sceneId) params.push(`scene_id=${sceneId}`);
        if (personaId) params.push(`persona_id=${personaId}`);
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
            })
            .catch(() => setHasLiked({ character: false, scene: false, persona: false }))
        );
      } else {
        setHasLiked({ character: false, scene: false, persona: false });
      }
      Promise.all(promises).then(() => {
        setInitLoading(false);
        resolve();
      });
    });
  };

  const checkChatHistory = () => {
    // Check if chat history exists for the current characterId
    const entry = userData?.chat_history?.find(
      h => h.character_id === characterId
    );
    if (entry) {
      loadChatHistory(entry);
      isNewChat.current = false;
      return true;
    }
    else {
      isNewChat.current = true;
      setInitModal(true);
      return false;
    }
  };

  // Loads chat history for the current characterId
  const loadChatHistory = (entry) => {
    // Set messages based on user's chat history
    setMessages([...entry.messages]);
    // Set characterId, sceneId, personaId from entry if present
    if (entry.character_id) {
      setCharacterId(entry.character_id);
    }
    if (entry.scene_id) {
      setSceneId(entry.scene_id);
    }
    if (entry.persona_id) {
      setPersonaId(entry.persona_id);
    }
  };

  const initializeChat = () => {
    console.log('Initializing chat with:', { characterId, sceneId, personaId });
    // Set likes and creator from selectedCharacter
    if (characterId) {
      // Update recent characters
      fetch(`${window.API_BASE_URL}/api/recent-characters/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken 
        },
        body: JSON.stringify({ character_id: characterId })
      }).then(() => {
        console.log('Recent characters updated:', characterId);
      });
      // Increment views for character, scene, and persona in one call
      const body = {
        ...(selectedCharacter && { character_id: selectedCharacter.id }),
        ...(selectedScene && { scene_id: selectedScene.id }),
        ...(selectedPersona && { persona_id: selectedPersona.id })
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
      startNewChat();
    }
  };

  const startNewChat = async () => {
    console.log('starting a new chat')
    const sys = {
      role: "system",
      content: buildSystemMessage(
        selectedCharacter?.name || "",
        selectedCharacter?.persona || "",
        selectedCharacter?.example_messages || "",
        selectedPersona?.description || null,
        selectedScene?.description || null
      )
    };
    // Use the character's greeting if available. Do not emit a special scene greeting here
    // because the scene introduction is now handled by the welcome notice.
    // If the character uses the improvising sentinel, call the backend LLM to generate
    // the initial assistant greeting dynamically.
    const charGreeting = selectedCharacter?.greeting;
    setSelectedChat(null);
    setInput('');
    // Reset welcome dismissed so the welcome notice can show for this new chat
    setWelcomeDismissed(false);

    if (charGreeting === SPECIAL_IMPROVISING_GREETING) {
      // Start with only the system message while we request an initial assistant reply
      setMessages([sys]);
      // Ask backend to generate a reply (this will also create a chat entry server-side when character_id provided)
      setSending(true);
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': sessionToken
          },
          body: JSON.stringify({
            character_id: characterId,
            scene_id: selectedScene?.id || null,
            persona_id: selectedPersona?.id || null,
            messages: [sys]
          })
        });
        const data = await res.json();
        const reply = data.response || '';
        setMessages([sys, { role: 'assistant', content: reply }]);

        if (data.chat_id) {
          const newChat = {
            chat_id: data.chat_id,
            title: data.chat_title || (reply ? reply.slice(0, 30) + (reply.length > 30 ? '...' : '') : 'New Chat'),
            character_id: characterId,
            messages: [{ role: 'assistant', content: reply }],
            last_updated: new Date().toISOString()
          };
          setSelectedChat(newChat);
          if (userData && userData.chat_history) {
            const filtered = userData.chat_history.filter(h => h.chat_id !== data.chat_id);
            setUserData(prev => ({ ...prev, chat_history: [newChat, ...filtered].slice(0, 30) }));
          }
        }
      } catch (err) {
        console.error('Error generating improvising greeting:', err);
        toast.show(t('chat.error_generating_greeting') || 'Failed to generate greeting.', { type: 'error' });
      }
      setSending(false);
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
    // If this is the user's first message in a new chat, dismiss the welcome
    if (isNewChat.current && !welcomeDismissed) {
      setWelcomeDismissed(true);
      isNewChat.current = false;
    }
    const updatedMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(updatedMessages);
    setInput('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat`, {
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
          messages: updatedMessages
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      if (data.chat_id) {
        const newChat = {
          chat_id: data.chat_id,
          title: data.chat_title || updatedMessages.find(m => m.role === 'user')?.content || 'New Chat',
          character_id: characterId,
          messages: [...updatedMessages, { role: 'assistant', content: data.response }],
          last_updated: new Date().toISOString()
        };
        setSelectedChat(newChat);
        // Update chat history in userData for instant UI
        if (userData && userData.chat_history) {
          // Remove any existing entry for this chat_id
          const filtered = userData.chat_history.filter(h => h.chat_id !== data.chat_id);
          // Insert new entry at the top, keep max 30
          setUserData(prev => ({
            ...prev,
            chat_history: [newChat, ...filtered].slice(0, 30)
          }));
        }
      }
    } catch (err) {
      toast.show('Failed to send message. Please try again.', { type: 'error' });
    }
    setSending(false);
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

  const loadChat = (chat) => {
    const sys = { 
      role: "system", 
      content: buildSystemMessage(selectedCharacter.persona || "", selectedCharacter.example_messages || "") 
    };
    setMessages([sys, ...chat.messages]);
    setSelectedChat({
      ...chat,
      last_updated: chat.last_updated || new Date().toISOString()
    });
    setShowChatHistory(false);
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
        // If deleted chat was the selected one, start new chat
        if (selectedChat?.chat_id === chatId) {
          startNewChat();
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
      return <span key={idx}>{p.content}</span>;
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      background: '#f8f9fa', 
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
        borderRadius: '1.5rem', 
        margin: '1.5rem 0.5rem 1.5rem 1.5rem', 
        boxShadow: '0 2px 16px rgba(0,0,0,0.04)', 
        overflow: 'hidden', 
        height: 'auto',
        }}>
        {/* Messages Area */}
        <div style={{ flex: 1, padding: '1.2rem', overflowY: 'auto', background: '#fff', minHeight: 0 }}>
          {(() => {
            const nonSystem = messages.filter(m => m.role !== 'system');
            // Show welcome only when starting a new chat (isNewChat.current)
            // This ensures we still show welcome when nonSystem.length === 0 (no character greeting),
            // but only once per new chat session.
            const showWelcome = isNewChat.current && !welcomeDismissed;
            console.log({ showWelcome});

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
                          {selectedCharacter?.picture ? (
                            <img
                              src={`${window.API_BASE_URL.replace(/\/$/, '')}/${selectedCharacter.picture.replace(/^\//, '')}`}
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
                            <div style={{
                              width: 96,
                              height: 96,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg,#6b8cff,#a28bff)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '1.6rem',
                              margin: '0 auto'
                            }}>{charName ? charName.charAt(0).toUpperCase() : 'M'}</div>
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
                              : (selectedCharacter?.picture
                                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${selectedCharacter.picture.replace(/^\//, '')}`
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
              </>
            );
          })()}
        </div>

        {/* Input Area (no form) */}
        <form onSubmit={handleSend} style={{ padding: '0.8rem 1.2rem', background: '#f8f9fa', borderTop: '1.2px solid #e9ecef' }}>
          <div style={{ display: 'flex', gap: '0.64rem', alignItems: 'center', flexDirection: 'column' }}>
            <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'center' }}>
              <input
              style={{
                flex: 1,
                borderRadius: '1.6rem',
                border: '1.2px solid #e9ecef',
                background: '#fff',
                padding: '0.52rem 0.96rem',
                fontSize: '0.82rem',
                outline: 'none',
                color: '#232323',
                boxShadow: 'none',
                transition: 'border 0.14s',
              }}
              placeholder={t('chat.input_placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              required
              onFocus={e => e.target.style.border = '1.2px solid #18191a'}
              onBlur={e => e.target.style.border = '1.2px solid #e9ecef'}
              disabled={sending}
            />
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
              }}
              onMouseEnter={e => { if (!sending) e.currentTarget.style.background = '#232323'; }}
              onMouseLeave={e => { if (!sending) e.currentTarget.style.background = '#18191a'; }}
              disabled={sending}
            >
              {sending ? (
                <span className="spinner-border spinner-border-sm" style={{ color: '#fff' }}></span>
              ) : (
                <i className="bi bi-send-fill"></i>
              )}
            </button>
            </div>
            {/* Small helper line explaining notation (centered) */}
            <div style={{ width: '100%', marginTop: 6, fontSize: '0.72rem', color: '#6b7280', textAlign: 'center' }}>
              <div>{t('chat.input_notation_hint')}</div>
              <div style={{ marginTop: 4 }}>{t('chat.input_shortcut_hint')}</div>
              <button
                type="button"
                onClick={() => setShowHelp(prev => !prev)}
                aria-expanded={showHelp}
                style={{
                  marginTop: 6,
                  background: 'transparent',
                  color: '#374151',
                  border: 'none',
                  textDecoration: 'underline',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                {t('chat.tips_toggle')}
              </button>
            </div>
            {showHelp && (
              <div style={{
                width: '100%',
                maxWidth: 820,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                padding: '0.8rem 1rem',
                color: '#374151'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 6 }}>{t('chat.tips_title')}</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  <li>{t('chat.tips_1')}</li>
                  <li>{t('chat.tips_2')}</li>
                  <li>{t('chat.tips_3')}</li>
                  <li>{t('chat.tips_4')}</li>
                  <li>{t('chat.tips_5')}</li>
                </ul>
              </div>
            )}
          </div>
        </form>
      </div>

      <ChatInitModal
        show={initModal}
        loading={initLoading}
        onSelectCharacter={() => setCharacterModal({ show: true })}
        onSelectPersona={() => setPersonaModal({ show: true })}
        onSelectScene={() => setSceneModal({ show: true })}
        selectedCharacter={selectedCharacter}
        selectedPersona={selectedPersona}
        selectedScene={selectedScene}
        setSelectedCharacter={setSelectedCharacter}
        setSelectedPersona={setSelectedPersona}
        setSelectedScene={setSelectedScene}
        onStartChat={async () => {
          setInitModal(false);
          isNewChat.current = true;
          setInitLoading(true);
          fetchInitialData().then(() => {
            setInitLoading(false);
            initializeChat();
          });
        }}
        onCancel={() => {
          console.log(initialized.current)
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
        setInitModal={() => setInitModal(true)}
        selectedCharacter={selectedCharacter}
        selectedPersona={selectedPersona}
        selectedScene={selectedScene}
        personaModal={personaModal}
        setPersonaModal={setPersonaModal}
        sceneModal={sceneModal}
        setSceneModal={setSceneModal}
        characterModal={characterModal}
        setCharacterModal={setCharacterModal}
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
        isMobile={isMobile}
      />
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false })}
        onSelect={persona => {
          setSelectedPersona(persona);
          setPersonaId(persona?.id || null);
          setPersonaModal({ show: false });
        }}
      />
      <SceneModal
        show={sceneModal.show}
        onClose={() => setSceneModal({ show: false })}
        onSelect={scene => {
          setSelectedScene(scene);
          setSceneId(scene?.id || null);
          setSceneModal({ show: false });
        }}
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