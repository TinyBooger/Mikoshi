import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div
      className="d-flex align-items-center justify-content-between px-3 py-2 shadow-sm bg-light position-sticky top-0"
      style={{ zIndex: 1030 }}
    >
      {location.pathname !== '/' && document.referrer !== '' && (
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => window.history.back()}
        >
          <i className="bi bi-arrow-left"></i>
        </button>
      )}
      <div className="ms-auto" style={{ width: 250 }}>
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control"
            placeholder="Search characters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-outline-primary" onClick={handleSearch}>
            <i className="bi bi-search"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
