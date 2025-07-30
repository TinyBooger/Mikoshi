import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useLocation } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import { AuthContext } from '../components/AuthProvider';
import CharacterCard from '../components/CharacterCard';

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useContext(AuthContext);

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
        const res = await fetch(`/api/characters/search?q=${encodeURIComponent(q)}&sort=${sort}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);

        // Update search term count (optional)
        if (q.trim()) {
          fetch("/api/update-search-term", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              'Authorization': `Bearer ${idToken}`
            },
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
    
    if (idToken) {
      fetchCharacters();
    }
  }, [location.search, idToken]);

  // Fetch suggestions (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() === '') {
        fetch('/api/search-suggestions/popular', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`/api/search-suggestions?q=${encodeURIComponent(query.trim())}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, idToken]);

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSortChange = (newSort) => {
    navigate(`/search?q=${encodeURIComponent(query)}&sort=${newSort}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bs-body-bg, #f8f9fa)',
      color: '#18191a',
      width: '100%',
      boxSizing: 'border-box',
      padding: 0,
    }}>
      <div id="topbar-container" className="flex-shrink-0"></div>
      <div className="flex-grow-1 d-flex flex-column align-items-center" style={{ padding: '2.5rem 0 2rem 0', width: '100%' }}>
        {/* Search Bar */}
        <div className="mb-4" style={{ width: '90%', maxWidth: 500, position: 'relative' }}>
          <div style={{ display: 'flex', borderRadius: 32, background: '#f5f6fa', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1.5px solid #e9ecef', overflow: 'hidden' }}>
            <input
              type="text"
              className="form-control border-0"
              placeholder="Search characters..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              aria-autocomplete="list"
              aria-haspopup="true"
              style={{
                background: 'transparent',
                color: '#18191a',
                fontSize: '1.1rem',
                padding: '0.8rem 1.2rem',
                outline: 'none',
                boxShadow: 'none',
                border: 'none',
              }}
            />
            <button
              className="fw-bold"
              style={{
                background: '#18191a',
                color: '#fff',
                border: 'none',
                fontSize: '1.2rem',
                padding: '0 1.5rem',
                transition: 'background 0.18s, color 0.18s',
                outline: 'none',
                cursor: 'pointer',
                borderRadius: 0,
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#232323'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#18191a'; }}
              onClick={() => handleSearch()}
            >
              <i className="bi bi-search"></i>
            </button>
          </div>
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="list-group position-absolute w-100 mt-1"
              style={{
                zIndex: 1040,
                maxHeight: 200,
                overflowY: 'auto',
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                background: '#fff',
                border: '1.5px solid #e9ecef',
              }}
            >
              {suggestions.map(({ keyword, count }) => (
                <li
                  key={keyword}
                  className="list-group-item list-group-item-action"
                  style={{
                    cursor: 'pointer',
                    background: '#fff',
                    color: '#18191a',
                    border: 'none',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '1.05rem',
                    padding: '0.7rem 1.2rem',
                  }}
                  onClick={() => handleSearch(keyword)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  {keyword} <small className="text-muted">({count})</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Results Section */}
        <div style={{
          width: '96%',
          maxWidth: 1400,
          background: '#fff',
          borderRadius: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '2.5rem 2rem',
          margin: '0 auto'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>Search Results</h2>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm fw-bold ${sortBy === 'relevance' ? '' : ''}`}
                style={{
                  background: sortBy === 'relevance' ? '#18191a' : '#fff',
                  color: sortBy === 'relevance' ? '#fff' : '#232323',
                  border: sortBy === 'relevance' ? 'none' : '1.5px solid #e9ecef',
                  boxShadow: sortBy === 'relevance' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '1.05rem',
                  padding: '0.4rem 1.2rem',
                  borderRadius: 16,
                  marginRight: 8,
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
                onClick={() => handleSortChange('relevance')}
                onMouseEnter={e => {
                  if (sortBy !== 'relevance') {
                    e.currentTarget.style.background = '#f5f6fa';
                    e.currentTarget.style.color = '#18191a';
                    e.currentTarget.style.border = '1.5px solid #cfd8dc';
                  }
                }}
                onMouseLeave={e => {
                  if (sortBy !== 'relevance') {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#232323';
                    e.currentTarget.style.border = '1.5px solid #e9ecef';
                  }
                }}
              >
                Relevance
              </button>
              <button
                type="button"
                className={`btn btn-sm fw-bold ${sortBy === 'popularity' ? '' : ''}`}
                style={{
                  background: sortBy === 'popularity' ? '#18191a' : '#fff',
                  color: sortBy === 'popularity' ? '#fff' : '#232323',
                  border: sortBy === 'popularity' ? 'none' : '1.5px solid #e9ecef',
                  boxShadow: sortBy === 'popularity' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '1.05rem',
                  padding: '0.4rem 1.2rem',
                  borderRadius: 16,
                  marginRight: 8,
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
                onClick={() => handleSortChange('popularity')}
                onMouseEnter={e => {
                  if (sortBy !== 'popularity') {
                    e.currentTarget.style.background = '#f5f6fa';
                    e.currentTarget.style.color = '#18191a';
                    e.currentTarget.style.border = '1.5px solid #cfd8dc';
                  }
                }}
                onMouseLeave={e => {
                  if (sortBy !== 'popularity') {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#232323';
                    e.currentTarget.style.border = '1.5px solid #e9ecef';
                  }
                }}
              >
                Popularity
              </button>
              <button
                type="button"
                className={`btn btn-sm fw-bold ${sortBy === 'recent' ? '' : ''}`}
                style={{
                  background: sortBy === 'recent' ? '#18191a' : '#fff',
                  color: sortBy === 'recent' ? '#fff' : '#232323',
                  border: sortBy === 'recent' ? 'none' : '1.5px solid #e9ecef',
                  boxShadow: sortBy === 'recent' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '1.05rem',
                  padding: '0.4rem 1.2rem',
                  borderRadius: 16,
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
                onClick={() => handleSortChange('recent')}
                onMouseEnter={e => {
                  if (sortBy !== 'recent') {
                    e.currentTarget.style.background = '#f5f6fa';
                    e.currentTarget.style.color = '#18191a';
                    e.currentTarget.style.border = '1.5px solid #cfd8dc';
                  }
                }}
                onMouseLeave={e => {
                  if (sortBy !== 'recent') {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#232323';
                    e.currentTarget.style.border = '1.5px solid #e9ecef';
                  }
                }}
              >
                Recent
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-dark" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted" style={{ fontSize: '1.15rem', padding: '2.5rem 0' }}>
              No results for "{query}"
            </p>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4">
              {results.map((char) => (
                <div className="col d-flex" key={char.id}>
                  <CharacterCard character={char} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}