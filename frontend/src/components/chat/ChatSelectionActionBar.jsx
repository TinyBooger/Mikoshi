import React from 'react';
import { getChromeSurface } from '../../utils/backgroundPresets';

function ActionButton({ icon, label, onClick, disabled, isMobile, primary = false, iconStyle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={isMobile ? label : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: isMobile ? 44 : 38,
        minWidth: isMobile ? 0 : 94,
        flex: isMobile ? '1 1 0' : undefined,
        flexDirection: isMobile ? 'column' : 'row',
        padding: isMobile ? '0.35rem 0.2rem' : '0.45rem 1rem',
        borderRadius: isMobile ? 12 : 999,
        border: primary ? 'none' : '1px solid #dfe1e6',
        background: primary ? '#736B92' : '#fff',
        color: primary ? '#fff' : '#30323a',
        fontSize: isMobile ? '1.05rem' : '0.84rem',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        touchAction: 'manipulation',
      }}
    >
      <i className={`bi ${icon}`} aria-hidden="true" style={iconStyle}></i>
      {!isMobile && <span>{label}</span>}
    </button>
  );
}

export default function ChatSelectionActionBar({
  selectedCount,
  pinLabel,
  pinDisabled,
  busy,
  selectedWallpaper,
  isMobile,
  chatContentRailStyle,
  onCopy,
  onPin,
  onShare,
  onCancel,
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '0.7rem 1.2rem',
        paddingBottom: isMobile ? 'calc(0.7rem + env(safe-area-inset-bottom, 0px))' : '0.7rem',
        ...getChromeSurface(selectedWallpaper?.kind),
      }}
    >
      <div
        style={{
          ...chatContentRailStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#555967', fontSize: '0.82rem', fontWeight: 600, flex: '1 1 auto' }}>
          已选择 {selectedCount} 条消息
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            gap: isMobile ? 5 : 8,
            flex: isMobile ? '1 1 100%' : '0 0 auto',
          }}
        >
          <ActionButton
            icon="bi-copy"
            label="复制"
            onClick={onCopy}
            disabled={!selectedCount || busy}
            isMobile={isMobile}
          />
          <ActionButton
            icon="bi-pin-angle"
            label={pinLabel}
            onClick={onPin}
            disabled={!selectedCount || pinDisabled || busy}
            isMobile={isMobile}
          />
          <ActionButton
            icon="bi-reply-fill"
            label="分享"
            onClick={onShare}
            disabled={!selectedCount || busy}
            isMobile={isMobile}
            primary
            iconStyle={{ transform: 'scaleX(-1)' }}
          />
          <ActionButton
            icon="bi-x-lg"
            label="取消"
            onClick={onCancel}
            disabled={busy}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
}
