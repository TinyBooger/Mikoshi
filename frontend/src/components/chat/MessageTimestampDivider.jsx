import React from 'react';

/**
 * Centered time break between two stretches of a conversation.
 *
 * Part of the transcript itself, not a decoration of a single bubble: a muted
 * label with a hairline running out to either side, drawn wherever
 * `buildTranscriptDividers` found a pause or a new day. Styled from the surface
 * palette so it sits quietly on every wallpaper.
 */
export default function MessageTimestampDivider({ label, palette }) {
  const ruleStyle = {
    flex: 1,
    height: 1,
    minWidth: 12,
    background: palette.dividerColor,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        // Bubbles carry their own bottom margin, so the rule is pulled back up
        // between them to keep the break evenly spaced.
        margin: '-0.5rem 0 1.1rem',
      }}
    >
      <div style={ruleStyle} />
      <span
        style={{
          fontSize: '0.72rem',
          color: palette.mutedColor,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
      <div style={ruleStyle} />
    </div>
  );
}
