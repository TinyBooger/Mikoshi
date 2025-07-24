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
      className="d-flex align-items-center justify-content-between px-4 py-2 bg-white shadow-sm"
      style={{ height: 64, zIndex: 1030, borderBottom: '1px solid #e9ecef' }}
    >
      {location.pathname !== '/' && (
        <button
          className="btn btn-outline-primary rounded-pill me-3"
          style={{ fontSize: '1.1rem', padding: '0.4rem 1rem' }}
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left"></i>
        </button>
      )}

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 mx-3">
        <button
          className={`btn btn-sm rounded-pill px-3 fw-semibold shadow-sm ${activeTab === 'recommended' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
          onClick={() => navigateToTab('recommended')}
        >
          For You
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 fw-semibold shadow-sm ${activeTab === 'popular' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
          onClick={() => navigateToTab('popular')}
        >
          Popular
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 fw-semibold shadow-sm ${activeTab === 'recent' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
          onClick={() => navigateToTab('recent')}
        >
          Recent
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 fw-semibold shadow-sm ${activeTab === 'tags' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
          onClick={() => navigateToTab('tags')}
        >
          Tags
        </button>
      </div>

      {/* Search Bar */}
      <div className="ms-auto" style={{ width: 270, position: 'relative' }}>
        <div className="input-group input-group-sm rounded-pill shadow-sm" style={{ background: '#f8f9fa', borderRadius: 32 }}>
          <input
            type="text"
            className="form-control border-0 rounded-pill"
            style={{ background: 'transparent', fontSize: '1rem', paddingLeft: 18 }}
            placeholder="Search characters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            aria-autocomplete="list"
            aria-haspopup="true"
          />
          <button className="btn btn-primary rounded-pill px-3" style={{ fontSize: '1.1rem' }} onClick={() => handleSearch()}>
            <i className="bi bi-search"></i>
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute w-100 shadow rounded-4"
            style={{ top: '100%', zIndex: 1040, maxHeight: 220, overflowY: 'auto', background: '#fff' }}
          >
            {suggestions.map(({ keyword, count }) => (
              <li
                key={keyword}
                className="list-group-item list-group-item-action rounded-3"
                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                onClick={() => handleSearch(keyword)}
              >
                <span className="fw-semibold">{keyword}</span> <small className="text-muted">({count})</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Topbar;