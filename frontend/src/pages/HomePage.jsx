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
  const navigate = useNavigate();
  const { currentUser, userData, idToken, loading } = useContext(AuthContext);

  useEffect(() => {
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
  }, []);

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
    <div className="container-xl px-5 py-4" style={{ background: 'var(--bs-body-bg, #f8f9fa)', minHeight: '100vh' }}>
      {/* Popular Characters */}
      <section className="mb-5 pb-3 border-bottom" style={{ borderColor: '#e9ecef' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="fw-bold text-dark" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Popular Characters</h2>
          <button
            className="fw-bold rounded-pill"
            style={{
              background: '#18191a',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              fontSize: '1.08rem',
              padding: '0.5rem 2rem',
              letterSpacing: '0.2px',
              transition: 'background 0.18s, color 0.18s',
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
        <div className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          {popular.length === 0 ? (
            <div className="text-muted py-4">No popular characters found.</div>
          ) : (
            popular.map(c => (
              <div style={{ minWidth: 220, maxWidth: 260 }}>
                <CharacterCard key={c.id} character={c} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recently Uploaded */}
      <section className="mb-5 pb-3 border-bottom" style={{ borderColor: '#e9ecef' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="fw-bold text-dark" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Recently Uploaded</h2>
          <button
            className="fw-bold rounded-pill"
            style={{
              background: '#18191a',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              fontSize: '1.08rem',
              padding: '0.5rem 2rem',
              letterSpacing: '0.2px',
              transition: 'background 0.18s, color 0.18s',
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
        <div className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          {recent.length === 0 ? (
            <div className="text-muted py-4">No recent characters found.</div>
          ) : (
            recent.map(c => (
              <div style={{ minWidth: 220, maxWidth: 260 }}>
                <CharacterCard key={c.id} character={c} />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recommended for You */}
      <section className="mb-5 pb-3 border-bottom" style={{ borderColor: '#e9ecef' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="fw-bold text-dark" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Recommended for You</h2>
          {recommended.length > 0 && (
            <button
              className="fw-bold rounded-pill"
              style={{
                background: '#18191a',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                fontSize: '1.08rem',
                padding: '0.5rem 2rem',
                letterSpacing: '0.2px',
                transition: 'background 0.18s, color 0.18s',
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
        ) : (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4">
            {recommended.map(c => (
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
            <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Popular Tags</h2>
            {selectedTag && (
              <div className="d-flex align-items-center">
                <span className="text-muted me-2">Showing:</span>
                <span className="badge bg-gradient-primary text-white px-3 py-2 rounded-pill shadow-sm">
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
              fontSize: '1.08rem',
              padding: '0.5rem 2rem',
              letterSpacing: '0.2px',
              transition: 'background 0.18s, color 0.18s',
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
                    border: selectedTag === tag.name ? 'none' : '1.5px solid #e9ecef',
                    fontSize: '1rem',
                    letterSpacing: '0.5px',
                    padding: '0.4rem 1.2rem',
                    boxShadow: selectedTag === tag.name ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 0.18s, color 0.18s, border 0.18s',
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
                  #{tag.name} <span className="badge bg-secondary ms-2" style={{ background: selectedTag === tag.name ? '#232323' : '#e9ecef', color: selectedTag === tag.name ? '#fff' : '#232323', fontWeight: 600 }}>{tag.likes}</span>
                </button>
              ))}
            </div>

            <div className="d-flex flex-row flex-nowrap gap-4 pb-2" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
              {selectedTag ? (
                tagCharacters[selectedTag]?.length > 0 ? (
                  tagCharacters[selectedTag].map(c => (
                    <div style={{ minWidth: 220, maxWidth: 260 }}>
                      <CharacterCard key={c.id} character={c} />
                    </div>
                  ))
                ) : (
                  <div className="text-muted py-4">Loading characters...</div>
                )
              ) : (
                <div className="text-muted py-4">Select a tag to view characters</div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default HomePage;