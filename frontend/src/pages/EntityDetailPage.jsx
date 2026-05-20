import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import ProblemReportModal from '../components/ProblemReportModal';
import defaultPicture from '../assets/images/default-picture.png';
import defaultAvatar from '../assets/images/default-avatar.png';

export default function EntityDetailPage() {
  const { t } = useTranslation();
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { sessionToken, userData } = useContext(AuthContext);
  const toast = useToast();
  const isProUser = !!userData?.is_pro;
  const canFork = isProUser;
  
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isCreatorHovered, setIsCreatorHovered] = useState(false);
  const [isForkableBadgeHovered, setIsForkableBadgeHovered] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showProblemReport, setShowProblemReport] = useState(false);
  const [reportIconHovered, setReportIconHovered] = useState(false);
  const [contentAppeals, setContentAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [showAppealHistory, setShowAppealHistory] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Validate type
  const validTypes = ['character', 'persona', 'scene'];
  if (!validTypes.includes(type)) {
    navigate('/');
    return null;
  }

  // Fetch entity data
  useEffect(() => {
    if (!sessionToken || !id) {
      navigate('/');
      return;
    }

    setLoading(true);
    let endpoint = '';
    if (type === 'character') {
      endpoint = `${window.API_BASE_URL}/api/character/${id}`;
    } else if (type === 'persona') {
      endpoint = `${window.API_BASE_URL}/api/personas/${id}`;
    } else if (type === 'scene') {
      endpoint = `${window.API_BASE_URL}/api/scenes/${id}`;
    }

    fetch(endpoint, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch entity');
        }
        return res.json();
      })
      .then(data => {
        setEntity(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.show(t('entity_detail.fetch_error'), { type: 'error' });
        navigate('/');
      });
  }, [type, id, sessionToken, navigate]);

  // Check if user has liked this entity
  useEffect(() => {
    if (!entity || !sessionToken) return;

    const params = new URLSearchParams();
    if (type === 'character') {
      params.append('character_id', String(entity.id));
    } else if (type === 'persona') {
      params.append('persona_id', String(entity.id));
    } else if (type === 'scene') {
      params.append('scene_id', String(entity.id));
    }

    if (![...params.keys()].length) return;

    fetch(`${window.API_BASE_URL}/api/is-liked-multi?${params.toString()}`, {
      credentials: 'include',
      headers: { 'Authorization': sessionToken }
    })
      .then(res => res.json())
      .then(data => {
        const likedValue = data?.[type]?.liked;
        setLiked(!!likedValue);
      })
      .catch(() => setLiked(false));
  }, [entity, type, sessionToken]);

  // Fetch content ban appeals when the entity is banned and user is owner/admin
  useEffect(() => {
    if (!entity || !sessionToken) return;
    const ownerOrAdmin = userData?.id === entity.creator_id || userData?.is_admin;
    if (!ownerOrAdmin) return;
    if (!entity.moderation_status && contentAppeals.length === 0) return; // only fetch if banned or already loaded
    setAppealsLoading(true);
    fetch(`${window.API_BASE_URL}/api/content-ban-appeal/${type}/${id}`, {
      headers: { Authorization: sessionToken },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setContentAppeals(Array.isArray(data) ? data : []))
      .catch(() => setContentAppeals([]))
      .finally(() => setAppealsLoading(false));
  }, [entity?.moderation_status, entity?.creator_id, sessionToken, type, id, userData]);

  // Fetch follow status for the creator
  useEffect(() => {
    if (!entity?.creator_id || !sessionToken) return;
    if (userData && userData.id === entity.creator_id) return;
    fetch(`${window.API_BASE_URL}/api/users/me/following-ids`, {
      headers: { Authorization: sessionToken },
    })
      .then(res => res.json())
      .then(data => setIsFollowing((data.following_ids || []).includes(entity.creator_id)))
      .catch(() => {});
  }, [entity?.creator_id, sessionToken, userData]);

  const handleFollowToggle = async () => {
    if (!entity?.creator_id || followLoading) return;
    setFollowLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`${window.API_BASE_URL}/api/users/${entity.creator_id}/follow`, {
        method,
        headers: { Authorization: sessionToken },
      });
      if (res.ok) setIsFollowing(f => !f);
    } catch { /* ignore */ } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async () => {
    if (!entity || !sessionToken) return;

    const prevLiked = liked;
    const prevLikes = typeof entity.likes === 'number' ? entity.likes : 0;
    const nextLiked = !prevLiked;
    const nextLikes = Math.max(0, prevLikes + (nextLiked ? 1 : -1));

    // Keep interaction snappy like InfoCard: reflect state change immediately.
    setLiked(nextLiked);
    setEntity((prev) => (prev ? { ...prev, likes: nextLikes } : prev));

    const action = nextLiked ? 'like' : 'unlike';
    const endpoint = `${window.API_BASE_URL}/api/${action}/${type}/${entity.id}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Authorization': sessionToken }
      });

      if (!res.ok) {
        throw new Error('Failed to like entity');
      }

      const data = await res.json();

      setLiked(nextLiked);

      if (typeof data?.likes === 'number') {
        setEntity((prev) => (prev ? { ...prev, likes: data.likes } : prev));
      }
    } catch (err) {
      setLiked(prevLiked);
      setEntity((prev) => (prev ? { ...prev, likes: prevLikes } : prev));
      console.error(err);
      toast.show(t('entity_detail.like_error', 'Failed to like'), { type: 'error' });
    }
  };

  const handleEdit = () => {
    if (type === 'character') {
      navigate(`/character/edit/${id}`);
    } else if (type === 'persona') {
      navigate(`/persona/edit/${id}`);
    } else if (type === 'scene') {
      navigate(`/scene/edit/${id}`);
    }
  };

  const handleChat = () => {
    if (type === 'character') {
      navigate(`/chat?character=${id}`);
    } else if (type === 'scene') {
      navigate(`/chat?scene=${id}`);
    }
  };

  const handleFork = () => {
    if (!entity.is_forkable) {
      toast.show(t('entity_detail.not_forkable', 'This entity is not forkable'), { type: 'error' });
      return;
    }

    if (type === 'character' && entity?.context_label === 'advanced' && !isProUser) {
      toast.show('只有付费用户可以参考进阶角色', { type: 'error' });
      return;
    }
    
    if (type === 'character') {
      navigate(`/character/fork/${id}`);
    } else if (type === 'persona') {
      navigate(`/persona/fork/${id}`);
    } else if (type === 'scene') {
      navigate(`/scene/fork/${id}`);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!entity) {
    return null;
  }

  const isOwner = userData?.id === entity.creator_id;
  const picture = entity.picture ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(entity.picture).replace(/^\//, '')}` : defaultPicture;
  const creatorAvatar = entity.creator_profile_pic
    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(entity.creator_profile_pic).replace(/^\//, '')}`
    : defaultAvatar;

  const handleCreatorClick = () => {
    if (entity.creator_id) {
      navigate(`/profile/${encodeURIComponent(entity.creator_id)}`);
    }
  };

  // Get description based on entity type
  let description = '';
  if (type === 'character') {
    description = entity.persona || '';
  } else if (type === 'persona') {
    description = entity.description || '';
  } else if (type === 'scene') {
    description = entity.description || '';
  }

  // Get secondary info based on type
  let secondaryInfo = '';
  if (type === 'character') {
    secondaryInfo = entity.tagline || '';
  } else if (type === 'persona' || type === 'scene') {
    secondaryInfo = entity.intro || '';
  }

  const longDescriptionChunks = Array.isArray(entity?.long_description_chunks)
    ? entity.long_description_chunks
        .map((chunk) => (typeof chunk?.content === 'string' ? chunk.content.trim() : ''))
        .filter(Boolean)
    : [];

  const sectionTitleWrapStyle = {
    borderBottom: '1px solid #f0f0f0',
    paddingBottom: '0.55rem',
    marginBottom: '0.6rem'
  };

  const sectionTitleStyle = {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: '#000'
  };

  const sectionBodyStyle = {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.68,
    color: '#444',
    fontSize: '0.94rem',
    marginBottom: 0
  };

  return (
    <PageWrapper>
      <div 
        className="container py-4"
        style={{
          maxWidth: '900px',
          margin: '0 auto'
        }}
      >
        {/* Moderation notice banners */}
        {entity.moderation_status === 'restricted' && (() => {
          const hasPending = contentAppeals.some(a => a.status === 'pending');
          const editPath = type === 'character' ? `/character/edit/${id}` : type === 'persona' ? `/persona/edit/${id}` : `/scene/edit/${id}`;
          return (
            <div
              className="d-flex align-items-start gap-3 mb-4 p-3"
              style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '10px' }}
            >
              <i className="bi bi-eye-slash-fill" style={{ color: '#d97706', fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}></i>
              <div className="flex-grow-1">
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                  {t('entity_detail.restricted_title', '内容可见性已限制')}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#78350f', marginBottom: isOwner ? '0.6rem' : 0 }}>
                  {isOwner
                    ? t('entity_detail.restricted_owner_body', '您的内容因违反社区规范，已被限制在公开推荐及搜索中显示。仍可通过本链接访问，但不会出现在浏览或推荐页面中。')
                    : t('entity_detail.restricted_visitor_body', '此内容目前不在公开推荐列表中，但可通过此链接访问。')}
                </div>
                {isOwner && (
                  <button
                    className={`btn btn-sm ${hasPending ? 'btn-outline-secondary' : 'btn-warning'}`}
                    disabled={hasPending}
                    onClick={() => navigate(editPath, { state: { appealMode: true } })}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <i className="bi bi-megaphone me-1"></i>
                    {hasPending ? t('entity_detail.appeal_pending', '申诉审核中') : t('entity_detail.appeal_action', '编辑并提交申诉')}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {entity.moderation_status === 'takedown' && (() => {
          const hasPending = contentAppeals.some(a => a.status === 'pending');
          const editPath = type === 'character' ? `/character/edit/${id}` : type === 'persona' ? `/persona/edit/${id}` : `/scene/edit/${id}`;
          return (
            <div
              className="d-flex align-items-start gap-3 mb-4 p-3"
              style={{ background: '#fff1f2', border: '1px solid #f43f5e', borderRadius: '10px' }}
            >
              <i className="bi bi-ban" style={{ color: '#e11d48', fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}></i>
              <div className="flex-grow-1">
                <div style={{ fontWeight: 700, color: '#9f1239', marginBottom: '2px' }}>
                  {t('entity_detail.takedown_title', '内容已被下架')}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#881337', marginBottom: isOwner ? '0.6rem' : 0 }}>
                  {isOwner
                    ? t('entity_detail.takedown_owner_body', '您的内容因违反社区规范已被下架，其他用户无法访问。您可以修改内容后提交申诉，由管理员审核。')
                    : t('entity_detail.takedown_body', '此内容因违反社区规范已被下架，其他用户无法访问。')}
                </div>
                {isOwner && (
                  <button
                    className={`btn btn-sm ${hasPending ? 'btn-outline-secondary' : 'btn-danger'}`}
                    disabled={hasPending}
                    onClick={() => navigate(editPath, { state: { appealMode: true } })}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <i className="bi bi-megaphone me-1"></i>
                    {hasPending ? t('entity_detail.appeal_pending', '申诉审核中') : t('entity_detail.appeal_action', '编辑并提交申诉')}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Header with image and basic info */}
        <div className="row mb-5">
          <div className={isMobile ? 'col-12 mb-3' : 'col-md-4'}>
            <img 
              src={picture}
              alt={entity.name}
              style={{
                width: '100%',
                aspectRatio: '4/5',
                objectFit: 'cover',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            />
          </div>
          <div className={isMobile ? 'col-12' : 'col-md-8'}>
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <div className="d-flex align-items-center flex-wrap" style={{ gap: '8px', marginBottom: '12px' }}>
                  <h1
                    className="mb-0"
                    style={{
                      fontSize: isMobile ? '1.72rem' : '2.4rem',
                      fontWeight: 800,
                      lineHeight: 1.15,
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {entity.name}
                  </h1>
                  {entity.is_forkable && (
                    <div
                      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                      onMouseEnter={() => setIsForkableBadgeHovered(true)}
                      onMouseLeave={() => setIsForkableBadgeHovered(false)}
                    >
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
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <i className="bi bi-diagram-3-fill" style={{ fontSize: '0.5rem' }}></i>
                      </span>
                      {isForkableBadgeHovered && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '6px',
                            background: 'rgba(17, 24, 39, 0.94)',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          {t('entity_card.forkable') || 'Forkable'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div
                  role="button"
                  onClick={handleCreatorClick}
                  onMouseEnter={() => setIsCreatorHovered(true)}
                  onMouseLeave={() => setIsCreatorHovered(false)}
                  className="d-flex align-items-center gap-2 mb-2"
                  style={{
                    cursor: 'pointer',
                    width: 'fit-content',
                    borderRadius: '999px',
                    padding: '4px 8px 4px 4px',
                    backgroundColor: isCreatorHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    transform: isCreatorHovered ? 'translateY(-1px)' : 'translateY(0)',
                    transition: 'background-color 0.18s ease, transform 0.18s ease'
                  }}
                >
                  <img
                    src={creatorAvatar}
                    alt={entity.creator_name || ''}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                  <span
                    className="text-muted"
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: isCreatorHovered ? '#111827' : undefined,
                      textDecoration: isCreatorHovered ? 'underline' : 'none',
                      transition: 'color 0.18s ease, text-decoration-color 0.18s ease'
                    }}
                  >
                    {entity.creator_name || t('entity_detail.unknown')}
                  </span>
                </div>
                {/* Display forked_from information */}
                {entity.forked_from_id && entity.forked_from_name && (
                  <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-code-fork me-1"></i>
                    {t('entity_detail.forked_from')} {entity.forked_from_name}
                  </p>
                )}
                {/* Follow button — visible when not the owner */}
                {!isOwner && sessionToken && entity.creator_id && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      style={{
                        padding: '0.28rem 0.9rem',
                        fontSize: '0.78rem',
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
              {!entity.is_public && (
                <span className="badge bg-secondary ms-3 mt-1">{t('entity_detail.private')}</span>
              )}
            </div>

            {secondaryInfo && (
              <p
                className="mb-4"
                style={{
                  fontSize: '1rem',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: '#5f6368',
                  lineHeight: 1.5
                }}
              >
                {secondaryInfo}
              </p>
            )}

            {/* Stats */}
            <div className="d-flex gap-2 flex-wrap mb-4">
              <div
                className="d-flex align-items-center"
                style={{
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  backgroundColor: '#f6f7f9'
                }}
              >
                <i className="bi bi-chat" style={{ fontSize: '0.9rem', color: '#57606a' }}></i>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#30363d' }}>
                  {entity.views || 0}
                </span>
              </div>
              <button
                onClick={handleLike}
                className="d-flex align-items-center"
                aria-label={liked ? t('entity_detail.unlike', 'Unlike') : t('entity_detail.like', 'Like')}
                style={{
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  backgroundColor: liked ? '#ffe9ec' : '#fff1f2',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.18s ease, transform 0.18s ease'
                }}
              >
                <i
                  className={`bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`}
                  style={{ fontSize: '0.9rem', color: '#d73a49' }}
                ></i>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#30363d' }}>
                  {entity.likes || 0}
                </span>
              </button>
            </div>

            {/* Tags */}
            {entity.tags && entity.tags.length > 0 && (
              <div className="mb-4 d-flex flex-wrap" style={{ gap: '6px' }}>
                {entity.tags.map((tag, idx) => {
                  const tagName = typeof tag === 'object' ? tag.name : tag;
                  return (
                    <span 
                      key={idx}
                      className="badge"
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      #{tagName}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="d-flex flex-column" style={{ gap: '10px' }}>
              <div className="d-flex flex-wrap align-items-center" style={{ gap: '8px' }}>
                {(type === 'character' || type === 'scene') && (
                  <PrimaryButton
                    onClick={handleChat}
                    style={{
                      background: '#a590dc',
                      color: '#ffffff',
                      border: '1px solid #9078cc',
                      boxShadow: '0 6px 14px rgba(117, 92, 182, 0.22)',
                      transition: 'background 0.18s ease, box-shadow 0.18s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#967fd2';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(117, 92, 182, 0.28)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#a590dc';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(117, 92, 182, 0.22)';
                    }}
                  >
                    <i className="bi bi-chat-dots me-2"></i>
                    {t('entity_detail.start_chat', 'Start Chat')}
                  </PrimaryButton>
                )}

                {entity.is_forkable && canFork && (
                  <SecondaryButton onClick={handleFork}>
                    <i className="bi bi-diagram-3-fill me-2"></i>
                    {t('entity_detail.fork', 'Fork')}
                  </SecondaryButton>
                )}

                {isOwner && (
                  <SecondaryButton onClick={handleEdit}>
                    <i className="bi bi-pencil me-2"></i>
                    {t('entity_detail.edit', 'Edit')}
                  </SecondaryButton>
                )}
                {!isOwner && sessionToken && (
                  <button
                    type="button"
                    onClick={() => setShowProblemReport(true)}
                    title={t('topbar.report_problem')}
                    aria-label={t('topbar.report_problem')}
                    onMouseEnter={() => setReportIconHovered(true)}
                    onMouseLeave={() => setReportIconHovered(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '999px',
                      border: '1.5px solid rgba(220,53,69,0.3)',
                      background: reportIconHovered ? 'rgba(220,53,69,0.08)' : 'transparent',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <i
                      className={`bi ${reportIconHovered ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-triangle'}`}
                      style={{ fontSize: '0.9rem' }}
                    />
                    {t('problem_report.report_button', 'Report')}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Description section */}
        {description && (
          <div className="card mb-4">
            <div className="card-body">
              <div style={sectionTitleWrapStyle}>
                <h3 style={sectionTitleStyle}>
                  {type === 'character' 
                    ? t('entity_detail.persona') 
                    : t('entity_detail.description')}
                </h3>
              </div>
              <p style={sectionBodyStyle}>
                {description}
              </p>
            </div>
          </div>
        )}

        {/* Character-specific: Greeting and Sample Dialogue */}
        {type === 'character' && (
          <>
            {entity.greeting && entity.greeting !== '[IMPROVISE_GREETING]' && (
              <div className="card mb-4">
                <div className="card-body">
                  <div style={sectionTitleWrapStyle}>
                    <h3 style={sectionTitleStyle}>
                      {t('entity_detail.greeting', 'Greeting')}
                    </h3>
                  </div>
                  <p style={sectionBodyStyle}>
                    {entity.greeting}
                  </p>
                </div>
              </div>
            )}

            {entity.example_messages && (
              <div className="card mb-4">
                <div className="card-body">
                  <div style={sectionTitleWrapStyle}>
                    <h3 style={sectionTitleStyle}>
                      {t('entity_detail.sample_dialogue', 'Sample Dialogue')}
                    </h3>
                  </div>
                  <p style={sectionBodyStyle}>
                    {entity.example_messages}
                  </p>
                </div>
              </div>
            )}

            {entity.long_description && (
              <div className="card mb-4">
                <div className="card-body">
                  <div style={sectionTitleWrapStyle}>
                    <h3 style={sectionTitleStyle}>
                      {t('entity_detail.long_description', '详细人物设定')}
                    </h3>
                  </div>
                  <p style={sectionBodyStyle}>
                    {entity.long_description}
                  </p>
                </div>
              </div>
            )}

            {longDescriptionChunks.length > 0 && (
              <div className="card mb-4">
                <div className="card-body">
                  <div style={sectionTitleWrapStyle}>
                    <h3 style={sectionTitleStyle}>
                      {t('entity_detail.long_description_chunks', '详细设定分段')}
                    </h3>
                  </div>
                  <div className="d-flex flex-column gap-3">
                    {longDescriptionChunks.map((chunkText, index) => (
                      <div
                        key={`chunk-${index}`}
                        style={{
                          padding: '0.75rem 0.9rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          background: '#f8fafc'
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>
                          {t('entity_detail.chunk_priority')} {index + 1}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.68, color: '#444', fontSize: '0.94rem' }}>
                          {chunkText}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* Appeal History — visible to owner and admin */}
      {(userData?.id === entity.creator_id || userData?.is_admin) && contentAppeals.length > 0 && (
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            paddingBottom: '2rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
          }}
        >
          <button
            type="button"
            className="w-100 d-flex align-items-center justify-content-between mb-2"
            onClick={() => setShowAppealHistory(p => !p)}
            style={{
              background: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              cursor: 'pointer',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <span><i className="bi bi-clock-history me-2"></i>{t('entity_detail.appeal_history_title', '申诉历史')} ({contentAppeals.length})</span>
            <i className={`bi ${showAppealHistory ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
          </button>
          {showAppealHistory && (
            <div className="d-flex flex-column gap-3">
              {contentAppeals.map((appeal) => {
                const statusColors = {
                  pending:  { bg: '#eff6ff', border: '#3b82f6', badge: 'bg-primary', label: t('entity_detail.appeal_status_pending',  '审核中') },
                  approved: { bg: '#f0fdf4', border: '#22c55e', badge: 'bg-success', label: t('entity_detail.appeal_status_approved', '已通过') },
                  rejected: { bg: '#fff1f2', border: '#f43f5e', badge: 'bg-danger',  label: t('entity_detail.appeal_status_rejected', '未通过') },
                };
                const sc = statusColors[appeal.status] || statusColors.pending;
                return (
                  <div
                    key={appeal.id}
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '10px', padding: '0.9rem 1rem' }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">
                        {new Date(appeal.created_at).toLocaleString()}
                      </span>
                      <span className={`badge ${sc.badge}`}>{sc.label}</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                      <strong>{t('entity_detail.appeal_reason_label', '申诉理由')}：</strong>{appeal.appeal_reason}
                    </div>
                    {appeal.admin_reply && (
                      <div style={{ fontSize: '0.88rem', color: '#475569' }}>
                        <strong>{t('entity_detail.appeal_admin_reply', '管理员回复')}：</strong>{appeal.admin_reply}
                      </div>
                    )}
                    {appeal.snapshot && (
                      <details style={{ marginTop: '0.6rem' }}>
                        <summary style={{ fontSize: '0.82rem', color: '#64748b', cursor: 'pointer' }}>
                          {t('entity_detail.appeal_snapshot', '提交时内容快照')}
                        </summary>
                        <pre style={{ fontSize: '0.78rem', background: '#f8fafc', borderRadius: 6, padding: '0.5rem', marginTop: '0.4rem', overflow: 'auto', maxHeight: 200 }}>
                          {JSON.stringify(appeal.snapshot, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <ProblemReportModal
        show={showProblemReport}
        onClose={() => setShowProblemReport(false)}
        targetType={type}
        targetId={entity?.id}
        targetName={entity?.name}
      />
    </PageWrapper>
  );
}
