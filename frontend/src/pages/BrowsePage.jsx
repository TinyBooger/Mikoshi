import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';
import CharacterCard from '../components/CharacterCard';
import { AuthContext } from '../components/AuthProvider';

function BrowsePage() {
  const { idToken } = useContext(AuthContext);
  const [characters, setCharacters] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [isLoadingAllTags, setIsLoadingAllTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { category } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!idToken) {
      navigate('/');
      return;
    }

    setIsLoading(true);
    if (category === 'tags') {
      // Load popular tags
      fetch('/api/tag-suggestions', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setPopularTags(data);
          setIsLoading(false);
        });
      
      // Load all tags for alphabetical browsing
      setIsLoadingAllTags(true);
      fetch('/api/tags/all', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setAllTags(organizeTagsAlphabetically(data));
          setIsLoadingAllTags(false);
        });
    } else {
      fetch(`/api/characters/${category}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setCharacters(data);
          setIsLoading(false);
        });
    }
  }, [category, navigate, idToken]);

  const organizeTagsAlphabetically = (tags) => {
    const organized = {};
    tags.forEach(tag => {
      // Check if first character is a letter
      const firstChar = tag.name[0];
      let category;
      
      if (/[a-zA-Z]/.test(firstChar)) {
        category = firstChar.toUpperCase();
      } else {
        category = '#'; // Group all non-alphabetic tags together
      }

      if (!organized[category]) {
        organized[category] = [];
      }
      organized[category].push(tag);
    });

    // Sort categories alphabetically with # at the end
    const sorted = {};
    Object.keys(organized).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    }).forEach(key => {
      sorted[key] = organized[key];
    });

    return sorted;
  };

  const fetchCharactersByTag = (tagName) => {
    setSelectedTag(tagName);
    setIsLoadingCharacters(true);
    fetch(`/api/characters/by-tag/${encodeURIComponent(tagName)}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    })
      .then(res => res.json())
      .then(data => {
        setCharacters(data);
        setIsLoadingCharacters(false);
      });
  };

  const clearTagSelection = () => {
    setSelectedTag(null);
    setCharacters([]);
  };

  const filteredTags = () => {
    if (!searchQuery) return allTags;
    
    const filtered = {};
    Object.keys(allTags).forEach(letter => {
      const matchingTags = allTags[letter].filter(tag => 
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchingTags.length > 0) {
        filtered[letter] = matchingTags;
      }
    });
    return filtered;
  };

  if (category !== 'tags') {
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
          maxWidth: '1600px',
        }}
      >
        <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>
          {category === 'popular' && 'Popular Characters'}
          {category === 'recent' && 'Recently Uploaded'}
          {category === 'recommended' && 'Recommended for You'}
        </h2>
        {isLoading ? (
          <div className="text-center my-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {category === 'recommended' && characters.length === 0 ? (
              <div className="alert alert-info">
                No recommendations yet. Please like more characters to unlock personalized suggestions.
              </div>
            ) : (
              <div className="d-flex flex-wrap gap-2" style={{ marginLeft: '-8px', marginRight: '-8px' }}>
                {characters.map(c => (
                  <div style={{ padding: '0 4px' }}>
                    <CharacterCard key={c.id} character={c} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

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
        maxWidth: '1600px',
      }}
    >
      {/* Popular Tags Section */}
      <section className="mb-5 pb-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
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
                      clearTagSelection();
                    }}
                    aria-label="Clear selection"
                  />
                </span>
              </div>
            )}
          </div>
        </div>
        {isLoading ? (
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
                  onClick={() => fetchCharactersByTag(tag.name)}
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
            <div className="d-flex flex-row overflow-auto gap-3 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%' }}>
              {selectedTag ? (
                isLoadingCharacters ? (
                  <div className="text-muted py-3">Loading characters...</div>
                ) : characters.length > 0 ? (
                  characters.map(c => (
                    <CharacterCard key={c.id} character={c} />
                  ))
                ) : (
                  <div className="text-muted py-3">No characters found with this tag</div>
                )
              ) : (
                <div className="text-muted py-3">Select a tag to view characters</div>
              )}
            </div>
          </>
        )}
      </section>

      {/* All Tags Section */}
      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Browse All Tags</h2>
          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <input
                type="text"
                className="form-control"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ background: '#f5f6fa', color: '#232323', border: '1.5px solid #e9ecef', borderRadius: 8 }}
              />
              <button
                className="btn btn-outline-secondary"
                onClick={() => setSearchQuery('')}
                disabled={!searchQuery}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
          </div>
        </div>
        {isLoadingAllTags ? (
          <div className="text-center my-3">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="tag-browser">
            {Object.keys(filteredTags()).length > 0 ? (
              <div className="row">
                {/* Split the tags into 3 columns */}
                {(() => {
                  const letters = Object.keys(filteredTags());
                  const columnCount = 3;
                  const perColumn = Math.ceil(letters.length / columnCount);
                  return Array.from({ length: columnCount }).map((_, colIndex) => (
                    <div key={colIndex} className="col-md-4">
                      {letters.slice(colIndex * perColumn, (colIndex + 1) * perColumn).map(letter => (
                        <div key={letter} className="mb-3">
                          <h5 className="text-muted mb-2" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                            {letter === '#' ? 'Other Tags' : letter}
                          </h5>
                          <div className="d-flex flex-wrap gap-2">
                            {filteredTags()[letter].map(tag => (
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
                                onClick={() => fetchCharactersByTag(tag.name)}
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
                                #{tag.name} <span className="badge bg-secondary ms-2" style={{ background: selectedTag === tag.name ? '#232323' : '#e9ecef', color: selectedTag === tag.name ? '#fff' : '#232323', fontWeight: 600 }}>{tag.count}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-muted py-3">
                {searchQuery ? 'No tags match your search' : 'No tags available'}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default BrowsePage;