import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';

/**
 * EntityCard - Unified card for Character, Scene, Persona
 * @param {Object} props
 * @param {'character'|'scene'|'persona'} props.type
 * @param {Object} props.entity
 * @param {Function} [props.onClick] Optional click handler
 * @param {boolean} [props.disableClick] Optional flag to disable click behavior
 */
export default function EntityCard({ type, entity, onClick, disableClick = false }) {
  const { t } = useTranslation();
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

  // Card sizes
  // For mobile, use a bit less than 50dvw for two-column layout with gap
  const CARD_WIDTH = isMobile ? '46dvw' : '11.25rem'; // 180px = 11.25rem
  const CARD_HEIGHT = isMobile ? 'calc(46dvw * 1.32)' : '15.625rem'; // 250px = 15.625rem
  const IMAGE_SIZE = CARD_WIDTH;

  // Creator name logic
  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name ? entity.creator_name : t('entity_card.unknown');
  }

  // Card click logic
  const handleClick = () => {
    if (disableClick) return;
    if (onClick) {
      onClick(entity);
    } else if (type === 'character') {
      // Default: navigate to chat for character
      navigate(`/chat?character=${encodeURIComponent(id)}`);
    } else if (type === 'scene') {
      // Navigate to scene page (adjust route as needed)
      navigate(`/chat?scene=${encodeURIComponent(id)}`);
    } else if (type === 'persona') {
      // Navigate to persona page (adjust route as needed)
      navigate(`/chat?persona=${encodeURIComponent(id)}`);
    }
  };

  return (
    <div
      className="d-flex flex-column position-relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: '#f9fafb',
        borderRadius: isMobile ? '0.75rem' : '1rem', // 12px/16px
        boxShadow: isMobile ? '0 0.0625rem 0.375rem rgba(0,0,0,0.10)' : '0 0.125rem 0.75rem rgba(0,0,0,0.10)', // 1px/6px, 2px/12px
        border: '0.125rem solid #e9ecef', // 2px
        overflow: 'hidden',
        transition: 'box-shadow 0.16s, transform 0.16s',
        cursor: disableClick ? 'default' : 'pointer',
        pointerEvents: disableClick ? 'none' : 'auto',
        margin: isMobile ? '0 0.125rem' : undefined, // 2px
        minWidth: isMobile ? '8.75rem' : undefined, // 140px
        maxWidth: isMobile ? '98vw' : undefined,
      }}
      onClick={disableClick ? undefined : handleClick}
      onMouseEnter={disableClick ? undefined : e => { setHovered(true); e.currentTarget.style.boxShadow = isMobile ? '0 3px 10px rgba(0,0,0,0.13)' : '0 6px 18px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = isMobile ? 'scale(1.03)' : 'translateY(-2px) scale(1.018)'; }}
      onMouseLeave={disableClick ? undefined : e => { setHovered(false); e.currentTarget.style.boxShadow = isMobile ? '0 1px 6px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top: Image */}
      <div style={{
        width: '100%',
        height: typeof IMAGE_SIZE === 'string' ? IMAGE_SIZE : IMAGE_SIZE,
        background: '#e9ecef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #e3e6ea', // 1px for border
        overflow: 'hidden',
        padding: 0,
      }}>
        <img
          src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${picture.replace(/^\//, '')}` : defaultPicture}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0, border: 'none', transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'transform 220ms ease-out', willChange: 'transform' }}
        />
      </div>
      {/* Name & Creator */}
      <div className="px-2 pt-2 pb-1" style={{ minWidth: 0 }}>
        <h5 className="fw-bold text-dark text-truncate mb-0" style={{ fontSize: isMobile ? '0.82rem' : '0.92rem', maxWidth: isMobile ? '6.875rem' : '9.375rem', fontFamily: 'Inter, sans-serif' }}>{name}</h5> {/* 110px/150px */}
        <span className="text-muted small" style={{ fontSize: isMobile ? '0.62rem' : '0.68rem', fontFamily: 'Inter, sans-serif', fontWeight: 400, display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: isMobile ? '6.875rem' : '9.375rem' }}>
          <i className="bi bi-person-circle me-1"></i>
          {creatorDisplay ? creatorDisplay : <span style={{ opacity: 0.4 }}>Unknown</span>}
        </span>
      </div>
      {/* Description/Tagline/Intro */}
      <div className="px-2" style={{
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
      </div>
      {/* Stats */}
      <div className="d-flex align-items-center justify-content-between px-2 pb-1" style={{ minHeight: isMobile ? '0.875rem' : '1.125rem' }}> {/* 14px/18px */}
        <span className="d-flex align-items-center text-secondary" style={{ fontSize: isMobile ? '0.5625rem' : '0.625rem' }}> {/* 9px/10px */}
          <i className="bi bi-eye me-1"></i> {typeof views === 'number' ? views.toLocaleString() : 0} {t('entity_card.views')}
        </span>
        {(type === 'character' || type === 'scene' || type === 'persona') && (
          <span className="d-flex align-items-center text-secondary" style={{ fontSize: isMobile ? '0.5625rem' : '0.625rem' }}>
            <i className="bi bi-hand-thumbs-up me-1"></i> {typeof likes === 'number' ? likes.toLocaleString() : 0} {t('entity_card.likes')}
          </span>
        )}
      </div>
    </div>
  );
}
