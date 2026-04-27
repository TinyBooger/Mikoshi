import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import EntityCard from './EntityCard';

/**
 * UserCard - Display a user profile as a list item
 * Props:
 *  - user: { id, name, profile_pic, bio, views, likes }
 *  - onClick?: (user) => void
 *  - disableClick?: boolean
 */
export default function UserCard({ user, onClick, disableClick = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [hovered, setHovered] = useState(false);

  const {
    id,
    name,
    profile_pic,
    bio,
    views = 0,
    likes = 0,
    characters_created = 0,
    recent_characters = [],
  } = user;

  const clickSuppressed = disableClick;
  const displayedRecentCharacters = Array.isArray(recent_characters)
    ? recent_characters.slice(0, 10)
    : [];

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
        </div>
      </div>

      {displayedRecentCharacters.length > 0 && (
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
            {displayedRecentCharacters.map((character) => {
              return (
                <div key={character.id} style={{ width: 180, minWidth: 180, flexShrink: 0 }}>
                  <EntityCard
                    type="character"
                    entity={{
                      ...character,
                      creator_name: character?.creator_name || name,
                    }}
                    onClick={() => navigate(`/chat?character=${encodeURIComponent(character.id)}`)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}