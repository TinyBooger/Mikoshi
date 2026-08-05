import React from 'react';

/**
 * Inline context-window usage indicator: a small SVG pie chart + hover popover
 * showing token usage vs soft limit.
 */
export default function ContextWindowIndicator({
  contextWindowUsage,
  serverContextWindowUsage,
  contextUsagePercent,
  pieRadius = 7,
  pieCircumference,
  pieStrokeOffset,
  inputHeight,
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  const btnHeight = inputHeight || 44;

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        height: `${btnHeight}px`,
      }}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <button
        type="button"
        onFocus={() => setShowDetails(true)}
        onBlur={() => setShowDetails(false)}
        onClick={() => setShowDetails((prev) => !prev)}
        aria-label="上下文窗口使用情况"
        style={{
          border: 'none',
          background: 'transparent',
          height: `${btnHeight}px`,
          padding: '0 0.2rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: showDetails ? 6 : 0,
          color: '#6b7280',
          transition: 'gap 0.16s ease',
          cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r={pieRadius} fill="none" stroke="#e5e7eb" strokeWidth="2" />
          <circle
            cx="9"
            cy="9"
            r={pieRadius}
            fill="none"
            stroke={contextUsagePercent >= 90 ? '#dc3545' : '#18191a'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={pieCircumference}
            strokeDashoffset={pieStrokeOffset}
            transform="rotate(-90 9 9)"
          />
        </svg>
        <span
          style={{
            maxWidth: showDetails ? 48 : 0,
            opacity: showDetails ? 1 : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: 'max-width 0.18s ease, opacity 0.14s ease',
          }}
        >
          {contextUsagePercent}%
        </span>
      </button>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            bottom: '140%',
            left: 0,
            transform: 'none',
            minWidth: 220,
            background: '#111827',
            color: '#f9fafb',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 20,
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 6 }}>
            上下文使用情况
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: 8 }}>
            {`当前 ${contextWindowUsage.currentTokens}/${contextWindowUsage.softLimit} tokens`}
          </div>

          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.2)',
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${contextUsagePercent}%`,
                height: '100%',
                background: contextUsagePercent >= 90 ? '#ef4444' : '#60a5fa',
              }}
            />
          </div>

          <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
            基于上次请求的上下文使用情况
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: 4 }}>
            到达 95% 上下文窗口时，系统会开始压缩上下文。
          </div>
          {Number(serverContextWindowUsage?.summary_messages_count || 0) > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#86efac', marginTop: 4 }}>
              已自动整理旧消息并保留最近 2 条对话用于请求上下文。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
