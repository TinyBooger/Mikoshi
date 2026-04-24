import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

/**
 * EntityCard - Unified card for Character, Scene, Persona
 * @param {Object} props
 * @param {'character'|'scene'|'persona'} props.type
 * @param {Object} props.entity
 * @param {Function} [props.onClick] Optional click handler
 * @param {boolean} [props.disableClick] Optional flag to disable click behavior
 * @param {boolean} [props.compact] Optional flag for compact horizontal layout
 * @param {'default'|'mini'} [props.size] Optional visual size variant
 */
export default function EntityCard({ type, entity, onClick, disableClick = false, compact = false, size = 'default' }) {
  const { t } = useTranslation();
  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [hovered, setHovered] = useState(false);
  const [isCreatorHovered, setIsCreatorHovered] = useState(false);
  const [isDetailCtaActive, setIsDetailCtaActive] = useState(false);
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
    creator_id,
    creator_name,
    views,
    likes,
    is_public,
    is_forkable,
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

  const getTagAccentColor = (label) => {
    const source = String(label || 'tag');
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = source.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    let hue = Math.abs(hash) % 360;
    if (hue >= 250 && hue <= 310) {
      hue = (hue + 90) % 360;
    }
    return `hsl(${hue}, 72%, 44%)`;
  };

  const tagAccent = getTagAccentColor(primaryTag);

  // Card sizes
  // On mobile, use 4:5 aspect ratio for card (height = width * 1.25)
  const CARD_WIDTH = compact ? '100%' : (isMobile ? '100%' : (size === 'mini' ? '8.25rem' : '11.25rem'));
  const CARD_ASPECT_RATIO = 1.25; // 4:5
  const CARD_HEIGHT = size === 'mini'
    ? (isMobile ? '9.2rem' : '10.5rem')
    : compact
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

  const creatorAvatarRaw =
    entity.creator_profile_pic ||
    entity.creator_avatar ||
    entity.creator_avatar_picture ||
    (typeof creator_name === 'object'
      ? creator_name.profile_pic || creator_name.avatar || creator_name.avatar_picture
      : null);

  const creatorAvatar = creatorAvatarRaw
    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(creatorAvatarRaw).replace(/^\//, '')}`
    : defaultAvatar;

  const suppressPersonaNavigation = type === 'persona' && !onClick;
  const clickSuppressed = disableClick || suppressPersonaNavigation;

  // Card click logic
  const handleClick = async () => {
    if (clickSuppressed) return;
    if (onClick) {
      onClick(entity);
    } else if (type === 'character') {
      navigate(`/chat?character=${encodeURIComponent(id)}`);
      return;
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

  const handleCreatorClick = (e) => {
    e.stopPropagation();
    if (!creator_id) return;
    navigate(`/profile/${encodeURIComponent(creator_id)}`);
  };

  return (
    <div
      className={compact && isMobile ? "d-flex flex-row position-relative" : "d-flex flex-column position-relative"}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: '#f9fafb',
        borderRadius: '20px',
        boxShadow: hovered ? '0 6px 18px rgba(0,0,0,0.13)' : '0 2px 10px rgba(0,0,0,0.08)',
        border: '1px solid #e9ecef',
        overflow: 'hidden',
        transition: 'box-shadow 0.16s ease, transform 0.16s ease',
        cursor: clickSuppressed ? 'default' : 'pointer',
        pointerEvents: disableClick ? 'none' : 'auto',
        margin: 0,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: compact && isMobile ? 'row' : 'column',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
      onMouseEnter={clickSuppressed ? undefined : () => setHovered(true)}
      onMouseLeave={clickSuppressed ? undefined : () => setHovered(false)}
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
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}
      >
        {primaryTag && (
          <span
            className="text-uppercase"
            title={primaryTag}
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              maxWidth: '56%',
              padding: '0.24rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.56rem',
              fontWeight: 600,
              letterSpacing: 0.25,
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#4b416a',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.92)',
              boxShadow: `inset 2px 0 0 ${tagAccent}, 0 4px 12px rgba(0, 0, 0, 0.12)`,
              textShadow: 'none',
            }}
          >
            <span
              style={{
                width: '0.34rem',
                height: '0.34rem',
                borderRadius: '999px',
                background: tagAccent,
                flexShrink: 0,
              }}
            />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{primaryTag}</span>
          </span>
        )}
        {/* Status badges in top-right corner */}
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, zIndex: 2 }}>
          {is_public === false && (
            <span
              title={t('entity_card.private') || 'Private'}
              style={{
                background: 'rgba(107, 114, 128, 0.9)',
                color: '#fff',
                fontSize: '0.55rem',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                lineHeight: 1,
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
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              <i className="bi bi-diagram-3-fill" style={{ fontSize: '0.5rem' }}></i>
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
      {/* Content Area */}
      {!(compact && isMobile) && (
        <div style={{ padding: '0.65rem 0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div className="d-flex align-items-start justify-content-between" style={{ gap: '0.5rem' }}>
            <h5
              className="fw-bold mb-0"
              style={{
                fontSize: '1.05rem',
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: '#000000',
              }}
              title={name}
            >
              {name}
            </h5>
          </div>

          {size !== 'mini' && (
            <p
              className="mb-0"
              style={{
                fontSize: '0.76rem',
                lineHeight: 1.18,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                color: '#a0a0a0',
              }}
            >
              {description || t('entity_card.no_description')}
            </p>
          )}

          <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '0.68rem', color: '#6c757d', gap: '0.5rem', lineHeight: 1.4 }}>
            <div
              className="d-flex align-items-center"
              style={{
                gap: '0.35rem',
                minWidth: 0,
                cursor: creator_id ? 'pointer' : 'default',
                padding: '0.12rem 0.3rem',
                borderRadius: '999px',
                color: creator_id && isCreatorHovered ? '#5f4f8a' : '#6c757d',
                background: creator_id && isCreatorHovered ? 'rgba(115, 107, 146, 0.12)' : 'transparent',
                transition: 'background-color 0.16s ease, color 0.16s ease',
              }}
              title={creatorDisplay}
              onClick={creator_id ? handleCreatorClick : undefined}
              onMouseEnter={() => creator_id && setIsCreatorHovered(true)}
              onMouseLeave={() => setIsCreatorHovered(false)}
            >
              <img
                src={creatorAvatar}
                alt={creatorDisplay}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: '1px solid #e5e7eb',
                }}
              />
              <span
                style={{
                  fontSize: '0.74rem',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: creator_id && isCreatorHovered ? 'underline' : 'none',
                }}
              >
                {creatorDisplay}
              </span>
            </div>

            <div className="d-flex align-items-center ms-auto" style={{ gap: '0.7rem', flexShrink: 0 }}>
              <span className="d-flex align-items-center" style={{ gap: '0.25rem', opacity: typeof likes === 'number' && likes === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
                <i className="bi bi-heart" style={{ fontSize: '0.65rem', fontWeight: 300 }}></i>
                {typeof likes === 'number' ? likes.toLocaleString() : 0}
              </span>
              <span className="d-flex align-items-center" style={{ gap: '0.25rem', opacity: typeof views === 'number' && views === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
                <i className="bi bi-chat" style={{ fontSize: '0.65rem', fontWeight: 300 }}></i>
                {typeof views === 'number' ? views.toLocaleString() : 0}
              </span>
            </div>
          </div>

          {is_forkable && size !== 'mini' && (
          <button
            onClick={handleViewDetail}
            onMouseEnter={() => setIsDetailCtaActive(true)}
            onMouseLeave={() => setIsDetailCtaActive(false)}
            onFocus={() => setIsDetailCtaActive(true)}
            onBlur={() => setIsDetailCtaActive(false)}
            className="w-100 btn btn-sm"
            style={{
              fontSize: '0.68rem',
              padding: '0.28rem 0.5rem',
              background: isDetailCtaActive ? 'rgba(115, 107, 146, 0.16)' : 'rgba(115, 107, 146, 0.08)',
              color: isDetailCtaActive ? '#584a82' : '#6b5f93',
              border: isDetailCtaActive ? '1px solid rgba(115, 107, 146, 0.9)' : '1px solid rgba(115, 107, 146, 0.55)',
              borderRadius: '0.375rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: isDetailCtaActive ? '0 0 0 3px rgba(115, 107, 146, 0.2)' : 'none',
              transform: isDetailCtaActive ? 'translateY(-1px)' : 'translateY(0)',
              transition: 'background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
            }}
          >
            <i className="bi bi-info-circle me-1"></i>
            {t('entity_card.view_detail')}
          </button>
          )}
        </div>
      )}

      {compact && isMobile && (
        <div
          className="d-flex flex-column justify-content-center"
          style={{
            minWidth: 0,
            flex: 1,
            padding: '0.55rem 0.6rem',
            gap: '0.3rem',
          }}
        >
          <h5
            className="fw-bold mb-0"
            style={{
              fontSize: '0.92rem',
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#000000',
            }}
            title={name}
          >
            {name}
          </h5>

          {size !== 'mini' && (
            <p
              className="mb-0"
              style={{
                fontSize: '0.7rem',
                lineHeight: 1.18,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#a0a0a0',
              }}
            >
              {description || t('entity_card.no_description')}
            </p>
          )}

          <div className="d-flex align-items-center ms-auto" style={{ gap: '0.7rem', flexShrink: 0, fontSize: '0.68rem', color: '#6c757d' }}>
            <span className="d-flex align-items-center" style={{ gap: '0.25rem', opacity: typeof likes === 'number' && likes === 0 ? 0.5 : 1 }}>
              <i className="bi bi-heart" style={{ fontSize: '0.65rem', fontWeight: 300 }}></i>
              {typeof likes === 'number' ? likes.toLocaleString() : 0}
            </span>
            <span className="d-flex align-items-center" style={{ gap: '0.25rem', opacity: typeof views === 'number' && views === 0 ? 0.5 : 1 }}>
              <i className="bi bi-chat" style={{ fontSize: '0.65rem', fontWeight: 300 }}></i>
              {typeof views === 'number' ? views.toLocaleString() : 0}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
