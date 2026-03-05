import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';

export default function DiscoverMasonryCard({ type, entity, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    id,
    name,
    picture,
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
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    const h = Math.abs(hash) % 360;
    return hslToHex(h, 65, 46);
  };

  let tagColor;
  let tagBg;
  let tagBorder;
  if (primaryTag) {
    const key = normalizeTag(primaryTag);
    const base = tagPalette[key] || stringToColor(key);
    tagColor = base;
    tagBg = `${base}18`;
    tagBorder = `${base}40`;
  }

  let creatorDisplay = t('entity_card.unknown');
  if (creator_name) {
    creatorDisplay = typeof creator_name === 'object' ? creator_name.name : creator_name;
  } else if (entity.creator_name) {
    creatorDisplay = entity.creator_name || t('entity_card.unknown');
  }

  const suppressPersonaNavigation = type === 'persona' && !onClick;
  const clickSuppressed = disableClick || suppressPersonaNavigation;

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

  return (
    <article
      style={{
        width: '100%',
        maxHeight: 520,
        borderRadius: '12px',
        border: '1px solid #e9ecef',
        background: '#f9fafb',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        cursor: clickSuppressed ? 'default' : 'pointer',
        overflow: 'hidden',
        breakInside: 'avoid',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          background: '#e9ecef',
        }}
      >
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
          src={picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(picture).replace(/^\//, '')}` : defaultPicture}
          alt={name}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      </div>

      <div style={{ padding: '0.65rem 0.7rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div className="d-flex align-items-start justify-content-between" style={{ gap: '0.5rem' }}>
          <h5
            className="fw-bold mb-0"
            style={{
              fontSize: '0.95rem',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '2.35rem',
            }}
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
                fontSize: '0.56rem',
                padding: '0.2rem 0.36rem',
                letterSpacing: 0.2,
                fontWeight: 500,
                maxWidth: '45%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {primaryTag}
            </span>
          )}
        </div>

        <div
          className="text-muted"
          style={{
            fontSize: '0.76rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={creatorDisplay}
        >
          <i className="bi bi-person-circle me-1"></i>
          {creatorDisplay}
        </div>

        <p
          className="mb-0 text-secondary"
          style={{
            fontSize: '0.76rem',
            lineHeight: 1.28,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            minHeight: '3.9rem',
            maxHeight: '3.9rem',
          }}
        >
          {description || t('entity_card.no_description')}
        </p>

        <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '0.68rem', color: '#6c757d' }}>
          <div className="d-flex align-items-center" style={{ gap: '0.7rem' }}>
            <span className="d-flex align-items-center" style={{ gap: '0.25rem' }}>
              <i className="bi bi-chat"></i>
              {typeof views === 'number' ? views.toLocaleString() : 0}
            </span>
            <span className="d-flex align-items-center" style={{ gap: '0.25rem' }}>
              <i className="bi bi-heart"></i>
              {typeof likes === 'number' ? likes.toLocaleString() : 0}
            </span>
          </div>
        </div>

        {is_forkable && (
          <button
            onClick={handleViewDetail}
            className="w-100 btn btn-sm"
            style={{
              fontSize: '0.68rem',
              padding: '0.28rem 0.5rem',
              background: '#736B92',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 500,
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
