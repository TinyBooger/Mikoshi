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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
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
        /* Prevent body scroll when modal is open */
        body.modal-open {
          overflow: hidden;
        }
      `}</style>
      
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
      
      {/* Modal */}
      <div
        className="character-assistant-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          ...(isMobile ? {
            // Mobile: bottom popup
            bottom: 0,
            left: 0,
            right: 0,
            width: '100vw',
            maxWidth: '100vw',
            maxHeight: '85vh',
            borderRadius: '24px 24px 0 0',
            animation: 'slideInBottom 0.3s ease-out',
            boxSizing: 'border-box',
            overflowX: 'hidden',
          } : {
            // Desktop: right-side modal
            top: 0,
            right: 0,
            width: '450px',
            maxWidth: '90vw',
            height: '100vh',
            borderRadius: 0,
            animation: 'slideInRight 0.3s ease-out',
          }),
          background: '#fff',
          boxShadow: isMobile ? '0 -4px 24px rgba(0,0,0,0.15)' : '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '1rem 1.25rem' : '1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: isMobile ? '24px 24px 0 0' : 0,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <i className="bi bi-magic" style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}></i>
            <div>
              <h3 className="fw-bold mb-0" style={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
                {t('character_assistant.title')}
              </h3>
              <small style={{ opacity: 0.9, fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
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
              flexShrink: 0,
              marginLeft: '0.5rem',
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
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isMobile ? '1rem' : '1.5rem',
            background: '#f8f9fa',
            minHeight: 0,
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
                      maxWidth: '85%',
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
          style={{
            padding: isMobile ? '1rem' : '1rem 1.5rem',
            borderTop: '1px solid #e9ecef',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
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
                flexShrink: 0,
              }}
              title={t('character_assistant.send')}
            >
              <i className="bi bi-send-fill"></i>
            </button>
          </div>
          <small className="text-muted d-block" style={{ fontSize: '0.8rem' }}>
            {t('character_assistant.tip')}
          </small>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
