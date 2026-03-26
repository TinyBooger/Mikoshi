import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import DiscoverMasonryCard from '../components/DiscoverMasonryCard';
import UserCard from '../components/UserCard';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import PrimaryButton from '../components/PrimaryButton';
import OnboardingTour from '../components/OnboardingTour';


function BrowsePage() {
  const { t } = useTranslation();
  const { userData, sessionToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarVisible, setSidebarVisible } = useOutletContext() || {};
  // Tabs
  const MAIN_TABS = [
    { key: 'characters', label: t('browse.characters') },
    { key: 'scenes', label: t('browse.scenes') },
    { key: 'personas', label: t('browse.personas') },
    { key: 'users', label: t('browse.users') },
  ];
  const SUBTABS = [
    { key: 'recommended', label: t('browse.for_you') },
    { key: 'popular', label: t('browse.popular') },
    { key: 'recent', label: t('browse.recent') },
  ];
  const USER_SORT_OPTIONS = [
    { key: 'total_rank', label: t('browse.creator_total_rank') },
    { key: 'recent_updated', label: t('browse.creator_recent_updated') },
  ];

  // State
  const [activeMainTab, setActiveMainTab] = useState('characters');
  const [activeSubTab, setActiveSubTab] = useState('popular');
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [showFirstTimeBanner, setShowFirstTimeBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const loadMoreRef = useRef(null);
  const sortDropdownRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let timer;
    if (userData && (!userData.chat_history || userData.chat_history.length === 0)) {
      setShowFirstTimeBanner(true);
      const onboardingCompleted = localStorage.getItem('onboarding_completed');
      if (!onboardingCompleted) {
        timer = setTimeout(() => setShowOnboarding(true), 500);
      }
    } else {
      setShowFirstTimeBanner(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [userData]);

  const masonryColumnCount = viewportWidth < 768 ? 2 : 5;
  const isMobile = viewportWidth < 768;
  const currentSortOptions = activeMainTab === 'users' ? USER_SORT_OPTIONS : SUBTABS;

  // Distribute items by index so visual reading order is left-to-right, then next row.
  const masonryColumns = useMemo(() => {
    const columns = Array.from({ length: masonryColumnCount }, () => []);
    entities.forEach((entity, index) => {
      columns[index % masonryColumnCount].push(entity);
    });
    return columns;
  }, [entities, masonryColumnCount]);

  // Parse tab from URL
  useEffect(() => {
    // URL: /browse/:mainTab/:subTab
    const pathParts = location.pathname.split('/').filter(Boolean);
    let main = 'characters', sub = 'popular';
    if (pathParts[0] === 'browse') {
      if (pathParts[1] && MAIN_TABS.some(t => t.key === pathParts[1])) main = pathParts[1];
      if (main === 'users') {
        sub = 'total_rank';
        if (pathParts[2] && USER_SORT_OPTIONS.some(option => option.key === pathParts[2])) {
          sub = pathParts[2];
        } else if (pathParts[2] === 'recent' || pathParts[2] === 'recent_hot') {
          sub = 'recent_updated';
        }
      } else if (pathParts[2] && SUBTABS.some(t => t.key === pathParts[2])) {
        sub = pathParts[2];
      }
    }
    setActiveMainTab(main);
    setActiveSubTab(sub);
  }, [location.pathname]);

  // Reset page when tabs change
  useEffect(() => {
    setPage(1);
    setEntities([]);
    setTotal(0);
    setHasMore(true);
  }, [activeMainTab, activeSubTab]);

  // Navigation
  const handleMainTab = (tab) => {
    const nextSubTab = tab === 'users'
      ? (USER_SORT_OPTIONS.some(option => option.key === activeSubTab) ? activeSubTab : 'total_rank')
      : (SUBTABS.some(option => option.key === activeSubTab) ? activeSubTab : 'popular');
    navigate(`/browse/${tab}/${nextSubTab}`);
  };
  const handleSubTab = (sub) => {
    navigate(`/browse/${activeMainTab}/${sub}`);
  };

  // Fetch data
  useEffect(() => {
    if (!sessionToken) {
      navigate('/');
      return;
    }
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    let url = '';
    if (activeMainTab === 'characters') {
      url = `${window.API_BASE_URL}/api/characters/${activeSubTab}`;
    } else if (activeMainTab === 'scenes') {
      url = `${window.API_BASE_URL}/api/scenes/${activeSubTab}`;
    } else if (activeMainTab === 'personas') {
      url = `${window.API_BASE_URL}/api/personas/${activeSubTab}`;
    } else if (activeMainTab === 'users') {
      url = `${window.API_BASE_URL}/api/users/browse`;
    }
    const params = new URLSearchParams({ short: 'false', page: String(page) });
    if (activeMainTab === 'users') {
      params.set('sort', activeSubTab);
    }
    const fetchUrl = `${url}?${params.toString()}`;
    fetch(fetchUrl, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => {
        // Expect wrapper: { items, total, page, page_size, short }
        if (data && Array.isArray(data.items)) {
          const incoming = data.items;
          const nextTotal = data.total || 0;
          const nextPageSize = data.page_size || 20;

          setEntities(prev => (page === 1 ? incoming : [...prev, ...incoming]));
          setTotal(nextTotal);
          setPageSize(nextPageSize);
          setHasMore(nextTotal > 0 ? (page * nextPageSize) < nextTotal : incoming.length >= nextPageSize);
        } else if (Array.isArray(data)) { // fallback legacy list
          setEntities(prev => (page === 1 ? data : prev));
          setTotal(data.length);
          setPageSize(20);
          setHasMore(false);
        } else {
          if (page === 1) {
            setEntities([]);
            setTotal(0);
          }
          setHasMore(false);
        }
        setIsLoading(false);
        setIsLoadingMore(false);
      })
      .catch(() => {
        if (page === 1) {
          setEntities([]);
          setTotal(0);
        }
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
      });
  }, [activeMainTab, activeSubTab, sessionToken, navigate, page]);

  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setPage(prev => prev + 1);
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, hasMore]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortDropdown]);

  // Title logic
  const getSectionTitle = () => {
    if (activeMainTab === 'characters') {
      if (activeSubTab === 'popular') return t('browse.popular_characters');
      if (activeSubTab === 'recent') return t('browse.recently_uploaded');
      if (activeSubTab === 'recommended') return t('browse.recommended_for_you');
    } else if (activeMainTab === 'scenes') {
      if (activeSubTab === 'popular') return t('browse.popular_scenes');
      if (activeSubTab === 'recent') return t('browse.recent_scenes');
      if (activeSubTab === 'recommended') return t('browse.recommended_scenes');
    } else if (activeMainTab === 'personas') {
      if (activeSubTab === 'popular') return t('browse.popular_personas');
      if (activeSubTab === 'recent') return t('browse.recent_personas');
      if (activeSubTab === 'recommended') return t('browse.recommended_personas');
    } else if (activeMainTab === 'users') {
      if (activeSubTab === 'recent_updated') return t('browse.creator_recent_updated');
      return t('browse.creator_total_rank');
    }
    return '';
  };

  return (
    <PageWrapper>
      <OnboardingTour
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />

      <div
        className="flex-grow-1 d-flex flex-column align-items-center"
        style={{
          padding: '2rem 1rem',
          width: '100%',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {showFirstTimeBanner ? (
          <section className="mb-4 w-100">
            <div
              className="position-relative"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: isMobile ? '16px' : '24px',
                color: '#fff',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
                overflow: 'hidden',
                padding: isMobile ? '1.5rem 1rem' : '1.5rem 1.5rem'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: isMobile ? '100px' : '150px',
                height: isMobile ? '100px' : '150px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-40px',
                left: '-40px',
                width: isMobile ? '120px' : '180px',
                height: isMobile ? '120px' : '180px',
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none'
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h3 className="fw-bold mb-0" style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
                    {t('home.first_time_banner_title')}
                  </h3>
                  <button
                    onClick={() => setShowFirstTimeBanner(false)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: isMobile ? '28px' : '32px',
                      height: isMobile ? '28px' : '32px',
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
                    <i className="bi bi-x-lg" style={{ fontSize: isMobile ? '0.85rem' : '1rem' }}></i>
                  </button>
                </div>
                <p className="mb-3" style={{ fontSize: isMobile ? '0.9rem' : '1rem', opacity: 0.95 }}>
                  {t('home.first_time_banner_subtitle')}
                </p>
                <div className="row g-2">
                  {[1, 2, 3, 4].map(step => (
                    <div key={step} className="col-12 col-md-6">
                      <div className="d-flex align-items-start gap-2 p-2" style={{
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: isMobile ? '8px' : '12px',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <span style={{ fontSize: isMobile ? '1rem' : '1.2rem', lineHeight: 1, marginTop: '2px' }}>→</span>
                        <span style={{ fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.4 }}>
                          {t(`home.first_time_step${step}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowOnboarding(true)}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: isMobile ? '10px' : '12px',
                    color: '#fff',
                    padding: isMobile ? '8px 16px' : '10px 20px',
                    fontSize: isMobile ? '0.85rem' : '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '16px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(10px)',
                    width: isMobile ? '100%' : 'auto'
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
        ) : (
          <section className="mb-3 w-100">
            <div style={{
              background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.06) 0%, rgba(155, 143, 184, 0.08) 100%)',
              border: '1px solid rgba(115, 107, 146, 0.15)',
              borderRadius: '12px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '0.9rem', color: '#736B92', fontWeight: 600 }}>
                  {t('home.hero_title')}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#9B8FB8', fontWeight: 400 }}>
                  {t('home.hero_subtitle')}
                </span>
              </div>
              <button
                onClick={() => setShowFirstTimeBanner(true)}
                style={{
                  background: 'rgba(115, 107, 146, 0.1)',
                  border: '1px solid rgba(115, 107, 146, 0.25)',
                  borderRadius: '8px',
                  color: '#736B92',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(115, 107, 146, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(115, 107, 146, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(115, 107, 146, 0.25)';
                }}
              >
                <i className="bi bi-lightbulb" style={{ fontSize: '0.85rem' }}></i>
                <span>{t('home.show_guidance')}</span>
              </button>
            </div>
          </section>
        )}

        {/* Main Tabs */}
        <div className="browse-main-tabs d-flex flex-row mb-3 w-100 align-items-center" style={{ gap: 12, justifyContent: 'space-between' }}>
          <div className="d-flex flex-row" style={{ gap: 12 }}>
            {MAIN_TABS.map(tab => (
              <PrimaryButton
              key={tab.key}
              onClick={() => handleMainTab(tab.key)}
              style={{
                background: activeMainTab === tab.key ? '#736B92' : '#f5f6fa',
                color: activeMainTab === tab.key ? '#fff' : '#232323',
                borderRadius: 13,
                fontSize: '1.02rem',
                padding: '0.48rem 1.2rem',
                boxShadow: activeMainTab === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                fontWeight: 700,
              }}
              onMouseEnter={e => {
                if (activeMainTab !== tab.key) {
                  e.currentTarget.style.background = '#e9ecef';
                } else {
                  e.currentTarget.style.background = '#6A6286';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = activeMainTab === tab.key ? '#736B92' : '#f5f6fa';
              }}
            >
              {tab.label}
            </PrimaryButton>
          ))}
          </div>

          {/* Sort Dropdown */}
          {currentSortOptions.length > 0 && (
            <div ref={sortDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{
                  background: '#f5f6fa',
                  color: '#232323',
                  border: 'none',
                  borderRadius: 13,
                  fontSize: '1rem',
                  padding: '0.48rem 1.2rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s, color 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  if (!showSortDropdown) {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={e => {
                  if (!showSortDropdown) {
                    e.currentTarget.style.background = '#f5f6fa';
                  } else {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
              >
                <i className="bi bi-sort-down" style={{ fontSize: '1.1rem' }}></i>
                <span style={{ fontSize: '0.95rem' }}>{t('common.sort')}</span>
              </button>

              {/* Dropdown Menu */}
              {showSortDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                    zIndex: 1000,
                    minWidth: '160px',
                    overflow: 'hidden'
                  }}
                >
                  {currentSortOptions.map((option, index) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        handleSubTab(option.key);
                        setShowSortDropdown(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        background: activeSubTab === option.key ? 'rgba(115, 107, 146, 0.08)' : '#fff',
                        border: 'none',
                        color: activeSubTab === option.key ? '#736B92' : '#232323',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontWeight: activeSubTab === option.key ? 600 : 500,
                        fontSize: '0.95rem',
                        transition: 'background 0.2s',
                        borderBottom: index < currentSortOptions.length - 1 ? '1px solid #f0f0f0' : 'none'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(115, 107, 146, 0.08)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = activeSubTab === option.key ? 'rgba(115, 107, 146, 0.08)' : '#fff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {activeSubTab === option.key && (
                          <i className="bi bi-check" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></i>
                        )}
                        <span>{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      {/* Sub Tabs - Hidden now, using dropdown instead */}
      {/* PC-adapted content wrapper */}
      <div style={{ width: '100%', margin: '0 auto' }}>
        {activeMainTab === 'users' ? (
          isLoading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('browse.loading')}</span>
              </div>
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center my-5">
              <div className="alert alert-info">
                {t('browse.no_results')}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <h6 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: '#232323' }}>
                {getSectionTitle()}
              </h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {entities.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            </div>
          )
        ) : (
          <section className="popular-characters-section">
            <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>
              {getSectionTitle()}
            </h2>
            {isLoading ? (
              <div className="text-center my-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">{t('browse.loading')}</span>
                </div>
              </div>
            ) : entities.length === 0 ? (
              <div className="text-center my-5">
                {activeSubTab === 'recommended' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(115, 107, 146, 0.05) 0%, rgba(155, 143, 184, 0.08) 100%)',
                    borderRadius: '16px',
                    border: '1px solid rgba(115, 107, 146, 0.15)',
                    padding: '2rem',
                    maxWidth: '500px',
                    margin: '0 auto'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💡</div>
                    <h5 className="fw-bold mb-3" style={{ color: '#736B92' }}>
                      {t('browse.no_recommendations_title')}
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                      {t('browse.no_recommendations')}
                    </p>
                  </div>
                ) : (
                  <div className="alert alert-info">
                    {t('browse.no_results')}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${masonryColumnCount}, minmax(0, 1fr))`,
                  gap: '16px',
                  width: '100%',
                }}
              >
                {masonryColumns.map((column, columnIndex) => (
                  <div key={columnIndex} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {column.map(entity => (
                      <div key={entity.id} className="browse-entity-card">
                        <DiscoverMasonryCard type={activeMainTab.slice(0, -1)} entity={entity} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {isLoadingMore && (
        <div className="text-center my-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{t('browse.loading')}</span>
          </div>
        </div>
      )}

      {hasMore && !isLoading && <div ref={loadMoreRef} style={{ height: 1, width: '100%' }} />}

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={t('common.back_to_top')}
        style={{
          position: 'fixed',
          right: isMobile ? '12px' : '20px',
          bottom: isMobile ? '24px' : '32px',
          width: isMobile ? '42px' : '48px',
          height: isMobile ? '42px' : '48px',
          borderRadius: '50%',
          border: 'none',
          background: '#736B92',
          color: '#fff',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
          cursor: showBackToTop ? 'pointer' : 'default',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.24s ease, transform 0.24s ease, background 0.2s',
          pointerEvents: showBackToTop ? 'auto' : 'none',
        }}
        onMouseEnter={e => { if (showBackToTop) e.currentTarget.style.background = '#6A6286'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#736B92'; }}
      >
        <i className="bi bi-arrow-up" style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}></i>
      </button>
      </div>
    </PageWrapper>
  );
}

export default BrowsePage;