import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContextWindowIndicator from '../ContextWindowIndicator';
import { CreditLockedBanner, BanBanner } from '../ChatBanners';
import { isCreditLocked } from '../../utils/creditCheck';
import {
  CHAT_INPUT_BASE_HEIGHT,
  CHAT_INPUT_MAX_HEIGHT,
} from '../../utils/chatPageConstants';
import { getChromeSurface } from '../../utils/backgroundPresets';
import ChatVoiceButton from './ChatVoiceButton';
import ChatSendButton from './ChatSendButton';
import { useAutoResizeTextarea } from '../../hooks/useAutoResizeTextarea';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useChatRuntimeValue } from '../../hooks/useChatRuntimeState';
import { useContextWindowUsage } from '../../hooks/useContextWindowUsage';
import { loadChatDraft, saveChatDraft } from '../../utils/chatDraftStorage';
import './ChatInputBar.css';

function ChatContextUsageIndicator({ chatState, advancedChatConfig }) {
  const messages = useChatRuntimeValue(chatState, 'contextUsageMessages');
  const serverContextWindowUsage = useChatRuntimeValue(chatState, 'serverContextWindowUsage');
  const {
    contextWindowUsage,
    contextUsagePercent,
    pieRadius,
    pieCircumference,
    pieStrokeOffset,
  } = useContextWindowUsage({ messages, advancedChatConfig, serverContextWindowUsage });

  return (
    <ContextWindowIndicator
      contextWindowUsage={contextWindowUsage}
      serverContextWindowUsage={serverContextWindowUsage}
      contextUsagePercent={contextUsagePercent}
      pieRadius={pieRadius}
      pieCircumference={pieCircumference}
      pieStrokeOffset={pieStrokeOffset}
      inputHeight={CHAT_INPUT_BASE_HEIGHT}
    />
  );
}

/**
 * Bottom composer area of the chat: ban / credit-lock banners, the context
 * window indicator, the auto-resizing textarea with the voice + send buttons
 * overlaid on it, and the AI disclaimer line.
 *
 * `ChatPage` only supplies the current chat context and send action; draft
 * editing stays local so keystrokes do not render the page or message list.
 * `isCreditLocked(creditLimits)` is a pure
 * helper and used to be called four times per render (banner, textarea, voice
 * button, send button); it is hoisted to a single call here — identical output.
 */
