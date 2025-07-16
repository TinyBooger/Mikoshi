import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import CharacterCard from '../components/CharacterCard';

function BrowsePage() {
  const [characters, setCharacters] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const { category } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    if (category === 'tags') {
      fetch('/api/tag-suggestions', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setTags(data);
          setIsLoading(false);
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

  const getTitle = () => {
    switch(category) {
      case 'popular':
        return 'Popular Characters';
      case 'recent':
        return 'Recently Uploaded';
      case 'recommended':
        return 'Recommended for You';
      case 'tags':
        return selectedTag ? `#${selectedTag}` : 'Browse by Tags';
      default:
        return 'Characters';
    }
  };

  const clearTagSelection = () => {
    setSelectedTag(null);
    setCharacters([]);
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">{getTitle()}</h2>
        {category === 'tags' && selectedTag && (
          <button 
            className="btn btn-outline-secondary btn-sm"
            onClick={clearTagSelection}
          >
            Back to all tags
          </button>
        )}
      </div>
      
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
          ) : category === 'tags' && !selectedTag ? (
            <>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {tags.map(tag => (
                  <button
                    key={tag.name}
                    className="btn btn-outline-primary"
                    onClick={() => fetchCharactersByTag(tag.name)}
                  >
                    {tag.name} <span className="badge bg-secondary ms-1">{tag.count}</span>
                  </button>
                ))}
              </div>
              <div className="text-muted">
                Select a tag to view characters
              </div>
            </>
          ) : (
            <>
              {isLoadingCharacters ? (
                <div className="text-center my-5">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
                  {characters.map(c => <CharacterCard key={c.id} character={c} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default BrowsePage;