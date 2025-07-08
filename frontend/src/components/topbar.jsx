import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';

function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch popular suggestions initially or when query is empty
  useEffect(() => {
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
  }, [query]);

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (

    <div
      className="d-flex align-items-center justify-content-between px-3 shadow-sm bg-light"
      style={{ height: '56px', zIndex: 1030 }}
    >
      {location.pathname !== '/' && (
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left"></i>
        </button>
      )}
      <div className="ms-auto" style={{ width: 250, position: 'relative' }}>
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control"
            placeholder="Search characters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)} // delay to allow click
            aria-autocomplete="list"
            aria-haspopup="true"
          />
          <button className="btn btn-outline-primary" onClick={() => handleSearch()}>
            <i className="bi bi-search"></i>
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute w-100"
            style={{ top: '100%', zIndex: 1040, maxHeight: 200, overflowY: 'auto' }}
          >
            {suggestions.map(({ keyword, count }) => (
              <li
                key={keyword}
                className="list-group-item list-group-item-action"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSearch(keyword)}
              >
                {keyword} <small className="text-muted">({count})</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Topbar;
