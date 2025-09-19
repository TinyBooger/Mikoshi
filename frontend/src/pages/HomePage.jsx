import React, { useState, useEffect, useContext } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useNavigate } from 'react-router';
import EntityCard from '../components/EntityCard';
import HorizontalCardSection from '../components/HorizontalCardSection';
import { AuthContext } from '../components/AuthProvider';
import { useTranslation } from 'react-i18next';


function HomePage() {
  const { t } = useTranslation();
  const [popular, setPopular] = useState([]);
  const [popularScenes, setPopularScenes] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [tagCharacters, setTagCharacters] = useState({});
  const [loadingTags, setLoadingTags] = useState(true);
  const [selectedTag, setSelectedTag] = useState(null);
  const [popularScroll, setPopularScroll] = useState({ left: false, right: false });
  const [recentScroll, setRecentScroll] = useState({ left: false, right: false });
  const [tagScroll, setTagScroll] = useState({ left: false, right: false });
  const [mounted, setMounted] = useState(false);
  const [popularPersonas, setPopularPersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [errorPersonas, setErrorPersonas] = useState(null);
  const navigate = useNavigate();
  const { currentUser, userData, idToken, loading } = useContext(AuthContext);
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
        setPopularPersonas(data);
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
            <span className="visually-hidden">Loading...</span>
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
    // Initial scroll state
    updateScrollState('popular-scroll', setPopularScroll);
    updateScrollState('recent-scroll', setRecentScroll);
    updateScrollState('tag-scroll', setTagScroll);
    // Add scroll listeners
    const pop = document.getElementById('popular-scroll');
    const rec = document.getElementById('recent-scroll');
    const tag = document.getElementById('tag-scroll');
    const popScroll = () => updateScrollState('popular-scroll', setPopularScroll);
    const recScroll = () => updateScrollState('recent-scroll', setRecentScroll);
    const tagScrollFn = () => updateScrollState('tag-scroll', setTagScroll);
    if (pop) pop.addEventListener('scroll', popScroll);
    if (rec) rec.addEventListener('scroll', recScroll);
    if (tag) tag.addEventListener('scroll', tagScrollFn);
    // Cleanup
    return () => {
      if (pop) pop.removeEventListener('scroll', popScroll);
      if (rec) rec.removeEventListener('scroll', recScroll);
      if (tag) tag.removeEventListener('scroll', tagScrollFn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, popular.length, recent.length, selectedTag, tagCharacters[selectedTag]?.length]);

  useEffect(() => {
    if (!idToken) return;
    // Fetch existing sections
    fetch(`${window.API_BASE_URL}/api/characters/popular`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setPopular)
      .catch(() => setPopular([]));

    // Fetch popular scenes
    fetch(`${window.API_BASE_URL}/api/scenes/popular`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setPopularScenes)
      .catch(() => setPopularScenes([]));

    fetch(`${window.API_BASE_URL}/api/characters/recent`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setRecent)
      .catch(() => setRecent([]));

    fetch(`${window.API_BASE_URL}/api/characters/recommended`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setRecommended)
      .catch(() => setRecommended([]));

    // Fetch popular tags
    fetch(`${window.API_BASE_URL}/api/tag-suggestions`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(tags => {
        setPopularTags(tags);
        setLoadingTags(false);
        // Pre-fetch characters for the first few popular tags
        const topTags = tags.slice(0, 3);
        topTags.forEach(tag => {
          fetchCharactersByTag(tag.name);
        });
      })
      .catch(() => setPopularTags([]));
  }, [idToken]);

  const fetchCharactersByTag = (tagName) => {
    fetch(`${window.API_BASE_URL}/api/characters/by-tag/${encodeURIComponent(tagName)}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(characters => {
        setTagCharacters(prev => ({
          ...prev,
          [tagName]: characters
        }));
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
      {/* Welcoming message */}
      <div className="w-100 d-flex flex-column align-items-center justify-content-center mb-4" style={{ minHeight: 64 }}>
        <h1 className="fw-bold text-dark mb-1" style={{ fontSize: '2.2rem', letterSpacing: '0.5px', textAlign: 'center' }}>
          {t('home.welcome')}
        </h1>
        <div className="text-muted" style={{ fontSize: '1.08rem', textAlign: 'center', maxWidth: 520 }}>
          {t('home.description')}
        </div>
      </div>
  {/* Popular Characters */}
      <HorizontalCardSection
        title={t('home.popular_characters')}
        moreLink="/browse/popular"
    contents={Array.isArray(popular) ? popular.map(c => ({ ...c, renderCard: () => <EntityCard type="character" entity={c} /> })) : popular}
        scrollState={popularScroll}
        scrollId="popular-scroll"
        navigate={navigate}
      />


      {/* Popular Scenes & Personas side by side */}
      <div className="row mb-4" style={{ gap: 0 }}>
        <div className="col-12 col-md-6 mb-4 mb-md-0">
          <HorizontalCardSection
            title={t('home.popular_scenes')}
            moreLink="/browse/scenes"
            contents={Array.isArray(popularScenes) ? popularScenes.map(scene => ({ ...scene, renderCard: () => <EntityCard type="scene" entity={scene} /> })) : popularScenes}
            scrollState={{ left: false, right: false }}
            scrollId="scene-scroll"
            navigate={navigate}
          />
        </div>
        <div className="col-12 col-md-6">
          <HorizontalCardSection
            title={t('home.popular_personas')}
            moreLink="/browse/personas"
            contents={Array.isArray(popularPersonas) ? popularPersonas.map(persona => ({ ...persona, renderCard: () => <EntityCard type="persona" entity={persona} /> })) : popularPersonas}
            scrollState={{ left: false, right: false }}
            scrollId="persona-scroll"
            navigate={navigate}
          />
        </div>
      </div>

      {/* Recently Uploaded */}
      <HorizontalCardSection
        title={t('home.recently_uploaded')}
        moreLink="/browse/recent"
    contents={Array.isArray(recent) ? recent.map(c => ({ ...c, renderCard: () => <EntityCard type="character" entity={c} /> })) : recent}
        scrollState={recentScroll}
        scrollId="recent-scroll"
        navigate={navigate}
      />

      {/* Recommended for You */}
      <HorizontalCardSection
        title={t('home.recommended_for_you')}
        moreLink="/browse/recommended"
    contents={Array.isArray(recommended) ? recommended.map(c => ({ ...c, renderCard: () => <EntityCard type="character" entity={c} /> })) : recommended}
        scrollState={{ left: false, right: false }}
        scrollId="recommended-scroll"
        navigate={navigate}
      />

      {/* Popular Tags */}
      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
      <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>{t('home.popular_tags')}</h2>
            {selectedTag && (
              <div className="d-flex align-items-center">
                <span className="text-muted me-2">{t('home.showing')}</span>
                <span className="badge bg-gradient-primary px-2 py-1 rounded-pill shadow-sm" style={{ fontSize: '0.8rem', color: '#232323', background: '#fff' }}>
                  #{selectedTag}
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
          <button
            className="fw-bold rounded-pill"
            style={{
              background: '#18191a',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              fontSize: '0.86rem',
              padding: '0.4rem 1.6rem',
              letterSpacing: '0.16px',
              transition: 'background 0.14s, color 0.14s',
              outline: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#232323';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#18191a';
            }}
            onClick={() => navigate('/browse/tags')}
          >
            {t('home.more')}
          </button>
        </div>

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
                  #{tag.name} <span className="badge bg-secondary ms-2" style={{ background: selectedTag === tag.name ? '#232323' : '#e9ecef', color: selectedTag === tag.name ? '#fff' : '#232323', fontWeight: 600, fontSize: '0.8rem', padding: '0.2em 0.7em' }}>{tag.likes}</span>
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              {selectedTag ? (
                <HorizontalCardSection
                  title={t('home.characters_for_tag', { tag: selectedTag })}
                  moreLink={'browse/tags/'}
                    contents={Array.isArray(tagCharacters[selectedTag]) ? tagCharacters[selectedTag].map(c => ({ ...c, renderCard: () => <EntityCard type="character" entity={c} /> })) : tagCharacters[selectedTag]}
                  scrollState={tagScroll}
                  scrollId="tag-scroll"
                  navigate={navigate}
                />
              ) : (
                <div className="text-muted py-4">{t('home.select_tag_to_view_characters')}</div>
              )}
            </div>
          </>
        )}
      </section>
  </PageWrapper>
  );
}

export default HomePage;