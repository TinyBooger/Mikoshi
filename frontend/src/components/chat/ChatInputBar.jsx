import React, { useCallback, useEffect, useRef, useState } from 'react';
import ContextWindowIndicator from '../ContextWindowIndicator';
import { CreditLockedBanner, BanBanner } from '../ChatBanners';
import { isCreditLocked } from '../../utils/creditCheck';
import {
  CHAT_INPUT_BASE_HEIGHT,
  CHAT_INPUT_INLINE_ACTIONS_PADDING,
  CHAT_INPUT_INLINE_WAVE_GUTTER,
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

// Bars the recording waveform shows: the most recent samples, one per bar. The
// sheet sizes the slot from this count (`.chat-composer-wave` in ChatInputBar.css).
const WAVE_BAR_COUNT = 28;
// Rolling history sampled every 65ms; the wave renders its tail. Oversampling
// gives the strip a bit of scrollback so it moves rather than snapping.
const WAVE_SAMPLE_BUFFER = 80;
// Per-bar emphasis so the strip reads as a wave rather than a flat block of
// identical columns; indexed modulo the bar count.
const WAVE_BAR_SHAPES = [
  0.58, 0.82, 1, 0.72, 0.94, 0.68, 0.88, 0.62, 0.74, 0.92,
  0.66, 0.86, 0.7, 0.96, 0.6, 0.84, 0.98, 0.7, 0.9, 0.64,
  0.8, 0.76, 0.94, 0.66, 0.88, 0.72, 0.96, 0.62,
];

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

  const {
    isRecording,
    isTranscribing,
    recordingLevel,
    handleVoiceToggle,
    stopVoiceInput,
    closeVoiceConnection,
  } = useVoiceInput({ sessionToken, input, setInput, toast });
  // Trailing room the one-line layout reserves for the actions. While recording
  // the waveform joins them, so the reservation grows and the text wraps sooner;
  // the textarea is measured against this exact value.
  const inlinePaddingRight = isRecording
    ? `calc(${CHAT_INPUT_INLINE_ACTIONS_PADDING} + ${CHAT_INPUT_INLINE_WAVE_GUTTER})`
    : CHAT_INPUT_INLINE_ACTIONS_PADDING;
  const { handleInputChange, isMultiline } = useAutoResizeTextarea({
    textareaRef,
    input,
    setInput,
    inlinePaddingRight,
  });
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
  // Rolling history of level samples, one per sampling tick, rendered by the
  // waveform's last WAVE_BAR_COUNT entries.
  const [waveformSamples, setWaveformSamples] = useState(() => Array(WAVE_SAMPLE_BUFFER).fill(0.025));
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
      setWaveformSamples(Array(WAVE_SAMPLE_BUFFER).fill(0.025));
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
        <div
          style={{
            width: '100%',
            display: 'flex',
            gap: '0.64rem',
            alignItems: isMultiline ? 'flex-start' : 'center',
          }}
        >
          <ChatContextUsageIndicator
            chatState={chatState}
            advancedChatConfig={advancedChatConfig}
          />

          {/* One painted surface holds both layers: the field and its actions.
              A one-line field overlays the buttons on its right; once the text
              wraps, the buttons drop to a quiet tool row below it, inside the
              same border with no divider between the layers. */}
          <div
            className={`chat-composer${isMultiline ? ' chat-composer--multiline' : ''}`}
            style={{ flex: 1, minWidth: 0 }}
          >
            <textarea
              ref={textareaRef}
              className="chat-composer-input"
              style={{
                minHeight: `${CHAT_INPUT_BASE_HEIGHT}px`,
                maxHeight: `${CHAT_INPUT_MAX_HEIGHT}px`,
                paddingTop: '0.6rem',
                paddingBottom: isMultiline ? '0.35rem' : '0.6rem',
                paddingLeft: '0.96rem',
                paddingRight: isMultiline ? '0.96rem' : inlinePaddingRight,
              }}
              placeholder={'输入您的消息...'}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={creditLocked}
              rows={1}
            />
            <div className="chat-composer-toolbar">
              {isRecording && (
                <span className="chat-composer-wave" role="status" aria-label="正在录音">
                  {waveformSamples.slice(-WAVE_BAR_COUNT).map((sample, index) => (
                    <span
                      key={index}
                      style={{
                        transform: `scaleY(${Math.max(0.04, sample * WAVE_BAR_SHAPES[index % WAVE_BAR_SHAPES.length])})`,
                      }}
                    />
                  ))}
                </span>
              )}
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
