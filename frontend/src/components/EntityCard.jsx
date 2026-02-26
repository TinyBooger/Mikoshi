import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import { AuthContext } from './AuthProvider';

/**
 * EntityCard - Unified card for Character, Scene, Persona
 * @param {Object} props
 * @param {'character'|'scene'|'persona'} props.type
 * @param {Object} props.entity
 * @param {Function} [props.onClick] Optional click handler
 * @param {boolean} [props.disableClick] Optional flag to disable click behavior
 * @param {boolean} [props.compact] Optional flag for compact horizontal layout
 */
export default function EntityCard({ type, entity, onClick, disableClick = false, compact = false }) {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Common fields
  const {
    id,
    name,
    picture,
    creator_name,
    views,
    likes,
    is_public,
    is_forkable,
    is_free,
    price,
  } = entity;

  // Type-specific fields
  let description = '';
  if (type === 'character') {
    description = entity.tagline || '';
  } else if (type === 'scene') {
    description = entity.intro || '';
  } else if (type === 'persona') {
    description = entity.intro || '';
  }

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

  // Card sizes
  // On mobile, use 4:5 aspect ratio for card (height = width * 1.25)
  const CARD_WIDTH = compact ? '100%' : (isMobile ? '100%' : '11.25rem');
  const CARD_ASPECT_RATIO = 1.25; // 4:5
  const CARD_HEIGHT = compact
    ? (isMobile ? '100%' : '15.625rem')
    : (isMobile ? 'calc(100vw / 2 * 1.25 - 0.5rem)' : '15.625rem'); // 2 columns, minus gap
  const IMAGE_ASPECT_RATIO = 0.8; // 4:5 image, but can be 1:1 if you prefer
  const IMAGE_SIZE = compact && isMobile ? '90px' : (isMobile ? '100%' : CARD_WIDTH);

  // Creator name logic
  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name ? entity.creator_name : t('entity_card.unknown');
  }

  const suppressPersonaNavigation = type === 'persona' && !onClick;
  const clickSuppressed = disableClick || suppressPersonaNavigation;

  // Card click logic
  const handleClick = async () => {
    if (clickSuppressed) return;
    if (onClick) {
      onClick(entity);
    } else if (type === 'character') {
      if (!sessionToken) {
        navigate(`/character/${encodeURIComponent(id)}`);
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE_URL}/api/character/${encodeURIComponent(id)}/access`, {
          headers: { 'Authorization': sessionToken }
        });
        if (!res.ok) {
          navigate(`/character/${encodeURIComponent(id)}`);
          return;
        }

        const accessData = await res.json();
        if (accessData?.has_access) {
          navigate(`/chat?character=${encodeURIComponent(id)}`);
        } else {
          navigate(`/character/${encodeURIComponent(id)}`);
        }
        return;
      } catch (_error) {
        navigate(`/character/${encodeURIComponent(id)}`);
        return;
      }
    } else if (type === 'scene') {
      // Navigate to scene page (adjust route as needed)
      navigate(`/chat?scene=${encodeURIComponent(id)}`);
    } else if (type === 'persona') {
      return;
    }
  };

  const handleViewDetail = (e) => {
    e.stopPropagation(); // Prevent card click
    navigate(`/${type}/${id}`);
  };

  return (
    <div
      className={compact && isMobile ? "d-flex flex-row position-relative" : "d-flex flex-column position-relative"}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: '#f9fafb',
        borderRadius: isMobile ? '0.75rem' : '1rem',
        boxShadow: isMobile ? '0 0.0625rem 0.375rem rgba(0,0,0,0.10)' : '0 0.125rem 0.75rem rgba(0,0,0,0.10)',
        border: '0.125rem solid #e9ecef',
        overflow: 'hidden',
        transition: 'box-shadow 0.16s, transform 0.16s',
        cursor: clickSuppressed ? 'default' : 'pointer',
        pointerEvents: disableClick ? 'none' : 'auto',
        margin: 0,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: compact && isMobile ? 'row' : 'column',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
      onMouseEnter={clickSuppressed ? undefined : e => { setHovered(true); e.currentTarget.style.boxShadow = isMobile ? '0 3px 10px rgba(0,0,0,0.13)' : '0 6px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = isMobile ? 'scale(1.03)' : 'translateY(-2px) scale(1.018)'; }}
      onMouseLeave={clickSuppressed ? undefined : e => { setHovered(false); e.currentTarget.style.boxShadow = isMobile ? '0 1px 6px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top: Image */}
      <div
        style={{
          width: compact && isMobile ? IMAGE_SIZE : '100%',
          flex: compact && isMobile ? '0 0 auto' : '1 1 0%',
          aspectRatio: isMobile && !compact ? '4/5' : undefined,
          minHeight: isMobile && !compact ? 0 : undefined,
          maxHeight: isMobile && !compact ? '70%' : undefined,
          height: compact && isMobile ? '100%' : (isMobile ? undefined : (typeof IMAGE_SIZE === 'string' ? IMAGE_SIZE : IMAGE_SIZE)),
          background: '#e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: compact && isMobile ? 'none' : '1px solid #e3e6ea',
          borderRight: compact && isMobile ? '1px solid #e3e6ea' : 'none',
          overflow: 'hidden',
          padding: 0,
          position: 'relative',
        }}
      >
        {/* Status badges in top-right corner */}
        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 3, flexDirection: 'column', alignItems: 'flex-end', zIndex: 1 }}>
          {is_public === false && (
            <span
              title={t('entity_card.private') || 'Private'}
              style={{
                background: 'rgba(107, 114, 128, 0.9)',
                color: '#fff',
                fontSize: '0.55rem',
                padding: '2px 5px',
                borderRadius: '4px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <i className="bi bi-lock-fill" style={{ fontSize: '0.5rem' }}></i>
            </span>
          )}
          {is_forkable && (
            <span
              title={t('entity_card.forkable') || 'Forkable'}
              style={{
                background: 'rgba(34, 197, 94, 0.9)',
                color: '#fff',
                fontSize: '0.55rem',
                padding: '2px 5px',
                borderRadius: '4px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <i className="bi bi-diagram-3-fill" style={{ fontSize: '0.5rem' }}></i>
            </span>
          )}
          {type === 'character' && is_free === false && price > 0 && (
            <span
              title={t('entity_card.paid') || 'Paid'}
              style={{
                background: 'rgba(251, 146, 60, 0.9)',
                color: '#fff',
                fontSize: '0.55rem',
                padding: '2px 5px',
                borderRadius: '4px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              ¥{price}
            </span>
          )}
        </div>
        <img
          src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${picture.replace(/^\//, '')}` : defaultPicture}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 0,
            border: 'none',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 220ms ease-out',
            willChange: 'transform',
          }}
        />
      </div>
      {/* Name & Creator and Info Area (footer) */}
      <div
        className={compact && isMobile ? "d-flex flex-column justify-content-center px-2 py-1" : "px-2 pt-2 pb-1"}
        style={{
          minWidth: 0,
          flex: '0 0 auto',
          minHeight: isMobile && !compact ? 64 : undefined, // always show info area
          paddingTop: isMobile && !compact ? 8 : undefined,
          paddingBottom: isMobile && !compact ? 8 : undefined,
          background: 'inherit',
        }}
      >
        <div className="d-flex align-items-center justify-content-between" style={{ gap: '0.25rem', marginBottom: compact && isMobile ? '0.05rem' : '0.15rem' }}>
          <h5 className="fw-bold text-dark text-truncate mb-0" style={{ fontSize: compact && isMobile ? '0.85rem' : (isMobile ? '0.92rem' : '0.98rem'), maxWidth: primaryTag ? '70%' : (isMobile ? '100%' : '9.375rem'), fontFamily: 'Inter, sans-serif' }}>{name}</h5>
          {primaryTag && (
            <span
              className="badge text-uppercase"
              title={primaryTag}
              style={{
                background: tagBg,
                color: tagColor,
                border: `1px solid ${tagBorder}`,
                fontSize: isMobile ? '0.48rem' : '0.52rem',
                padding: isMobile ? '0.15rem 0.28rem' : '0.18rem 0.32rem',
                letterSpacing: 0.2,
                fontWeight: 500,
                maxWidth: '30%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {primaryTag}
            </span>
          )}
        </div>
        <span className="text-muted small" style={{ fontSize: isMobile ? '0.68rem' : '0.74rem', fontFamily: 'Inter, sans-serif', fontWeight: 400, display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: isMobile ? '100%' : '9.375rem' }}>
          <i className="bi bi-person-circle me-1"></i>
          {creatorDisplay ? creatorDisplay : <span style={{ opacity: 0.4 }}>Unknown</span>}
        </span>
      </div>
      {/* Description/Tagline/Intro */}
      {!(compact && isMobile) && (<div className="px-2" style={{
        flex: 1,
        minHeight: isMobile ? '1.125rem' : '1.375rem', // 18px/22px
        maxHeight: isMobile ? '1.125rem' : '1.375rem',
        overflow: 'hidden',
        marginBottom: '0.125rem', // 2px
        marginTop: '0.125rem',
      }}>
        <span className="text-secondary" style={{
          fontSize: isMobile ? '0.66rem' : '0.74rem',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.14,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          display: 'block',
        }}>
          {description || <span style={{ opacity: 0.4 }}>{t('entity_card.no_description')}</span>}
        </span>
      </div>)}
      {/* Stats */}
      {!(compact && isMobile) && (<div className="d-flex align-items-center justify-content-between px-2 pb-1" style={{ minHeight: isMobile ? '0.875rem' : '1.125rem' }}> {/* 14px/18px */}
        <span className="d-flex align-items-center text-secondary" style={{ fontSize: isMobile ? '0.5625rem' : '0.625rem' }}> {/* 9px/10px */}
          <i className="bi bi-chat me-1"></i> {typeof views === 'number' ? views.toLocaleString() : 0}
        </span>
        {(type === 'character' || type === 'scene' || type === 'persona') && (
          <span className="d-flex align-items-center text-secondary" style={{ fontSize: isMobile ? '0.5625rem' : '0.625rem' }}>
            <i className="bi bi-heart me-1"></i> {typeof likes === 'number' ? likes.toLocaleString() : 0}
          </span>
        )}
      </div>)}
      {/* View Detail Button for forkable entities */}
      {is_forkable && !(compact && isMobile) && (
        <div className="px-2 pb-2">
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
