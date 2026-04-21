import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router';
import { useTranslation } from 'react-i18next';
import DiscoverMasonryCard from '../components/DiscoverMasonryCard';
import UserCard from '../components/UserCard';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import OnboardingTour from '../components/OnboardingTour';
import UpdateNotificationModal from '../components/UpdateNotificationModal';
import ProblemReportModal from '../components/ProblemReportModal';
import textLogo from '../assets/images/logo_text.png';


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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [showProblemReport, setShowProblemReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const loadMoreRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const activePillRef = useRef(null);
  const gooTrailRef = useRef(null);
  const previousMainTabIndexRef = useRef(0);
  const [pillTranslatePercent, setPillTranslatePercent] = useState(0);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let timer;
    if (userData && (!userData.chat_history || userData.chat_history.length === 0)) {
      const onboardingCompleted = localStorage.getItem('onboarding_completed');
      if (!onboardingCompleted) {
        timer = setTimeout(() => setShowOnboarding(true), 500);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [userData]);

  useEffect(() => {
    if (sessionToken) {
      setShowUpdateNotification(true);
    }
  }, [sessionToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionToken) return;
      if (searchQuery.trim() === '') {
        fetch(`${window.API_BASE_URL}/api/search-suggestions/popular`, {
          headers: { Authorization: sessionToken }
        })
          .then(res => res.json())
          .then(setSearchSuggestions)
          .catch(() => setSearchSuggestions([]));
      } else {
        fetch(`${window.API_BASE_URL}/api/search-suggestions?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { Authorization: sessionToken }
        })
          .then(res => res.json())
          .then(setSearchSuggestions)
          .catch(() => setSearchSuggestions([]));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, sessionToken]);

  const handleSearch = (q = searchQuery) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    setShowSearchSuggestions(false);
  };

  const masonryColumnCount = viewportWidth < 768 ? 2 : 5;
  const isMobile = viewportWidth < 768;
  const currentSortOptions = activeMainTab === 'users' ? USER_SORT_OPTIONS : SUBTABS;
  const activeSortOption = currentSortOptions.find(option => option.key === activeSubTab);
  const sortIconMap = {
    popular: '🔥',
    recommended: '✨',
    recent: '🕒',
    total_rank: '🏆',
    recent_updated: '🆕'
  };
  const activeSortIcon = sortIconMap[activeSubTab] || '🔎';
  const activeSortLabel = activeMainTab !== 'users'
    ? ({ popular: '热门', recommended: '为您推荐', recent: '最近' }[activeSubTab] || activeSortOption?.label || t('common.sort'))
    : (activeSortOption?.label || t('common.sort'));
  const activeMainTabIndex = Math.max(0, MAIN_TABS.findIndex(tab => tab.key === activeMainTab));
  const isPopularSortActive = activeSubTab === 'popular';

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

  useEffect(() => {
    const fromIndex = previousMainTabIndexRef.current;
    const toIndex = activeMainTabIndex;
    const pillEl = activePillRef.current;
    const trailEl = gooTrailRef.current;

    if (!pillEl) {
      previousMainTabIndexRef.current = toIndex;
      setPillTranslatePercent(toIndex * 100);
      return;
    }

    if (fromIndex === toIndex) {
      setPillTranslatePercent(toIndex * 100);
      return;
    }

    const fromPercent = fromIndex * 100;
    const toPercent = toIndex * 100;
    const midPercent = (fromPercent + toPercent) / 2;
    const distance = Math.abs(toIndex - fromIndex);
    const stretchScale = Math.min(1.4, 1.2 + distance * 0.1);
    const overshoot = (toPercent > fromPercent ? 1 : -1) * Math.min(16, 6 + distance * 3);

    const pillAnimation = pillEl.animate(
      [
        { transform: `translateX(${fromPercent}%) scaleX(1) scaleY(1)`, borderRadius: '12px' },
        { transform: `translateX(${fromPercent + (toPercent - fromPercent) * 0.22}%) scaleX(${stretchScale}) scaleY(0.92)`, borderRadius: '16px', offset: 0.26 },
        { transform: `translateX(${midPercent}%) scaleX(${stretchScale + 0.12}) scaleY(0.9)`, borderRadius: '18px', offset: 0.5 },
        { transform: `translateX(${toPercent + overshoot}%) scaleX(1.08) scaleY(1.04)`, borderRadius: '14px', offset: 0.78 },
        { transform: `translateX(${toPercent}%) scaleX(0.94) scaleY(1.03)`, borderRadius: '13px', offset: 0.9 },
        { transform: `translateX(${toPercent}%) scaleX(1) scaleY(1)`, borderRadius: '12px' }
      ],
      {
        duration: 560,
        easing: 'cubic-bezier(0.2, 0.95, 0.25, 1)',
        fill: 'forwards'
      }
    );

    let trailAnimation;
    if (trailEl) {
      trailAnimation = trailEl.animate(
        [
          { transform: `translateX(${fromPercent}%) scaleX(1) scaleY(1)`, opacity: 0.35 },
          { transform: `translateX(${fromPercent + (toPercent - fromPercent) * 0.18}%) scaleX(${stretchScale + 0.28}) scaleY(0.8)`, opacity: 0.5, offset: 0.34 },
          { transform: `translateX(${midPercent}%) scaleX(${stretchScale + 0.38}) scaleY(0.78)`, opacity: 0.44, offset: 0.55 },
          { transform: `translateX(${toPercent + overshoot * 0.65}%) scaleX(1.16) scaleY(0.94)`, opacity: 0.3, offset: 0.82 },
          { transform: `translateX(${toPercent}%) scaleX(1) scaleY(1)`, opacity: 0.35 }
        ],
        {
          duration: 620,
          easing: 'cubic-bezier(0.18, 0.95, 0.25, 1)',
          fill: 'forwards'
        }
      );
    }

    pillAnimation.onfinish = () => {
      setPillTranslatePercent(toPercent);
      previousMainTabIndexRef.current = toIndex;
    };

    return () => {
      pillAnimation.cancel();
      if (trailAnimation) trailAnimation.cancel();
    };
  }, [activeMainTabIndex]);

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
      <style>{`
        @keyframes browseFlamePulse {
          0% { filter: saturate(1) brightness(1); }
          50% { filter: saturate(1.35) brightness(1.16); }
          100% { filter: saturate(1) brightness(1); }
        }
      `}</style>
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
        <section
          className="mb-3 w-100"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            background: 'rgba(255,255,255,1)',
            backdropFilter: 'blur(6px)'
          }}
        >
          <a
            href="/"
            aria-label="Home"
            title="Home"
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            <img src={textLogo} alt="Logo" style={{ height: '2.2rem', width: 'auto', objectFit: 'contain', display: 'block' }} />
          </a>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <div style={{ width: 'clamp(200px, 30vw, 480px)', position: 'relative', marginLeft: 'auto' }}>
            <div
              className="input-group rounded-pill"
              style={{
                background: '#f5f6fa',
                borderRadius: 24,
                border: `2px solid ${searchFocused ? '#736B92' : 'transparent'}`,
                boxShadow: searchFocused ? '0 0 0 4px rgba(115,107,146,0.16)' : 'none',
                transition: 'box-shadow 120ms ease, border-color 120ms ease'
              }}
            >
              <input
                type="text"
                className="form-control border-0 rounded-pill"
                style={{ background: 'transparent', fontSize: '0.92rem', paddingLeft: 14, color: '#232323', outline: 'none', boxShadow: 'none' }}
                placeholder={t('topbar.search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                onFocus={() => { setShowSearchSuggestions(true); setSearchFocused(true); }}
                onBlur={() => setTimeout(() => { setShowSearchSuggestions(false); setSearchFocused(false); }, 100)}
                aria-autocomplete="list"
                aria-haspopup="true"
              />
              <button
                className="btn rounded-pill px-3"
                style={{ fontSize: '0.92rem', background: '#736B92', color: '#fff', borderColor: '#736B92', outline: 'none', boxShadow: 'none' }}
                onClick={() => handleSearch()}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 100)}
              >
                <i className="bi bi-search"></i>
              </button>
            </div>
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <ul
                className="list-group position-absolute w-100 shadow rounded-4"
                style={{ top: '100%', zIndex: 1040, maxHeight: 176, overflowY: 'auto', background: '#fff', color: '#232323', border: 'none', fontSize: '0.8rem' }}
              >
                {searchSuggestions.map(({ keyword, count }) => (
                  <li
                    key={keyword}
                    className="list-group-item list-group-item-action rounded-3"
                    style={{ cursor: 'pointer', transition: 'background 0.16s', background: 'transparent', color: '#232323', border: 'none', fontSize: '0.8rem' }}
                    onClick={() => handleSearch(keyword)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#232323'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}
                  >
                    <span className="fw-semibold">{keyword}</span> <small className="text-muted">{t('topbar.suggestion_count', { count })}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setShowOnboarding(true)}
            aria-label={t('onboarding.replay_tour')}
            title={t('onboarding.replay_tour')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#736B92',
              fontSize: '1.1rem',
              padding: '0.35rem 0.45rem',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 0.16s, color 0.16s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <i className="bi bi-play-circle" style={{ fontSize: '1.05rem' }}></i>
          </button>
          <button
            onClick={() => setShowUpdateNotification(true)}
            aria-label={t('topbar.updates')}
            title={t('topbar.updates')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#736B92',
              fontSize: '1.2rem',
              padding: '0.35rem 0.55rem',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 0.16s, color 0.16s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <i className="bi bi-megaphone" style={{ fontSize: '1.2rem' }}></i>
          </button>

          <button
            onClick={() => setShowProblemReport(true)}
            aria-label={t('topbar.report_problem')}
            title={t('topbar.report_problem')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#736B92',
              fontSize: '1.2rem',
              padding: '0.35rem 0.55rem',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 0.16s, color 0.16s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <i className="bi bi-flag" style={{ fontSize: '1.2rem' }}></i>
          </button>
          </div>
        </section>

        {/* Main Tabs */}
        <div
          className="browse-main-tabs d-flex flex-row mb-3 w-100 align-items-center"
          style={{
            gap: isMobile ? 8 : 12,
            justifyContent: 'space-between'
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: `repeat(${MAIN_TABS.length}, minmax(0, 1fr))`,
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
              maxWidth: isMobile ? 'none' : 720,
              borderRadius: 16,
              padding: 4,
              background: 'rgba(255, 255, 255, 0.42)',
              border: '1px solid rgba(255, 255, 255, 0.7)',
              boxShadow: '0 10px 28px rgba(114, 124, 150, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              overflow: 'hidden'
            }}
          >
            <div
              aria-hidden="true"
              ref={gooTrailRef}
              style={{
                position: 'absolute',
                left: 4,
                top: 6,
                bottom: 6,
                width: `calc((100% - 8px) / ${MAIN_TABS.length})`,
                borderRadius: 14,
                background: 'radial-gradient(120% 90% at 50% 50%, rgba(214, 200, 238, 0.62) 0%, rgba(214, 200, 238, 0.2) 62%, rgba(214, 200, 238, 0) 100%)',
                filter: 'blur(4px)',
                opacity: 0.35,
                transform: `translateX(${pillTranslatePercent}%) scaleX(1) scaleY(1)`,
                transition: 'none',
                transformOrigin: 'center center',
                pointerEvents: 'none',
                willChange: 'transform, opacity'
              }}
            />
            <div
              aria-hidden="true"
              ref={activePillRef}
              style={{
                position: 'absolute',
                left: 4,
                top: 4,
                bottom: 4,
                width: `calc((100% - 8px) / ${MAIN_TABS.length})`,
                borderRadius: 12,
                background: 'linear-gradient(180deg, #f3eef9 0%, #ebe5f1 100%)',
                boxShadow: '0 8px 18px rgba(124, 109, 158, 0.2), inset 0 1px 0 rgba(255,255,255,0.82), inset 0 -1px 2px rgba(124,109,158,0.06)',
                transform: `translateX(${pillTranslatePercent}%) scaleX(1)`,
                transition: 'none',
                transformOrigin: 'center center',
                willChange: 'transform'
              }}
            />
            {MAIN_TABS.map(tab => (
              <button
              key={tab.key}
              onClick={() => handleMainTab(tab.key)}
              style={{
                position: 'relative',
                zIndex: 1,
                border: 'none',
                background: 'transparent',
                color: activeMainTab === tab.key ? '#5C5178' : '#52515B',
                borderRadius: 12,
                fontSize: isMobile ? '0.9rem' : '0.98rem',
                padding: isMobile ? '0.42rem 0.3rem' : '0.5rem 0.35rem',
                fontWeight: activeMainTab === tab.key ? 700 : 600,
                cursor: 'pointer',
                transition: 'color 180ms ease, opacity 180ms ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                if (activeMainTab !== tab.key) {
                  e.currentTarget.style.color = '#3F3D48';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = activeMainTab === tab.key ? '#5C5178' : '#52515B';
              }}
            >
              {tab.label}
            </button>
          ))}
          </div>

          {/* Sort Dropdown */}
          {currentSortOptions.length > 0 && (
            <div ref={sortDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{
                  background: showSortDropdown ? '#F0ECFA' : '#F8F6FC',
                  color: showSortDropdown ? '#4C4463' : '#5F5778',
                  border: '1px solid rgba(231, 226, 244, 0.95)',
                  borderRadius: 14,
                  fontSize: isMobile ? '0.86rem' : '0.98rem',
                  padding: isMobile ? '0.42rem 0.72rem' : '0.5rem 0.95rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '4px' : '8px',
                  transition: 'background 0.22s ease, color 0.22s ease, transform 0.18s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                  boxShadow: showSortDropdown
                    ? '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255,255,255,0.85)'
                    : '0 5px 12px rgba(141, 125, 176, 0.14), 0 1px 0 rgba(255,255,255,0.75) inset',
                  whiteSpace: 'nowrap',
                  transform: showSortDropdown ? 'translateY(-1px)' : 'translateY(0)'
                }}
                onMouseEnter={e => {
                  if (!showSortDropdown) {
                    e.currentTarget.style.background = '#F2EEFA';
                    e.currentTarget.style.borderColor = 'rgba(220, 212, 238, 0.95)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(141, 125, 176, 0.2), inset 0 1px 0 rgba(255,255,255,0.88)';
                  }
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  if (!showSortDropdown) {
                    e.currentTarget.style.background = '#F8F6FC';
                    e.currentTarget.style.borderColor = 'rgba(231, 226, 244, 0.95)';
                    e.currentTarget.style.boxShadow = '0 5px 12px rgba(141, 125, 176, 0.14), 0 1px 0 rgba(255,255,255,0.75) inset';
                  } else {
                    e.currentTarget.style.background = '#F0ECFA';
                    e.currentTarget.style.borderColor = 'rgba(223, 216, 238, 0.95)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(141, 125, 176, 0.22), inset 0 1px 0 rgba(255,255,255,0.85)';
                  }
                  e.currentTarget.style.transform = showSortDropdown ? 'translateY(-1px)' : 'translateY(0)';
                }}
              >
                <i className="bi bi-sort-down" style={{ fontSize: '1.1rem' }}></i>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                  {!isMobile && (
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: '0.95rem',
                        lineHeight: 1,
                        animation: isPopularSortActive ? 'browseFlamePulse 2.8s ease-in-out infinite' : 'none',
                        transformOrigin: '50% 60%'
                      }}
                    >
                      {activeSortIcon}
                    </span>
                  )}
                  <span>{activeSortLabel}</span>
                </span>
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
                        <span aria-hidden="true" style={{ fontSize: '0.95rem', lineHeight: 1 }}>
                          {sortIconMap[option.key] || '🔎'}
                        </span>
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
      <UpdateNotificationModal show={showUpdateNotification} onClose={() => setShowUpdateNotification(false)} />
      <ProblemReportModal show={showProblemReport} onClose={() => setShowProblemReport(false)} />
      </div>
    </PageWrapper>
  );
}

export default BrowsePage;