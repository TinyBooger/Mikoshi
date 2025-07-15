import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import CharacterCard from '../components/CharacterCard';

function HomePage() {
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [tagCharacters, setTagCharacters] = useState({});
  const [loadingTags, setLoadingTags] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch existing sections
    fetch(`/api/characters/popular`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPopular);

    fetch(`/api/characters/recent`, { credentials: 'include' })
      .then(res => res.json())
      .then(setRecent);

    fetch(`/api/characters/recommended`, { credentials: 'include' })
      .then(res => res.json())
      .then(setRecommended);

    // Fetch popular tags
    fetch('/api/tag-suggestions', { credentials: 'include' })
      .then(res => res.json())
      .then(tags => {
        setPopularTags(tags);
        setLoadingTags(false);
        
        // Pre-fetch characters for the first few popular tags
        const topTags = tags.slice(0, 3);
        topTags.forEach(tag => {
          fetchCharactersByTag(tag.name);
        });
      });
  }, []);

  const fetchCharactersByTag = (tagName) => {
    fetch(`/api/characters/by-tag/${encodeURIComponent(tagName)}`, { credentials: 'include' })
      .then(res => res.json())
      .then(characters => {
        setTagCharacters(prev => ({
          ...prev,
          [tagName]: characters
        }));
      });
  };

  const handleTagClick = (tagName) => {
    fetchCharactersByTag(tagName);
  };

  return (
    <>
      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4>Popular Characters</h4>
          <button 
            className="btn btn-link" 
            onClick={() => navigate('/browse/popular')}
          >
            More...
          </button>
        </div>
        <div className="d-flex flex-row overflow-auto gap-3">
          {popular.map(c => <CharacterCard key={c.id} character={c} />)}
        </div>
      </section>

      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4>Recently Uploaded</h4>
          <button 
            className="btn btn-link" 
            onClick={() => navigate('/browse/recent')}
          >
            More...
          </button>
        </div>
        <div className="d-flex flex-row overflow-auto gap-3">
          {recent.map(c => <CharacterCard key={c.id} character={c} />)}
        </div>
      </section>

      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4>Recommended for You</h4>
          {recommended.length > 0 && (
            <button 
              className="btn btn-link" 
              onClick={() => navigate('/browse/recommended')}
            >
              More...
            </button>
          )}
        </div>
        {recommended.length === 0 ? (
          <p>No recommendations yet. Please like more characters to unlock personalized suggestions.</p>
        ) : (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
            {recommended.map(c => <CharacterCard key={c.id} character={c} />)}
          </div>
        )}
      </section>

      <section className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4>Popular Tags</h4>
          <button 
            className="btn btn-link" 
            onClick={() => navigate('/browse/tags')}
          >
            More...
          </button>
        </div>

        {loadingTags ? (
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
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => handleTagClick(tag.name)}
                >
                  {tag.name} <span className="badge bg-secondary ms-1">{tag.count}</span>
                </button>
              ))}
            </div>

            {Object.entries(tagCharacters).map(([tagName, characters]) => (
              <div key={tagName} className="mb-4">
                <h5 className="mb-2">#{tagName}</h5>
                <div className="d-flex flex-row overflow-auto gap-3">
                  {characters.map(c => (
                    <CharacterCard key={c.id} character={c} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}

export default HomePage;