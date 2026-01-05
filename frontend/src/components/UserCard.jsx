import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import AvatarFrame from './AvatarFrame';

/**
 * UserCard - Display a user profile as a list item
 * Props:
 *  - user: { id, name, profile_pic, bio, level, exp, views, likes, badges, active_badge }
 *  - onClick?: (user) => void
 *  - disableClick?: boolean
 */
export default function UserCard({ user, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(false);
  const [badgeHovered, setBadgeHovered] = useState(null);

  const { id, name, profile_pic, bio, level = 1, views = 0, likes = 0, characters_created = 0, badges = {}, active_badge = null } = user;

  const clickSuppressed = disableClick;

  const handleClick = () => {
    if (clickSuppressed) return;
    if (onClick) return onClick(user);
    navigate(`/profile/${id}`);
  };

  return (
    <div
      className="user-list-item"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '0.5rem',
        cursor: clickSuppressed ? 'default' : 'pointer',
        transition: 'background 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
        marginBottom: '0.75rem',
      }}
      onClick={clickSuppressed ? undefined : handleClick}
      onMouseEnter={() => !clickSuppressed && setHovered(true)}
      onMouseLeave={() => !clickSuppressed && setHovered(false)}
    >
      {/* Avatar with optional badge frame */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <AvatarFrame badge={active_badge} size={50}>
          <img
            src={
              profile_pic
                ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(profile_pic).replace(/^\//, '')}`
                : defaultPicture
            }
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AvatarFrame>
        {/* Level Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            zIndex: 2,
            background: '#736B92',
            color: '#fff',
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 700,
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          Lv{level}
        </div>
      </div>

      {/* User Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h6
          className="mb-1 text-truncate"
          style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#232323',
            margin: 0,
          }}
          title={name}
        >
          {name}
        </h6>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#666',
            margin: '0.25rem 0 0.5rem 0',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {bio || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('user_card.no_bio', 'No bio yet')}</span>}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.chats', 'Chats')}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
            {typeof views === 'number' ? views.toLocaleString() : 0}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.likes', 'Likes')}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
            {typeof likes === 'number' ? likes.toLocaleString() : 0}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.characters_created', 'Characters')}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
            {typeof characters_created === 'number' ? characters_created.toLocaleString() : 0}
          </div>
        </div>
      </div>
    </div>
  );
}
// Helper function to get badge color
function getBadgeColor(badgeKey) {
  const colors = {
    pioneer: '#FF6B6B',        // Red for Pioneer
    bronze_creator: '#CD7F32',  // Bronze
    silver_creator: '#C0C0C0',  // Silver
    gold_creator: '#FFD700',    // Gold
  };
  return colors[badgeKey] || '#999';
}

// Helper function to get badge emoji/symbol
function getBadgeEmoji(badgeKey) {
  const emojis = {
    pioneer: '⭐',
    bronze_creator: '1K+',
    silver_creator: '🥈',
    gold_creator: '🥇',
  };
  return emojis[badgeKey] || '✓';
}