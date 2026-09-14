import React from 'react';
import MessageBubble from '../MessageBubble';
import ChatWelcomeCard from '../ChatWelcomeCard';

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

  return (
    /* Messages Area */
    <div
      style={{
        flex: 1,
        padding: '1.2rem',
        overflowY: 'auto',
        background: selectedWallpaper?.url ? 'rgba(255, 255, 255, 0.76)' : '#fff',
        backdropFilter: selectedWallpaper?.url ? 'blur(1.5px)' : 'none',
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
          />
        )}

        {nonSystem.length === 0 ? (
          <div className="text-muted text-center" style={{ marginTop: '3.2rem', fontSize: '0.88rem' }}>暂无消息，快来开始对话吧！</div>
        ) : (
          nonSystem.map((m, i) => (
            <MessageBubble
              key={m.message_id || i}
              message={m}
              index={i}
              isMobile={isMobile}
              cleanMode={cleanMode}
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
          ))
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
