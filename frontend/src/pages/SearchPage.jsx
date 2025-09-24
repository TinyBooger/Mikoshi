import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useLocation } from 'react-router';
import defaultPicture from '../assets/images/default-picture.png';
import { AuthContext } from '../components/AuthProvider';
import EntityCard from '../components/EntityCard';
import PageWrapper from '../components/PageWrapper';
import { useTranslation } from 'react-i18next';


export default function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [activeTab, setActiveTab] = useState("characters");
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useContext(AuthContext);

  // Fetch search results when URL or tab changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const sort = params.get("sort") || "relevance";
    setQuery(q);
    setSortBy(sort);
    setLoading(true);

    async function fetchResults() {
      let endpoint = "/api/characters/search";
      if (activeTab === "scenes") endpoint = "/api/scenes/search";
      if (activeTab === "personas") endpoint = "/api/personas/search";
      try {
        const res = await fetch(`${window.API_BASE_URL}${endpoint}?q=${encodeURIComponent(q)}&sort=${sort}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);

        // Update search term count (optional, only for characters tab)
        if (q.trim() && activeTab === "characters") {
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
      fetchResults();
    }
  }, [location.search, idToken, activeTab]);

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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
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
          height: 'calc(100vh - 4.5rem)',
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
              placeholder={t('search.input_placeholder')}
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

        {/* Tabs and Sorting */}
        <div className="d-flex flex-row align-items-center justify-content-between mb-3" style={{ width: '96%', maxWidth: 1400 }}>
          {/* Tabs */}
          <div className="d-flex flex-row" style={{ gap: 12 }}>
            <button
              className={`fw-bold ${activeTab === 'characters' ? 'active-tab' : ''}`}
              style={{
                background: activeTab === 'characters' ? '#18191a' : '#f5f6fa',
                color: activeTab === 'characters' ? '#fff' : '#232323',
                border: 'none',
                borderRadius: 13,
                fontSize: '1.04rem',
                padding: '0.48rem 1.6rem',
                boxShadow: activeTab === 'characters' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.14s, color 0.14s',
                outline: 'none',
                cursor: 'pointer',
              }}
              onClick={() => handleTabChange('characters')}
            >
              {t('search.characters_tab') || 'Characters'}
            </button>
            <button
              className={`fw-bold ${activeTab === 'scenes' ? 'active-tab' : ''}`}
              style={{
                background: activeTab === 'scenes' ? '#18191a' : '#f5f6fa',
                color: activeTab === 'scenes' ? '#fff' : '#232323',
                border: 'none',
                borderRadius: 13,
                fontSize: '1.04rem',
                padding: '0.48rem 1.6rem',
                boxShadow: activeTab === 'scenes' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.14s, color 0.14s',
                outline: 'none',
                cursor: 'pointer',
              }}
              onClick={() => handleTabChange('scenes')}
            >
              {t('search.scenes_tab') || 'Scenes'}
            </button>
            <button
              className={`fw-bold ${activeTab === 'personas' ? 'active-tab' : ''}`}
              style={{
                background: activeTab === 'personas' ? '#18191a' : '#f5f6fa',
                color: activeTab === 'personas' ? '#fff' : '#232323',
                border: 'none',
                borderRadius: 13,
                fontSize: '1.04rem',
                padding: '0.48rem 1.6rem',
                boxShadow: activeTab === 'personas' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.14s, color 0.14s',
                outline: 'none',
                cursor: 'pointer',
              }}
              onClick={() => handleTabChange('personas')}
            >
              {t('search.personas_tab') || 'Personas'}
            </button>
          </div>
          {/* Sorting Toggle Dropdown */}
          <div className="dropdown" style={{ minWidth: 140 }}>
            <button
              className="btn btn-sm fw-bold dropdown-toggle"
              type="button"
              id="sortDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{
                background: '#f5f6fa',
                color: '#232323',
                border: '1.2px solid #e9ecef',
                borderRadius: 13,
                fontSize: '0.98rem',
                padding: '0.44rem 1.2rem',
                minWidth: 120,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                outline: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sortBy === 'relevance' ? t('search.relevance') : sortBy === 'popularity' ? t('search.popularity') : t('search.recent')}
            </button>
            <ul className="dropdown-menu" aria-labelledby="sortDropdown" style={{ minWidth: 140 }}>
              <li>
                <button className="dropdown-item" onClick={() => handleSortChange('relevance')} style={{ fontWeight: sortBy === 'relevance' ? 700 : 400 }}>
                  {t('search.relevance')}
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={() => handleSortChange('popularity')} style={{ fontWeight: sortBy === 'popularity' ? 700 : 400 }}>
                  {t('search.popularity')}
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={() => handleSortChange('recent')} style={{ fontWeight: sortBy === 'recent' ? 700 : 400 }}>
                  {t('search.recent')}
                </button>
              </li>
            </ul>
          </div>
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
          {loading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-dark" role="status">
                <span className="visually-hidden">{t('search.loading')}</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted" style={{ fontSize: '0.92rem', padding: '2rem 0' }}>
              {t('search.no_results', { query })}
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.6rem',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '0.4rem 0',
              }}
            >
              {activeTab === 'characters' && results.map((char) => (
                <div key={char.id} style={{}}>
                  <EntityCard type="character" entity={char} />
                </div>
              ))}
              {activeTab === 'scenes' && results.map((scene) => (
                <div key={scene.id} style={{}}>
                  <EntityCard type="scene" entity={scene} />
                </div>
              ))}
              {activeTab === 'personas' && results.map((persona) => (
                <div key={persona.id} style={{}}>
                  <EntityCard type="persona" entity={persona} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}