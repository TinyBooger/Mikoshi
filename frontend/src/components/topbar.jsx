import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { AuthContext } from '../components/AuthProvider';

function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useContext(AuthContext);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  // Set active tab based on current route
  useEffect(() => {
    if (location.pathname.startsWith('/browse/recommended')) {
      setActiveTab('recommended');
    } else if (location.pathname.startsWith('/browse/popular')) {
      setActiveTab('popular');
    } else if (location.pathname.startsWith('/browse/recent')) {
      setActiveTab('recent');
    } else {
      setActiveTab('');
    }
  }, [location.pathname]);

  // Fetch search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!idToken) return;
      
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

  const navigateToTab = (tab) => {
    navigate(`/browse/${tab}`);
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

      {/* Navigation Tabs */}
      <div className="d-flex mx-3">
        <button
          className={`btn btn-sm ${activeTab === 'recommended' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => navigateToTab('recommended')}
          style={{ marginRight: '8px' }}
        >
          For You
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'popular' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => navigateToTab('popular')}
          style={{ marginRight: '8px' }}
        >
          Popular
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'recent' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => navigateToTab('recent')}
        >
          Recent
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'tags' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => navigateToTab('tags')}
          style={{ marginRight: '8px' }}
        >
          Tags
        </button>
      </div>

      {/* Search Bar */}
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
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
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