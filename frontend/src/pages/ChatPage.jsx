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

export default function ChatPage() {
  const { t } = useTranslation();
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, setUserData, idToken, refreshUserData, loading } = useContext(AuthContext);
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

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const [personaModal, setPersonaModal] = useState({ show: false });
  const [sceneModal, setSceneModal] = useState({ show: false });
  const [characterModal, setCharacterModal] = useState({ show: false });
  const [initModal, setInitModal] = useState(false);

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

  // Initialize character data (runs once when characterId changes)
  useEffect(() => {
    if (loading) return;

    // Only navigate if loading is false and idToken is still null (i.e., auth check finished and user is not logged in)
    if (!loading && !idToken) {
      navigate('/');
      return;
    }

    if (!initialized.current && idToken) {
      if(checkChatHistory()) {
        fetchInitialData();
        initializeChat();
      }
      initialized.current = true;
      return;
    }
  }, [navigate, idToken, loading, initialized, characterId, sceneId, personaId]);

  // Fetch character, scene, and persona data if IDs are present
  const fetchInitialData = () => {
    if (characterId) {
      fetch(`${window.API_BASE_URL}/api/character/${characterId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(character => {
          setSelectedCharacter(character);
          setLikes(character.likes || 0);
        });
    }
    if (sceneId) {
      fetch(`${window.API_BASE_URL}/api/scenes/${sceneId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(scene => {
          setSelectedScene(scene);
        });
    }
    if (personaId) {
      fetch(`${window.API_BASE_URL}/api/personas/${personaId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(persona => {
          setSelectedPersona(persona);
        });
    }

    // Fetch liked status for all at once
    if (characterId || sceneId || personaId) {
      const params = [];
      if (characterId) params.push(`character_id=${characterId}`);
      if (sceneId) params.push(`scene_id=${sceneId}`);
      if (personaId) params.push(`persona_id=${personaId}`);
      fetch(`${window.API_BASE_URL}/api/is-liked-multi?${params.join('&')}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setHasLiked({
            character: data.character ? !!data.character.liked : false,
            scene: data.scene ? !!data.scene.liked : false,
            persona: data.persona ? !!data.persona.liked : false
          });
        })
        .catch(() => setHasLiked({ character: false, scene: false, persona: false }));
    } else {
      setHasLiked({ character: false, scene: false, persona: false });
    }
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
    // Set likes and creator from selectedCharacter
    if (selectedCharacter) {
      // Update recent characters
      fetch(`${window.API_BASE_URL}/api/recent-characters/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify({ character_id: selectedCharacter.id })
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
          'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify(body)
      });
    }

    if(isNewChat.current) {
      startNewChat();
    }
  };

  const startNewChat = () => {
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
    let greet = null;
    if (selectedScene) {
      greet = {
        role: "assistant",
        content: `Welcome to the scene: "${selectedScene.name}". ${selectedScene.description}`
      };
    } else if ((selectedCharacter?.greeting )) {
      greet = {
        role: "assistant",
        content: selectedCharacter?.greeting
      };
    }
    setMessages(greet ? [sys, greet] : [sys]);
    setSelectedChat(null);
    setInput('');
  };

  const handleSend = async (event) => {
    event.preventDefault(); // Always prevent default
    if (sending || !input.trim() || !selectedCharacter) return;
    setSending(true);
    const updatedMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(updatedMessages);
    setInput('');
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
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
      alert('Failed to send message. Please try again.');
    }
    setSending(false);
  };

  // Generic like function for character, scene, or persona
  const likeEntity = async (entityType, entityId) => {
    const res = await fetch(`${window.API_BASE_URL}/api/like/${entityType}/${entityId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` }
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
      headers: { 'Authorization': `Bearer ${idToken}` }
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
          'Authorization': `Bearer ${idToken}` 
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
    if (!window.confirm('Are you sure you want to delete this chat?')) return;

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/chat/delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
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
          {messages.filter(m => m.role !== 'system').length === 0 ? (
            <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>{t('chat.no_messages')}</div>
          ) : (
            messages
              .filter(m => m.role !== 'system')
              .map((m, i) => (
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
                      src={m.role === 'user' ? (userData?.profile_pic || defaultPic) : (selectedCharacter?.picture || defaultPic)}
                      alt={m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                      style={{ width: 77, height: 77, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.6px solid #e9ecef' }}
                    />
                    <div style={{
                      margin: m.role === 'user' ? '0 0.4rem 0 0.88rem' : '0 0.88rem 0 0.4rem',
                      background: m.role === 'user' ? '#18191a' : '#f5f6fa',
                      color: m.role === 'user' ? '#fff' : '#232323',
                      borderRadius: '0.88rem',
                      padding: '0.68rem 0.96rem',
                      boxShadow: m.role === 'user' ? '0 2px 8px rgba(24,25,26,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
                      fontSize: '0.82rem',
                      minWidth: 0,
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.76rem', marginBottom: 2, opacity: 0.7 }}>
                        {m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
                      </div>
                      <div>{m.content}</div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Input Area (no form) */}
        <form onSubmit={handleSend} style={{ padding: '0.8rem 1.2rem', background: '#f8f9fa', borderTop: '1.2px solid #e9ecef' }}>
          <div style={{ display: 'flex', gap: '0.64rem', alignItems: 'center' }}>
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
        </form>
      </div>

      <ChatInitModal
        show={initModal}
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
          fetchInitialData();
          initializeChat();
        }}
        onCancel={() => setInitModal(false)}
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
    </div>
  );
}