import React from 'react';
import MessageBubble from '../MessageBubble';
import ChatWelcomeCard from '../ChatWelcomeCard';
import MessageTimestampDivider from './MessageTimestampDivider';
import { getChromeSurface, isVeiledBackground, getSurfacePalette } from '../../utils/backgroundPresets';
import { buildTranscriptDividers } from '../../utils/chatTimestamps';

/**
 * Scrollable messages area of the chat: context-window-compaction notice,
 * the welcome card for new chats, and the list of rendered message bubbles.
 *
 * Extracted verbatim from ChatPage (JSX + the small render-scoped IIFE that
 * computed `nonSystem`/`showWelcome`). `showWelcome` is now computed by the
 * parent during its own render pass — same value, same commit.
 */
export default function ChatMessagesList({
  chatContentRailStyle,
  selectedWallpaper,
  messages,
  showWelcome,
  serverContextWindowUsage,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  userData,
  isMobile,
  cleanMode,
  timestampGapSeconds,
  editingMessageId,
  editingMessageText,
  hoveredMessageId,
  forkNavMap,
  branchSelectionPending,
  sending,
  renderMessageContent,
  messagesEndRef,
  onHoverMessage,
  onTogglePin,
  onCopyMessage,
  onCancelEditing,
  onSaveEditedMessage,
  onResendMessage,
  onStartEditing,
  onSelectBranch,
  onEditTextChange,
}) {
  const nonSystem = messages.filter(m => m.role !== 'system');
  const chromeSurface = getChromeSurface(selectedWallpaper?.kind);
  // Colours for everything painted on this background: the bubbles' fills and
  // text, the name header, the message controls. `getSurfacePalette` returns a
  // module-level constant, so passing it down does not defeat `MessageBubble`'s
  // memo during streaming.
  const palette = getSurfacePalette(selectedWallpaper);
  // Time breaks for the rendered transcript: the pause threshold comes from the
  // server (`timestamp_gap_seconds`) so it cannot drift from the gap the prompt's
  // time marker uses; see `chatTimestamps.js`.
  const dividers = buildTranscriptDividers(nonSystem, timestampGapSeconds);

  return (
    /* Messages Area */
    <div
      style={{
        flex: 1,
        padding: '1.2rem',
        overflowY: 'auto',
        ...chromeSurface,
        backdropFilter: isVeiledBackground(selectedWallpaper?.kind) ? 'blur(1.5px)' : 'none',
        minHeight: 0,
      }}
    >
      <div style={chatContentRailStyle}>
        {Number(serverContextWindowUsage?.summary_messages_count || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.9rem' }}>
            <div
              style={{
                maxWidth: 760,
                width: '100%',
                textAlign: 'center',
                fontSize: '0.78rem',
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                padding: '0.45rem 0.7rem',
              }}
            >
              为控制上下文窗口已压缩。
            </div>
          </div>
        )}

        {showWelcome && (
          <ChatWelcomeCard
            selectedCharacter={selectedCharacter}
            selectedScene={selectedScene}
            palette={palette}
          />
        )}

        {nonSystem.length === 0 ? (
          <div
            className="text-center"
            style={{
              marginTop: '3.2rem',
              fontSize: '0.88rem',
              color: palette.mutedColor,
            }}
          >
            暂无消息，快来开始对话吧！
          </div>
        ) : (
          nonSystem.map((m, i) => (
            <React.Fragment key={m.message_id || i}>
              {dividers.has(i) && (
                <MessageTimestampDivider label={dividers.get(i)} palette={palette} />
              )}
              <MessageBubble
                message={m}
                index={i}
                isMobile={isMobile}
                cleanMode={cleanMode}
                palette={palette}
                selectedCharacter={selectedCharacter}
                selectedPersona={selectedPersona}
                userData={userData}
                editingMessageId={editingMessageId}
                editingMessageText={editingMessageText}
                hoveredMessageId={hoveredMessageId}
                forkNavMap={forkNavMap}
                branchSelectionPending={branchSelectionPending}
                sending={sending}
                renderMessageContent={renderMessageContent}
                onHoverMessage={onHoverMessage}
                onTogglePin={onTogglePin}
                onCopyMessage={onCopyMessage}
                onCancelEditing={onCancelEditing}
                onSaveEditedMessage={onSaveEditedMessage}
                onResendMessage={onResendMessage}
                onStartEditing={onStartEditing}
                onSelectBranch={onSelectBranch}
                onEditTextChange={onEditTextChange}
              />
            </React.Fragment>
          ))
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
