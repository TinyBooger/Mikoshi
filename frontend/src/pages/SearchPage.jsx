import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useLocation } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import { AuthContext } from '../components/AuthProvider';
import CharacterCard from '../components/CharacterCard';
import PageWrapper from '../components/PageWrapper';

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
        const res = await fetch(`${window.API_BASE_URL}/api/characters/search?q=${encodeURIComponent(q)}&sort=${sort}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);

        // Update search term count (optional)
        if (q.trim()) {
          fetch(`${window.API_BASE_URL}/api/update-search-term`, {
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
        fetch(`${window.API_BASE_URL}/api/search-suggestions/popular`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`${window.API_BASE_URL}/api/search-suggestions?q=${encodeURIComponent(query.trim())}`, {
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
    <PageWrapper>
      <div
        className="flex-grow-1 d-flex flex-column align-items-center"
        style={{
          padding: '2.5rem 0 2rem 0',
          width: '90%',
          maxWidth: 1400,
          margin: '0 auto',
          height: 'calc(100vh - 4.5rem)', // fits layout, adjust as needed for topbar
          overflowY: 'auto',
          overflowX: 'visible',
        }}
      >
        {/* Search Bar */}
        <div className="mb-4" style={{ width: '90%', maxWidth: 400, position: 'relative' }}>
          <div style={{ display: 'flex', borderRadius: 26, background: '#f5f6fa', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1.2px solid #e9ecef', overflow: 'hidden' }}>
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
                fontSize: '0.88rem',
                padding: '0.64rem 0.96rem',
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
                fontSize: '0.96rem',
                padding: '0 1.2rem',
                transition: 'background 0.14s, color 0.14s',
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
              <i className="bi bi-search" style={{ fontSize: '0.96rem' }}></i>
            </button>
          </div>
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="list-group position-absolute w-100 mt-1"
              style={{
                zIndex: 1040,
                maxHeight: 160,
                overflowY: 'auto',
                borderRadius: 13,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                background: '#fff',
                border: '1.2px solid #e9ecef',
                fontSize: '0.88rem'
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
                    fontSize: '0.88rem',
                    padding: '0.56rem 0.96rem',
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
          borderRadius: 19,
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          padding: '2rem 1.6rem',
          margin: '0 auto'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold text-dark mb-0" style={{ fontSize: '1.68rem', letterSpacing: '0.4px' }}>Search Results</h2>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm fw-bold ${sortBy === 'relevance' ? '' : ''}`}
                style={{
                  background: sortBy === 'relevance' ? '#18191a' : '#fff',
                  color: sortBy === 'relevance' ? '#fff' : '#232323',
                  border: sortBy === 'relevance' ? 'none' : '1.2px solid #e9ecef',
                  boxShadow: sortBy === 'relevance' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '0.84rem',
                  padding: '0.32rem 0.96rem',
                  borderRadius: 13,
                  marginRight: 6,
                  transition: 'background 0.14s, color 0.14s, border 0.14s',
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
                  border: sortBy === 'popularity' ? 'none' : '1.2px solid #e9ecef',
                  boxShadow: sortBy === 'popularity' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '0.84rem',
                  padding: '0.32rem 0.96rem',
                  borderRadius: 13,
                  marginRight: 6,
                  transition: 'background 0.14s, color 0.14s, border 0.14s',
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
                  border: sortBy === 'recent' ? 'none' : '1.2px solid #e9ecef',
                  boxShadow: sortBy === 'recent' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  fontSize: '0.84rem',
                  padding: '0.32rem 0.96rem',
                  borderRadius: 13,
                  transition: 'background 0.14s, color 0.14s, border 0.14s',
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
            <p className="text-center text-muted" style={{ fontSize: '0.92rem', padding: '2rem 0' }}>
              No results for "{query}"
            </p>
          ) : (
            <div
              // Remove Bootstrap grid classes, use flexbox for layout
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.6rem',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.4rem 0',
              }}
            >
              {results.map((char) => (
                <div key={char.id} style={{}}>
                  <CharacterCard character={char} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}