import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import defaultPic from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

export default function InfoCard({
  character,
  scene,
  persona,
  creatorHover,
  setCreatorHover,
  onCreatorClick,
  chatCount,
  hasLiked,
  onLike,
  showFullTagline,
  setShowFullTagline,
  onLeft,
  onRight,
  showLeft = true,
  showRight = true,
  leftLabel = 'Scene',
  rightLabel = 'Persona',
  isPlaceholder = false
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userData, sessionToken } = useContext(AuthContext);
  // Pick the first non-null entity, prioritizing scene over character
  const entity = scene || character || {};
  // Determine entity type for field mapping (mutually exclusive: scene > character)
  const entityType = scene ? 'scene' : character ? 'character' : null;
  const resolvedAvatar = entity.picture;
  const resolvedName = entity.name;
  const resolvedCreatorName = entity.creator_name;
  const resolvedCreatorId = entity.creator_id;
  const creatorAvatarRaw =
    entity.creator_profile_pic ||
    entity.creator_avatar ||
    entity.creator_avatar_picture ||
    (typeof entity.creator_name === 'object'
      ? entity.creator_name?.profile_pic || entity.creator_name?.avatar || entity.creator_name?.avatar_picture
      : null);
  const creatorAvatar = creatorAvatarRaw
    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(creatorAvatarRaw).replace(/^\//, '')}`
    : defaultAvatar;
  // For chatCount/views: all have 'views', fallback to chatCount prop
  const resolvedChatCount = typeof entity.views === 'number' ? entity.views : chatCount;
  const resolvedTags = entity.tags || [];
  // Tagline: 'tagline' for character, 'intro' for scene
  let resolvedTagline = '';
  if (entityType === 'character') {
    resolvedTagline = entity.tagline || '';
  } else if (entityType === 'scene') {
    resolvedTagline = entity.intro || '';
  }
  // Likes: read directly from entity.likes, but manage local state for instant UI update
  const initialLikeCount = typeof entity.likes === 'number' ? entity.likes : 0;
  const [likeCount, setLikeCount] = React.useState(initialLikeCount);
  // Track previous entity id to reset likeCount if entity changes
  React.useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, entity.id]);

  // Follow state
  const isSelf = userData && userData.id === resolvedCreatorId;
  const canFollow = sessionToken && !isSelf && resolvedCreatorId;
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [followLoading, setFollowLoading] = React.useState(false);
  React.useEffect(() => {
    if (!canFollow) return;
    fetch(`${window.API_BASE_URL}/api/users/me/following-ids`, {
      headers: { Authorization: sessionToken },
    })
      .then(res => res.json())
      .then(data => setIsFollowing((data.following_ids || []).includes(resolvedCreatorId)))
      .catch(() => {});
  }, [canFollow, resolvedCreatorId, sessionToken]);

  const handleFollowToggle = async (e) => {
    e.stopPropagation();
    if (!canFollow || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${window.API_BASE_URL}/api/users/${resolvedCreatorId}/follow`, {
        method,
        headers: { Authorization: sessionToken },
      });
      if (res.ok) setIsFollowing(f => !f);
    } catch { /* ignore */ } finally {
      setFollowLoading(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: '1.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={resolvedAvatar ? `${window.API_BASE_URL.replace(/\/$/, '')}/${resolvedAvatar.replace(/^\//, '')}` : defaultPic}
            alt="Avatar"
            style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: '50%', border: '2.4px solid #e9ecef', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginRight: 14 }}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontWeight: 700, color: '#18191a', fontSize: '1.02rem', letterSpacing: '0.2px', marginBottom: 2, wordBreak: 'break-word', lineHeight: 1.2 }}>
              {isPlaceholder ? <span style={{ color: '#bbb', fontStyle: 'italic' }}>{t('info_card.no_selection', { name: resolvedName })}</span> : resolvedName}
            </div>
            <div
              className="d-flex align-items-center"
              style={{
                gap: '0.35rem',
                width: 'fit-content',
                cursor: resolvedCreatorId ? 'pointer' : 'default',
                padding: '0.18rem 0.55rem 0.18rem 0.3rem',
                borderRadius: '999px',
                color: creatorHover ? '#5f4f8a' : '#6c757d',
                background: creatorHover ? 'rgba(115, 107, 146, 0.12)' : 'transparent',
                transition: 'background-color 0.16s ease, color 0.16s ease',
                marginBottom: 2,
              }}
              title={resolvedCreatorName || t('entity_card.unknown')}
              onClick={onCreatorClick}
              onMouseEnter={() => setCreatorHover && setCreatorHover(true)}
              onMouseLeave={() => setCreatorHover && setCreatorHover(false)}
            >
              <img
                src={creatorAvatar}
                alt={resolvedCreatorName || ''}
                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }}
              />
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: creatorHover ? 'underline' : 'none',
                }}
              >
                {resolvedCreatorName || t('entity_card.unknown')}
              </span>
            </div>
            {typeof resolvedChatCount === 'number' && (
              <div style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <i className="bi bi-chat me-1"></i> {resolvedChatCount} chats
              </div>
            )}
            {onLike && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 2 }}>
                <button
                  onClick={() => {
                    // If already liked, unlike and decrement; else like and increment
                    if (hasLiked && hasLiked[entityType]) {
                      setLikeCount(c => Math.max(0, c - 1));
                    } else {
                      setLikeCount(c => c + 1);
                    }
                    onLike();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    opacity: 1,
                    padding: '0.1rem 0.2rem',
                    fontSize: '1.05rem',
                    minHeight: 0,
                    minWidth: 0,
                    boxShadow: 'none',
                    marginLeft: 0
                  }}
                >
                  <i className={`bi ${(hasLiked && hasLiked[entityType]) ? 'bi-heart-fill' : 'bi-heart'}`} style={{ fontSize: 18, color: '#e53935', verticalAlign: 'middle' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '0.78rem', marginLeft: 2 }}>{likeCount}</span>
                </button>
              </div>
            )}
            {canFollow && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginTop: 2 }}>
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  style={{
                    padding: '0.22rem 0.8rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    borderRadius: '999px',
                    border: 'none',
                    background: isFollowing ? 'rgba(200,193,225,0.18)' : 'rgba(200,193,225,0.55)',
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
                    e.currentTarget.style.background = isFollowing ? 'rgba(200,193,225,0.32)' : 'rgba(200,193,225,0.78)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isFollowing ? 'rgba(200,193,225,0.18)' : 'rgba(200,193,225,0.55)';
                  }}
                >
                  {isFollowing ? t('user_card.unfollow') : t('user_card.follow')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {resolvedTagline && (
        <div style={{ textAlign: 'center', color: '#888', marginBottom: 19, fontStyle: 'italic', fontSize: '0.86rem', position: 'relative' }}>
          {resolvedTagline.length > 80 && setShowFullTagline ? (
            <>
              <span>
                "{showFullTagline ? resolvedTagline : resolvedTagline.slice(0, 80) + '...'}"
              </span>
              <br />
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  marginTop: 2,
                  padding: 0,
                  textDecoration: 'underline',
                }}
                onClick={() => setShowFullTagline(v => !v)}
              >
                {showFullTagline ? t('info_card.show_less') : t('info_card.show_more')}
              </button>
            </>
          ) : (
            <>"{resolvedTagline}"</>
          )}
        </div>
      )}
      {resolvedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
              {resolvedTags.map((tag, i) => (
            <button
              key={i}
              onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
              className="btn"
              aria-label={`Search tag ${tag}`}
              style={{
                background: '#f5f6fa',
                color: '#232323',
                border: '1px solid #e9ecef',
                borderRadius: '1rem',
                fontWeight: 500,
                fontSize: '0.68rem',
                padding: '0.12rem 0.6rem',
                marginBottom: 1,
                lineHeight: 1.2,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
