import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchParams] = useSearchParams();
  const [char, setChar] = useState(null);
  const [creator, setCreator] = useState(null);
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const characterId = searchParams.get('character');
  const navigate = useNavigate();

  useEffect(() => {
    // First fetch current user
    fetch('/api/current-user', { credentials: 'include' })
      .then(res => {
        if (!res.ok) navigate('/');
        return res.json();
      })
      .then(user => {
        setCurrentUser(user);
        
        // Check likes immediately after setting user
        if (user?.liked_characters?.includes(parseInt(characterId))) {
          setHasLiked(true);
        }

        // Then fetch character data if characterId exists
        if (!characterId) return;

        fetch(`/api/character/${characterId}`)
          .then(res => res.json())
          .then(data => {
            setChar(data);
            setLikes(data.likes || 0);

            // Fetch creator info
            fetch(`/api/user/${data.creator_id}`)
              .then(r => r.json())
              .then(setCreator);

            // Update recent characters
            fetch('/api/recent-characters/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ character_id: characterId })
            });

            // Increment views
            fetch('/api/views/increment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ character_id: characterId })
            });

            console.log(user.chat_history)

            // Set messages based on user's chat history
            const entry = user.chat_history?.find(
              h => h.character_id === characterId
            );
            if (entry) {
              const sys = { 
                role: "system", 
                content: buildSystemMessage(data.persona || "", data.example_messages || "") 
              };
              setMessages([sys, ...entry.messages]);
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
      });
  }, [characterId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !char) return;

    const updatedMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(updatedMessages);
    setInput('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      
      // Refresh the user data to get updated chat history
      fetch('/api/current-user', { credentials: 'include' })
        .then(res => res.json())
        .then(setCurrentUser);
    }
  };

  const likeCharacter = async () => {
    const res = await fetch(`/api/character/${characterId}/like`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(true);
    }
  };

  const startNewChat = () => {
    const sys = { 
      role: "system", 
      content: buildSystemMessage(char.persona || "", char.example_messages || "") 
    };
    const greet = char.greeting ? { 
      role: "assistant", 
      content: char.greeting 
    } : null;
    setMessages(greet ? [sys, greet] : [sys]);
    setSelectedChat(null);
    setInput('');
    
    // Refresh the user data to get updated chat history
    fetch('/api/current-user', { credentials: 'include' })
      .then(res => res.json())
      .then(setCurrentUser);
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
                      ? (currentUser?.profile_pic || defaultPic) 
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

        {currentUser?.chat_history?.length > 0 && (
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
                
                <div className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {currentUser.chat_history
                    .filter(chat => chat.character_id === characterId)
                    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
                    .map((chat) => (
                      <button
                        key={chat.chat_id}
                        className={`list-group-item list-group-item-action text-start ${
                          selectedChat?.chat_id === chat.chat_id ? 'active' : ''
                        }`}
                        onClick={() => loadChat(chat)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-medium text-truncate">
                            {chat.title || chat.messages.find(m => m.role === 'user')?.content || 'New Chat'}
                          </span>
                          <small className="text-muted">
                            {new Date(chat.last_updated).toLocaleDateString()}
                          </small>
                        </div>
                        <div className="small text-truncate text-muted">
                          {chat.messages.find(m => m.role === 'assistant')?.content || 'No messages yet'}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Like Button - YouTube-inspired but cleaner */}
        <div className="d-flex justify-content-center mb-4">
          <button
            className={`btn btn-sm px-3 py-1 ${hasLiked ? 'text-danger' : 'text-muted'}`}
            onClick={likeCharacter}
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
