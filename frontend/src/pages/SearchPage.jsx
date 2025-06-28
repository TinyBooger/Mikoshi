// src/pages/SearchPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router';

import defaultPicture from '../assets/images/default-picture.png';

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    setQuery(q);

    async function fetchCharacters() {
      const res = await fetch(`/api/characters/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResults(data);
      setLoading(false);
    }

    fetchCharacters();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <div id="sidebar-placeholder" style={{ width: 250, flexShrink: 0 }}></div>
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div id="topbar-container" className="flex-shrink-0"></div>
        <main
          id="main-content"
          className="flex-grow-1 p-4 overflow-auto"
          style={{ minHeight: 0 }}
        >
          <h2>Search Results</h2>
          <ul className="list-group">
            {results.length === 0 ? (
              <li className="list-group-item text-muted">
                No results for "{query}"
              </li>
            ) : (
              results.map((char) => (
                <li
                  key={char.id}
                  className="list-group-item d-flex align-items-center"
                  style={{ cursor: "pointer" }}
                  onClick={() => (navigate(`/chat?character=${char.id}`))}
                >
                  <img
                    src={char.picture || defaultPicture}
                    alt={char.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      marginRight: 10,
                    }}
                  />
                  <div>
                    <strong>{char.name}</strong>
                    <br />
                    <small className="text-muted">{char.persona}</small>
                  </div>
                </li>
              ))
            )}
          </ul>
        </main>
      </div>
    </div>
  );
}
