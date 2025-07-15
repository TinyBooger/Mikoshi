import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import CharacterCard from '../components/CharacterCard';

function BrowsePage() {
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { category } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    if (category === 'tags') {
      fetch('/api/tag-suggestions', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          setCharacters(data); // In this case, characters will actually be tags
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

  const getTitle = () => {
    switch(category) {
      case 'popular':
        return 'Popular Characters';
      case 'recent':
        return 'Recently Uploaded';
      case 'recommended':
        return 'Recommended for You';
      case 'tags':
        return 'Browse by Tags';
      default:
        return 'Characters';
    }
  };

  return (
    <div className="container mt-4">
      <h2>{getTitle()}</h2>
      
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

export default BrowsePage;