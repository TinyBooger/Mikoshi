import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';
import { AuthContext } from '../components/AuthProvider';

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
  const characterId = searchParams.get('character');
  const navigate = useNavigate();

  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    // Check likes from userData
    if (userData?.liked_characters?.includes(parseInt(characterId))) {
      setHasLiked(true);
    }

    // Fetch character data if characterId exists
    if (!characterId) return;

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

        // Set messages based on user's chat history
        const entry = userData?.chat_history?.find(
          h => h.character_id === characterId
        );
        if (entry) {
          setMessages([...entry.messages]);
        } else {
          const sys = { 
            role: "system", 
            content: buildSystemMessage(data.persona || "", data.example_messages || "") 
          };
          const greet = data.greeting ? { 
            role: "assistant", 
            content: data.greeting 
          } : null;
          setMessages(greet ? [sys, greet] : [sys]);
        }
      });
  }, [characterId, navigate, idToken, userData]);

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

  const startNewChat = () => {
    const userPersonaObj = userData?.personas?.find(p => p.id === selectedPersonaId);
    const sys = {
      role: "system",
      content: buildSystemMessage(char.persona || "", char.example_messages || "", userPersonaObj?.description || null)
    };
    const greet = char.greeting ? {
      role: "assistant",
      content: char.greeting
    } : null;
    setMessages(greet ? [sys, greet] : [sys]);
    setSelectedChat(null);
    setInput('');

    // Refresh user data
    refreshUserData();
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

  return (
    <div className="d-flex h-100 bg-light">
      {/* Main Chat Area */}
      <div className="flex-grow-1 d-flex flex-column p-0 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Messages Area */}
        <div className="flex-grow-1 p-4 overflow-auto">
          {messages
            .filter(m => m.role !== 'system')
            .map((m, i) => (
              <div 
                key={i} 
                className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div 
                  className={`d-flex align-items-start ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  style={{ maxWidth: '80%' }}
                >
                  <img
                    src={m.role === 'user' 
                      ? (userData?.profile_pic || defaultPic) 
                      : (char?.picture || defaultPic)}
                    alt={m.role === 'user' ? 'You' : char?.name}
                    className="rounded-circle flex-shrink-0 mt-1"
                    style={{ width: 36, height: 36, objectFit: 'cover' }}
                  />
                  <div 
                    className={`mx-3 p-3 rounded-4 ${m.role === 'user' 
                      ? 'bg-primary text-white' 
                      : 'bg-white border'}`}
                  >
                    <div className="fw-bold small mb-1">
                      {m.role === 'user' ? 'You' : char?.name}
                    </div>
                    <div>{m.content}</div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Input Form */}
        <div className="p-3 bg-white border-top">
          <form className="d-flex gap-2 align-items-center" onSubmit={handleSubmit}>
            <input
              className="form-control rounded-pill border-0 bg-light"
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              required
            />
            <button 
              className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center" 
              style={{ width: 40, height: 40 }}
            >
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      </div>

      {/* Character Sidebar */}
      <aside className="border-start d-flex flex-column bg-white p-4" style={{ width: 320, minHeight: 0 }}>
        <div className="d-flex align-items-start mb-4">
          <img
            src={char?.picture || defaultPic}
            alt="Character Avatar"
            className="rounded-circle me-3 shadow-sm"
            style={{ width: 100, height: 100, objectFit: 'cover', border: '3px solid #e9ecef' }}
          />
          
          <div className="mt-2">
            <div className="text-muted small mb-1">
              <i className="bi bi-person-fill me-1"></i> By: 
              <span 
                className="ms-1 text-primary fw-medium cursor-pointer"
                onClick={() => navigate(`/profile/${char?.creator_id}`)}
              >
                {creator?.name || 'Unknown'}
              </span>
            </div>
            <div className="text-muted small mb-1">
              <i className="bi bi-calendar me-1"></i> {char && new Date(char.created_time).toLocaleDateString()}
            </div>
            <div className="text-muted small">
              <i className="bi bi-chat-square-text me-1"></i> {char?.views || 0} chats
            </div>
          </div>
        </div>

        <h3 className="fw-bold text-center mb-2">{char?.name}</h3>

        {char?.tagline && (
          <p className="text-center text-muted mb-4 px-3 fst-italic">
            "{char.tagline}"
          </p>
        )}

        {userData?.chat_history?.length > 0 && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0">Chat History</h6>
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowChatHistory(!showChatHistory)}
              >
                {showChatHistory ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showChatHistory && (
              <div className="mb-3">
                <button 
                  className="btn btn-sm btn-success w-100 mb-2"
                  onClick={startNewChat}
                >
                  <i className="bi bi-plus-circle me-2"></i>New Chat
                </button>

                {userData?.personas?.length > 0 && (
                  <div className="dropdown mb-2">
                    <button 
                      className="btn btn-outline-secondary btn-sm dropdown-toggle w-100"
                      type="button"
                      data-bs-toggle="dropdown"
                    >
                      Load Persona
                    </button>
                    <ul className="dropdown-menu w-100">
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
                    </ul>
                  </div>
                )}
                
                <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {userData.chat_history
                    .filter(chat => chat.character_id === characterId)
                    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
                    .map((chat) => (
                      <div 
                        key={chat.chat_id}
                        className={`list-group-item list-group-item-action text-start p-2 ${
                          selectedChat?.chat_id === chat.chat_id ? 'active' : ''
                        }`}
                        onClick={() => loadChat(chat)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          height: '48px', // Fixed height
                          overflow: 'hidden'
                        }}
                      >
                        {editingChatId === chat.chat_id ? (
                          <div className="d-flex align-items-center w-100">
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
                              style={{ flex: 1 }}
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
                            <span 
                              className="text-truncate pe-2" 
                              style={{
                                flex: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {chat.title || chat.messages.find(m => m.role === 'user')?.content || 'New Chat'}
                            </span>
                            
                            <div className="d-flex align-items-center position-relative">
                              <small className="text-muted me-2">
                                {new Date(chat.last_updated).toLocaleDateString()}
                              </small>
                              
                              <div className="dropdown">
                                <button 
                                  className="btn btn-sm btn-link text-muted p-0"
                                  onClick={(e) => toggleMenu(chat.chat_id, e)}
                                  style={{ 
                                    position: 'relative',
                                    zIndex: menuOpenId === chat.chat_id ? 1000 : 'auto'
                                  }}
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
              </div>
            )}
          </div>
        )}

        {/* Like Button - YouTube-inspired but cleaner */}
        <div className="d-flex justify-content-center mb-4">
          <button
            className={`btn btn-sm px-3 py-1 ${hasLiked ? 'btn-danger disabled' : 'btn-outline-danger'}`}
            onClick={likeCharacter}
            disabled={hasLiked}
            style={{
              transition: 'all 0.2s ease',
              ...(hasLiked ? {
                cursor: 'not-allowed',
                opacity: 0.8
              } : {})
            }}
          >
            <i className={`bi ${hasLiked ? 'bi-heart-fill' : 'bi-heart'} fs-5`}></i>
            <span className="ms-2 fw-medium">{likes}</span>
          </button>
        </div>

        {/* Tags */}
        {char?.tags?.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold mb-2 text-center">Tags</h6>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {char.tags.map((tag, i) => (
                <span key={i} className="badge bg-light text-dark border">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}