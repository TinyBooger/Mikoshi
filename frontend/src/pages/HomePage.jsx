// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
const API_BASE = import.meta.env.VITE_API_BASE_URL;

import defaultPicture from '../assets/images/default-picture.png';

function HomePage() {
  const [popular, setPopular] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/characters/popular`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPopular);
  }, []);

  return (
    <>
      <h2>Character Library</h2>

      <section className="mb-4">
        <h4>Popular Characters</h4>
        <div className="d-flex flex-row overflow-auto gap-3">
          {popular.map(c => (
            <div
              key={c.id}
              className="card text-center"
              style={{ width: 150, margin: 5, cursor: 'pointer' }}
              onClick={() => navigate(`/chat?character=${encodeURIComponent(c.id)}`)}
            >
              <img src={c.picture || defaultPicture} className="card-img-top" alt={c.name} style={{ borderRadius: 8 }} />
              <div className="card-body p-2">
                <h6 className="card-title mb-1">{c.name}</h6>
                <p className="text-muted" style={{ fontSize: 12 }}>❤️ {c.views}</p>
              </div>
            </div>
          ))}
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
