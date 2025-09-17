import React from 'react';
import { useState } from 'react';

/**
 * PageWrapper - reusable wrapper for main display area of pages
 * Props:
 *   children: ReactNode
 *   style: optional style overrides
 *   className: optional className
 */
function PageWrapper({ children, style = {}, className = '' }) {
  // Use dvh and subtract topbar height (default 51px, can be overridden by CSS var)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  React.useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 600);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const combinedStyle = isMobile
    ? {
        minHeight: '100dvh',
        height: '100dvh',
        width: '100vw',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        background: 'rgba(255, 255, 255, 0.66)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderRadius: 0,
        boxShadow: 'none',
        marginTop: 0,
        marginBottom: 0,
        padding: 0,
        ...style,
      }
    : {
        minHeight: 'calc(100dvh - 7dvh)',
        boxSizing: 'border-box',
        width: '80%',
        maxWidth: '100vw',
        background: 'rgba(255, 255, 255, 0.66)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderRadius: '1.2rem',
        boxShadow: '0 4px 32px 0 rgba(31, 38, 135, 0.12)',
        marginTop: '1.2rem',
        marginBottom: '1.2rem',
        ...style,
      };

  const mobileClass = isMobile ? 'g-0 px-0 py-0' : 'g-0 px-2 px-md-3 px-lg-4 py-4';

  return (
    <div
      className={`container-fluid ${mobileClass} ${className}`.trim()}
      style={combinedStyle}
    >
      {children}
    </div>
  );
}

export default PageWrapper;
