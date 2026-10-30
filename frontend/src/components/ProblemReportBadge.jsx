import React from 'react';

export default function ProblemReportBadge({ count, className = '', style }) {
  if (!count) return null;

  return (
    <span
      className={className}
      aria-label={`${count} unhandled problem report${count === 1 ? '' : 's'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: '#dc3545',
        color: '#fff',
        fontSize: '0.68rem',
        fontWeight: 700,
        lineHeight: 1,
        ...style,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
