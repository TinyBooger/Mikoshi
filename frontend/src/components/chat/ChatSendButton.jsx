import React from 'react';
import { CHAT_INPUT_BASE_HEIGHT } from '../../utils/chatPageConstants';

/**
 * Dual-state action button overlaid on the chat textarea:
 * a red "stop generating" button while a turn is streaming, otherwise the
 * purple submit button. Extracted verbatim from ChatPage — the two branches
 * are mutually exclusive, so they are returned early rather than nested in a
 * ternary; the rendered element is identical either way.
 */
export default function ChatSendButton({ isStreaming, sending, disabled, onAbort }) {
  if (isStreaming) {
    return (
      <button
        type="button"
        onClick={onAbort}
        style={{
          position: 'absolute',
          right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
          bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
          background: '#dc3545',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)',
          transition: 'background 0.14s',
          cursor: 'pointer',
          outline: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#c82333'}
        onMouseLeave={e => e.currentTarget.style.background = '#dc3545'}
        title={'停止生成'}
      >
        <i className="bi bi-stop-fill"></i>
      </button>
    );
  }

  return (
    <button
      type="submit"
      style={{
        position: 'absolute',
        right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
        bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
        background: sending
          ? 'rgba(222, 215, 236, 0.82)'
          : 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)',
        color: sending ? '#958faa' : '#5f567f',
        border: '1px solid rgba(255, 255, 255, 0.78)',
        borderRadius: '50%',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        boxShadow: sending
          ? '0 4px 10px rgba(141, 125, 176, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.65)'
          : '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
        cursor: sending ? 'not-allowed' : 'pointer',
        outline: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!sending) {
          e.currentTarget.style.background = 'linear-gradient(180deg, rgba(246, 241, 251, 0.98) 0%, rgba(239, 233, 246, 0.92) 100%)';
          e.currentTarget.style.color = '#554d73';
          e.currentTarget.style.boxShadow = '0 10px 18px rgba(141, 125, 176, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.88)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        if (!sending) {
          e.currentTarget.style.background = 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)';
          e.currentTarget.style.color = '#5f567f';
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
      title={'按 Enter 发送，Shift+Enter 换行。'}
      disabled={disabled}
    >
      {sending ? (
        <span className="spinner-border spinner-border-sm" style={{ color: '#6d638e' }}></span>
      ) : (
        <i className="bi bi-send-fill"></i>
      )}
    </button>
  );
}
