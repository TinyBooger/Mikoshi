import React from 'react';
/**
 * A rounded, pill-shaped action button with outlined or filled style.
 * Props:
 * - children: button content (icon, text, etc)
 * - onClick: click handler
 * - style: additional style
 * - className: additional className
 * - filled: if true, uses filled dark style; else outlined
 * - disabled: disables the button
 * - ...rest: other button props
 */
export default function ButtonRounded({
  children,
  onClick,
  style = {},
  className = '',
  filled = false,
  disabled = false,
  ...rest
}) {
  const baseStyle = {
    borderRadius: 20,
    border: '1.5px solid #232323',
    background: filled ? '#111' : '#fff',
    color: filled ? '#fff' : '#232323',
    fontWeight: 600,
    width: '90%',
    alignSelf: 'center',
    transition: 'background 0.18s, color 0.18s, border 0.18s',
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...style,
  };
  // Hover effect handlers
  const handleMouseEnter = e => {
    if (disabled) return;
    e.currentTarget.style.background = '#18191a';
    e.currentTarget.style.color = '#fff';
    e.currentTarget.style.border = '1.5px solid #18191a';
  };
  const handleMouseLeave = e => {
    if (disabled) return;
    e.currentTarget.style.background = filled ? '#111' : '#fff';
    e.currentTarget.style.color = filled ? '#fff' : '#232323';
    e.currentTarget.style.border = '1.5px solid #232323';
  };
  return (
    <button
      type="button"
      className={`btn btn-sm mt-2 ${className}`}
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
