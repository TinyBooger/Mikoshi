import React, { useEffect, useState } from 'react';
import TextButton from './TextButton';
import { useTranslation } from 'react-i18next';

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
function HorizontalCardSection({ title, subtitle, moreLink, contents, scrollState, scrollId, navigate, onMore, showMoreButton = true, itemWidth, itemHeight, itemGap }) {
  const { t } = useTranslation();
  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return (
  <section className={isMobile ? "mb-2 pb-1" : "mb-3 pb-2"}>
      <div
        className="d-flex mb-2"
        style={{
          ...(isMobile
            ? {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: 0,
                paddingLeft: '0.5rem',
                paddingRight: '1rem',
              }
            : {
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingLeft: '0.5rem',
                paddingRight: '2rem',
              }
          ),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: isMobile ? '0.15rem' : '0.2rem', flexWrap: 'nowrap', maxWidth: '100%', flex: '1 1 auto', minWidth: 0 }}>
          <h2
            className="fw-bold text-dark mb-0"
            style={isMobile
              ? { fontSize: '1.18rem', letterSpacing: '0.2px', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }
              : { fontSize: '1.68rem', letterSpacing: '0.4px', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}
          >
            {title}
          </h2>
          {subtitle ? (
            <span
              className="text-muted"
              style={{ fontSize: isMobile ? '0.9rem' : '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal' }}
            >
              {subtitle}
            </span>
          ) : null}
        </div>
        <div style={{ paddingLeft: isMobile ? '0.5rem' : '1rem' }}>
          {showMoreButton && (onMore || moreLink) ? (
            <TextButton
              isMobile={isMobile}
              onClick={() => onMore ? onMore() : navigate(moreLink)}
            >
              {t('home.more')}
            </TextButton>
          ) : null}
        </div>
      </div>
      <div
        style={{ position: 'relative', width: '100%', background: 'transparent', border: 'none', borderRadius: isMobile ? '0.75rem' : '1rem', boxShadow: 'none', padding: isMobile ? '0.25rem' : '0.5rem' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
          {/* Scroll Left Button */}
          { !isMobile && scrollState.left && (
            <button
              aria-label="Scroll left"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 72,
                background: 'linear-gradient(to right, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                cursor: 'pointer',
                zIndex: 4,
                boxShadow: 'none',
                transition: 'background 0.2s, opacity 0.15s',
                opacity: hovered ? 0.9 : 0,
                pointerEvents: hovered ? 'auto' : 'none',
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
                e.currentTarget.style.opacity = hovered ? 0.9 : 0;
              }}
            >
              <i className="bi bi-arrow-left" style={{ fontSize: 28, color: '#bfc4cb', marginLeft: 12, filter: 'drop-shadow(0 0 2px #fff)' }} />
            </button>
          )}
        <div
          id={scrollId}
          className="d-flex flex-row flex-nowrap pb-2"
          style={isMobile ? {
            gap: itemGap || '0.5rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
            paddingBottom: 2,
          } : {
            gap: itemGap || '0.5rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            width: '100%',
          }}
        >
          {contents === null || typeof contents === 'undefined' ? (
            <div className="text-muted py-4">{t('home.loading')}</div>
          ) : contents.length === 0 ? (
            <div className="text-muted py-4">{t('home.no_items')}</div>
          ) : (
            Array.isArray(contents) && contents.map(c => {
              // Card width/height logic
              const DEFAULT_WIDTH = isMobile ? '46dvw' : 180;
              const DEFAULT_HEIGHT = isMobile ? 'calc(46dvw * 1.32)' : 250;
              const WIDTH = typeof itemWidth === 'undefined' ? DEFAULT_WIDTH : itemWidth;
              const HEIGHT = typeof itemHeight === 'undefined' ? DEFAULT_HEIGHT : itemHeight;
              return (
                <div
                  key={c.id}
                  style={
                    WIDTH === 'auto' ? {
                      flex: '0 0 auto',
                      height: typeof HEIGHT === 'string' || typeof HEIGHT === 'number' ? HEIGHT : 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                    } : {
                      minWidth: WIDTH,
                      maxWidth: WIDTH,
                      height: HEIGHT,
                      display: 'flex',
                      flexDirection: 'column',
                    }
                  }
                >
                  {c.renderCard ? c.renderCard(c) : null}
                </div>
              );
            })
          )}
        </div>
        {/* Scroll Right Button */}
        {!isMobile && scrollState.right && (
          <button
            aria-label="Scroll right"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 72,
              background: 'linear-gradient(to left, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
              border: 'none',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              cursor: 'pointer',
              zIndex: 4,
              boxShadow: 'none',
              transition: 'background 0.2s, opacity 0.15s',
              opacity: hovered ? 0.9 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
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
              e.currentTarget.style.opacity = hovered ? 0.9 : 0;
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
