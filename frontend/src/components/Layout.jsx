import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
// Renamed with Capital
export default function Layout() {
  // Initialize sidebarVisible based on viewport size
  const initialMobile = window.innerWidth < 768;
  const [isMobile, setIsMobile] = useState(initialMobile);
  const [sidebarVisible, setSidebarVisible] = useState(!initialMobile);
  const lastIsMobile = useRef(initialMobile);

  // Character sidebar state for ChatPage
  const [characterSidebarVisible, setCharacterSidebarVisible] = useState(false);

  // Mutually exclusive toggles for mobile
  const handleToggleSidebar = () => {
    if (isMobile) {
      setSidebarVisible(v => {
        if (!v) setCharacterSidebarVisible(false);
        return !v;
      });
    } else {
      setSidebarVisible(v => !v);
    }
  };

  const handleToggleCharacterSidebar = () => {
    if (isMobile) {
      setCharacterSidebarVisible(v => {
        if (!v) setSidebarVisible(false);
        return !v;
      });
    } else {
      setCharacterSidebarVisible(v => !v);
    }
  };

  // Debounced resize handler
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        // Only update sidebarVisible if crossing breakpoint
        if (mobile !== lastIsMobile.current) {
          setSidebarVisible(!mobile); // Show on desktop, hide on mobile
          setCharacterSidebarVisible(false); // Always close character sidebar on breakpoint change
        }
        lastIsMobile.current = mobile;
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    // No forced initial call, rely on initial state
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && sidebarVisible) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobile, sidebarVisible]);

  // Remove old toggleSidebar, use handleToggleSidebar instead

  // Sidebar animation state
  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: '7dvh',
        left: 0,
        width: '70vw',
        maxWidth: '20rem',
        height: 'calc(100dvh - 7dvh)',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        position: 'relative',
        width: sidebarVisible ? '15rem' : '0',
        minWidth: sidebarVisible ? '15rem' : '0',
        height: '100dvh',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-15rem)',
        transition: 'transform 0.35s cubic-bezier(.4,0,.2,1), width 0.35s cubic-bezier(.4,0,.2,1), min-width 0.35s cubic-bezier(.4,0,.2,1)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div
      className="d-flex"
      style={{
        height: '100dvh',
        overflow: 'visible',
        flexDirection: isMobile ? 'column' : 'row',
        position: 'relative',
        width: '100%',
        // background moved to body in index.html
      }}
    >
      {/* Sidebar overlays on mobile, inline on desktop */}
      <div style={sidebarStyle}>
        <Sidebar />
      </div>
      {/* Overlay for mobile sidebar */}
      {isMobile && sidebarVisible && (
        <div
          onClick={handleToggleSidebar}
          style={{
            position: 'fixed',
            top: '7dvh',
            left: 0,
            width: '100vw',
            height: 'calc(100dvh - 7dvh)',
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}
      <div
        className="d-flex flex-column flex-grow-1"
        style={{
          width: '100%',
          minWidth: 0,
          transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
          background: 'transparent',
        }}
      >
        <div style={{ height: '7dvh', flexShrink: 0 }}>
          <Topbar
            onToggleSidebar={handleToggleSidebar}
            sidebarVisible={sidebarVisible}
            isMobile={isMobile}
            onToggleCharacterSidebar={handleToggleCharacterSidebar}
            characterSidebarVisible={characterSidebarVisible}
          />
        </div>
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            height: 'calc(100dvh - 7dvh)',
            position: 'relative',
            background: 'transparent',
          }}
        >
          <Outlet
            context={{
              characterSidebarVisible,
              onToggleCharacterSidebar: handleToggleCharacterSidebar,
            }}
          />
        </main>
      </div>
    </div>
  );
}
