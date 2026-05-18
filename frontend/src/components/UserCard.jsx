import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import EntityCard from './EntityCard';
import { AuthContext } from './AuthProvider';

/**
 * UserCard - Display a user profile as a list item
 * Props:
 *  - user: { id, name, profile_pic, bio, views, likes }
 *  - onClick?: (user) => void
 *  - disableClick?: boolean
 */
export default function UserCard({ user, onClick, disableClick = false, isFollowing: isFollowingProp, onFollowChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userData, sessionToken } = useContext(AuthContext);

  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isFollowing, setIsFollowing] = useState(isFollowingProp ?? false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    id,
    name,
    profile_pic,
    bio,
    views = 0,
    likes = 0,
    characters_created = 0,
    recent_content = [],
  } = user;

  const clickSuppressed = disableClick;
  const displayedRecentContent = Array.isArray(recent_content)
    ? recent_content.slice(0, 8)
    : [];

  const handleEntityClick = (item) => {
    if (item.type === 'character') navigate(`/chat?character=${encodeURIComponent(item.id)}`);
    else if (item.type === 'scene') navigate(`/chat?scene=${encodeURIComponent(item.id)}`);
    else if (item.type === 'persona') navigate(`/persona/${encodeURIComponent(item.id)}`);
  };

  const isSelf = userData && userData.id === id;
  const canFollow = sessionToken && !isSelf;

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!canFollow || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${window.API_BASE_URL}/api/users/${id}/follow`, {
        method,
        headers: { Authorization: sessionToken },
      });
      if (res.ok) {
        const nowFollowing = !isFollowing;
        setIsFollowing(nowFollowing);
        if (onFollowChange) onFollowChange(nowFollowing);
      }
    } catch {
      // silently ignore
    } finally {
      setFollowLoading(false);
    }
  };

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
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <div style={{ flexShrink: 0 }}>
          <img
            src={
              profile_pic
                ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(profile_pic).replace(/^\//, '')}`
                : defaultPicture
            }
            alt={name}
            style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }}
          />
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
            {bio || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('user_card.no_bio')}</span>}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.chats')}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
              {typeof views === 'number' ? views.toLocaleString() : 0}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.likes')}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
              {typeof likes === 'number' ? likes.toLocaleString() : 0}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{t('user_card.characters_created')}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#232323' }}>
              {typeof characters_created === 'number' ? characters_created.toLocaleString() : 0}
            </div>
          </div>
          {canFollow && (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              style={{
                padding: '0.28rem 0.9rem',
                fontSize: '0.78rem',
                fontWeight: 500,
                borderRadius: '999px',
                border: 'none',
                background: isFollowing
                  ? 'rgba(200,193,225,0.18)'
                  : 'rgba(200,193,225,0.55)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                color: isFollowing ? '#a09abf' : '#736B92',
                cursor: followLoading ? 'default' : 'pointer',
                opacity: followLoading ? 0.5 : 1,
                transition: 'background 0.18s ease, color 0.18s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (followLoading) return;
                e.currentTarget.style.background = isFollowing
                  ? 'rgba(200,193,225,0.32)'
                  : 'rgba(200,193,225,0.78)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isFollowing
                  ? 'rgba(200,193,225,0.18)'
                  : 'rgba(200,193,225,0.55)';
              }}
            >
              {isFollowing ? t('user_card.unfollow') : t('user_card.follow')}
            </button>
          )}
        </div>
      </div>

      {displayedRecentContent.length > 0 && (
        <div style={{ marginTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.35rem', fontWeight: 600 }}>
            {t('user_card.recent_characters')}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.55rem',
              overflowX: 'auto',
              paddingBottom: '0.25rem',
              scrollbarWidth: 'thin',
            }}
          >
            {displayedRecentContent.map((item) => (
              <div key={`${item.type}-${item.id}`} style={{ width: isMobile ? 140 : 180, minWidth: isMobile ? 140 : 180, flexShrink: 0 }}>
                <EntityCard
                  type={item.type}
                  entity={{ ...item, creator_name: item.creator_name || name }}
                  onClick={() => handleEntityClick(item)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}