import React from 'react';
import ContextWindowIndicator from '../ContextWindowIndicator';
import { CreditLockedBanner, BanBanner } from '../ChatBanners';
import { isCreditLocked } from '../../utils/creditCheck';
import { CHAT_INPUT_BASE_HEIGHT, CHAT_INPUT_MAX_HEIGHT } from '../../utils/chatPageConstants';
import { getChromeSurface } from '../../utils/backgroundPresets';
import ChatVoiceButton from './ChatVoiceButton';
import ChatSendButton from './ChatSendButton';

/**
 * Bottom composer area of the chat: ban / credit-lock banners, the context
 * window indicator, the auto-resizing textarea with the voice + send buttons
 * overlaid on it, and the AI disclaimer line.
 *
 * Extracted verbatim from ChatPage. `isCreditLocked(creditLimits)` is a pure
 * helper and used to be called four times per render (banner, textarea, voice
 * button, send button); it is hoisted to a single call here — identical output.
 */
export default function ChatInputBar({
  handleSend,
  selectedWallpaper,
  isMobile,
  chatContentRailStyle,
  userData,
  creditLimits,
  contextWindowUsage,
  serverContextWindowUsage,
  contextUsagePercent,
  pieRadius,
  pieCircumference,
  pieStrokeOffset,
  input,
  handleInputChange,
  handleKeyDown,
  textareaRef,
  isRecording,
  isTranscribing,
  handleVoiceToggle,
  isStreaming,
  sending,
  onAbort,
}) {
  const creditLocked = isCreditLocked(creditLimits);
  const chromeSurface = getChromeSurface(selectedWallpaper?.kind);

  return (
    /* Input Area (no form) */
    <form
      onSubmit={handleSend}
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
        {userData?.ban_type === 'full_ban' && (
          <BanBanner userData={userData} />
        )}
        {creditLocked && (
          <CreditLockedBanner creditLimits={creditLimits} />
        )}
        <div style={{ width: '100%', display: 'flex', gap: '0.64rem', alignItems: 'center' }}>
          <ContextWindowIndicator
            contextWindowUsage={contextWindowUsage}
            serverContextWindowUsage={serverContextWindowUsage}
            contextUsagePercent={contextUsagePercent}
            pieRadius={pieRadius}
            pieCircumference={pieCircumference}
            pieStrokeOffset={pieStrokeOffset}
            inputHeight={CHAT_INPUT_BASE_HEIGHT}
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
}
