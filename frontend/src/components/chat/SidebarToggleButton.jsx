import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Floating character-sidebar toggle rendered by ChatPage while the sidebar is
 * collapsed. Portal-mounted into `document.body` so it stays pinned to the
 * viewport instead of scrolling with the chat container.
 *
 * NOTE: This is NOT the same control as the collapse chevron inside
 * `CharacterSidebar` (that one always hides; it uses i18n labels and a
 * different size). This is the counterpart that re-opens the sidebar and
 * carries the one-off mobile "chat settings" hint bubble.
 *
 * The `characterSidebarVisible` ternaries below are carried over verbatim from
 * ChatPage. In practice this component only ever mounts while the sidebar is
 * hidden, so the "hidden" branch is the one that renders — intentionally kept
 * as-is rather than simplified, to avoid any behavior change.
 */
export default function SidebarToggleButton({
  showHint,
  isMobile,
  characterSidebarVisible,
  onToggle,
}) {
  return createPortal(
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1200 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {showHint && isMobile && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: '-0.35rem',
              transform: 'translateY(0)',
              background: '#232323',
              color: '#fff',
              borderRadius: 8,
              padding: '0.4rem 0.6rem',
              fontSize: '0.78rem',
              lineHeight: 1.25,
              width: 'clamp(170px, 48vw, 230px)',
              maxWidth: 'calc(100vw - 1rem)',
              whiteSpace: 'normal',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
              zIndex: 1200,
            }}
          >
            点击这里打开聊天设置
            <span
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                borderStyle: 'solid',
                top: '-7px',
                right: '12px',
                borderWidth: '0 7px 7px 7px',
                borderColor: 'transparent transparent #232323 transparent',
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={characterSidebarVisible ? '隐藏角色侧边栏' : '显示角色侧边栏'}
          style={{
            border: 'none',
            background: 'transparent',
            width: '2.35rem',
            height: '2.35rem',
            padding: 0,
            margin: 0,
            color: '#232323',
            fontSize: '1.4rem',
            cursor: 'pointer',
            outline: 'none',
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.16s, color 0.15s',
            lineHeight: 1,
            borderRadius: '50%',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <i
            className={`bi ${characterSidebarVisible ? 'bi-chat-square-text-fill' : 'bi-chat-square-text'}`}
            style={{ fontSize: '1.4rem', pointerEvents: 'none' }}
          ></i>
        </button>
      </div>
    </div>,
    document.body,
  );
}
