import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import defaultPic from '../assets/images/default-picture.png';

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
  // Pick the first non-null entity
  const entity = character || scene || persona || {};
  // Determine entity type for field mapping
  const entityType = character ? 'character' : scene ? 'scene' : persona ? 'persona' : null;
  const resolvedAvatar = entity.picture;
  const resolvedName = entity.name;
  const resolvedCreatorName = entity.creator_name;
  const resolvedCreatorId = entity.creator_id;
  // For chatCount/views: all have 'views', fallback to chatCount prop
  const resolvedChatCount = typeof entity.views === 'number' ? entity.views : chatCount;
  const resolvedTags = entity.tags || [];
  const navigate = useNavigate();
  // Tagline: 'tagline' for character, 'intro' for scene/persona
  let resolvedTagline = '';
  if (entityType === 'character') {
    resolvedTagline = entity.tagline || '';
  } else if (entityType === 'scene' || entityType === 'persona') {
    resolvedTagline = entity.intro || '';
  }
  // Likes: read directly from entity.likes, but manage local state for instant UI update
  const initialLikeCount = typeof entity.likes === 'number' ? entity.likes : 0;
  const [likeCount, setLikeCount] = React.useState(initialLikeCount);
  // Track previous entity id to reset likeCount if entity changes
  React.useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount, entity.id]);

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
            <div style={{ color: '#888', fontSize: 13, marginBottom: 2, display: 'flex', alignItems: 'center' }}>
              <i className="bi bi-person-fill me-1"></i>
              <span
                style={{
                  color: creatorHover ? '#444' : '#888',
                  fontWeight: 400,
                  marginLeft: 6,
                  cursor: 'pointer',
                  textDecoration: creatorHover ? 'underline' : 'none',
                  textUnderlineOffset: creatorHover ? 2 : undefined,
                  transition: 'color 0.15s, textDecoration 0.15s'
                }}
                onClick={onCreatorClick}
                onMouseEnter={() => setCreatorHover && setCreatorHover(true)}
                onMouseLeave={() => setCreatorHover && setCreatorHover(false)}
              >
                {resolvedCreatorName || t('entity_card.unknown')}
              </span>
            </div>
            {typeof resolvedChatCount === 'number' && (
              <div style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <i className="bi bi-chat-square-text me-1"></i> {resolvedChatCount} chats
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
