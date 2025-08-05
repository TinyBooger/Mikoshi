import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import CharacterCard from '../components/CharacterCard';
import { AuthContext } from '../components/AuthProvider';


function HomePage() {
  const [popular, setPopular] = useState([]);
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
  const navigate = useNavigate();
  const { currentUser, userData, idToken, loading } = useContext(AuthContext);

  // Debug logs
  console.log('mounted:', mounted, 'loading:', loading, 'currentUser:', currentUser, 'idToken:', idToken, 'userData:', userData);

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
    fetch(`/api/characters/popular`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setPopular)
      .catch(() => setPopular([]));

    fetch(`/api/characters/recent`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setRecent)
      .catch(() => setRecent([]));

    fetch(`/api/characters/recommended`, { headers: { 'Authorization': `Bearer ${idToken}` } })
      .then(res => res.json())
      .then(setRecommended)
      .catch(() => setRecommended([]));

    // Fetch popular tags
    fetch('/api/tag-suggestions', { headers: { 'Authorization': `Bearer ${idToken}` } })
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
    fetch(`/api/characters/by-tag/${encodeURIComponent(tagName)}`, { headers: { 'Authorization': `Bearer ${idToken}` } })
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
    <div
      style={{
        width: '90%',
        margin: '0 auto',
        background: 'var(--bs-body-bg, #f8f9fa)',
        minHeight: '100vh',
        paddingLeft: '2.5rem',
        paddingRight: '2.5rem',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        boxSizing: 'border-box',
        maxWidth: '1600px', // Prevents overflow on very large screens
      }}
    >
      {/* Popular Characters */}
      <section className="mb-5 pb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
      <h2 className="fw-bold text-dark" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>Popular Characters</h2>
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
            onClick={() => navigate('/browse/popular')}
          >
            More
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Scroll Left Button */}
          {popular.length > 3 && popularScroll.left && (
            <button
              aria-label="Scroll left"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: 72,
                background: 'linear-gradient(to right, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: 'none',
                transition: 'background 0.2s',
                opacity: 0.7,
                pointerEvents: 'auto',
              }}
              onClick={() => {
                const el = document.getElementById('popular-scroll');
                if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to right, rgba(233,236,239,0.95) 80%, rgba(233,236,239,0))'; e.currentTarget.style.opacity = 1; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to right, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))'; e.currentTarget.style.opacity = 0.7; }}
            >
              <i className="bi bi-arrow-left" style={{ fontSize: 28, color: '#bfc4cb', marginLeft: 12, filter: 'drop-shadow(0 0 2px #fff)' }} />
            </button>
          )}
          <div id="popular-scroll" className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%' }}>
            {popular === null || typeof popular === 'undefined' ? (
              <div className="text-muted py-4">Loading characters...</div>
            ) : popular.length === 0 ? (
              <div className="text-muted py-4">No popular characters found.</div>
            ) : (
              Array.isArray(popular) && popular.map(c => (
                <div style={{ padding: '0 4px' }}>
                  <CharacterCard key={c.id} character={c} />
                </div>
              ))
            )}
          </div>
          {/* Scroll Right Button */}
          {popular.length > 3 && popularScroll.right && (
            <button
              aria-label="Scroll right"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                height: '100%',
                width: 72,
                background: 'linear-gradient(to left, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                cursor: 'pointer',
                zIndex: 3,
                boxShadow: 'none',
                transition: 'background 0.2s',
                opacity: 0.7,
                pointerEvents: 'auto',
              }}
              onClick={() => {
                const el = document.getElementById('popular-scroll');
                if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to left, rgba(233,236,239,0.95) 80%, rgba(233,236,239,0))'; e.currentTarget.style.opacity = 1; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to left, rgba(247,247,247,0.85) 80%, rgba(247,247,247,0))'; e.currentTarget.style.opacity = 0.7; }}
            >
              <i className="bi bi-arrow-right" style={{ fontSize: 28, color: '#bfc4cb', marginRight: 12, filter: 'drop-shadow(0 0 2px #fff)' }} />
            </button>
          )}
        </div>
      </section>

      {/* Recently Uploaded */}
      <section className="mb-5 pb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
      <h2 className="fw-bold text-dark" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>Recently Uploaded</h2>
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
            onClick={() => navigate('/browse/recent')}
          >
            More
          </button>
        </div>
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Scroll Left Button */}
          {recent.length > 3 && recentScroll.left && (
            <button
              aria-label="Scroll left"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: 48,
                background: 'linear-gradient(to right, #f8f9fa 80%, rgba(248,249,250,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 2,
                boxShadow: 'none',
                transition: 'background 0.2s',
              }}
              onClick={() => {
                const el = document.getElementById('recent-scroll');
                if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to right, #e9ecef 80%, rgba(233,236,239,0))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to right, #f8f9fa 80%, rgba(248,249,250,0))'; }}
            >
              <span style={{
                display: 'inline-block',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(24,25,26,0.12)',
                color: '#232323',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                transition: 'background 0.2s',
              }}>
                <i className="bi bi-arrow-left" />
              </span>
            </button>
          )}
          <div id="recent-scroll" className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%' }}>
            {recent === null || typeof recent === 'undefined' ? (
              <div className="text-muted py-4">Loading characters...</div>
            ) : recent.length === 0 ? (
              <div className="text-muted py-4">No recent characters found.</div>
            ) : (
              Array.isArray(recent) && recent.map(c => (
                <div style={{ padding: '0 4px' }}>
                  <CharacterCard key={c.id} character={c} />
                </div>
              ))
            )}
          </div>
          {/* Scroll Right Button */}
          {recent.length > 3 && recentScroll.right && (
            <button
              aria-label="Scroll right"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                height: '100%',
                width: 48,
                background: 'linear-gradient(to left, #f8f9fa 80%, rgba(248,249,250,0))',
                border: 'none',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 2,
                boxShadow: 'none',
                transition: 'background 0.2s',
              }}
              onClick={() => {
                const el = document.getElementById('recent-scroll');
                if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to left, #e9ecef 80%, rgba(233,236,239,0))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to left, #f8f9fa 80%, rgba(248,249,250,0))'; }}
            >
              <span style={{
                display: 'inline-block',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(24,25,26,0.12)',
                color: '#232323',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                transition: 'background 0.2s',
              }}>
                <i className="bi bi-arrow-right" />
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Recommended for You */}
      <section className="mb-5 pb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
      <h2 className="fw-bold text-dark" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>Recommended for You</h2>
          {recommended.length > 0 && (
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
              onClick={() => navigate('/browse/recommended')}
            >
              More
            </button>
          )}
        </div>
        {recommended.length === 0 ? (
          <div className="alert alert-info mt-3">No recommendations yet. Please like more characters to unlock personalized suggestions.</div>
        ) : recommended === null || typeof recommended === 'undefined' ? (
          <div className="text-muted py-4">Loading characters...</div>
        ) : (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4">
            {Array.isArray(recommended) && recommended.map(c => (
              <div className="col d-flex">
                <CharacterCard key={c.id} character={c} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Popular Tags */}
      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
      <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>Popular Tags</h2>
            {selectedTag && (
              <div className="d-flex align-items-center">
                <span className="text-muted me-2">Showing:</span>
                <span className="badge bg-gradient-primary px-2 py-1 rounded-pill shadow-sm" style={{ fontSize: '0.8rem', color: '#232323', background: '#fff' }}>
                  #{selectedTag}
                  <button 
                    className="btn-close btn-close-white btn-close-sm ms-2" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTag(null);
                    }}
                    aria-label="Clear selection"
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
            More
          </button>
        </div>

        {loadingTags ? (
          <div className="text-center my-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
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
              {/* Scroll Left Button */}
              {(selectedTag && tagCharacters[selectedTag]?.length > 3 && tagScroll.left) && (
                <button
                  aria-label="Scroll left"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: 48,
                    background: 'linear-gradient(to right, #f8f9fa 80%, rgba(248,249,250,0))',
                    border: 'none',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                    boxShadow: 'none',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => {
                    const el = document.getElementById('tag-scroll');
                    if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to right, #e9ecef 80%, rgba(233,236,239,0))'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to right, #f8f9fa 80%, rgba(248,249,250,0))'; }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(24,25,26,0.12)',
                    color: '#232323',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    transition: 'background 0.2s',
                  }}>
                    <i className="bi bi-arrow-left" />
                  </span>
                </button>
              )}
              <div id="tag-scroll" className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%' }}>
                {selectedTag ? (
                  tagCharacters[selectedTag] === null || typeof tagCharacters[selectedTag] === 'undefined' ? (
                    <div className="text-muted py-4">Loading characters...</div>
                  ) : tagCharacters[selectedTag].length === 0 ? (
                    <div className="text-muted py-4">No characters found for this tag.</div>
                  ) : (
                    Array.isArray(tagCharacters[selectedTag]) && tagCharacters[selectedTag].map(c => (
                      <div style={{ padding: '0 4px' }}>
                        <CharacterCard key={c.id} character={c} />
                      </div>
                    ))
                  )
                ) : (
                  <div className="text-muted py-4">Select a tag to view characters</div>
                )}
              </div>
              {/* Scroll Right Button */}
              {(selectedTag && tagCharacters[selectedTag]?.length > 3 && tagScroll.right) && (
                <button
                  aria-label="Scroll right"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: '100%',
                    width: 48,
                    background: 'linear-gradient(to left, #f8f9fa 80%, rgba(248,249,250,0))',
                    border: 'none',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                    boxShadow: 'none',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => {
                    const el = document.getElementById('tag-scroll');
                    if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to left, #e9ecef 80%, rgba(233,236,239,0))'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(to left, #f8f9fa 80%, rgba(248,249,250,0))'; }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(24,25,26,0.12)',
                    color: '#232323',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    transition: 'background 0.2s',
                  }}>
                    <i className="bi bi-arrow-right" />
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default HomePage;