import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { AuthContext } from './AuthProvider';
import logoText from '../assets/images/logo_text.png';


function Topbar({ onToggleSidebar, sidebarVisible, onToggleCharacterSidebar, characterSidebarVisible }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionToken } = useContext(AuthContext);

  // Only use search bar if not on ChatPage
  const isChatPage = location.pathname.startsWith('/chat');

  // Search bar state and logic only if not ChatPage
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isChatPage) return;
    const timer = setTimeout(() => {
  if (!sessionToken) return;
      if (query.trim() === '') {
        fetch(`${window.API_BASE_URL}/api/search-suggestions/popular`, {
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      } else {
        fetch(`${window.API_BASE_URL}/api/search-suggestions?q=${encodeURIComponent(query.trim())}`, {
          headers: { 'Authorization': sessionToken }
        })
          .then(res => res.json())
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sessionToken, isChatPage]);

  const handleSearch = (q = query) => {
    const trimmed = q.trim();
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      className="d-flex align-items-center justify-content-between px-3 py-1 shadow-sm"
      style={{
        height: '7dvh',
        zIndex: 100,
        background: 'rgba(255,255,255,0.48)', // half transparent white
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderBottom: '1.2px solid #e9ecef',
        fontFamily: 'Inter, sans-serif',
        position: 'sticky',
        top: 0,
      }}>
      {/* Sidebar Toggle Button - modern, clean, icon only */}
      <button
        className="me-2"
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          margin: 0,
          color: '#232323',
          fontSize: '1.6rem',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
        onClick={onToggleSidebar}
        aria-label={sidebarVisible ? t('topbar.hide_sidebar') : t('topbar.show_sidebar')}
        tabIndex={0}
        onMouseEnter={e => { e.currentTarget.style.color = '#232323'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#232323'; }}
      >
        <i
          className={`bi ${sidebarVisible ? 'bi-arrow-bar-left' : 'bi-layout-sidebar'}`}
          style={{ fontSize: '1.6rem', pointerEvents: 'none' }}
        ></i>
      </button>

      {/* Logo (click to go home) */}
      <img
        src={logoText}
        alt="Mikoshi"
        draggable={false}
        className="ms-2 d-none d-sm-block"
        style={{ height: 34, objectFit: 'contain', cursor: 'pointer' }}
        onClick={() => navigate('/')}
      />

      {/* Character Sidebar Toggle Button for ChatPage only */}
      {isChatPage && (
        <button
          className="ms-2"
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            margin: 0,
            color: '#232323',
            fontSize: '1.4rem',
            cursor: 'pointer',
            outline: 'none',
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s',
          }}
          onClick={onToggleCharacterSidebar}
          aria-label={characterSidebarVisible ? t('topbar.hide_character_sidebar') : t('topbar.show_character_sidebar')}
          tabIndex={0}
          onMouseEnter={e => { e.currentTarget.style.color = '#232323'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#232323'; }}
        >
          <i
            className={`bi ${characterSidebarVisible ? 'bi-people-fill' : 'bi-people'}`}
            style={{ fontSize: '1.4rem', pointerEvents: 'none' }}
          ></i>
        </button>
      )}

      {/* Search Bar only if not ChatPage */}
      {!isChatPage && (
        <div className="ms-auto" style={{ width: 216, position: 'relative' }}>
          <div className="input-group input-group-sm rounded-pill shadow-sm" style={{ background: '#f5f6fa', borderRadius: 26 }}>
            <input
              type="text"
              className="form-control border-0 rounded-pill"
              style={{ background: 'transparent', fontSize: '0.8rem', paddingLeft: 14, color: '#232323' }}
              placeholder={t('topbar.search_placeholder')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
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
              style={{ top: '100%', zIndex: 1040, maxHeight: 176, overflowY: 'auto', background: '#fff', color: '#232323', border: 'none', fontSize: '0.8rem' }}>
              {suggestions.map(({ keyword, count }) => (
                <li
                  key={keyword}
                  className="list-group-item list-group-item-action rounded-3"
                  style={{ cursor: 'pointer', transition: 'background 0.16s', background: 'transparent', color: '#232323', border: 'none', fontSize: '0.8rem' }}
                  onClick={() => handleSearch(keyword)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#232323'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#232323'; }}>
                  <span className="fw-semibold">{keyword}</span> <small className="text-muted">{t('topbar.suggestion_count', { count })}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Topbar;