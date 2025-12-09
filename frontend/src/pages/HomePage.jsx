import React, { useState, useEffect, useContext } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useNavigate, useOutletContext } from 'react-router';
import EntityCard from '../components/EntityCard';
import NameCard from '../components/NameCard';
import SceneCard from '../components/SceneCard';
import HorizontalCardSection from '../components/HorizontalCardSection';
import { AuthContext } from '../components/AuthProvider';
import { useTranslation } from 'react-i18next';
import TextButton from '../components/TextButton';
import PrimaryButton from '../components/PrimaryButton';
import OnboardingTour from '../components/OnboardingTour';


function HomePage() {
  const { t, i18n } = useTranslation();
  const [popular, setPopular] = useState([]);
  const [popularScenes, setPopularScenes] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [tagCharacters, setTagCharacters] = useState({});
  const [loadingTagCharacters, setLoadingTagCharacters] = useState(false);
  const [loadingTags, setLoadingTags] = useState(true);
  const [selectedTag, setSelectedTag] = useState(null);
  const [popularScroll, setPopularScroll] = useState({ left: false, right: false });
  const [recentScroll, setRecentScroll] = useState({ left: false, right: false });
  const [tagScroll, setTagScroll] = useState({ left: false, right: false });
  const [sceneScroll, setSceneScroll] = useState({ left: false, right: false });
  const [personaScroll, setPersonaScroll] = useState({ left: false, right: false });
  const [recommendedScroll, setRecommendedScroll] = useState({ left: false, right: false });
  const [mounted, setMounted] = useState(false);
  const [popularPersonas, setPopularPersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [errorPersonas, setErrorPersonas] = useState(null);
  const [showFirstTimeBanner, setShowFirstTimeBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();
  const { userData, sessionToken, loading } = useContext(AuthContext);
  const { sidebarVisible, setSidebarVisible } = useOutletContext() || {};

  // Check if user is first-time (no recent chats)
  useEffect(() => {
    if (userData && (!userData.chat_history || userData.chat_history.length === 0)) {
      setShowFirstTimeBanner(true);
      // Auto-start onboarding for first-time users if not completed
      const onboardingCompleted = localStorage.getItem('onboarding_completed');
      if (!onboardingCompleted) {
        // Delay to let page render first
        setTimeout(() => setShowOnboarding(true), 500);
      }
    } else {
      setShowFirstTimeBanner(false);
    }
  }, [userData]);
  // Fetch popular personas
  useEffect(() => {
    setLoadingPersonas(true);
    setErrorPersonas(null);
    fetch(`${window.API_BASE_URL}/api/personas/popular`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setPopularPersonas(data.items || []);
        setLoadingPersonas(false);
      })
      .catch(() => {
        setPopularPersonas([]);
        setErrorPersonas('Could not load popular personas.');
        setLoadingPersonas(false);
      });
  }, []);


  // Only show spinner until mounted and auth state is ready (prevents hydration mismatch)
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: 32, height: 32 }}>
            <span className="visually-hidden">{t('common.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Helper to update scroll state for a given element
  const updateScrollState = (id, setState) => {
    // Only run on client
    if (typeof window === 'undefined') return;
    const el = document.getElementById(id);
    if (!el) return;
    setState({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2, // -2 for float rounding
    });
  };

  // Set mounted true on client only
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
  // Initial scroll state for all horizontal sections
  updateScrollState('popular-scroll', setPopularScroll);
  updateScrollState('recent-scroll', setRecentScroll);
  updateScrollState('tag-scroll', setTagScroll);
  updateScrollState('scene-scroll', setSceneScroll);
  updateScrollState('persona-scroll', setPersonaScroll);
  updateScrollState('recommended-scroll', setRecommendedScroll);
  // Add scroll listeners
  const pop = document.getElementById('popular-scroll');
  const rec = document.getElementById('recent-scroll');
  const tag = document.getElementById('tag-scroll');
  const sceneEl = document.getElementById('scene-scroll');
  const personaEl = document.getElementById('persona-scroll');
  const popScroll = () => updateScrollState('popular-scroll', setPopularScroll);
  const recScroll = () => updateScrollState('recent-scroll', setRecentScroll);
  const tagScrollFn = () => updateScrollState('tag-scroll', setTagScroll);
  const sceneScrollFn = () => updateScrollState('scene-scroll', setSceneScroll);
  const personaScrollFn = () => updateScrollState('persona-scroll', setPersonaScroll);
  const recommendedScrollFn = () => updateScrollState('recommended-scroll', setRecommendedScroll);
  if (pop) pop.addEventListener('scroll', popScroll);
  if (rec) rec.addEventListener('scroll', recScroll);
  if (tag) tag.addEventListener('scroll', tagScrollFn);
  if (sceneEl) sceneEl.addEventListener('scroll', sceneScrollFn);
  if (personaEl) personaEl.addEventListener('scroll', personaScrollFn);
  const recm = document.getElementById('recommended-scroll');
  if (recm) recm.addEventListener('scroll', recommendedScrollFn);
    // Cleanup
    return () => {
  if (pop) pop.removeEventListener('scroll', popScroll);
  if (rec) rec.removeEventListener('scroll', recScroll);
  if (tag) tag.removeEventListener('scroll', tagScrollFn);
  if (sceneEl) sceneEl.removeEventListener('scroll', sceneScrollFn);
  if (personaEl) personaEl.removeEventListener('scroll', personaScrollFn);
  if (recm) recm.removeEventListener('scroll', recommendedScrollFn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, popular.length, recent.length, selectedTag, loadingTagCharacters]);

  useEffect(() => {
  if (!sessionToken) return;
    // Fetch existing sections
  fetch(`${window.API_BASE_URL}/api/characters/popular`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => setPopular(data.items || []))
      .catch(() => setPopular([]));

    // Fetch popular scenes
  fetch(`${window.API_BASE_URL}/api/scenes/popular`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => setPopularScenes(data.items || []))
      .catch(() => setPopularScenes([]));

  fetch(`${window.API_BASE_URL}/api/characters/recent`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => setRecent(data.items || []))
      .catch(() => setRecent([]));

  fetch(`${window.API_BASE_URL}/api/characters/recommended`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => setRecommended(data.items || []))
      .catch(() => setRecommended([]));

    // Fetch popular tags
  fetch(`${window.API_BASE_URL}/api/tag-suggestions`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(tags => {
        setPopularTags(tags);
        setLoadingTags(false);
        // Pre-select the first tag (if any) and pre-fetch characters for the top few tags
        if (Array.isArray(tags) && tags.length > 0) {
          const first = tags[0].name;
          // Only set initial selection if user hasn't already selected a tag
          if (!selectedTag) {
            setSelectedTag(first);
            fetchCharactersByTag(first);
          }
        }
        const topTags = tags.slice(0, 3);
        topTags.forEach(tag => {
          fetchCharactersByTag(tag.name);
        });
      })
      .catch(() => setPopularTags([]));
  }, [sessionToken]);

  const fetchCharactersByTag = (tagName) => {
    setLoadingTagCharacters(true);
    fetch(`${window.API_BASE_URL}/api/characters/by-tag/${encodeURIComponent(tagName)}`, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(characters => {
        setTagCharacters(prev => ({
          ...prev,
          [tagName]: characters
        }));
        setLoadingTagCharacters(false);
      })
      .catch(() => {
        setTagCharacters(prev => ({
          ...prev,
          [tagName]: []
        }));
        setLoadingTagCharacters(false);
      });
  };

  const handleTagClick = (tagName) => {
    setSelectedTag(tagName);
    if (!tagCharacters[tagName]) {
      fetchCharactersByTag(tagName);
    }
  };

  return (
    <PageWrapper>
      {/* Onboarding Tour */}
      <OnboardingTour 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />

      {/* First-Time User Banner */}
      {showFirstTimeBanner && (
        <section className="mb-4">
          <div 
            className="position-relative"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: window.innerWidth < 768 ? '16px' : '24px',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
              overflow: 'hidden',
              padding: window.innerWidth < 768 ? '1.5rem 1rem' : '1.5rem 1.5rem'
            }}
          >
            {/* Decorative elements */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: window.innerWidth < 768 ? '100px' : '150px',
              height: window.innerWidth < 768 ? '100px' : '150px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-40px',
              left: '-40px',
              width: window.innerWidth < 768 ? '120px' : '180px',
              height: window.innerWidth < 768 ? '120px' : '180px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="fw-bold mb-0" style={{ fontSize: window.innerWidth < 768 ? '1.25rem' : '1.5rem' }}>
                  {t('home.first_time_banner_title')}
                </h3>
                <button
                  onClick={() => setShowFirstTimeBanner(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: window.innerWidth < 768 ? '28px' : '32px',
                    height: window.innerWidth < 768 ? '28px' : '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  <i className="bi bi-x-lg" style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '1rem' }}></i>
                </button>
              </div>
              <p className="mb-3" style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1rem', opacity: 0.95 }}>
                {t('home.first_time_banner_subtitle')}
              </p>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-start gap-2 p-2" style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: window.innerWidth < 768 ? '8px' : '12px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: window.innerWidth < 768 ? '1rem' : '1.2rem', lineHeight: 1, marginTop: '2px' }}>→</span>
                    <span style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem', lineHeight: 1.4 }}>{t('home.first_time_step1')}</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-start gap-2 p-2" style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: window.innerWidth < 768 ? '8px' : '12px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: window.innerWidth < 768 ? '1rem' : '1.2rem', lineHeight: 1, marginTop: '2px' }}>→</span>
                    <span style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem', lineHeight: 1.4 }}>{t('home.first_time_step2')}</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-start gap-2 p-2" style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: window.innerWidth < 768 ? '8px' : '12px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: window.innerWidth < 768 ? '1rem' : '1.2rem', lineHeight: 1, marginTop: '2px' }}>→</span>
                    <span style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem', lineHeight: 1.4 }}>{t('home.first_time_step3')}</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="d-flex align-items-start gap-2 p-2" style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    borderRadius: window.innerWidth < 768 ? '8px' : '12px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <span style={{ fontSize: window.innerWidth < 768 ? '1rem' : '1.2rem', lineHeight: 1, marginTop: '2px' }}>→</span>
                    <span style={{ fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem', lineHeight: 1.4 }}>{t('home.first_time_step4')}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowOnboarding(true)}
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: window.innerWidth < 768 ? '10px' : '12px',
                  color: '#fff',
                  padding: window.innerWidth < 768 ? '8px 16px' : '10px 20px',
                  fontSize: window.innerWidth < 768 ? '0.85rem' : '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '16px',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)',
                  width: window.innerWidth < 768 ? '100%' : 'auto'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.35)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
              >
                <i className="bi bi-play-circle me-2"></i>
                {t('onboarding.replay_tour')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hero Stats Section */}
      <section className="mb-4 stats-section">
        <div className="text-center mb-3">
          <h1 className="fw-bold mb-2" style={{ 
            fontSize: '1.5rem', 
            background: 'linear-gradient(135deg, #736B92 0%, #9B8FB8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.3px'
          }}>
            {t('home.hero_title')}
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '0.9rem', fontWeight: 400 }}>
            {t('home.hero_subtitle')}
          </p>
        </div>

        {/* Show Guidance Button for returning users */}
        {!showFirstTimeBanner && (
          <div className="text-center mb-3">
            <button
              onClick={() => setShowFirstTimeBanner(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.08) 0%, rgba(155, 143, 184, 0.12) 100%)',
                border: '1px solid rgba(115, 107, 146, 0.2)',
                borderRadius: '16px',
                color: '#736B92',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(115, 107, 146, 0.08)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.15) 0%, rgba(155, 143, 184, 0.2) 100%)';
                e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.35)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(115, 107, 146, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.08) 0%, rgba(155, 143, 184, 0.12) 100%)';
                e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(115, 107, 146, 0.08)';
              }}
            >
              <i className="bi bi-lightbulb" style={{ fontSize: '1rem' }}></i>
              <span>{t('home.show_guidance')}</span>
            </button>
          </div>
        )}


        {/* Statistics Cards */}
        <div className="d-flex justify-content-center gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ 
            background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(115, 107, 146, 0.15)',
            transition: 'all 0.25s ease',
            boxShadow: '0 2px 8px rgba(115, 107, 146, 0.08)',
            minWidth: '140px',
            cursor: 'pointer'
          }}
          title={t('home.stat_active_users_tooltip')}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.12) 0%, rgba(155, 143, 184, 0.15) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.25)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(115, 107, 146, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(115, 107, 146, 0.08)';
          }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>👥</span>
            <div>
              <div className="fw-bold" style={{ color: '#736B92', fontSize: '1.25rem', lineHeight: 1.2 }}>{i18n.language === 'zh' ? '3000+' : '3K+'}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 500 }}>{t('home.stat_active_users')}</div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ 
            background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(115, 107, 146, 0.15)',
            transition: 'all 0.25s ease',
            boxShadow: '0 2px 8px rgba(115, 107, 146, 0.08)',
            minWidth: '140px',
            cursor: 'pointer'
          }}
          title={t('home.stat_conversations_tooltip')}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.12) 0%, rgba(155, 143, 184, 0.15) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.25)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(115, 107, 146, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(115, 107, 146, 0.08)';
          }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>💬</span>
            <div>
              <div className="fw-bold" style={{ color: '#736B92', fontSize: '1.25rem', lineHeight: 1.2 }}>{i18n.language === 'zh' ? '100万+' : '1M+'}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 500 }}>{t('home.stat_conversations')}</div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ 
            background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(115, 107, 146, 0.15)',
            transition: 'all 0.25s ease',
            boxShadow: '0 2px 8px rgba(115, 107, 146, 0.08)',
            minWidth: '140px',
            cursor: 'pointer'
          }}
          title={t('home.stat_characters_tooltip')}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.12) 0%, rgba(155, 143, 184, 0.15) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.25)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(115, 107, 146, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)';
            e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.15)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(115, 107, 146, 0.08)';
          }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>✨</span>
            <div>
              <div className="fw-bold" style={{ color: '#736B92', fontSize: '1.25rem', lineHeight: 1.2 }}>{i18n.language === 'zh' ? '1万+' : '10K+'}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 500 }}>{t('home.stat_characters')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended for You */}
      {Array.isArray(recommended) && recommended.length > 0 && (
        <HorizontalCardSection
          title={t('home.recommended_for_you')}
          moreLink="/browse/characters/recommended"
          contents={recommended.map(c => ({ ...c, renderCard: () => <NameCard type="character" entity={c} /> }))}
          scrollState={recommendedScroll}
          scrollId="recommended-scroll"
          navigate={navigate}
          itemWidth="auto"
          itemHeight="auto"
          itemGap={"0.75rem"}
        />
      )}

      {/* Popular Characters */}
      <div className="popular-characters-section">
        <HorizontalCardSection
          title={t('home.popular_characters')}
          subtitle={t('home.popular_characters_hint')}
          moreLink="/browse/characters/popular"
          contents={Array.isArray(popular) ? popular.map(c => ({ ...c, renderCard: () => <NameCard type="character" entity={c} /> })) : popular}
          scrollState={popularScroll}
          scrollId="popular-scroll"
          navigate={navigate}
          itemWidth="auto"
          itemHeight="auto"
          itemGap={"0.75rem"}
        />
      </div>


      {/* Popular Scenes (full width) */}
      <HorizontalCardSection
        title={t('home.popular_scenes')}
        subtitle={t('home.popular_scenes_hint')}
        moreLink="/browse/scenes/popular"
        contents={Array.isArray(popularScenes) ? popularScenes.map(scene => ({ ...scene, renderCard: () => <SceneCard type="scene" entity={scene} /> })) : popularScenes}
        scrollState={sceneScroll}
        scrollId="scene-scroll"
        navigate={navigate}
        itemWidth="auto"
        itemHeight="auto"
        itemGap={"0.75rem"}
      />

      {/* Popular Personas (full width) */}
      <HorizontalCardSection
        title={t('home.popular_personas')}
        subtitle={t('home.popular_personas_hint')}
        moreLink="/browse/personas/popular"
        contents={Array.isArray(popularPersonas) ? popularPersonas.map(persona => ({ ...persona, renderCard: () => <EntityCard type="persona" entity={persona} /> })) : popularPersonas}
        scrollState={personaScroll}
        scrollId="persona-scroll"
        navigate={navigate}
      />

      {/* Recently Uploaded */}
      <HorizontalCardSection
        title={t('home.recently_uploaded')}
        moreLink="/browse/characters/recent"
        contents={Array.isArray(recent) ? recent.map(c => ({ ...c, renderCard: () => <NameCard type="character" entity={c} /> })) : recent}
        scrollState={recentScroll}
        scrollId="recent-scroll"
        navigate={navigate}
        itemWidth="auto"
        itemHeight="auto"
        itemGap={"0.75rem"}
      />

      {/* Popular Tags */}
      <section className="mb-4 popular-tags-section">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>{t('home.popular_tags')}</h2>
            {selectedTag && (
              <div className="d-flex align-items-center">
                <span className="text-muted me-2">{t('home.showing')}</span>
                <span className="badge bg-gradient-primary px-2 py-1 rounded-pill shadow-sm" style={{ fontSize: '0.8rem', color: '#232323', background: '#fff' }}>
                  {selectedTag}
                  <button 
                    className="btn-close btn-close-white btn-close-sm ms-2" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTag(null);
                    }}
                    aria-label={t('home.clear_selection')}
                  />
                </span>
              </div>
            )}
          </div>
          <TextButton
            onClick={() => {
              // If a tag is selected, search using that tag as keyword; otherwise go to tag browser
              if (selectedTag) {
                navigate(`/search?q=${encodeURIComponent(selectedTag)}`);
              }
            }}
          >
            {t('home.more')}
          </TextButton>
        </div>

        {!selectedTag && !loadingTags && popularTags.length > 0 && (
          <div className="mb-3 p-2" style={{
            background: 'rgba(115, 107, 146, 0.05)',
            borderRadius: '12px',
            border: '1px dashed rgba(115, 107, 146, 0.2)',
            fontSize: '0.85rem',
            color: '#736B92',
            textAlign: 'center'
          }}>
            <i className="bi bi-arrow-down-circle me-2"></i>
            {t('home.tag_hint')}
          </div>
        )}

        {loadingTags ? (
          <div className="text-center my-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{t('home.loading')}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {popularTags.map(tag => (
                <button
                  key={tag.name}
                  className="fw-bold rounded-pill"
                  style={{
                    background: selectedTag === tag.name ? '#18191a' : '#f5f6fa',
                    color: selectedTag === tag.name ? '#fff' : '#232323',
                    border: selectedTag === tag.name ? 'none' : '1.2px solid #e9ecef',
                    fontSize: '0.8rem',
                    letterSpacing: '0.4px',
                    padding: '0.32rem 0.96rem',
                    boxShadow: selectedTag === tag.name ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 0.14s, color 0.14s, border 0.14s',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleTagClick(tag.name)}
                  onMouseEnter={e => {
                    if (selectedTag !== tag.name) {
                      e.currentTarget.style.background = '#e9ecef';
                      e.currentTarget.style.color = '#18191a';
                      e.currentTarget.style.border = '1.5px solid #cfd8dc';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedTag !== tag.name) {
                      e.currentTarget.style.background = '#f5f6fa';
                      e.currentTarget.style.color = '#232323';
                      e.currentTarget.style.border = '1.5px solid #e9ecef';
                    }
                  }}
                >
                  {tag.name} <span className="badge bg-secondary ms-2" style={{ background: selectedTag === tag.name ? '#232323' : '#e9ecef', color: selectedTag === tag.name ? '#fff' : '#232323', fontWeight: 600, fontSize: '0.8rem', padding: '0.2em 0.7em' }}></span>
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              {selectedTag ? (
                loadingTagCharacters ? (
                  <div className="text-center my-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">{t('home.loading')}</span>
                    </div>
                  </div>
                ) : Array.isArray(tagCharacters[selectedTag]) ? (
                  <HorizontalCardSection
                    title={t('home.characters_for_tag', { tag: selectedTag })}
                    /* hide child more button to avoid duplicate - use parent header for 'more' */
                    showMoreButton={false}
                    contents={tagCharacters[selectedTag].map(c => ({ ...c, renderCard: () => <NameCard type="character" entity={c} /> }))}
                    scrollState={tagScroll}
                    scrollId="tag-scroll"
                    navigate={navigate}
                    itemWidth="auto"
                    itemHeight="auto"
                    itemGap={"0.75rem"}
                  />
                ) : null
              ) : (
                <div className="text-center py-5" style={{
                  background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.03) 0%, rgba(155, 143, 184, 0.05) 100%)',
                  borderRadius: '20px',
                  border: '1px dashed rgba(115, 107, 146, 0.2)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏷️</div>
                  <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>{t('home.select_tag_to_view_characters')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Create Your Own CTA Section */}
      <section className="mb-4">
        <div 
          className="text-center py-5 px-4"
          style={{
            background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.08) 0%, rgba(155, 143, 184, 0.12) 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(115, 107, 146, 0.2)',
            boxShadow: '0 4px 16px rgba(115, 107, 146, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Decorative elements */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(115, 107, 146, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '-30px',
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(155, 143, 184, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>✨</div>
            <h3 className="fw-bold mb-3" style={{ 
              fontSize: '1.75rem',
              color: '#736B92',
              letterSpacing: '-0.3px'
            }}>
              {t('home.create_cta_title')}
            </h3>
            <p className="text-muted mb-4" style={{ 
              fontSize: '1rem',
              maxWidth: '600px',
              margin: '0 auto 1.5rem'
            }}>
              {t('home.create_cta_subtitle')}
            </p>
            <PrimaryButton
              onClick={() => navigate('/character/create')}
              style={{
                fontSize: '1rem',
                padding: '0.7rem 2.5rem'
              }}
            >
              {t('home.create_cta_button')}
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* Bottom spacer for mobile browser chrome */}
      <div style={{ height: '80px' }} />
    </PageWrapper>
  );
}

export default HomePage;