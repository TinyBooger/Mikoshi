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
          minHeight: '100%',
          height: '100%',
          flexShrink: 0,
          width: '100vw',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          background: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
          marginTop: 0,
          marginBottom: 0,
          padding: 0,
          ...style,
        }
    : {
        minHeight: '100vh',
        height: '100%',
        flexShrink: 0,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        background: 'transparent',
        borderRadius: 0,
        boxShadow: 'none',
        marginTop: 0,
        marginBottom: 0,
        padding: 0,
        ...style,
      };

  const mobileClass = 'g-0 px-0 py-0';
  const mobilePadding = {};

  return (
    <div
      className={`container-fluid ${mobileClass} ${className}`.trim()}
      style={{...combinedStyle, ...mobilePadding}}
    >
      {children}
    </div>
  );
}

export default PageWrapper;
