import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function Layout() {
  // Initialize sidebarVisible based on viewport size
  const initialMobile = window.innerWidth < 768;
  const [isMobile, setIsMobile] = useState(initialMobile);
  const [sidebarVisible, setSidebarVisible] = useState(!initialMobile);
  const lastIsMobile = useRef(initialMobile);

  // Character sidebar state for ChatPage
  const [characterSidebarVisible, setCharacterSidebarVisible] = useState(!initialMobile);

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
        top: '7dvh',
        left: 0,
        width: '70vw',
        maxWidth: '20rem',
        height: 'calc(100dvh - 7dvh)',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
      }
    : {
        position: 'fixed', // CHANGED from 'relative' to 'fixed'
        top: '7dvh',
        left: 0,
        width: '15rem',
        height: 'calc(100dvh - 7dvh)',
        zIndex: 1000,
        background: 'transparent',
        transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'width 0.35s cubic-bezier(.4,0,.2,1)',
      };

  return (
    <div
      className="d-flex flex-column"
      style={{
        height: '100dvh',
        overflow: 'visible',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Topbar always fixed at the top */}
      <div style={{
        position: 'fixed', // CHANGED to fixed
        top: 0,
        left: 0,
        height: '7dvh',
        width: '100%',
        zIndex: 1100, // Higher z-index to stay above everything
        flexShrink: 0,
        background: 'inherit', // Match your theme background
      }}>
        <Topbar
          onToggleSidebar={handleToggleSidebar}
          sidebarVisible={sidebarVisible}
          isMobile={isMobile}
          onToggleCharacterSidebar={handleToggleCharacterSidebar}
          characterSidebarVisible={characterSidebarVisible}
        />
      </div>

      {/* Main content area */}
      <div
        style={{
          display: 'flex',
          height: '100dvh',
          width: '100%',
          position: 'relative',
          paddingTop: '7dvh', // ADDED padding to account for fixed topbar
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
              top: '7dvh',
              left: 0,
              width: '100vw',
              height: 'calc(100dvh - 7dvh)',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
              cursor: 'pointer',
            }}
          />
        )}

        {/* Main content area - ONLY this area scrolls */}
        <main
          className="flex-grow-1 d-flex flex-column"
          style={{
            width: isMobile ? '100%' : `calc(100% - ${sidebarVisible ? '15rem' : '0px'})`, // Adjust width based on sidebar
            marginLeft: !isMobile && sidebarVisible ? '15rem' : '0', // Push content when sidebar is visible on desktop
            zIndex: 1,
            transition: 'margin-left 0.35s cubic-bezier(.4,0,.2,1), width 0.35s cubic-bezier(.4,0,.2,1)',
            background: 'transparent',
            overflowY: 'auto', // ONLY this area scrolls
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            height: 'calc(100dvh - 7dvh)', // Full height minus topbar
            position: 'relative',
            paddingTop: '0', // Remove any extra padding
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
    </div>
  );
}