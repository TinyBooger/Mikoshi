import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import CharacterCard from '../components/CharacterCard';

function BrowsePage() {
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
    setIsLoading(true);
    if (category === 'tags') {
      // Load popular tags
      fetch('/api/tag-suggestions', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setPopularTags(data);
          setIsLoading(false);
        });
      
      // Load all tags for alphabetical browsing
      setIsLoadingAllTags(true);
      fetch('/api/tags/all', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setAllTags(organizeTagsAlphabetically(data));
          setIsLoadingAllTags(false);
        });
    } else {
      fetch(`/api/characters/${category}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setCharacters(data);
          setIsLoading(false);
        });
    }
  }, [category, navigate]);

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
    fetch(`/api/characters/by-tag/${encodeURIComponent(tagName)}`, { credentials: 'include' })
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
      <div className="container mt-4">
        <h2>
          {category === 'popular' && 'Popular Characters'}
          {category === 'recent' && 'Recently Uploaded'}
          {category === 'recommended' && 'Recommended for You'}
        </h2>
        
        {isLoading ? (
          <div className="text-center my-5">
            <div className="spinner-border" role="status">
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
              <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
                {characters.map(c => <CharacterCard key={c.id} character={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-3">
            <h4 className="mb-0">Popular Tags</h4>
            {selectedTag && (
              <div className="d-flex align-items-center">
                <span className="text-muted me-2">Showing:</span>
                <span className="badge bg-primary">
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
          <div className="text-center my-3">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {popularTags.map(tag => (
                <button
                  key={tag.name}
                  className={`btn btn-sm ${
                    selectedTag === tag.name 
                      ? 'btn-primary' 
                      : 'btn-outline-primary'
                  }`}
                  onClick={() => fetchCharactersByTag(tag.name)}
                >
                  {tag.name} <span className="badge bg-secondary ms-1">{tag.likes}</span>
                </button>
              ))}
            </div>

            <div className="d-flex flex-row overflow-auto gap-3">
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
          <h4 className="mb-0">Browse All Tags</h4>
          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <input
                type="text"
                className="form-control"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            <div className="spinner-border spinner-border-sm" role="status">
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
                          <h5 className="text-muted mb-2">
                            {letter === '#' ? 'Other Tags' : letter}
                          </h5>
                          <div className="d-flex flex-wrap gap-2">
                            {filteredTags()[letter].map(tag => (
                              <button
                                key={tag.name}
                                className={`btn btn-sm ${
                                  selectedTag === tag.name 
                                    ? 'btn-primary' 
                                    : 'btn-outline-secondary'
                                }`}
                                onClick={() => fetchCharactersByTag(tag.name)}
                              >
                                {tag.name} <span className="badge bg-secondary ms-1">{tag.count}</span>
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