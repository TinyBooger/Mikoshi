import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import EntityCard from '../components/EntityCard';
import CardSection from '../components/CardSection';
import { AuthContext } from '../components/AuthProvider';
import PageWrapper from '../components/PageWrapper';
import PaginationBar from '../components/PaginationBar';


function BrowsePage() {
  const { t } = useTranslation();
  const { sessionToken } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { category, entityType } = useParams();

  // Tabs
  const MAIN_TABS = [
    { key: 'characters', label: t('browse.characters', 'Characters') },
    { key: 'scenes', label: t('browse.scenes', 'Scenes') },
    { key: 'personas', label: t('browse.personas', 'Personas') },
  ];
  const SUBTABS = [
    { key: 'recommended', label: t('browse.for_you', 'For You') },
    { key: 'popular', label: t('browse.popular', 'Popular') },
    { key: 'recent', label: t('browse.recent', 'Recent') },
  ];

  // State
  const [activeMainTab, setActiveMainTab] = useState('characters');
  const [activeSubTab, setActiveSubTab] = useState('recommended');
  const [entities, setEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Helper: update `page` in the URL query string
  const updatePageInUrl = (nextPage, replace = false) => {
    const searchParams = new URLSearchParams(location.search);
    if (!nextPage || nextPage <= 1) {
      searchParams.delete('page');
    } else {
      searchParams.set('page', String(nextPage));
    }
    navigate({ pathname: location.pathname, search: searchParams.toString() }, { replace });
  };

  // Parse tab from URL
  useEffect(() => {
    // URL: /browse/:mainTab/:subTab
    const pathParts = location.pathname.split('/').filter(Boolean);
    let main = 'characters', sub = 'recommended';
    if (pathParts[0] === 'browse') {
      if (pathParts[1] && MAIN_TABS.some(t => t.key === pathParts[1])) main = pathParts[1];
      if (pathParts[2] && SUBTABS.some(t => t.key === pathParts[2])) sub = pathParts[2];
    }
    setActiveMainTab(main);
    setActiveSubTab(sub);
  }, [location.pathname]);

  // Reset page when tabs change
  useEffect(() => {
    setPage(1);
    updatePageInUrl(1, true);
  }, [activeMainTab, activeSubTab]);

  // Initialize page from URL on load/search change
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const p = parseInt(sp.get('page') || '1', 10);
    const normalized = Number.isNaN(p) || p < 1 ? 1 : p;
    setPage(normalized);
  }, [location.search]);

  // Navigation
  const handleMainTab = (tab) => {
    navigate(`/browse/${tab}/${activeSubTab}`);
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
    setIsLoading(true);
    let url = '';
    if (activeMainTab === 'characters') {
      url = `${window.API_BASE_URL}/api/characters/${activeSubTab}`;
    } else if (activeMainTab === 'scenes') {
      url = `${window.API_BASE_URL}/api/scenes/${activeSubTab}`;
    } else if (activeMainTab === 'personas') {
      url = `${window.API_BASE_URL}/api/personas/${activeSubTab}`;
    }
    const params = new URLSearchParams({ short: 'false', page: String(page) });
    const fetchUrl = `${url}?${params.toString()}`;
    fetch(fetchUrl, { headers: { 'Authorization': sessionToken } })
      .then(res => res.json())
      .then(data => {
        // Expect wrapper: { items, total, page, page_size, short }
        if (data && Array.isArray(data.items)) {
          setEntities(data.items);
          setTotal(data.total || 0);
          setPageSize(data.page_size || 20);
        } else if (Array.isArray(data)) { // fallback legacy list
          setEntities(data);
          setTotal(data.length);
          setPageSize(20);
        } else {
          setEntities([]);
          setTotal(0);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setEntities([]);
        setTotal(0);
        setIsLoading(false);
      });
  }, [activeMainTab, activeSubTab, sessionToken, navigate, page]);

  // Title logic
  const getSectionTitle = () => {
    if (activeMainTab === 'characters') {
      if (activeSubTab === 'popular') return t('browse.popular_characters', 'Popular Characters');
      if (activeSubTab === 'recent') return t('browse.recently_uploaded', 'Recently Uploaded');
      if (activeSubTab === 'recommended') return t('browse.recommended_for_you', 'Recommended for You');
    } else if (activeMainTab === 'scenes') {
      if (activeSubTab === 'popular') return t('browse.popular_scenes', 'Popular Scenes');
      if (activeSubTab === 'recent') return t('browse.recent_scenes', 'Recent Scenes');
      if (activeSubTab === 'recommended') return t('browse.recommended_scenes', 'Recommended Scenes');
    } else if (activeMainTab === 'personas') {
      if (activeSubTab === 'popular') return t('browse.popular_personas', 'Popular Personas');
      if (activeSubTab === 'recent') return t('browse.recent_personas', 'Recent Personas');
      if (activeSubTab === 'recommended') return t('browse.recommended_personas', 'Recommended Personas');
    }
    return '';
  };

  return (
    <PageWrapper>
      {/* Main Tabs */}
      <div className="d-flex mx-2 mb-2" style={{ gap: 25, background: 'transparent' }}>
        {MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            className="fw-bold border-0 bg-transparent"
            style={{
              color: activeMainTab === tab.key ? '#736B92' : '#888',
              fontWeight: 700,
              fontSize: '1.02rem',
              background: 'transparent',
              borderBottom: activeMainTab === tab.key ? '2.5px solid #736B92' : '2.5px solid transparent',
              borderRadius: 0,
              outline: 'none',
              transition: 'color 0.14s, border-bottom 0.14s',
              padding: '0.5rem 0',
              minWidth: 92,
              letterSpacing: '0.16px',
              cursor: 'pointer',
            }}
            onClick={() => handleMainTab(tab.key)}
            onMouseEnter={e => {
              if (activeMainTab !== tab.key) {
                e.currentTarget.style.color = '#736B92';
                e.currentTarget.style.borderBottom = '2.5px solid #736B92';
              }
            }}
            onMouseLeave={e => {
              if (activeMainTab !== tab.key) {
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderBottom = '2.5px solid transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Sub Tabs */}
      <div className="d-flex mx-2 mb-4" style={{ gap: 18, background: 'transparent' }}>
        {SUBTABS.map(sub => (
          <button
            key={sub.key}
            className="fw-bold border-0 bg-transparent"
            style={{
              color: activeSubTab === sub.key ? '#736B92' : '#888',
              fontWeight: 700,
              fontSize: '0.86rem',
              background: 'transparent',
              borderBottom: activeSubTab === sub.key ? '2px solid #736B92' : '2px solid transparent',
              borderRadius: 0,
              outline: 'none',
              transition: 'color 0.14s, border-bottom 0.14s',
              padding: '0.4rem 0',
              minWidth: 72,
              letterSpacing: '0.16px',
              cursor: 'pointer',
            }}
            onClick={() => handleSubTab(sub.key)}
            onMouseEnter={e => {
              if (activeSubTab !== sub.key) {
                e.currentTarget.style.color = '#736B92';
                e.currentTarget.style.borderBottom = '2px solid #736B92';
              }
            }}
            onMouseLeave={e => {
              if (activeSubTab !== sub.key) {
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            {sub.label}
          </button>
        ))}
      </div>
      <CardSection title={getSectionTitle()}>
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
                  {t('browse.no_recommendations_title', 'No Recommendations Yet')}
                </h5>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {t('browse.no_recommendations', 'No recommendations yet. Please like more characters to unlock personalized suggestions.')}
                </p>
              </div>
            ) : (
              <div className="alert alert-info">
                {t('browse.no_results', 'No results found.')}
              </div>
            )}
          </div>
        ) : (
          <>
            {entities.map(entity => (
              <div key={entity.id} style={{ display: 'flex', justifyContent: 'center', padding: '0 0' }}>
                <EntityCard type={activeMainTab.slice(0, -1)} entity={entity} />
              </div>
            ))}
          </>
        )}
      </CardSection>
      {/* Bottom Pagination */}
      <PaginationBar
        page={page}
        total={total}
        pageSize={pageSize}
        loading={isLoading}
        onPageChange={(next) => {
          setPage(next);
          updatePageInUrl(next);
        }}
      />
    </PageWrapper>
  );
}

export default BrowsePage;