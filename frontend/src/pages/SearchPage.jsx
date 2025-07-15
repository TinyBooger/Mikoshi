import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState("relevance"); // default sort
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch search results when URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const sort = params.get("sort") || "relevance";
    setQuery(q);
    setSortBy(sort);
    setLoading(true);

    async function fetchCharacters() {
      try {
        const res = await fetch(`/api/characters/search?q=${encodeURIComponent(q)}&sort=${sort}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);

        // Update search term count (optional)
        if (q.trim()) {
          fetch("/api/update-search-term", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword: q.trim() }),
          });
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCharacters();
  }, [location.search]);

  // Fetch suggestions (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() === '') {
        fetch('/api/search-suggestions/popular')
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`/api/search-suggestions?q=${encodeURIComponent(query.trim())}`)
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSortChange = (newSort) => {
    navigate(`/search?q=${encodeURIComponent(query)}&sort=${newSort}`);
  };

  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      <div id="topbar-container" className="flex-shrink-0"></div>
      <div className="flex-grow-1 p-4 overflow-auto d-flex flex-column align-items-center">
        {/* --- NEW SEARCH BAR (CENTERED) --- */}
        <div className="mb-4" style={{ width: "100%", maxWidth: "500px", position: "relative" }}>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Search characters..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              aria-autocomplete="list"
              aria-haspopup="true"
            />
            <button 
              className="btn btn-primary" 
              onClick={() => handleSearch()}
            >
              <i className="bi bi-search"></i>
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="list-group position-absolute w-100 mt-1"
              style={{ zIndex: 1040, maxHeight: "200px", overflowY: "auto" }}
            >
              {suggestions.map(({ keyword, count }) => (
                <li
                  key={keyword}
                  className="list-group-item list-group-item-action"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleSearch(keyword)}
                >
                  {keyword} <small className="text-muted">({count})</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- EXISTING RESULTS --- */}
        <div style={{ width: "100%" }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="mb-0">Search Results</h2>
            <div className="btn-group" role="group">
              <button 
                type="button" 
                className={`btn btn-sm ${sortBy === 'relevance' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSortChange('relevance')}
              >
                Relevance
              </button>
              <button 
                type="button" 
                className={`btn btn-sm ${sortBy === 'popularity' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSortChange('popularity')}
              >
                Popularity
              </button>
              <button 
                type="button" 
                className={`btn btn-sm ${sortBy === 'recent' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => handleSortChange('recent')}
              >
                Recent
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted">
              No results for "{query}"
            </p>
          ) : (
            <ul className="list-group">
              {results.map((char) => (
                <li
                  key={char.id}
                  className="list-group-item d-flex align-items-center"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/chat?character=${char.id}`)}
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
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}