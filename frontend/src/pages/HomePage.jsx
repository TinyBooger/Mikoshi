// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import CharacterCard from '../components/CharacterCard';

function HomePage() {
  const [popular, setPopular] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/characters/popular`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPopular);
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
        <div className="d-flex flex-row overflow-auto gap-3"></div>
      </section>
      <section className="mb-4">
        <h4>Recommended for You</h4>
        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3"></div>
      </section>
    </>
  );
}

export default HomePage;