const ChatInputBar = React.memo(function ChatInputBar({
  onSend,
  selectedWallpaper,
  isMobile,
  chatContentRailStyle,
  userBanType,
  userBanUntil,
  creditLimits,
  chatState,
  advancedChatConfig,
  sessionToken,
  toast,
  draftStorageKey,
  draftFallbackKey,
  inputRef,
  inputSetterRef,
  onAbort,
}) {
  const { isStreaming, sending } = useChatRuntimeValue(chatState, 'sendStatus');
  const [input, setInputState] = useState('');
  const localInputRef = useRef(input);
  const activeDraftKeyRef = useRef(null);
  const textareaRef = useRef(null);
  const setInput = useCallback((nextInput) => {
    const nextValue = typeof nextInput === 'function' ? nextInput(localInputRef.current) : nextInput;
    const value = typeof nextValue === 'string' ? nextValue : '';
    localInputRef.current = value;
    inputRef.current = value;
    setInputState(value);
  }, [inputRef]);
  localInputRef.current = input;

  const { handleInputChange } = useAutoResizeTextarea({ textareaRef, input, setInput });
  const {
    isRecording,
    isTranscribing,
    recordingLevel,
    handleVoiceToggle,
    stopVoiceInput,
    closeVoiceConnection,
  } = useVoiceInput({ sessionToken, input, setInput, toast });
  const creditLocked = isCreditLocked(creditLimits);
  // Dev-only UI preview: append ?preview=credit-locked (or -pro-broke) to the chat URL.
  const previewCreditLock = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('preview') || ''
    : '';
  const previewLimits = previewCreditLock === 'credit-locked-pro-broke'
    ? {
        cap_reached: true,
        broke: true,
        is_pro: true,
        cap_scope: 'monthly',
        credit_cap: 10000,
        used_credits: 10000,
        monthly_credit_usage: 10000,
        remaining_credits: 0,
        purchased_credit_balance: 0,
      }
    : previewCreditLock === 'credit-locked'
      ? {
          cap_reached: true,
          broke: false,
          is_pro: false,
          cap_scope: 'daily',
          credit_cap: 10,
          used_credits: 10,
          daily_credit_usage: 10,
          remaining_credits: 0,
          purchased_credit_balance: 0,
        }
      : null;
  const chromeSurface = getChromeSurface(selectedWallpaper?.kind);
  const [waveformSamples, setWaveformSamples] = useState(() => Array(40).fill(0.025));
  const recordingLevelRef = useRef(recordingLevel);

  useEffect(() => {
    recordingLevelRef.current = recordingLevel;
  }, [recordingLevel]);

  useEffect(() => {
    if (!draftStorageKey) return;

    if (activeDraftKeyRef.current !== draftStorageKey) {
      activeDraftKeyRef.current = draftStorageKey;
      setInput(loadChatDraft(draftStorageKey, draftFallbackKey));
      return;
    }

    saveChatDraft(draftStorageKey, input);
  }, [draftStorageKey, draftFallbackKey, input, setInput]);

  useEffect(() => {
    inputSetterRef.current = setInput;
    return () => {
      if (inputSetterRef.current === setInput) {
        inputSetterRef.current = null;
      }
      closeVoiceConnection();
    };
  }, [closeVoiceConnection, inputSetterRef, setInput]);

  useEffect(() => {
    if (!isRecording) {
      setWaveformSamples(Array(40).fill(0.025));
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const level = Math.max(0.025, Math.min(1, recordingLevelRef.current));
      setWaveformSamples((samples) => [...samples.slice(1), level]);
    }, 65);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await stopVoiceInput();
    await onSend(event);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isMobile && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    /* Input Area (no form) */
    <form
      onSubmit={handleSubmit}
      style={{
        paddingTop: '0.8rem',
        paddingLeft: '1.2rem',
        paddingRight: '1.2rem',
        paddingBottom: isMobile
          ? 'calc(0.8rem + env(safe-area-inset-bottom, 0px))'
          : '0.8rem',
        ...chromeSurface,
        flexShrink: 0
      }}
    >
      <div style={chatContentRailStyle}>
        {userBanType === 'full_ban' && (
          <BanBanner banUntil={userBanUntil} />
        )}
        {(creditLocked || previewLimits) && (
          <CreditLockedBanner creditLimits={previewLimits || creditLimits} />
        )}
        {isRecording && (
          <div className="chat-voice-recording-status" role="status" aria-label="正在录音">
            <span className="chat-voice-recording-wave" aria-hidden="true">
              {waveformSamples.map((sample, index) => (
                <span
                  key={index}
                  style={{
                    transform: `scaleY(${Math.max(0.04, sample * [0.58, 0.82, 1, 0.72, 0.94, 0.68, 0.88, 0.62][index % 8])})`,
                  }}
                />
              ))}
            </span>
          </div>
        )}
        <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'center' }}>
          <ChatContextUsageIndicator
            chatState={chatState}
            advancedChatConfig={advancedChatConfig}
          />

          <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <textarea
              ref={textareaRef}
              style={{
                flex: 1,
                width: '100%',
                borderRadius: `${CHAT_INPUT_BASE_HEIGHT / 2}px`,
                border: '1.2px solid #e9ecef',
                background: '#fff',
                padding: '0.6rem 0.96rem',
                paddingRight: '5.7rem',
                fontSize: '16px',
                outline: 'none',
                color: '#232323',
                boxShadow: 'none',
                transition: 'border 0.14s',
                resize: 'none',
                minHeight: `${CHAT_INPUT_BASE_HEIGHT}px`,
                maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
                overflowY: 'hidden',
                fontFamily: 'inherit',
                lineHeight: '1.55',
                boxSizing: 'border-box',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
              placeholder={'输入您的消息...'}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={creditLocked}
              onFocus={e => {
                e.target.style.border = '1.2px solid #18191a';
              }}
              onBlur={e => e.target.style.border = '1.2px solid #e9ecef'}
              rows={1}
            />
            <ChatVoiceButton
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              disabled={isTranscribing || creditLocked}
              onClick={handleVoiceToggle}
            />
            <ChatSendButton
              isStreaming={isStreaming}
              sending={sending}
              disabled={sending || creditLocked}
              onAbort={onAbort}
            />
          </div>
        </div>
        <div
          style={{
            width: '100%',
            marginTop: '0.35rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            color: '#9aa0a6',
          }}
        >
          内容由AI生成，仅供参考，不构成专业建议。
        </div>
      </div>
    </form>
  );
});

export default ChatInputBar;
