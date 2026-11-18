// Shared look for every bounded text input in the character/entity forms so a
// field of the same kind renders identically regardless of which page hosts it.
export const FIELD_STYLE = {
  background: '#f5f6fa',
  color: '#18191a',
  border: '1.5px solid #e9ecef',
  borderRadius: 16,
  fontSize: '1.08rem',
  padding: '0.7rem 1.2rem',
  boxShadow: 'none',
  outline: 'none',
  paddingRight: '3rem',
};

export const DISABLED_FIELD_STYLE = { background: '#f0f0f0' };

// Greeting fields sit in tighter rows (next to a #n marker or a checkbox), so
// they share the palette but drop the reserved right padding.
export const GREETING_FIELD_STYLE = {
  ...FIELD_STYLE,
  borderRadius: 12,
  fontSize: '1.02rem',
  padding: '0.5rem 0.9rem',
  paddingRight: '0.9rem',
};
