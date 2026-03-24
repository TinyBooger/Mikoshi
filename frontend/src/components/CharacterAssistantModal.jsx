import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AuthContext } from './AuthProvider';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastProvider';
import { formatCompactTokenCount, getTokenQuotaLabel } from '../utils/tokenDisplay';

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
  const { sessionToken, refreshUserData } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenLimits, setTokenLimits] = useState(null);
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

  useEffect(() => {
    if (!sessionToken) return;

    const fetchTokenLimits = async () => {
      try {
        const response = await fetch(`${window.API_BASE_URL}/api/token-limits`, {
          headers: { 'Authorization': sessionToken },
        });
        if (!response.ok) return;
        const data = await response.json();
        setTokenLimits(data);
      } catch {
        // Non-blocking fetch for UI hints.
      }
    };

    fetchTokenLimits();
  }, [sessionToken]);

  // Prevent body scroll on mobile when modal is open
  useEffect(() => {
    const shouldLock = window.innerWidth <= 768;
    if (!shouldLock) return;

    const scrollY = window.scrollY;
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
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
  }, [messages]);

  const formatTokenCapError = (payload) => {
    const tokenPayload = payload?.error === 'TOKEN_CAP_REACHED'
      ? payload
      : (payload?.detail?.error === 'TOKEN_CAP_REACHED' ? payload.detail : null);

    if (!tokenPayload) return null;

    const limits = tokenPayload?.token_limits || {};
    const scopeLabel = getTokenQuotaLabel(limits?.cap_scope);
    const cap = Number(limits?.token_cap || 0);
    const remaining = Number(limits?.remaining_tokens || 0);

    if (cap > 0) {
      return `${tokenPayload.message || '已达到 token 上限。'} (${scopeLabel}: 剩余 ${formatCompactTokenCount(remaining)} / ${formatCompactTokenCount(cap)})`;
    }

    return tokenPayload.message || '已达到 token 上限。';
  };

  const handleSend = async () => {
    if (tokenLimits?.cap_reached) {
      toast.show('已达到 token 上限，暂时无法继续生成内容。', { type: 'warning' });
      return;
    }

    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    setLoading(true);
    let shouldRefreshUsage = false;
    try {
      const effectiveCurrentData = generatedData
        ? {
            name: generatedData.name || '',
            persona: generatedData.persona || '',
            tagline: generatedData.tagline || '',
            greeting: generatedData.greeting || '',
            sample_dialogue: generatedData.sample_dialogue || '',
            long_description: generatedData.long_description || '',
            context_label: currentCharData?.context_label || 'standard',
          }
        : {
            name: currentCharData?.name || '',
            persona: currentCharData?.persona || '',
            tagline: currentCharData?.tagline || '',
            greeting: currentCharData?.greeting || '',
            sample_dialogue: currentCharData?.sample || '',
            long_description: currentCharData?.long_description || '',
            context_label: currentCharData?.context_label || 'standard',
          };

      const response = await fetch(`${window.API_BASE_URL}/api/character-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          prompt: userMessage,
          current_character: effectiveCurrentData,
        })
      });

      shouldRefreshUsage = true;
      const data = await response.json();

      if (response.ok) {
        setGeneratedData(data);

        const isAdvancedCharacter = effectiveCurrentData.context_label === 'advanced';
        const longDescriptionSection = isAdvancedCharacter
          ? `\n\n**${t('character_form.long_description', '详细人物设定')}:**\n${data.long_description || ''}`
          : '';

        const assistantMessage = `${t('character_assistant.generated_prefix')}\n\n**${t('character_form.name')}:** ${data.name}\n\n**${t('character_form.tagline')}:** ${data.tagline}\n\n**${t('character_form.persona')}:** ${data.persona}\n\n**${t('character_form.greeting')}:** ${data.greeting}\n\n**${t('character_form.sample_dialogue')}:**\n${data.sample_dialogue}${longDescriptionSection}`;

        setMessages([...newMessages, {
          role: 'assistant',
          content: assistantMessage,
          data,
        }]);

        onApply(data);
        toast.show(t('character_assistant.applied_success'));
      } else {
        const tokenCapMessage = formatTokenCapError(data);
        if (data?.token_limits) {
          setTokenLimits(data.token_limits);
        } else if (data?.detail?.token_limits) {
          setTokenLimits(data.detail.token_limits);
        }

        const errorMsg = tokenCapMessage || data.detail || t('character_assistant.error');
        setMessages([...newMessages, {
          role: 'assistant',
          content: `❌ ${errorMsg}`
        }]);
        toast.show(errorMsg, { type: 'error' });
      }
    } catch {
      const errorMsg = t('character_assistant.error');
      setMessages([...newMessages, {
        role: 'assistant',
        content: `❌ ${errorMsg}`
      }]);
      toast.show(errorMsg, { type: 'error' });
    } finally {
      if (shouldRefreshUsage && refreshUserData) {
        refreshUserData({ silent: true });
      }
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
          {tokenLimits?.is_limited && (
            <div
              style={{
                marginBottom: '0.5rem',
                borderRadius: 10,
                padding: '0.45rem 0.65rem',
                border: tokenLimits?.cap_reached ? '1px solid #fecaca' : '1px solid #fde68a',
                background: tokenLimits?.cap_reached ? '#fff1f2' : '#fffbeb',
                color: tokenLimits?.cap_reached ? '#b91c1c' : '#92400e',
                fontSize: '0.74rem',
                fontWeight: 600,
              }}
            >
              {(() => {
                const scopeLabel = getTokenQuotaLabel(tokenLimits?.cap_scope);
                const used = Number(tokenLimits?.cap_scope === 'monthly' ? tokenLimits?.monthly_token_usage : tokenLimits?.daily_token_usage) || 0;
                const cap = Number(tokenLimits?.token_cap || 0);
                const remaining = Number(tokenLimits?.remaining_tokens || 0);

                if (tokenLimits?.cap_reached) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span>{scopeLabel}已达上限：{formatCompactTokenCount(used)} / {formatCompactTokenCount(cap)}。</span>
                      {!tokenLimits?.is_pro && (
                        <button
                          type="button"
                          onClick={() => navigate('/pro-upgrade')}
                          style={{
                            flexShrink: 0,
                            padding: '0.15rem 0.55rem',
                            borderRadius: 6,
                            border: 'none',
                            background: '#b91c1c',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          升级 Pro
                        </button>
                      )}
                    </div>
                  );
                }
                return `${scopeLabel}：${formatCompactTokenCount(used)} / ${formatCompactTokenCount(cap)}，剩余 ${formatCompactTokenCount(remaining)}`;
              })()}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('character_assistant.input_placeholder')}
              disabled={loading || !!tokenLimits?.cap_reached}
              rows={2}
              style={{
                flex: 1,
                background: '#f5f6fa',
                border: '1.5px solid #e9ecef',
                borderRadius: '12px',
                padding: '0.75rem',
                fontSize: '16px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || !!tokenLimits?.cap_reached}
              style={{
                background: loading || !input.trim() || tokenLimits?.cap_reached
                  ? '#ccc' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                color: '#fff',
                cursor: loading || !input.trim() || tokenLimits?.cap_reached ? 'not-allowed' : 'pointer',
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
          <small className="d-block" style={{ fontSize: '0.8rem', color: '#b45309', marginTop: 4 }}>
            {t('character_assistant.token_notice', '使用AI助手会消耗token')}
          </small>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
