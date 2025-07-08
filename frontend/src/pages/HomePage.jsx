import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import CharacterCard from '../components/CharacterCard';

function HomePage() {
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/characters/popular`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPopular);

    fetch(`/api/characters/recent`, { credentials: 'include' })
      .then(res => res.json())
      .then(setRecent);

    fetch(`/api/characters/recommended`, { credentials: 'include' })
      .then(res => res.json())
      .then(setRecommended);
  }, []);

  return (
    <>
      <section className="mb-4">
        <h4>Popular Characters</h4>
        <div className="d-flex flex-row overflow-auto gap-3">
          {popular.map(c => <CharacterCard key={c.id} character={c} />)}
        </div>
      </section>

      <section className="mb-4">
        <h4>Recently Uploaded</h4>
        <div className="d-flex flex-row overflow-auto gap-3">
          {recent.map(c => <CharacterCard key={c.id} character={c} />)}
        </div>
      </section>

      <section className="mb-4">
        <h4>Recommended for You</h4>
        {recommended.length === 0 ? (
          <p>No recommendations yet. Please like more characters to unlock personalized suggestions.</p>
        ) : (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
            {recommended.map(c => <CharacterCard key={c.id} character={c} />)}
          </div>
        )}
      </section>

    </>
  );
}

export default HomePage;
