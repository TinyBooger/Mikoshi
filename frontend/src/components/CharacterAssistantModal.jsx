import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from './AuthProvider';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastProvider';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export default function CharacterAssistantModal({ 
  onApply, 
  onHide, 
  currentCharData,
  initialMessages,
  initialGeneratedData,
  onMessagesChange,
  onGeneratedDataChange
}) {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(initialMessages || [
    {
      role: 'assistant',
      content: t('character_assistant.welcome_message')
    }
  ]);
  const [generatedData, setGeneratedData] = useState(initialGeneratedData || null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Prevent body scroll on mobile when modal is open
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      document.body.classList.add('modal-open');
      document.body.style.top = `-${window.scrollY}px`;
      const scrollY = window.scrollY;
      
      return () => {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, []);

  // Sync state with parent
  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  useEffect(() => {
    if (onGeneratedDataChange) {
      onGeneratedDataChange(generatedData);
    }
  }, [generatedData, onGeneratedDataChange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    setLoading(true);
    try {
      // Build context from previous character data if exists
      let contextPrompt = userMessage;
      if (generatedData) {
        contextPrompt = `Previous character data:\nName: ${generatedData.name}\nPersona: ${generatedData.persona}\nTagline: ${generatedData.tagline}\nGreeting: ${generatedData.greeting}\nSample Dialogue: ${generatedData.sample_dialogue}\n\nUser request: ${userMessage}\n\nPlease modify the character based on this request.`;
      }

      const response = await fetch(`${window.API_BASE_URL}/api/character-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({ prompt: contextPrompt })
      });

      const data = await response.json();
      
      if (response.ok) {
        setGeneratedData(data);
        
        // Add assistant response to chat
        const assistantMessage = `${t('character_assistant.generated_prefix')}\n\n**${t('character_form.name')}:** ${data.name}\n\n**${t('character_form.tagline')}:** ${data.tagline}\n\n**${t('character_form.persona')}:** ${data.persona}\n\n**${t('character_form.greeting')}:** ${data.greeting}\n\n**${t('character_form.sample_dialogue')}:**\n${data.sample_dialogue}`;
        
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: assistantMessage,
          data: data
        }]);

        // Auto-apply to form
        onApply(data);
        toast.show(t('character_assistant.applied_success'));
      } else {
        const errorMsg = data.detail || t('character_assistant.error');
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: `❌ ${errorMsg}` 
        }]);
        toast.show(errorMsg, { type: 'error' });
      }
    } catch (error) {
      const errorMsg = t('character_assistant.error');
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: `❌ ${errorMsg}` 
      }]);
      toast.show(errorMsg, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modalContent = (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onHide}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease-out',
        }}
      />
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInBottom {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .character-assistant-modal {
            width: 100% !important;
            max-width: 100vw !important;
            height: 70vh !important;
            max-height: 70vh !important;
            top: auto !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            border-radius: 24px 24px 0 0 !important;
            animation: slideInBottom 0.3s ease-out !important;
            position: fixed !important;
            transform: none !important;
          }
          .assistant-header {
            padding: 1rem !important;
            border-radius: 24px 24px 0 0 !important;
          }
          .assistant-header h3 {
            font-size: 1.1rem !important;
          }
          .assistant-header small {
            font-size: 0.8rem !important;
          }
          .assistant-messages {
            padding: 1rem !important;
          }
          .assistant-input-container {
            padding: 1rem !important;
          }
        }
        @media (min-width: 769px) {
          .character-assistant-modal {
            animation: slideInBottom 0.3s ease-out !important;
          }
        }
        
        /* Prevent body scroll when modal is open on mobile */
        @supports (-webkit-touch-callout: none) {
          body.modal-open {
            position: fixed;
            width: 100%;
            overflow: hidden;
          }
        }
      `}</style>
      
      {/* Modal */}
      <div
        className="character-assistant-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '450px',
          height: '100vh',
          background: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
        }}
      >

      {/* Header */}
      <div
        className="assistant-header"
        style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="bi bi-magic" style={{ fontSize: '1.5rem' }}></i>
          <div>
            <h3 className="fw-bold mb-0" style={{ fontSize: '1.25rem' }}>
              {t('character_assistant.title')}
            </h3>
            <small style={{ opacity: 0.9, fontSize: '0.85rem' }}>
              {t('character_assistant.subtitle')}
            </small>
          </div>
        </div>
        <button
          onClick={onHide}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '1.25rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          title={t('character_assistant.hide')}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Messages */}
      <div
        className="assistant-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          background: '#f8f9fa',
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: msg.role === 'user' 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : '#e9ecef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: msg.role === 'user' ? '#fff' : '#495057',
                fontSize: '0.9rem',
              }}
            >
              <i className={msg.role === 'user' ? 'bi bi-person-fill' : 'bi bi-robot'}></i>
            </div>
            <div
              style={{
                maxWidth: '75%',
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                background: msg.role === 'user' ? '#667eea' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                fontSize: '0.95rem',
                lineHeight: '1.5',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#e9ecef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className="bi bi-robot"></i>
            </div>
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                background: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              }}
            >
              <span className="spinner-border spinner-border-sm me-2"></span>
              {t('character_assistant.thinking')}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="assistant-input-container"
        style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e9ecef',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('character_assistant.input_placeholder')}
            disabled={loading}
            rows={2}
            style={{
              flex: 1,
              background: '#f5f6fa',
              border: '1.5px solid #e9ecef',
              borderRadius: '12px',
              padding: '0.75rem',
              fontSize: '0.95rem',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() 
                ? '#ccc' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '0.75rem 1.25rem',
              color: '#fff',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              height: '44px',
            }}
          >
            <i className="bi bi-send-fill"></i>
          </button>
        </div>
        <small className="text-muted d-block mt-2" style={{ fontSize: '0.8rem' }}>
          {t('character_assistant.tip')}
        </small>
      </div>
    </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
