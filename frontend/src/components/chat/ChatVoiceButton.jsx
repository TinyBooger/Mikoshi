import React from 'react';
import { CHAT_INPUT_BASE_HEIGHT } from '../../utils/chatPageConstants';

/**
 * Microphone button overlaid on the chat textarea. Turns into a spinner while
 * the recorded clip is being transcribed. Extracted verbatim from ChatPage.
 */
export default function ChatVoiceButton({ isRecording, isTranscribing, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'absolute',
        right: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2 + 38 + 6}px`,
        bottom: `${(CHAT_INPUT_BASE_HEIGHT - 38) / 2}px`,
        background: isRecording
          ? 'linear-gradient(180deg, #ffe3e3 0%, #ffd0d0 100%)'
          : 'linear-gradient(180deg, rgba(243, 238, 249, 0.95) 0%, rgba(235, 229, 241, 0.9) 100%)',
        color: isRecording ? '#c0392b' : '#5f567f',
        border: '1px solid rgba(255, 255, 255, 0.78)',
        borderRadius: '50%',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        boxShadow: isRecording
          ? '0 8px 16px rgba(220, 53, 69, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)'
          : '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease',
        cursor: isTranscribing ? 'wait' : 'pointer',
        outline: 'none',
        flexShrink: 0,
      }}
      title={isRecording ? '点击结束并识别' : '语音输入'}
    >
      {isTranscribing ? (
        <span className="spinner-border spinner-border-sm" style={{ color: '#6d638e' }}></span>
      ) : (
        <i className={`bi ${isRecording ? 'bi-stop-fill' : 'bi-mic-fill'}`}></i>
      )}
    </button>
  );
}
