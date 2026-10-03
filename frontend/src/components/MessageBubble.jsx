import React from 'react';
import defaultPic from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

const getMessageActionButtonStyle = (disabled, palette) => ({
  border: 'none',
  background: 'transparent',
  color: disabled ? '#d1d5db' : palette.iconColor,
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

// A neutral mid-grey reads as a hover plate on both a light and a dark surface,
// so only the text colour has to come from the palette.
const ACTION_HOVER_BACKGROUND = 'rgba(127, 127, 127, 0.18)';

const handleMessageActionMouseEnter = (event, disabled, palette) => {
  if (disabled) return;
  event.currentTarget.style.background = ACTION_HOVER_BACKGROUND;
  event.currentTarget.style.color = palette.textColor;
  event.currentTarget.style.transform = 'translateY(-1px)';
};

const handleMessageActionMouseLeave = (event, disabled, palette) => {
  if (disabled) return;
  event.currentTarget.style.background = 'transparent';
  event.currentTarget.style.color = palette.iconColor;
  event.currentTarget.style.transform = 'none';
};

/**
 * Memoized message bubble.
 *
 * Uses React.memo so that only the actively-streaming (last) message
 * re-renders on every token chunk.  All earlier messages skip re-render
 * because their content / state hasn't changed.
 *
 * `palette` is the surface palette for the current chat background (see
 * `getSurfacePalette`). It is a module-level constant, so it never invalidates
 * that memo.
 */
const MessageBubble = React.memo(function MessageBubble({
  message,
  index,
  isMobile,
  cleanMode,
  palette,
  selectedCharacter,
  selectedPersona,
  userData,
  editingMessageId,
  editingMessageText,
  hoveredMessageId,
  forkNavMap,
  branchSelectionPending,
  sending,
  renderMessageContent,
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
  const m = message;
  const isCleanAssistant = cleanMode && m.role === 'assistant';
  const isCleanUser = cleanMode && m.role === 'user';
  const isClean = isCleanAssistant || isCleanUser;
  const isEditingUser = editingMessageId === m.message_id && m.role === 'user';
  const editorWidth = isMobile ? '100%' : 'min(70vw, 760px)';
  const bubbleWidth = isEditingUser ? editorWidth : 'auto';
  const bubbleMaxWidth = isEditingUser ? editorWidth : '100%';
  const cleanContentWidth = 'min(80%, 800px)';

  // A tinted bubble is any palette that is not the plain white default. Its
  // surface fixes live in `ChatBubble.css` — the shared markdown rules assume the
  // chat's neutral `#f5f6fa` panel, which a saturated user bubble or a
  // translucent reply over a dark gradient is not.
  const isTintedSurface = palette.id !== 'plain';
  const bubbleBackground = isCleanAssistant
    ? 'transparent'
    : (m.role === 'user' ? palette.bubbleUser : palette.bubbleChar);
  const bubbleTextColor = isCleanAssistant
    ? palette.textColor
    : (m.role === 'user' ? palette.bubbleUserText : palette.bubbleCharText);
  const bubbleClassName = [
    isCleanAssistant ? 'chat-bubble-clean' : null,
    isTintedSurface ? 'chat-bubble-tinted' : null,
  ].filter(Boolean).join(' ') || undefined;

  // Below-bubble actions (revealed on hover). Ordering:
  //   user messages: retry → pin → edit → copy
  //   bot messages : copy → pin
  const showEditingControls = m.role === 'user' && editingMessageId === m.message_id;
  const busyDisabled = !!editingMessageId || sending;
  const messageHasText = typeof m.content === 'string' && !!m.content.trim();
  const belowBubbleActions = (() => {
    if (m.role !== 'user' && m.role !== 'assistant') return [];
    const actions = [];
    if (m.role === 'user') {
      actions.push({
        key: 'retry',
        icon: 'bi bi-arrow-clockwise',
        label: '从这条消息重新生成',
        disabled: busyDisabled,
        onClick: () => onResendMessage(m),
      });
    }
    if (m.role === 'assistant') {
      actions.push({
        key: 'copy',
        icon: 'bi bi-copy',
        label: '复制',
        disabled: !messageHasText,
        onClick: () => onCopyMessage(m),
      });
    }
    actions.push({
      key: 'pin',
      icon: m.is_pinned ? 'bi bi-pin-angle-fill' : 'bi bi-pin-angle',
      label: m.is_pinned ? '取消固定' : '固定为记忆',
      disabled: false,
      onClick: () => onTogglePin(m.message_id, !m.is_pinned),
    });
    if (m.role === 'user') {
      actions.push({
        key: 'edit',
        icon: 'bi bi-pencil',
        label: '编辑并新建分支',
        disabled: busyDisabled,
        onClick: () => onStartEditing(m),
      });
      actions.push({
        key: 'copy',
        icon: 'bi bi-copy',
        label: '复制',
        disabled: false,
        onClick: () => onCopyMessage(m),
      });
    }
    return actions;
  })();

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
        // A definite width is what lets the bubble below cap itself: with a
        // shrink-to-fit row, the bubble's `maxWidth: '100%'` resolves against a
        // content-sized parent and is ignored for intrinsic sizing, so a wide
        // code block / display equation / table pushes the whole thread past
        // the viewport. Filling the row makes the percentage mean something.
        width: '100%',
        // Primary on-surface text. The name header has no colour of its own, so
        // it inherits this and keeps its existing `opacity: 0.7`; on the dark
        // gradient it would otherwise stay near-black and vanish.
        color: palette.textColor,
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
          alt={m.role === 'user' ? (selectedPersona?.name || '你') : selectedCharacter?.name}
          style={{ width: messageAvatarSize, height: messageAvatarSize, objectFit: 'cover', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1.6px solid ${palette.dividerColor}`, flexShrink: 0 }}
        />
          );
        })()}

        {/* Content column: name, bubble, below-bubble controls */}
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
              {m.role === 'user' ? '你' : selectedCharacter?.name}
              {m.is_pinned && (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: palette.accent }}>
                  <i className="bi bi-pin-angle-fill" style={{ marginRight: 4 }}></i>
                  已固定
                </span>
              )}
            </div>
          )}

          {/* Bubble row */}
          <div style={{
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: '0.4rem',
            // Full width (see the main row above): the bubble is a flex item
            // here, so a definite row lets flex-shrink + `minWidth: 0` bring
            // wide content down to the available width, where `pre` /
            // `.katex-display` can scroll it.
            width: '100%',
            justifyContent: isClean ? (m.role === 'user' ? 'flex-start' : 'center') : undefined,
          }}>
            {/* Bubble */}
            <div
              className={bubbleClassName}
              style={{
                background: bubbleBackground,
                // Clean mode has no bubble behind the reply, so its text sits
                // straight on the surface and has to take the surface colour.
                color: bubbleTextColor,
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
          </div>

          {/* Below-bubble action row — user: retry · pin · edit · copy / bot: copy · pin */}
          {m?.message_id && (m.role === 'user' || m.role === 'assistant') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: cleanMode && m.role === 'assistant' ? 'center' : (m.role === 'user' ? 'flex-end' : 'flex-start'), width: '100%' }}>
              {/* Editing a user message: replace action buttons with Cancel / Send */}
              {showEditingControls ? (
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
                belowBubbleActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    onMouseEnter={(event) => handleMessageActionMouseEnter(event, action.disabled, palette)}
                    onMouseLeave={(event) => handleMessageActionMouseLeave(event, action.disabled, palette)}
                    style={{
                      ...getMessageActionButtonStyle(action.disabled, palette),
                      opacity: hoveredMessageId === m.message_id ? 1 : 0,
                      transition: 'opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                    }}
                    title={action.label}
                    aria-label={action.label}
                  >
                    <i className={action.icon}></i>
                  </button>
                ))
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
                  // Stronger than the counter beside it, mirroring the action
                  // buttons: idle controls are muted, emphasis is the surface's
                  // own text colour rather than a fixed grey that only works on
                  // the plain white background.
                  color: palette.textColor,
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
                    <span style={{ fontSize: '0.74rem', color: palette.mutedColor, minWidth: 36, textAlign: 'center', userSelect: 'none' }}>
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
