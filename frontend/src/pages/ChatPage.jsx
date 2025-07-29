import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';
import PersonaModal from '../components/PersonaModal';
import SceneModal from '../components/SceneModal';

export default function ChatPage() {
  const { userData, idToken, refreshUserData } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [char, setChar] = useState(null);
  const [creator, setCreator] = useState(null);
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [personaModal, setPersonaModal] = useState({
    show: false,
    currentPersona: null
  });
  const [sceneModal, setSceneModal] = useState({ show: false });
  const characterId = searchParams.get('character');
  const navigate = useNavigate();
  const initialized = useRef(false);

  // Initialize character data (runs once when characterId changes)
  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    if (!characterId) return;

    // Reset initialization flag when character changes
    initialized.current = false;

    fetch(`/api/character/${characterId}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setChar(data);
        setLikes(data.likes || 0);

        // Fetch creator info
        fetch(`/api/user/${data.creator_id}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
          .then(r => r.json())
          .then(setCreator);

        // Update recent characters
        fetch('/api/recent-characters/update', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          },
          body: JSON.stringify({ character_id: characterId })
        });

        // Increment views
        fetch('/api/views/increment', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          },
          body: JSON.stringify({ character_id: characterId })
        });
      });
  }, [characterId, navigate, idToken]);

  // Initialize messages and likes (runs once after character is loaded)
  useEffect(() => {
    if (!char || !userData || initialized.current) return;

    // Mark as initialized
    initialized.current = true;

    // Check likes from userData
    if (userData?.liked_characters?.includes(parseInt(characterId))) {
      setHasLiked(true);
    }

    // Set messages based on user's chat history
    const entry = userData?.chat_history?.find(
      h => h.character_id === characterId
    );
    if (entry) {
      setMessages([...entry.messages]);
    } else {
      initializeNewChat();
    }
  }, [char, userData, characterId]);

  // Fetch user's scenes on mount or when userData changes
  useEffect(() => {
    if (!idToken) return;
    fetch('/api/scenes', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.json())
      .then(setScenes);
  }, [idToken, userData]);

  const initializeNewChat = () => {
    const userPersonaObj = userData?.personas?.find(p => p.id === selectedPersonaId);
    const sceneObj = scenes?.find(s => s.id === selectedSceneId);
    const sys = { 
      role: "system", 
      content: buildSystemMessage(
        char.persona || "", 
        char.example_messages || "", 
        userPersonaObj?.description || null,
        sceneObj?.description || null
      ) 
    };
    let greet = null;
    if (sceneObj) {
      greet = { 
        role: "assistant", 
        content: `Welcome to the scene: "${sceneObj.name}". ${sceneObj.description}` 
      };
    } else if (char.greeting) {
      greet = { 
        role: "assistant", 
        content: char.greeting 
      };
    }
    setMessages(greet ? [sys, greet] : [sys]);
  };

  const startNewChat = () => {
    setSelectedChat(null);
    setInput('');
    initializeNewChat();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !char) return;

    const updatedMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(updatedMessages);
    setInput('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify({
        character_id: characterId,
        chat_id: selectedChat?.chat_id,
        messages: updatedMessages
      })
    });

    const data = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    
    // Update selected chat and refresh user data
    if (data.chat_id) {
      setSelectedChat({
        chat_id: data.chat_id,
        title: data.chat_title || updatedMessages.find(m => m.role === 'user')?.content || 'New Chat',
        character_id: characterId,
        messages: [...updatedMessages, { role: 'assistant', content: data.response }],
        last_updated: new Date().toISOString()
      });
      
      // Refresh the user data
      await refreshUserData();
    }
  };

  const likeCharacter = async () => {
    const res = await fetch(`/api/character/${characterId}/like`, { 
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
      content: buildSystemMessage(char.persona || "", char.example_messages || "") 
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
      const res = await fetch('/api/chat/rename', {
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
      const res = await fetch('/api/chat/delete', {
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

  const handlePersonaSelect = (personaId) => {
    const confirmed = window.confirm("This will start a new chat, are you sure?");
    if (!confirmed) return;

    setSelectedPersonaId(personaId);
    startNewChat(); // reuse existing logic
  };

  const handlePersonaSave = async (personaData) => {
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify(personaData)
      });

      if (!res.ok) throw new Error('Failed to create persona');
      
      const newPersona = await res.json();
      await refreshUserData(); // Refresh to get the new persona
      
      // Optionally select the new persona immediately
      setSelectedPersonaId(newPersona.id);
      startNewChat();
      
      setPersonaModal({ show: false, currentPersona: null });
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSceneSelect = (sceneId) => {
    const confirmed = window.confirm("This will start a new chat, are you sure?");
    if (!confirmed) return;
    setSelectedSceneId(sceneId);
    startNewChat();
  };

  const handleSceneSave = async (sceneData) => {
    try {
      const formData = new FormData();
      formData.append('name', sceneData.name);
      formData.append('description', sceneData.description);
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData
      });
      if (!res.ok) throw new Error('Failed to create scene');
      const newScene = await res.json();
      setScenes(prev => [...prev, newScene]);
      setSelectedSceneId(newScene.id);
      setSceneModal({ show: false });
      startNewChat();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#fff', borderRadius: '1.5rem', margin: '2rem 0.5rem 2rem 2rem', boxShadow: '0 2px 16px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {/* Messages Area */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#fff' }}>
          {messages.filter(m => m.role !== 'system').length === 0 ? (
            <div className="text-muted text-center" style={{ marginTop: '6rem', fontSize: '1.2rem' }}>No messages yet. Start the conversation!</div>
          ) : (
            messages
              .filter(m => m.role !== 'system')
              .map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    marginBottom: '1.5rem',
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
                      src={m.role === 'user' ? (userData?.profile_pic || defaultPic) : (char?.picture || defaultPic)}
                      alt={m.role === 'user' ? 'You' : char?.name}
                      style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '2px solid #e9ecef' }}
                    />
                    <div style={{
                      margin: m.role === 'user' ? '0 0.5rem 0 1.25rem' : '0 1.25rem 0 0.5rem',
                      background: m.role === 'user' ? '#18191a' : '#f5f6fa',
                      color: m.role === 'user' ? '#fff' : '#232323',
                      borderRadius: '1.25rem',
                      padding: '1rem 1.5rem',
                      boxShadow: m.role === 'user' ? '0 2px 8px rgba(24,25,26,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
                      fontSize: '1.08rem',
                      minWidth: 0,
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: 4, opacity: 0.7 }}>
                        {m.role === 'user' ? 'You' : char?.name}
                      </div>
                      <div>{m.content}</div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Input Form */}
        <div style={{ padding: '1.25rem 2rem', background: '#f8f9fa', borderTop: '1.5px solid #e9ecef' }}>
          <form style={{ display: 'flex', gap: '1rem', alignItems: 'center' }} onSubmit={handleSubmit}>
            <input
              style={{
                flex: 1,
                borderRadius: '2rem',
                border: '1.5px solid #e9ecef',
                background: '#fff',
                padding: '0.75rem 1.5rem',
                fontSize: '1.08rem',
                outline: 'none',
                color: '#232323',
                boxShadow: 'none',
                transition: 'border 0.18s',
              }}
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              required
              onFocus={e => e.target.style.border = '1.5px solid #18191a'}
              onBlur={e => e.target.style.border = '1.5px solid #e9ecef'}
            />
            <button
              type="submit"
              style={{
                background: '#18191a',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 2px 8px rgba(24,25,26,0.08)',
                transition: 'background 0.18s',
                cursor: 'pointer',
                outline: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#232323'}
              onMouseLeave={e => e.currentTarget.style.background = '#18191a'}
            >
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      </div>

      {/* Character Sidebar */}
      <aside style={{ width: 340, minHeight: 0, background: '#fff', borderRadius: '1.5rem', margin: '2rem 2rem 2rem 0', boxShadow: '0 2px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', padding: '2rem 2rem 1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <img
            src={char?.picture || defaultPic}
            alt="Character Avatar"
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '50%', border: '3px solid #e9ecef', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginRight: 24 }}
          />
          <div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>
              <i className="bi bi-person-fill me-1"></i> By:
              <span
                style={{ color: '#18191a', fontWeight: 600, marginLeft: 6, cursor: 'pointer' }}
                onClick={() => navigate(`/profile/${char?.creator_id}`)}
              >
                {creator?.name || 'Unknown'}
              </span>
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>
              <i className="bi bi-calendar me-1"></i> {char && new Date(char.created_time).toLocaleDateString()}
            </div>
            <div style={{ color: '#888', fontSize: 13 }}>
              <i className="bi bi-chat-square-text me-1"></i> {char?.views || 0} chats
            </div>
          </div>
        </div>

        <h3 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#18191a', fontSize: '1.5rem', letterSpacing: '0.5px' }}>{char?.name}</h3>

        {char?.tagline && (
          <p style={{ textAlign: 'center', color: '#888', marginBottom: 24, fontStyle: 'italic', fontSize: '1.08rem' }}>
            "{char.tagline}"
          </p>
        )}

        {/* Always show New Chat button, Persona and Scene selection */}
        <div style={{ marginBottom: 24 }}>
          <button
            style={{
              width: '100%',
              background: '#18191a',
              color: '#fff',
              border: 'none',
              borderRadius: '2rem',
              fontWeight: 600,
              fontSize: '1.08rem',
              padding: '0.6rem 0',
              marginBottom: 12,
              boxShadow: '0 2px 8px rgba(24,25,26,0.08)',
              cursor: 'pointer',
              transition: 'background 0.18s',
              outline: 'none',
            }}
            onClick={startNewChat}
            onMouseEnter={e => e.currentTarget.style.background = '#232323'}
            onMouseLeave={e => e.currentTarget.style.background = '#18191a'}
          >
            <i className="bi bi-plus-circle me-2"></i>New Chat
          </button>

          {/* Persona dropdown */}
          <div className="dropdown" style={{ marginBottom: 12 }}>
            <button
              className="btn btn-outline-secondary btn-sm dropdown-toggle w-100"
              type="button"
              data-bs-toggle="dropdown"
              style={{
                borderRadius: '2rem',
                fontWeight: 600,
                fontSize: '1.02rem',
                background: '#f5f6fa',
                color: '#232323',
                border: '1.5px solid #e9ecef',
                padding: '0.5rem 1.2rem',
                outline: 'none',
                boxShadow: 'none',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
              }}
            >
              {selectedPersonaId
                ? userData?.personas?.find(p => p.id === selectedPersonaId)?.name || 'Select Persona'
                : 'Select Persona'}
            </button>
            <ul className="dropdown-menu w-100">
              {userData?.personas?.length > 0 ? (
                <>
                  {userData.personas.map(p => (
                    <li key={p.id}>
                      <button
                        className="dropdown-item"
                        onClick={() => handlePersonaSelect(p.id)}
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                  <li><hr className="dropdown-divider" /></li>
                </>
              ) : (
                <li className="dropdown-item-text small text-muted px-3 py-2">
                  No personas created yet
                </li>
              )}
              <li>
                <button
                  className="dropdown-item text-primary"
                  onClick={() => setPersonaModal({ show: true, currentPersona: null })}
                >
                  <i className="bi bi-plus-circle me-1"></i> Create New Persona
                </button>
              </li>
            </ul>
          </div>

          {/* Scene dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-outline-secondary btn-sm dropdown-toggle w-100"
              type="button"
              data-bs-toggle="dropdown"
              style={{
                borderRadius: '2rem',
                fontWeight: 600,
                fontSize: '1.02rem',
                background: '#f5f6fa',
                color: '#232323',
                border: '1.5px solid #e9ecef',
                padding: '0.5rem 1.2rem',
                outline: 'none',
                boxShadow: 'none',
                transition: 'background 0.18s, color 0.18s, border 0.18s',
              }}
            >
              {selectedSceneId
                ? scenes?.find(s => s.id === selectedSceneId)?.name || 'Select Scene'
                : 'Select Scene'}
            </button>
            <ul className="dropdown-menu w-100">
              {scenes?.length > 0 ? (
                <>
                  {scenes.map(s => (
                    <li key={s.id}>
                      <button
                        className="dropdown-item"
                        onClick={() => handleSceneSelect(s.id)}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                  <li><hr className="dropdown-divider" /></li>
                </>
              ) : (
                <li className="dropdown-item-text small text-muted px-3 py-2">
                  No scenes created yet
                </li>
              )}
              <li>
                <button
                  className="dropdown-item text-primary"
                  onClick={() => setSceneModal({ show: true })}
                >
                  <i className="bi bi-plus-circle me-1"></i> Create New Scene
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Chat History Section */}
        {userData?.chat_history?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h6 style={{ fontWeight: 700, margin: 0, fontSize: '1.02rem', color: '#18191a' }}>Chat History</h6>
              <button
                style={{
                  background: '#fff',
                  color: '#18191a',
                  border: '1.5px solid #e9ecef',
                  borderRadius: '1.5rem',
                  fontWeight: 600,
                  fontSize: '0.98rem',
                  padding: '0.2rem 1.1rem',
                  cursor: 'pointer',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                  outline: 'none',
                }}
                onClick={() => setShowChatHistory(!showChatHistory)}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                {showChatHistory ? 'Hide' : 'Show'}
              </button>
            </div>
            {showChatHistory && (
              <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 12, background: '#f5f6fa', padding: 8 }}>
                {userData.chat_history
                  .filter(chat => chat.character_id === characterId)
                  .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
                  .map((chat) => (
                    <div
                      key={chat.chat_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 1rem',
                        borderRadius: 10,
                        background: selectedChat?.chat_id === chat.chat_id ? '#18191a' : 'transparent',
                        color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#232323',
                        marginBottom: 4,
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.98rem',
                        transition: 'background 0.18s, color 0.18s',
                      }}
                      onClick={() => loadChat(chat)}
                    >
                      {editingChatId === chat.chat_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <input
                            type="text"
                            className="form-control form-control-sm me-2"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(chat.chat_id, chat.title);
                              if (e.key === 'Escape') setEditingChatId(null);
                            }}
                            autoFocus
                            style={{ flex: 1, borderRadius: 8, border: '1.5px solid #e9ecef', fontSize: '0.98rem' }}
                          />
                          <button
                            className="btn btn-sm btn-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(chat.chat_id, chat.title);
                            }}
                          >
                            <i className="bi bi-check"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-danger ms-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChatId(null);
                            }}
                          >
                            <i className="bi bi-x"></i>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {chat.title || chat.messages.find(m => m.role === 'user')?.content || 'New Chat'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <small style={{ color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#888', fontWeight: 400 }}>
                              {new Date(chat.last_updated).toLocaleDateString()}
                            </small>
                            <div className="dropdown">
                              <button
                                className="btn btn-sm btn-link text-muted p-0"
                                onClick={(e) => toggleMenu(chat.chat_id, e)}
                                style={{ position: 'relative', zIndex: menuOpenId === chat.chat_id ? 1000 : 'auto', color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#888' }}
                              >
                                <i className="bi bi-three-dots-vertical"></i>
                              </button>
                              {menuOpenId === chat.chat_id && (
                                <div
                                  className="dropdown-menu show"
                                  style={{
                                    position: 'fixed',
                                    right: '1rem',
                                    zIndex: 9999,
                                    minWidth: '120px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                  }}
                                >
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNewTitle(chat.title || '');
                                      setEditingChatId(chat.chat_id);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <i className="bi bi-pencil me-2"></i> Rename
                                  </button>
                                  <button
                                    className="dropdown-item text-danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(chat.chat_id);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <i className="bi bi-trash me-2"></i> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Like Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <button
            onClick={likeCharacter}
            disabled={hasLiked}
            style={{
              background: hasLiked ? '#e53935' : '#fff',
              color: hasLiked ? '#fff' : '#e53935',
              border: hasLiked ? 'none' : '1.5px solid #e53935',
              borderRadius: '2rem',
              fontWeight: 600,
              fontSize: '1.08rem',
              padding: '0.4rem 1.5rem',
              boxShadow: hasLiked ? '0 2px 8px rgba(229,57,53,0.08)' : 'none',
              cursor: hasLiked ? 'not-allowed' : 'pointer',
              opacity: hasLiked ? 0.8 : 1,
              transition: 'all 0.18s',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <i className={`bi ${hasLiked ? 'bi-heart-fill' : 'bi-heart'}`} style={{ fontSize: 20 }}></i>
            <span style={{ fontWeight: 600 }}>{likes}</span>
          </button>
        </div>

        {/* Tags */}
        {char?.tags?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h6 style={{ fontWeight: 700, marginBottom: 8, textAlign: 'center', color: '#18191a', fontSize: '1.02rem' }}>Tags</h6>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {char.tags.map((tag, i) => (
                <span key={i} style={{
                  background: '#f5f6fa',
                  color: '#232323',
                  border: '1.5px solid #e9ecef',
                  borderRadius: '1.5rem',
                  fontWeight: 600,
                  fontSize: '0.98rem',
                  padding: '0.3rem 1.1rem',
                  marginBottom: 2
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false, currentPersona: null })}
        onSave={handlePersonaSave}
        currentPersona={personaModal.currentPersona}
      />
      <SceneModal
        show={sceneModal.show}
        onClose={() => setSceneModal({ show: false })}
        onSubmit={handleSceneSave}
      />
    </div>
  );
}