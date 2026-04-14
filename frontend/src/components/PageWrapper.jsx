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
          minHeight: 'auto',
          height: 'auto',
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
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          ...style,
        }
    : {
        minHeight: 'auto',
        height: 'auto',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        background: 'rgba(255, 255, 255, 0.66)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
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
