import React from 'react';

/**
 * TextButton - inline textual action button
 * Appears like emphasized text; gains a soft lavender background on hover.
 * Props:
 *  children: node (label/content)
 *  onClick: function
 *  isMobile: boolean (adjusts padding/font)
 *  style: object (optional additional styles)
 *  className: string (optional extra classes)
 *  disabled: boolean (optional disabled state)
 *  ...rest: other button/html props
 */
function TextButton({ children, onClick, isMobile, style = {}, className = '', disabled = false, ...rest }) {
  // Base color derived from primary (#736B92) family; hover uses #DCD0F5 at ~55% opacity
  // Using a subtle text color from the primary palette for consistency.
  const baseColor = '#6A6286';
  const hoverBg = 'rgba(220, 208, 245, 0.55)'; // #DCD0F5 softened
  const activeBg = 'rgba(220, 208, 245, 0.75)';

  const mobileStyle = {
    background: 'transparent',
    color: baseColor,
    border: 'none',
    fontSize: '0.92rem',
    padding: '0.36rem 0.56rem',
    letterSpacing: '0.16px',
    fontWeight: 600,
    transition: 'background 0.18s ease, color 0.18s ease',
    outline: 'none',
    cursor: 'pointer',
  };
  const desktopStyle = {
    background: 'transparent',
    color: baseColor,
    border: 'none',
    fontSize: '1rem',
    padding: '0.44rem 0.72rem',
    letterSpacing: '0.18px',
    fontWeight: 600,
    transition: 'background 0.18s ease, color 0.18s ease',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={`text-button ${className}`}
      style={{
        ...(isMobile ? mobileStyle : desktopStyle),
        opacity: disabled ? 0.6 : 1,
        borderRadius: 6,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.background = activeBg; }}
      onMouseUp={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onFocus={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onBlur={e => { e.currentTarget.style.background = 'transparent'; }}
      onClick={disabled ? undefined : onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default TextButton;
