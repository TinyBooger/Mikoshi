import React from 'react';
import defaultPic from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

const getMessageActionButtonStyle = (disabled) => ({
  border: 'none',
  background: 'transparent',
  color: disabled ? '#d1d5db' : '#9ca3af',
  cursor: disabled ? 'not-allowed' : 'pointer',
  width: 26,
  height: 26,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: '0.82rem',
  transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
});

const handleMessageActionMouseEnter = (event, disabled) => {
  if (disabled) return;
  event.currentTarget.style.background = 'rgba(31, 41, 55, 0.08)';
  event.currentTarget.style.color = '#4b5563';
  event.currentTarget.style.transform = 'translateY(-1px)';
};

const handleMessageActionMouseLeave = (event, disabled) => {
  if (disabled) return;
  event.currentTarget.style.background = 'transparent';
  event.currentTarget.style.color = '#9ca3af';
  event.currentTarget.style.transform = 'none';
};

/**
 * Memoized message bubble.
 *
 * Uses React.memo so that only the actively-streaming (last) message
 * re-renders on every token chunk.  All earlier messages skip re-render
 * because their content / state hasn't changed.
 */
const MessageBubble = React.memo(function MessageBubble({
  message,
  index,
  isMobile,
  cleanMode,
  selectedCharacter,
  selectedPersona,
  userData,
  editingMessageId,
  editingMessageText,
  hoveredMessageId,
  forkNavMap,
  branchSelectionPending,
  sending,
  t,
  renderMessageContent,
  onHoverMessage,
  onOpenMessageMenu,
  onCancelEditing,
  onSaveEditedMessage,
  onResendMessage,
  onStartEditing,
  onSelectBranch,
  onEditTextChange,
}) {
  const m = message;
  const isCleanAssistant = cleanMode && m.role === 'assistant';
  const isCleanUser = cleanMode && m.role === 'user';
  const isClean = isCleanAssistant || isCleanUser;
  const isEditingUser = editingMessageId === m.message_id && m.role === 'user';
  const editorWidth = isMobile ? '100%' : 'min(70vw, 760px)';
  const bubbleWidth = isEditingUser ? editorWidth : 'auto';
  const bubbleMaxWidth = isEditingUser ? editorWidth : '100%';
  const cleanContentWidth = 'min(80%, 800px)';

  return (
    <div
      key={m.message_id || index}
      id={m.message_id ? `message-${m.message_id}` : undefined}
      style={{
        display: 'flex',
        marginBottom: cleanMode ? '2.75rem' : '1.5rem',
        justifyContent: isClean ? 'center' : (m.role === 'user' ? 'flex-end' : 'flex-start'),
      }}
    >
      {/* Main row: avatar + content column */}
      <div style={{
        display: 'flex',
        flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
        gap: '0.64rem',
        alignItems: 'flex-start',
        maxWidth: isEditingUser
          ? (isMobile ? '96%' : '92%')
          : isClean ? cleanContentWidth : '100%',
        width: isClean ? '100%' : undefined,
      }}
      onMouseEnter={() => onHoverMessage(m.message_id)}
      onMouseLeave={() => onHoverMessage(null)}
      >
        {/* Avatar */}
        {!cleanMode && (() => {
          const messageAvatarSize = isMobile ? 'clamp(40px, 12vw, 48px)' : 77;

          return (
        <img
          src={
            m.role === 'user'
              ? ((selectedPersona?.avatar_picture || selectedPersona?.picture)
                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${(selectedPersona.avatar_picture || selectedPersona.picture).replace(/^\//, '')}`
                  : userData?.profile_pic
                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${userData.profile_pic.replace(/^\//, '')}`
                  : defaultAvatar)
                : ((selectedCharacter?.avatar_picture || selectedCharacter?.picture)
                  ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`
                  : defaultPic)
          }
          alt={m.role === 'user' ? (selectedPersona?.name || t('chat.you')) : selectedCharacter?.name}
          style={{ width: messageAvatarSize, height: messageAvatarSize, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.6px solid #e9ecef', flexShrink: 0 }}
        />
          );
        })()}

        {/* Content column: name, bubble+button row, controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCleanAssistant ? 'center' : (m.role === 'user' ? 'flex-end' : 'flex-start'),
          minWidth: 0,
          flex: 1,
        }}>
          {/* Name header */}
          {!cleanMode && (
            <div style={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '0.76rem', opacity: 0.7, marginBottom: 6 }}>
              {m.role === 'user' ? t('chat.you') : selectedCharacter?.name}
              {m.is_pinned && (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#334155' }}>
                  <i className="bi bi-pin-angle-fill" style={{ marginRight: 4 }}></i>
                  {t('chat.pinned_memory') || 'Pinned'}
                </span>
              )}
            </div>
          )}

          {/* Bubble + 3dots button row */}
          <div style={{
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: '0.4rem',
            width: isClean ? '100%' : 'auto',
            justifyContent: isClean ? (m.role === 'user' ? 'flex-start' : 'center') : undefined,
          }}>
            {/* Bubble */}
            <div
              className={isCleanAssistant ? 'chat-bubble-clean' : undefined}
              style={{
                background: isCleanAssistant ? 'transparent' : '#f5f6fa',
                color: '#232323',
                borderRadius: isCleanAssistant ? 0 : '0.88rem',
                padding: isCleanAssistant ? 0 : '14px 18px',
                boxShadow: isCleanAssistant ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
                fontSize: '16px',
                lineHeight: isCleanAssistant ? 1.75 : 1.65,
                minWidth: 0,
                wordBreak: 'break-word',
                maxWidth: bubbleMaxWidth,
                width: bubbleWidth,
              }}
            >
              {editingMessageId === m.message_id && m.role === 'user' ? (
                <textarea
                  value={editingMessageText}
                  onChange={(event) => onEditTextChange(event.target.value)}
                  rows={4}
                  autoFocus
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    border: '1px solid #d1d5db',
                    padding: '0.7rem 0.8rem',
                    fontSize: '16px',
                    resize: 'vertical',
                    minHeight: 96,
                  }}
                />
              ) : m.role === 'assistant' && !(m.content && m.content.trim()) ? (
                <div className="ai-thinking">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>思考中...</span>
                </div>
              ) : (
                <div>{renderMessageContent(m.content, m.role)}</div>
              )}
            </div>

            {/* 3-dots button beside bubble with opacity transition */}
            {m?.message_id && (
              <button
                type="button"
                onClick={(event) => {
                  onOpenMessageMenu(event, m.message_id);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#6b7280',
                  cursor: 'pointer',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0,
                  opacity: hoveredMessageId === m.message_id ? 1 : 0,
                  transition: 'opacity 0.15s ease',
                  marginTop: 2,
                }}
                aria-label={t('chat.message_options') || 'Message options'}
                title={t('chat.message_options') || 'Message options'}
              >
                <i className="bi bi-three-dots"></i>
              </button>
            )}
          </div>

          {/* Below-bubble controls — only for user messages */}
          {m.role === 'user' && m?.message_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
              {/* Edit pencil button / Cancel + Save when editing */}
              {editingMessageId === m.message_id ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={onCancelEditing}
                    disabled={sending}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-dark"
                    onClick={onSaveEditedMessage}
                    disabled={sending || !editingMessageText.trim()}
                  >
                    发送
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onResendMessage(m)}
                    disabled={!!editingMessageId || sending}
                    onMouseEnter={(event) => handleMessageActionMouseEnter(event, !!editingMessageId || sending)}
                    onMouseLeave={(event) => handleMessageActionMouseLeave(event, !!editingMessageId || sending)}
                    style={{
                      ...getMessageActionButtonStyle(!!editingMessageId || sending),
                      opacity: hoveredMessageId === m.message_id ? 1 : 0,
                      transition: 'opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                    }}
                    title="Resend from this message"
                    aria-label="Resend from this message"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartEditing(m)}
                    disabled={!!editingMessageId || sending}
                    onMouseEnter={(event) => handleMessageActionMouseEnter(event, !!editingMessageId || sending)}
                    onMouseLeave={(event) => handleMessageActionMouseLeave(event, !!editingMessageId || sending)}
                    style={{
                      ...getMessageActionButtonStyle(!!editingMessageId || sending),
                      opacity: hoveredMessageId === m.message_id ? 1 : 0,
                      transition: 'opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                    }}
                    title={t('chat.edit_into_branch') || 'Edit into new branch'}
                    aria-label={t('chat.edit_into_branch') || 'Edit into new branch'}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                </>
              )}
              {/* Branch navigator — < X / Y > */}
              {(() => {
                const nav = forkNavMap.get(m.message_id);
                if (!nav) return null;
                const prevIdx = (nav.currentIdx - 1 + nav.options.length) % nav.options.length;
                const nextIdx = (nav.currentIdx + 1) % nav.options.length;
                const navBtnStyle = {
                  border: 'none',
                  background: 'transparent',
                  color: '#374151',
                  borderRadius: 6,
                  width: 24,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: branchSelectionPending || sending ? 'not-allowed' : 'pointer',
                  opacity: branchSelectionPending || sending ? 0.5 : 1,
                  fontSize: '0.9rem',
                  lineHeight: 1,
                };
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      style={navBtnStyle}
                      disabled={branchSelectionPending || sending}
                      onClick={() => onSelectBranch(nav.options[prevIdx].branch_id)}
                      title={nav.options[prevIdx]?.label || `Branch ${prevIdx + 1}`}
                    >‹</button>
                    <span style={{ fontSize: '0.74rem', color: '#6b7280', minWidth: 36, textAlign: 'center', userSelect: 'none' }}>
                      {nav.currentIdx + 1}&nbsp;/&nbsp;{nav.options.length}
                    </span>
                    <button
                      type="button"
                      style={navBtnStyle}
                      disabled={branchSelectionPending || sending}
                      onClick={() => onSelectBranch(nav.options[nextIdx].branch_id)}
                      title={nav.options[nextIdx]?.label || `Branch ${nextIdx + 1}`}
                    >›</button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
