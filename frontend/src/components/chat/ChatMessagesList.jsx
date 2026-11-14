import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from '../MessageBubble';
import ChatWelcomeCard from '../ChatWelcomeCard';
import MessageTimestampDivider from './MessageTimestampDivider';
import { getChromeSurface, isVeiledBackground, getSurfacePalette } from '../../utils/backgroundPresets';
import { buildTranscriptDividers } from '../../utils/chatTimestamps';
import { useChatRuntimeValue } from '../../hooks/useChatRuntimeState';

const INITIAL_VISIBLE_MESSAGES = 80;
const MAX_VISIBLE_MESSAGES = 160;
const LOAD_MESSAGE_BATCH = 80;

/**
 * Scrollable messages area of the chat: the welcome card for new chats and the
 * list of rendered message bubbles.
 *
 * Extracted verbatim from ChatPage (JSX + the small render-scoped IIFE that
 * computed `nonSystem`/`showWelcome`). `showWelcome` is now computed by the
 * parent during its own render pass — same value, same commit.
 */
const ChatMessagesList = React.memo(function ChatMessagesList({
  chatContentRailStyle,
  selectedWallpaper,
  chatState,
  showWelcome,
  selectedCharacter,
  selectedScene,
  selectedPersona,
  userProfilePicture,
  isMobile,
  cleanMode,
  timestampGapSeconds,
  editingMessageId,
  editingMessageTextRef,
  editingMessageTextSetterRef,
  forkNavMap,
  branchSelectionPending,
  renderMessageContent,
  messagesEndRef,
  revealMessageRef,
  onTogglePin,
  onCopyMessage,
  selectionMode,
  selectedMessageIds,
  onStartMultiSelect,
  onToggleSelection,
  onCancelEditing,
  onSaveEditedMessage,
  onResendMessage,
  onStartEditing,
  onSelectBranch,
}) {
  const messages = useChatRuntimeValue(chatState, 'messageList');
  const { sending } = useChatRuntimeValue(chatState, 'sendStatus');
  const serverContextWindowUsage = useChatRuntimeValue(chatState, 'serverContextWindowUsage');
  const nonSystem = useMemo(() => messages.filter((message) => message.role !== 'system'), [messages]);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: Math.max(0, nonSystem.length - INITIAL_VISIBLE_MESSAGES),
    end: nonSystem.length,
  }));
  const messagesContainerRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const pendingScrollAnchorRef = useRef(null);
  const pendingJumpMessageIdRef = useRef(null);
  const pendingBottomScrollRef = useRef(false);
  const previousMessageCountRef = useRef(nonSystem.length);
  const firstVisibleIndex = Math.min(visibleRange.start, nonSystem.length);
  const lastVisibleIndex = Math.min(Math.max(visibleRange.end, firstVisibleIndex), nonSystem.length);
  const visibleMessages = nonSystem.slice(firstVisibleIndex, lastVisibleIndex);
  const chromeSurface = getChromeSurface(selectedWallpaper?.kind);
  // Colours for everything painted on this background: the bubbles' fills and
  // text, the name header, the message controls. `getSurfacePalette` returns a
  // module-level constant, so passing it down does not defeat `MessageBubble`'s
  // memo during streaming.
  const palette = getSurfacePalette(selectedWallpaper);
  // Time breaks for the rendered transcript: the pause threshold comes from the
  // server (`timestamp_gap_seconds`) so it cannot drift from the gap the prompt's
  // time marker uses; see `chatTimestamps.js`.
  const dividers = useMemo(
    () => buildTranscriptDividers(nonSystem, timestampGapSeconds),
    [nonSystem, timestampGapSeconds],
  );

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        messagesEndRef.current?.scrollIntoView({
          behavior: chatState.get('sendStatus').isStreaming ? 'instant' : 'smooth',
        });
      });
    };
    const unsubscribeMessages = chatState.subscribe('messages', scrollToBottom);
    const unsubscribeSendStatus = chatState.subscribe('sendStatus', scrollToBottom);
    scrollToBottom();

    return () => {
      unsubscribeMessages();
      unsubscribeSendStatus();
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [chatState, messagesEndRef]);

  const setScrollAnchor = useCallback((messageIndex) => {
    const message = nonSystem[messageIndex];
    const element = message?.message_id
      ? document.getElementById(`message-${message.message_id}`)
      : null;
    if (!element) return;
    pendingScrollAnchorRef.current = {
      messageId: message.message_id,
      top: element.getBoundingClientRect().top,
    };
  }, [nonSystem]);

  const handleLoadEarlierMessages = useCallback(() => {
    if (firstVisibleIndex <= 0) return;
    setScrollAnchor(firstVisibleIndex);
    setVisibleRange((current) => ({
      start: Math.max(0, current.start - LOAD_MESSAGE_BATCH),
      end: Math.min(nonSystem.length, current.end),
    }));
  }, [firstVisibleIndex, nonSystem.length, setScrollAnchor]);

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    const container = messagesContainerRef.current;
    if (anchor) {
      pendingScrollAnchorRef.current = null;
      const element = document.getElementById(`message-${anchor.messageId}`);
      if (element && container) {
        container.scrollTop += element.getBoundingClientRect().top - anchor.top;
      }
    }

    const jumpMessageId = pendingJumpMessageIdRef.current;
    if (jumpMessageId) {
      pendingJumpMessageIdRef.current = null;
      document.getElementById(`message-${jumpMessageId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    if (pendingBottomScrollRef.current) {
      pendingBottomScrollRef.current = false;
      messagesEndRef.current?.scrollIntoView({
        behavior: sending ? 'instant' : 'smooth',
        block: 'end',
      });
    }
  }, [messagesEndRef, sending, visibleRange]);

  useEffect(() => {
    if (!revealMessageRef) return undefined;
    const revealMessage = (messageId) => {
      const messageIndex = nonSystem.findIndex((message) => message.message_id === messageId);
      if (messageIndex < 0) return;

      const start = Math.max(0, messageIndex - Math.floor(MAX_VISIBLE_MESSAGES / 2));
      pendingJumpMessageIdRef.current = messageId;
      setVisibleRange({
        start,
        end: Math.min(nonSystem.length, start + MAX_VISIBLE_MESSAGES),
      });
    };

    revealMessageRef.current = revealMessage;
    return () => {
      if (revealMessageRef.current === revealMessage) {
        revealMessageRef.current = null;
      }
    };
  }, [nonSystem, revealMessageRef]);

  useLayoutEffect(() => {
    const previousMessageCount = previousMessageCountRef.current;
    previousMessageCountRef.current = nonSystem.length;
    if (nonSystem.length === previousMessageCount) return;

    if (nonSystem.length > previousMessageCount) {
      pendingBottomScrollRef.current = true;
    }
    setVisibleRange((current) => ({
      start: nonSystem.length > previousMessageCount
        ? (previousMessageCount === 0
          ? Math.max(0, nonSystem.length - INITIAL_VISIBLE_MESSAGES)
          : Math.min(current.start, nonSystem.length))
        : Math.max(0, nonSystem.length - INITIAL_VISIBLE_MESSAGES),
      end: nonSystem.length,
    }));
  }, [nonSystem.length, visibleRange]);

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
      ref={messagesContainerRef}
    >
      <div style={chatContentRailStyle}>
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
          <>
            {firstVisibleIndex > 0 && (
              <button
                type="button"
                onClick={handleLoadEarlierMessages}
                style={{
                  display: 'block',
                  margin: '0.5rem auto 1rem',
                  padding: '0.45rem 0.9rem',
                  border: `1px solid ${palette.dividerColor}`,
                  borderRadius: '999px',
                  background: palette.bubbleChar,
                  color: palette.textColor,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                加载更早的消息
              </button>
            )}
            {visibleMessages.map((m, visibleIndex) => {
              const i = firstVisibleIndex + visibleIndex;
              const isEditing = editingMessageId === m.message_id;
              const nav = forkNavMap.get(m.message_id);
              return (
                <React.Fragment key={m.message_id || i}>
                  {dividers.has(i) && (
                    <MessageTimestampDivider label={dividers.get(i)} palette={palette} />
                  )}
                  <MessageBubble
                    message={m}
                    chatState={chatState}
                    isHovered={hoveredMessageId === m.message_id}
                    isEditing={isEditing}
                    isAnyMessageEditing={m.role === 'user' && !!editingMessageId}
                    nav={nav}
                    isMobile={isMobile}
                    cleanMode={cleanMode}
                    palette={palette}
                    selectedCharacter={selectedCharacter}
                    selectedPersona={selectedPersona}
                    userProfilePicture={userProfilePicture}
                    editingMessageTextRef={editingMessageTextRef}
                    editingMessageTextSetterRef={editingMessageTextSetterRef}
                    branchSelectionPending={!!nav && branchSelectionPending}
                    sending={(m.role === 'user' || !!nav) && sending}
                    renderMessageContent={renderMessageContent}
                    onHoverMessage={setHoveredMessageId}
                    onTogglePin={onTogglePin}
                    onCopyMessage={onCopyMessage}
                    selectionMode={selectionMode}
                    selectedForSharing={selectedMessageIds.includes(m.message_id)}
                    onStartMultiSelect={onStartMultiSelect}
                    onToggleSelection={onToggleSelection}
                    onCancelEditing={onCancelEditing}
                    onSaveEditedMessage={onSaveEditedMessage}
                    onResendMessage={onResendMessage}
                    onStartEditing={onStartEditing}
                    onSelectBranch={onSelectBranch}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

export default ChatMessagesList;
