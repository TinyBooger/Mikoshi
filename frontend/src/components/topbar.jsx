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
      className="d-flex align-items-center justify-content-between px-3 py-1 shadow-sm"
      style={{ height: 51, zIndex: 100, background: '#f8f9fa', borderBottom: '1.2px solid #e9ecef', fontFamily: 'Inter, sans-serif', position: 'sticky', top: 0 }}
    >
      {location.pathname !== '/' && (
        <button
          className="btn btn-outline-light rounded-pill me-2"
          style={{ fontSize: '0.88rem', padding: '0.32rem 0.8rem', borderColor: '#444', color: '#fff', background: '#232323' }}
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left" style={{ fontSize: '0.88rem' }}></i>
        </button>
      )}

      {/* Navigation Tabs - modern text style */}
      <div className="d-flex mx-2" style={{ gap: 25, background: 'transparent' }}>
        {[ 
          { key: 'recommended', label: 'For You' },
          { key: 'popular', label: 'Popular' },
          { key: 'recent', label: 'Recent' },
          { key: 'tags', label: 'Tags' }
        ].map(tab => (
          <button
            key={tab.key}
            className="fw-bold border-0 bg-transparent"
            style={{
              color: activeTab === tab.key ? '#18191a' : '#888',
              fontWeight: 700,
              fontSize: '0.86rem',
              background: 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid #18191a' : '2px solid transparent',
              borderRadius: 0,
              outline: 'none',
              transition: 'color 0.14s, border-bottom 0.14s',
              padding: '0.4rem 0',
              minWidth: 72,
              letterSpacing: '0.16px',
              cursor: 'pointer',
            }}
            onClick={() => navigateToTab(tab.key)}
            onMouseEnter={e => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#232323';
                e.currentTarget.style.borderBottom = '2px solid #232323';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderBottom = '2px solid transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="ms-auto" style={{ width: 216, position: 'relative' }}>
        <div className="input-group input-group-sm rounded-pill shadow-sm" style={{ background: '#f5f6fa', borderRadius: 26 }}>
          <input
            type="text"
            className="form-control border-0 rounded-pill"
            style={{ background: 'transparent', fontSize: '0.8rem', paddingLeft: 14, color: '#232323' }}
            placeholder="Search characters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            aria-autocomplete="list"
            aria-haspopup="true"
          />
          <button className="btn rounded-pill px-2" style={{ fontSize: '0.88rem', background: '#232323', color: '#fff' }} onClick={() => handleSearch()}>
            <i className="bi bi-search" style={{ fontSize: '0.88rem' }}></i>
          </button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="list-group position-absolute w-100 shadow rounded-4"
            style={{ top: '100%', zIndex: 1040, maxHeight: 176, overflowY: 'auto', background: '#fff', color: '#232323', border: 'none', fontSize: '0.8rem' }}
          >
            {suggestions.map(({ keyword, count }) => (
              <li
                key={keyword}
                className="list-group-item list-group-item-action rounded-3"
                style={{ cursor: 'pointer', transition: 'background 0.16s', background: 'transparent', color: '#232323', border: 'none', fontSize: '0.8rem' }}
                onClick={() => handleSearch(keyword)}
                onMouseEnter={e => { e.currentTarget.style.background = '#f5f6fa'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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