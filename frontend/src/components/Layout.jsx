import React, { useState, useEffect, useRef, useContext } from 'react';
import { Outlet, useLocation } from 'react-router';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
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

  // Topbar visibility state for mobile scroll behavior
  const [isTopbarVisible, setIsTopbarVisible] = useState(true);
  const lastScrollY = useRef(0);
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

  // Scroll detection for topbar hide/show on mobile
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = mainContent.scrollTop;
          
          // Only apply hide/show behavior on mobile (below 768px)
          if (isMobile) {
            if (currentScrollY < 10) {
              // Always show at top
              setIsTopbarVisible(true);
            } else if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
              // Scrolling down - hide
              setIsTopbarVisible(false);
            } else if (currentScrollY < lastScrollY.current) {
              // Scrolling up - show
              setIsTopbarVisible(true);
            }
          } else {
            // Always visible on desktop
            setIsTopbarVisible(true);
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    mainContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

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
        height: '100vh',
        overflow: 'hidden',
        width: '100%',
        position: 'fixed',
        inset: 0,
      }}
    >
      {/* Topbar always fixed at the top */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '7dvh',
        width: '100%',
        zIndex: 1100,
        flexShrink: 0,
        background: 'inherit',
        transform: isTopbarVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease-in-out',
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
          height: '100vh',
          width: '100%',
          position: 'fixed',
          inset: 0,
          paddingTop: '7dvh',
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
              height: 'calc(100vh - 7dvh)',
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
            transition: 'margin-left 0.35s cubic-bezier(.4,0,.2,1), width 0.35s cubic-bezier(.4,0,.2,1)',
            background: 'transparent',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            height: 'calc(100vh - 7dvh)',
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
    </div>
  );
}