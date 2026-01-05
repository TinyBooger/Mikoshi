import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';

/**
 * NameCard - Same fields as EntityCard but laid out like a compact name card
 * Props:
 *  - type: 'character' | 'scene' | 'persona'
 *  - entity: { id, name, picture, creator_name, views, likes, ... }
 *  - onClick?: (entity) => void
 *  - disableClick?: boolean
 */
export default function NameCard({ type, entity, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 600 : false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Common fields
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

  // Sizing
  // Make card smaller on mobile
  const CARD_WIDTH = isMobile ? '70vw' : '19rem';
  // Avatar size responsive
  const AVATAR_SIZE = isMobile ? 48 : 80;

  const suppressPersonaNavigation = type === 'persona' && !onClick;
  const clickSuppressed = disableClick || suppressPersonaNavigation;

  const handleClick = () => {
    if (clickSuppressed) return;
    if (onClick) return onClick(entity);
    if (type === 'character') navigate(`/chat?character=${encodeURIComponent(id)}`);
    if (type === 'scene') navigate(`/chat?scene=${encodeURIComponent(id)}`);
    if (type === 'persona') return;
  };

  const handleViewDetail = (e) => {
    e.stopPropagation();
    navigate(`/${type}/${id}`);
  };

  return (
    <div
      className="entity-name-card"
      style={{
        width: CARD_WIDTH,
        aspectRatio: isMobile ? '1.7 / 1' : '16 / 9',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: isMobile ? '0.5rem' : '1rem',
        border: '1px solid #e9ecef',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.10)' : '0 2px 10px rgba(0,0,0,0.06)',
        cursor: clickSuppressed ? 'default' : 'pointer',
        pointerEvents: disableClick ? 'none' : 'auto',
        transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
        transform: hovered && !isMobile ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
      onMouseEnter={clickSuppressed ? undefined : () => setHovered(true)}
      onMouseLeave={clickSuppressed ? undefined : () => setHovered(false)}
    >
      {/* Upper content (avatar + texts) */}
      <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-start', gap: isMobile ? '0.3rem' : '0.8rem', padding: isMobile ? '0.3rem 0.3rem 0.15rem' : '0.6rem 0.8rem 0.4rem', position: 'relative' }}>
        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: '50%',
              overflow: 'hidden',
              border: isMobile ? '1px solid #e9ecef' : '2px solid #e9ecef',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              flexShrink: 0,
              background: '#f3f4f6',
            }}
          >
            <img
              src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(picture).replace(/^\//, '')}` : defaultPicture}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          {/* Forkable badge on avatar */}
          {entity.is_forkable && (
            <div style={{ position: 'absolute', top: -2, right: -2, zIndex: 2 }}>
              <span
                title={t('entity_card.forkable') || 'Forkable'}
                style={{
                  background: 'rgba(34, 197, 94, 0.95)',
                  color: '#fff',
                  fontSize: '0.5rem',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontWeight: 600,
                  letterSpacing: '0.2px',
                  textTransform: 'uppercase',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  display: 'inline-block',
                }}
              >
                <i className="bi bi-diagram-3-fill" style={{ fontSize: '0.45rem' }}></i>
              </span>
            </div>
          )}
        </div>

        {/* Texts */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, justifyContent: 'flex-start' }}>
          <div className="d-flex align-items-center" style={{ gap: isMobile ? '0.25rem' : '0.4rem', minWidth: 0, padding: isMobile ? '0 0 0.1rem' : '0.3rem 0 0.2rem' }}>
            <h5 className="mb-0 text-truncate" style={{ fontSize: isMobile ? '0.85rem' : '0.96rem', lineHeight: 1.2, fontWeight: 500, padding: 0 }} title={name}>
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
                  fontSize: isMobile ? '0.48rem' : '0.54rem',
                  padding: isMobile ? '0.14rem 0.28rem' : '0.16rem 0.28rem',
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
            className=""
            style={{
              fontSize: isMobile ? '0.68rem' : '0.78rem',
              opacity: 0.75,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginTop: isMobile ? '0.15rem' : '0.3rem',
            }}
          >
            {description || <span style={{ opacity: 0.6 }}>{t('entity_card.no_description')}</span>}
          </div>
        </div>
      </div>

      {/* Footer stats (moved to bottom) */}
      <div style={{ padding: isMobile ? '0.25rem 0.3rem 0.28rem' : '0.45rem 0.8rem 0.65rem', borderTop: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? '0.25rem' : '0.9rem' }}>
        <div className="d-flex align-items-center" style={{ gap: isMobile ? '0.5rem' : '0.9rem' }}>
          <span style={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: '#555', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <i className="bi bi-chat" />
            {typeof views === 'number' ? views.toLocaleString() : 0}
          </span>
          {(type === 'character' || type === 'scene') && (
            <span style={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: '#555', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <i className="bi bi-heart" />
              {typeof likes === 'number' ? likes.toLocaleString() : 0}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center text-truncate" style={{ gap: '0.3rem', maxWidth: isMobile ? '50%' : '52%', color: '#555', fontSize: isMobile ? '0.65rem' : '0.72rem' }} title={creatorDisplay}>
          <i className="bi bi-person-circle" />
          <span className="text-truncate">{creatorDisplay}</span>
        </div>
      </div>
      {/* View Detail Button for forkable entities */}
      {entity.is_forkable && (
        <div style={{ padding: isMobile ? '0 0.3rem 0.3rem' : '0 0.8rem 0.6rem' }}>
          <button
            onClick={handleViewDetail}
            className="w-100 btn btn-sm"
            style={{
              fontSize: isMobile ? '0.65rem' : '0.7rem',
              padding: isMobile ? '0.25rem 0.5rem' : '0.3rem 0.6rem',
              background: '#736B92',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#6A6286'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#736B92'}
          >
            <i className="bi bi-info-circle me-1"></i>
            {t('entity_card.view_detail')}
          </button>
        </div>
      )}
    </div>
  );
}
