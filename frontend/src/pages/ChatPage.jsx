import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import PersonaModal from '../components/PersonaModal';
import SceneModal from '../components/SceneModal';
import CharacterModal from '../components/CharacterModal';
import CharacterSidebar from '../components/CharacterSidebar';
import ChatInitModal from '../components/ChatInitModal';

export default function ChatPage() {
  const { characterSidebarVisible, onToggleCharacterSidebar } = useOutletContext();
  const { userData, idToken, refreshUserData } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
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

  const navigate = useNavigate();
  const initialized = useRef(false);
  const isNewChat = useRef(true);

  // Initialize character data (runs once when characterId changes)
  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    if (!initialized.current) {
      loadChatHistory();
      fetchInitialData();
      initializeChat();
      initialized.current = true;
      return;
    }


    
  }, [navigate, idToken]);

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

    // Fetch scene if present (handle '0' and empty string)
    if (sceneId) {
      fetch(`${window.API_BASE_URL}/api/scenes/${sceneId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(scene => {
          setSelectedScene(scene);
        });
    }

    // Fetch persona if present (handle '0' and empty string)
    if (personaId) {
      fetch(`${window.API_BASE_URL}/api/personas/${personaId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(persona => {
          setSelectedPersona(persona);
        });
    }
  };

  // Loads chat history for the current characterId
  const loadChatHistory = () => {
    // Set messages based on user's chat history
    const entry = userData?.chat_history?.find(
      h => h.character_id === characterId
    );
    if (entry) {
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
      isNewChat.current = false;
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
      // Increment views
      fetch(`${window.API_BASE_URL}/api/views/increment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify({ character_id: selectedCharacter.id })
      });
    }

    // Check likes from userData
    if (userData?.liked_characters?.includes(parseInt(characterId))) {
      setHasLiked(true);
    }

    if(isNewChat.current) {
      startNewChat();
    }
  };

  const startNewChat = () => {
    const sys = {
      role: "system",
      content: buildSystemMessage(
        (selectedCharacter?.persona || ""),
        (selectedCharacter?.example_messages || ""),
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
        setSelectedChat({
          chat_id: data.chat_id,
          title: data.chat_title || updatedMessages.find(m => m.role === 'user')?.content || 'New Chat',
          character_id: characterId,
          messages: [...updatedMessages, { role: 'assistant', content: data.response }],
          last_updated: new Date().toISOString()
        });
      }
    } catch (err) {
      alert('Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const likeCharacter = async () => {
    const res = await fetch(`${window.API_BASE_URL}/api/character/${characterId}/like`, { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(true);
      await refreshUserData();
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
        // Refresh user data
        await refreshUserData();
        setEditingChatId(null);
        setNewTitle('');
        
        // Update selected chat if it's the one being renamed
        if (selectedChat?.chat_id === chatId) {
          setSelectedChat(prev => ({
            ...prev,
            title: newTitle.trim()
          }));
        }
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
        // Refresh user data
        await refreshUserData();
        
        // If deleted chat was the selected one, start new chat
        if (selectedChat?.chat_id === chatId) {
          startNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const toggleMenu = (chatId, e) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === chatId ? null : chatId);
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      background: '#f8f9fa', 
      minHeight: 0,
      position: 'relative', // Add this
      width: '100%', // Add this
      overflow: 'hidden' // Add this to prevent any odd scrolling
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
            <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>No messages yet. Start the conversation!</div>
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
                      alt={m.role === 'user' ? 'You' : selectedCharacter?.name}
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
                        {m.role === 'user' ? 'You' : selectedCharacter?.name}
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
              placeholder="Type your message..."
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
        onStartChat={async () => {
          setInitModal(false);
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
        likeCharacter={likeCharacter}
        hasLiked={hasLiked}
        likes={likes}
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
          setPersonaModal({ show: false });
        }}
      />
      <SceneModal
        show={sceneModal.show}
        onClose={() => setSceneModal({ show: false })}
        onSelect={scene => {
          setSelectedScene(scene);
          setSceneModal({ show: false });
        }}
      />
      <CharacterModal
        show={characterModal.show}
        onClose={() => setCharacterModal({ show: false })}
        onSelect={character => {
          setSelectedCharacter(character);
          setCharacterModal({ show: false });
        }}
      />
    </div>
  );
}