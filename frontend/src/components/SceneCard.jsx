import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';

/**
 * SceneCard - Horizontal card with image (top) and condensed text (bottom)
 * Props:
 *  - type: 'character' | 'scene' | 'persona'
 *  - entity: { id, name, picture, creator_name, views, likes, ... }
 *  - onClick?: (entity) => void
 *  - disableClick?: boolean
 */
export default function SceneCard({ type, entity, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 600 : false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Extract common fields
  const { id, name, picture, creator_name, views, likes } = entity;

  // Type-specific description
  let description = '';
  if (type === 'character') description = entity.tagline || '';
  if (type === 'scene') description = entity.intro || '';
  if (type === 'persona') description = entity.intro || '';

  // Creator name logic
  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name || t('entity_card.unknown');
  }

  // Accent per type
  const accentByType = {
    character: '#3b82f6',
    scene: '#8b5cf6',
    persona: '#f59e0b',
  };
  const accent = accentByType[type] || '#3b82f6';

  // Width (slightly larger desktop)
  const CARD_WIDTH = isMobile ? '90vw' : '27rem';

  const handleClick = () => {
    if (disableClick) return;
    if (onClick) return onClick(entity);
    if (type === 'character') navigate(`/chat?character=${encodeURIComponent(id)}`);
    if (type === 'scene') navigate(`/chat?scene=${encodeURIComponent(id)}`);
    if (type === 'persona') navigate(`/chat?persona=${encodeURIComponent(id)}`);
  };

  return (
    <div
      className="entity-card-horizontal"
      style={{
        width: CARD_WIDTH,
        aspectRatio: '10 / 7',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: isMobile ? '0.9rem' : '1.15rem',
        boxShadow: hovered ? '0 4px 18px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: disableClick ? 'default' : 'pointer',
        pointerEvents: disableClick ? 'none' : 'auto',
      }}
      onClick={disableClick ? undefined : handleClick}
      onMouseEnter={disableClick ? undefined : () => setHovered(true)}
      onMouseLeave={disableClick ? undefined : () => setHovered(false)}
    >
      {/* Image area (75%) */}
      <div
        style={{
          position: 'relative',
          flex: '0 0 75%',
          width: '100%',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(picture).replace(/^\//, '')}` : defaultPicture}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 220ms ease-out',
            willChange: 'transform',
          }}
        />
        {!isMobile && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, boxShadow: hovered ? `inset 0 0 0 2px ${accent}33` : 'none', transition: 'box-shadow 180ms ease-out' }} />
        )}
      </div>

      {/* Text area (25%) */}
      <div
        style={{
          flex: '1 1 25%',
          padding: isMobile ? '0.5rem 0.65rem 0.5rem' : '0.6rem 0.75rem 0.6rem',
          minHeight: isMobile ? '3.6rem' : '4.4rem',
          background: '#ffffff',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '0.15rem' : '0.2rem',
        }}
      >
        <div className="d-flex align-items-center justify-content-between" style={{ gap: '0.45rem' }}>
          <h5
            className="fw-bold mb-0 text-truncate"
            style={{ fontSize: isMobile ? '0.86rem' : '0.92rem', lineHeight: 1.1, maxWidth: '72%' }}
            title={name}
          >
            {name}
          </h5>
          <span
            className="badge"
            style={{
              background: accent + '18',
              color: accent,
              border: `1px solid ${accent}44`,
              fontSize: isMobile ? '0.52rem' : '0.58rem',
              padding: isMobile ? '0.18rem 0.32rem' : '0.22rem 0.38rem',
            }}
          >
            {type}
          </span>
        </div>

        <div
          className="text-truncate"
          style={{
            fontSize: isMobile ? '0.6rem' : '0.66rem',
            opacity: 0.78,
            lineHeight: 1.05,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description || <span style={{ opacity: 0.55 }}>{t('entity_card.no_description')}</span>}
        </div>

        <div
          className="d-flex align-items-center mt-auto"
          style={{ fontSize: isMobile ? '0.54rem' : '0.6rem', opacity: 0.7, lineHeight: 1 }}
        >
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span>
              <i className="bi bi-eye me-1" />
              {typeof views === 'number' ? views.toLocaleString() : 0} {t('entity_card.views')}
            </span>
            {(type === 'character' || type === 'scene') && (
              <span>
                <i className="bi bi-hand-thumbs-up me-1" />
                {typeof likes === 'number' ? likes.toLocaleString() : 0} {t('entity_card.likes')}
              </span>
            )}
          </div>
          <div
            className="ms-auto d-flex align-items-center text-truncate"
            style={{ gap: '0.2rem', maxWidth: '48%', opacity: 0.8 }}
            title={creatorDisplay}
          >
            <i className="bi bi-person-circle" />
            <span className="text-truncate">{creatorDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
