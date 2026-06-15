import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation } from 'react-router';
import Sidebar from './Sidebar.jsx';
import { AuthContext } from './AuthProvider.jsx';

export default function Layout() {
  const { refreshUserData } = useContext(AuthContext);
  const location = useLocation();
  
  // Initialize sidebarVisible based on viewport size
  const initialMobile = window.innerWidth < 768;
  const [isMobile, setIsMobile] = useState(initialMobile);
  const [sidebarVisible, setSidebarVisible] = useState(!initialMobile);
  const lastIsMobile = useRef(initialMobile);

  // Character sidebar state for ChatPage
  const [characterSidebarVisible, setCharacterSidebarVisible] = useState(!initialMobile);

  const sidebarMotion = '0.35s cubic-bezier(.4,0,.2,1)';

  const mainContentRef = useRef(null);
  const lastPathnameRef = useRef(location.pathname);

  // Silent refresh user data on route changes
  useEffect(() => {
    if (refreshUserData && location.pathname !== lastPathnameRef.current) {
      refreshUserData({ silent: true });
      lastPathnameRef.current = location.pathname;
    }
  }, [location.pathname, refreshUserData]);

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
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && sidebarVisible) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobile, sidebarVisible]);

  // Sidebar animation state - UPDATED FOR FIXED POSITION
  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '70vw',
        maxWidth: '20rem',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: `transform ${sidebarMotion}`,
      }
    : {
        position: 'fixed', // CHANGED from 'relative' to 'fixed'
        top: 0,
        left: 0,
        bottom: 0,
        width: '15rem',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: `transform ${sidebarMotion}`,
      };

  // iOS keyboard handling: use visualViewport API to adjust layout when keyboard opens.
  // On iOS WebKit (including Chrome), position:fixed elements do NOT reposition
  // when the software keyboard appears, causing the bottom of the page to be hidden.
  // visualViewport.height reflects the actual visible area.
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const adjustForKeyboard = () => {
      const main = mainContentRef.current;
      if (!main) return;
      // Use visualViewport height which accounts for the on-screen keyboard
      const visibleHeight = visualViewport.height;
      main.style.height = `${visibleHeight}px`;
    };

    visualViewport.addEventListener('resize', adjustForKeyboard);
    visualViewport.addEventListener('scroll', adjustForKeyboard);
    // Initial adjustment
    adjustForKeyboard();

    return () => {
      visualViewport.removeEventListener('resize', adjustForKeyboard);
      visualViewport.removeEventListener('scroll', adjustForKeyboard);
    };
  }, []);

  return (
    <div
      className="d-flex flex-column"
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
      }}
    >
      {/* Main content area */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Sidebar - fixed position on both mobile and desktop */}
        <div style={sidebarStyle}>
          <Sidebar isMobile={isMobile} setSidebarVisible={setSidebarVisible} />
        </div>

        {/* Overlay for mobile sidebar */}
        {isMobile && sidebarVisible && (
          <div
            onClick={handleToggleSidebar}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '100vw',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
              cursor: 'pointer',
            }}
          />
        )}

        {/* Main content area - ONLY this area scrolls */}
        <main
          ref={mainContentRef}
          className="flex-grow-1 d-flex flex-column"
          style={{
            width: isMobile ? '100%' : `calc(100% - ${sidebarVisible ? '15rem' : '0px'})`,
            marginLeft: !isMobile && sidebarVisible ? '15rem' : '0',
            zIndex: 1,
            transition: `margin-left ${sidebarMotion}, width ${sidebarMotion}`,
            background: 'transparent',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            height: isMobile ? `${window.visualViewport?.height || window.innerHeight}px` : '100vh',
            position: 'relative',
            paddingTop: '0',
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0',
          }}
        >
          <Outlet
            context={{
              characterSidebarVisible,
              onToggleCharacterSidebar: handleToggleCharacterSidebar,
              sidebarVisible,
              setSidebarVisible,
            }}
          />
        </main>
      </div>
      {!sidebarVisible && createPortal(
        <button
          type="button"
          onClick={handleToggleSidebar}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          style={{
            position: 'fixed',
            top: '1rem',
            left: '1rem',
            zIndex: 1300,
            border: 'none',
            background: 'transparent',
            width: '2.35rem',
            height: '2.35rem',
            padding: 0,
            margin: 0,
            color: '#232323',
            fontSize: '1.6rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            borderRadius: '50%',
            transition: 'background 0.16s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="bi bi-layout-sidebar" style={{ pointerEvents: 'none' }}></i>
        </button>,
        document.body
      )}
    </div>
  );
}