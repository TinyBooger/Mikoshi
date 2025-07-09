import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';
import { buildSystemMessage } from '../utils/systemTemplate';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const [char, setChar] = useState(null);
  const [creator, setCreator] = useState(null);
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const characterId = searchParams.get('character');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/current-user', { credentials: 'include' })
      .then(res => {
        if (!res.ok) navigate('/');
        return res.json();
      })
      .then(user => {
        if (user?.liked_characters?.includes(parseInt(characterId))) {
          setHasLiked(true);
        }
      });
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;

    fetch(`/api/character/${characterId}`)
      .then(res => res.json())
      .then(data => {
        setChar(data);
        setLikes(data.likes || 0);

        fetch(`/api/user/${data.creator_id}`)
          .then(r => r.json())
          .then(setCreator);

        fetch('/api/recent-characters/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: characterId })
        });

        fetch('/api/views/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: characterId })
        });

        if (data.greeting) {
          setMessages([
            { role: "system", content: buildSystemMessage(data.persona || "", data.example_messages || "") },
            { role: "assistant", content: data.greeting }
          ]);
        } else {
          setMessages([{ role: "system", content: buildSystemMessage(data.persona || "", data.example_messages || "") }]);
        }
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
        messages: updatedMessages
      })
    });

    const data = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
  };

  const likeCharacter = async () => {
    const res = await fetch(`/api/character/${characterId}/like`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setLikes(data.likes);
      setHasLiked(true);
    }
  };

  return (
    <div className="d-flex h-100 bg-light">
      {/* Main Chat Area */}
      <div className="flex-grow-1 d-flex flex-column p-4 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="d-flex align-items-center mb-4">
          <h4 className="mb-0 text-primary">
            <i className="bi bi-chat-dots me-2"></i>
            Chatting with: <span className="fw-bold">{char?.name || 'Unknown'}</span>
          </h4>
        </div>

        {/* Messages Area */}
        <div className="flex-grow-1 rounded-3 p-3 mb-3 overflow-auto bg-white shadow-sm">
          {messages
            .filter(m => m.role !== 'system')
            .map((m, i) => (
              <div 
                key={i} 
                className={`mb-3 p-3 rounded-3 ${m.role === 'user' ? 'bg-primary text-white align-self-end' : 'bg-light align-self-start'}`}
                style={{ maxWidth: '80%' }}
              >
                <strong>{m.role === 'user' ? 'You' : char?.name}:</strong> 
                <div className="mt-1">{m.content}</div>
              </div>
          ))}
        </div>

        {/* Input Form */}
        <form className="d-flex gap-2 align-items-center bg-white rounded-3 p-2 shadow" onSubmit={handleSubmit}>
          <input
            className="form-control border-0"
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

        {/* Like Button */}
        <div className="d-flex justify-content-between align-items-center bg-light rounded-3 p-3 mb-4">
          <div>
            <span className="fw-bold me-2">{likes}</span>
            <span className="text-muted small">likes</span>
          </div>
          <button
            className={`btn btn-sm ${hasLiked ? 'btn-success' : 'btn-outline-primary'}`}
            onClick={likeCharacter}
            disabled={hasLiked}
          >
            <i className="bi bi-hand-thumbs-up-fill me-1"></i>
            {hasLiked ? 'Liked' : 'Like'}
          </button>
        </div>

        {/* Tags */}
        {char?.tags?.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold mb-2">Tags</h6>
            <div className="d-flex flex-wrap gap-2">
              {char.tags.map((tag, i) => (
                <span key={i} className="badge bg-primary bg-opacity-10 text-primary">
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
