import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Blocking spinner shown while a SillyTavern JSONL import is in flight.
 *
 * Portal-mounted into `document.body` so it covers the whole viewport, and it
 * marks `#root` as `inert` for its lifetime: pointer events, focus and keyboard
 * activation stop reaching the chat UI underneath. That is what actually
 * disables the other actions (send, switch character, rename/delete chat,
 * start a second import) — the visual layer on top is only the feedback.
 *
 * The overlay is intentionally not dismissible: the request cannot be aborted
 * once the server started parsing, so offering a close button would be a lie.
 */
export default function ChatImportOverlay({ fileName }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const root = document.getElementById('root');
    const previouslyFocused = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      if (root) root.inert = false;
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        // Swallow anything that somehow slips past the inert root.
        touchAction: 'none',
      }}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 18,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem 1.35rem',
          textAlign: 'center',
          outline: 'none',
        }}
      >
        <div
          className="spinner-border"
          role="status"
          aria-hidden="true"
          style={{ width: '2.4rem', height: '2.4rem', color: '#736B92' }}
        ></div>

        <div
          id={titleId}
          style={{ marginTop: '0.9rem', fontWeight: 700, color: '#1f2937', fontSize: '1rem' }}
        >
          正在导入对话...
        </div>

        <div
          id={descriptionId}
          style={{ marginTop: '0.45rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}
        >
          文件较大时可能需要等待几十秒，请勿关闭页面或进行其他操作。
        </div>

        {fileName && (
          <div
            title={fileName}
            style={{
              marginTop: '0.85rem',
              padding: '0.35rem 0.6rem',
              borderRadius: 8,
              background: '#f5f3fa',
              color: '#6b6480',
              fontSize: '0.78rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </div>
        )}

        <div
          className="progress"
          style={{ marginTop: '1rem', height: 6, background: '#ede9f6', borderRadius: 999 }}
          aria-hidden="true"
        >
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            style={{ width: '100%', background: '#9b8fc4' }}
          ></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
