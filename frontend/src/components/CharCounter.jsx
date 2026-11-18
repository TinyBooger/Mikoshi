import React from 'react';

/**
 * Shared "n/max" counter. Turns red once the limit is exceeded so every bounded
 * field on the character and entity forms reacts the same way.
 */
export default function CharCounter({ value, max, suffix, inline = false, style }) {
  const length = typeof value === 'string' ? value.length : value;
  return (
    <small
      className={inline ? undefined : 'position-absolute'}
      style={{
        ...(inline ? null : { top: 0, right: 0 }),
        color: length > max ? '#dc2626' : '#6c757d',
        ...style,
      }}
    >
      {length}/{max}{suffix ? ` ${suffix}` : ''}
    </small>
  );
}
