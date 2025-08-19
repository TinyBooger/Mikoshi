import React, { useEffect, useState } from 'react';
import ButtonBlack from './ButtonBlack';

/**
 * HorizontalCardSection - reusable section for displaying cards with scroll buttons and header
 * Props:
 *   title: string
 *   moreLink: string (route to navigate on 'More' click)
 *   contents: array
 *   scrollState: { left: boolean, right: boolean }
 *   scrollId: string (id for scrollable div)
 *   onMore: function (optional, overrides navigation)
 *   navigate: function (for navigation)
 */
function HorizontalCardSection({ title, moreLink, contents, scrollState, scrollId, navigate, onMore }) {
  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return (
    <section className={isMobile ? "mb-3 pb-2" : "mb-5 pb-3"}>
        <div
          className="d-flex mb-3"
          style={
            isMobile
              ? {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 0,
                }
              : {
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }
          }
        >
        <h2
          className="fw-bold text-dark"
            style={isMobile ? { fontSize: '1.18rem', letterSpacing: '0.2px', marginBottom: 0 } : { fontSize: '1.68rem', letterSpacing: '0.4px' }}
        >
          {title}
        </h2>
        <ButtonBlack
          isMobile={isMobile}
          onClick={() => onMore ? onMore() : navigate(moreLink)}
        >
          More
        </ButtonBlack>
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
          {/* Scroll Left Button */}
          { contents.length > 3 && scrollState.left && (
            <button
              aria-label="Scroll left"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: 72,
                background: 'linear-gradient(to right, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: 'none',
                transition: 'background 0.2s',
                opacity: 0.7,
                pointerEvents: 'auto',
              }}
              onClick={() => {
                const el = document.getElementById(scrollId);
                if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(to right, rgba(233,236,239,0.95) 80%, rgba(233,236,239,0))';
                e.currentTarget.style.opacity = 1;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(to right, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))';
                e.currentTarget.style.opacity = 0.7;
              }}
            >
              <i className="bi bi-arrow-left" style={{ fontSize: 28, color: '#bfc4cb', marginLeft: 12, filter: 'drop-shadow(0 0 2px #fff)' }} />
            </button>
          )}
        <div
          id={scrollId}
          className="d-flex flex-row flex-nowrap pb-2"
          style={isMobile ? {
            gap: '0.5rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
            paddingBottom: 2,
          } : {
            gap: '0.5rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
          }}
        >
          {contents === null || typeof contents === 'undefined' ? (
            <div className="text-muted py-4">Loading...</div>
          ) : contents.length === 0 ? (
            <div className="text-muted py-4">No items found.</div>
          ) : (
            Array.isArray(contents) && contents.map(c => {
              // Card width/height logic
              const CARD_WIDTH = isMobile ? '46dvw' : 180;
              const CARD_HEIGHT = isMobile ? 'calc(46dvw * 1.32)' : 250;
              return (
                <div
                  key={c.id}
                  style={{
                    minWidth: CARD_WIDTH,
                    maxWidth: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {c.renderCard ? c.renderCard(c) : null}
                </div>
              );
            })
          )}
        </div>
        {/* Scroll Right Button */}
        {contents.length > 3 && scrollState.right && (
          <button
            aria-label="Scroll right"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: 72,
              background: 'linear-gradient(to left, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
              border: 'none',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              cursor: 'pointer',
              zIndex: 3,
              boxShadow: 'none',
              transition: 'background 0.2s',
              opacity: 0.7,
              pointerEvents: 'auto',
            }}
            onClick={() => {
              const el = document.getElementById(scrollId);
              if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(to left, rgba(233,236,239,0.95) 80%, rgba(233,236,239,0))';
              e.currentTarget.style.opacity = 1;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(to left, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))';
              e.currentTarget.style.opacity = 0.7;
            }}
          >
            <i className="bi bi-arrow-right" style={{ fontSize: 28, color: '#bfc4cb', marginRight: 12, filter: 'drop-shadow(0 0 2px #fff)' }} />
          </button>
        )}
      </div>
    </section>
  );
}

export default HorizontalCardSection;
