import React from 'react';

/**
 * SecondaryButton - reusable white button for actions
 * Props:
 *   children: node (button label)
 *   onClick: function
 *   style: object (optional, additional styles)
 *   className: string (optional)
 *   ...rest: other props
 */

function SecondaryButton({ children, isMobile, onClick, style = {}, className = '', ...rest }) {
  const mobileStyle = {
    background: '#fff',
    color: '#18191a',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    fontSize: '0.78rem',
    padding: '0.32rem 1.1rem',
    letterSpacing: '0.12px',
    transition: 'background 0.14s, color 0.14s',
    outline: 'none',
    cursor: 'pointer',
    marginTop: 2,
  };
  const desktopStyle = {
    background: '#fff',
    color: '#18191a',
    border: '1px solid #e0e0e0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    fontSize: '0.86rem',
    padding: '0.4rem 1.6rem',
    letterSpacing: '0.16px',
    transition: 'background 0.14s, color 0.14s',
    outline: 'none',
    cursor: 'pointer',
  };
  return (
    <button
      className={`fw-bold rounded-pill ${className}`}
      style={{
        ...(isMobile ? mobileStyle : desktopStyle),
        ...style,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f3f3f3'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default SecondaryButton;
