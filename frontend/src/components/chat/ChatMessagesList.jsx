import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from '../MessageBubble';
import ChatWelcomeCard from '../ChatWelcomeCard';
import MessageTimestampDivider from './MessageTimestampDivider';
import { getChromeSurface, isVeiledBackground, getSurfacePalette } from '../../utils/backgroundPresets';
import { buildTranscriptDividers } from '../../utils/chatTimestamps';

const INITIAL_VISIBLE_MESSAGES = 80;
const MAX_VISIBLE_MESSAGES = 160;
const LOAD_MESSAGE_BATCH = 80;
const SCROLL_EDGE_THRESHOLD = 120;

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
  revealMessageRef,
  onHoverMessage,
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
  onEditTextChange,
}) {
  const nonSystem = useMemo(() => messages.filter((message) => message.role !== 'system'), [messages]);
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: Math.max(0, nonSystem.length - INITIAL_VISIBLE_MESSAGES),
    end: nonSystem.length,
  }));
  const messagesContainerRef = useRef(null);
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

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= SCROLL_EDGE_THRESHOLD && firstVisibleIndex > 0) {
      setScrollAnchor(firstVisibleIndex);
      setVisibleRange((current) => {
        const start = Math.max(0, current.start - LOAD_MESSAGE_BATCH);
        return {
          start,
          end: Math.min(nonSystem.length, start + MAX_VISIBLE_MESSAGES),
        };
      });
      return;
    }

    const isNearBottom = container.scrollTop + container.clientHeight
      >= container.scrollHeight - SCROLL_EDGE_THRESHOLD;
    if (isNearBottom && lastVisibleIndex < nonSystem.length) {
      const retainedIndex = Math.min(
        firstVisibleIndex + LOAD_MESSAGE_BATCH,
        lastVisibleIndex - 1,
      );
      setScrollAnchor(retainedIndex);
      setVisibleRange((current) => {
        const end = Math.min(nonSystem.length, current.end + LOAD_MESSAGE_BATCH);
        return {
          start: Math.min(
            Math.max(0, end - MAX_VISIBLE_MESSAGES),
            current.start + LOAD_MESSAGE_BATCH,
          ),
          end,
        };
      });
    }
  }, [firstVisibleIndex, lastVisibleIndex, nonSystem.length, setScrollAnchor]);

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
    const windowSize = Math.min(
      MAX_VISIBLE_MESSAGES,
      Math.max(INITIAL_VISIBLE_MESSAGES, visibleRange.end - visibleRange.start),
    );
    setVisibleRange({
      start: Math.max(0, nonSystem.length - windowSize),
      end: nonSystem.length,
    });
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
      onScroll={handleScroll}
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
          visibleMessages.map((m, visibleIndex) => {
            const i = firstVisibleIndex + visibleIndex;
            const isEditing = editingMessageId === m.message_id;
            return (
              <React.Fragment key={m.message_id || i}>
                {dividers.has(i) && (
                  <MessageTimestampDivider label={dividers.get(i)} palette={palette} />
                )}
                <MessageBubble
                  message={m}
                  isHovered={hoveredMessageId === m.message_id}
                  isEditing={isEditing}
                  isAnyMessageEditing={!!editingMessageId}
                  nav={forkNavMap.get(m.message_id)}
                  isMobile={isMobile}
                  cleanMode={cleanMode}
                  palette={palette}
                  selectedCharacter={selectedCharacter}
                  selectedPersona={selectedPersona}
                  userData={userData}
                  {...(isEditing ? { editingMessageText } : {})}
                  branchSelectionPending={branchSelectionPending}
                  sending={sending}
                  renderMessageContent={renderMessageContent}
                  onHoverMessage={onHoverMessage}
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
                  onEditTextChange={onEditTextChange}
                />
              </React.Fragment>
            );
          })
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
