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

  // Primary tag (first tag)
  let primaryTag = '';
  if (Array.isArray(entity?.tags) && entity.tags.length > 0) {
    const first = entity.tags[0];
    if (first && typeof first === 'object') {
      primaryTag = first.name ?? first.label ?? String(first.id ?? '');
    } else if (first != null) {
      primaryTag = String(first);
    }
  }

  // Tag color mapping and fallback color generator
  const normalizeTag = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_');
  const tagPalette = {
    romance: '#ec4899',
    love: '#ef4444',
    fantasy: '#10b981',
    sci_fi: '#06b6d4',
    scifi: '#06b6d4',
    science_fiction: '#06b6d4',
    action: '#f59e0b',
    adventure: '#16a34a',
    drama: '#8b5cf6',
    comedy: '#22c55e',
    horror: '#dc2626',
    mystery: '#3b82f6',
    thriller: '#fb923c',
    slice_of_life: '#6366f1',
    historical: '#a78bfa',
    cyberpunk: '#14b8a6',
    detective: '#0ea5e9',
    school: '#60a5fa',
    isekai: '#f97316',
  };
  const hslToHex = (h, s, l) => {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0; // keep 32bit
    }
    const h = Math.abs(hash) % 360;
    const s = 65; // vibrant
    const l = 46; // readable on white
    return hslToHex(h, s, l);
  };
  let tagColor, tagBg, tagBorder;
  if (primaryTag) {
    const key = normalizeTag(primaryTag);
    const base = tagPalette[key] || stringToColor(key);
    tagColor = base;
    tagBg = `${base}18`;
    tagBorder = `${base}40`;
  }

  // Creator name logic
  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name || t('entity_card.unknown');
  }

  // Width (slightly larger desktop)
  const CARD_WIDTH = isMobile ? '92vw' : '27rem';

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
        aspectRatio: isMobile ? '4 / 3' : '10 / 7',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: isMobile ? '0.75rem' : '1.15rem',
        boxShadow: hovered ? '0 4px 18px rgba(0,0,0,0.18)' : '0 2px 12px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
        transform: hovered && !isMobile ? 'translateY(-2px)' : 'translateY(0)',
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
          flex: isMobile ? '0 0 68%' : '0 0 75%',
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
      </div>

      {/* Text area (25%) */}
      <div
        style={{
          flex: isMobile ? '1 1 32%' : '1 1 25%',
          padding: isMobile ? '0.65rem 0.75rem 0.6rem' : '0.6rem 0.75rem 0.6rem',
          minHeight: isMobile ? '4rem' : '4.4rem',
          background: '#ffffff',
          color: '#111',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '0.25rem' : '0.2rem',
        }}
      >
        <div className="d-flex align-items-center justify-content-between" style={{ gap: isMobile ? '0.4rem' : '0.45rem' }}>
          <h5
            className="fw-bold mb-0 text-truncate"
            style={{ fontSize: isMobile ? '0.9rem' : '0.92rem', lineHeight: 1.15, fontWeight: 600, maxWidth: '70%' }}
            title={name}
          >
            {name}
          </h5>
          {primaryTag && (
            <span
              className="badge text-uppercase"
              title={primaryTag}
              style={{
                background: tagBg,
                color: tagColor,
                border: `1px solid ${tagBorder}`,
                fontSize: isMobile ? '0.54rem' : '0.58rem',
                padding: isMobile ? '0.2rem 0.35rem' : '0.22rem 0.38rem',
                letterSpacing: 0.2,
                fontWeight: 500,
                maxWidth: '45%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {primaryTag}
            </span>
          )}
        </div>

        <div
          className="text-truncate"
          style={{
            fontSize: isMobile ? '0.7rem' : '0.66rem',
            opacity: 0.8,
            lineHeight: 1.35,
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
          style={{ fontSize: isMobile ? '0.66rem' : '0.6rem', opacity: 0.75, lineHeight: 1, paddingTop: isMobile ? '0.15rem' : 0 }}
        >
          <div className="d-flex align-items-center flex-wrap" style={{ gap: isMobile ? '0.6rem' : '0.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <i className="bi bi-eye" />
              {typeof views === 'number' ? views.toLocaleString() : 0}
            </span>
            {(type === 'character' || type === 'scene') && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <i className="bi bi-hand-thumbs-up" />
                {typeof likes === 'number' ? likes.toLocaleString() : 0}
              </span>
            )}
          </div>
          <div
            className="ms-auto d-flex align-items-center text-truncate"
            style={{ gap: '0.3rem', maxWidth: isMobile ? '45%' : '48%', opacity: 0.85 }}
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
