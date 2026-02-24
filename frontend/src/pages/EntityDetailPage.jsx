import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import { useToast } from '../components/ToastProvider';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import defaultPicture from '../assets/images/default-picture.png';

export default function EntityDetailPage() {
  const { t } = useTranslation();
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { sessionToken, userData } = useContext(AuthContext);
  const toast = useToast();
  const userLevel = Number(userData?.level || 1);
  const canFork = userLevel >= 2;
  
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [characterAccess, setCharacterAccess] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

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
        toast.show(t('entity_detail.fetch_error', 'Failed to load entity'), { type: 'error' });
        navigate('/');
      });
  }, [type, id, sessionToken, navigate]);

  useEffect(() => {
    if (!entity || !sessionToken || type !== 'character') {
      setCharacterAccess(null);
      return;
    }

    fetch(`${window.API_BASE_URL}/api/character/${entity.id}/access`, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch character access');
        }
        return res.json();
      })
      .then(data => setCharacterAccess(data))
      .catch(() => setCharacterAccess(null));
  }, [entity, sessionToken, type]);

  // Check if user has liked this entity
  useEffect(() => {
    if (!entity || !sessionToken) return;

    let endpoint = '';
    if (type === 'character') {
      endpoint = `${window.API_BASE_URL}/api/character/${entity.id}/liked`;
    } else if (type === 'persona') {
      endpoint = `${window.API_BASE_URL}/api/personas/${entity.id}/liked`;
    } else if (type === 'scene') {
      endpoint = `${window.API_BASE_URL}/api/scenes/${entity.id}/liked`;
    }

    if (endpoint) {
      fetch(endpoint, {
        headers: { 'Authorization': sessionToken }
      })
        .then(res => res.json())
        .then(data => setLiked(data.liked || false))
        .catch(() => setLiked(false));
    }
  }, [entity, type, sessionToken]);

  const handleLike = async () => {
    if (!entity || !sessionToken) return;

    let endpoint = '';
    if (type === 'character') {
      endpoint = `${window.API_BASE_URL}/api/character/${entity.id}/like`;
    } else if (type === 'persona') {
      endpoint = `${window.API_BASE_URL}/api/personas/${entity.id}/like`;
    } else if (type === 'scene') {
      endpoint = `${window.API_BASE_URL}/api/scenes/${entity.id}/like`;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': sessionToken }
      });
      const data = await res.json();
      setLiked(!liked);
      setEntity({ ...entity, likes: data.likes });
    } catch (err) {
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

  const handleDelete = async () => {
    if (!window.confirm(t('entity_detail.confirm_delete', 'Are you sure you want to delete this?'))) {
      return;
    }

    let endpoint = '';
    if (type === 'character') {
      endpoint = `${window.API_BASE_URL}/api/character/${id}/delete`;
    } else if (type === 'persona') {
      endpoint = `${window.API_BASE_URL}/api/personas/${id}`;
    } else if (type === 'scene') {
      endpoint = `${window.API_BASE_URL}/api/scenes/${id}`;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': sessionToken }
      });
      if (res.ok) {
        toast.show(t('entity_detail.delete_success', 'Deleted successfully'), { type: 'success' });
        navigate('/');
      } else {
        toast.show(t('entity_detail.delete_error', 'Failed to delete'), { type: 'error' });
      }
    } catch (err) {
      console.error(err);
      toast.show(t('entity_detail.delete_error', 'Failed to delete'), { type: 'error' });
    }
  };

  const handleChat = () => {
    if (type === 'character') {
      if (characterAccess && !characterAccess.has_access) {
        toast.show(t('entity_detail.purchase_required', 'Please purchase this character first'), { type: 'info' });
        return;
      }
      navigate(`/chat?character=${id}`);
    } else if (type === 'scene') {
      navigate(`/chat?scene=${id}`);
    }
  };

  const handleBuyCharacter = async () => {
    if (type !== 'character' || !entity || !sessionToken) {
      return;
    }

    setPurchasing(true);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/alipay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({
          total_amount: Number(entity.price || 0),
          subject: `购买角色：${entity.name}`,
          body: `购买付费角色 ${entity.name}`,
          payment_type: 'page',
          order_type: 'character_purchase',
          character_id: entity.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        let errorMessage = t('entity_detail.purchase_failed', 'Failed to create purchase order');
        if (data?.detail) {
          errorMessage = typeof data.detail === 'string' ? data.detail : errorMessage;
        }
        toast.show(errorMessage, { type: 'error' });
        return;
      }

      if (data?.success && data?.payment_url) {
        toast.show(t('entity_detail.redirecting_payment', 'Redirecting to payment...'), { type: 'success' });
        setTimeout(() => {
          window.location.href = data.payment_url;
        }, 600);
      } else {
        toast.show(t('entity_detail.purchase_failed', 'Failed to create purchase order'), { type: 'error' });
      }
    } catch (error) {
      toast.show(t('entity_detail.purchase_failed', 'Failed to create purchase order'), { type: 'error' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleFork = () => {
    if (!entity.is_forkable) {
      toast.show(t('entity_detail.not_forkable', 'This entity is not forkable'), { type: 'error' });
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

  return (
    <PageWrapper>
      <div 
        className="container py-4"
        style={{
          maxWidth: '900px',
          margin: '0 auto'
        }}
      >
        {/* Header with image and basic info */}
        <div className="row mb-4">
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
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h1 className="mb-2" style={{ fontSize: isMobile ? '1.75rem' : '2.5rem' }}>
                  {entity.name}
                </h1>
                <p className="text-muted mb-2">
                  {t('entity_detail.by', 'by')} {entity.creator_name || t('entity_detail.unknown', 'Unknown')}
                </p>
                {/* Display forked_from information */}
                {entity.forked_from_id && entity.forked_from_name && (
                  <p className="text-muted mb-2" style={{ fontSize: '0.9rem' }}>
                    <i className="bi bi-code-fork me-1"></i>
                    {t('entity_detail.forked_from', 'Forked from')} {entity.forked_from_name}
                  </p>
                )}
              </div>
              {!entity.is_public && (
                <span className="badge bg-secondary">{t('entity_detail.private', 'Private')}</span>
              )}
            </div>

            {secondaryInfo && (
              <p className="mb-3" style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#666' }}>
                {secondaryInfo}
              </p>
            )}

            {/* Stats */}
            <div className="d-flex gap-3 mb-3">
              <div>
                <i className="bi bi-eye me-1"></i>
                <span>{entity.views || 0} {t('entity_detail.views', 'views')}</span>
              </div>
              <div>
                <i className="bi bi-heart-fill me-1"></i>
                <span>{entity.likes || 0} {t('entity_detail.likes', 'likes')}</span>
              </div>
            </div>

            {/* Tags */}
            {entity.tags && entity.tags.length > 0 && (
              <div className="mb-3">
                {entity.tags.map((tag, idx) => {
                  const tagName = typeof tag === 'object' ? tag.name : tag;
                  return (
                    <span 
                      key={idx}
                      className="badge me-2 mb-2"
                      style={{
                        backgroundColor: '#f0f0f0',
                        color: '#333',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 'normal'
                      }}
                    >
                      {tagName}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="d-flex gap-2 flex-wrap">
              {type === 'character' ? (
                characterAccess && !characterAccess.has_access ? (
                  <PrimaryButton onClick={handleBuyCharacter} disabled={purchasing}>
                    <i className="bi bi-currency-yen me-2"></i>
                    {purchasing
                      ? t('common.loading', '加载中...')
                      : t('entity_detail.buy_character', 'Buy Character')}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={handleChat}>
                    <i className="bi bi-chat-dots me-2"></i>
                    {t('entity_detail.start_chat', 'Start Chat')}
                  </PrimaryButton>
                )
              ) : type === 'scene' ? (
                <PrimaryButton onClick={handleChat}>
                  <i className="bi bi-chat-dots me-2"></i>
                  {t('entity_detail.start_chat', 'Start Chat')}
                </PrimaryButton>
              ) : null}
              
              <SecondaryButton onClick={handleLike}>
                <i className={`bi ${liked ? 'bi-heart-fill' : 'bi-heart'} me-2`}></i>
                {liked ? t('entity_detail.unlike', 'Unlike') : t('entity_detail.like', 'Like')}
              </SecondaryButton>

              {entity.is_forkable && canFork && (
                <SecondaryButton onClick={handleFork}>
                  <i className="bi bi-code-fork me-2"></i>
                  {t('entity_detail.fork', 'Fork')}
                </SecondaryButton>
              )}

              {isOwner && (
                <>
                  <SecondaryButton onClick={handleEdit}>
                    <i className="bi bi-pencil me-2"></i>
                    {t('entity_detail.edit', 'Edit')}
                  </SecondaryButton>
                  <SecondaryButton onClick={handleDelete} className="text-danger">
                    <i className="bi bi-trash me-2"></i>
                    {t('entity_detail.delete', 'Delete')}
                  </SecondaryButton>
                </>
              )}
            </div>

            {/* Additional info badges */}
            <div className="mt-3">
              {entity.is_forkable && (
                <span className="badge bg-info me-2">
                  <i className="bi bi-code-fork me-1"></i>
                  {t('entity_detail.forkable', 'Forkable')}
                </span>
              )}
              {type === 'character' && !entity.is_free && (
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-currency-yen me-1"></i>
                  ¥{entity.price}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description section */}
        {description && (
          <div className="card mb-4">
            <div className="card-body">
              <h3 className="card-title mb-3">
                {type === 'character' 
                  ? t('entity_detail.persona', 'Persona') 
                  : t('entity_detail.description', 'Description')}
              </h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
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
                  <h3 className="card-title mb-3">
                    {t('entity_detail.greeting', 'Greeting')}
                  </h3>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {entity.greeting}
                  </p>
                </div>
              </div>
            )}

            {entity.example_messages && (
              <div className="card mb-4">
                <div className="card-body">
                  <h3 className="card-title mb-3">
                    {t('entity_detail.sample_dialogue', 'Sample Dialogue')}
                  </h3>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {entity.example_messages}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}
