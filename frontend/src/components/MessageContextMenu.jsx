import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * Portal-based context menu for a chat message (pin/unpin).
 */
export default function MessageContextMenu({
  menuState,
  activeMessage,
  menuRef,
  onTogglePin,
  onClose,
}) {
  const { t } = useTranslation();

  if (!menuState.open || !activeMessage) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: Math.max(8, menuState.y + 4),
        left: Math.max(8, Math.min(window.innerWidth - 200, menuState.x)),
        width: 190,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 10px 28px rgba(0,0,0,0.16)',
        zIndex: 1200,
        padding: 6,
      }}
    >
      <button
        type="button"
        className="dropdown-item"
        style={{
          borderRadius: 8,
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        onClick={async () => {
          const nextPinnedState = !activeMessage.is_pinned;
          const targetId = activeMessage.message_id;
          onClose();
          if (!targetId) return;
          await onTogglePin(targetId, nextPinnedState);
        }}
      >
        <i
          className={
            activeMessage.is_pinned ? 'bi bi-pin-angle' : 'bi bi-pin-angle-fill'
          }
        />
        {activeMessage.is_pinned
          ? t('chat.unpin_memory') || 'Unpin memory'
          : t('chat.pin_memory') || 'Pin as memory'}
      </button>
    </div>,
    document.body
  );
}
