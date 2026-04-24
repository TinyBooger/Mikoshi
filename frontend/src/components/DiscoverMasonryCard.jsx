import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

export default function DiscoverMasonryCard({ type, entity, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [isCreatorHovered, setIsCreatorHovered] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isAdvancedBadgeHovered, setIsAdvancedBadgeHovered] = useState(false);
  const [isDetailCtaActive, setIsDetailCtaActive] = useState(false);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  let description = '';
  if (type === 'character') {
    description = entity.tagline || '';
  } else if (type === 'scene') {
    description = entity.intro || '';
  } else if (type === 'persona') {
    description = entity.intro || '';
  }

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

  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name || t('entity_card.unknown');
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
  const isAdvancedCharacter = type === 'character' && entity?.context_label === 'advanced';

  const handleClick = () => {
    if (clickSuppressed) return;
    if (onClick) {
      onClick(entity);
      return;
    }
    if (type === 'character') {
      navigate(`/chat?character=${encodeURIComponent(id)}`);
      return;
    }
    if (type === 'scene') {
      navigate(`/chat?scene=${encodeURIComponent(id)}`);
    }
  };

  const handleViewDetail = (e) => {
    e.stopPropagation();
    navigate(`/${type}/${id}`);
  };

  const handleCreatorClick = (e) => {
    e.stopPropagation();
    if (!creator_id) return;
    navigate(`/profile/${encodeURIComponent(creator_id)}`);
  };

  const handleCardMouseMove = (e) => {
    if (isMobile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const maxTilt = 5;
    const tiltY = (px - 0.5) * maxTilt * 2;
    const tiltX = (0.5 - py) * maxTilt * 2;
    setCardTilt({ x: tiltX, y: tiltY });
  };

  return (
    <article
      style={{
        width: '100%',
        borderRadius: isMobile ? '16px' : '20px',
        border: '1px solid #e9ecef',
        background: '#f9fafb',
        boxShadow:
          isAdvancedCharacter && isCardHovered
            ? '0 0 0 1px rgba(215, 164, 59, 0.35), 0 8px 24px rgba(215, 164, 59, 0.22)'
            : '0 2px 10px rgba(0,0,0,0.08)',
        transform: isCardHovered && !isMobile
          ? `perspective(900px) rotateX(${cardTilt.x.toFixed(2)}deg) rotateY(${cardTilt.y.toFixed(2)}deg) translateY(-4px)`
          : 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transformStyle: 'preserve-3d',
        willChange: 'transform, box-shadow',
        cursor: clickSuppressed ? 'default' : 'pointer',
        overflow: 'hidden',
        breakInside: 'avoid',
        transition: 'transform 0.16s ease, box-shadow 0.2s ease',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
      onMouseEnter={() => !isMobile && setIsCardHovered(true)}
      onMouseMove={handleCardMouseMove}
      onMouseLeave={() => {
        setIsCardHovered(false);
        setIsAdvancedBadgeHovered(false);
        setCardTilt({ x: 0, y: 0 });
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          background: '#e9ecef',
          borderTopLeftRadius: isMobile ? '10px' : '12px',
          borderTopRightRadius: isMobile ? '10px' : '12px',
          overflow: 'hidden',
        }}
      >
        {primaryTag && (
          <span
            className="text-uppercase"
            title={primaryTag}
            style={{
              position: 'absolute',
              top: isMobile ? 6 : 8,
              left: isMobile ? 6 : 8,
              zIndex: 2,
              maxWidth: isMobile ? '62%' : '56%',
              padding: isMobile ? '0.22rem 0.48rem' : '0.24rem 0.55rem',
              borderRadius: '999px',
              fontSize: isMobile ? '0.52rem' : '0.56rem',
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
                width: isMobile ? '0.3rem' : '0.34rem',
                height: isMobile ? '0.3rem' : '0.34rem',
                borderRadius: '999px',
                background: tagAccent,
                flexShrink: 0,
              }}
            />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{primaryTag}</span>
          </span>
        )}
        <div style={{ position: 'absolute', top: isMobile ? 5 : 6, right: isMobile ? 5 : 6, display: 'flex', gap: isMobile ? 3 : 4, zIndex: 2 }}>
          {isAdvancedCharacter && (
            <div
              style={{ position: 'relative', display: 'inline-flex' }}
              onMouseEnter={() => setIsAdvancedBadgeHovered(true)}
              onMouseLeave={() => setIsAdvancedBadgeHovered(false)}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #F8E39A 0%, #E1B755 45%, #C88A1B 100%)',
                  color: '#4A3210',
                  fontSize: isMobile ? '0.54rem' : '0.58rem',
                  padding: isMobile ? '2px 5px' : '2px 6px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  lineHeight: 1,
                  border: '1px solid rgba(255, 245, 203, 0.9)',
                  letterSpacing: '0.3px',
                  boxShadow: '0 1px 5px rgba(146, 98, 19, 0.35)',
                }}
              >
                万字
              </span>
              {isAdvancedBadgeHovered && (
                <span
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    whiteSpace: 'nowrap',
                    background: 'rgba(35, 27, 10, 0.95)',
                    color: '#F7E6B5',
                    fontSize: '0.64rem',
                    lineHeight: 1.2,
                    padding: '0.28rem 0.45rem',
                    borderRadius: '0.35rem',
                    border: '1px solid rgba(248, 227, 154, 0.4)',
                    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
                    pointerEvents: 'none',
                  }}
                >
                  该角色有着更丰富的细节
                </span>
              )}
            </div>
          )}
          {is_public === false && (
            <span
              title={t('entity_card.private') || 'Private'}
              style={{
                background: 'rgba(107, 114, 128, 0.9)',
                color: '#fff',
                fontSize: isMobile ? '0.5rem' : '0.55rem',
                padding: isMobile ? '2px 5px' : '2px 6px',
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
                fontSize: isMobile ? '0.5rem' : '0.55rem',
                padding: isMobile ? '2px 5px' : '2px 6px',
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
          src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(picture).replace(/^\//, '')}` : defaultPicture}
          alt={name}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </div>

      <div style={{ padding: isMobile ? '0.56rem 0.58rem 0.68rem' : '0.65rem 0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: isMobile ? '0.3rem' : '0.35rem' }}>
        <div className="d-flex align-items-start justify-content-between" style={{ gap: isMobile ? '0.4rem' : '0.5rem' }}>
          <h5
            className="fw-bold mb-0"
            style={{
              fontSize: isMobile ? '0.96rem' : '1.05rem',
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

        <p
          className="mb-0"
          style={{
            fontSize: isMobile ? '0.7rem' : '0.76rem',
            lineHeight: 1.18,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            color: '#a0a0a0',
          }}
        >
          {description || t('entity_card.no_description')}
        </p>

        <div className="d-flex align-items-center justify-content-between" style={{ fontSize: isMobile ? '0.63rem' : '0.68rem', color: '#6c757d', gap: isMobile ? '0.4rem' : '0.5rem', lineHeight: 1.4 }}>
          <div
            className="d-flex align-items-center"
            style={{
              gap: isMobile ? '0.3rem' : '0.35rem',
              minWidth: 0,
              cursor: creator_id ? 'pointer' : 'default',
              padding: isMobile ? '0.1rem 0.24rem' : '0.12rem 0.3rem',
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
                width: isMobile ? '16px' : '18px',
                height: isMobile ? '16px' : '18px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                border: '1px solid #e5e7eb',
              }}
            />
            <span
              style={{
                fontSize: isMobile ? '0.69rem' : '0.74rem',
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

          <div className="d-flex align-items-center ms-auto" style={{ gap: isMobile ? '0.55rem' : '0.7rem', flexShrink: 0 }}>
            <span className="d-flex align-items-center" style={{ gap: '0.2rem', opacity: typeof likes === 'number' && likes === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
              <i className="bi bi-heart" style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 300 }}></i>
              {typeof likes === 'number' ? likes.toLocaleString() : 0}
            </span>
            <span className="d-flex align-items-center" style={{ gap: '0.2rem', opacity: typeof views === 'number' && views === 0 ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
              <i
                className={
                  type === 'character' && typeof views === 'number' && views > 100
                    ? 'bi bi-fire text-danger'
                    : 'bi bi-chat'
                }
                style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', fontWeight: 300 }}
              ></i>
              {typeof views === 'number' ? views.toLocaleString() : 0}
            </span>
          </div>
        </div>

        {is_forkable && (
          <button
            onClick={handleViewDetail}
            onMouseEnter={() => setIsDetailCtaActive(true)}
            onMouseLeave={() => setIsDetailCtaActive(false)}
            onFocus={() => setIsDetailCtaActive(true)}
            onBlur={() => setIsDetailCtaActive(false)}
            className="w-100 btn btn-sm"
            style={{
              fontSize: isMobile ? '0.64rem' : '0.68rem',
              padding: isMobile ? '0.25rem 0.45rem' : '0.28rem 0.5rem',
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
    </article>
  );
}
